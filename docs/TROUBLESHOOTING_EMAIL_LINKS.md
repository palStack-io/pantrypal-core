# Troubleshooting Email Links (Password Reset, Email Verification)

## Problem: Email Links Go to Wrong Port or Domain

### Symptoms
- Password reset link goes to `http://192.168.68.104/reset-password` (missing port)
- Email verification link points to wrong domain
- Clicking email links redirects to login page instead of the correct flow

### Root Cause
The `APP_URL` environment variable in your `.env` file doesn't match how users access your service.

### Solution

#### Step 1: Identify How Users Access Your Service

Check which URL format you use to access PantryPal:
- `http://192.168.68.104:8080` ← Local network with custom port
- `http://localhost:8888` ← Local docker default
- `https://pantrypal.palstack.io` ← Production domain with SSL

**IMPORTANT**: Include the port number if it's not standard (80 for http, 443 for https)

#### Step 2: Update APP_URL in .env

Edit `backend/.env`:

```bash
# For local network access on port 8080
APP_URL=http://192.168.68.104:8080

# For local docker on default nginx port
APP_URL=http://localhost:8888

# For production with domain
APP_URL=https://pantrypal.palstack.io
```

#### Step 3: Restart API Gateway

```bash
cd backend
docker compose restart api-gateway
```

#### Step 4: Test Password Reset

1. Go to login page: `http://192.168.68.104:8080` (or your URL)
2. Click "Forgot Password"
3. Enter your email
4. Check email for reset link
5. Link should now have correct URL with port: `http://192.168.68.104:8080/reset-password?token=...`

---

## How It Works

### Email Link Generation Flow

1. User requests password reset via `/api/auth/forgot-password`
2. API Gateway reads `APP_URL` from environment variables
3. Constructs reset link: `{APP_URL}/reset-password?token={TOKEN}`
4. Sends email with link
5. User clicks link → Browser navigates to that exact URL
6. Frontend Router catches `/reset-password` route (App.jsx:81-82)
7. ResetPasswordPage component handles the token

### Frontend Routing (Already Correct)

The frontend in `App.jsx` already handles these routes properly:

```javascript
// Special routes (no auth required)
if (location.pathname === '/verify-email') {
  return <VerifyEmailPage token={token} ... />;
}
if (location.pathname === '/reset-password') {
  return <ResetPasswordPage token={token} ... />;
}
```

**The routing is NOT the problem** - it's just the URL mismatch.

---

## Common Port Configurations

### Docker Compose Default (port 8888)
```yaml
nginx:
  ports:
    - "8888:80"  # Exposes nginx on port 8888
```
**Use**: `APP_URL=http://localhost:8888` or `APP_URL=http://YOUR_IP:8888`

### Modified Port (e.g., 8080)
```yaml
nginx:
  ports:
    - "8080:80"  # Changed to port 8080
```
**Use**: `APP_URL=http://localhost:8080` or `APP_URL=http://YOUR_IP:8080`

### Production with Reverse Proxy (Caddy/Nginx)
```
External: https://pantrypal.palstack.io:443
         ↓
Reverse Proxy (handles SSL)
         ↓
Docker: localhost:8888
```
**Use**: `APP_URL=https://pantrypal.palstack.io` (no port, using standard 443)

---

## Verification Checklist

After updating `APP_URL` and restarting:

- [ ] Request password reset email
- [ ] Check email link includes correct domain AND port
- [ ] Click link - should go directly to password reset page
- [ ] Should NOT redirect to login page
- [ ] Password reset form should appear
- [ ] Submitting new password should work

---

## Related Environment Variables

```bash
# Must match user-facing URL (with port if non-standard)
APP_URL=http://192.168.68.104:8080

# Email settings (required for password reset)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_USE_TLS=true
```

---

## Still Having Issues?

### Link redirects to login instead of reset page

**Check browser console** for errors:
```bash
# Open browser DevTools (F12) → Console tab
```

If you see 401 errors, the token might be expired (1 hour expiry).

### Email contains wrong domain entirely

Check if `APP_URL` in `.env` is actually being loaded:
```bash
# View API Gateway logs
docker logs pantrypal-api-gateway | grep APP_URL
```

### Using docker-compose vs docker compose

Both work, but prefer `docker compose` (no hyphen) for newer versions:
```bash
# Old way (deprecated)
docker-compose restart api-gateway

# New way (preferred)
docker compose restart api-gateway
```

---

## Prevention: Always Set APP_URL

Before deploying or testing email features:

1. Set `APP_URL` in `backend/.env` to match your access URL
2. Include the port if not 80/443
3. Test password reset flow end-to-end
4. Document the correct URL for your team

**Pro tip**: Add APP_URL to your deployment checklist!
