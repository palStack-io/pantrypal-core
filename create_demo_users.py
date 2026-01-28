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
            "username": "demo",
            "email": "demo@pantrypal.com",
            "password": "demo123",
            "full_name": "Demo User",
            "is_admin": False
        },
        {
            "username": "admin",
            "email": "admin@pantrypal.com",
            "password": "admin123",
            "full_name": "Admin User",
            "is_admin": True
        },
        {
            "username": "alice",
            "email": "alice@pantrypal.com",
            "password": "alice123",
            "full_name": "Alice Johnson",
            "is_admin": False
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
            hashed_password=get_password_hash(user_data["password"]),
            full_name=user_data["full_name"],
            is_admin=user_data["is_admin"],
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
        print("\nDemo Accounts:")
        print("  Username: demo      Password: demo123")
        print("  Username: admin     Password: admin123  (Admin)")
        print("  Username: alice     Password: alice123")
        print("\nYou can now log in with these accounts!")

    except Exception as e:
        print(f"\n❌ Error creating demo users: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
