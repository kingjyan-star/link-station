# Feature: Room Join

**States:** `joinroom`, `checkpassword`  
**Purpose:** Join an existing room by name, with optional password.

---

## Role

- **joinroom:** Input room name. Call `/api/join-room`. If `requiresPassword` → go to `checkpassword`. Else complete join.
- **checkpassword:** Input password. Call `/api/check-password`. On success → call `/api/join-room` with password context (or equivalent flow).
- On join success: save session, set room state, go to `waitingroom`.
- On "취소" → go to `makeOrJoinRoom`.

---

## Local Data Flow

1. joinroom: Submit `{ username, roomName }` → `/api/join-room`.
2. If `requiresPassword` → `setCurrentState('checkpassword')`, keep `enteredRoomName`.
3. checkpassword: Submit `{ roomName, password }` → `/api/check-password`. If OK → complete join (may need follow-up join call).
4. Join success: save session, set roomId/userId/users/roomData/isMaster, go to `waitingroom`.

---

## API Endpoints

| Endpoint | Usage |
|----------|-------|
| POST `/api/join-room` | `{ username, roomName }` → join or `requiresPassword` |
| POST `/api/check-password` | `{ roomName, password }` → `{ success }` |

---

## Boundaries

- **Does NOT:** Handle QR join (see room-join-qr).
- **Does NOT:** Import from other feature folders.
- **May import:** `shared/api`, `shared/session`, `shared/ui`.

---

## Integration (App.js)

- `renderJoinRoom()`, `renderCheckPassword()` render this slice.
- Shared state: `enteredRoomName`, `enteredPassword`, `setEnteredRoomName`, `setEnteredPassword`.

---

**Isolation:** Join-by-name and password check live here. QR flow is separate.
