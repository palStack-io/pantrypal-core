from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
import httpx
import json
import logging
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy import create_engine, Column, String, DateTime, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

app = FastAPI(title="PantryPal Lookup Service", version="1.0.0")

INTERNAL_SERVICE_TOKEN = os.getenv("INTERNAL_SERVICE_TOKEN", "")

@app.middleware("http")
async def verify_internal_token(request: Request, call_next):
    if request.url.path == "/health":
        return await call_next(request)
    if INTERNAL_SERVICE_TOKEN:
        if request.headers.get("X-Internal-Token", "") != INTERNAL_SERVICE_TOKEN:
            return JSONResponse(status_code=403, content={"detail": "Forbidden"})
    return await call_next(request)

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError(
        "DATABASE_URL environment variable is required. "
        "Example: postgresql://pantrypal:yourpassword@postgres:5432/pantrypal"
    )
CACHE_TTL_DAYS = int(os.getenv("CACHE_TTL_DAYS", "30"))

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class LookupCache(Base):
    __tablename__ = "lookup_cache"
    barcode = Column(String, primary_key=True, index=True)
    product_data = Column(String, nullable=False)
    cached_at = Column(DateTime, nullable=False)
    expires_at = Column(DateTime, nullable=False)

Base.metadata.create_all(bind=engine)

def get_from_cache(barcode: str) -> Optional[dict]:
    db = SessionLocal()
    try:
        row = db.query(LookupCache).filter(
            LookupCache.barcode == barcode,
            LookupCache.expires_at > datetime.utcnow()
        ).first()
        return json.loads(row.product_data) if row else None
    finally:
        db.close()

def save_to_cache(barcode: str, product_data: dict):
    db = SessionLocal()
    try:
        cached_at = datetime.utcnow()
        expires_at = cached_at + timedelta(days=CACHE_TTL_DAYS)
        row = db.query(LookupCache).filter(LookupCache.barcode == barcode).first()
        if row:
            row.product_data = json.dumps(product_data)
            row.cached_at = cached_at
            row.expires_at = expires_at
        else:
            db.add(LookupCache(
                barcode=barcode,
                product_data=json.dumps(product_data),
                cached_at=cached_at,
                expires_at=expires_at,
            ))
        db.commit()
    finally:
        db.close()

def extract_category(categories_str: str) -> str:
    """Extract the main category from the categories string"""
    if not categories_str:
        return "Uncategorized"

    categories = categories_str.split(',')
    if not categories:
        return "Uncategorized"

    main_category = categories[0].strip()

    category_map = {
        # Beverages
        'beverages': 'Beverages',
        'drinks': 'Beverages',
        'sodas': 'Beverages',
        'juices': 'Beverages',
        'soft drink': 'Beverages',
        'energy drink': 'Beverages',
        'sports drink': 'Beverages',
        # Coffee & Tea
        'coffee': 'Coffee & Tea',
        'tea': 'Coffee & Tea',
        'espresso': 'Coffee & Tea',
        'herbal': 'Coffee & Tea',
        # Wine & Spirits
        'wine': 'Wine & Spirits',
        'beer': 'Wine & Spirits',
        'spirits': 'Wine & Spirits',
        'alcohol': 'Wine & Spirits',
        'liquor': 'Wine & Spirits',
        # Snacks
        'snacks': 'Snacks',
        'chips': 'Snacks',
        'cookies': 'Snacks',
        'candy': 'Snacks',
        'chocolate': 'Snacks',
        'crackers': 'Snacks',
        'popcorn': 'Snacks',
        'nuts': 'Snacks',
        # Dairy
        'dairy': 'Dairy',
        'milk': 'Dairy',
        'cheese': 'Dairy',
        'yogurt': 'Dairy',
        'butter': 'Dairy',
        'cream': 'Dairy',
        'eggs': 'Dairy',
        # Meat & Seafood
        'meat': 'Meat & Seafood',
        'seafood': 'Meat & Seafood',
        'fish': 'Meat & Seafood',
        'poultry': 'Meat & Seafood',
        'pork': 'Meat & Seafood',
        'beef': 'Meat & Seafood',
        'sausage': 'Meat & Seafood',
        'deli': 'Meat & Seafood',
        # Frozen
        'frozen': 'Frozen',
        'ice cream': 'Frozen',
        # Produce
        'produce': 'Produce',
        'fruits': 'Produce',
        'vegetables': 'Produce',
        'fresh': 'Produce',
        # Bakery
        'bread': 'Bakery',
        'pastries': 'Bakery',
        'bakery': 'Bakery',
        'baked': 'Bakery',
        # Breakfast
        'cereals': 'Breakfast',
        'breakfast': 'Breakfast',
        'oatmeal': 'Breakfast',
        'granola': 'Breakfast',
        # Pasta & Grains
        'pasta': 'Pasta & Grains',
        'noodles': 'Pasta & Grains',
        'rice': 'Pasta & Grains',
        'grains': 'Pasta & Grains',
        'cereals and grains': 'Pasta & Grains',
        # Canned Goods
        'canned': 'Canned Goods',
        'preserved': 'Canned Goods',
        'tinned': 'Canned Goods',
        'soups': 'Canned Goods',
        'broth': 'Canned Goods',
        # Condiments
        'condiments': 'Condiments',
        'sauces': 'Condiments',
        'dressings': 'Condiments',
        'spreads': 'Condiments',
        'jams': 'Condiments',
        'honey': 'Condiments',
        # Baking
        'baking': 'Baking',
        'flour': 'Baking',
        'sugar': 'Baking',
        # Oils & Vinegars
        'oils': 'Oils & Vinegars',
        'vinegar': 'Oils & Vinegars',
        'oil': 'Oils & Vinegars',
        # Spices
        'spices': 'Spices',
        'herbs': 'Spices',
        'seasonings': 'Spices',
        'salt': 'Spices',
        'pepper': 'Spices',
        # Household
        'household': 'Household',
        'paper': 'Household',
        'tissue': 'Household',
        'foil': 'Household',
        # Cleaning
        'cleaning': 'Cleaning',
        'detergent': 'Cleaning',
        'soap': 'Cleaning',
        'bleach': 'Cleaning',
        'disinfectant': 'Cleaning',
        # Personal Care
        'personal care': 'Personal Care',
        'beauty': 'Personal Care',
        'hygiene': 'Personal Care',
        'hair care': 'Personal Care',
        'skin care': 'Personal Care',
        # Health
        'health': 'Health',
        'medicine': 'Health',
        'vitamins': 'Health',
        'supplements': 'Health',
        # Baby
        'baby': 'Baby',
        'infant': 'Baby',
        # Pet Food
        'pet': 'Pet Food',
        'dog': 'Pet Food',
        'cat': 'Pet Food',
        'pet food': 'Pet Food',
        # International
        'asian': 'International',
        'japanese': 'International',
        'chinese': 'International',
        'indian': 'International',
        'mexican': 'International',
        'thai': 'International',
        'korean': 'International',
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
                    category = extract_category(product.get("categories", ""))
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
        logger.warning("Open Food Facts lookup error for barcode %s: %s", barcode, e)
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
                    category = extract_category(item.get("category", ""))
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
        logger.warning("UPCitemDB lookup error for barcode %s: %s", barcode, e)
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
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        total = db.query(LookupCache).count()
        valid = db.query(LookupCache).filter(LookupCache.expires_at > now).count()
        return {"total_cached": total, "valid_cached": valid, "expired": total - valid, "ttl_days": CACHE_TTL_DAYS}
    finally:
        db.close()

@app.delete("/cache/{barcode}")
async def clear_cache_item(barcode: str):
    db = SessionLocal()
    try:
        row = db.query(LookupCache).filter(LookupCache.barcode == barcode).first()
        if not row:
            raise HTTPException(status_code=404, detail="Barcode not found in cache")
        db.delete(row)
        db.commit()
        return {"message": f"Cache cleared for barcode {barcode}"}
    finally:
        db.close()

@app.delete("/cache")
async def clear_all_cache():
    db = SessionLocal()
    try:
        deleted = db.query(LookupCache).delete()
        db.commit()
        return {"message": f"Cache cleared, {deleted} items removed"}
    finally:
        db.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
