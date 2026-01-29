#!/usr/bin/env python3
"""
Initialize demo data on container startup
Creates demo users and optionally imports recipes from Mealie

Shared Household Model:
- Demo users share the same recipes (imported once)
- Each demo user has their own favorites/notes/cooking history
- Recipe integration is configured at household level (one per provider)
"""
import os
import sys
import asyncio
from datetime import datetime, timedelta

# Ensure we can import from the app
sys.path.insert(0, '/app')

from app.pg_auth import create_user, mark_email_verified, find_user_by_email
from app.database import SessionLocal, init_db
from app.models import RecipeIntegration
from app.security import get_security_service
from app.minio_service import get_minio_service
from app.recipe_import_service import RecipeImportService

print("🌱 Initializing demo data...")

# Initialize database tables first
print("📦 Creating database tables...")
init_db()
print("✓ Database tables created")

# Demo users configuration
# 4 demo accounts for users to try the service
demo_users = [
    {
        "username": "demo1",
        "email": "demo1@pantrypal.com",
        "password": "demo123",
        "full_name": "Demo User 1",
        "is_admin": False,
        "is_demo": True
    },
    {
        "username": "demo2",
        "email": "demo2@pantrypal.com",
        "password": "demo123",
        "full_name": "Demo User 2",
        "is_admin": False,
        "is_demo": True
    },
    {
        "username": "demo3",
        "email": "demo3@pantrypal.com",
        "password": "demo123",
        "full_name": "Demo User 3",
        "is_admin": False,
        "is_demo": True
    },
    {
        "username": "demo4",
        "email": "demo4@pantrypal.com",
        "password": "demo123",
        "full_name": "Demo User 4",
        "is_admin": False,
        "is_demo": True
    },
    {
        "username": "admin",
        "email": "admin@pantrypal.com",
        "password": "admin123",
        "full_name": "Admin User",
        "is_admin": True,
        "is_demo": False
    }
]

async def setup_demo_recipes(admin_user_id: str):
    """
    Set up shared recipe integration and import recipes.

    With the shared household model:
    - Recipe integration is configured once at household level (by admin)
    - Recipes are imported once and shared across all users
    - Each user maintains their own favorites/notes/cooking history
    """
    mealie_url = os.getenv("DEMO_MEALIE_URL")
    mealie_token = os.getenv("DEMO_MEALIE_TOKEN")

    if not mealie_url or not mealie_token:
        print("ℹ️  No demo Mealie configuration found (DEMO_MEALIE_URL/DEMO_MEALIE_TOKEN)")
        return

    print(f"🍳 Setting up shared recipe integration from Mealie: {mealie_url}")

    db = SessionLocal()
    try:
        # Check if integration already exists for this provider (household-level)
        existing = db.query(RecipeIntegration).filter(
            RecipeIntegration.provider == 'mealie'
        ).first()

        if existing:
            print("✓ Mealie recipe integration already configured")
        else:
            # Create recipe integration (household-level, one per provider)
            security = get_security_service()
            encrypted_token = security.encrypt_api_token(mealie_token)

            integration = RecipeIntegration(
                provider='mealie',
                server_url=mealie_url,
                api_token_encrypted=encrypted_token,
                enabled=True,
                import_images=True,
                auto_sync=False,
                configured_by_user_id=admin_user_id,  # Track who configured it
                created_at=datetime.utcnow()
            )
            db.add(integration)
            db.commit()
            print("✅ Mealie recipe integration configured (household-level)")

        # Import recipes (shared across all users)
        minio = get_minio_service()
        import_service = RecipeImportService(db, minio)

        print("📥 Importing shared recipes...")
        stats = await import_service.import_recipes(
            imported_by_user_id=admin_user_id,  # Track who imported for audit
            provider='mealie',
            server_url=mealie_url,
            api_token=mealie_token,
            import_images=True,
            limit=100  # Import up to 100 recipes
        )

        print(f"✅ Imported {stats['imported']} recipes, updated {stats['updated']}")
        print(f"   Downloaded {stats['images_downloaded']} images")
        if stats['failed'] > 0:
            print(f"   ⚠️  {stats['failed']} failed")
        print("   Recipes are now shared across all demo users")

    except Exception as e:
        print(f"❌ Recipe import error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

try:
    user_ids = {}  # Store demo and admin user IDs
    admin_user_id = None

    for user_data in demo_users:
        try:
            # Try to create user (will fail if already exists)
            user = create_user(
                username=user_data["username"],
                password=user_data["password"],
                email=user_data["email"],
                full_name=user_data["full_name"],
                is_admin=user_data["is_admin"],
                is_demo=user_data.get("is_demo", False)
            )

            # Mark email as verified for demo accounts
            mark_email_verified(user["id"])

            print(f"✅ Created user '{user_data['username']}' (password: {user_data['password']})")

            # Save user IDs
            user_ids[user_data["username"]] = user["id"]
            if user_data["is_admin"]:
                admin_user_id = user["id"]

        except ValueError as e:
            if "already exists" in str(e):
                print(f"✓ User '{user_data['username']}' already exists")
                # Get existing user ID
                existing = find_user_by_email(user_data["email"])
                if existing:
                    user_ids[user_data["username"]] = existing["id"]
                    if user_data["is_admin"]:
                        admin_user_id = existing["id"]
            else:
                raise

    # Import demo recipes ONCE for the household (using admin account)
    # With shared model, recipes only need to be imported once
    if admin_user_id:
        print("\n📥 Setting up shared recipes for the household...")
        asyncio.run(setup_demo_recipes(admin_user_id))
    else:
        print("\n⚠️  No admin user found, skipping recipe import")

    print("\n" + "="*50)
    print("✅ Demo data initialized successfully!")
    print("\n📋 Shared Household Model:")
    print("   - All demo users share the same pantry")
    print("   - All demo users share the same recipes")
    print("   - Favorites, notes, and cooking history are per-user")
    print("\nDemo Accounts (auto-logout after 10 minutes):")
    print("  Username: demo1     Password: demo123")
    print("  Username: demo2     Password: demo123")
    print("  Username: demo3     Password: demo123")
    print("  Username: demo4     Password: demo123")
    print("\nAdmin Account:")
    print("  Username: admin     Password: admin123")
    print("="*50 + "\n")

except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    raise
