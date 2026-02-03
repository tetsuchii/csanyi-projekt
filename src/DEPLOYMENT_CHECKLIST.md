# 🚀 Sound Map Deployment Checklist

Use this checklist to deploy your Sound Map application.

---

## Prerequisites

- [ ] Supabase account
- [ ] Project connected: `wexbjcdxnblsqmjemfvq`
- [ ] Node.js installed (for Supabase CLI)

---

## Step 1: Install Supabase CLI

```bash
npm install -g supabase
```

- [ ] CLI installed successfully

---

## Step 2: Login to Supabase

```bash
supabase login
```

- [ ] Logged in successfully
- [ ] Browser opened for authentication

---

## Step 3: Link Your Project

```bash
supabase link --project-ref wexbjcdxnblsqmjemfvq
```

- [ ] Project linked successfully
- [ ] Terminal shows confirmation

---

## Step 4: Deploy Edge Function

```bash
supabase functions deploy make-server
```

Expected output:
```
Deploying function make-server...
Function deployed successfully!
```

- [ ] Deployment completed without errors
- [ ] Function URL displayed

---

## Step 5: Verify Deployment

### Test in Browser Console

1. Open your app in browser
2. Press F12 to open Developer Console
3. Run this command:

```javascript
fetch('https://wexbjcdxnblsqmjemfvq.supabase.co/functions/v1/make-server/health', {
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndleGJqY2R4bmJsc3FtamVtZnZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NzA5MjEsImV4cCI6MjA4MDI0NjkyMX0.P4tFliMhQWOVVGF26fZ9vbFhzUxW5EfE0BLW7JROMQM'
  }
})
.then(r => r.json())
.then(d => console.log('✅ Success!', d))
.catch(e => console.error('❌ Failed:', e));
```

Expected result:
```javascript
✅ Success! {status: "ok"}
```

- [ ] Health check returned `{status: "ok"}`

### Check App Console

Refresh your app and check the console:

- [ ] See: `✅ Edge Function is healthy: {status: "ok"}`
- [ ] See: `✅ Server initialized successfully`
- [ ] No error messages about failed fetch

---

## Step 6: Test App Features

- [ ] Auth: Can create account
- [ ] Auth: Can login
- [ ] Projects: Can create new project
- [ ] Projects: Can upload image
- [ ] Projects: Can add hotspots
- [ ] Projects: Can upload audio
- [ ] Projects: Can save project
- [ ] Projects: Can load projects after refresh
- [ ] Share: Can create share link
- [ ] Share: Can view shared project

---

## Troubleshooting

### ❌ Problem: CLI not found

**Solution:**
```bash
npm install -g supabase
# Or try:
npx supabase login
```

### ❌ Problem: Project not linking

**Solution:**
1. Check project ID: `wexbjcdxnblsqmjemfvq`
2. Verify you have access to the project
3. Check Supabase dashboard

### ❌ Problem: Health check fails

**Possible causes:**
- Function not deployed yet → Redeploy
- Wrong project ID → Check project settings
- CORS issues → Check Edge Function has CORS enabled

**Solution:**
```bash
# Redeploy the function
supabase functions deploy make-server --no-verify-jwt
```

### ❌ Problem: Still seeing "Failed to fetch"

**Check:**
1. Clear browser cache and reload
2. Check browser console for specific errors
3. Verify function URL in Supabase dashboard
4. Check Edge Function logs in Supabase

---

## Alternative: Supabase Dashboard Deployment

If CLI doesn't work, deploy via dashboard:

1. [ ] Go to https://supabase.com/dashboard/project/wexbjcdxnblsqmjemfvq
2. [ ] Click **Edge Functions** in sidebar
3. [ ] Click **Deploy new function**
4. [ ] Name: `make-server`
5. [ ] Copy code from `/supabase/functions/make-server/index.tsx`
6. [ ] Click **Deploy**
7. [ ] Verify deployment

---

## Success Criteria

✅ All checks passed:

- CLI installed and working
- Project linked
- Function deployed
- Health check passes
- App console shows success
- App features working

🎉 **Your Sound Map is now fully deployed and operational!**

---

## Next Steps

- [ ] Create your first sound map
- [ ] Test on tablet devices
- [ ] Share a project with someone
- [ ] Configure Freesound API for browsing sounds (optional)

---

## Support Resources

- 📖 [README_DEPLOYMENT.md](./README_DEPLOYMENT.md) - Quick guide
- 📖 [EDGE_FUNCTION_DEPLOYMENT.md](./EDGE_FUNCTION_DEPLOYMENT.md) - Detailed guide
- 📖 [DEPLOYMENT_TROUBLESHOOTING.md](./DEPLOYMENT_TROUBLESHOOTING.md) - Troubleshooting
- 📖 [FIX_SUMMARY.md](./FIX_SUMMARY.md) - Technical details

---

## Notes

- **Project ID:** `wexbjcdxnblsqmjemfvq`
- **Function Name:** `make-server`
- **Function Location:** `/supabase/functions/make-server/`
- **Health Check:** `https://wexbjcdxnblsqmjemfvq.supabase.co/functions/v1/make-server/health`

---

**Date:** _______________  
**Deployed By:** _______________  
**Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Complete
