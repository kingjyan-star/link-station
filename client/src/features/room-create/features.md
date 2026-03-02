# Feature: Room Create

**State:** `makeroom`  
**Purpose:** Create a new game room.

---

## Role

- Form: room name (max 128), password (optional, max 16), member limit (2–99, default 8).
- Validate: room name non-empty, uniqueness (optional check).
- On "방 생성하기" → call `/api/create-room`.
- On success: save session, set roomId/userId/users/isMaster/roomData, go to `waitingroom`.
- On "취소" → go to `makeOrJoinRoom`.

---

## Local Data Flow

1. User fills form → submit.
2. Call `/api/create-room` with `{ username, roomName, password?, memberLimit }`.
3. Response: `{ success, roomId, userId, roomData }`.
4. Save session (username, roomId, userId), set room state, navigate to `waitingroom`.

---

## API Endpoints

| Endpoint | Usage |
|----------|-------|
| POST `/api/check-roomname` | Optional: validate room name before create |
| POST `/api/create-room` | `{ username, roomName, password?, memberLimit }` → `{ roomId, userId, roomData }` |

---

## Boundaries

- **Does NOT:** Handle joining, QR, waiting room UI.
- **Does NOT:** Import from other feature folders.
- **May import:** `shared/api`, `shared/session`, `shared/ui`.

---

## Integration (App.js)

- `renderMakeRoom()` renders this slice.
- Receives: `username`, `roomName`, `roomPassword`, `memberLimit`, setters, `saveSession`.

---

**Isolation:** Room creation logic is self-contained. Errors in create flow = fix here.
