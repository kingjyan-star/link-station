# Link Station – Vertical Slice Architecture

This document is the **root guide** for the project. It defines the architecture, routing rules, and how to navigate the codebase. All development must follow these rules.

**Read `project_config.md` first** for global directives (VSA, 4 Pillars, Cross-Module Protocol).

---

## 1. Architecture Overview

Link Station uses **Vertical Slice Architecture (VSA)**. Each feature is a self-contained module with its own:

- UI components
- Business logic
- State (or state contracts)
- API endpoints (documented, may be centralized in `api/game.js`)

Features are **isolated**. Do not import from other feature folders directly. Use the Shared Kernel for common needs.

---

## 2. Context Routing Protocol

When working on a task:

| Task Location          | Read First                   | Then Modify                          |
|------------------------|------------------------------|--------------------------------------|
| Root / general         | `project_config.md` + this file | Any file per scope                   |
| Feature `X`            | `client/src/features/X/features.md` | Only files under `features/X/`       |
| Shared kernel          | `client/src/shared/README.md` | With Cross-Module Protocol            |
| API changes            | `api/API_ROUTES.md`           | `api/game.js` or new route handlers  |

**Rule:** When touching a feature directory, read its `features.md` before editing.

---

## 3. Directory Structure

```
link-station/
├── project_config.md          # Global VSA directives (READ FIRST)
├── ARCHITECTURE.md             # This file - root routing guide
│
├── api/                        # Backend (serverless)
│   ├── game.js                 # Main API entry (routes all /api/*)
│   ├── storage.js              # Redis/storage abstraction
│   └── API_ROUTES.md           # Endpoint → Feature mapping
│
├── client/
│   └── src/
│       ├── App.js              # Orchestrator: state machine, feature routing (migration target)
│       ├── App.css             # Global styles
│       │
│       ├── shared/             # Shared Kernel (minimal)
│       │   ├── README.md       # Cross-module protocol, usage rules
│       │   ├── api/            # API client (base URL, fetch helpers)
│       │   ├── session/        # Session persistence (save/load/clear)
│       │   └── ui/             # Shared UI (buttons, inputs, password toggle)
│       │
│       └── features/           # Vertical slices (4 domain features)
│           ├── user/           # Identity: RegisterName, admin entry
│           ├── room/            # Room lifecycle: hub, create, join, QR, waiting
│           ├── telepathy/       # Telepathy game: play + result
│           ├── liar/            # Liar game: word input → play → vote → argument → identify → result
│           ├── admin/           # Admin dashboard (all admin states)
│           └── warnings/       # Timeout warning modals
│
└── .cursor/
    └── rules/
        ├── project-context.mdc  # Apply Intelligently + globs: read project_config, ARCHITECTURE, CONTEXT
        └── link-station.mdc     # Feature-specific: read features.md first
```

---

## 4. Feature Slices (State → Feature Map)

**Four domain features:** user, room, telepathy, liar.

| State               | Feature    | Purpose                                         |
|---------------------|------------|-------------------------------------------------|
| registerName        | user       | Username entry, duplicate check                 |
| makeOrJoinRoom      | room       | Bridge: make room, join room, exit              |
| makeroom            | room       | Create room (name, password, limit)              |
| joinroom            | room       | Join by room name                               |
| checkpassword       | room       | Password verification for protected rooms       |
| joinroomwithqr      | room       | Join via QR code URL                            |
| waitingroom         | room       | Lobby, user list, master controls, game select  |
| telepathy           | telepathy  | Voting phase, selections, polling               |
| telepathyResult     | telepathy  | Match results, next round, leave                |
| liar (6 phases)      | liar       | WordInput, Play, Vote, Argument, Identify, Result |
| adminPassword       | admin      | Admin login                                     |
| adminDashboard      | admin      | Admin menu                                      |
| adminStatus         | admin      | Room/user counts, lists                         |
| adminCleanup        | admin      | Cleanup UI                                      |
| adminShutdown       | admin      | Shutdown toggle                                 |
| adminChangePassword | admin      | Password change                                 |
| (modals)            | warnings   | User/room/admin timeout modals                   |

---

## 5. Data Flow (Minimal)

```
Auth → Room Hub → (Create | Join | Join QR) → Waiting Room → [Telepathy | Liar] → Results
                                              ↓
                                         (back to Waiting Room)
```

- **Admin** flow is separate: `registerName` (admin username) → `adminPassword` → `adminDashboard` → sub-states
- **Warnings** are cross-cutting: any feature can show warning modals via shared contracts.

---

## 6. Migration Status

| Component         | Status   | Notes                                                              |
|-------------------|----------|--------------------------------------------------------------------|
| App.js            | Partial  | Orchestrator; room/telepathy/liar imported                         |
| api/game.js       | Monolith | All endpoints in one file                                          |
| features/user     | ✅ Done  | RegisterName.jsx                                                   |
| features/room     | ✅ Done  | MakeOrJoinRoom, MakeRoom, JoinRoom, CheckPassword, JoinRoomWithQR, WaitingRoom |
| features/telepathy| ✅ Done  | TelepathyPlay, TelepathyResult                                     |
| features/liar     | ✅ Done  | LiarWordInput, Play, Vote, Argument, Identify, Result              |
| shared/*          | In Use   | api/client, session, checkUsername, validateUsername              |

**Architecture (2026-03):** Consolidated to 4 domain features: user, room, telepathy, liar.

---

## 7. API Endpoint → Feature Mapping

See `api/API_ROUTES.md` for the full mapping. See `CONTEXT.md` for deployment and project overview. Summary:

- **user:** `/api/check-username`
- **room:** `/api/create-room`, `/api/join-room`, `/api/join-room-qr`, `/api/check-password`, `/api/room/:id`, `/api/kick-user`, `/api/start-game`, `/api/change-role`, `/api/leave-room`
- **telepathy:** `/api/select`, `/api/room/:id`, `/api/return-to-waiting`
- **liar:** `/api/liar-*` (word, extend, vote, forgive-execute, guess, identify, etc.)
- **admin:** `/api/admin-*` (all admin endpoints)
- **warnings:** `/api/check-warning`, `/api/keep-alive-user`, `/api/keep-alive-room`

---

## 8. Cross-Module Protocol (Shared Kernel)

When changing code under `shared/`:

1. **Halt & Assess** – shared changes can break multiple features.
2. **Terminal-First Mapping** – use `grep`/`rg` to find all consumers.
3. **Backward Compatibility** – prefer optional params, avoid breaking signatures.
4. **Synchronized Updates** – if breaking change is unavoidable, update all consumers explicitly.

See `client/src/shared/README.md` for details.

---

## 9. Verification Checklist

- [ ] Read `features.md` before editing a feature folder
- [ ] No direct imports between feature folders
- [ ] Shared logic lives in `shared/` only
- [ ] API changes documented in `api/API_ROUTES.md`
- [ ] Bug fixes: modify only the slice causing the issue

---

**Last Updated:** 2026-03
