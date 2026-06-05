# Free Deployment on Railway (5 Minutes)

## Step 1: Create GitHub Repository

```bash
cd "Video Conferrencing app"
git init
git add .
git commit -m "NEXUS video conferencing app"
git remote add origin https://github.com/your-username/nexus-app
git branch -M main
git push -u origin main
```

## Step 2: Deploy on Railway

1. **Go to** https://railway.app
2. **Click** "New Project"
3. **Select** "Deploy from GitHub"
4. **Authorize** GitHub (if first time)
5. **Select** your `nexus-app` repository
6. **Click** Deploy
7. **Wait** 2-3 minutes
8. **Get URL** from Railway dashboard

---

## Step 3: Test Your Deployment

1. Check Railway logs for errors
2. Go to your app URL (e.g., `https://nexus-app-production.up.railway.app`)
3. Test creating a room
4. Verify camera/mic work

---

## Step 4: Update CORS

In `server.js`, update:

```javascript
const allowedOrigins = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',') 
  : [
      'https://your-railway-url.up.railway.app',
      'http://localhost:3000'
    ];
```

Commit and push:
```bash
git add server.js
git commit -m "Update CORS for Railway deployment"
git push origin main
```

Railway auto-redeploys ✅

---

## Cost Breakdown

| Time | Cost |
|------|------|
| Month 1 | $0 (free credit) |
| Month 2 | $0 (free credit) |
| Month 3+ | $3-5/month (if active) |

**Free tier limits:**
- 500MB storage
- Shared CPU
- No auto-wake (sleeps after inactivity)

Perfect for demos, testing, and small deployments!

---

## Next: Custom Domain (Optional)

1. Buy domain: Namecheap ($1-3/year)
2. In Railway: Settings → Domain
3. Add your domain
4. Get SSL certificate (automatic)
5. Done!

---

## Troubleshooting

**Logs show errors?**
```
Click Railway → Deployments → View Logs
```

**App not responding?**
- Check server.js runs locally: `npm start`
- Check PORT env variable set
- Check CORS_ORIGINS includes your Railway URL

**Need help?**
- Railway docs: https://docs.railway.app
- Check GitHub issues

---

**Save this file and follow the steps above to deploy for free!**
