"""
Database connection and session management for PostgreSQL
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import NullPool
import os
from typing import Generator

# Get database URL from environment
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://pantrypal:pantrypal_secure_password@postgres:5432/pantrypal"
)

# Create engine
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,  # Verify connections before using
    echo=False,  # Set to True for SQL logging in development
)

# Create session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)


def get_db() -> Generator[Session, None, None]:
    """
    Dependency for FastAPI routes to get database session

    Usage:
        @app.get("/items")
        async def get_items(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """
    Initialize database tables
    Should be called on application startup
    """
    from .models import Base
    Base.metadata.create_all(bind=engine)

    # Run migrations for existing databases
    run_migrations()


def run_migrations():
    """
    Run database migrations for schema changes
    This handles adding new columns to existing tables
    """
    from sqlalchemy import text

    with engine.connect() as conn:
        # Migration: Add is_demo column to users table if it doesn't exist
        try:
            result = conn.execute(text("""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'users' AND column_name = 'is_demo'
            """))
            if result.fetchone() is None:
                conn.execute(text("""
                    ALTER TABLE users ADD COLUMN is_demo BOOLEAN DEFAULT FALSE NOT NULL
                """))
                conn.commit()
                print("Migration: Added is_demo column to users table")
        except Exception as e:
            print(f"Migration check for is_demo: {e}")

        # Migration: Shared Household Model
        # This migration transforms the database from per-user isolation to shared household model
        _run_shared_household_migration(conn)


def _run_shared_household_migration(conn):
    """
    Migration for shared household model:
    1. Create user_recipe_preferences table
    2. Migrate existing user-specific data from recipes to new table
    3. Add imported_by_user_id column to recipes
    4. Deduplicate recipes with same external_provider + external_id
    5. Update recipe_integrations to be household-level
    6. Remove deprecated columns
    """
    from sqlalchemy import text
    import uuid
    import json

    def generate_uuid():
        return str(uuid.uuid4())

    def to_json_str(val):
        """Convert value to JSON string for database insertion"""
        if val is None:
            return None
        if isinstance(val, str):
            return val  # Already a string
        return json.dumps(val)

    # Check if migration already completed
    # We check for configured_by_user_id column in recipe_integrations since
    # the user_recipe_preferences table might be created by SQLAlchemy's create_all()
    result = conn.execute(text("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'recipe_integrations' AND column_name = 'configured_by_user_id'
    """))
    if result.fetchone() is not None:
        # Migration already completed
        return

    print("Starting shared household migration...")

    try:
        # Step 1: Create user_recipe_preferences table
        print("  Creating user_recipe_preferences table...")
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS user_recipe_preferences (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                recipe_id VARCHAR(36) NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
                favorite BOOLEAN DEFAULT FALSE,
                notes TEXT,
                times_cooked INTEGER DEFAULT 0,
                last_cooked TIMESTAMP,
                match_percentage DECIMAL(5, 2),
                uses_expiring_items BOOLEAN DEFAULT FALSE,
                expiring_ingredient_count INTEGER DEFAULT 0,
                available_ingredient_count INTEGER DEFAULT 0,
                missing_ingredient_count INTEGER DEFAULT 0,
                missing_ingredients JSON,
                expiring_ingredients JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, recipe_id)
            )
        """))
        conn.commit()

        # Create indexes for user_recipe_preferences
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_user_recipe_prefs_user ON user_recipe_preferences(user_id)
        """))
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_user_recipe_prefs_recipe ON user_recipe_preferences(recipe_id)
        """))
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_user_recipe_prefs_favorite ON user_recipe_preferences(user_id, favorite)
        """))
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_user_recipe_prefs_match ON user_recipe_preferences(user_id, match_percentage)
        """))
        conn.commit()

        # Step 2: Check if recipes table has user_id column (needs migration)
        result = conn.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'recipes' AND column_name = 'user_id'
        """))
        has_user_id = result.fetchone() is not None

        if has_user_id:
            print("  Migrating user-specific data from recipes to user_recipe_preferences...")

            # Add imported_by_user_id column if it doesn't exist
            result = conn.execute(text("""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'recipes' AND column_name = 'imported_by_user_id'
            """))
            if result.fetchone() is None:
                conn.execute(text("""
                    ALTER TABLE recipes ADD COLUMN imported_by_user_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL
                """))
                conn.commit()

            # Copy user_id to imported_by_user_id for audit trail
            conn.execute(text("""
                UPDATE recipes SET imported_by_user_id = user_id WHERE imported_by_user_id IS NULL
            """))
            conn.commit()

            # Migrate user-specific fields to user_recipe_preferences
            # Get all recipes with their user-specific data
            recipes_result = conn.execute(text("""
                SELECT id, user_id, favorite, notes, times_cooked, last_cooked,
                       match_percentage, uses_expiring_items, expiring_ingredient_count,
                       available_ingredient_count, missing_ingredient_count,
                       missing_ingredients, expiring_ingredients
                FROM recipes
                WHERE user_id IS NOT NULL
            """))
            recipes = recipes_result.fetchall()

            for recipe in recipes:
                pref_id = generate_uuid()
                conn.execute(text("""
                    INSERT INTO user_recipe_preferences (
                        id, user_id, recipe_id, favorite, notes, times_cooked, last_cooked,
                        match_percentage, uses_expiring_items, expiring_ingredient_count,
                        available_ingredient_count, missing_ingredient_count,
                        missing_ingredients, expiring_ingredients, created_at, updated_at
                    ) VALUES (
                        :id, :user_id, :recipe_id, :favorite, :notes, :times_cooked, :last_cooked,
                        :match_percentage, :uses_expiring_items, :expiring_ingredient_count,
                        :available_ingredient_count, :missing_ingredient_count,
                        :missing_ingredients, :expiring_ingredients, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                    )
                    ON CONFLICT (user_id, recipe_id) DO NOTHING
                """), {
                    'id': pref_id,
                    'user_id': recipe[1],  # user_id
                    'recipe_id': recipe[0],  # id
                    'favorite': recipe[2],  # favorite
                    'notes': recipe[3],  # notes
                    'times_cooked': recipe[4] or 0,  # times_cooked
                    'last_cooked': recipe[5],  # last_cooked
                    'match_percentage': recipe[6],  # match_percentage
                    'uses_expiring_items': recipe[7] or False,  # uses_expiring_items
                    'expiring_ingredient_count': recipe[8] or 0,  # expiring_ingredient_count
                    'available_ingredient_count': recipe[9] or 0,  # available_ingredient_count
                    'missing_ingredient_count': recipe[10] or 0,  # missing_ingredient_count
                    'missing_ingredients': to_json_str(recipe[11]),  # missing_ingredients (JSON)
                    'expiring_ingredients': to_json_str(recipe[12]),  # expiring_ingredients (JSON)
                })
            conn.commit()
            print(f"    Migrated preferences for {len(recipes)} recipes")

            # Step 3: Deduplicate recipes with same external_provider + external_id
            # Keep the oldest recipe for each provider+external_id combo
            print("  Deduplicating recipes...")
            # Find duplicates
            dupes_result = conn.execute(text("""
                SELECT external_provider, external_id, MIN(created_at) as oldest_created,
                       array_agg(id ORDER BY created_at) as recipe_ids
                FROM recipes
                WHERE external_provider IS NOT NULL AND external_id IS NOT NULL
                GROUP BY external_provider, external_id
                HAVING COUNT(*) > 1
            """))
            dupes = dupes_result.fetchall()

            for dupe in dupes:
                recipe_ids = dupe[3]  # array of recipe ids
                keep_id = recipe_ids[0]  # keep the oldest one
                delete_ids = recipe_ids[1:]  # delete the rest

                # Migrate preferences from deleted recipes to the kept one
                for del_id in delete_ids:
                    # Get user preferences from the recipe being deleted
                    prefs_result = conn.execute(text("""
                        SELECT user_id, favorite, notes, times_cooked, last_cooked,
                               match_percentage, uses_expiring_items, expiring_ingredient_count,
                               available_ingredient_count, missing_ingredient_count,
                               missing_ingredients, expiring_ingredients
                        FROM user_recipe_preferences WHERE recipe_id = :recipe_id
                    """), {'recipe_id': del_id})

                    for pref in prefs_result.fetchall():
                        # Insert preference for the kept recipe if it doesn't exist
                        pref_id = generate_uuid()
                        conn.execute(text("""
                            INSERT INTO user_recipe_preferences (
                                id, user_id, recipe_id, favorite, notes, times_cooked, last_cooked,
                                match_percentage, uses_expiring_items, expiring_ingredient_count,
                                available_ingredient_count, missing_ingredient_count,
                                missing_ingredients, expiring_ingredients, created_at, updated_at
                            ) VALUES (
                                :id, :user_id, :recipe_id, :favorite, :notes, :times_cooked, :last_cooked,
                                :match_percentage, :uses_expiring_items, :expiring_ingredient_count,
                                :available_ingredient_count, :missing_ingredient_count,
                                :missing_ingredients, :expiring_ingredients, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                            )
                            ON CONFLICT (user_id, recipe_id) DO NOTHING
                        """), {
                            'id': pref_id,
                            'user_id': pref[0],
                            'recipe_id': keep_id,
                            'favorite': pref[1],
                            'notes': pref[2],
                            'times_cooked': pref[3] or 0,
                            'last_cooked': pref[4],
                            'match_percentage': pref[5],
                            'uses_expiring_items': pref[6] or False,
                            'expiring_ingredient_count': pref[7] or 0,
                            'available_ingredient_count': pref[8] or 0,
                            'missing_ingredient_count': pref[9] or 0,
                            'missing_ingredients': to_json_str(pref[10]),
                            'expiring_ingredients': to_json_str(pref[11]),
                        })

                    # Delete preferences for the deleted recipe
                    conn.execute(text("""
                        DELETE FROM user_recipe_preferences WHERE recipe_id = :recipe_id
                    """), {'recipe_id': del_id})

                    # Delete the duplicate recipe
                    conn.execute(text("""
                        DELETE FROM recipes WHERE id = :recipe_id
                    """), {'recipe_id': del_id})

            conn.commit()
            print(f"    Deduplicated {len(dupes)} recipe groups")

            # Step 4: Drop deprecated columns from recipes
            # Note: We keep user_id temporarily to avoid breaking existing queries during transition
            # In a future migration, we can drop: user_id, favorite, notes, times_cooked, last_cooked,
            # match_percentage, uses_expiring_items, expiring_ingredient_count, available_ingredient_count,
            # missing_ingredient_count, missing_ingredients, expiring_ingredients

        # Step 5: Update recipe_integrations table
        # Check if it has user_id column (old schema)
        result = conn.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'recipe_integrations' AND column_name = 'user_id'
        """))
        has_integration_user_id = result.fetchone() is not None

        if has_integration_user_id:
            print("  Migrating recipe_integrations to household-level...")

            # Add configured_by_user_id column if it doesn't exist
            result = conn.execute(text("""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'recipe_integrations' AND column_name = 'configured_by_user_id'
            """))
            if result.fetchone() is None:
                conn.execute(text("""
                    ALTER TABLE recipe_integrations ADD COLUMN configured_by_user_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL
                """))
                conn.commit()

            # Copy user_id to configured_by_user_id
            conn.execute(text("""
                UPDATE recipe_integrations SET configured_by_user_id = user_id WHERE configured_by_user_id IS NULL
            """))
            conn.commit()

            # Keep only one integration per provider (the oldest one)
            dupes_result = conn.execute(text("""
                SELECT provider, MIN(created_at) as oldest, array_agg(id ORDER BY created_at) as ids
                FROM recipe_integrations
                GROUP BY provider
                HAVING COUNT(*) > 1
            """))
            for dupe in dupes_result.fetchall():
                keep_id = dupe[2][0]
                delete_ids = dupe[2][1:]
                for del_id in delete_ids:
                    conn.execute(text("""
                        DELETE FROM recipe_integrations WHERE id = :id
                    """), {'id': del_id})
            conn.commit()

        # Step 6: Update recipe_images table - remove user_id if exists
        result = conn.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'recipe_images' AND column_name = 'user_id'
        """))
        if result.fetchone() is not None:
            print("  Recipe images table will retain user_id for backwards compatibility during transition")

        print("Shared household migration completed successfully!")

    except Exception as e:
        print(f"Migration error: {e}")
        conn.rollback()
        raise
