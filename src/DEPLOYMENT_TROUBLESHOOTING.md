# Deployment Troubleshooting Guide

## Current Error: "TypeError: Failed to fetch"

This error occurs when the frontend cannot connect to the Supabase Edge Function backend.

## Root Cause

**The Supabase Edge Function is not deployed yet.**

The frontend is trying to call:
```
https://wexbjcdxnblsqmjemfvq.supabase.co/functions/v1/make-server/init
```

But the Edge Function at `/supabase/functions/make-server/` has not been deployed to Supabase.

## ✅ SOLUTION

You need to **deploy the Edge Function**. See the complete deployment guide in:

📄 **[EDGE_FUNCTION_DEPLOYMENT.md](./EDGE_FUNCTION_DEPLOYMENT.md)**

### Quick Fix (Using Supabase CLI)

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref wexbjcdxnblsqmjemfvq

# Deploy the Edge Function
supabase functions deploy make-server
```

## What's Been Fixed in the Code

1. ✅ **Simplified API routes** - All routes now use clean paths like `/init`, `/projects`
2. ✅ **Added health check** - New `/health` endpoint to verify deployment
3. ✅ **Better error handling** - Console now shows helpful diagnostic messages
4. ✅ **Graceful degradation** - App won't crash if Edge Function isn't deployed yet

## Verifying the Fix

Once you deploy the Edge Function, you can verify it's working by:

### 1. Browser Console Test

Open Developer Console (F12) and run:

```javascript
fetch('https://wexbjcdxnblsqmjemfvq.supabase.co/functions/v1/make-server/health', {
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndleGJqY2R4bmJsc3FtamVtZnZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NzA5MjEsImV4cCI6MjA4MDI0NjkyMX0.P4tFliMhQWOVVGF26fZ9vbFhzUxW5EfE0BLW7JROMQM'
  }
})
.then(r => r.json())
.then(console.log);
```

Expected response: `{status: "ok"}`

### 2. Check Console Messages

The app now displays helpful messages:

- ✅ **Green checkmarks** = Edge Function is working
- ❌ **Red X marks** = Edge Function not accessible (with deployment instructions)
- ⚠️ **Yellow warnings** = Edge Function returned an error

## Understanding the Error

### Before Deployment

```
❌ Edge Function is not accessible: TypeError: Failed to fetch
BASE_URL: https://wexbjcdxnblsqmjemfvq.supabase.co/functions/v1/make-server
This means the Supabase Edge Function is not deployed yet.

To fix this:
1. The Edge Function at /supabase/functions/make-server/ needs to be deployed
2. Make sure you're using the correct Supabase project
3. Check that SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are configured
```

### After Successful Deployment

```
✅ Edge Function is healthy: {status: "ok"}
✅ Server initialized successfully
```