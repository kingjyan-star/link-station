# Feature: Game Results

**State:** `linkresult`  
**Purpose:** Display match results, "다음 라운드" / "방 나가기" actions.

---

## Role

- Display matches (pairs) and unmatched users.
- "다음 라운드" (Next Round) → call `/api/return-to-waiting`, go to `waitingroom`.
- "방 나가기" (Leave Room) → go to `waitingroom` (preserves username for continuous play; per Session 13).
- Polling: may still run to detect room deletion or kick.
- Detect: kicked → handle via kick handler.

---

## Local Data Flow

1. Display `matches` and `unmatched` from state.
2. "다음 라운드" → `/api/return-to-waiting` → `stopPolling`, `setCurrentState('waitingroom')`, restart waiting room polling.
3. "방 나가기" → `setCurrentState('waitingroom')` (no API, user stays in room).
4. Race fix: call `stopPolling()` before state change to prevent overwrite.

---

## API Endpoints

| Endpoint | Usage |
|----------|-------|
| POST `/api/return-to-waiting` | Reset game state, clear selections/matchResult |
| GET `/api/room/:roomId` | Polling (optional, for kick/deletion detection) |

---

## Boundaries

- **Does NOT:** Handle linking phase (game-linking).
- **Does NOT:** Import from other feature folders.
- **May import:** `shared/api`, `shared/session`, `shared/ui`.

---

## Integration (App.js)

- `renderLinkResult()` renders this slice.
- Critical: `handleReturnToWaitingRoom` must stop polling first, set `isLeavingRoom.current = true` to avoid kick alert.

---

**Isolation:** Results display and "next round" flow live here. Linking logic is separate.
