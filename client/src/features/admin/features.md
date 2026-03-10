# Feature: Admin

**States:** `adminPassword`, `adminDashboard`, `adminStatus`, `adminCleanup`, `adminShutdown`, `adminChangePassword`  
**Purpose:** Admin dashboard—status, cleanup, shutdown, password change.

---

## Role

- **adminPassword:** Verify admin password via `/api/admin-login`, receive token.
- **adminDashboard:** Menu with links to Status, Cleanup, Shutdown, Change Password.
- **adminStatus:** Room/user counts, filtered lists, kick/delete buttons. Refresh after actions.
- **adminCleanup:** Run user/room cleanup.
- **adminShutdown:** Toggle app shutdown state.
- **adminChangePassword:** 2-step flow (second password → new password).
- Token refresh: `/api/admin-keep-alive` to extend session.
- Warning: Show modal before token expires.

---

## Local Data Flow

1. adminPassword: Submit password → `/api/admin-login` → store token → `adminDashboard`.
2. adminStatus: Fetch `/api/admin-status`, `/api/admin-users`, `/api/admin-rooms` (filtered).
3. Kick/Delete: Call API → `refreshAdminStatusData()` to update counts.
4. adminCleanup: Call `/api/admin-cleanup` → refresh.
5. adminShutdown: Call `/api/admin-shutdown` → toggle.
6. adminChangePassword: Second password `"19951025"` → new password + confirm → `/api/admin-change-password`.

---

## API Endpoints

All `/api/admin-*` — see `api/API_ROUTES.md` for full list.

Key: admin-login, admin-status, admin-users, admin-rooms, admin-kick-user, admin-delete-room, admin-cleanup, admin-shutdown, admin-change-password, admin-keep-alive, admin-token-status, admin-shutdown-status.

---

## Boundaries

- **Does NOT:** Handle normal game flow (rooms, linking, results).
- **Does NOT:** Import from other feature folders (except shared).
- **May import:** `shared/api`, `shared/ui`.
- **Admin username:** `lsta-gm` — reserved, cannot be used for normal play.

---

## Integration (App.js)

- All `renderAdmin*()` functions render this slice.
- Entry: `registerName` with username `lsta-gm` → `adminPassword`.

---

**Isolation:** All admin UI and logic live in this feature. No game logic here.
