# 🔗 Link Station - AI Assistant Context Handover

**Copy and paste this into a new AI chat session to continue development with full context.**

---

## 📋 Project Quick Reference

**Name**: Link Station  
**Type**: Real-time matching game web application  
**Live URL**: https://link-station-pro.vercel.app  
**Status**: 🔧 In Progress - Critical Polling Bug Identified

---

## 🚨 **CRITICAL ISSUE - IMMEDIATE ATTENTION NEEDED**

### **Current Bug**: Polling Stops After All Users Vote
- **Symptoms**: Only first voter sees results, others stuck in linking state
- **Root Cause**: Polling interval stops on non-first voters after all vote
- **Evidence**: Network tab shows only heartbeat (ping) requests, no `/api/room/` polling
- **Impact**: Results not broadcast to all users

### **Testing Results**:
- **Voting Order**: 박수형 → 심상보 → 홍은주 → 김도희
- **박수형 (first voter)**: ✅ Sees results
- **심상보, 홍은주, 김도희**: ❌ Stuck in linking state, no polling
- **Network Evidence**: Only heartbeat requests visible, no room status polling

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
2. **client/src/App.js** - Main React component (1061 lines, 8-state flow)
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
- `POST /api/ping` - Heartbeat to keep connection alive

---

## ✅ Latest Status (October 2025)

### What's Working
- ✅ Complete 8-state flow
- ✅ Real-time polling (2-5 sec intervals) during voting
- ✅ Master controls (kick, start game)
- ✅ QR code sharing with proper routing
- ✅ Voting status display ("투표완료" vs "대기중")
- ✅ Auto-hiding notifications (3s success, 5s error)
- ✅ Room name duplication prevention
- ✅ User disconnect detection and cleanup

### Current Critical Bug
- ❌ **Polling stops after all users vote**
- ❌ **Only first voter sees results**
- ❌ **Other users stuck in linking state**
- ❌ **No result broadcasting to all users**

### Recent Fixes (October 2025)
1. **Room Duplication** - Fixed case-insensitive room name checking
2. **Connection Management** - Added heartbeat system and user cleanup
3. **Voting Status** - Fixed real-time voting status display during voting
4. **API Logging** - Added comprehensive debugging logs

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

## 🐛 Current Critical Issue (Requires Immediate Fix)

**Problem**: Polling stops after all users vote, preventing result broadcasting

**Evidence**:
- First voter (박수형) sees results immediately
- Other users (심상보, 홍은주, 김도희) stuck in linking state
- Network tab shows only heartbeat requests, no `/api/room/` polling
- Console shows no errors but polling has stopped

**Investigation Needed**:
1. Check why `pollingInterval` stops on non-first voters
2. Verify `currentState` remains 'linking' for all users
3. Ensure polling continues until `gameState === 'completed'`
4. Fix result broadcasting to all users

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

### If polling stops after voting:
1. Check if `currentState` is still 'linking'
2. Verify `pollingInterval.current` is not null
3. Check for JavaScript errors in console
4. Ensure polling continues until results received

### If users don't see results:
1. Check if polling is running on all devices
2. Verify `gameState` changes to 'completed' in API
3. Ensure `matchResult` is returned in `/api/room/:roomId`
4. Check polling logic detects completed state

### If master controls don't work:
1. Verify `masterId` matches user's `userId`
2. Check `isMaster` field in user objects
3. Ensure master badge visible to all users
4. Validate master-only endpoints check `masterId`

---

## 📚 How to Use This Context

1. **Read PROJECT_CONTEXT.md first** - It has everything (50+ sections, complete history)
2. **Check current files** - Review App.js and api/game.js for latest code
3. **Understand polling** - Most real-time features work via polling
4. **Test multi-device** - Always verify on 2+ devices for synchronization

---

## 🎯 Your First Steps

When starting a new session:

1. **Fix the polling bug** - This is the highest priority
2. **Test the fix** - Verify all users see results after voting
3. **Check for other issues** - Ensure no regressions
4. **Update documentation** - Record the fix in PROJECT_CONTEXT.md

---

## 📝 Current Todos (High Priority)

- [ ] **URGENT**: Fix polling continuation after all users vote
- [ ] **Test**: Verify all users see results simultaneously
- [ ] **Debug**: Check why polling stops on non-first voters
- [ ] **Future**: Consider database for persistent storage

---

## 🔄 Context Refresh

This prompt was created at **~97% context usage** to allow seamless continuation of development. All critical information from previous sessions is preserved in:
- **PROJECT_CONTEXT.md** (comprehensive)
- **DEPLOYMENT.md** (deployment-specific)

---

**You are now fully briefed on Link Station! The critical polling bug requires immediate attention.**

Ask the user: *"I understand the polling bug. Let me fix the issue where polling stops after all users vote, preventing result broadcasting to all users."*