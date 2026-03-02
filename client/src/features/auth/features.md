# Feature: Auth

**State:** `registerName`  
**Purpose:** Username registration and availability check.

---

## Role

- Accept username input (max 32 chars).
- Validate: blank check, duplicate check via API.
- On success: navigate to `makeOrJoinRoom` or `adminPassword` (if username is `link-station-admin`).
- Do NOT manage room state or session persistence (those are shared/other features).

---

## Local Data Flow

1. User types username → validate locally (non-empty, length).
2. On "계속하기" → call `/api/check-username`.
3. If available → `setUsername`, `setCurrentState('makeOrJoinRoom')` (or `adminPassword` for admin).
4. If taken → show error. If session exists for same name, consider reconnect (see session recovery).

---

## API Endpoints

| Endpoint | Usage |
|----------|-------|
| POST `/api/check-username` | `{ username }` → `{ success, available, message }` |

---

## Boundaries

- **Does NOT:** Create rooms, join rooms, persist session.
- **Does NOT:** Import from other feature folders.
- **May import:** `shared/api`, `shared/session`, `shared/ui`.

---

## Integration (App.js)

- `<RegisterName ... />` component renders this slice.
- Receives: `username`, `setUsername`, `setCurrentState`, `setError`, `setSuccess`, plus room/game state setters for session recovery.
- Imports from: `shared/api`, `shared/session`, `shared/utils/validateUsername`.
- Passes through: shutdown check for non-admin.

---

## Extracted (2026-01-22)

- `RegisterName.jsx` – UI + handleRegisterName logic
- `index.js` – re-exports RegisterName
- Uses: shared/api (API_URL, checkUsernameDuplication), shared/session (loadSession, clearSession), shared/utils (validateUsername)

---

**Isolation:** Bugs in auth must be fixed only in this folder (or shared if the cause is there).
