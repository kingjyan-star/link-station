# Feature: Warnings

**Purpose:** Cross-cutting—timeout warning modals for user, room, and admin sessions.

---

## Role

- **User warning:** 1 min before 30-min timeout. "로그인 유지" / "로그아웃".
- **Room warning:** 1 min before 2h timeout. Master: "방 유지" / "방 나가기". Others: "방 나가기" + message.
- **Admin warning:** Before admin token expires.
- Polling: `/api/check-warning` every ~10 seconds when in room/game.
- Actions: `/api/keep-alive-user`, `/api/keep-alive-room`, admin keep-alive.

---

## Local Data Flow

1. `checkWarning` runs every 10s when user is in waitingroom/linking/linkresult.
2. Response: `userWarning`, `userTimeLeft`, `roomWarning`, `roomTimeLeft`, `userDisconnected`, `roomDeleted`, `kickReason`, `roomDeleteReason`.
3. If warning flags set → show modal, set countdown.
4. User clicks "로그인 유지" → `/api/keep-alive-user` → close modal.
5. Master clicks "방 유지" → `/api/keep-alive-room` → close modal.
6. If `userDisconnected` / `roomDeleted` / kick → handle via `handleKickByReason`.

---

## API Endpoints

| Endpoint | Usage |
|----------|-------|
| POST `/api/check-warning` | `{ username, userId, roomId }` → warning flags, kick reasons |
| POST `/api/keep-alive-user` | Extend user session |
| POST `/api/keep-alive-room` | Extend room lifetime |

---

## Boundaries

- **Does NOT:** Own room/game state. Consumes state from parent.
- **Cross-cutting:** Used by waiting-room, game-linking, game-results, admin.
- **May import:** `shared/api`, `shared/ui`.
- **Contract:** Receives `onKick`, `onRoomDeleted`, etc. from parent. Does not import from other features.

---

## Integration (App.js)

- Warning modals rendered at app root (conditionally).
- `checkWarning` callback passed or called from app-level useEffect.
- `handleKickByReason` centralizes all kick/disconnect/room-delete handling—single handler, correct messages, proper state transitions.

---

**Isolation:** Warning logic and modals live here. Consuming features only trigger the polling and pass handlers.
