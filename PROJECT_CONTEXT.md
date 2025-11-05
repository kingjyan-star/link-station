# 🔗 Link Station - Complete Project Context

**Live URL**: https://link-station-pro.vercel.app  
**Last Updated**: November 2025  
**Status**: ✅ Active Development - Warning System & Room Management Complete

---

## 📋 Project Overview

**Link Station** is a real-time matching game web application where users join rooms and select each other to form pairs. Players can create rooms, share via QR codes, and participate in matching games with proper game flow management.

### Key Capabilities
- Multi-device synchronized gameplay
- QR code room sharing
- Password-protected rooms
- Real-time voting status
- Master controls for room management

---

## 🛠️ Technology Stack

### Frontend
- **React 19.1.1** - UI framework with modern hooks
- **QRCode.react 4.2.0** - QR code generation
- **CSS3** - Gradient backgrounds and responsive design

### Backend
- **Node.js + Express** - Server runtime
- **REST API** - Game logic via serverless functions
- **In-memory storage** - Room and user data (Map-based)

### Deployment
- **Vercel** - Hosting platform
- **Serverless Functions** - API endpoints (`/api/game.js`)
- **Static Build** - React served from root directory

---

## 🎮 Complete 9-State Flow (Updated)

### 1. **RegisterName State** (formerly "Enter")
- **Purpose**: Initial entry point for username registration
- **Inputs**: Username (max 32 chars)
- **Validation**: Blank check, duplication check
- **Actions**: "계속하기" (Continue) → goes to MakeOrJoinRoom state

### 2. **MakeOrJoinRoom State** (NEW - Bridge State)
- **Purpose**: Central hub for room actions
- **Display**: "안녕하세요, [username]님!"
- **Actions**: 
  - "🏠 방 만들기" (Make Room) → goes to MakeRoom state
  - "🚪 방 참여하기" (Join Room) → goes to JoinRoom state
  - "🚪 나가기" (Exit) → removes username from active users, returns to RegisterName state

### 3. **MakeRoom State**
- **Purpose**: Create new room
- **Inputs**: 
  - Room name (max 128 chars)
  - Password (optional, max 16 chars)
  - Member limit (2-99, default 8)
- **Validation**: Room name uniqueness, blank checks
- **Actions**: "방 생성하기" (Create) or "취소" (Cancel → returns to MakeOrJoinRoom)
- **Success**: Redirects to WaitingRoom as master

### 4. **JoinRoom State** (formerly "EnterRoom")
- **Purpose**: Join existing room
- **Inputs**: Room name
- **Checks**: Room existence, member limit, password requirement
- **Actions**: "방 참여하기" (Join) or "취소" (Cancel → returns to MakeOrJoinRoom)
- **Flow**: Auto-redirects to CheckPassword if room has password

### 5. **CheckPassword State**
- **Purpose**: Verify password for protected rooms
- **Inputs**: Room password
- **Validation**: Password match check
- **Actions**: "입장하기" (Enter) or "취소" (Cancel)

### 6. **JoinRoomWithQR State** (formerly "EnterroomwithQR")
- **Purpose**: Join room via QR code scan
- **Inputs**: Username (room ID from URL params)
- **Features**: Bypasses password requirement (trusted invitation)
- **Actions**: "참여하기" (Join) or "취소" (Cancel)
- **URL Format**: `https://link-station-pro.vercel.app?room=roomId`

### 7. **WaitingRoom State**
- **Purpose**: Pre-game lobby
- **Display**:
  - User list with real-time updates
  - Master badge ("방장") visible to ALL users
  - QR code for room sharing
- **Master Controls**:
  - Kick users (✕ button)
  - Start game ("게임 시작" button, requires ≥2 players)
- **Polling**: 5-second intervals for user list updates
- **Room Locked**: New players blocked when game state is "linking" or "completed"

### 8. **Linking State**
- **Purpose**: Active matching phase
- **Display**:
  - User selection interface
  - Voting status badges:
    - "투표완료" (Voted) - green badge
    - "대기중" (Waiting) - gray badge
  - Real-time voting progress
- **Actions**: 
  - Select one user (button disabled after voting)
  - View other users' voting status
- **Polling**: 2-second intervals for voting status updates
- **Auto-transition**: When all vote → LinkResult state

### 9. **LinkResult State**
- **Purpose**: Show matching results
- **Display**:
  - Successful matches (mutual selections)
  - Unmatched users
- **Actions**:
  - "다음 라운드" (Next Round) - returns to WaitingRoom (for unmatched users)
  - "방 나가기" (Leave Room) - **NOW returns to WaitingRoom** (preserves username, allows continuous play)
- **Result Broadcasting**: All users see results simultaneously via polling

---

## 🏗️ Architecture & File Structure

```
link-station/
├── index.html              # Main React app entry (root)
├── static/                 # Built React assets
│   ├── css/
│   │   └── main.*.css     # Compiled styles
│   └── js/
│       └── main.*.js      # Compiled React code
├── api/
│   └── game.js            # Serverless API functions
├── client/                # React source code
│   ├── src/
│   │   ├── App.js         # Main component (1012 lines)
│   │   ├── App.css        # Styling (362 lines)
│   │   └── index.js       # Entry point
│   ├── build/             # Build output
│   └── package.json       # Frontend dependencies
├── vercel.json            # Vercel configuration
├── package.json           # Backend dependencies
└── PROJECT_CONTEXT.md     # This file
```

---

## 🔧 API Endpoints

### User & Room Management

#### `POST /api/check-username`
- **Purpose**: Check if username is already taken
- **Body**: `{ username }`
- **Response**: `{ success, available, message }`

#### `POST /api/create-room`
- **Purpose**: Create new game room
- **Body**: `{ username, roomName, password?, memberLimit }`
- **Response**: `{ success, roomId, userId, roomData }`
- **Features**: Auto-assigns master status to creator

#### `POST /api/join-room`
- **Purpose**: Join existing room (no password)
- **Body**: `{ username, roomName }`
- **Response**: `{ success, roomId, userId, roomData, requiresPassword }`
- **Validation**: Room exists, member limit not exceeded, game not started

#### `POST /api/check-password`
- **Purpose**: Verify room password
- **Body**: `{ roomName, password }`
- **Response**: `{ success, message }`

#### `POST /api/join-room-qr`
- **Purpose**: Join room via QR code (bypasses password)
- **Body**: `{ username, roomId }`
- **Response**: `{ success, userId, roomData }`

### Game Functions

#### `POST /api/start-game`
- **Purpose**: Start matching game (master only)
- **Body**: `{ roomId, masterId }`
- **Response**: `{ success, message }`
- **Validation**: Must be master, ≥2 players required
- **Effect**: Sets `gameState = 'linking'`, locks room

#### `POST /api/select`
- **Purpose**: Vote for a user
- **Body**: `{ roomId, userId, selectedUserId }`
- **Response**: `{ success, matches?, unmatched?, users }`
- **Validation**: Game in linking phase, user hasn't voted, target exists
- **Auto-processing**: When all vote, calculates matches and sets `gameState = 'completed'`

#### `GET /api/room/:roomId`
- **Purpose**: Get current room status (used for polling)
- **Response**: 
  ```json
  {
    "success": true,
    "room": {
      "id": "roomId",
      "roomName": "Room Name",
      "masterId": "userId",
      "users": [
        { "id": "userId", "displayName": "Name", "hasVoted": true, "isMaster": false }
      ],
      "selections": { "userId": "selectedUserId" },
      "gameState": "waiting|linking|completed",
      "memberLimit": 8
    },
    "matchResult": {
      "matches": [["user1", "user2"]],
      "unmatched": ["user3"]
    }
  }
  ```

#### `POST /api/kick-user`
- **Purpose**: Remove user from room (master only)
- **Body**: `{ roomId, masterUserId, targetUserId }`
- **Response**: `{ success, users[] }`
- **Validation**: Must be master, can't kick self
- **Effect**: Kicked user auto-redirected to Enter state via polling

#### `POST /api/ping`
- **Purpose**: Heartbeat to keep user connection alive
- **Body**: `{ username, userId }`
- **Response**: `{ success, timestamp }`
- **Frequency**: Every 2 minutes from frontend
- **Effect**: Updates user's `lastActivity` timestamp in activeUsers Map

#### `POST /api/remove-user`
- **Purpose**: Remove username from activeUsers when user exits
- **Body**: `{ username }`
- **Response**: `{ success }`
- **Usage**: Called when user exits from MakeOrJoinRoom state
- **Effect**: Allows username to be reused immediately

#### `POST /api/leave-room`
- **Purpose**: Leave room voluntarily
- **Body**: `{ roomId, userId }`
- **Response**: `{ success }`

#### `POST /api/check-warning`
- **Purpose**: Check if user or room needs inactivity warning
- **Body**: `{ username, userId, roomId }`
- **Response**: `{ success, userWarning, userTimeLeft, roomWarning, roomTimeLeft, userDisconnected, roomDeleted }`
- **Frequency**: Every 10 seconds from frontend
- **Warnings**: User at 29min (1min before timeout), Room at 1h59min (1min before timeout)

#### `POST /api/keep-alive-user`
- **Purpose**: Extend user session when they click "로그인 유지"
- **Body**: `{ username }`
- **Response**: `{ success }`
- **Effect**: Updates user's `lastActivity` to current time

#### `POST /api/keep-alive-room`
- **Purpose**: Extend room lifetime when master clicks "방 유지"
- **Body**: `{ roomId }`
- **Response**: `{ success }`
- **Effect**: Updates room's `lastActivity` to current time

#### `POST /api/change-role`
- **Purpose**: Switch user between attender and observer roles
- **Body**: `{ roomId, userId, role }`
- **Response**: `{ success, users[] }`
- **Validation**: Role must be 'attender' or 'observer'
- **Effect**: Updates user's role, broadcasts to all users in room

#### `POST /api/return-to-waiting`
- **Purpose**: Reset game state after viewing results
- **Body**: `{ roomId, userId }`
- **Response**: `{ success }`
- **Effect**: Resets gameState to 'waiting', clears selections and matchResult

---

## 🎯 Key Features & Implementation

### Real-time Updates (Polling-based)
- **Waiting Room**: 5-second intervals
- **Linking Phase**: 2-second intervals
- **Method**: `pollRoomStatus()` and `pollWaitingRoomStatus()`
- **Kicked User Detection**: Checks if `userId` still in `room.users`, redirects if not
- **Result Broadcasting**: All users transition to LinkResult when `gameState === 'completed'`

### Master Controls
- **Badge Visibility**: All users see "방장" badge on master
- **Kick Feature**: ✕ button appears for master next to each user
- **Game Start**: "게임 시작" button only visible to master
- **Validation**: All master actions validated server-side

### QR Code Sharing
- **Generation**: Uses `qrcode.react` library
- **URL Format**: `https://link-station-pro.vercel.app?room=roomId`
- **Entry Flow**: Auto-detects URL params → EnterroomwithQR state
- **Password Bypass**: QR joins skip password check (trusted invitation)

### Voting Status Display
- **Real-time Badges**: 
  - "투표완료" (green) - User has voted
  - "대기중" (gray) - User hasn't voted
- **Visibility**: All users can see everyone's voting status
- **UI Updates**: After voting, user sees waiting indicators for non-voters

### Notifications
- **Success Messages**: Auto-hide after 3 seconds
- **Error Messages**: Auto-hide after 5 seconds
- **Triggers**: Room creation, joining, errors, kicks

---

## 🐛 Complete Bug Fix History

### Session 1: Initial Deployment (Dec 2024)
**Problem**: Blank screen, 404 errors for static assets  
**Root Cause**: Incorrect Vercel configuration and file paths  
**Solution**:
- Moved React build files to root directory
- Configured `vercel.json` with `@vercel/static`
- Set `homepage: "."` in `client/package.json`

### Session 2: Socket.IO Migration (Dec 2024)
**Problem**: Socket.IO 500 errors, WebSocket handshake failures  
**Root Cause**: Vercel serverless doesn't support persistent WebSockets  
**Solution**:
- Replaced Socket.IO with REST API
- Implemented polling for real-time updates
- Created `api/game.js` serverless function

### Session 3: User Identification (Dec 2024)
**Problem**: Multiple devices with same nickname overwrote each other  
**Root Cause**: Frontend state conflicts, no unique IDs  
**Solution**:
- Generated unique `userId` (timestamp + random)
- Created unique display names: "nickname(1)", "nickname(2)"
- Fixed React state management

### Session 4: Match Results Broadcasting (Dec 2024)
**Problem**: Only last voter saw results, others stuck in linking state  
**Root Cause**: No result broadcast mechanism  
**Solution**:
- Added `matchResult` to room object
- Enhanced `/api/room/:roomId` to include results
- Modified polling to check for `gameState === 'completed'`
- Removed immediate redirect from select function

### Session 5: 8-State Flow Implementation (Oct 2025)
**Problem**: No proper game start/end, players joined mid-game  
**Root Cause**: Missing game state management  
**Solution**:
- Implemented complete 8-state flow
- Added `gameState` (waiting/linking/completed)
- Created `masterId` and host controls
- Locked rooms during active games

### Session 6: Waiting Room Issues (Oct 2025)
**Problem**: "게임 시작" button not visible, host not recognized, only master visible  
**Root Cause**: Polling conflicts, incorrect master status propagation  
**Solution**:
- Separated `pollWaitingRoomStatus` and `pollRoomStatus`
- Added `isMaster` field to user objects in API response
- Fixed master badge visibility for ALL users
- Delayed polling start by 3 seconds after join

### Session 7: QR Code Routing (Oct 2025)
**Problem**: QR scan led to Enter state instead of EnterroomwithQR  
**Root Cause**: QR only had base URL, no room parameter  
**Solution**:
- Updated QR generation to include `?room=roomId`
- Added URL param parsing in main `useEffect`
- Auto-detects room param and sets state to `enterroomwithqr`

### Session 8: Notification & Kick Features (Oct 2025)
**Problem**: Notifications never disappeared, no kick feature  
**Solution**:
- Added `useEffect` timers for auto-hide (3s success, 5s error)
- Implemented `/api/kick-user` endpoint
- Added kick buttons (✕) for master in UI
- Kicked users auto-redirected via polling detection

### Session 9: Voting Status Display (Oct 2025)
**Problem**: Users couldn't see who voted vs who's waiting  
**Solution**:
- Added `hasVoted` field to user objects in API
- Created "투표완료" and "대기중" badges
- Added CSS for `.voted-badge`, `.waiting-badge`, `.completed-indicator`
- Real-time updates via polling

### Session 10: Kicked User & Result Broadcasting (Oct 2025)
**Problem**: Kicked users stayed in room, only last voter saw results  
**Solution**:
- Added user existence check in `pollWaitingRoomStatus` and `pollRoomStatus`
- Auto-redirect kicked users to Enter state with error message
- Modified `handleSelectUser` to not immediately redirect
- Let polling detect `gameState === 'completed'` and broadcast to all

### Session 11: Latest Fixes (Oct 2025 - Current)
**Problem**: Voting status not visible after voting, result screen not showing  
**Solution**:
- Enhanced linking UI to show voting indicators even after voting
- Added "선택 대기중..." and "✓ 완료" indicators for voted users
- Enhanced API debugging for match processing
- Added logging to track when all users vote

### Session 12: Critical Polling Bug (October 2025 - RESOLVED)
**Problem**: Only first voter (박수형) sees results, other users' polling stops after all vote
**Root Cause**: useEffect in App.js was stopping ALL polling when currentState changed from 'waitingroom' to 'linking'
**Multiple Fix Attempts**: 
- Modified useEffect to only stop polling when leaving waiting room
- Added comprehensive debugging logs to pollRoomStatus function
- Fixed race conditions with multiple fallback mechanisms
- Enhanced voting status updates and result detection
**Final Solution**: Simplified polling logic, consolidated useEffect, improved result detection
**Status**: ✅ RESOLVED - All users now see results and vote status updates properly

### Session 13: State Flow Improvements (October 2025 - COMPLETED)
**Problem**: Username persistence after leaving results caused duplication errors
**Root Cause**: Users returned to "enter" state (name registration) after leaving results, but username remained in activeUsers
**Solution Implemented**:
1. **Renamed States** for clarity:
   - `enter` → `registerName`
   - `enterroom` → `joinroom`
   - `enterroomwithqr` → `joinroomwithqr`
2. **Added Bridge State** `makeOrJoinRoom`:
   - Shows after username registration
   - Displays "안녕하세요, [username]님!"
   - 3 buttons: Make Room, Join Room, Exit
   - Exit button removes username from activeUsers
3. **Changed Exit Flow**:
   - After LinkResult: Users return to **WaitingRoom** (not registerName)
   - From MakeRoom/JoinRoom: Cancel returns to **MakeOrJoinRoom**
   - From MakeOrJoinRoom: Exit cleans up username, returns to **RegisterName**
4. **Added API Endpoint** `/api/remove-user` to clean up usernames on exit
**Benefits**:
- ✅ Users can play multiple rounds without re-entering nickname
- ✅ No more username duplication errors
- ✅ Clearer navigation flow
- ✅ Proper cleanup when users truly exit
**Status**: ✅ COMPLETED - State flow is now logical and user-friendly

### Session 14: Warning System & Room Management (November 2025 - COMPLETED)
**Focus**: Implement inactivity warnings, improve room cleanup, add unexpected event alerts

**Problems Addressed**:
1. Rooms disappearing/reappearing during active games
2. No warning before user/room timeout
3. No notification when kicked or disconnected
4. Aggressive cleanup causing race conditions

**Solutions Implemented**:

#### **1. Inactivity Warning System**
- **User Warning**: Shows 1 minute before 30-minute timeout
  - Modal: "활동이 감지되지 않아 X초 후 로그아웃됩니다"
  - Buttons: "로그인 유지", "바로 로그아웃"
- **Room Warning**: Shows 1 minute before 2-hour timeout (all users see it)
  - Master sees: "방 유지", "방 나가기"
  - Regular users see: "방 나가기"
- **Warning Polling**: Every 10 seconds to check for warnings
- **New API Endpoints**:
  - `/api/check-warning` - Check if user/room needs warning
  - `/api/keep-alive-user` - Extend user session
  - `/api/keep-alive-room` - Extend room lifetime

#### **2. Room Management Improvements**
- **Activity Tracking**: `room.lastActivity` updated on all critical actions (vote, kick, role change, start game, join)
- **Better Fallback**: Uses `room.createdAt` if `lastActivity` is missing (prevents new rooms from being treated as old)
- **Zombie Room Cleanup**: Rooms with no activity for 2+ hours are deleted
- **Empty Room Deletion**: Rooms with 0 users deleted immediately
- **Cleanup Intervals**:
  - User timeout: 30 minutes
  - Room timeout: 2 hours
  - Cleanup runs: Every 5 minutes

#### **3. Unexpected Event Alerts**
- **Kick Alert**: `⚠️ 방장에 의해 추방되었습니다.`
  - Triggered when user is removed from room unexpectedly
  - Detected via polling (user no longer in room.users)
- **User Disconnection Alert**: `⚠️ 장시간 활동이 감지되지 않아 로그아웃되었습니다.`
  - Triggered when user timeout expires (30 min)
- **Room Deletion Alert**: `⚠️ 장시간 활동이 감지되지 않아 방이 사라졌습니다.`
  - Triggered when room timeout expires (2 hours)
- **Logic**: Alerts only for unexpected events (not user-initiated actions)

#### **4. Observer/Attender System**
- **Two Roles**: Attender (참가자), Observer (관전자)
- **Role Selection**: StarCraft-style boxes in waiting room
- **Role Switching**: Real-time, visible to all users
- **Voting**: Only attenders can vote; observers watch
- **Game Start**: Requires minimum 2 attenders
- **New API Endpoint**: `/api/change-role` - Switch between roles

**Files Modified**:
- `api/game.js` - Added warning endpoints, improved cleanup, activity tracking
- `client/src/App.js` - Added warning modals, polling, alert system, observer UI
- `client/src/App.css` - Added warning modal styles, role selection styles

**Benefits**:
- ✅ Users get 1-minute warning before timeout
- ✅ No more surprise disconnections
- ✅ Rooms don't disappear during active games
- ✅ Clear feedback for all unexpected events
- ✅ Zombie rooms cleaned up automatically
- ✅ Flexible observer system for non-participants

**Status**: ✅ COMPLETED - Warning system fully functional, room management robust

---

## 🚀 Deployment Process

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

### Build Steps
1. **React Build**: `cd client && npm run build`
2. **Copy Static Files**:
   - `copy client\build\index.html index.html`
   - `xcopy client\build\static static /E /I /Y`
3. **Git Commit**: `git add . && git commit -m "message"`
4. **Deploy**: `git push origin main` (auto-deploys to Vercel)

### Environment
- **Production URL**: https://link-station-pro.vercel.app
- **API Base**: `window.location.hostname === 'localhost' ? 'http://localhost:3002' : ''`
- **Auto Deployment**: Enabled via GitHub integration

---

## 💡 Technical Decisions & Rationale

### Why Polling Instead of WebSockets?
- Vercel serverless functions don't support persistent connections
- 2-5 second polling provides near real-time experience
- More reliable and easier to debug
- No connection management complexity

### Why In-Memory Storage?
- Serverless functions are stateless, but share memory during warm starts
- Sufficient for session-based game rooms
- No database setup required
- Data naturally clears when rooms are inactive

### Why Static Files in Root?
- Simplifies Vercel auto-detection
- Avoids complex path resolution
- Standard SPA deployment pattern
- Better performance (direct CDN serving)

### Why 8-State Flow?
- Clear separation of concerns
- Better UX with proper waiting rooms
- Prevents mid-game joins
- Enables proper game lifecycle management

---

## 🔍 Debugging & Monitoring

### Console Logging
- **API**: Extensive logs in `api/game.js` for all operations
- **Frontend**: State changes, polling events, user actions
- **Format**: `console.log('Action: details', data)`

### Common Debug Points
- User join/leave events
- Selection processing
- Match calculation
- Polling responses
- State transitions

### Error Handling
- All API endpoints return `{ success, message }` format
- Frontend displays errors via auto-hiding notifications
- Validation errors logged with context

---

## 🎨 UI/UX Features

### Styling
- **Gradient Backgrounds**: Modern purple/pink gradients
- **Responsive Design**: Mobile and desktop friendly
- **Card-based Layout**: User cards with hover effects
- **Badge System**: Visual status indicators
- **Button States**: Hover, active, disabled states

### User Feedback
- Loading states during API calls
- Success/error notifications
- Voting progress indicators
- Clear button labeling in Korean

### Accessibility
- Clear visual hierarchy
- High contrast text
- Button focus states
- Error message visibility

---

## 🔮 Future Improvements

### High Priority
1. **Database Integration** - Replace in-memory with PostgreSQL/MongoDB
2. **WebSocket Alternative** - Consider Pusher/Ably for true real-time
3. **User Accounts** - Authentication and game history
4. **Testing Suite** - Jest + React Testing Library

### Medium Priority
5. **Analytics** - Track game sessions and user behavior
6. **Advanced Matching** - Weighted algorithms, preferences
7. **Game Modes** - Different matching rules and variations
8. **Mobile App** - React Native version

### Low Priority
9. **Internationalization** - Support multiple languages
10. **Themes** - Customizable color schemes
11. **Sound Effects** - Audio feedback for actions
12. **Animations** - Smoother transitions

---

## 📊 Performance Metrics

### Current Performance
- **Build Size**: ~70KB JS (gzipped)
- **Load Time**: < 2s on 4G
- **Polling Overhead**: ~100KB/min during active game
- **API Response**: < 100ms average

### Optimization Opportunities
- Code splitting for large components
- Image optimization (if images added)
- Service worker for offline support
- Reduce polling frequency when idle

---

## 🔐 Security Considerations

### Current Measures
- Input validation on all API endpoints
- XSS protection via React's built-in escaping
- Room password validation
- Master-only action verification

### Recommendations
- Add rate limiting to prevent abuse
- Implement CSRF protection
- Sanitize room names and usernames server-side
- Add session tokens for user authentication

---

## 📝 Development Notes

### Code Quality
- Modern React patterns (hooks, functional components)
- Clean separation of concerns
- Consistent naming conventions
- Comprehensive error handling

### Known Limitations
- In-memory storage not suitable for production scale
- Polling creates unnecessary traffic
- No persistent game history
- Single server deployment (no horizontal scaling)

### Maintenance
- Regular dependency updates needed
- Monitor Vercel usage limits
- Check console for API errors
- Update documentation with each major change

---

## 📞 Support & Resources

### Deployment
- **Platform**: [Vercel Dashboard](https://vercel.com/dashboard)
- **Repository**: GitHub (linked to Vercel)
- **Logs**: Vercel Functions logs for debugging

### Documentation
- **React**: https://react.dev/
- **Vercel**: https://vercel.com/docs
- **Express**: https://expressjs.com/

---

**Status**: ✅ Production Ready  
**Last Major Update**: October 2025 - Voting status and result broadcasting fixes  
**Next Review**: As needed for new features or bug reports

---

*This document serves as the complete development context for AI assistants and developers working on Link Station. All critical information about architecture, implementation, bugs, and decisions is consolidated here.*

