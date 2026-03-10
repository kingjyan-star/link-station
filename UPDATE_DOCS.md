# 📝 Documentation Update Guide

Update docs when making significant changes. **There is no automatic update**—you or the AI must run this when context is high (>85%) or at session end.

---

## 📌 Mandatory Rules (Always Follow When Applicable)

### Rule 1: Version Update on Deploy (MANDATORY)

**Every deployment must include a version bump.** When deploying, **always**:

1. **Ask the user for the version number** (or show recent 3 versions) before updating package.json, App.js console.log, or docs.
2. **Show at least the 3 most recent versions** with short explanations so the user can decide the next version:
   ```
   Recent versions:
   - v3.0.3 – UX: user cards, room capacity, Telepathy/Liar polish, result snapshot
   - v3.0.2 – Liar spec messages, keep-alive pings, voter display
   - v3.0.1 – Liar Game 14 fixes, API test script
   
   What version for this deploy? (e.g. 3.0.2, 3.1.0)
   ```
3. After user confirms, update: `package.json`, `client/src/App.js` (console.log), `CONTEXT.md` status, `README.md` if applicable.

---

### Rule 2: Recording Current Status

**During work** – record in-progress updates in documentation (e.g. CONTEXT.md "Current work in progress" section) so context is not lost across turns or context limits.

**As soon as work is cleared** – delete the content of "Current work in progress" (the checklist items). **The section itself stays** – leave a placeholder like *Empty – add tasks when starting new work.* Do not leave stale in-progress items.

| When | Action |
|------|--------|
| Starting/fixing something | Add to "Current work in progress" in CONTEXT.md |
| Task completed | Remove completed items from "Current work in progress"; when all done, clear content and leave placeholder |
| Session end | Clear content if all done; do not leave dangling items |

---

## 🎯 When to Update

- Major features or architecture changes
- Critical bugs fixed
- Before Cursor updates or when context is high (>85%)
- End of major development sessions

---

## 📄 Which File to Update

| File | Update when |
|------|-------------|
| **CONTEXT.md** | Always—status, sessions, deployment, overview |
| **ARCHITECTURE.md** | When VSA structure, features, or routing change |
| **project_config.md** | When global coding rules or directives change |
| **.cursor/rules/*.mdc** | When rule globs or instructions change |

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

*"Read UPDATE_DOCS.md and update all documentation"*

Or: *"Read UPDATE_DOCS.md and update CONTEXT.md"* (CONTEXT only)

---

## ✅ Verification

- [ ] Status line reflects current state
- [ ] New session added if applicable
- [ ] No outdated info (e.g. "pending deploy" when deployed)

---

**Emergency:** Update CONTEXT.md first (single source of truth).

**Note:** Docs do not auto-update. When context grows (>85%) or at session end, run: *"Read UPDATE_DOCS.md and update all documentation"*
