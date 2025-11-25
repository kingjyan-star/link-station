# 🌐 How `globalThis` Works - Detailed Explanation

## ❌ **Common Misconception**

**"Does `globalThis` look through all files?"**

**Answer: NO!** `globalThis` does NOT search through files. It's about **shared memory within a single process**.

---

## ✅ **What `globalThis` Actually Is**

**`globalThis`** = A **shared memory space** that all files in the same Node.js process can access.

### **Think of it like a shared whiteboard:**

```
┌─────────────────────────────────────────┐
│         globalThis (Shared Memory)      │
│  ┌──────────────────────────────────┐  │
│  │ __linkStationCleanupInterval     │  │
│  │ (the cleanup timer)              │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
         ↑                    ↑
         │                    │
    file1.js            file2.js
    (can read)         (can read)
    (can write)        (can write)
```

**All files in the same process share this whiteboard.**

---

## 🔍 **How It Works Step-by-Step**

### **Step 1: What is a "Process"?**

A **process** = one running instance of Node.js.

```
Process 1 (Server Instance A)
├── api/game.js
├── api/storage.js
└── globalThis (shared by all files in Process 1)

Process 2 (Server Instance B)
├── api/game.js
├── api/storage.js
└── globalThis (separate from Process 1!)
```

**Important:** Each process has its **own** `globalThis`. They don't share!

---

### **Step 2: How Files Access `globalThis`**

**In `api/game.js`:**
```javascript
// Check if cleanup timer already exists
if (!globalThis.__linkStationCleanupInterval) {
  // Create the timer and store it in globalThis
  globalThis.__linkStationCleanupInterval = setInterval(...);
}
```

**What happens:**
1. JavaScript looks in the **current process's globalThis**
2. Checks if `__linkStationCleanupInterval` exists
3. If not, creates it and stores it there
4. If yes, skips creating a duplicate

**It does NOT:**
- ❌ Search through files
- ❌ Look in other processes
- ❌ Read from disk
- ❌ Check other server instances

---

### **Step 3: Why We Need It (The Problem)**

**Without `globalThis`:**

```javascript
// Every time api/game.js loads:
setInterval(() => {
  cleanupInactiveUsersAndRooms();
}, 5000);

// Problem: If the file loads 3 times, we get 3 timers!
// Timer 1: runs cleanup every 5 seconds
// Timer 2: runs cleanup every 5 seconds (duplicate!)
// Timer 3: runs cleanup every 5 seconds (duplicate!)
// Result: Cleanup runs 3 times every 5 seconds! 😱
```

**With `globalThis`:**

```javascript
// First time api/game.js loads:
if (!globalThis.__linkStationCleanupInterval) {
  globalThis.__linkStationCleanupInterval = setInterval(...);
  // Timer created ✅
}

// Second time api/game.js loads (module reload):
if (!globalThis.__linkStationCleanupInterval) {
  // This check is FALSE (timer already exists)
  // So we skip creating a duplicate ✅
}
```

**Result: Only ONE timer exists, even if the file loads multiple times!**

---

## 🏗️ **Real-World Example: Vercel Serverless**

### **Scenario: Vercel Serverless Function**

```
Request 1 arrives → Vercel spins up Instance A
├── Loads api/game.js
├── globalThis.__linkStationCleanupInterval = timer1 ✅
└── Request handled

Request 2 arrives → Vercel uses same Instance A (warm)
├── Reloads api/game.js (module reload)
├── Checks: globalThis.__linkStationCleanupInterval exists?
├── YES! So skip creating timer ✅
└── Request handled (no duplicate timer)

Request 3 arrives → Vercel spins up Instance B (new instance)
├── Loads api/game.js
├── globalThis.__linkStationCleanupInterval = timer2 ✅
│   (This is a DIFFERENT globalThis - separate process!)
└── Request handled
```

**Key Points:**
- **Instance A** has its own `globalThis` (timer1)
- **Instance B** has its own `globalThis` (timer2)
- They are **separate** - they don't share!
- But within each instance, the timer persists across module reloads

---

## 📊 **Visual Comparison**

### **Without `globalThis` (BAD):**

```
Module Load 1: Creates Timer 1
Module Load 2: Creates Timer 2 (duplicate!)
Module Load 3: Creates Timer 3 (duplicate!)
Result: 3 timers running simultaneously ❌
```

### **With `globalThis` (GOOD):**

```
Module Load 1: 
  - globalThis.__linkStationCleanupInterval = undefined
  - Creates Timer 1
  - Stores in globalThis ✅

Module Load 2:
  - globalThis.__linkStationCleanupInterval = Timer 1 (exists!)
  - Skips creating duplicate ✅

Module Load 3:
  - globalThis.__linkStationCleanupInterval = Timer 1 (exists!)
  - Skips creating duplicate ✅

Result: Only 1 timer running ✅
```

---

## 🔑 **Key Concepts**

### **1. Scope Levels**

```javascript
// Local scope (only in this function)
function myFunction() {
  const local = "only here";
}

// Module scope (only in this file)
const moduleVar = "only in this file";

// Global scope (shared by all files in process)
globalThis.shared = "everyone can access";
```

### **2. Accessing `globalThis`**

**You can access it from ANY file:**

```javascript
// In api/game.js:
globalThis.myValue = "hello";

// In api/storage.js:
console.log(globalThis.myValue);  // "hello" ✅

// In any other file:
console.log(globalThis.myValue);  // "hello" ✅
```

**But only within the same process!**

### **3. Why Not Use Regular Variables?**

```javascript
// BAD - lost on module reload:
let cleanupInterval = setInterval(...);
// If file reloads, this variable is lost!

// GOOD - persists across reloads:
globalThis.__linkStationCleanupInterval = setInterval(...);
// Even if file reloads, this persists in globalThis!
```

---

## 🎯 **Summary**

**`globalThis` is:**
- ✅ A shared memory space within a single process
- ✅ Accessible from all files in that process
- ✅ Persists across module reloads
- ✅ Used to prevent duplicate resources (like timers)

**`globalThis` is NOT:**
- ❌ A file search tool
- ❌ Shared across different processes
- ❌ Shared across different server instances
- ❌ A database or file system

**In our code:**
- We use it to store the cleanup timer
- Prevents creating duplicate timers when the module reloads
- Works within each Vercel serverless instance
- Each instance has its own separate `globalThis`

---

## 💡 **Analogy**

**Think of `globalThis` like a shared locker room:**

- **Process 1** = Locker Room A
  - Everyone in Room A can access the shared locker
  - Put something in: `globalThis.myStuff = "value"`
  - Anyone in Room A can read it

- **Process 2** = Locker Room B
  - Completely separate from Room A
  - Has its own shared locker
  - Cannot see what's in Room A's locker

- **Files** = People in the locker room
  - All people in the same room share the locker
  - But people in different rooms have separate lockers

**That's how `globalThis` works!**

---

**Questions?** Feel free to ask for clarification!

