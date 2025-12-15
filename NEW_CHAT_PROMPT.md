# 🔗 Link Station - AI Assistant Context Handover

**Copy and paste this into a new AI chat session to continue development with full context.**

---

## 📋 Project Quick Reference

**Name**: Link Station  
**Type**: Real-time matching game web application  
**Live URL**: https://link-station-pro.vercel.app  
**Status**: ✅ Active Development - Shared Redis Storage + Warning System Stable

---

## ✅ **RECENT IMPROVEMENTS - SUCCESSFULLY IMPLEMENTED**

### **Session 15: Shared Redis State & Stability** (November 2025)
- **Problem Solved**: Rooms/users stored per-instance causing phantom deletions & forced logouts
- **Solution**: Integrated Upstash Redis + new `api/storage.js` layer so every serverless instance shares the same state
- **Highlights**:
  - All endpoints (`create/join/leave/select/...`) now use async Redis-backed storage
  - Cleanup + warning system run against shared data; room deletions tracked via TTL markers
  - New environment variables: `UPSTASH_REDIS_KV_REST_API_URL`, `UPSTASH_REDIS_KV_REST_API_TOKEN`, etc.
- **Benefits**:
  - ✅ No more room disappearing/reappearing when instances change
  - ✅ User sessions survive instance switching (no surprise logouts)
  - ✅ Deployment-ready instructions for Upstash (production) with local memory fallback

### **Session 15b: Admin Cleanup & Tab-Close Username Freeing** (December 2025 - Latest)
- **Problem Solved**: Stuck usernames/rooms in storage and usernames staying locked after tab close
- **Solution**:
  - Added **admin-only** `POST /api/manual-cleanup` endpoint secured with `ADMIN_SECRET_KEY`
  - Owner can:
    - Remove a single active username (and detach it from its room)
    - Delete a specific room and all its users
    - Force-run full inactive-user + empty-room cleanup on demand
  - Frontend now uses `beforeunload`/`pagehide` + `navigator.sendBeacon()` to call `/api/remove-user` when a tab truly closes
- **Benefits**:
  - ✅ Owner-only manual cleanup tool (not exposed to normal users)
  - ✅ Usernames become reusable immediately after closing the browser tab
  - ✅ Background tabs remain safe (heartbeat keeps usernames reserved)

### **Session 14: Warning System & Room Management** (November 2025)
- **Problems Solved**: 
  1. Rooms disappearing during active games
  2. No warning before user/room timeout
  3. No notification for kicks or disconnections
- **Major Features Added**:
  - ⚠️ **Inactivity Warnings**: 1-minute warning before user (30min) and room (2h) timeouts
  - 🛡️ **Room Activity Tracking**: Prevents deletion during active games
  - 🚨 **Unexpected Event Alerts**: Kick, disconnection, and room deletion notifications
  - 👥 **Observer/Attender System**: StarCraft-style role selection (observers watch, attenders vote)
- **Recent Refinements** (Session 14b):
  - Fixed disconnection flow: Auto-logout goes to `registerName` (clears username)
  - Improved messages: Regular users told "방을 유지하려면 방장에게 알려주세요"
  - Cleaner button text: "로그아웃" instead of "바로 로그아웃"
- **New API Endpoints**: `/api/check-warning`, `/api/keep-alive-user`, `/api/keep-alive-room`, `/api/change-role`, `/api/return-to-waiting`
- **Benefits**:
  - ✅ No more surprise disconnections
  - ✅ Rooms don't disappear during games
  - ✅ Clear feedback for all events
  - ✅ Clear distinction: voluntary exit vs forced logout

### **Session 13: State Flow Improvements** (October 2025)
- **Problem Solved**: Username persistence causing duplication errors
- **Solution**: Added `makeOrJoinRoom` bridge state, renamed states, proper cleanup
- **Status**: ✅ RESOLVED - Users can play multiple rounds without re-entering nickname

---

## 🎯 What You Need to Know

I'm working on **Link Station**, a multi-device real-time matching game where users join rooms, select each other, and form pairs. The app has a 9-state flow from name registration to match results.

### Tech Stack
- **Frontend**: React 19.1.1 (client/src/App.js)
- **Backend**: Node.js + Express API (api/game.js)
- **Storage**: Upstash Redis (shared room/user state), in-memory fallback for local dev
- **Deployment**: Vercel (serverless + static)
- **Real-time**: Polling-based updates (2-5 sec intervals)

### Current Architecture
- React app served from root (`index.html`, `static/`)
- API functions in `api/game.js` (serverless)
- Shared state via Upstash Redis (`api/storage.js` abstraction)
- Local development fallback keeps previous Map-based in-memory storage
- No WebSockets (using REST + polling)

### Environment Variables (Vercel)
- `UPSTASH_REDIS_KV_REST_API_URL`
- `UPSTASH_REDIS_KV_REST_API_TOKEN`
- `UPSTASH_REDIS_KV_URL` (Upstash dashboard convenience)
- `UPSTASH_REDIS_REDIS_URL`
- `UPSTASH_REDIS_KV_REST_API_READ_ONLY_TOKEN` (optional for future read-only ops)
- `ADMIN_SECRET_KEY` (required to access `/api/manual-cleanup`; shared only with owner)
> For local development without these values, the backend automatically falls back to in-memory storage.

---

## 📁 Critical Files to Review

**MUST READ FIRST**:
1. **PROJECT_CONTEXT.md** - Complete development history, architecture, all bug fixes, and technical decisions

**Reference as Needed**:
2. **client/src/App.js** - Main React component (1109 lines, 8-state flow)
3. **api/game.js** - Serverless API with all endpoints
4. **client/src/App.css** - Complete styling
5. **vercel.json** - Deployment configuration

---

## 🎮 9-State Flow Overview (Updated)

1. **RegisterName** (formerly Enter) - Username registration only
2. **MakeOrJoinRoom** (NEW) - Bridge state: choose make/join/exit
3. **MakeRoom** - Create room with name, password, member limit
4. **JoinRoom** (formerly EnterRoom) - Join room by name
5. **CheckPassword** - Password verification for protected rooms
6. **JoinRoomWithQR** (formerly EnterroomwithQR) - Join via QR code
7. **WaitingRoom** - Pre-game lobby with master controls
8. **Linking** - Active matching/voting phase
9. **LinkResult** - Display match results (now returns to WaitingRoom)

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
- `POST /api/return-to-waiting` - Return to waiting room after results

**User Management**:
- `POST /api/ping` - Heartbeat to keep connection alive (every 5min)
- `POST /api/check-warning` - Check for timeout warnings (every 10s)
- `POST /api/keep-alive-user` - Extend user session
- `POST /api/keep-alive-room` - Extend room lifetime
- `POST /api/remove-user` - Clean up username on exit

**Role System**:
- `POST /api/change-role` - Switch between attender/observer

---

## ✅ Latest Status (November 2025)

### What's Working
- ✅ Complete 9-state flow (registerName → makeOrJoinRoom → game → results → back to waitingroom)
- ✅ Inactivity warning system (user & room warnings 1min before timeout)
- ✅ Room activity tracking (prevents disappearing during games)
- ✅ Observer/Attender system (flexible role selection)
- ✅ Unexpected event alerts (kick, disconnection, room deletion)
- ✅ Room creation and joining
- ✅ Master controls (kick, start game, extend room)
- ✅ QR code sharing with proper routing
- ✅ Auto-hiding notifications (3s success, 5s error)
- ✅ User disconnect detection and cleanup (30min timeout)
- ✅ Zombie room cleanup (2h timeout)
- ✅ Enhanced UI with 3-space indicators (Master, Selection, Voting Status)
- ✅ Shared Redis storage keeps rooms/users consistent across all Vercel instances

### Current Critical Bugs
**NONE** - All known issues have been resolved!

### 🎯 Important Behavioral Notes

**Timeout Behavior:**
- **User Timeout (30min)**: Users disconnected if no heartbeat (tabs closed/sleeping)
- **Room Timeout (2h)**: Rooms deleted if no game actions (tabs open but passive)
- **Key Difference**: Heartbeat keeps USERS alive, game actions keep ROOMS alive
- **Zombie Rooms**: Users with tabs open but doing nothing → room deleted after 2h, users keep username

**Exit vs Logout:**
- **"방 나가기"** (Leave Room): Keep username → go to `makeOrJoinRoom`
- **"나가기"** (Logout): Clear username → go to `registerName`
- **Auto-disconnect**: Clear username → go to `registerName` (forced logout)

**Warning Messages:**
- **Master**: Can click "방 유지" to extend room lifetime
- **Regular Users**: See message "방을 유지하려면 방장에게 알려주세요"

### Known Limitations
- Requires Upstash Redis credentials in production (local dev falls back to memory)
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

## 🐛 Current Critical Issues (Requires Fundamental Fix)

**Problem**: Polling system is fundamentally broken despite multiple comprehensive fixes

**Evidence**:
- Multiple fix attempts have been made with no success
- Issues persist across all users (including master)
- Real-time updates completely non-functional
- Results never shown to any user

**Investigation Needed**:
1. **Fundamental polling architecture review** - Current approach may be fundamentally flawed
2. **Alternative real-time solutions** - Consider WebSockets or Server-Sent Events
3. **Simplified state management** - Current state management may be too complex
4. **API response structure** - May need to redesign how data is returned

---

## 💡 Development Context

### Why This Architecture?
- **No WebSockets**: Vercel serverless doesn't support persistent connections
- **Polling**: Provides near real-time experience (2-5 sec updates)
- **Static Root**: Simplifies Vercel deployment and CDN serving
- **Upstash Redis**: Shared storage across serverless instances (with in-memory fallback locally)

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

### If polling doesn't work at all:
1. Check if `pollingInterval.current` is not null
2. Verify `currentState` is correct for polling
3. Check for JavaScript errors in console
4. Ensure API endpoints are responding correctly

### If users don't see results:
1. Check if polling is running on all devices
2. Verify `gameState` changes to 'completed' in API
3. Ensure `matchResult` is returned in `/api/room/:roomId`
4. Check if results are being detected by polling logic

### If vote status doesn't update:
1. Check if polling is active during voting phase
2. Verify API returns correct `hasVoted` status
3. Ensure frontend updates `users` state with new data
4. Check if UI is re-rendering with updated state

---

## 📚 How to Use This Context

1. **Read PROJECT_CONTEXT.md first** - It has everything (50+ sections, complete history)
2. **Check current files** - Review App.js and api/game.js for latest code
3. **Understand polling** - Most real-time features work via polling
4. **Test multi-device** - Always verify on 2+ devices for synchronization

---

## 🎯 Your First Steps

When starting a new session:

1. **Verify shared Redis storage** - Test multi-tab/device flows to confirm rooms/users stay consistent
2. **Review cleanup & warning logs** - Ensure inactivity deletion markers behave as expected
3. **Plan next gameplay improvements** - (e.g., persistent history, analytics, UX polish)
4. **Monitor Upstash usage** - Track key counts/TTL to avoid unexpected limits

---

## 📝 Current Todos (High Priority)

- [ ] Load-test Redis integration under concurrent joins/selects
- [ ] Add metrics/logging around cleanup jobs and TTL expirations
- [ ] Evaluate storing match history or analytics (future enhancement)

---

## 🔄 Context Refresh

This prompt was created at **~89% context usage** to allow seamless continuation of development. All critical information from previous sessions is preserved in:
- **PROJECT_CONTEXT.md** (comprehensive)
- **DEPLOYMENT.md** (deployment-specific)

---

**You are now fully briefed on Link Station! Shared Redis storage is live—focus on monitoring and extending the experience.**

Ask the user: *"I've reviewed the new Redis-backed room management. Would you like me to run verification tests or prioritize the next feature (e.g., persistent history, analytics, or UX polish)?"*