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
        db.flush()  # Get the ID without committing
        created_users.append(user)
        print(f"✓ Created user '{user_data['username']}' (password: {user_data['password']})")

    db.commit()
    return created_users


def create_demo_inventory(db: Session, users: list):
    """Create sample inventory items for demo users"""
    print("\nCreating demo inventory items...")

    # Sample items for demo user
    demo_user = next((u for u in users if u.username == "demo"), None)
    if not demo_user:
        print("⚠️  Demo user not found, skipping inventory creation")
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

    db.commit()
    print(f"✓ Created {count} inventory items for user 'demo'")


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
        print("\nDemo Accounts:")
        print("  Username: demo      Password: demo123")
        print("  Username: admin     Password: admin123  (Admin)")
        print("  Username: alice     Password: alice123")
        print("\nYou can now log in with these accounts!")
        print("\n💡 Tip: User 'demo' has 18 sample inventory items")

    except Exception as e:
        print(f"\n❌ Error creating demo data: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
