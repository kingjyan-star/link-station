# API Routes – Endpoint → Feature Mapping

All routes are served by `api/game.js`. This file maps each endpoint to its owning feature for VSA context routing.

---

## Auth (`features/auth`)

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/check-username` | Check if username is available |

---

## Room Create (`features/room-create`)

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/check-roomname` | Validate room name before create |
| POST | `/api/create-room` | Create new room |

---

## Room Join (`features/room-join`)

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/join-room` | Join room by name |
| POST | `/api/check-password` | Verify room password |

---

## Room Join QR (`features/room-join-qr`)

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/join-room-qr` | Join room via QR code (bypasses password) |

---

## Waiting Room (`features/waiting-room`)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/room/:roomId` | Get room status (polling) |
| POST | `/api/kick-user` | Master kicks user |
| POST | `/api/start-game` | Master starts game |
| POST | `/api/change-role` | Switch attender/observer |
| POST | `/api/leave-room` | Leave room voluntarily |

---

## Game Linking (`features/game-linking`)

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/select` | User votes for another user |
| GET | `/api/room/:roomId` | Get room status (polling) |

---

## Game Results (`features/game-results`)

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/return-to-waiting` | Reset game, return to waiting room |
| GET | `/api/room/:roomId` | Get room status (polling) |

---

## Warnings (`features/warnings`)

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/check-warning` | Check user/room timeout warnings |
| POST | `/api/keep-alive-user` | Extend user session |
| POST | `/api/keep-alive-room` | Extend room lifetime |

---

## Room Hub / Session (`features/room-hub`, shared)

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/remove-user` | Free username on exit (room-hub uses this) |
| POST | `/api/ping` | Heartbeat (used by multiple features) |

---

## Admin (`features/admin`)

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/admin-login` | Admin login |
| POST | `/api/admin-logout` | Admin logout |
| GET | `/api/admin-token-status` | Check token validity |
| POST | `/api/admin-keep-alive` | Extend admin session |
| GET | `/api/admin-shutdown-status` | Check shutdown state |
| POST | `/api/admin-shutdown` | Toggle shutdown |
| POST | `/api/admin-status` | Get room/user counts |
| POST | `/api/admin-users` | Get filtered user list |
| POST | `/api/admin-rooms` | Get filtered room list |
| POST | `/api/admin-kick-user` | Admin kick user |
| POST | `/api/admin-delete-room` | Admin delete room |
| POST | `/api/admin-cleanup` | Cleanup users/rooms |
| POST | `/api/admin-change-password` | Change admin password |
| GET | `/api/admin-sessions` | List admin sessions |
| POST | `/api/admin-kick-session` | Kick admin session |

---

## Utility / Debug

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/health` | Health check |
| POST | `/api/manual-cleanup` | Admin-only manual cleanup (secretKey) |

---

**When adding/changing API:** Update this file and the owning feature's `features.md`.
