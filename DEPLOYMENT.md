# 🚀 Link Station - Deployment Guide

**Live URL**: https://link-station-pro.vercel.app  
**Status**: ✅ Active Development - Admin Dashboard + Shared Redis Storage Deployed  
**Last Updated**: December 2025

---

## 📋 Deployment Overview

Link Station is deployed on Vercel as a hybrid application:
- **Static Files**: React app served from root directory
- **API**: Node.js serverless functions in `/api` directory
- **Storage**: Upstash Redis (shared room/user state across instances)

---

## 🏗️ Architecture

```
Root Directory (Vercel)
├── index.html (React app entry)
├── static/ (CSS, JS assets)
├── api/game.js (Serverless API)
├── api/storage.js (Upstash Redis helper)
├── vercel.json (Configuration)
└── package.json (Dependencies)
```

---

## 🔧 Build Process

### 1. Build React Application
```bash
cd client
npm install
npm run build
cd ..
```

### 2. Copy Static Files to Root (Windows)
```bash
# Copy main HTML file
copy client\build\index.html index.html

# Copy all static assets
xcopy client\build\static static /E /I /Y
```

### 3. Deploy to Vercel
```bash
git add .
git commit -m "Deploy: [describe changes]"
git push origin main
```

Vercel automatically detects changes and redeploys.

---

## ⚙️ Configuration Files

### vercel.json
```json
{
  "version": 2,
  "builds": [
    {
      "src": "**/*",
      "use": "@vercel/static"
    },
    {
      "src": "api/game.js",
      "use": "@vercel/node"
    }
  ],
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/game.js"
    }
  ]
}
```

### package.json (Root)
```json
{
  "name": "link-station",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "build": "cd client && npm install && npm run build",
    "vercel-build": "cd client && npm install && npm run build"
  },
  "dependencies": {
    "express": "^4.18.2"
  }
}
```

### client/package.json
```json
{
  "name": "client",
  "version": "0.1.0",
  "homepage": ".",
  "dependencies": {
    "react": "^19.1.1",
    "react-dom": "^19.1.1",
    "react-scripts": "5.0.1",
    "qrcode.react": "^4.2.0"
  },
  "scripts": {
    "build": "react-scripts build"
  }
}
```

---

## ☁️ Environment Variables (Vercel)

| Name | Purpose |
| ---- | ------- |
| `UPSTASH_REDIS_KV_REST_API_URL` | REST endpoint for Upstash Redis (used by `api/storage.js`) |
| `UPSTASH_REDIS_KV_REST_API_TOKEN` | Auth token for REST reads/writes |
| `UPSTASH_REDIS_KV_URL` | Dashboard convenience URL (optional) |
| `UPSTASH_REDIS_REDIS_URL` | Redis protocol URL (optional for future TCP clients) |
| `UPSTASH_REDIS_KV_REST_API_READ_ONLY_TOKEN` | Read-only token (optional) |
| `ADMIN_SECRET_KEY` | **NEW** Initial admin password (set to `"link-station-password-2025"` or your choice) |
| `ADMIN_SECRET_KEY` | Secret used to secure the admin-only `/api/manual-cleanup` endpoint (known only to the owner) |

**Setup Steps**
1. In Vercel dashboard → Storage → Upstash Redis → `Connect Project`.
2. Select the `link-station` project and enable **Development + Preview + Production**.
3. Keep the default prefix (e.g., `UPSTASH_REDIS`) so Vercel injects the variables automatically.
4. Redeploy so serverless functions pick up the new environment variables.
5. Manually add `ADMIN_SECRET_KEY` under **Project → Settings → Environment Variables** with a strong secret (e.g. `my-secret-cleanup-key-2025`).

> **Local development**: When these env vars are missing, `api/storage.js` automatically falls back to in-memory Maps so you can keep iterating without Redis.

---

## 🔍 Troubleshooting

### Common Issues

**404 Errors on Static Assets**
- Ensure `static/` directory is copied to root
- Check `vercel.json` configuration
- Verify `homepage: "."` in client/package.json

**API Endpoints Not Working**
- Check `vercel.json` rewrites configuration
- Ensure `api/game.js` exports default function
- Verify API routes in browser Network tab

**Build Failures**
- Check Node.js version compatibility
- Verify all dependencies in package.json
- Review Vercel build logs for specific errors

### Debug Commands

**Check Local Build**
```bash
npm run build
npm start
```

**Test API Locally**
```bash
node api/game.js
curl http://localhost:3000/api/room/test
```

**Verify Static Files**
```bash
ls -la static/
# Should show: css/, js/, and other assets
```

---

## 📊 Monitoring

### Vercel Dashboard
- **Functions**: Monitor API performance
- **Analytics**: Track user traffic
- **Logs**: View serverless function logs

### Browser Developer Tools
- **Network Tab**: Monitor API calls and polling
- **Console**: Check for JavaScript errors
- **Application**: Verify service worker (if any)

---

## 🚨 Current Issues

### Recent Improvements (December 2025)

**Session 16: Comprehensive Admin Dashboard System** ✅ COMPLETED
- Added complete admin interface with 4 main features:
  1. **Current Status**: Real-time room/user counts by type, clickable breakdowns, detailed lists
  2. **Cleanup**: User cleanup (also cleans rooms) or room-only cleanup
  3. **Shutdown/Revive**: Toggle app-wide shutdown (blocks all room operations)
  4. **Change Password**: 2-step password change (2nd password → new password)
- Admin access via username `"link-station-admin"` → password entry → dashboard
- 10 new admin endpoints (`/api/admin-*`) all secured with password verification
- Admin action alerts: Users see "관리자에 의해 추방되었습니다" or "관리자에 의해 방이 삭제되었습니다"
- Admin password stored in Redis (changeable via UI, initial from `ADMIN_SECRET_KEY` env var)
- Shutdown state persists across serverless restarts (stored in Redis)
- Admin cannot create/join rooms (admin-only UI access)
- **New env var**: `ADMIN_SECRET_KEY` (set initial admin password)

**Session 15: Shared Redis State & Stability** ✅ COMPLETED
- Integrated Upstash Redis via new `api/storage.js` helper
- Refactored all room/user endpoints to use shared storage (eliminates phantom deletions)
- Cleanup + warning system now operate on Redis data (10-minute deletion markers)
- Added Vercel env var checklist (`UPSTASH_REDIS_*`) and documentation
- Benefits: Consistent multi-instance behaviour, no surprise logouts when serverless instances rotate

**Session 14: Warning System & Room Management** ✅ COMPLETED
- ⚠️ **Inactivity Warnings**: 1-minute warnings before user/room timeouts
  - User: 30min timeout with 29min warning
  - Room: 2h timeout with 1h59min warning
- 🛡️ **Room Activity Tracking**: Prevents rooms from disappearing during active games
- 🚨 **Unexpected Event Alerts**: Notifications for kicks, disconnections, room deletions
- 👥 **Observer/Attender System**: StarCraft-style role selection
- **New Endpoints**: `/api/check-warning`, `/api/keep-alive-user`, `/api/keep-alive-room`, `/api/change-role`, `/api/return-to-waiting`
- **UX Refinements** (Session 14b):
  - Auto-disconnect now goes to `registerName` (complete logout)
  - Regular users get helpful message: "방을 유지하려면 방장에게 알려주세요"
  - Clearer button text: "로그아웃" (not "바로 로그아웃")
- **Benefits**: No surprise disconnections, robust room management, clear user feedback, proper logout flow

**Session 13: State Flow Improvements** ✅ COMPLETED
- Added `makeOrJoinRoom` bridge state, renamed states for clarity
- Users return to WaitingRoom after results (continuous play)
- **Benefits**: No username duplication, seamless multi-round play
- All users now see results and vote status properly
- Simplified polling logic with consolidated useEffect

---

## 🔄 Deployment Checklist

Before each deployment:

- [ ] Test locally with `npm start`
- [ ] Build React app successfully
- [ ] Copy static files to root
- [ ] Verify API endpoints work
- [ ] Test multi-device synchronization
- [ ] Check browser console for errors
- [ ] Commit with descriptive message
- [ ] Push to main branch
- [ ] Monitor Vercel deployment logs
- [ ] Test live application

---

## 📈 Performance Notes

### Optimization Applied
- **Static Serving**: CDN delivery for assets
- **Serverless API**: Automatic scaling
- **Polling Intervals**: 2-5 second intervals (balance between real-time and performance)
- **Heartbeat System**: 2-minute intervals to maintain connections

### Monitoring Points
- API response times (should be <500ms)
- Polling frequency (2-5 seconds)
- User disconnect detection (5-minute timeout)
- Room cleanup (1-minute intervals)

---

## 🔗 Related Files

- **PROJECT_CONTEXT.md**: Complete development history and architecture
- **NEW_CHAT_PROMPT.md**: AI assistant context handover
- **api/game.js**: Main serverless API implementation
- **client/src/App.js**: React frontend application

---

**Next Steps**: Continue monitoring for any edge cases or new user feedback.