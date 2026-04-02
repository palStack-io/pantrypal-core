#!/bin/bash
set -e

echo "🚀 Starting PantryPal API Gateway..."

# Wait for postgres to be ready
echo "⏳ Waiting for PostgreSQL..."
until python3 -c "import psycopg2; psycopg2.connect('$DATABASE_URL')" 2>/dev/null; do
  sleep 1
done
echo "✅ PostgreSQL is ready"

# ALWAYS run initialization (creates admin, checks DEMO_MODE internally)
if [ -f "/app/init_demo_data.py" ]; then
  python3 /app/init_demo_data.py
else
  echo "⚠️  init_demo_data.py not found"
fi

# Start the API server
echo "🚀 Starting API server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000