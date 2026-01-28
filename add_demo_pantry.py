#!/usr/bin/env python3
"""
Add demo pantry items to inventory service
These items are commonly found in recipes and will help demonstrate recipe matching
"""
import requests
from datetime import date, timedelta

BASE_URL = "http://localhost:8888"
INVENTORY_URL = f"{BASE_URL}/api/items/manual"

# Login and get session
session = requests.Session()
login_response = session.post(f"{BASE_URL}/api/auth/login", json={
    "username": "demo",
    "password": "demo123"
})
if login_response.status_code != 200:
    print(f"Login failed: {login_response.status_code}")
    print(login_response.text)
    exit(1)
print("Logged in as demo user")

# Demo pantry items - common ingredients found in many recipes
demo_items = [
    # Proteins
    {"name": "Chicken Breast", "category": "Meat", "location": "Fridge", "quantity": 2, "expiry_days": 3},
    {"name": "Eggs", "category": "Dairy", "location": "Fridge", "quantity": 12, "expiry_days": 14},
    {"name": "Bacon", "category": "Meat", "location": "Fridge", "quantity": 1, "expiry_days": 5},
    {"name": "Ground Beef", "category": "Meat", "location": "Freezer", "quantity": 1, "expiry_days": 30},

    # Dairy
    {"name": "Milk", "category": "Dairy", "location": "Fridge", "quantity": 1, "expiry_days": 7},
    {"name": "Butter", "category": "Dairy", "location": "Fridge", "quantity": 1, "expiry_days": 30},
    {"name": "Parmesan Cheese", "category": "Dairy", "location": "Fridge", "quantity": 1, "expiry_days": 5},
    {"name": "Cheddar Cheese", "category": "Dairy", "location": "Fridge", "quantity": 1, "expiry_days": 14},
    {"name": "Heavy Cream", "category": "Dairy", "location": "Fridge", "quantity": 1, "expiry_days": 7},

    # Vegetables
    {"name": "Onion", "category": "Vegetables", "location": "Pantry", "quantity": 5, "expiry_days": 30},
    {"name": "Garlic", "category": "Vegetables", "location": "Pantry", "quantity": 3, "expiry_days": 30},
    {"name": "Tomatoes", "category": "Vegetables", "location": "Fridge", "quantity": 4, "expiry_days": 5},
    {"name": "Carrots", "category": "Vegetables", "location": "Fridge", "quantity": 6, "expiry_days": 4},
    {"name": "Lettuce", "category": "Vegetables", "location": "Fridge", "quantity": 1, "expiry_days": 3},
    {"name": "Bell Pepper", "category": "Vegetables", "location": "Fridge", "quantity": 3, "expiry_days": 7},
    {"name": "Broccoli", "category": "Vegetables", "location": "Fridge", "quantity": 2, "expiry_days": 5},
    {"name": "Celery", "category": "Vegetables", "location": "Fridge", "quantity": 1, "expiry_days": 7},
    {"name": "Potatoes", "category": "Vegetables", "location": "Pantry", "quantity": 8, "expiry_days": 21},

    # Pantry Staples
    {"name": "Pasta", "category": "Grains", "location": "Pantry", "quantity": 3, "expiry_days": 365},
    {"name": "Rice", "category": "Grains", "location": "Pantry", "quantity": 2, "expiry_days": 365},
    {"name": "Olive Oil", "category": "Oils", "location": "Pantry", "quantity": 1, "expiry_days": 180},
    {"name": "Soy Sauce", "category": "Condiments", "location": "Pantry", "quantity": 1, "expiry_days": 365},
    {"name": "Flour", "category": "Baking", "location": "Pantry", "quantity": 1, "expiry_days": 180},
    {"name": "Sugar", "category": "Baking", "location": "Pantry", "quantity": 1, "expiry_days": 365},
    {"name": "Salt", "category": "Spices", "location": "Pantry", "quantity": 1, "expiry_days": 365},
    {"name": "Black Pepper", "category": "Spices", "location": "Pantry", "quantity": 1, "expiry_days": 365},
    {"name": "Chicken Broth", "category": "Canned Goods", "location": "Pantry", "quantity": 4, "expiry_days": 365},
    {"name": "Canned Tomatoes", "category": "Canned Goods", "location": "Pantry", "quantity": 3, "expiry_days": 365},
    {"name": "Bread", "category": "Bakery", "location": "Pantry", "quantity": 1, "expiry_days": 5},
]

def add_demo_items():
    print("Adding demo pantry items...")

    added = 0
    failed = 0

    for item in demo_items:
        # Calculate expiry date
        expiry_date = (date.today() + timedelta(days=item.pop("expiry_days"))).isoformat()
        item["expiry_date"] = expiry_date
        item["manually_added"] = True

        try:
            response = session.post(INVENTORY_URL, json=item)
            if response.status_code in [200, 201]:
                print(f"  + Added: {item['name']}")
                added += 1
            else:
                print(f"  ! Failed: {item['name']} - {response.status_code} {response.text[:100]}")
                failed += 1
        except Exception as e:
            print(f"  ! Error: {item['name']} - {e}")
            failed += 1

    print(f"\nDone! Added: {added}, Failed: {failed}")

if __name__ == "__main__":
    add_demo_items()
