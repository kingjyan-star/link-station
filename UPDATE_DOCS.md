# 📝 Documentation Update Guide

Update **CONTEXT.md** when making significant changes. This file describes when and how.

---

## 🎯 When to Update

- Major features or architecture changes
- Critical bugs fixed
- Before Cursor updates or when context is high (>85%)
- End of major development sessions

---

## 📄 What to Update in CONTEXT.md

1. **Status line** (top) – current state
2. **Last Updated** – date
3. **Deployment** – if build/deploy steps or env vars change
4. **Recent Sessions** – add new session with focus + key changes
5. **Architecture & File Structure** – if VSA structure changes
6. **API Endpoints** – if new endpoints added (details in `api/API_ROUTES.md`)
7. **State Flow** – if states change

---

## 📋 Session Template

```markdown
### Session X: [Name]
**Date:** [Date]
**Focus:** [Brief description]
**Changes:** [Key changes]
**Status:** RESOLVED / IN PROGRESS
```

---

## 🔄 Quick Command for AI

*"Read UPDATE_DOCS.md and update CONTEXT.md"*

---

## ✅ Verification

- [ ] Status line reflects current state
- [ ] New session added if applicable
- [ ] No outdated info (e.g. "pending deploy" when deployed)

---

**Emergency:** Update CONTEXT.md first (single source of truth).
