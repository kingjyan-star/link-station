# Shared UI

**Migration target.** Current implementation lives in `App.js` and `App.css`:

- Password visibility toggle (eye icon)
- Reusable buttons, inputs (if any)
- Notification toasts (error/success)

**To extract:** Create `PasswordInput.jsx`, `Notification.jsx` (or similar). Move related CSS to shared or keep in App.css with scoped classes.
