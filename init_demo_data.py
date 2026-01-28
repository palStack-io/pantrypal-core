#!/usr/bin/env python3
"""
Initialize demo data on container startup
Creates demo users with sample inventory items
"""
import os
import sys
from datetime import datetime, timedelta

# Ensure we can import from the app
sys.path.insert(0, '/app')

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.models import Base, User
from app.auth import get_password_hash

# Database URL from environment
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://pantrypal:pantrypal_secure_password@postgres:5432/pantrypal")

print("🌱 Initializing demo data...")

# Create engine and session
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create all tables
print("📦 Creating database tables...")
Base.metadata.create_all(bind=engine)

# Create demo users
db = SessionLocal()

try:
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
        }
    ]

    for user_data in demo_users:
        # Check if user exists
        existing = db.query(User).filter(User.username == user_data["username"]).first()
        if existing:
            print(f"✓ User '{user_data['username']}' already exists")
            continue

        # Create user
        user = User(
            username=user_data["username"],
            email=user_data["email"],
            hashed_password=get_password_hash(user_data["password"]),
            full_name=user_data["full_name"],
            is_admin=user_data["is_admin"],
            email_verified=True
        )
        db.add(user)
        print(f"✅ Created user '{user_data['username']}' (password: {user_data['password']})")

    db.commit()

    print("\n" + "="*50)
    print("✅ Demo data initialized successfully!")
    print("\nDemo Accounts:")
    print("  Username: demo      Password: demo123")
    print("  Username: admin     Password: admin123  (Admin)")
    print("="*50 + "\n")

except Exception as e:
    print(f"❌ Error: {e}")
    db.rollback()
    raise
finally:
    db.close()
