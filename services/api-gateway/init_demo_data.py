#!/usr/bin/env python3
"""
Initialize admin user and optionally demo data on container startup
- Admin user is ALWAYS created (production-safe)
- Demo users only created when DEMO_MODE=true
- Recipe imports only happen in DEMO_MODE

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

print("🔐 Initializing PantryPal...")

# Initialize database tables first
print("📦 Creating database tables...")
init_db()
print("✓ Database tables created")

# ============================================
# ALWAYS CREATE ADMIN USER (Production-safe)
# ============================================
print("\n🔐 Checking for admin user...")

admin_data = {
    "username": "admin",
    "email": "admin@pantrypal.com",
    "password": "admin",
    "full_name": "Admin User",
    "is_admin": True,
    "is_demo": False
}

admin_user_id = None

try:
    user = create_user(
        username=admin_data["username"],
        password=admin_data["password"],
        email=admin_data["email"],
        full_name=admin_data["full_name"],
        is_admin=admin_data["is_admin"],
        is_demo=admin_data["is_demo"]
    )
    mark_email_verified(user["id"])
    admin_user_id = user["id"]
    
    print(f"✅ Created default admin user")
    print(f"   Username: admin")
    print(f"   Password: admin")
    print(f"   ⚠️  CHANGE THIS PASSWORD IMMEDIATELY AFTER FIRST LOGIN!")
    
except ValueError as e:
    if "already exists" in str(e):
        print("✓ Admin user already exists")
        existing = find_user_by_email(admin_data["email"])
        if existing:
            admin_user_id = existing["id"]
    else:
        print(f"❌ Error creating admin user: {e}")
        raise

# ============================================
# DEMO MODE: Create demo users and recipes
# ============================================
DEMO_MODE = os.getenv("DEMO_MODE", "false").lower() == "true"

if not DEMO_MODE:
    print("\nℹ️  DEMO_MODE disabled - Skipping demo users and recipes")
    print("\n" + "="*50)
    print("✅ Admin user initialized")
    print("="*50 + "\n")
    sys.exit(0)

print("\n🌱 DEMO_MODE enabled - Creating demo data...")

# Demo users configuration
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
                configured_by_user_id=admin_user_id,
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
            imported_by_user_id=admin_user_id,
            provider='mealie',
            server_url=mealie_url,
            api_token=mealie_token,
            import_images=True,
            limit=100
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
    user_ids = {}

    for user_data in demo_users:
        try:
            user = create_user(
                username=user_data["username"],
                password=user_data["password"],
                email=user_data["email"],
                full_name=user_data["full_name"],
                is_admin=user_data["is_admin"],
                is_demo=user_data.get("is_demo", False)
            )

            mark_email_verified(user["id"])
            user_ids[user_data["username"]] = user["id"]

            print(f"✅ Created demo user '{user_data['username']}' (password: {user_data['password']})")

        except ValueError as e:
            if "already exists" in str(e):
                print(f"✓ Demo user '{user_data['username']}' already exists")
                existing = find_user_by_email(user_data["email"])
                if existing:
                    user_ids[user_data["username"]] = existing["id"]
            else:
                raise

    # Import demo recipes ONCE for the household (using admin account)
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
    print("  Username: admin     Password: admin4389)")
    print("="*50 + "\n")

except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    raise