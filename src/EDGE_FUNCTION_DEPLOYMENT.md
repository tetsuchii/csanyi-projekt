# Edge Function Deployment Guide

## Issue

The app is showing "TypeError: Failed to fetch" because the Supabase Edge Function is not deployed.

## Current Configuration

- **Project ID:** `wexbjcdxnblsqmjemfvq`
- **Function Name:** `make-server`
- **Function Path:** `/supabase/functions/make-server/`
- **Expected URL:** `https://wexbjcdxnblsqmjemfvq.supabase.co/functions/v1/make-server`

## How to Deploy the Edge Function

### Option 1: Using Supabase CLI (Recommended)

1. **Install Supabase CLI** (if not already installed):
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**:
   ```bash
   supabase login
   ```

3. **Link to your project**:
   ```bash
   supabase link --project-ref wexbjcdxnblsqmjemfvq
   ```

4. **Deploy the Edge Function**:
   ```bash
   supabase functions deploy make-server
   ```

5. **Verify deployment**:
   ```bash
   curl https://wexbjcdxnblsqmjemfvq.supabase.co/functions/v1/make-server/health \
     -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndleGJqY2R4bmJsc3FtamVtZnZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NzA5MjEsImV4cCI6MjA4MDI0NjkyMX0.P4tFliMhQWOVVGF26fZ9vbFhzUxW5EfE0BLW7JROMQM"
   ```

   Expected response: `{"status":"ok"}`

### Option 2: Using Supabase Dashboard

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/wexbjcdxnblsqmjemfvq
2. Navigate to **Edge Functions** in the sidebar
3. Click **Deploy new function**
4. Upload or paste the contents of `/supabase/functions/make-server/index.tsx`
5. Name it `make-server`
6. Click **Deploy**

### Option 3: Automatic Deployment in Figma Make

If you're using Figma Make's deployment system, the Edge Function should be automatically deployed when you publish your app. Make sure:

1. The Edge Function files are in the correct location: `/supabase/functions/make-server/`
2. The function has an `index.tsx` entry point
3. You've triggered a deployment/publish action

## Verifying Deployment

### Quick Browser Test

Open your browser's Developer Console (F12) and run:

```javascript
fetch('https://wexbjcdxnblsqmjemfvq.supabase.co/functions/v1/make-server/health', {
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndleGJqY2R4bmJsc3FtamVtZnZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NzA5MjEsImV4cCI6MjA4MDI0NjkyMX0.P4tFliMhQWOVVGF26fZ9vbFhzUxW5EfE0BLW7JROMQM'
  }
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

If deployed correctly, you should see: `{status: "ok"}`

### Check Console Logs

The app now includes helpful diagnostic messages. Open your browser console and look for:

- ✅ **Success messages** if the Edge Function is working
- ❌ **Error messages** with deployment instructions if not accessible

## Edge Function Routes

Once deployed, the following endpoints will be available:

### Public Routes
- `GET /health` - Health check
- `GET /init` - Initialize storage bucket
- `POST /share` - Create share link
- `GET /share/resolve?id=xxx` - Resolve share link
- `GET /public/project?userId=xxx&projectId=xxx` - Get shared project

### Authenticated Routes (require user token)
- `GET /projects` - Load user's projects
- `POST /projects` - Save user's projects
- `POST /storage/upload-url` - Get upload URL for files
- `POST /storage/get-url` - Get signed URL for files
- `GET /user/preferences` - Load user preferences
- `POST /user/preferences` - Save user preferences

## Troubleshooting

### "Failed to fetch" Error

**Cause:** Edge Function not deployed or not accessible

**Solution:** Deploy the function using one of the methods above

### CORS Errors

**Cause:** Missing CORS headers

**Solution:** The Edge Function already includes CORS configuration. Make sure you're using the latest version from `/supabase/functions/make-server/index.tsx`

### 401 Unauthorized

**Cause:** Missing or invalid Authorization header

**Solution:** All requests must include the Authorization header:
```javascript
headers: {
  'Authorization': `Bearer ${token}` // Use publicAnonKey for public routes
}
```

### 404 Not Found

**Cause:** Wrong function name or route

**Solution:** Verify the URL structure:
- Function URL: `https://wexbjcdxnblsqmjemfvq.supabase.co/functions/v1/make-server`
- Routes use simple paths: `/init`, `/projects`, `/health`

## Important Notes

### Multiple Edge Function Directories

There are currently two Edge Function directories in this project:

1. ✅ `/supabase/functions/make-server/` - **ACTIVE** - Uses simplified routes
2. ⚠️ `/supabase/functions/server/` - **OLD** - Uses prefixed routes (deprecated)

**Only deploy the `make-server` function.** The `server` directory is outdated and should not be deployed.

### Environment Variables

The Edge Function requires these environment variables, which are automatically provided by Supabase:

- `SUPABASE_URL` - Your project's URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin operations

These are automatically available in deployed Edge Functions. No manual configuration needed.

### Storage Bucket

The Edge Function creates a storage bucket named `make-5be515e6-assets` on first initialization. This bucket stores:

- Project images
- Audio files for hotspots
- Intro audio files
- Global channel audio files

The bucket is configured with:
- Private access (requires signed URLs)
- 50MB file size limit

## Next Steps

1. Deploy the Edge Function using one of the methods above
2. Refresh your app
3. Check the browser console for success messages
4. If issues persist, check the Supabase Edge Functions logs in the dashboard

## Support

If you continue to have deployment issues:

1. Check the Supabase Edge Functions logs in your dashboard
2. Verify your project ID matches: `wexbjcdxnblsqmjemfvq`
3. Ensure you have the correct permissions for the Supabase project
4. Try deploying a simple test function first to verify your setup
