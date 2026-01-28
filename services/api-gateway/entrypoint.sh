#!/bin/bash
set -e

echo "🚀 Starting PantryPal API Gateway..."

# Wait for postgres to be ready
echo "⏳ Waiting for PostgreSQL..."
until python3 -c "import psycopg2; psycopg2.connect('$DATABASE_URL')" 2>/dev/null; do
  sleep 1
done
echo "✅ PostgreSQL is ready"

# Initialize demo data only if DEMO_MODE is enabled
if [ "$DEMO_MODE" = "true" ] && [ -f "/app/init_demo_data.py" ]; then
  echo "🌱 DEMO_MODE enabled - Initializing demo data..."
  python3 /app/init_demo_data.py
elif [ "$DEMO_MODE" = "true" ]; then
  echo "⚠️  DEMO_MODE enabled but init_demo_data.py not found"
else
  echo "ℹ️  DEMO_MODE disabled - Skipping demo data initialization"
fi

# Start the API server
echo "🚀 Starting API server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
