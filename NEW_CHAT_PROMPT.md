# 🚀 New Cursor Chat Starter Prompt

## 📋 **Copy and paste into new chat:**

```
Hi! I need to continue working on my Link Station project. Here's the complete context:

## 🎯 Project Overview
**Link Station** - Real-time matching game web application
- **Live URL**: https://link-station-pro.vercel.app
- **Tech Stack**: React 19.1.1 + REST API + Vercel (migrated from Socket.IO)
- **Purpose**: Users join rooms, select each other, get matched in real-time

## 🏗️ Current Architecture
```
link-station/
├── index.html              # React app (served from root)
├── static/                 # CSS/JS assets
├── api/game.js            # Game API (serverless function)
├── client/                # React source code
└── vercel.json            # Vercel configuration
```

## ✅ Working Features
- **Multi-device room joining** with QR code sharing
- **Unique user identification** (prevents nickname conflicts)
- **Real-time selection process** (polling-based, 2-second intervals)
- **Synchronized match results** across all devices
- **Responsive design** for mobile and desktop

## 🔧 API Endpoints
- `POST /api/join` - Join room with nickname
- `POST /api/select` - Select another user for matching
- `GET /api/room/:roomId` - Get room status + match results

## 🐛 Major Issues Resolved
1. **404 errors** → Fixed static file serving
2. **Socket.IO compatibility** → Migrated to REST API + polling
3. **User conflicts** → Added unique display names (e.g., "박수형(1)")
4. **Match result broadcasting** → All devices see results via polling

## 🚨 Current Critical Issues (Last Session)
- ❌ **Waiting room not showing** - Players go directly to matching state
- ❌ **No "게임 시작" button visible** - Host detection failing
- ❌ **No match results** - Players select each other but no results shown
- ❌ **State management broken** - Polling overriding initial states

## 📊 Current Status
- ⚠️ **Partially functional** - Core matching logic works but UI flow broken
- ⚠️ **Multi-device issues** - State synchronization problems
- ❌ **Match results not working** - Selection works but results don't show
- ❌ **Waiting room broken** - Players skip waiting room phase

## 🎯 Potential Improvements
- Database integration (replace in-memory storage)
- User authentication system
- Game history and statistics
- Performance optimization

## 📝 Key Technical Details
- Uses polling (2s intervals) instead of WebSockets for real-time updates
- Static files served from root directory for Vercel compatibility
- Serverless functions handle API requests
- React app with QRCode.react for room sharing

## 🔧 Recent Debugging Added
- Debug panel in top-right corner showing state information
- Yellow debug box in waiting room showing host status
- Console logging for all state changes
- Detailed error tracking

## 🎯 Immediate Next Steps Needed
1. **Fix waiting room display** - Players should see waiting room, not matching
2. **Fix host detection** - First player should see "게임 시작" button
3. **Fix match results** - Results should display after selections
4. **Fix state management** - Polling should not override initial states

The project has core functionality but critical UI flow issues need immediate attention!

## 📚 Additional Context
For complete technical details, see `DEVELOPMENT_SUMMARY.md` in the project root.
```

## 💡 **사용 방법:**
1. 새로운 Cursor 채팅 시작
2. 위 프롬프트 전체를 복사
3. 새 채팅에 붙여넣기
4. 원하는 작업 요청하기

## 📝 **추가 컨텍스트 파일들:**
- `DEVELOPMENT_SUMMARY.md` - 상세 기술 문서
- `CHAT_HISTORY.md` - 개발 과정 기록
- `CURSOR_CONTEXT.md` - 간단한 컨텍스트

이 프롬프트를 사용하면 새로운 AI가 프로젝트의 전체 맥락을 이해하고 작업을 계속할 수 있습니다!
