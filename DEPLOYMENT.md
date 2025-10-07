# 🚀 Link Station - Deployment Guide

**Live URL**: https://link-station-pro.vercel.app  
**Platform**: Vercel  
**Last Updated**: October 2025

---

## 📋 Quick Deployment

### Standard Build & Deploy Process

```bash
# 1. Build React app
cd client
npm run build
cd ..

# 2. Copy static files to root (Windows)
copy client\build\index.html index.html
xcopy client\build\static static /E /I /Y

# 3. Commit and deploy
git add .
git commit -m "Your deployment message"
git push origin main
```

**Vercel auto-deploys** when you push to the `main` branch.

---

## 🏗️ Deployment Architecture

### Vercel Configuration (`vercel.json`)

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

### What Gets Deployed

1. **Static Files** (served from root):
   - `index.html` - Main React app entry
   - `static/css/` - Compiled stylesheets
   - `static/js/` - Compiled React JavaScript
   - `asset-manifest.json`, `manifest.json`, `robots.txt`

2. **Serverless Functions**:
   - `api/game.js` - All game API endpoints

3. **Configuration**:
   - `vercel.json` - Routing and build config
   - `package.json` - Dependencies

---

## 🔧 Build Configuration

### Client Package.json Settings

**Critical**: Must have `"homepage": "."` for correct asset paths:

```json
{
  "name": "client",
  "homepage": ".",
  "dependencies": {
    "react": "^19.1.1",
    "react-dom": "^19.1.1",
    "qrcode.react": "^4.2.0"
  },
  "scripts": {
    "build": "react-scripts build"
  }
}
```

### Root Package.json

```json
{
  "name": "link-station",
  "scripts": {
    "start": "node server.js",
    "build": "cd client && npm install && npm run build",
    "vercel-build": "cd client && npm install && npm run build"
  },
  "dependencies": {
    "express": "^4.18.2"
  }
}
```

---

## 🌐 Environment & URLs

### Production
- **URL**: https://link-station-pro.vercel.app
- **API**: https://link-station-pro.vercel.app/api/...
- **Region**: Auto-selected by Vercel

### Local Development
- **Frontend**: `http://localhost:3000` (React dev server)
- **Backend**: `http://localhost:3002` (Express server)
- **API Base**: Auto-detected in `App.js`:
  ```javascript
  const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3002' 
    : '';
  ```

---

## 📦 Dependencies

### Frontend (client/package.json)
- `react` ^19.1.1
- `react-dom` ^19.1.1  
- `react-scripts` 5.0.1
- `qrcode.react` ^4.2.0
- `web-vitals` ^2.1.4

### Backend (package.json)
- `express` ^4.18.2

**No Socket.IO** - Removed due to Vercel serverless limitations

---

## 🔍 Troubleshooting Deployment

### Issue: Blank Page / 404 Errors

**Cause**: Static files not in correct location  
**Solution**:
1. Verify `homepage: "."` in `client/package.json`
2. Ensure files copied to root: `index.html`, `static/`
3. Check Vercel build logs for errors

### Issue: API Not Working

**Cause**: API routes not configured properly  
**Solution**:
1. Verify `api/game.js` exists and exports `app`
2. Check `vercel.json` has correct rewrites
3. Test API endpoint: `https://link-station-pro.vercel.app/api/room/test`

### Issue: Build Failures

**Cause**: Dependencies or build script errors  
**Solution**:
1. Run `npm install` in both root and `client/` directories
2. Test build locally: `cd client && npm run build`
3. Check for missing dependencies or syntax errors
4. Review Vercel build logs

### Issue: Old Version Showing

**Cause**: Vercel cache or deployment not triggered  
**Solution**:
1. Verify git push succeeded: `git log --oneline`
2. Check Vercel dashboard for deployment status
3. Hard refresh browser: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
4. Manually redeploy from Vercel dashboard if needed

---

## 🚦 Pre-Deployment Checklist

### Before Pushing to Production

- [ ] **Local Testing**: Test all features locally
- [ ] **Build Success**: Run `npm run build` without errors
- [ ] **Multi-device Test**: Verify on 2+ devices
- [ ] **Console Clean**: No critical errors in browser console
- [ ] **API Validation**: All endpoints working
- [ ] **State Flow**: Test complete 8-state flow
- [ ] **Real-time Updates**: Verify polling works
- [ ] **Master Controls**: Test kick and start game
- [ ] **QR Code**: Verify QR joining works

### After Deployment

- [ ] **URL Check**: Visit https://link-station-pro.vercel.app
- [ ] **Page Load**: Verify no blank page or 404s
- [ ] **Full Flow Test**: Create room → invite users → play game
- [ ] **Multi-device**: Test with 2-3 devices
- [ ] **Console Review**: Check for any production errors

---

## 📊 Vercel Dashboard

### Accessing Your Deployment

1. **Login**: https://vercel.com/dashboard
2. **Project**: Find "link-station-pro"
3. **Deployments**: View history and logs
4. **Settings**: Configure domains, environment variables

### Useful Vercel Features

- **Real-time Logs**: View function execution logs
- **Analytics**: Track page views and performance
- **Domains**: Add custom domains
- **Environment Variables**: Store secrets (if needed)

---

## 🔄 CI/CD Workflow

### Automatic Deployment

1. **Code Changes**: Edit files locally
2. **Build**: Run build process
3. **Commit**: `git add . && git commit -m "message"`
4. **Push**: `git push origin main`
5. **Auto-Deploy**: Vercel detects push and deploys
6. **Live**: Changes appear at production URL

### Manual Deployment (Vercel CLI)

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

---

## 🛡️ Production Considerations

### Performance
- **Static Assets**: Served via Vercel CDN (fast globally)
- **API Functions**: Serverless (auto-scales)
- **Build Size**: ~70KB gzipped (React app)
- **Cold Start**: ~500ms for first API call

### Limitations
- **In-memory Storage**: Data lost on function restart
- **Serverless Timeout**: 10-second max execution (Hobby plan)
- **No WebSockets**: Using polling instead
- **Regional**: Functions may run in different regions

### Recommendations
- **Database**: Add PostgreSQL/MongoDB for persistence
- **Caching**: Implement Redis for session data
- **Monitoring**: Add error tracking (Sentry, LogRocket)
- **Scaling**: Upgrade Vercel plan if needed

---

## 🔐 Security Notes

### Current Setup
- No authentication or authorization
- In-memory storage (no data persistence)
- Client-side routing (no server-side protection)
- CORS enabled for all origins (development)

### Production Hardening
- [ ] Add rate limiting to API endpoints
- [ ] Implement user authentication
- [ ] Add CSRF protection
- [ ] Restrict CORS to specific origins
- [ ] Sanitize all user inputs server-side
- [ ] Add request validation middleware

---

## 📝 Deployment Log

### October 2025 - Latest
- ✅ Voting status display fixes
- ✅ Result broadcasting improvements
- ✅ Enhanced API debugging
- ✅ Documentation consolidation

### Earlier Deployments
- ✅ Kicked user redirect functionality
- ✅ Master kick feature
- ✅ Auto-hiding notifications
- ✅ QR code routing fixes
- ✅ 8-state flow implementation
- ✅ API migration from Socket.IO
- ✅ Initial Vercel deployment

---

## 🆘 Support

### Common Commands

```bash
# View Vercel logs
vercel logs [deployment-url]

# List deployments
vercel ls

# Remove deployment
vercel rm [deployment-url]

# Check Vercel status
vercel whoami
```

### Resources
- **Vercel Docs**: https://vercel.com/docs
- **React Build**: https://create-react-app.dev/docs/deployment/
- **Serverless Functions**: https://vercel.com/docs/functions

### Getting Help
- Check Vercel build logs for errors
- Review browser console for client errors
- Test API endpoints directly via Postman/curl
- See PROJECT_CONTEXT.md for architecture details

---

**Status**: ✅ Deployment Pipeline Working  
**Auto-Deploy**: Enabled via GitHub  
**Next Steps**: Monitor production and add features as needed
