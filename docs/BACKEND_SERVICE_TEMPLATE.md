# Backend Service Template Documentation

This document provides a comprehensive template for creating new backend services in the PantryPal/PalStack ecosystem. Follow these patterns to ensure consistency across all services.

## Table of Contents
1. [Service Structure](#service-structure)
2. [Technology Stack](#technology-stack)
3. [Authentication Patterns](#authentication-patterns)
4. [Database Configuration](#database-configuration)
5. [API Endpoint Patterns](#api-endpoint-patterns)
6. [Docker Configuration](#docker-configuration)
7. [Environment Variables](#environment-variables)
8. [Error Handling](#error-handling)
9. [Complete Example Service](#complete-example-service)

---

## Service Structure

Every backend service follows this directory structure:

```
service-name/
├── app/
│   ├── main.py              # FastAPI application with routes
│   ├── models.py            # Pydantic schemas for validation
│   ├── database.py          # Database initialization & queries
│   ├── dependencies.py      # Auth validation, shared dependencies
│   └── utils.py             # Helper functions (optional)
├── tests/                   # Unit tests (optional)
│   └── test_main.py
├── Dockerfile               # Container configuration
├── requirements.txt         # Python dependencies
├── .dockerignore           # Files to exclude from build
└── README.md               # Service-specific documentation
```

---

## Technology Stack

### Core Dependencies (requirements.txt)
```txt
# Web Framework
fastapi==0.104.1
uvicorn==0.24.0
pydantic==2.4.2
python-multipart==0.0.6

# Database (if needed)
sqlalchemy==2.0.23

# HTTP Client (if calling other services)
httpx==0.25.1

# Async (if needed)
aiofiles==23.2.1

# CORS
python-dotenv==1.0.0
```

### Python Version
Always use Python 3.11+ for consistency

---

## Authentication Patterns

### Option 1: Session Token Validation (Most Common)

**File: `app/dependencies.py`**
```python
from fastapi import HTTPException, status, Header, Cookie
from typing import Optional
import httpx

API_GATEWAY_URL = "http://api-gateway:8000"

async def verify_session(
    authorization: Optional[str] = Header(None),
    session_token: Optional[str] = Cookie(None)
) -> dict:
    """
    Verify session token with API Gateway.
    Returns user info if valid, raises 401 if invalid.
    """
    token = None

    # Extract token from Authorization header
    if authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")
    # Fall back to cookie
    elif session_token:
        token = session_token

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )

    # Validate with API Gateway
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{API_GATEWAY_URL}/api/auth/me",
                headers={"Authorization": f"Bearer {token}"},
                timeout=5.0
            )

            if response.status_code == 200:
                return response.json()  # Returns {id, username, email, is_admin}
            else:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid session"
                )
        except httpx.RequestError:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Authentication service unavailable"
            )
```

### Option 2: API Key Validation

**File: `app/dependencies.py`**
```python
async def verify_api_key(
    x_api_key: Optional[str] = Header(None)
) -> dict:
    """Verify API key with API Gateway."""
    if not x_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key required"
        )

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{API_GATEWAY_URL}/api/auth/me",
            headers={"X-API-Key": x_api_key},
            timeout=5.0
        )

        if response.status_code == 200:
            return response.json()
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid API key"
            )
```

### Option 3: Combined Auth (Session OR API Key)

**File: `app/dependencies.py`**
```python
async def verify_auth(
    authorization: Optional[str] = Header(None),
    session_token: Optional[str] = Cookie(None),
    x_api_key: Optional[str] = Header(None)
) -> dict:
    """Verify either session token or API key."""

    # Try API key first
    if x_api_key:
        return await verify_api_key(x_api_key)

    # Fall back to session token
    return await verify_session(authorization, session_token)
```

### Usage in Routes

```python
from fastapi import Depends
from app.dependencies import verify_auth

@app.get("/api/protected-resource")
async def get_resource(current_user: dict = Depends(verify_auth)):
    user_id = current_user["id"]
    username = current_user["username"]
    is_admin = current_user.get("is_admin", False)

    # Your logic here
    return {"message": f"Hello {username}"}
```

---

## Database Configuration

### SQLite Pattern (Recommended for Self-Hosted)

**File: `app/database.py`**
```python
import sqlite3
import os
from pathlib import Path

# Database path in mounted volume
DB_DIR = Path("/app/data/service-name")
DB_PATH = DB_DIR / "database.db"

def init_db():
    """Initialize database with schema."""
    DB_DIR.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Create your tables
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Add indexes for performance
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_items_user_id
        ON items(user_id)
    """)

    conn.commit()
    conn.close()

def get_db():
    """Get database connection with row factory."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# Example query function
def get_user_items(user_id: int):
    """Get all items for a user."""
    conn = get_db()
    cursor = conn.cursor()

    # ALWAYS use parameterized queries to prevent SQL injection
    cursor.execute(
        "SELECT * FROM items WHERE user_id = ? ORDER BY created_at DESC",
        (user_id,)
    )

    items = [dict(row) for row in cursor.fetchall()]
    conn.close()

    return items

def create_item(user_id: int, name: str, description: str = None):
    """Create a new item."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        "INSERT INTO items (user_id, name, description) VALUES (?, ?, ?)",
        (user_id, name, description)
    )

    item_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return item_id

def update_item(item_id: int, user_id: int, name: str = None, description: str = None):
    """Update an existing item (with ownership check)."""
    conn = get_db()
    cursor = conn.cursor()

    # Verify ownership
    cursor.execute(
        "SELECT id FROM items WHERE id = ? AND user_id = ?",
        (item_id, user_id)
    )

    if not cursor.fetchone():
        conn.close()
        return False

    # Build dynamic update query
    updates = []
    params = []

    if name is not None:
        updates.append("name = ?")
        params.append(name)

    if description is not None:
        updates.append("description = ?")
        params.append(description)

    if updates:
        updates.append("updated_at = CURRENT_TIMESTAMP")
        params.extend([item_id, user_id])

        cursor.execute(
            f"UPDATE items SET {', '.join(updates)} WHERE id = ? AND user_id = ?",
            params
        )

    conn.commit()
    conn.close()

    return True

def delete_item(item_id: int, user_id: int):
    """Delete an item (with ownership check)."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        "DELETE FROM items WHERE id = ? AND user_id = ?",
        (item_id, user_id)
    )

    rows_deleted = cursor.rowcount
    conn.commit()
    conn.close()

    return rows_deleted > 0
```

---

## API Endpoint Patterns

### File: `app/models.py` (Pydantic Schemas)

```python
from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime

class ItemCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)

    @validator('name')
    def name_must_not_be_empty(cls, v):
        if not v.strip():
            raise ValueError('Name cannot be empty')
        return v.strip()

class ItemUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)

class ItemResponse(BaseModel):
    id: int
    user_id: int
    name: str
    description: Optional[str]
    created_at: datetime
    updated_at: datetime

class ErrorResponse(BaseModel):
    detail: str
```

### File: `app/main.py` (FastAPI Application)

```python
from fastapi import FastAPI, HTTPException, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import os

from app.models import ItemCreate, ItemUpdate, ItemResponse, ErrorResponse
from app.dependencies import verify_auth
from app.database import init_db, get_user_items, create_item, update_item, delete_item

# Initialize FastAPI app
app = FastAPI(
    title="Service Name API",
    description="Description of what this service does",
    version="1.0.0"
)

# CORS Configuration
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    init_db()
    print("Database initialized")

# Health check endpoint (no auth required)
@app.get("/", tags=["Health"])
async def root():
    return {
        "service": "service-name",
        "status": "healthy",
        "version": "1.0.0"
    }

@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "healthy"}

# Protected endpoints
@app.get(
    "/api/items",
    response_model=List[ItemResponse],
    tags=["Items"]
)
async def list_items(current_user: dict = Depends(verify_auth)):
    """Get all items for the authenticated user."""
    user_id = current_user["id"]
    items = get_user_items(user_id)
    return items

@app.post(
    "/api/items",
    response_model=ItemResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Items"]
)
async def create_new_item(
    item: ItemCreate,
    current_user: dict = Depends(verify_auth)
):
    """Create a new item."""
    user_id = current_user["id"]

    item_id = create_item(
        user_id=user_id,
        name=item.name,
        description=item.description
    )

    # Fetch and return the created item
    items = get_user_items(user_id)
    created_item = next((i for i in items if i["id"] == item_id), None)

    return created_item

@app.put(
    "/api/items/{item_id}",
    response_model=ItemResponse,
    tags=["Items"]
)
async def update_existing_item(
    item_id: int,
    item: ItemUpdate,
    current_user: dict = Depends(verify_auth)
):
    """Update an existing item."""
    user_id = current_user["id"]

    success = update_item(
        item_id=item_id,
        user_id=user_id,
        name=item.name,
        description=item.description
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found or you don't have permission to update it"
        )

    # Fetch and return the updated item
    items = get_user_items(user_id)
    updated_item = next((i for i in items if i["id"] == item_id), None)

    return updated_item

@app.delete(
    "/api/items/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Items"]
)
async def delete_existing_item(
    item_id: int,
    current_user: dict = Depends(verify_auth)
):
    """Delete an item."""
    user_id = current_user["id"]

    success = delete_item(item_id=item_id, user_id=user_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found or you don't have permission to delete it"
        )

    return None

# Admin-only endpoint example
@app.get(
    "/api/admin/stats",
    tags=["Admin"]
)
async def get_admin_stats(current_user: dict = Depends(verify_auth)):
    """Get system statistics (admin only)."""
    if not current_user.get("is_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    # Your admin logic here
    return {"total_users": 100, "total_items": 500}
```

---

## Docker Configuration

### Dockerfile

```dockerfile
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/

# Create data directory for database
RUN mkdir -p /app/data

# Expose port
EXPOSE 8000

# Run application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### .dockerignore

```
__pycache__
*.pyc
*.pyo
*.pyd
.Python
env/
venv/
*.egg-info/
.pytest_cache/
.coverage
htmlcov/
.git
.gitignore
README.md
tests/
*.db
*.log
```

### docker-compose.yml Entry

```yaml
services:
  service-name:
    build:
      context: ./backend/services/service-name
      dockerfile: Dockerfile
    container_name: service-name
    ports:
      - "8003:8000"  # Use next available port
    volumes:
      - ./data/service-name:/app/data/service-name
    environment:
      - CORS_ORIGINS=${CORS_ORIGINS:-*}
      - API_GATEWAY_URL=http://api-gateway:8000
    networks:
      - pantrypal-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    depends_on:
      - api-gateway
```

---

## Environment Variables

### .env.example

```bash
# CORS Configuration
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# API Gateway URL (internal)
API_GATEWAY_URL=http://api-gateway:8000

# Service-specific configuration
SERVICE_TIMEOUT=30
MAX_ITEMS_PER_USER=1000

# Feature flags
ENABLE_CACHING=true
```

### Loading in Application

```python
import os
from dotenv import load_dotenv

load_dotenv()

CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")
API_GATEWAY_URL = os.getenv("API_GATEWAY_URL", "http://api-gateway:8000")
SERVICE_TIMEOUT = int(os.getenv("SERVICE_TIMEOUT", "30"))
```

---

## Error Handling

### Standard Error Responses

```python
from fastapi import HTTPException, status

# 400 Bad Request - Invalid input
raise HTTPException(
    status_code=status.HTTP_400_BAD_REQUEST,
    detail="Invalid input data"
)

# 401 Unauthorized - Authentication required
raise HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Authentication required"
)

# 403 Forbidden - Insufficient permissions
raise HTTPException(
    status_code=status.HTTP_403_FORBIDDEN,
    detail="You don't have permission to access this resource"
)

# 404 Not Found - Resource doesn't exist
raise HTTPException(
    status_code=status.HTTP_404_NOT_FOUND,
    detail="Resource not found"
)

# 409 Conflict - Resource already exists
raise HTTPException(
    status_code=status.HTTP_409_CONFLICT,
    detail="Resource already exists"
)

# 422 Unprocessable Entity - Validation error (automatic with Pydantic)

# 500 Internal Server Error - Unexpected error
raise HTTPException(
    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
    detail="An unexpected error occurred"
)

# 503 Service Unavailable - Dependency unavailable
raise HTTPException(
    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
    detail="Service temporarily unavailable"
)
```

### Global Exception Handler

```python
from fastapi import Request
from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch all unhandled exceptions."""
    print(f"Unhandled error: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )
```

---

## Complete Example Service

See the inventory-service for a complete working example:
- Location: `backend/services/inventory-service/`
- Includes: CRUD operations, CSV export, automated backups
- Database: Multi-table with foreign keys and indexes

---

## Best Practices Checklist

- [ ] Use Pydantic models for all input validation
- [ ] Always use parameterized SQL queries (never string interpolation)
- [ ] Verify user ownership before modifying/deleting resources
- [ ] Include health check endpoints
- [ ] Use dependency injection for authentication
- [ ] Set appropriate CORS origins (not `*` in production)
- [ ] Include proper error messages in HTTPException
- [ ] Use async functions for I/O operations
- [ ] Add database indexes for frequently queried columns
- [ ] Document all endpoints with docstrings
- [ ] Use status codes from `fastapi.status` module
- [ ] Include version in API metadata
- [ ] Implement proper logging
- [ ] Add database backups for production

---

## Testing Your Service

### Manual Testing
```bash
# Health check
curl http://localhost:8003/health

# Create item (replace token)
curl -X POST http://localhost:8003/api/items \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Item", "description": "Test description"}'

# List items
curl http://localhost:8003/api/items \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

### Unit Tests Example
```python
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
```

---

## Next Steps

1. Copy this template to create a new service
2. Update service name and port in all files
3. Define your database schema in `database.py`
4. Create Pydantic models in `models.py`
5. Implement your API endpoints in `main.py`
6. Add service to `docker-compose.yml`
7. Update nginx configuration if exposing publicly
8. Test locally before deploying

---

## Reference Implementations

- **API Gateway**: Authentication, OIDC, user management (`backend/services/api-gateway/`)
- **Inventory Service**: CRUD operations, multi-table DB (`backend/services/inventory-service/`)
- **Lookup Service**: External API integration, caching (`backend/services/lookup-service/`)
