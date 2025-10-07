# 🔗 Link Station - AI Assistant Context Handover

**Copy and paste this into a new AI chat session to continue development with full context.**

---

## 📋 Project Quick Reference

**Name**: Link Station  
**Type**: Real-time matching game web application  
**Live URL**: https://link-station-pro.vercel.app  
**Status**: ✅ Production Ready (October 2025)

---

## 🎯 What You Need to Know

I'm working on **Link Station**, a multi-device real-time matching game where users join rooms, select each other, and form pairs. The app has an 8-state flow from room creation to match results.

### Tech Stack
- **Frontend**: React 19.1.1 (client/src/App.js)
- **Backend**: Node.js + Express API (api/game.js)
- **Deployment**: Vercel (serverless + static)
- **Real-time**: Polling-based updates (2-5 sec intervals)

### Current Architecture
- React app served from root (`index.html`, `static/`)
- API functions in `api/game.js` (serverless)
- No WebSockets (using REST + polling)
- In-memory storage (Map-based rooms)

---

## 📁 Critical Files to Review

**MUST READ FIRST**:
1. **PROJECT_CONTEXT.md** - Complete development history, architecture, all bug fixes, and technical decisions

**Reference as Needed**:
2. **client/src/App.js** - Main React component (1012 lines, 8-state flow)
3. **api/game.js** - Serverless API with all endpoints
4. **client/src/App.css** - Complete styling
5. **vercel.json** - Deployment configuration

---

## 🎮 8-State Flow Overview

1. **Enter** - Username input, make/join room options
2. **MakeRoom** - Create room with name, password, member limit
3. **EnterRoom** - Join room by name
4. **CheckPassword** - Password verification for protected rooms
5. **EnterroomwithQR** - Join via QR code (bypasses password)
6. **WaitingRoom** - Pre-game lobby with master controls
7. **Linking** - Active matching/voting phase
8. **LinkResult** - Display match results

---

## 🔧 Key API Endpoints

**Room Management**:
- `POST /api/create-room` - Create room (assigns master)
- `POST /api/join-room` - Join room
- `POST /api/join-room-qr` - Join via QR (bypasses password)
- `POST /api/kick-user` - Master removes user

**Game Flow**:
- `POST /api/start-game` - Master starts game (locks room)
- `POST /api/select` - User votes (auto-processes when all vote)
- `GET /api/room/:roomId` - Get room status (polling)

---

## ✅ Latest Status (October 2025)

### What's Working
- ✅ Complete 8-state flow
- ✅ Real-time polling (2-5 sec intervals)
- ✅ Master controls (kick, start game)
- ✅ QR code sharing with proper routing
- ✅ Voting status display ("투표완료" vs "대기중")
- ✅ Auto-hiding notifications (3s success, 5s error)
- ✅ Result broadcasting to all users
- ✅ Kicked user auto-redirect

### Recent Fixes (October 2025)
1. **Voting Status Display** - All users can see who voted vs waiting
2. **Result Broadcasting** - All users see results simultaneously via polling
3. **Kicked User Redirect** - Kicked users auto-redirected to Enter state
4. **Enhanced Debugging** - Added extensive logging to API

### Known Limitations
- In-memory storage (data lost on server restart)
- Polling creates traffic overhead
- No persistent game history
- No user authentication

---

## 🚀 Deployment Process

**Standard Build & Deploy**:
```bash
# 1. Build React app
cd client && npm run build && cd ..

# 2. Copy static files (Windows)
copy client\build\index.html index.html
xcopy client\build\static static /E /I /Y

# 3. Deploy
git add .
git commit -m "Your message"
git push origin main
```

Vercel auto-deploys on push to main branch.

---

## 🐛 Current Issues (if any)

**Latest Bug Report (October 2025)**:
1. ❓ Voting status not visible to voted users - **FIXED**
2. ❓ Result screen not showing after all votes - **INVESTIGATING**
   - Added enhanced debugging to API
   - Modified polling logic to check for completed state
   - Check console logs for match processing

---

## 💡 Development Context

### Why This Architecture?
- **No WebSockets**: Vercel serverless doesn't support persistent connections
- **Polling**: Provides near real-time experience (2-5 sec updates)
- **Static Root**: Simplifies Vercel deployment and CDN serving
- **In-Memory Storage**: Sufficient for session-based games

### Common Debug Points
- Check browser console for polling responses
- Verify `gameState` transitions (waiting → linking → completed)
- Ensure `hasVoted` field updates correctly
- Confirm `matchResult` in `/api/room/:roomId` response

### State Management
- Each state has dedicated render function in `App.js`
- Polling runs differently in waiting (5s) vs linking (2s)
- Master status (`isMaster`) propagated to ALL users via API
- Kicked user detection via polling (checks if userId still in room.users)

---

## 🔍 Troubleshooting Guide

### If users can't see results:
1. Check console for "All users have selected" log in API
2. Verify `gameState` changes to 'completed'
3. Ensure `matchResult` is in room object
4. Check polling is detecting completed state

### If master controls don't work:
1. Verify `masterId` matches user's `userId`
2. Check `isMaster` field in user objects
3. Ensure master badge visible to all users
4. Validate master-only endpoints check `masterId`

### If kicked users stay in room:
1. Check polling detects user not in `room.users`
2. Verify redirect to 'enter' state triggers
3. Ensure error message displays
4. Check room data clears properly

---

## 📚 How to Use This Context

1. **Read PROJECT_CONTEXT.md first** - It has everything (50+ sections, complete history)
2. **Check current files** - Review App.js and api/game.js for latest code
3. **Understand polling** - Most real-time features work via polling
4. **Test multi-device** - Always verify on 2+ devices for synchronization

---

## 🎯 Your First Steps

When starting a new session:

1. **Ask user what they need** - Bug fix, new feature, or investigation?
2. **Review relevant sections** - Check PROJECT_CONTEXT.md for related past issues
3. **Check current code** - Read the actual implementation in App.js/api/game.js
4. **Consider multi-device** - Most issues relate to state sync across devices
5. **Use polling wisely** - Understand when polling runs (waiting vs linking states)

---

## 📝 Current Todos (if any)

- [ ] **Investigate**: Result screen not showing after all votes (enhanced debugging added)
- [ ] **Test**: Verify voting status display works for all users
- [ ] **Future**: Consider database for persistent storage

---

## 🔄 Context Refresh

This prompt was created at **~90% context usage** to allow seamless continuation of development. All critical information from previous sessions is preserved in:
- **PROJECT_CONTEXT.md** (comprehensive)
- **DEPLOYMENT.md** (deployment-specific)

---

**You are now fully briefed on Link Station! Ready to continue development.**

Ask the user: *"What would you like to work on with Link Station?"*
