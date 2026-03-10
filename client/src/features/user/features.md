# Feature: User

**States:** `registerName`, `adminPassword` (admin flow)  
**Purpose:** Identity, username registration, admin entry.

---

## Role

- Username registration and availability check.
- Shutdown status check before entry.
- Route to admin flow when username is `lsta-gm`.
- Session recovery on duplicate-username (if session exists).

---

## Components

- **RegisterName** – Username entry, validation, duplicate check, session recovery.

---

## API Endpoints

| Endpoint | Usage |
|----------|-------|
| POST `/api/check-username` | `{ username }` → `{ success, available, message }` |
| GET `/api/admin-shutdown-status` | Check if app is shutdown |

---

## Boundaries

- Does NOT manage room state or create/join logic.
- Does NOT import from other feature folders.
- May import: `shared/api`, `shared/session`, `shared/utils`.

---

**Consolidated from:** auth (2026-03).
