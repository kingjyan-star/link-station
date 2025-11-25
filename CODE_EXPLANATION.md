# 📚 Code Explanation for Link Station

This document explains the code changes in beginner-friendly terms.

---

## 📁 **storage.js** - Shared Data Storage Layer

### 1. **What is `const` variable or function?**

`const` means **"constant"** - a value that cannot be changed after it's created.

```javascript
const REST_URL = process.env.UPSTASH_REDIS_KV_REST_API_URL;
```

- `REST_URL` is set once and never changes
- If you try to change it later, JavaScript will give an error
- **Why use it?** Prevents accidental changes to important values

**Functions can also be `const`:**
```javascript
const ROOM_KEY = (roomId) => `room:${roomId}`;
```
- This is a **function** that takes `roomId` and returns a string like `"room:abc123"`
- The function itself never changes (but it can be called with different inputs)

---

### 2. **Redis Key Helpers - What are they?**

Redis stores data using **keys** (like file names). These helpers create consistent key names:

```javascript
const ROOM_KEY = (roomId) => `room:${roomId}`;
// Example: roomId = "abc123" → returns "room:abc123"
```

**Each helper explained:**

- **`ROOM_KEY(roomId)`**: Creates key for room data
  - Example: `"room:abc123"` stores the full room object

- **`ROOM_NAME_KEY(roomNameLower)`**: Creates key for room name lookup
  - Example: `"room:name:myparty"` stores the roomId for quick name searches
  - **Why?** To quickly find a room by name without searching all rooms

- **`ROOM_SET_KEY`**: A set (list) of all room IDs
  - Value: `"rooms:ids"`
  - **Why?** To get a list of all rooms quickly

- **`ACTIVE_USER_KEY(username)`**: Creates key for active user data
  - Example: `"active:john"` stores user's roomId, userId, lastActivity

- **`ACTIVE_USER_SET_KEY`**: A set of all active usernames
  - Value: `"active:users"`
  - **Why?** To get a list of all active users quickly

- **`DELETED_ROOM_KEY(roomId)`**: Creates key for deletion record
  - Example: `"room:deleted:abc123"` stores when the room was deleted
  - **Why?** To remember that a room was deleted (for diagnostics)

---

### 3. **In-Memory Fallback - What is it?**

**In-memory** = stored in the computer's RAM (temporary, lost when server restarts)

**What it means:**
```javascript
const memoryStore = {
  rooms: new Map(),
  activeUsers: new Map(),
  deletedRooms: new Map()
};
```

**"Local development with no Redis credentials"** means:
- When you're testing on your computer (`localhost`)
- You might not have Upstash Redis set up yet
- The code will use `memoryStore` (RAM) instead of Redis
- **This is fine for testing**, but data is lost when you restart

**How it works:**
```javascript
if (!REDIS_ENABLED) {
  // Use memoryStore (RAM)
  memoryStore.rooms.set(room.id, room);
} else {
  // Use Redis (cloud storage)
  await redisRequest('set', [ROOM_KEY(room.id), serializable]);
}
```

---

### 4. **What are `users` and `selections` for in SerializableRoom functions?**

**The Problem:**
- JavaScript `Map` objects cannot be stored directly in Redis (Redis only stores strings/numbers)
- We need to convert `Map` → Array → String → Redis

**The Solution:**

**`toSerializableRoom(room)`** - Converts room to storable format:
```javascript
const toSerializableRoom = (room) => ({
  ...room,  // Copy all room properties
  users: Array.from(room.users.entries()),  // Convert Map to Array
  selections: Array.from(room.selections.entries())  // Convert Map to Array
});
```

**Example:**
- **Before**: `room.users = Map { "user1" => {name: "John"}, "user2" => {name: "Jane"} }`
- **After**: `room.users = [["user1", {name: "John"}], ["user2", {name: "Jane"}]]`

**`fromSerializableRoom(room)`** - Converts back from storage format:
```javascript
const fromSerializableRoom = (room) => {
  return {
    ...room,
    users: new Map(room.users || []),  // Convert Array back to Map
    selections: new Map(room.selections || [])  // Convert Array back to Map
  };
};
```

**Why both?**
- **`users`**: List of all people in the room
- **`selections`**: Who voted for whom (for the matching game)

---

### 5. **What is `async function`?**

**`async`** = "asynchronous" - the function can wait for slow operations (like network requests)

**Without `async`:**
```javascript
function getRoom() {
  const data = fetchFromRedis();  // This might take 100ms
  return data;  // Returns immediately, but data might not be ready!
}
```

**With `async`:**
```javascript
async function getRoom() {
  const data = await fetchFromRedis();  // Wait for Redis to respond
  return data;  // Returns only after data is ready
}
```

**Key points:**
- `async` functions can use `await` to wait
- They always return a Promise (a "future value")
- You must use `await` when calling them: `const room = await getRoom();`

**Why needed?** Redis requests take time (network delay), so we must wait for the response.

---

### 6. **What does "serializable" mean? Does `stringify` list rooms in order?**

**"Serializable"** = can be converted to a string format (like JSON)

**`JSON.stringify()`** converts JavaScript objects to strings:
```javascript
const room = { id: "abc", name: "My Room", users: [...] };
const string = JSON.stringify(room);
// Result: '{"id":"abc","name":"My Room","users":[...]}'
```

**Why stringify?**
- Redis can only store **strings** (or numbers)
- We cannot store JavaScript objects directly
- So we convert: Object → String → Redis

**Does it list in order?**
- No, `stringify` doesn't sort or order
- It just converts the object to a string representation
- The order in the string matches the object's structure

**Example:**
```javascript
const room = { id: "abc", name: "Party" };
JSON.stringify(room);  // '{"id":"abc","name":"Party"}'
```

---

### 7. **If `!REDIS_ENABLED`, room cannot be saved, right? What happens?**

**Actually, rooms ARE saved!** Just in a different place:

```javascript
if (!REDIS_ENABLED) {
  // Save to RAM (memoryStore)
  memoryStore.rooms.set(room.id, room);
  return;  // Done! Room is saved in memory
}
```

**What happens:**
1. **If Redis is disabled**: Room is saved in `memoryStore` (RAM)
   - ✅ Works fine for local testing
   - ❌ Data is lost when server restarts
   - ❌ Not shared across multiple server instances

2. **If Redis is enabled**: Room is saved in Redis (cloud)
   - ✅ Data persists across restarts
   - ✅ Shared across all server instances
   - ✅ Production-ready

**The code doesn't retry** - it just uses whichever storage is available.

---

### 8. **What does `setex` do in storage?**

**`setex`** = "SET with EXpiration" - sets a value that automatically expires after a time

```javascript
await redisRequest('setex', [
  DELETED_ROOM_KEY(roomId),      // Key name
  DELETED_ROOM_TTL_SECONDS,       // Time to live (seconds)
  Date.now().toString()           // Value (timestamp)
], { method: 'POST' });
```

**What it does:**
- Sets a key with a value
- **Automatically deletes the key after X seconds**
- In our case: stores deletion timestamp for 10 minutes, then auto-deletes

**Why use it?**
- We only need to remember "room was deleted" for a short time (10 minutes)
- After that, we don't care anymore
- `setex` automatically cleans up old deletion records

**Other Redis commands:**
- **`sadd`** = "Set ADD" - adds a value to a set (list)
- **`srem`** = "Set REMove" - removes a value from a set
- **`set`** = stores a key-value pair (no expiration)
- **`get`** = retrieves a value by key
- **`del`** = deletes a key

---

### 9. **Why is `Date.now() - deletedAt > DELETED_ROOM_TTL_SECONDS * 1000` needed?**

**The Problem:**
- `Date.now()` returns milliseconds (e.g., 1700000000000)
- `DELETED_ROOM_TTL_SECONDS` is in seconds (e.g., 600)
- We need to compare them in the same units!

**The Math:**
```javascript
const deletedAt = 1700000000000;  // milliseconds
const TTL = 600;  // seconds
const TTL_MS = 600 * 1000 = 600000;  // convert to milliseconds

const timeSinceDeletion = Date.now() - deletedAt;  // milliseconds
if (timeSinceDeletion > TTL_MS) {
  // More than 10 minutes have passed, forget about this deletion
}
```

**Why `* 1000`?**
- 1 second = 1000 milliseconds
- To compare, we convert seconds → milliseconds: `600 seconds * 1000 = 600000 ms`

**What it checks:**
- "Has more than 10 minutes passed since deletion?"
- If yes, remove the deletion record (we don't need to remember it anymore)

---

### 10. **What is `module.exports` for?**

**`module.exports`** = makes functions/variables available to other files

**In `storage.js`:**
```javascript
module.exports = {
  getRoomById,
  saveRoom,
  deleteRoom,
  // ... etc
};
```

**In `game.js`:**
```javascript
const storage = require('./storage');
// Now we can use: storage.getRoomById(), storage.saveRoom(), etc.
```

**Think of it like:**
- `module.exports` = "Here's what I'm sharing"
- `require()` = "I want to use what you shared"

**Why needed?**
- JavaScript files are separate by default
- To use functions from another file, you must export them
- This is how we connect `game.js` to `storage.js`

---

## 📁 **game.js** - API Server

### 1. **How is `const storage = require('./storage')` used?**

**`require('./storage')`** = loads the `storage.js` file and gets its exports

**What it does:**
```javascript
const storage = require('./storage');
// Now `storage` is an object with all the exported functions:
// storage.getRoomById()
// storage.saveRoom()
// storage.deleteRoom()
// etc.
```

**Usage example:**
```javascript
// Instead of: rooms.get(roomId)
const room = await storage.getRoomById(roomId);

// Instead of: rooms.set(roomId, room)
await storage.saveRoom(room);
```

**Why?**
- Before: Used in-memory `Map` objects (lost on restart, not shared)
- Now: Uses Redis storage (persistent, shared across instances)

---

### 2. **What is `req.body`?**

**`req`** = "request" (data sent from the frontend to the backend)

**`req.body`** = the data in the request body (usually JSON)

**Example:**
```javascript
// Frontend sends:
fetch('/api/create-room', {
  method: 'POST',
  body: JSON.stringify({
    roomName: "My Party",
    username: "John"
  })
});

// Backend receives:
app.post('/api/create-room', (req, res) => {
  const roomName = req.body.roomName;  // "My Party"
  const username = req.body.username;  // "John"
});
```

**Why `app.use(express.json())`?**
- This line tells Express to automatically parse JSON from `req.body`
- Without it, `req.body` would be empty or a string

---

### 3. **Is `trimmedUsername` just for comparing names to prevent duplication?**

**Yes, exactly!** But it also prevents other issues:

```javascript
const trimmedUsername = username.trim();
```

**What `trim()` does:**
- Removes spaces from the start and end
- `"  John  "` → `"John"`
- `"John "` → `"John"`

**Why it's important:**
1. **Prevents duplication**: `"John"` and `"John "` are treated as the same user
2. **Consistency**: All usernames stored without extra spaces
3. **User experience**: User can type with spaces, but we store it clean

**Example:**
```javascript
// User types: "  John  "
const trimmed = "John";
// Now we check: activeUsers.has("John")  // Not "  John  "
```

---

### 4. **What is `===` function?**

**`===`** = "strict equality" operator (not a function, it's an operator)

**What it does:**
- Compares two values for equality
- Returns `true` if they are exactly the same (type and value)
- Returns `false` otherwise

**Examples:**
```javascript
5 === 5        // true
5 === "5"      // false (number vs string)
"John" === "John"  // true
"John" === "john"  // false (case-sensitive)
```

**Why `===` instead of `==`?**
- `==` does type conversion (can be confusing)
- `===` is strict (no conversion, safer)

**Example:**
```javascript
5 == "5"   // true (converts string to number)
5 === "5"  // false (strict, no conversion)
```

**Usage in code:**
```javascript
if (room.masterId === userId) {
  // User is the master
}
```

---

### 5. **What does `Math.ceil` function do?**

**`Math.ceil()`** = "ceiling" - rounds a number UP to the nearest integer

**Examples:**
```javascript
Math.ceil(4.1)   // 5
Math.ceil(4.9)   // 5
Math.ceil(4.0)   // 4
Math.ceil(-4.1)  // -4 (rounds towards positive infinity)
```

**In our code:**
```javascript
const userTimeLeft = Math.ceil((USER_TIMEOUT_MS - inactiveTime) / 1000);
// Example: (1800000 - 1740000) / 1000 = 60.5 seconds
// Math.ceil(60.5) = 61 seconds (round up to show full seconds)
```

**Why use it?**
- Time calculations often result in decimals (e.g., 60.5 seconds)
- We want to show whole seconds to users
- `Math.ceil` ensures we always round up (better to show "61 seconds" than "60 seconds" when there's 60.5 left)

**Other Math functions:**
- `Math.floor()` - rounds DOWN
- `Math.round()` - rounds to nearest
- `Math.ceil()` - rounds UP

---

### 6. **What does `let roomDeleted = false;` do?**

**`let`** = creates a variable that can be changed later

**`roomDeleted = false`** = sets initial value to `false`

**What it does:**
```javascript
let roomDeleted = false;  // Start with "room is not deleted"

// Later in the code:
if (!rooms.has(roomId)) {
  roomDeleted = true;  // Change to "room IS deleted"
}

// At the end:
res.json({ roomDeleted });  // Send true or false to frontend
```

**Why use it?**
- We need to track whether a room was deleted
- Start with `false` (assume room exists)
- Change to `true` if we discover it was deleted
- Send this information to the frontend

**`let` vs `const`:**
- `let` = can be changed
- `const` = cannot be changed

---

### 7. **User last activity is recorded when user does activity, right?**

**Yes, exactly!** `lastActivity` is updated whenever the user does something:

**Activities that update `lastActivity`:**
1. **Login/Register**: When user enters username
2. **Create Room**: When user creates a room
3. **Join Room**: When user joins a room
4. **Heartbeat Ping**: Every 5 minutes (automatic)
5. **Vote**: When user selects someone
6. **Change Role**: When user switches attender/observer
7. **Keep Alive**: When user clicks "로그인 유지" or "방 유지"

**Code example:**
```javascript
// In /api/ping endpoint:
activeUsers.set(username, {
  ...userData,
  lastActivity: Date.now()  // Update timestamp
});
```

**Why track it?**
- To detect inactive users (no activity for 30 minutes = disconnected)
- To show warnings (29 minutes = "You'll be logged out soon")

**You won't see it in logs** unless you add `console.log()`, but it's being updated in the background.

---

### 8. **What is `req.params`?**

**`req.params`** = URL parameters (values in the URL path)

**Example:**
```javascript
// URL: /api/room/abc123
// Route: /api/room/:roomId

app.get('/api/room/:roomId', (req, res) => {
  const roomId = req.params.roomId;  // "abc123"
});
```

**Difference:**
- **`req.body`** = data in the request body (POST data)
- **`req.params`** = data in the URL path (GET/POST/PUT/DELETE)
- **`req.query`** = data in the URL query string (`?key=value`)

**Example:**
```javascript
// URL: /api/room/abc123?status=active
// req.params.roomId = "abc123"
// req.query.status = "active"
```

---

### 9. **What is `globalThis`?**

**`globalThis`** = the global object (available everywhere in Node.js)

**What it is:**
- In browsers: `globalThis` = `window`
- In Node.js: `globalThis` = `global`
- **Universal**: Works in both environments

**Why use it?**
```javascript
if (!globalThis.__linkStationCleanupInterval) {
  globalThis.__linkStationCleanupInterval = setInterval(...);
}
```

**What this does:**
- Stores the cleanup interval timer in the global scope
- Prevents creating multiple timers if the module reloads
- **Problem it solves**: Vercel serverless functions can reload, and we don't want duplicate cleanup timers

**Alternative:**
- Could use `global` (Node.js only)
- Could use `window` (browser only)
- `globalThis` works everywhere

**The `__` prefix:**
- Convention for "internal/private" properties
- Not part of the standard API, just our internal use

---

## 🎯 **Summary**

**Key Concepts:**
1. **`const`** = constant (cannot change)
2. **`async/await`** = wait for slow operations
3. **`module.exports/require`** = share code between files
4. **`req.body/req.params`** = get data from HTTP requests
5. **`===`** = strict equality comparison
6. **`Math.ceil()`** = round up
7. **`globalThis`** = global object (works everywhere)
8. **Serialization** = convert objects to strings for storage
9. **Redis** = shared cloud storage (persistent, multi-instance)
10. **In-memory fallback** = use RAM when Redis is unavailable

**The Big Picture:**
- **Before**: Each server instance had its own memory (rooms disappeared)
- **Now**: All instances share Redis (rooms persist, no disappearing)

---

**Questions?** Feel free to ask for clarification on any concept!

