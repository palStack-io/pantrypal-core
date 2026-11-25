#!/bin/bash
# Test script for PantryPal Shared Household Model
# Run this after docker compose up to verify all features work correctly

set -e

BASE_URL="${BASE_URL:-http://localhost:8888}"
PASS=0
FAIL=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

pass() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
    PASS=$((PASS + 1))
}

fail() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    FAIL=$((FAIL + 1))
}

section() {
    echo -e "\n${YELLOW}=== $1 ===${NC}"
}

# Wait for API to be ready
echo "Waiting for API to be ready..."
for i in {1..30}; do
    if curl -s "$BASE_URL/api/auth/status" > /dev/null 2>&1; then
        echo "API is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "API not ready after 30 seconds, exiting"
        exit 1
    fi
    sleep 1
done

section "Part 1: ALLOW_REGISTRATION Default"

# Check that registration is disabled by default
ALLOW_REG=$(curl -s "$BASE_URL/api/auth/status" | jq -r '.allow_registration')
if [ "$ALLOW_REG" = "false" ]; then
    pass "Registration disabled by default"
else
    fail "Registration should be disabled by default (got: $ALLOW_REG)"
fi

section "Part 2: Admin Promotion/Demotion"

# Login as admin
ADMIN_TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin123"}' | jq -r '.session_token')

if [ -n "$ADMIN_TOKEN" ] && [ "$ADMIN_TOKEN" != "null" ]; then
    pass "Admin login successful"
else
    fail "Admin login failed"
    exit 1
fi

# Get demo1 user ID
DEMO1_ID=$(curl -s -H "Cookie: session_token=$ADMIN_TOKEN" "$BASE_URL/api/admin/users" | jq -r '.users[] | select(.username=="demo1") | .id')

if [ -n "$DEMO1_ID" ] && [ "$DEMO1_ID" != "null" ]; then
    pass "Got demo1 user ID: $DEMO1_ID"
else
    fail "Could not get demo1 user ID"
fi

# Promote demo1 to admin
PROMOTE_RESULT=$(curl -s -H "Cookie: session_token=$ADMIN_TOKEN" -X PATCH "$BASE_URL/api/admin/users/$DEMO1_ID" \
    -H "Content-Type: application/json" \
    -d '{"is_admin": true}')

if echo "$PROMOTE_RESULT" | jq -e '.message' > /dev/null 2>&1; then
    pass "Promoted demo1 to admin"
else
    fail "Failed to promote demo1 to admin: $PROMOTE_RESULT"
fi

# Verify demo1 is now admin
IS_ADMIN=$(curl -s -H "Cookie: session_token=$ADMIN_TOKEN" "$BASE_URL/api/admin/users" | jq -r '.users[] | select(.username=="demo1") | .is_admin')
if [ "$IS_ADMIN" = "true" ]; then
    pass "Verified demo1 is now admin"
else
    fail "demo1 should be admin (got: $IS_ADMIN)"
fi

# Demo1 (now admin) can access admin endpoints
DEMO1_TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"demo1","password":"demo123"}' | jq -r '.session_token')

STATS=$(curl -s -H "Cookie: session_token=$DEMO1_TOKEN" "$BASE_URL/api/admin/stats")
if echo "$STATS" | jq -e '.total_users' > /dev/null 2>&1; then
    pass "demo1 (admin) can access admin stats"
else
    fail "demo1 (admin) should access admin stats: $STATS"
fi

# Demote demo1 back
DEMOTE_RESULT=$(curl -s -H "Cookie: session_token=$ADMIN_TOKEN" -X PATCH "$BASE_URL/api/admin/users/$DEMO1_ID" \
    -H "Content-Type: application/json" \
    -d '{"is_admin": false}')

if echo "$DEMOTE_RESULT" | jq -e '.message' > /dev/null 2>&1; then
    pass "Demoted demo1 back to regular user"
else
    fail "Failed to demote demo1: $DEMOTE_RESULT"
fi

# Test last admin protection - try to demote the last admin
ADMIN_ID=$(curl -s -H "Cookie: session_token=$ADMIN_TOKEN" "$BASE_URL/api/admin/users" | jq -r '.users[] | select(.username=="admin") | .id')
LAST_ADMIN_RESULT=$(curl -s -H "Cookie: session_token=$ADMIN_TOKEN" -X PATCH "$BASE_URL/api/admin/users/$ADMIN_ID" \
    -H "Content-Type: application/json" \
    -d '{"is_admin": false}')

# Should fail because you can't modify yourself
if echo "$LAST_ADMIN_RESULT" | jq -e '.detail' > /dev/null 2>&1; then
    pass "Cannot modify own admin status (self-protection)"
else
    fail "Should not be able to modify own status"
fi

section "Part 3: Shared Recipes"

# Login as demo1 and demo2
DEMO1_TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"demo1","password":"demo123"}' | jq -r '.session_token')

DEMO2_TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"demo2","password":"demo123"}' | jq -r '.session_token')

# Get recipe counts - should be same for all users
ADMIN_RECIPES=$(curl -s -H "Cookie: session_token=$ADMIN_TOKEN" "$BASE_URL/api/recipes/?limit=1" | jq -r '.total')
DEMO1_RECIPES=$(curl -s -H "Cookie: session_token=$DEMO1_TOKEN" "$BASE_URL/api/recipes/?limit=1" | jq -r '.total')
DEMO2_RECIPES=$(curl -s -H "Cookie: session_token=$DEMO2_TOKEN" "$BASE_URL/api/recipes/?limit=1" | jq -r '.total')

if [ "$ADMIN_RECIPES" = "$DEMO1_RECIPES" ] && [ "$DEMO1_RECIPES" = "$DEMO2_RECIPES" ]; then
    pass "Recipes shared across users (all see $ADMIN_RECIPES recipes)"
else
    fail "Recipe counts differ: admin=$ADMIN_RECIPES, demo1=$DEMO1_RECIPES, demo2=$DEMO2_RECIPES"
fi

# Get first recipe ID
RECIPE_ID=$(curl -s -H "Cookie: session_token=$ADMIN_TOKEN" "$BASE_URL/api/recipes/?limit=1" | jq -r '.recipes[0].id')

if [ -n "$RECIPE_ID" ] && [ "$RECIPE_ID" != "null" ]; then
    pass "Got recipe ID: $RECIPE_ID"
else
    fail "Could not get recipe ID"
fi

# First unfavorite the recipe to ensure clean state
curl -s -H "Cookie: session_token=$DEMO1_TOKEN" -X POST "$BASE_URL/api/recipes/$RECIPE_ID/favorite" > /dev/null 2>&1
# Check if it's now unfavorited, if so favorite it; if not, it was already unfavorited
CURRENT_FAV=$(curl -s -H "Cookie: session_token=$DEMO1_TOKEN" "$BASE_URL/api/recipes/$RECIPE_ID" | jq -r '.favorite')
if [ "$CURRENT_FAV" = "true" ]; then
    # Toggle again to unfavorite
    curl -s -H "Cookie: session_token=$DEMO1_TOKEN" -X POST "$BASE_URL/api/recipes/$RECIPE_ID/favorite" > /dev/null 2>&1
fi

# Get baseline favorite count
BASELINE_FAVS=$(curl -s -H "Cookie: session_token=$DEMO1_TOKEN" "$BASE_URL/api/recipes/favorites" | jq -r '.count')

# Demo1 favorites the recipe
FAV_RESULT=$(curl -s -H "Cookie: session_token=$DEMO1_TOKEN" -X POST "$BASE_URL/api/recipes/$RECIPE_ID/favorite")
if echo "$FAV_RESULT" | jq -e '.favorite == true' > /dev/null 2>&1; then
    pass "Demo1 favorited recipe"
else
    fail "Demo1 could not favorite recipe: $FAV_RESULT"
fi

# Demo1 should have 1 more favorite than baseline
EXPECTED_FAVS=$((BASELINE_FAVS + 1))
DEMO1_FAVS=$(curl -s -H "Cookie: session_token=$DEMO1_TOKEN" "$BASE_URL/api/recipes/favorites" | jq -r '.count')
if [ "$DEMO1_FAVS" = "$EXPECTED_FAVS" ]; then
    pass "Demo1 favorite count increased (was: $BASELINE_FAVS, now: $DEMO1_FAVS)"
else
    fail "Demo1 favorite count should be $EXPECTED_FAVS (got: $DEMO1_FAVS)"
fi

# Demo2 should have 0 favorites (per-user)
DEMO2_FAVS=$(curl -s -H "Cookie: session_token=$DEMO2_TOKEN" "$BASE_URL/api/recipes/favorites" | jq -r '.count')
if [ "$DEMO2_FAVS" = "0" ]; then
    pass "Demo2 has 0 favorites (per-user isolation)"
else
    fail "Demo2 should have 0 favorites (got: $DEMO2_FAVS)"
fi

# Demo1 adds notes
NOTES_RESULT=$(curl -s -H "Cookie: session_token=$DEMO1_TOKEN" -X PATCH "$BASE_URL/api/recipes/$RECIPE_ID/notes" \
    -H "Content-Type: application/json" \
    -d '{"notes": "Demo1 private notes"}')
if echo "$NOTES_RESULT" | jq -e '.success == true' > /dev/null 2>&1; then
    pass "Demo1 added notes"
else
    fail "Demo1 could not add notes: $NOTES_RESULT"
fi

# Demo1 can see their notes
DEMO1_NOTES=$(curl -s -H "Cookie: session_token=$DEMO1_TOKEN" "$BASE_URL/api/recipes/$RECIPE_ID" | jq -r '.notes')
if [ "$DEMO1_NOTES" = "Demo1 private notes" ]; then
    pass "Demo1 can see own notes"
else
    fail "Demo1 notes not found (got: $DEMO1_NOTES)"
fi

# Demo2 should not see Demo1's notes
DEMO2_NOTES=$(curl -s -H "Cookie: session_token=$DEMO2_TOKEN" "$BASE_URL/api/recipes/$RECIPE_ID" | jq -r '.notes')
if [ "$DEMO2_NOTES" = "null" ] || [ -z "$DEMO2_NOTES" ]; then
    pass "Demo2 cannot see Demo1's notes (per-user isolation)"
else
    fail "Demo2 should not see Demo1's notes (got: $DEMO2_NOTES)"
fi

section "Part 4: Integration Admin-Only"

# Demo1 (non-admin) can read integration status
INTEGRATION_STATUS=$(curl -s -H "Cookie: session_token=$DEMO1_TOKEN" "$BASE_URL/api/recipes/integration")
if echo "$INTEGRATION_STATUS" | jq -e '.configured' > /dev/null 2>&1; then
    pass "Non-admin can read integration status"
else
    fail "Non-admin should be able to read integration status: $INTEGRATION_STATUS"
fi

# Demo1 (non-admin) cannot POST integration
POST_RESULT=$(curl -s -H "Cookie: session_token=$DEMO1_TOKEN" -X POST "$BASE_URL/api/recipes/integration" \
    -H "Content-Type: application/json" \
    -d '{"provider":"mealie","server_url":"http://test","api_token":"test"}')
if echo "$POST_RESULT" | jq -e '.detail == "Admin access required"' > /dev/null 2>&1; then
    pass "Non-admin cannot POST integration (admin only)"
else
    fail "Non-admin should not be able to POST integration: $POST_RESULT"
fi

# Demo1 (non-admin) cannot DELETE integration
DELETE_RESULT=$(curl -s -H "Cookie: session_token=$DEMO1_TOKEN" -X DELETE "$BASE_URL/api/recipes/integration?provider=tandoor")
if echo "$DELETE_RESULT" | jq -e '.detail == "Admin access required"' > /dev/null 2>&1; then
    pass "Non-admin cannot DELETE integration (admin only)"
else
    fail "Non-admin should not be able to DELETE integration: $DELETE_RESULT"
fi

# Admin can access integration endpoints
ADMIN_INT=$(curl -s -H "Cookie: session_token=$ADMIN_TOKEN" "$BASE_URL/api/recipes/integration")
if echo "$ADMIN_INT" | jq -e '.configured' > /dev/null 2>&1; then
    pass "Admin can access integration endpoint"
else
    fail "Admin should access integration: $ADMIN_INT"
fi

section "Summary"

TOTAL=$((PASS + FAIL))
echo -e "\n${GREEN}Passed: $PASS${NC}"
echo -e "${RED}Failed: $FAIL${NC}"
echo "Total: $TOTAL"

if [ $FAIL -eq 0 ]; then
    echo -e "\n${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}Some tests failed!${NC}"
    exit 1
fi
