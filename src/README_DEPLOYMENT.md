# 🚀 Sound Map - Deployment Instructions

## ⚠️ IMPORTANT: Edge Function Not Deployed

Your Sound Map application is **almost ready**, but the Supabase Edge Function backend needs to be deployed first.

## Current Status

❌ **Edge Function:** Not deployed  
✅ **Frontend:** Ready  
✅ **Supabase Project:** Connected (`wexbjcdxnblsqmjemfvq`)  

## What You Need To Do

Deploy the Edge Function using **one of these methods**:

---

### Method 1: Supabase CLI (Recommended) ⭐

```bash
# 1. Install Supabase CLI
npm install -g supabase

# 2. Login
supabase login

# 3. Link your project
supabase link --project-ref wexbjcdxnblsqmjemfvq

# 4. Deploy the function
supabase functions deploy make-server

# 5. Test it
curl https://wexbjcdxnblsqmjemfvq.supabase.co/functions/v1/make-server/health \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndleGJqY2R4bmJsc3FtamVtZnZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NzA5MjEsImV4cCI6MjA4MDI0NjkyMX0.P4tFliMhQWOVVGF26fZ9vbFhzUxW5EfE0BLW7JROMQM"
```

✅ Expected response: `{"status":"ok"}`

---

### Method 2: Supabase Dashboard

1. Go to https://supabase.com/dashboard/project/wexbjcdxnblsqmjemfvq
2. Click **Edge Functions** in the sidebar
3. Click **Deploy new function**
4. Name: `make-server`
5. Copy the code from `/supabase/functions/make-server/index.tsx`
6. Click **Deploy**

---

### Method 3: Figma Make Deployment

If you're using Figma Make's built-in deployment system:

1. The Edge Function should deploy automatically when you publish
2. Check that the files exist in `/supabase/functions/make-server/`
3. Trigger a new deployment/publish

---

## Verifying Deployment

### Quick Browser Test

1. Open your app in a browser
2. Open Developer Console (F12)
3. Look for these messages:

**✅ Success:**
```
✅ Edge Function is healthy: {status: "ok"}
✅ Server initialized successfully
```

**❌ Not deployed yet:**
```
❌ Edge Function is not accessible: TypeError: Failed to fetch
```

### Manual Test

Run this in your browser console:

```javascript
fetch('https://wexbjcdxnblsqmjemfvq.supabase.co/functions/v1/make-server/health', {
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndleGJqY2R4bmJsc3FtamVtZnZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NzA5MjEsImV4cCI6MjA4MDI0NjkyMX0.P4tFliMhQWOVVGF26fZ9vbFhzUxW5EfE0BLW7JROMQM'
  }
})
.then(r => r.json())
.then(d => console.log('✅ Deployment successful!', d))
.catch(e => console.error('❌ Not deployed yet:', e));
```

---

## What the Edge Function Does

The backend provides these features:

- 🔐 **User Authentication** - Signup, login, profile management
- 💾 **Project Storage** - Save/load sound map projects
- 📁 **File Storage** - Upload images and audio files
- 🔗 **Share Links** - Generate shareable project URLs
- ⚙️ **User Preferences** - Store onboarding completion, settings

---

## File Structure

```
/supabase/functions/
  └── make-server/           ✅ Active (deploy this one)
      ├── index.tsx          → Main Edge Function
      └── kv_store.tsx       → Key-value storage
  └── server/                ⚠️ Deprecated (don't deploy)
```

**Important:** Only deploy the `make-server` function!

---

## Troubleshooting

### Issue: "Failed to fetch"

**Cause:** Edge Function not deployed  
**Solution:** Follow one of the deployment methods above

### Issue: 404 Not Found

**Cause:** Wrong function name or URL  
**Solution:** Verify function name is `make-server` (not `server`)

### Issue: CORS Error

**Cause:** Edge Function has CORS issues  
**Solution:** The function includes CORS config. Redeploy if needed.

### Issue: 401 Unauthorized

**Cause:** Missing Authorization header  
**Solution:** All API calls include the correct header. This is automatically handled.

---

## Next Steps After Deployment

Once the Edge Function is deployed:

1. ✅ Refresh your app
2. ✅ Create an account or login
3. ✅ Start creating sound maps!

---

## Need Help?

📖 **Detailed Guides:**
- [EDGE_FUNCTION_DEPLOYMENT.md](./EDGE_FUNCTION_DEPLOYMENT.md) - Complete deployment guide
- [DEPLOYMENT_TROUBLESHOOTING.md](./DEPLOYMENT_TROUBLESHOOTING.md) - Troubleshooting steps

💡 **Quick Reference:**
- Project ID: `wexbjcdxnblsqmjemfvq`
- Function Name: `make-server`
- Function URL: `https://wexbjcdxnblsqmjemfvq.supabase.co/functions/v1/make-server`

---

## Summary

1. **Deploy the Edge Function** using Supabase CLI or Dashboard
2. **Verify** by checking the browser console or running the test
3. **Start using** your Sound Map app!

The app is ready to go once the backend is deployed. All code is in place and properly configured! 🎉
