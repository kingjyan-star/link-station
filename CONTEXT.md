# 🔗 Link Station - Complete Context

**Live URL:** https://link-station-pro.vercel.app  
**Last Updated:** January 2026  
**Status:** ✅ Active - Session 18 fixes + VSA auth extraction complete

---

## 🚀 Quick Start

**New chat?** Copy this: *"Read CONTEXT.md, project_config.md, and ARCHITECTURE.md. [Your task]"*

**Deploy:** See [Deployment](#-deployment) section below.

---

## 📦 New Chat Prompt (Copy-Paste)

```
Read CONTEXT.md, project_config.md, and ARCHITECTURE.md.
Follow their rules. Then: [describe your task]
```

---

## 🚀 Deployment

### Build & Deploy (Windows)

```powershell
cd client
npm run build
cd ..
copy client\build\index.html index.html
xcopy client\build\static static /E /I /Y
git add .
git commit -m "Your message"
git push origin main
```

Vercel auto-deploys on push to main.

### Verify After Deploy

1. Browser console → `🔗 Link Station v18 loaded`
2. Join room, press F5 → should stay in room
3. 2+ users → all see each other immediately

### Environment Variables (Vercel)

| Name | Purpose |
|------|---------|
| `UPSTASH_REDIS_KV_REST_API_URL` | REST endpoint for Upstash Redis |
| `UPSTASH_REDIS_KV_REST_API_TOKEN` | Auth token for Redis |
| `ADMIN_SECRET_KEY` | Initial admin password / manual-cleanup secret |

**Setup:** Vercel Dashboard → Storage → Upstash Redis → Connect Project. Add `ADMIN_SECRET_KEY` in Environment Variables.

### Troubleshooting

- **404 on static assets:** Ensure `static/` copied to root, `homepage: "."` in client/package.json
- **API not working:** Check `vercel.json` rewrites, `api/game.js` exports
- **Build fails:** Check Node version, dependencies, Vercel logs

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
- **Upstash Redis** - Shared room/user state across serverless instances
- **In-memory fallback** - Local development without Redis credentials

### Deployment
- **Vercel** - Hosting platform
- **Serverless Functions** - API endpoints (`/api/game.js`)
- **Static Build** - React served from root directory

---

## 🎮 Complete 9-State Flow

### 1. **RegisterName State**
- **Purpose**: Initial entry point for username registration
- **Inputs**: Username (max 32 chars)
- **Validation**: Blank check, duplication check
- **Actions**: "계속하기" (Continue) → goes to MakeOrJoinRoom state
- **VSA:** Extracted to `features/auth/RegisterName.jsx`

### 2. **MakeOrJoinRoom State**
- **Purpose**: Central hub for room actions
- **Display**: "안녕하세요, [username]님!"
- **Actions**: "방 만들기", "방 참여하기", "나가기" (removes username, returns to RegisterName)

### 3. **MakeRoom State**
- **Purpose**: Create new room
- **Inputs**: Room name (max 128), password (optional, max 16), member limit (2-99)
- **Success**: Redirects to WaitingRoom as master

### 4. **JoinRoom State**
- **Purpose**: Join existing room by name
- **Flow**: Auto-redirects to CheckPassword if room has password

### 5. **CheckPassword State**
- **Purpose**: Verify password for protected rooms

### 6. **JoinRoomWithQR State**
- **Purpose**: Join room via QR code (`?room=roomId`)
- **Features**: Bypasses password requirement

### 7. **WaitingRoom State**
- **Purpose**: Pre-game lobby
- **Display**: User list, master badge, QR code
- **Master Controls**: Kick users, start game
- **Polling**: 5-second intervals

### 8. **Linking State**
- **Purpose**: Active matching phase
- **Polling**: 2-second intervals
- **Auto-transition**: When all vote → LinkResult

### 9. **LinkResult State**
- **Purpose**: Show matching results
- **Actions**: "다음 라운드" or "방 나가기" → both return to WaitingRoom

---

## 🏗️ Architecture & File Structure

```
link-station/
├── index.html, static/         # Built React assets
├── api/game.js, storage.js     # Serverless API
├── client/src/
│   ├── App.js                  # Orchestrator (migration in progress)
│   ├── shared/                 # API client, session, utils
│   └── features/               # VSA slices (auth extracted)
│       ├── auth/               # RegisterName
│       └── ...                 # Other slices scaffolded
├── ARCHITECTURE.md             # VSA routing guide
├── CONTEXT.md                  # This file
└── project_config.md           # Global directives
```

---

## 🔧 API Endpoints (Summary)

**Auth:** `POST /api/check-username`  
**Room:** `POST /api/create-room`, `join-room`, `join-room-qr`, `check-password`  
**Game:** `POST /api/start-game`, `select`, `GET /api/room/:roomId`, `return-to-waiting`  
**User:** `POST /api/kick-user`, `leave-room`, `remove-user`, `ping`  
**Warnings:** `POST /api/check-warning`, `keep-alive-user`, `keep-alive-room`  
**Role:** `POST /api/change-role`  
**Admin:** `POST /api/admin-*` (login, status, kick, delete, cleanup, shutdown, change-password)  

Full details in `api/API_ROUTES.md`.

---

## 🐛 Recent Sessions (Condensed)

### Session 18 (January 2026) - Polling, Session, beforeunload
- **Fixes:** Polling closure (refs sync), beforeunload skip on refresh, session persistence, password toggle
- **Status:** Implemented, pending deploy

### Session 17 (January 2026) - Unified Markers, Admin UI
- **Fixes:** Single alert per event, correct kick messages, "대기실로 돌아가기" first-click, modern admin UI

### VSA Auth Extraction (January 2026)
- **Extracted:** `features/auth/RegisterName.jsx`, `shared/api`, `shared/session`, `shared/utils/validateUsername`
- **App.js:** Imports auth component, shared modules

---

## 🐛 Complete Bug Fix History

*(Abbreviated - full history preserved in git)*

- **Sessions 1-4:** Deployment, Socket→REST, user IDs, result broadcasting
- **Sessions 5-10:** Game state, waiting room, QR, kick, voting badges
- **Session 11:** Linking UI, result detection
- **Session 12:** Polling closure bug (refs in useEffect)
- **Session 13:** State flow (makeOrJoinRoom, exit cleanup)
- **Session 14:** Warning system, room activity, observer/attender
- **Session 14b:** UX refinements, timeout behavior
- **Session 15:** Upstash Redis shared state
- **Session 15b:** Manual cleanup, tab-close username free
- **Session 16:** Admin dashboard (status, cleanup, shutdown, password)
- **Session 17:** Unified marker system, admin UI modernization
- **Session 18:** Polling fix, session recovery, beforeunload fix, password toggle

---

## 🎯 Key Behavioral Notes

**Timeout:** User 30min (heartbeat), Room 2h (game actions)  
**Exit vs Logout:** "방 나가기" keeps username → makeOrJoinRoom; "나가기" clears → registerName  
**Kick reasons:** ADMIN/INACTIVITY → clear username; MASTER/ROOM_DELETED → keep username

---

## 📞 Related Files

- **ARCHITECTURE.md** - VSA structure, feature map
- **project_config.md** - Global coding rules
- **UPDATE_DOCS.md** - How to update this file

---

*This document is the single source of context for Link Station. Update it after major changes.*
