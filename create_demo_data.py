#!/usr/bin/env python3
"""
Create demo accounts with sample data for PantryPal
Run this script to populate the database with demo users and sample inventory items
"""
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Add the parent directory to the path to import from services
sys.path.append(str(Path(__file__).parent / "services" / "api-gateway"))

from sqlalchemy.orm import Session
from app.database import SessionLocal, init_db
from app.models import User, InventoryItem
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
        db.flush()  # Get the ID without committing
        created_users.append(user)
        print(f"✓ Created user '{user_data['username']}' (password: {user_data['password']})")

    db.commit()
    return created_users


def create_demo_inventory(db: Session, users: list):
    """Create sample inventory items for demo users"""
    print("\nCreating demo inventory items...")

    # Get all demo users (demo1, demo2, demo3, demo4)
    demo_users_list = [u for u in users if u.username.startswith("demo")]
    if not demo_users_list:
        print("⚠️  No demo users found, skipping inventory creation")
        return

    sample_items = [
        {
            "name": "Milk",
            "quantity": 1,
            "unit": "liter",
            "location": "Refrigerator",
            "category": "Dairy",
            "expiry_date": datetime.now() + timedelta(days=5),
            "barcode": "123456789012"
        },
        {
            "name": "Bread",
            "quantity": 1,
            "unit": "loaf",
            "location": "Pantry",
            "category": "Bakery",
            "expiry_date": datetime.now() + timedelta(days=3),
            "barcode": "234567890123"
        },
        {
            "name": "Eggs",
            "quantity": 12,
            "unit": "count",
            "location": "Refrigerator",
            "category": "Dairy",
            "expiry_date": datetime.now() + timedelta(days=14),
            "barcode": "345678901234"
        },
        {
            "name": "Chicken Breast",
            "quantity": 500,
            "unit": "grams",
            "location": "Freezer",
            "category": "Meat",
            "expiry_date": datetime.now() + timedelta(days=30),
            "barcode": "456789012345"
        },
        {
            "name": "Rice",
            "quantity": 2,
            "unit": "kg",
            "location": "Pantry",
            "category": "Grains",
            "expiry_date": datetime.now() + timedelta(days=365),
            "barcode": "567890123456"
        },
        {
            "name": "Tomatoes",
            "quantity": 6,
            "unit": "count",
            "location": "Refrigerator",
            "category": "Produce",
            "expiry_date": datetime.now() + timedelta(days=7),
            "barcode": "678901234567"
        },
        {
            "name": "Pasta",
            "quantity": 500,
            "unit": "grams",
            "location": "Pantry",
            "category": "Grains",
            "expiry_date": datetime.now() + timedelta(days=180),
            "barcode": "789012345678"
        },
        {
            "name": "Olive Oil",
            "quantity": 500,
            "unit": "ml",
            "location": "Pantry",
            "category": "Condiments",
            "expiry_date": datetime.now() + timedelta(days=365),
            "barcode": "890123456789"
        },
        {
            "name": "Yogurt",
            "quantity": 4,
            "unit": "cups",
            "location": "Refrigerator",
            "category": "Dairy",
            "expiry_date": datetime.now() + timedelta(days=10),
            "barcode": "901234567890"
        },
        {
            "name": "Bananas",
            "quantity": 6,
            "unit": "count",
            "location": "Counter",
            "category": "Produce",
            "expiry_date": datetime.now() + timedelta(days=4),
            "barcode": "012345678901"
        },
        {
            "name": "Cheese",
            "quantity": 200,
            "unit": "grams",
            "location": "Refrigerator",
            "category": "Dairy",
            "expiry_date": datetime.now() + timedelta(days=21),
            "barcode": "112233445566"
        },
        {
            "name": "Orange Juice",
            "quantity": 1,
            "unit": "liter",
            "location": "Refrigerator",
            "category": "Beverages",
            "expiry_date": datetime.now() + timedelta(days=7),
            "barcode": "223344556677"
        },
        {
            "name": "Apples",
            "quantity": 5,
            "unit": "count",
            "location": "Refrigerator",
            "category": "Produce",
            "expiry_date": datetime.now() + timedelta(days=14),
            "barcode": "334455667788"
        },
        {
            "name": "Coffee",
            "quantity": 250,
            "unit": "grams",
            "location": "Pantry",
            "category": "Beverages",
            "expiry_date": datetime.now() + timedelta(days=90),
            "barcode": "445566778899"
        },
        {
            "name": "Butter",
            "quantity": 200,
            "unit": "grams",
            "location": "Refrigerator",
            "category": "Dairy",
            "expiry_date": datetime.now() + timedelta(days=30),
            "barcode": "556677889900"
        },
        {
            "name": "Spinach",
            "quantity": 1,
            "unit": "bunch",
            "location": "Refrigerator",
            "category": "Produce",
            "expiry_date": datetime.now() + timedelta(days=2),  # Expiring soon!
            "barcode": "667788990011"
        },
        {
            "name": "Carrots",
            "quantity": 8,
            "unit": "count",
            "location": "Refrigerator",
            "category": "Produce",
            "expiry_date": datetime.now() + timedelta(days=14),
            "barcode": "778899001122"
        },
        {
            "name": "Honey",
            "quantity": 500,
            "unit": "grams",
            "location": "Pantry",
            "category": "Condiments",
            "expiry_date": datetime.now() + timedelta(days=730),  # 2 years
            "barcode": "889900112233"
        }
    ]

    total_count = 0
    for demo_user in demo_users_list:
        count = 0
        for item_data in sample_items:
            # Check if item already exists for this user
            existing_item = db.query(InventoryItem).filter(
                InventoryItem.user_id == demo_user.id,
                InventoryItem.name == item_data["name"]
            ).first()

            if existing_item:
                continue

            # Create new item
            item = InventoryItem(
                user_id=demo_user.id,
                **item_data
            )
            db.add(item)
            count += 1

        if count > 0:
            print(f"✓ Created {count} inventory items for user '{demo_user.username}'")
            total_count += count

    db.commit()
    print(f"✓ Total: Created {total_count} inventory items for {len(demo_users_list)} demo users")


def main():
    """Main function to create all demo data"""
    print("🌱 Initializing database...")
    init_db()

    print("\n📦 Creating demo data for PantryPal...")
    print("=" * 50)

    db = SessionLocal()
    try:
        users = create_demo_users(db)
        create_demo_inventory(db, users)

        print("\n" + "=" * 50)
        print("✅ Demo data created successfully!")
        print("\nDemo Accounts (auto-logout after 10 minutes):")
        print("  Username: demo1     Password: demo123")
        print("  Username: demo2     Password: demo123")
        print("  Username: demo3     Password: demo123")
        print("  Username: demo4     Password: demo123")
        print("\nAdmin Account:")
        print("  Username: admin     Password: admin123")
        print("\nYou can now log in with these accounts!")
        print("\n💡 Tip: All demo users have 18 sample inventory items")

    except Exception as e:
        print(f"\n❌ Error creating demo data: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
