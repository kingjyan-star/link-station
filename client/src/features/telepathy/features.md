# Feature: Telepathy Game

**States:** `telepathy` (linking), `telepathyResult`  
**Purpose:** Voting phase—users select each other, real-time status, auto-transition to results.

---

## Components

- **TelepathyPlay** – Voting phase, user list, selection buttons.
- **TelepathyResult** – Match results, return-to-waiting, leave room.

---

## Integration (App.js)

- `renderTelepathy()` uses `TelepathyPlay`.
- `renderTelepathyResult()` uses `TelepathyResult`.
- Polling and API calls remain in App.js; components receive props.
