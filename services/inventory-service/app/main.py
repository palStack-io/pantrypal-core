from fastapi import FastAPI, HTTPException, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Boolean, Date
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from datetime import datetime, date, timedelta
from typing import Optional, List
from pydantic import BaseModel
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
import os
import csv
import io
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="PantryPal Inventory Service", version="1.0.0")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///data/inventory.db")
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

BACKUP_ENABLED = os.getenv("BACKUP_ENABLED", "false").lower() == "true"
BACKUP_SCHEDULE = os.getenv("BACKUP_SCHEDULE", "0 2 * * *")
BACKUP_RETENTION_DAYS = int(os.getenv("BACKUP_RETENTION_DAYS", "7"))
BACKUP_PATH = os.getenv("BACKUP_PATH", "/app/backups")

class ItemDB(Base):
    __tablename__ = "items"
    id = Column(Integer, primary_key=True, index=True)
    barcode = Column(String, index=True, nullable=True)
    name = Column(String, nullable=False)
    brand = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    category = Column(String, default="Uncategorized")
    location = Column(String, default="Basement Pantry")
    quantity = Column(Integer, default=1)
    expiry_date = Column(Date, nullable=True)
    notes = Column(String, nullable=True)
    manually_added = Column(Boolean, default=False)
    added_date = Column(DateTime, default=datetime.utcnow)
    updated_date = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ShoppingListDB(Base):
    __tablename__ = "shopping_list"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    brand = Column(String, nullable=True)
    category = Column(String, default="Uncategorized")
    quantity = Column(Integer, default=1)
    notes = Column(String, nullable=True)
    checked = Column(Boolean, default=False)
    inventory_item_id = Column(Integer, nullable=True)  # Reference to original inventory item
    added_date = Column(DateTime, default=datetime.utcnow)
    updated_date = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    checked_date = Column(DateTime, nullable=True)

Base.metadata.create_all(bind=engine)

class ItemCreate(BaseModel):
    barcode: Optional[str] = None
    name: str
    brand: Optional[str] = None
    image_url: Optional[str] = None
    category: str = "Uncategorized"
    location: str = "Basement Pantry"
    quantity: int = 1
    expiry_date: Optional[date] = None
    notes: Optional[str] = None
    manually_added: bool = False

class ItemUpdate(BaseModel):
    name: Optional[str] = None
    brand: Optional[str] = None
    category: Optional[str] = None
    location: Optional[str] = None
    quantity: Optional[int] = None
    expiry_date: Optional[date] = None
    notes: Optional[str] = None

class ItemResponse(BaseModel):
    id: int
    barcode: Optional[str]
    name: str
    brand: Optional[str]
    image_url: Optional[str]
    category: str
    location: str
    quantity: int
    expiry_date: Optional[date]
    notes: Optional[str]
    manually_added: bool
    added_date: datetime
    updated_date: datetime

    class Config:
        from_attributes = True

class ShoppingListCreate(BaseModel):
    name: str
    brand: Optional[str] = None
    category: str = "Uncategorized"
    quantity: int = 1
    notes: Optional[str] = None
    inventory_item_id: Optional[int] = None

class ShoppingListUpdate(BaseModel):
    name: Optional[str] = None
    brand: Optional[str] = None
    category: Optional[str] = None
    quantity: Optional[int] = None
    notes: Optional[str] = None
    checked: Optional[bool] = None

class ShoppingListResponse(BaseModel):
    id: int
    name: str
    brand: Optional[str]
    category: str
    quantity: int
    notes: Optional[str]
    checked: bool
    inventory_item_id: Optional[int]
    added_date: datetime
    updated_date: datetime
    checked_date: Optional[datetime]

    class Config:
        from_attributes = True

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "inventory-service", "timestamp": datetime.utcnow().isoformat()}

@app.post("/items", response_model=ItemResponse)
async def create_item(item: ItemCreate, db: Session = Depends(get_db)):
    db_item = ItemDB(**item.dict())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@app.get("/items", response_model=List[ItemResponse])
async def get_items(location: Optional[str] = None, search: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(ItemDB)
    if location:
        query = query.filter(ItemDB.location == location)
    if search:
        search_term = f"%{search}%"
        query = query.filter((ItemDB.name.ilike(search_term)) | (ItemDB.brand.ilike(search_term)) | (ItemDB.barcode.ilike(search_term)))
    items = query.order_by(ItemDB.updated_date.desc()).all()
    return items

@app.get("/items/expiring")
async def get_expiring_items(days: int = 7, db: Session = Depends(get_db)):
    """Get items expiring within specified days"""
    from datetime import timedelta
    cutoff_date = date.today() + timedelta(days=days)
    items = db.query(ItemDB).filter(
        ItemDB.expiry_date.isnot(None),
        ItemDB.expiry_date <= cutoff_date
    ).order_by(ItemDB.expiry_date).all()
    return items

@app.get("/items/{item_id}", response_model=ItemResponse)
async def get_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(ItemDB).filter(ItemDB.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item

@app.put("/items/{item_id}", response_model=ItemResponse)
async def update_item(item_id: int, item_update: ItemUpdate, db: Session = Depends(get_db)):
    db_item = db.query(ItemDB).filter(ItemDB.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    update_data = item_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_item, field, value)
    db_item.updated_date = datetime.utcnow()
    db.commit()
    db.refresh(db_item)
    return db_item

@app.delete("/items/{item_id}")
async def delete_item(item_id: int, db: Session = Depends(get_db)):
    db_item = db.query(ItemDB).filter(ItemDB.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(db_item)
    db.commit()
    return {"message": "Item deleted successfully", "id": item_id}

@app.get("/locations")
async def get_locations(db: Session = Depends(get_db)):
    locations = db.query(ItemDB.location).distinct().all()
    return {"locations": [loc[0] for loc in locations], "count": len(locations)}

@app.get("/categories")
async def get_categories(db: Session = Depends(get_db)):
    categories = db.query(ItemDB.category).distinct().all()
    return {"categories": [cat[0] for cat in categories], "count": len(categories)}

@app.get("/stats")
async def get_stats(db: Session = Depends(get_db)):
    total_items = db.query(ItemDB).count()
    locations = db.query(ItemDB.location).distinct().count()
    categories = db.query(ItemDB.category).distinct().count()
    total_quantity = db.query(ItemDB).with_entities(ItemDB.quantity).all()
    
    # Count expiring items (within 7 days)
    from datetime import timedelta
    cutoff_date = date.today() + timedelta(days=7)
    expiring_soon = db.query(ItemDB).filter(
        ItemDB.expiry_date.isnot(None),
        ItemDB.expiry_date <= cutoff_date
    ).count()
    
    return {
        "total_items": total_items,
        "total_quantity": sum(q[0] for q in total_quantity),
        "locations_count": locations,
        "categories_count": categories,
        "expiring_soon": expiring_soon,
        "manually_added_count": db.query(ItemDB).filter(ItemDB.manually_added == True).count()
    }

def escape_csv_field(value):
    if value is None:
        return ''
    value_str = str(value)
    if ',' in value_str or '"' in value_str or '\n' in value_str:
        value_str = value_str.replace('"', '""')
        return f'"{value_str}"'
    return value_str

def generate_csv_content(db: Session):
    items = db.query(ItemDB).order_by(ItemDB.updated_date.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)

    headers = ['Name', 'Barcode', 'Quantity', 'Location', 'Category', 'Expiry Date', 'Added Date', 'Notes']
    writer.writerow(headers)

    for item in items:
        row = [
            item.name or '',
            item.barcode or '',
            item.quantity or 1,
            item.location or '',
            item.category or '',
            item.expiry_date.isoformat() if item.expiry_date else '',
            item.added_date.isoformat() if item.added_date else '',
            item.notes or '',
        ]
        writer.writerow(row)

    return output.getvalue()

@app.get("/export/csv")
async def export_csv(db: Session = Depends(get_db)):
    csv_content = generate_csv_content(db)

    filename = f"pantrypal_export_{datetime.now().strftime('%Y-%m-%d_%H%M%S')}.csv"

    return StreamingResponse(
        io.StringIO(csv_content),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# ============================================================================
# SHOPPING LIST ENDPOINTS
# ============================================================================

@app.post("/shopping-list", response_model=ShoppingListResponse)
async def create_shopping_list_item(item: ShoppingListCreate, db: Session = Depends(get_db)):
    """Add an item to the shopping list"""
    db_item = ShoppingListDB(**item.dict())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@app.get("/shopping-list", response_model=List[ShoppingListResponse])
async def get_shopping_list(include_checked: bool = False, db: Session = Depends(get_db)):
    """Get all shopping list items"""
    query = db.query(ShoppingListDB)
    if not include_checked:
        query = query.filter(ShoppingListDB.checked == False)
    items = query.order_by(ShoppingListDB.added_date.desc()).all()
    return items

@app.get("/shopping-list/{item_id}", response_model=ShoppingListResponse)
async def get_shopping_list_item(item_id: int, db: Session = Depends(get_db)):
    """Get a specific shopping list item"""
    item = db.query(ShoppingListDB).filter(ShoppingListDB.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Shopping list item not found")
    return item

@app.put("/shopping-list/{item_id}", response_model=ShoppingListResponse)
async def update_shopping_list_item(item_id: int, item_update: ShoppingListUpdate, db: Session = Depends(get_db)):
    """Update a shopping list item"""
    db_item = db.query(ShoppingListDB).filter(ShoppingListDB.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Shopping list item not found")

    update_data = item_update.dict(exclude_unset=True)

    # If marking as checked, set checked_date
    if update_data.get('checked') == True and not db_item.checked:
        db_item.checked_date = datetime.utcnow()
    elif update_data.get('checked') == False:
        db_item.checked_date = None

    for field, value in update_data.items():
        setattr(db_item, field, value)

    db_item.updated_date = datetime.utcnow()
    db.commit()
    db.refresh(db_item)
    return db_item

@app.delete("/shopping-list/{item_id}")
async def delete_shopping_list_item(item_id: int, db: Session = Depends(get_db)):
    """Delete a shopping list item"""
    db_item = db.query(ShoppingListDB).filter(ShoppingListDB.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Shopping list item not found")
    db.delete(db_item)
    db.commit()
    return {"message": "Shopping list item deleted successfully", "id": item_id}

@app.post("/shopping-list/from-inventory/{inventory_id}", response_model=ShoppingListResponse)
async def add_from_inventory(inventory_id: int, db: Session = Depends(get_db)):
    """Add an item to shopping list from inventory"""
    inventory_item = db.query(ItemDB).filter(ItemDB.id == inventory_id).first()
    if not inventory_item:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    # Check if already in shopping list
    existing = db.query(ShoppingListDB).filter(
        ShoppingListDB.inventory_item_id == inventory_id,
        ShoppingListDB.checked == False
    ).first()

    if existing:
        # Update quantity instead of creating duplicate
        existing.quantity += 1
        existing.updated_date = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing

    # Create new shopping list item
    shopping_item = ShoppingListDB(
        name=inventory_item.name,
        brand=inventory_item.brand,
        category=inventory_item.category,
        quantity=1,
        notes=f"From inventory: {inventory_item.location}",
        inventory_item_id=inventory_id
    )
    db.add(shopping_item)
    db.commit()
    db.refresh(shopping_item)
    return shopping_item

@app.post("/shopping-list/add-checked-to-inventory")
async def add_checked_to_inventory(db: Session = Depends(get_db)):
    """Move all checked shopping list items to inventory"""
    checked_items = db.query(ShoppingListDB).filter(ShoppingListDB.checked == True).all()

    if not checked_items:
        return {"message": "No checked items to add", "added_count": 0}

    added_count = 0
    for shopping_item in checked_items:
        # Create inventory item
        inventory_item = ItemDB(
            name=shopping_item.name,
            brand=shopping_item.brand,
            category=shopping_item.category,
            quantity=shopping_item.quantity,
            notes=shopping_item.notes,
            manually_added=True,
            location="Basement Pantry"  # Default location
        )
        db.add(inventory_item)
        added_count += 1

    # Delete checked items from shopping list
    db.query(ShoppingListDB).filter(ShoppingListDB.checked == True).delete()

    db.commit()
    return {"message": f"Added {added_count} items to inventory", "added_count": added_count}

@app.post("/shopping-list/suggest-low-stock")
async def suggest_low_stock(db: Session = Depends(get_db)):
    """Add low stock and expiring items to shopping list"""
    # Get items with quantity 0 or 1
    low_stock_items = db.query(ItemDB).filter(ItemDB.quantity <= 1).all()

    # Get expiring items (within 7 days)
    cutoff_date = date.today() + timedelta(days=7)
    expiring_items = db.query(ItemDB).filter(
        ItemDB.expiry_date.isnot(None),
        ItemDB.expiry_date <= cutoff_date
    ).all()

    # Combine and deduplicate
    items_to_add = {item.id: item for item in low_stock_items}
    items_to_add.update({item.id: item for item in expiring_items})

    added_count = 0
    for inventory_item in items_to_add.values():
        # Check if already in shopping list
        existing = db.query(ShoppingListDB).filter(
            ShoppingListDB.inventory_item_id == inventory_item.id,
            ShoppingListDB.checked == False
        ).first()

        if existing:
            continue

        # Add to shopping list
        shopping_item = ShoppingListDB(
            name=inventory_item.name,
            brand=inventory_item.brand,
            category=inventory_item.category,
            quantity=1,
            notes=f"Low stock/expiring: {inventory_item.location}",
            inventory_item_id=inventory_item.id
        )
        db.add(shopping_item)
        added_count += 1

    db.commit()
    return {"message": f"Added {added_count} items to shopping list", "added_count": added_count}

@app.delete("/shopping-list/clear-checked")
async def clear_checked_items(db: Session = Depends(get_db)):
    """Delete all checked items from shopping list"""
    deleted = db.query(ShoppingListDB).filter(ShoppingListDB.checked == True).delete()
    db.commit()
    return {"message": f"Cleared {deleted} checked items", "deleted_count": deleted}

def save_backup(db: Session):
    try:
        os.makedirs(BACKUP_PATH, exist_ok=True)

        csv_content = generate_csv_content(db)

        timestamp = datetime.now().strftime('%Y-%m-%d_%H%M%S')
        filename = f"pantrypal_backup_{timestamp}.csv"
        filepath = os.path.join(BACKUP_PATH, filename)

        with open(filepath, 'w', newline='', encoding='utf-8') as f:
            f.write(csv_content)

        logger.info(f"Backup saved successfully: {filename}")
        cleanup_old_backups()

    except Exception as e:
        logger.error(f"Backup failed: {str(e)}")

def cleanup_old_backups():
    try:
        if not os.path.exists(BACKUP_PATH):
            return

        cutoff_date = datetime.now() - timedelta(days=BACKUP_RETENTION_DAYS)

        for filename in os.listdir(BACKUP_PATH):
            if not filename.startswith("pantrypal_backup_") or not filename.endswith(".csv"):
                continue

            filepath = os.path.join(BACKUP_PATH, filename)
            file_mtime = datetime.fromtimestamp(os.path.getmtime(filepath))

            if file_mtime < cutoff_date:
                os.remove(filepath)
                logger.info(f"Deleted old backup: {filename}")

    except Exception as e:
        logger.error(f"Backup cleanup failed: {str(e)}")

def scheduled_backup():
    db = SessionLocal()
    try:
        save_backup(db)
    finally:
        db.close()

@app.on_event("startup")
async def startup_event():
    if BACKUP_ENABLED:
        logger.info(f"Backup enabled with schedule: {BACKUP_SCHEDULE}")
        logger.info(f"Backup retention: {BACKUP_RETENTION_DAYS} days")
        logger.info(f"Backup path: {BACKUP_PATH}")

        scheduler = BackgroundScheduler()
        scheduler.add_job(
            scheduled_backup,
            trigger=CronTrigger.from_crontab(BACKUP_SCHEDULE),
            id='backup_job',
            name='Automated CSV Backup',
            replace_existing=True
        )
        scheduler.start()
        logger.info("Backup scheduler started")
    else:
        logger.info("Backup disabled")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)