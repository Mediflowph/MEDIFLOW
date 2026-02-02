# 🔧 Supabase Deployment Error 403 - Fix Guide

## ❌ Error You're Seeing

```
Error while deploying: XHR for "/api/integrations/supabase/.../edge_functions/make-server/deploy" failed with status 403
```

This **403 Forbidden** error means you don't have permission to deploy through Figma Make's interface.

---

## ✅ Solution: Deploy Directly Through Supabase

You need to deploy the Edge Function **directly in Supabase Dashboard** instead of through Figma Make.

---

## 📋 Step-by-Step Deployment Guide

### Method 1: Supabase Dashboard (Web UI)

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Login with your Supabase account

2. **Select Your Project**
   - Find and click on your MediFlow project

3. **Navigate to Edge Functions**
   - Look in the left sidebar for **"Edge Functions"** (lightning bolt ⚡ icon)
   - Or go directly to: `https://supabase.com/dashboard/project/YOUR_PROJECT_ID/functions`

4. **Find Your Server Function**
   - You should see a function listed (likely called `server` or `make-server-c88a69d7`)
   - Click on the function name

5. **Deploy New Version**
   - Look for one of these options:
     - **"Deploy"** button
     - **"New deployment"** button  
     - **Three dots menu (...)** → "Redeploy" or "New version"

6. **Option A: Upload File**
   - If you see an "Upload" option:
     - Click **"Upload function"**
     - Navigate to your project folder
     - Select: `/supabase/functions/server/index.tsx`
     - Click **"Deploy"**

7. **Option B: Code Editor**
   - If you see a code editor:
     - **Delete all existing code** in the editor
     - Open `/supabase/functions/server/index.tsx` from your MediFlow project
     - **Copy ALL code** (Ctrl+A, Ctrl+C)
     - **Paste** into Supabase editor (Ctrl+V)
     - Click **"Deploy"** or **"Save and Deploy"**

8. **Wait for Deployment**
   - You'll see a loading indicator
   - Wait 30-60 seconds
   - Should see: ✅ "Deployment successful" or "Function deployed"

9. **Verify Deployment**
   - Check the function version number increased
   - Look for "Last deployed: just now" or similar

---

### Method 2: Supabase CLI (Advanced)

If you have the Supabase CLI installed:

```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link your project (if not already linked)
supabase link --project-ref YOUR_PROJECT_ID

# Deploy the function
supabase functions deploy server

# Wait for confirmation
# ✅ Deployed Function server version vX.X.X
```

To get your PROJECT_ID:
- Go to Supabase Dashboard → Settings → General
- Look for "Reference ID" or "Project ID"

---

## 🔍 Why This Error Happened

The **403 Forbidden** error occurs because:

1. **Figma Make Integration**: The connection between Figma Make and Supabase has limited permissions
2. **Edge Function Deployment**: Requires admin-level access to your Supabase project
3. **Security Restriction**: Supabase blocks certain operations from third-party integrations

**Solution**: Deploy directly through Supabase's own dashboard or CLI where you have full admin access.

---

## ✅ After Successful Deployment

Once deployed, you should:

1. **Refresh MediFlow App**
   - Hard refresh: `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)

2. **Clear Browser Cache** (if needed)
   - Press F12 → Application → Clear Storage → Clear site data

3. **Sign Out and Sign In Again**
   - Get a fresh authentication session

4. **Test the Features**:
   - ✅ Stock Locator shows only Pharmacy Staff
   - ✅ Multi-Branch Monitoring shows only Pharmacy Staff
   - ✅ Admin Dashboard shows pending user approvals
   - ✅ Approve/Reject user buttons work

---

## 🐛 Troubleshooting

### "I can't find Edge Functions in my Supabase Dashboard"
- Make sure you're logged into the correct Supabase account
- Check you're viewing the right project
- Edge Functions might be in the sidebar under "Functions" or with a ⚡ icon
- Try: `https://supabase.com/dashboard/project/YOUR_PROJECT_ID/functions`

### "The function isn't listed"
- Your Edge Function might not be deployed yet
- You may need to create it first
- Look for "Create a new function" button
- Name it `server` and paste the code from `/supabase/functions/server/index.tsx`

### "Deployment still fails in Supabase Dashboard"
1. Check your Supabase plan (Edge Functions require paid plan or trial)
2. Verify you have owner/admin permissions on the project
3. Check for syntax errors in the code
4. Try deploying via Supabase CLI instead

### "Features still don't work after deployment"
1. Check Supabase Function Logs for errors:
   - Dashboard → Edge Functions → Your Function → Logs
2. Look for error messages
3. Verify the deployment version matches your latest changes
4. Test with browser console open (F12) to see network requests

---

## 📝 Quick Checklist

Before deploying, verify:
- [ ] You have `/supabase/functions/server/index.tsx` file with latest changes
- [ ] You're logged into Supabase Dashboard as project owner
- [ ] Your Supabase project is active (not paused)
- [ ] You have internet connection

During deployment:
- [ ] You copied the ENTIRE file (not just part of it)
- [ ] You clicked "Deploy" or "Save and Deploy"
- [ ] You waited for "Deployment successful" confirmation

After deployment:
- [ ] You refreshed your MediFlow app
- [ ] You tested Stock Locator (should only show Pharmacy Staff)
- [ ] You tested Admin Dashboard (should show pending approvals)

---

## 🎯 Summary

**The Problem**: Figma Make can't deploy Supabase Edge Functions due to permission restrictions.

**The Solution**: Deploy directly through Supabase Dashboard or CLI where you have full admin access.

**Next Step**: Follow **Method 1** above to deploy via Supabase Dashboard web interface (easiest!).

Once deployed, all your fixes will be live! 🚀
