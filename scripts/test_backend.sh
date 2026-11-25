#!/bin/bash

# Backend Comprehensive Test Script
# Tests all new recipe and image functionality

BASE_URL="http://localhost:8888"
API_URL="${BASE_URL}/api"

echo "============================================"
echo "PantryPal Backend Comprehensive Test"
echo "============================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

test_count=0
passed_count=0
failed_count=0

# Test function
run_test() {
    local name=$1
    local command=$2
    local expected=$3

    test_count=$((test_count + 1))
    echo -e "${YELLOW}Test ${test_count}: ${name}${NC}"

    result=$(eval "$command" 2>&1)

    if echo "$result" | grep -q "$expected"; then
        echo -e "${GREEN}✓ PASSED${NC}"
        passed_count=$((passed_count + 1))
        echo "$result" | python3 -m json.tool 2>/dev/null || echo "$result"
    else
        echo -e "${RED}✗ FAILED${NC}"
        echo "Expected to find: $expected"
        echo "Got:"
        echo "$result"
        failed_count=$((failed_count + 1))
    fi
    echo ""
}

echo "============================================"
echo "1. Health Check Tests"
echo "============================================"
echo ""

run_test "API Health Check" \
    "curl -s ${API_URL}/health" \
    "healthy"

echo "============================================"
echo "2. Recipe Integration Tests"
echo "============================================"
echo ""

run_test "Get Recipe Integration (not configured)" \
    "curl -s ${API_URL}/recipes/integration" \
    "configured.*false"

# Test creating a recipe integration (will fail without valid Mealie/Tandoor server)
echo -e "${YELLOW}Test ${test_count}: Create Recipe Integration (expected to fail without valid server)${NC}"
test_count=$((test_count + 1))
result=$(curl -s -X POST ${API_URL}/recipes/integration \
    -H "Content-Type: application/json" \
    -d '{
        "provider": "mealie",
        "server_url": "http://invalid-server:9000",
        "api_token": "fake-token",
        "import_images": true
    }')
echo "$result" | python3 -m json.tool 2>/dev/null || echo "$result"
echo ""

echo "============================================"
echo "3. Recipe Query Tests"
echo "============================================"
echo ""

run_test "List Recipes (empty)" \
    "curl -s '${API_URL}/recipes/?limit=10'" \
    "total.*0"

run_test "Get Recipe Suggestions" \
    "curl -s '${API_URL}/recipes/suggestions?min_match=50'" \
    "count.*0"

run_test "Get Recipes Using Expiring Items" \
    "curl -s '${API_URL}/recipes/expiring'" \
    "count.*0"

run_test "Search Recipes" \
    "curl -s '${API_URL}/recipes/search?q=chicken'" \
    "count.*0"

run_test "Get Favorite Recipes" \
    "curl -s ${API_URL}/recipes/favorites" \
    "count.*0"

echo "============================================"
echo "4. Database Tests"
echo "============================================"
echo ""

echo -e "${YELLOW}Checking PostgreSQL tables...${NC}"
tables=$(docker exec pantrypal-postgres psql -U pantrypal -d pantrypal -t -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public'" 2>/dev/null)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ PostgreSQL connected${NC}"
    echo "Tables found:"
    echo "$tables"

    # Count expected tables
    table_count=$(echo "$tables" | wc -l | tr -d ' ')
    if [ "$table_count" -ge 10 ]; then
        echo -e "${GREEN}✓ All 10 tables exist${NC}"
        passed_count=$((passed_count + 1))
    else
        echo -e "${RED}✗ Expected 10 tables, found ${table_count}${NC}"
        failed_count=$((failed_count + 1))
    fi
else
    echo -e "${RED}✗ Could not connect to PostgreSQL${NC}"
    failed_count=$((failed_count + 1))
fi
echo ""

echo "============================================"
echo "5. MinIO Bucket Tests"
echo "============================================"
echo ""

echo -e "${YELLOW}Checking MinIO buckets...${NC}"
buckets=$(docker exec pantrypal-minio mc ls myminio 2>/dev/null)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ MinIO connected${NC}"
    echo "Buckets found:"
    echo "$buckets"

    # Check for all 4 buckets
    if echo "$buckets" | grep -q "pantrypal-products" && \
       echo "$buckets" | grep -q "pantrypal-users" && \
       echo "$buckets" | grep -q "pantrypal-receipts" && \
       echo "$buckets" | grep -q "pantrypal-recipes"; then
        echo -e "${GREEN}✓ All 4 buckets exist${NC}"
        passed_count=$((passed_count + 1))
    else
        echo -e "${RED}✗ Not all buckets found${NC}"
        failed_count=$((failed_count + 1))
    fi
else
    echo -e "${RED}✗ Could not connect to MinIO${NC}"
    failed_count=$((failed_count + 1))
fi
echo ""

echo "============================================"
echo "6. Service Status Tests"
echo "============================================"
echo ""

echo -e "${YELLOW}Checking service status...${NC}"
services=$(docker-compose ps --format json | python3 -c "
import json, sys
services = [json.loads(line) for line in sys.stdin]
for svc in services:
    name = svc.get('Name', 'unknown')
    state = svc.get('State', 'unknown')
    status = svc.get('Status', 'unknown')
    print(f'{name}: {state} ({status})')
" 2>/dev/null)

if [ $? -eq 0 ]; then
    echo "$services"
    echo ""

    # Check if all critical services are running
    if echo "$services" | grep -q "pantrypal-api-gateway.*running" && \
       echo "$services" | grep -q "pantrypal-postgres.*running" && \
       echo "$services" | grep -q "pantrypal-minio.*running"; then
        echo -e "${GREEN}✓ All critical services running${NC}"
        passed_count=$((passed_count + 1))
    else
        echo -e "${RED}✗ Some services not running${NC}"
        failed_count=$((failed_count + 1))
    fi
else
    echo -e "${RED}✗ Could not check service status${NC}"
    failed_count=$((failed_count + 1))
fi
echo ""

echo "============================================"
echo "Test Summary"
echo "============================================"
echo ""
echo "Total Tests: $test_count"
echo -e "${GREEN}Passed: $passed_count${NC}"
if [ $failed_count -gt 0 ]; then
    echo -e "${RED}Failed: $failed_count${NC}"
else
    echo -e "${GREEN}Failed: $failed_count${NC}"
fi
echo ""

if [ $failed_count -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    exit 1
fi
