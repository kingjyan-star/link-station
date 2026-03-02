# Feature: Waiting Room

**State:** `waitingroom`  
**Purpose:** Pre-game lobby with user list, QR code, master controls, polling.

---

## Role

- Display user list (real-time via polling), master badge, QR code.
- Master: kick users (✕), start game ("게임 시작").
- Attender/Observer role selection.
- Polling: `GET /api/room/:roomId` every ~5 seconds.
- Detect: kicked (user not in room.users) → handle via unified kick handler.
- Detect: `gameState === 'linking'` → transition to linking.
- "방 나가기" → leave room, go to `makeOrJoinRoom`.

---

## Local Data Flow

1. Mount → start `pollWaitingRoomStatus` (5s interval).
2. Poll → fetch room, update `users`, `roomData`, `gameState`.
3. If `userId` not in `room.users` → handle kick (reason from API if available).
4. If `gameState === 'linking'` → `stopPolling`, `setCurrentState('linking')`.
5. Master "게임 시작" → `/api/start-game` → poll will reflect new state.
6. Kick button → `/api/kick-user`.
7. Role change → `/api/change-role`.
8. Leave → `/api/leave-room`, clear session, go to `makeOrJoinRoom`.

---

## API Endpoints

| Endpoint | Usage |
|----------|-------|
| GET `/api/room/:roomId` | Polling |
| POST `/api/kick-user` | Master kick |
| POST `/api/start-game` | Start game |
| POST `/api/change-role` | Attender/observer |
| POST `/api/leave-room` | Leave voluntarily |

---

## Dependencies

- **Refs:** `pollWaitingRoomStatusRef` must be set synchronously during render (avoids stale closure).
- **Warnings:** Uses `check-warning` / `keep-alive` (warnings feature or shared).
- **Session:** Save on join; clear on leave/kick.

---

## Boundaries

- **Does NOT:** Handle linking phase or results (game-linking, game-results).
- **Does NOT:** Import from other feature folders.
- **May import:** `shared/api`, `shared/session`, `shared/ui`, `features/warnings` (or shared warning contract).

---

## Integration (App.js)

- `renderWaitingRoom()` renders this slice.
- Polling lifecycle tied to `currentState === 'waitingroom'` and `roomId`.

---

**Isolation:** Waiting room logic, polling, and master controls live here. Game flow transitions out to game-linking.
