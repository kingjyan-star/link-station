# 🚀 Link Station - Deployment Guide

**Live URL**: https://link-station-pro.vercel.app  
**Status**: 🔧 In Progress - Persistent Polling Issues Require Fundamental Fix  
**Last Updated**: October 2025

---

## 📋 Deployment Overview

Link Station is deployed on Vercel as a hybrid application:
- **Static Files**: React app served from root directory
- **API**: Node.js serverless functions in `/api` directory

---

## 🏗️ Architecture

```
Root Directory (Vercel)
├── index.html (React app entry)
├── static/ (CSS, JS assets)
├── api/game.js (Serverless API)
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

### Critical Bug (October 2025)
**Problem**: Polling system fundamentally broken
- No results shown to anybody after voting
- Users cannot see others' vote status except when they vote
- Master also affected by vote status update issues
- Multiple comprehensive fixes attempted with no success

**Status**: Requires fundamental architecture redesign

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

**Next Steps**: Fix the critical polling bug to ensure all users see match results simultaneously.