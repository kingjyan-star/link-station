# 🔗 Link Station - Complete Context

**Live URL:** https://link-station-pro.vercel.app  
**Last Updated:** March 2026  
**Status:** ✅ v3.0.0 – Offline Party Mini-Game Platform. Telepathy + Liar Game.

---

## 🚀 Quick Start (New Chat)

**Rules load automatically** via `.cursor/rules/project-context.mdc` (Apply Intelligently + globs). No need to paste a prompt.

**Deploy:** See [Deployment](#-deployment) below.

---

## 📦 Manual Prompt (if rules don't load)

*"Read CONTEXT.md, project_config.md, and ARCHITECTURE.md. [Your task]"*

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

1. Browser console → `🔗 Link Station v3.0.0 loaded`
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

### Local API + Tab-close reclaim test

```powershell
# Terminal 1: API
node dev-server.js

# Terminal 2: Run API-level test
node scripts/test-tab-close-reclaim.js
```

---

## 📋 Project Overview

**Link Station** has evolved from a single matching game into an **Offline Party Mini-Game Platform** (오프라인 술자리 미니게임 플랫폼). It is focused on in-person, multi-device party and drinking games where friends gather in the same room and play together using their phones.

### Platform Vision
- **Offline-first:** Designed for parties, meetups, and 술자리 (drinking gatherings).
- **Multi-game:** Supports multiple mini-games (Telepathy Game, Liar Game, more to come).
- **Room-based:** Create/join rooms, share via QR, manage players as master.

### Key Capabilities
- Multi-device synchronized gameplay
- QR code room sharing
- Password-protected rooms
- Real-time voting status
- Master controls for room management
- Game selection in waiting room

---

## 🎮 Liar Game (라이어 게임 / 단어 마피아) – Rules & Fun

A **social deduction** game where all players except one (the **Liar**) receive a **Secret Word** (비밀 단어).

### Core Mechanics
- **Normal players:** Receive the Secret Word. Must say one sentence to prove they know it *without* revealing the exact word.
- **Liar:** Does not know the word. Must bluff to blend in while secretly trying to figure it out.
- **Voting:** Players vote who they think is the Liar. The most-voted becomes the "사형수" (condemned).
- **Final chance:** If the 사형수 is the Liar, they get one chance to guess the Secret Word. Correct guess → Liar wins.

### Fun Factor
- Normal players walk a tightrope: hint enough to prove they know, but not so much the Liar learns it.
- The Liar must listen carefully and bluff convincingly.

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
- **Display**: User list, master badge, QR code, user tags (대기중 / 결과 확인 중 after results), current game type
- **Master Controls**: 게임 선택 (Select Game: 텔레파시 / 라이어), kick users (with confirmation), start game
- **Polling**: 500ms (waiting), 2s (linking/result)

### 8. **Telepathy State** (텔레파시 게임)
- **Purpose**: Active matching phase
- **Polling**: 2-second intervals
- **Auto-transition**: When all vote → TelepathyResult

### 9. **TelepathyResult State**
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

### v3.0.0 (March 2026) - Offline Party Mini-Game Platform
- **Vision:** Evolved from single matching game to multi-game platform (오프라인 술자리 미니게임 플랫폼).
- **Liar Game:** New social deduction game (라이어 게임 / 단어 마피아) – rules and fun elements documented.
- **Version:** Bumped to v3.0.0 across package.json, CONTEXT.md, README.md, console log.
- **Step 2:** Renamed Linking→Telepathy, LinkResult→TelepathyResult. Added 게임 선택 (텔레파시/라이어) in waiting room. Kick confirmation modal. gameType in room; POST /api/set-game-type.
- **Step 3:** Liar game pre-game settings. 주제 (12 + 커스텀주제), 방식 (랜덤/커스텀). CSV `api/data/liar_words.csv`. api/liarWords.js utility. POST /api/set-liar-settings. 3-player min for Liar.

### v2.0.5 (March 2026) - Return-to-waiting tag fix
- **Tags:** Master returning first saw both "결과 확인 중"; tags swapped after other returned; refresh showed result instead of waiting room.
- **Fixes:** (1) pollRoomStatus: when hasCurrentUserReturned or gameState waiting + no matchResult → setCurrentState('waitingroom'); (2) session recovery: only restore to linkresult if user has NOT returned (check hasReturnedToWaiting); (3) optimistic setUsers: mark current user hasReturnedToWaiting on return; (4) API: clear returnedToWaiting when allReturned to avoid stale IDs; (5) session recovery fetch includes username query.

### Post-v2.0.4 (March 2026) - Sync fix, Room API hardening
- **Sync:** Added missing marker usage (wasUserKickedByAdmin/wasRoomDeletedByAdmin → use getMarker directly). Room API was crashing, breaking all polls.
- **Option B:** Removed helper functions; room endpoint uses getUserKickMarker/getRoomDeleteMarker inline.
- **Room API:** Wrap in try/catch; always return JSON (no HTML error pages). Defensive marker checks.
- **Poll:** Waiting room 1s → 500ms for faster user-list sync.

### v2.0.4 (March 2026) - Tab close unloadRef fix
- Fix: Sync unloadRef with username/roomId/userId so tab-close beacon actually sends data.
- Previously unloadRef was never updated, so beacon always exited early with empty payload.

### v2.0.3 (March 2026) - Tab close, room poll, button timeout
- **Tab close:** Beacon queues removal; 10s grace cancels on refresh, executes on real close.
- **Room poll:** Server Cache-Control no-store; client cache bust + 1s poll; poll on tab visible.
- **Buttons:** 15s fetch timeout for start-game/change-role – prevents stuck "게임 시작 중..".

### Session 18 (January 2026) - Polling, Session, beforeunload
- **Fixes:** Polling closure (refs sync), beforeunload skip on refresh, session persistence, password toggle
- **Status:** Implemented, pending deploy

### Session 17 (January 2026) - Unified Markers, Admin UI
- **Fixes:** Single alert per event, correct kick messages, "대기실로 돌아가기" first-click, modern admin UI

### VSA Auth Extraction (January 2026)
- **Extracted:** `features/auth/RegisterName.jsx`, `shared/api`, `shared/session`, `shared/utils/validateUsername`
- **App.js:** Imports auth component, shared modules

### Doc Restructuring (January 2026)
- **Merged:** PROJECT_CONTEXT + NEW_CHAT_PROMPT + DEPLOYMENT → CONTEXT.md
- **Created:** UPDATE_DOCS.md (replaced UPDATE_DOCS_GUIDE)
- **Deleted:** 4 explanation files (CODE_EXPLANATION, GLOBALTHIS, SERVER_INSTANCE, USER_ROOM_MANAGEMENT)
- **README:** Korean, merge conflict fixed

### Cursor Rules (January 2026)
- **project-context.mdc:** Apply Intelligently + globs. Instructs to read project_config, ARCHITECTURE, CONTEXT. Loads when task needs it or when editing project files.
- **link-station.mdc:** Feature-specific rules. Read features.md before editing a feature folder.

### Other (January 2026)
- **client/.npmrc:** `audit=false` to suppress CRA dev-dep vulnerability warnings during install.

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
- **v2.0.1:** Stale username/room reclaim, kick marker clear on room entry
- **v2.0.2:** Reclaim room when all users inactive (closed-tab case)
- **v2.0.4:** unloadRef sync fix (beacon now sends username on tab close)
- **v2.0.3:** Tab close beacon + 10s grace (nickname freed on close)

---

## 🎯 Key Behavioral Notes

**Timeout:** User 30min (heartbeat), Room 2h (game actions)  
**Exit vs Logout:** "방 나가기" keeps username → makeOrJoinRoom; "나가기" clears → registerName  
**Kick reasons:** ADMIN/INACTIVITY → clear username; MASTER/ROOM_DELETED → keep username

---

## 📞 Related Files

| File | Purpose |
|------|---------|
| **ARCHITECTURE.md** | VSA structure, feature map, routing |
| **project_config.md** | Global coding rules (4 Pillars, VSA) |
| **UPDATE_DOCS.md** | When/how to update docs |
| **.cursor/rules/project-context.mdc** | Auto-loads project context (intelligent + globs) |
| **.cursor/rules/link-station.mdc** | Feature-specific: read features.md first |

---

## 🎯 For Next Session

- **v3.0.0** Steps 1–3 done. Next: Step 4 (Liar Game – 6 State Flow).
- **Doc update trigger:** When context >85% or at session end, say: *"Read UPDATE_DOCS.md and update all documentation"*

---

*Single source of context for Link Station. Update after major changes.*
