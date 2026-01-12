from fastapi import FastAPI, HTTPException
import httpx
import sqlite3
import json
import os
from datetime import datetime, timedelta
from typing import Optional

app = FastAPI(title="PantryPal Lookup Service", version="1.0.0")

CACHE_DB_PATH = os.getenv("CACHE_DB_PATH", "/app/data/lookup_cache.db")
CACHE_TTL_DAYS = int(os.getenv("CACHE_TTL_DAYS", "30"))

def init_cache_db():
    os.makedirs(os.path.dirname(CACHE_DB_PATH), exist_ok=True)
    conn = sqlite3.connect(CACHE_DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS lookup_cache (
            barcode TEXT PRIMARY KEY,
            product_data TEXT NOT NULL,
            cached_at TIMESTAMP NOT NULL,
            expires_at TIMESTAMP NOT NULL
        )
    """)
    conn.commit()
    conn.close()

init_cache_db()

def get_from_cache(barcode: str) -> Optional[dict]:
    conn = sqlite3.connect(CACHE_DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT product_data, expires_at FROM lookup_cache WHERE barcode = ? AND expires_at > ?", 
                   (barcode, datetime.utcnow().isoformat()))
    result = cursor.fetchone()
    conn.close()
    if result:
        return json.loads(result[0])
    return None

def save_to_cache(barcode: str, product_data: dict):
    conn = sqlite3.connect(CACHE_DB_PATH)
    cursor = conn.cursor()
    cached_at = datetime.utcnow()
    expires_at = cached_at + timedelta(days=CACHE_TTL_DAYS)
    cursor.execute("INSERT OR REPLACE INTO lookup_cache (barcode, product_data, cached_at, expires_at) VALUES (?, ?, ?, ?)",
                   (barcode, json.dumps(product_data), cached_at.isoformat(), expires_at.isoformat()))
    conn.commit()
    conn.close()

def extract_category(categories_str: str) -> str:
    """Extract the main category from the categories string"""
    if not categories_str:
        return "Uncategorized"
    
    # Split by comma and get the first/main category
    categories = categories_str.split(',')
    if not categories:
        return "Uncategorized"
    
    main_category = categories[0].strip()
    
    # Simplify common categories
    category_map = {
        'beverages': 'Beverages',
        'drinks': 'Beverages',
        'sodas': 'Beverages',
        'water': 'Beverages',
        'juices': 'Beverages',
        'snacks': 'Snacks',
        'chips': 'Snacks',
        'cookies': 'Snacks',
        'candy': 'Snacks',
        'chocolate': 'Snacks',
        'dairy': 'Dairy',
        'milk': 'Dairy',
        'cheese': 'Dairy',
        'yogurt': 'Dairy',
        'canned': 'Canned Goods',
        'preserved': 'Canned Goods',
        'cereals': 'Breakfast',
        'breakfast': 'Breakfast',
        'bread': 'Bakery',
        'pastries': 'Bakery',
        'frozen': 'Frozen',
        'ice cream': 'Frozen',
        'meat': 'Meat & Seafood',
        'seafood': 'Meat & Seafood',
        'fish': 'Meat & Seafood',
        'produce': 'Fresh Produce',
        'fruits': 'Fresh Produce',
        'vegetables': 'Fresh Produce',
        'condiments': 'Condiments',
        'sauces': 'Condiments',
        'cleaning': 'Cleaning',
        'detergent': 'Cleaning',
        'soap': 'Cleaning',
        'household': 'Household',
        'paper': 'Household',
        'tissue': 'Household',
        'personal care': 'Personal Care',
        'beauty': 'Personal Care',
        'hygiene': 'Personal Care',
        'health': 'Health',
        'medicine': 'Health',
        'vitamins': 'Health',
    }

    main_lower = main_category.lower()
    for keyword, mapped_category in category_map.items():
        if keyword in main_lower:
            return mapped_category

    return main_category.title() if main_category else "Uncategorized"

async def lookup_open_food_facts(barcode: str) -> Optional[dict]:
    url = f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json"
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=10.0)
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == 1 and "product" in data:
                    product = data["product"]

                    categories = product.get("categories", "")
                    category = extract_category(categories)

                    return {
                        "barcode": barcode,
                        "name": product.get("product_name", "Unknown Product"),
                        "brand": product.get("brands", "").split(",")[0].strip() if product.get("brands") else None,
                        "image_url": product.get("image_url"),
                        "category": category,
                        "source": "Open Food Facts",
                        "found": True
                    }
    except Exception as e:
        print(f"Open Food Facts lookup error: {e}")
    return None

async def lookup_upcitemdb(barcode: str) -> Optional[dict]:
    url = f"https://api.upcitemdb.com/prod/trial/lookup?upc={barcode}"
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=10.0)
            if response.status_code == 200:
                data = response.json()
                if data.get("code") == "OK" and data.get("items") and len(data["items"]) > 0:
                    item = data["items"][0]

                    category_raw = item.get("category", "")
                    category = extract_category(category_raw)

                    return {
                        "barcode": barcode,
                        "name": item.get("title", "Unknown Product"),
                        "brand": item.get("brand"),
                        "image_url": item.get("images", [None])[0] if item.get("images") else None,
                        "category": category,
                        "source": "UPCitemDB",
                        "found": True
                    }
    except Exception as e:
        print(f"UPCitemDB lookup error: {e}")
    return None

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "lookup-service", "timestamp": datetime.utcnow().isoformat()}

@app.get("/lookup/{barcode}")
async def lookup_barcode(barcode: str):
    cached_data = get_from_cache(barcode)
    if cached_data:
        cached_data["from_cache"] = True
        return cached_data

    product_data = await lookup_open_food_facts(barcode)
    if product_data:
        save_to_cache(barcode, product_data)
        product_data["from_cache"] = False
        return product_data

    product_data = await lookup_upcitemdb(barcode)
    if product_data:
        save_to_cache(barcode, product_data)
        product_data["from_cache"] = False
        return product_data

    return {
        "barcode": barcode,
        "name": f"Unknown Product ({barcode})",
        "brand": None,
        "image_url": None,
        "category": "Uncategorized",
        "source": None,
        "found": False,
        "from_cache": False
    }

@app.get("/cache/stats")
async def cache_stats():
    conn = sqlite3.connect(CACHE_DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM lookup_cache")
    total = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM lookup_cache WHERE expires_at > ?", (datetime.utcnow().isoformat(),))
    valid = cursor.fetchone()[0]
    conn.close()
    return {"total_cached": total, "valid_cached": valid, "expired": total - valid, "ttl_days": CACHE_TTL_DAYS}

@app.delete("/cache/{barcode}")
async def clear_cache_item(barcode: str):
    conn = sqlite3.connect(CACHE_DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM lookup_cache WHERE barcode = ?", (barcode,))
    deleted = cursor.rowcount
    conn.commit()
    conn.close()
    if deleted > 0:
        return {"message": f"Cache cleared for barcode {barcode}"}
    else:
        raise HTTPException(status_code=404, detail="Barcode not found in cache")

@app.delete("/cache")
async def clear_all_cache():
    conn = sqlite3.connect(CACHE_DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM lookup_cache")
    deleted = cursor.rowcount
    conn.commit()
    conn.close()
    return {"message": f"Cache cleared, {deleted} items removed"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)