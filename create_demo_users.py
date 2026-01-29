#!/usr/bin/env python3
"""
Create demo user accounts for PantryPal
Run this script to populate the database with demo users
"""
import os
import sys
from pathlib import Path

# Add the parent directory to the path
sys.path.append(str(Path(__file__).parent / "services" / "api-gateway"))

from sqlalchemy.orm import Session
from app.database import SessionLocal, init_db
from app.models import User
from app.auth import get_password_hash


def create_demo_users(db: Session):
    """Create demo user accounts"""
    print("Creating demo users...")

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

    created_users = []

    for user_data in demo_users:
        # Check if user already exists
        existing_user = db.query(User).filter(User.username == user_data["username"]).first()
        if existing_user:
            print(f"✓ User '{user_data['username']}' already exists")
            created_users.append(existing_user)
            continue

        # Create new user
        user = User(
            username=user_data["username"],
            email=user_data["email"],
            password_hash=get_password_hash(user_data["password"]),
            full_name=user_data["full_name"],
            is_admin=user_data["is_admin"],
            is_demo=user_data.get("is_demo", False),
            email_verified=True  # Auto-verify demo users
        )
        db.add(user)
        db.flush()
        created_users.append(user)
        print(f"✓ Created user '{user_data['username']}' (password: {user_data['password']})")

    db.commit()
    return created_users


def main():
    """Main function to create demo users"""
    print("🌱 Initializing database...")
    init_db()

    print("\n📦 Creating demo users for PantryPal...")
    print("=" * 50)

    db = SessionLocal()
    try:
        users = create_demo_users(db)

        print("\n" + "=" * 50)
        print("✅ Demo users created successfully!")
        print("\nDemo Accounts (auto-logout after 10 minutes):")
        print("  Username: demo1     Password: demo123")
        print("  Username: demo2     Password: demo123")
        print("  Username: demo3     Password: demo123")
        print("  Username: demo4     Password: demo123")
        print("\nAdmin Account:")
        print("  Username: admin     Password: admin123")
        print("\nYou can now log in with these accounts!")

    except Exception as e:
        print(f"\n❌ Error creating demo users: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
