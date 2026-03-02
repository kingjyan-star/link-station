# Feature: Room Join (QR)

**State:** `joinroomwithqr`  
**Purpose:** Join room via QR code URL (`?room=roomId`).

---

## Role

- Entry: URL has `?room=roomId` (detected at app load or navigation).
- User enters username (if not pre-filled). Room ID comes from URL.
- Call `/api/join-room-qr` (bypasses password).
- On success: save session, set room state, go to `waitingroom`.
- On "취소" → go to `makeOrJoinRoom`, clear URL params if applicable.

---

## Local Data Flow

1. Detect `room` in URL params → set state to `joinroomwithqr`, set `roomId` from param.
2. User enters username → submit `{ username, roomId }` to `/api/join-room-qr`.
3. Response: `{ success, userId, roomData }`.
4. Save session, set users/isMaster/roomData, go to `waitingroom`.

---

## API Endpoints

| Endpoint | Usage |
|----------|-------|
| POST `/api/join-room-qr` | `{ username, roomId }` → join without password |

---

## Boundaries

- **Does NOT:** Handle join by room name or password (see room-join).
- **Does NOT:** Import from other feature folders.
- **May import:** `shared/api`, `shared/session`, `shared/ui`.

---

## Integration (App.js)

- URL param check in root `useEffect` routes to this state.
- Session recovery skips when `?room=` is present (QR flow).
- `renderJoinRoomWithQR()` renders this slice.

---

**Isolation:** QR join is a separate slice. Same room, different entry path.
