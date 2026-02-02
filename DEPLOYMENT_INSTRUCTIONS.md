# MediFlow Server Deployment Instructions

## Critical: Stock Locator Permission Fix

The Stock Locator feature requires Pharmacy Staff to access the `/inventory/all-branches` endpoint.

### What Changed

**Line 254** in the server code now allows Pharmacy Staff:

```typescript
// OLD (blocks Pharmacy Staff):
if (userRole !== 'Administrator' && userRole !== 'Health Officer') {

// NEW (allows Pharmacy Staff):
if (userRole !== 'Administrator' && userRole !== 'Health Officer' && userRole !== 'Pharmacy Staff') {
```

---

## How to Deploy

### Option 1: Supabase Dashboard

1. Go to: https://supabase.com/dashboard
2. Select your MediFlow project
3. Click "Edge Functions" in the sidebar
4. Find and click on your function (likely called `server`)
5. Click "Deploy new version" or "Edit"
6. Copy the ENTIRE contents of `/supabase/functions/server/index.tsx`
7. Paste into the editor, replacing all existing code
8. Click "Deploy"
9. Wait 30-60 seconds
10. Refresh your MediFlow app
11. Stock Locator should now work for Pharmacy Staff!

### Option 2: Supabase CLI

If you have Supabase CLI installed:

```bash
supabase functions deploy server
```

---

## Verification

After deployment, check the browser console when accessing Stock Locator:

✅ Should see: `🔍 Stock Locator - Current User Role: Pharmacy Staff`
✅ Should see: `🔍 Stock Locator: Response status: 200`
✅ Should see: `Loaded data from X branches` (success toast)

❌ Should NOT see: `Permission error` or `access denied`

---

## File Location

The updated server code is at:
- `/supabase/functions/server/index.tsx`

The key change is on **line 254**.
