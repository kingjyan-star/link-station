# User & Room Registration/Keeping/Deleting Process

## Current System Overview

### 1. USER Registration/Keeping/Deleting Process

#### **Registration** (When user enters nickname):
- User enters nickname in `registerName` state
- Frontend calls `/api/check-username` to check for duplicates
- If duplicate exists → Error: "이미 사용 중인 사용자 이름입니다."
- If available → User proceeds to `makeOrJoinRoom` state
- **Username is NOT yet stored in backend at this point**

#### **Username Storage** (When user creates/joins room):
- When user **creates room** (`/api/create-room`):
  - Backend checks username duplication again
  - Creates room and user entry
  - Stores username in `activeUsers` with: `{ roomId, userId, lastActivity: Date.now() }`
  
- When user **joins room** (`/api/join-room`, `/api/check-password`, `/api/join-room-qr`):
  - Backend checks username duplication
  - Adds user to room
  - Stores username in `activeUsers` with: `{ roomId, userId, lastActivity: Date.now() }`

#### **Username Keeping (Heartbeat System)**:
- **Heartbeat sends every 5 minutes** when user is in `waitingroom`, `linking`, or `linkresult` states
- `/api/ping` endpoint updates `lastActivity = Date.now()` for the username
- **Page Visibility API**: When tab becomes visible (user switches back from another tab), heartbeat is sent immediately
- **Purpose**: Keeps username "alive" as long as tab is open (even in background)

#### **Username Deletion**:
Username is deleted in these scenarios:

1. **User clicks "나가기" (Logout)**: 
   - Frontend calls `/api/remove-user` → `storage.deleteActiveUser(username)`
   - Username immediately freed

2. **User clicks "방 나가기" (Leave Room)**:
   - Frontend calls `/api/leave-room` → `storage.deleteActiveUser(user.username)`
   - Username immediately freed

3. **Backend Cleanup Job (30-minute timeout)**:
   - Runs every 5 minutes (`CLEANUP_INTERVAL_MS`)
   - Checks all active users
   - If `inactiveTime >= 30 minutes` (USER_TIMEOUT_MS):
     - Removes user from room
     - Calls `storage.deleteActiveUser(username)`
     - Username freed

4. **Master kicks user**:
   - `/api/kick-user` → `storage.deleteActiveUser(targetUser.username)`
   - Username immediately freed

---

### 2. ROOM Registration/Keeping/Deleting Process

#### **Registration** (When user creates room):
- `/api/create-room` endpoint:
  - Validates room name (case-insensitive, checks duplicates)
  - Creates room object with: `{ id, roomName, password, users, gameState: 'waiting', createdAt, lastActivity }`
  - Stores in Redis/Storage
  - User becomes master

#### **Room Keeping**:
- **Room activity** is updated (`lastActivity = Date.now()`) when:
  - User creates room
  - User joins room
  - User checks password
  - User joins via QR
  - Game starts
  - User votes (selects)
  - User changes role
  - User returns to waiting room
  - User is kicked
  - User leaves room
  - **NOTE**: Heartbeat (`/api/ping`) does NOT update room activity (only user activity)

#### **Room Deletion**:
Room is deleted in these scenarios:

1. **Empty room (immediate)**:
   - When all users leave → `room.users.size === 0`
   - Room deleted immediately in cleanup job

2. **Zombie room (2-hour timeout)**:
   - Cleanup job runs every 5 minutes
   - If `timeSinceActivity > 2 hours` (ZOMBIE_ROOM_TIMEOUT):
     - Room deleted
     - All users in room also deleted from `activeUsers`

---

## Current Problem

### Issue: Username locked when tab is closed

**Scenario:**
1. User opens tab → enters nickname "홍길동" → creates/joins room
2. Username "홍길동" is stored in `activeUsers` with `lastActivity` timestamp
3. User **closes the tab** (not just switching tabs)
4. **Problem**: Username "홍길동" remains locked for **30 minutes** (until backend cleanup)
5. User opens new tab → tries to use "홍길동" → Gets error: "이미 사용 중인 사용자 이름입니다."
6. User cannot access their old tab (it's closed) to free the username

**What should happen:**
- **Tab closed** → Username should be freed **immediately**
- **Tab in background** → Username should stay locked (heartbeat keeps it alive)

**Current behavior:**
- Tab closed → Username stays locked for 30 minutes ❌
- Tab in background → Username stays locked (heartbeat works) ✅

---

## Proposed Solution

### Implementation: Detect Tab Closure with `beforeunload` / `pagehide` Event

#### **Strategy:**
1. Use browser `beforeunload` and `pagehide` events to detect when tab is actually closing
2. When tab closes → Call `/api/remove-user` to immediately free the username
3. Handle navigation vs. tab closure carefully

#### **Technical Approach:**

**Frontend (App.js):**
- Add `beforeunload` event listener when user has an active username
- On `beforeunload` → Send synchronous/navigator.sendBeacon request to `/api/remove-user`
- Also handle `pagehide` event (more reliable for mobile browsers)
- Only trigger if user is actually leaving the site (not just navigating within app)

**Key considerations:**
- `beforeunload`: Fires when tab is about to close (desktop browsers)
- `pagehide`: Fires when page is being unloaded (better for mobile)
- `visibilitychange`: Already handled - sends heartbeat when tab becomes visible (keeps username alive for background tabs)
- Use `navigator.sendBeacon()` for reliable delivery even if page is unloading
- Don't trigger on normal navigation (e.g., clicking links within app) - only on actual tab closure

#### **Edge Cases to Handle:**
1. **User refreshes page**: Should NOT free username (use `performance.navigation.type` to detect refresh)
2. **User navigates away within app**: Should NOT free username
3. **Browser crash**: Cannot handle - will rely on 30-minute timeout (acceptable fallback)
4. **Network failure during beacon**: Username will be freed by 30-minute timeout (acceptable fallback)
5. **Multiple tabs with same username**: Only the last closed tab should free the username

#### **Implementation Details:**

```javascript
// Frontend: Detect tab closure
useEffect(() => {
  if (!username) return; // No username = nothing to clean up
  
  const handleBeforeUnload = (event) => {
    // Only clean up if user is actually leaving (not navigating within app)
    // Use sendBeacon for reliable delivery during page unload
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        `${API_URL}/api/remove-user`,
        JSON.stringify({ username })
      );
    }
  };
  
  const handlePageHide = (event) => {
    // pagehide is more reliable on mobile browsers
    if (event.persisted) {
      // Page is being cached (not actually closed) - don't free username
      return;
    }
    // Page is actually unloading - free username
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        `${API_URL}/api/remove-user`,
        JSON.stringify({ username })
      );
    }
  };
  
  window.addEventListener('beforeunload', handleBeforeUnload);
  window.addEventListener('pagehide', handlePageHide);
  
  return () => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
    window.removeEventListener('pagehide', handlePageHide);
  };
}, [username]);
```

**Note**: We should be careful about when to free the username:
- ✅ Free when: Tab closes, user navigates away from site
- ❌ Don't free when: User refreshes, user navigates within app, tab just goes to background

**Better approach**: Only free username when we're sure the tab is closing AND the user is not in a room (or optionally also when leaving a room):
- Free username if: `currentState === 'makeOrJoinRoom'` or `currentState === 'registerName'` (user hasn't joined room yet)
- Free username if: User is leaving a room (already handled by `handleLeaveRoom`)
- Don't free username if: User is in a room (they might refresh or accidentally close tab)

**Actually, even better**: Free username whenever tab closes, because:
- If user refreshes in a room → They'll need to re-enter nickname anyway (state is lost)
- If user accidentally closes tab → They can rejoin with same nickname (username is now free)
- If user intentionally closes tab → Username should be free (current problem)

---

## Summary of Changes Needed

### Files to Modify:

1. **`client/src/App.js`**:
   - Add `useEffect` hook that listens for `beforeunload` and `pagehide` events
   - When tab closes → Call `/api/remove-user` using `navigator.sendBeacon()`
   - Only trigger when username exists
   - Consider: Should we only free username if user is NOT in a room? Or always free?

2. **`api/game.js`**:
   - `/api/remove-user` endpoint already exists and works correctly
   - No changes needed

### Decision Point:
**Question**: Should we free the username when:
- **Option A**: Tab closes regardless of current state (simpler, user can rejoin with same name)
- **Option B**: Tab closes only if user is NOT in a room (safer, prevents accidental disconnection)

**Recommendation**: **Option A** (free username always on tab close)
- If user refreshes in a room, they lose state anyway → need to re-enter nickname
- If user accidentally closes tab, they can immediately rejoin with same nickname
- Simpler implementation
- Better user experience

