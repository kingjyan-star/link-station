#!/usr/bin/env node
'use strict';
const app = require('./api/game.js');
const PORT = process.env.API_PORT || 5000;
app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
