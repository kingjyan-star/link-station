# 📝 Documentation Update Guide

This file provides instructions for updating all project documentation files.

---

## 🎯 **When to Update Documentation**

Update documentation files when:
- ✅ Major features are added or changed
- ✅ Critical bugs are fixed
- ✅ Architecture changes occur
- ✅ Before Cursor updates (to preserve context)
- ✅ When context usage is high (>85%)
- ✅ At the end of major development sessions

---

## 📚 **Files to Update**

### **1. PROJECT_CONTEXT.md**
**Purpose:** Comprehensive development history and technical details

**What to update:**
- Status line at the top
- Latest session details in development history
- Bug fixes and resolutions
- New features added
- Architecture changes
- API endpoints (if new ones added)
- State flow changes

**Template for new session:**
```markdown
### Session X: [Feature/Fix Name]
**Date:** [Date]
**Focus:** [Brief description]

**Changes:**
- [Change 1]
- [Change 2]
- [Change 3]

**Files Modified:**
- `file1.js` - [What changed]
- `file2.js` - [What changed]

**Status:** RESOLVED/IN PROGRESS
```

---

### **2. NEW_CHAT_PROMPT.md**
**Purpose:** Quick handover context for new AI assistant chats

**What to update:**
- Status line (current development focus)
- Recent improvements section
- Critical issues (if any exist)
- State flow diagram (if states changed)
- API endpoints list (if new ones added)
- Next steps section

**Keep it concise** - This is a quick reference, not detailed history.

---

### **3. DEPLOYMENT.md**
**Purpose:** Deployment instructions and production status

**What to update:**
- Status line (deployment state)
- Recent improvements/fixes
- Known issues section (add/remove as needed)
- Environment variables (if new ones added)
- Deployment checklist (if process changed)

**Focus on:** What's currently deployed and what's changed recently.

---

## 🔄 **Standard Update Process**

### **Quick Command for AI:**
Just say: **"Read UPDATE_DOCS_GUIDE.md and update all documentation files"**

### **What AI Should Do:**

1. **Read this guide** to understand what needs updating
2. **Review recent changes** from chat history
3. **Update PROJECT_CONTEXT.md:**
   - Add new session with details
   - Update status
   - Mark resolved issues
   - Add new API endpoints/features

4. **Update NEW_CHAT_PROMPT.md:**
   - Update status line
   - Update "Recent Improvements" section
   - Remove resolved critical issues
   - Add new critical issues (if any)
   - Update next steps

5. **Update DEPLOYMENT.md:**
   - Update status line
   - Update "Recent Changes" section
   - Update known issues
   - Update deployment notes if needed

---

## 📋 **Current Session Checklist**

When updating docs, include information about:

### **Recent Major Changes:**
- ✅ Warning system (user/room inactivity warnings)
- ✅ Room management improvements (activity tracking, zombie cleanup)
- ✅ Observer/Attender system
- ✅ State flow reorganization (9 states)
- ✅ Alert system for unexpected events (kicks, disconnections)

### **Recent Bug Fixes:**
- ✅ Room disappearing bug (activity tracking)
- ✅ Polling issues (results not showing)
- ✅ Vote status not updating
- ✅ "방 나가기" button stuck in waiting room

### **Current Architecture:**
- **States:** 9 (registerName, makeOrJoinRoom, makeroom, joinroom, checkpassword, joinroomwithqr, waitingroom, linking, linkresult)
- **User Timeout:** 30 minutes
- **Room Timeout:** 2 hours
- **Warning Lead Time:** 1 minute before timeout
- **Polling Intervals:** 2s (room status), 10s (warnings), 5min (heartbeat)

### **API Endpoints Added Recently:**
- `/api/check-warning` - Check for timeout warnings
- `/api/keep-alive-user` - Extend user session
- `/api/keep-alive-room` - Extend room lifetime
- `/api/change-role` - Switch between attender/observer
- `/api/return-to-waiting` - Return to waiting room after results

---

## 💡 **Tips for AI**

1. **Be specific** - Include exact session numbers and dates
2. **Be concise in NEW_CHAT_PROMPT** - It's a quick reference
3. **Be detailed in PROJECT_CONTEXT** - It's the full history
4. **Update status lines** - Always reflect current state
5. **Mark issues as RESOLVED** - When bugs are fixed
6. **Keep deployment info practical** - Focus on what's deployed now

---

## 🚨 **Emergency Update**

If Cursor is about to update or crash, prioritize:
1. **NEW_CHAT_PROMPT.md** (most critical for continuity)
2. **PROJECT_CONTEXT.md** (full history)
3. **DEPLOYMENT.md** (production state)

---

## ✅ **Verification**

After updating, verify:
- [ ] All three files updated
- [ ] Status lines reflect current state
- [ ] New session added to PROJECT_CONTEXT
- [ ] Recent improvements updated in NEW_CHAT_PROMPT
- [ ] No outdated "Critical Issues" in docs
- [ ] Git commit suggested with updated files

---

**Last Updated:** 2025-11-05
**Purpose:** Ensure documentation stays current and provides excellent context for new chats

