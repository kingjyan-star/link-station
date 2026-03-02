# Feature: Room Hub

**State:** `makeOrJoinRoom`  
**Purpose:** Bridge state—user chooses to make room, join room, or exit.

---

## Role

- Display "안녕하세요, [username]님!".
- Three actions: "방 만들기", "방 참여하기", "나가기".
- "나가기" → call `/api/remove-user`, clear username, go to `registerName`.
- "방 만들기" → go to `makeroom`.
- "방 참여하기" → go to `joinroom`.

---

## Local Data Flow

1. User clicks "나가기" → `freeUsername()` (remove-user), `clearSession()`, `setCurrentState('registerName')`.
2. "방 만들기" → `setCurrentState('makeroom')`.
3. "방 참여하기" → `setCurrentState('joinroom')`.

---

## API Endpoints

| Endpoint | Usage |
|----------|-------|
| POST `/api/remove-user` | `{ username }` — Free username on exit |

---

## Boundaries

- **Does NOT:** Create or join rooms (those are separate features).
- **Does NOT:** Import from other feature folders.
- **May import:** `shared/api`, `shared/session`, `shared/ui`.

---

## Integration (App.js)

- `renderMakeOrJoinRoom()` renders this slice.
- Receives: `username`, `setUsername`, `setCurrentState`, `clearSession`.
- `beforeunload` handler uses similar logic; ensure consistency with session check.

---

**Isolation:** Room hub handles exit cleanup only. Room creation/join logic lives elsewhere.
