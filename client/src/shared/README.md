# Shared Kernel

The Shared Kernel contains code used by **multiple features**. Per VSA, it must stay minimal. Features must not depend on each other—only on the Shared Kernel.

---

## Cross-Module Protocol (MANDATORY)

Before modifying anything under `shared/`:

1. **Halt & Assess** – Changes here can break multiple features.
2. **Terminal-First Mapping** – Use `grep` or `rg` to find ALL consumers:
   ```bash
   rg "from ['\"].*shared" client/src/
   rg "import.*shared" client/src/
   ```
3. **Backward Compatibility** – Prefer optional parameters. Avoid breaking existing function signatures.
4. **Synchronized Updates** – If a breaking change is required, update every consumer explicitly. Do not assume.

---

## Structure

```
shared/
├── api/         # API client (base URL, fetch helpers)
├── session/     # Session persistence (save/load/clear)
└── ui/          # Shared UI (buttons, inputs, password toggle)
```

---

## Usage Rules

- **Features may import from `shared/` only.** No feature → feature imports.
- **Do not add speculative code.** Add only what is requested.
- **Keep dependencies minimal.** Shared code should have few or no feature-specific concerns.

---

## Current Contents (Migration Target)

| Module   | Status     | Source (App.js)         |
|----------|------------|--------------------------|
| api      | To extract | `API_URL`, fetch calls   |
| session  | To extract | `saveSession`, `loadSession`, `clearSession` |
| ui       | To extract | Password toggle, buttons, inputs |

---

**Last Updated:** 2026-01-22
