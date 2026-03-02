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
│       └── features/           # Vertical slices
│           ├── auth/           # Username registration
│           ├── room-hub/       # Make or Join room bridge
│           ├── room-create/     # Create room form
│           ├── room-join/      # Join by name + password
│           ├── room-join-qr/   # Join via QR code
│           ├── waiting-room/   # Pre-game lobby
│           ├── game-linking/   # Voting phase
│           ├── game-results/   # Match results
│           ├── admin/          # Admin dashboard (all admin states)
│           └── warnings/       # Timeout warning modals
│
└── .cursor/
    └── rules/
        └── link-station.mdc    # Cursor-specific: route to features.md
```

---

## 4. Feature Slices (State → Feature Map)

| State            | Feature        | Purpose                                    |
|------------------|----------------|--------------------------------------------|
| registerName     | auth           | Username entry, duplicate check            |
| makeOrJoinRoom   | room-hub       | Bridge: choose make room, join room, exit  |
| makeroom         | room-create    | Create room (name, password, limit)       |
| joinroom         | room-join      | Join by room name                          |
| checkpassword    | room-join      | Password verification for protected rooms  |
| joinroomwithqr   | room-join-qr   | Join via QR code URL                       |
| waitingroom      | waiting-room   | Lobby, user list, master controls, polling |
| linking          | game-linking   | Voting phase, selections, polling          |
| linkresult       | game-results   | Match results, next round, leave            |
| adminPassword    | admin          | Admin login                                |
| adminDashboard   | admin          | Admin menu                                 |
| adminStatus      | admin          | Room/user counts, lists                    |
| adminCleanup     | admin          | Cleanup UI                                 |
| adminShutdown    | admin          | Shutdown toggle                            |
| adminChangePassword | admin       | Password change                            |
| (modals)         | warnings       | User/room/admin timeout modals             |

---

## 5. Data Flow (Minimal)

```
Auth → Room Hub → (Create | Join | Join QR) → Waiting Room → Linking → Results
                                              ↓
                                         (back to Waiting Room)
```

- **Admin** flow is separate: `registerName` (admin username) → `adminPassword` → `adminDashboard` → sub-states
- **Warnings** are cross-cutting: any feature can show warning modals via shared contracts.

---

## 6. Migration Status

| Component      | Status     | Notes                                      |
|----------------|-----------|--------------------------------------------|
| App.js         | Partial   | Auth extracted; other features in progress |
| api/game.js    | Monolith  | All endpoints in one file                  |
| features/auth  | ✅ Done   | RegisterName.jsx, uses shared api/session  |
| features/*     | Scaffolded| Other slices: `features.md` present       |
| shared/*       | In Use    | api/client, session, checkUsername, validateUsername |

**Migration strategy:** Extract one feature at a time. Update `App.js` to import from the feature folder. Do not change behavior during extraction.

---

## 7. API Endpoint → Feature Mapping

See `api/API_ROUTES.md` for the full mapping. See `CONTEXT.md` for deployment and project overview. Summary:

- **auth:** `/api/check-username`
- **room-create:** `/api/create-room`
- **room-join:** `/api/join-room`, `/api/check-password`
- **room-join-qr:** `/api/join-room-qr`
- **waiting-room:** `/api/room/:id`, `/api/kick-user`, `/api/start-game`, `/api/change-role`, `/api/leave-room`
- **game-linking:** `/api/select`, `/api/room/:id`
- **game-results:** `/api/return-to-waiting`, `/api/room/:id`
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

**Last Updated:** 2026-01-22
