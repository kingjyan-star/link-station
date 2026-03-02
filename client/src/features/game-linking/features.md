# Feature: Game Linking

**State:** `linking`  
**Purpose:** Voting phase—users select each other, real-time status, auto-transition to results.

---

## Role

- Display user list with selection buttons.
- Only attenders can vote; observers see status.
- User selects one → call `/api/select`. Disable button after vote.
- Polling: `GET /api/room/:roomId` every ~2 seconds.
- Detect: `gameState === 'completed'` and `matchResult` → transition to `linkresult`.
- Detect: kicked (user not in room.users) → handle via kick handler.
- Voting badges: "투표완료" / "대기중" from `hasVoted` in room users.

---

## Local Data Flow

1. Mount → start `pollRoomStatus` (2s interval).
2. Poll → fetch room, update `users`, `selections`, `gameState`.
3. If `userId` not in `room.users` → handle kick.
4. If `gameState === 'completed'` and `matchResult` → `setMatches`, `setUnmatched`, `setCurrentState('linkresult')`.
5. User vote → `/api/select` with `selectedUserId` → poll will reflect `hasVoted`.

---

## API Endpoints

| Endpoint | Usage |
|----------|-------|
| POST `/api/select` | `{ roomId, userId, selectedUserId }` — submit vote |
| GET `/api/room/:roomId` | Polling |

---

## Dependencies

- **Refs:** `pollRoomStatusRef` must be set synchronously during render (avoids stale closure).
- **Warnings:** May show user/room warning modals (warnings feature).
- **Session:** Already saved; no change in linking.

---

## Boundaries

- **Does NOT:** Display results (game-results).
- **Does NOT:** Handle waiting room or game start (waiting-room).
- **Does NOT:** Import from other feature folders.
- **May import:** `shared/api`, `shared/session`, `shared/ui`, `features/warnings` (or shared).

---

## Integration (App.js)

- `renderLinking()` renders this slice.
- Polling lifecycle tied to `currentState === 'linking'` and `roomId`.

---

**Isolation:** Voting logic and linking-phase polling live here. Result display is game-results.
