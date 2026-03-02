# AGENTS.md

## Cursor Cloud specific instructions

### Overview
Link Station is a Korean-language real-time multiplayer matching/pairing game. Architecture: Express.js REST API (`api/game.js` — Vercel serverless function) + React SPA (`client/`). Pre-built static React files are committed at the repo root.

### Running locally
The backend API lives in `api/game.js` (Express app export). The legacy `server.js` serves static files + Socket.IO but does **not** mount the REST API routes. To run the full app locally with working API:

```bash
ADMIN_SECRET_KEY="any-secret" node -e "
const api = require('./api/game');
const express = require('express');
const path = require('path');
const mainApp = express();
mainApp.use(api);
mainApp.use(express.static(__dirname));
mainApp.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
mainApp.listen(3000, () => console.log('Dev server running on http://localhost:3000'));
"
```

This serves the pre-built React app on port 3000 with all API routes working. Storage falls back to in-memory (no Redis needed).

For frontend hot-reload development: `cd client && PORT=3001 BROWSER=none npm start` (runs on port 3001). Note: the CRA dev server has no API proxy configured, so API calls from the dev server go to `http://localhost:3000` — start the backend server above first.

### Lint
```bash
cd client && npx eslint src/
```

### Tests
```bash
cd client && CI=true npx react-scripts test --watchAll=false
```
Note: the default CRA test (`App.test.js`) has a pre-existing failure — it looks for "learn react" text which doesn't exist in the customized app.

### Multiplayer testing
To test multiplayer, open multiple browser tabs to `http://localhost:3000`. Each tab is a separate session (uses `sessionStorage`). Create a room in Tab 1, then join it by room name from other tabs. The game requires at least 2 participants to start.

### Known issues
- `server.js` requires `socket.io` which is not listed in `package.json` dependencies. Install it separately: `npm install socket.io`.
