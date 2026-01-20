const fetchFn = globalThis.fetch;

if (typeof fetchFn !== 'function') {
  throw new Error('Fetch API is not available in this runtime. Please use Node 18+.');
}

const REST_URL = process.env.UPSTASH_REDIS_KV_REST_API_URL;
const REST_TOKEN = process.env.UPSTASH_REDIS_KV_REST_API_TOKEN;
const REDIS_ENABLED = Boolean(REST_URL && REST_TOKEN);

// Redis key helpers
const ROOM_KEY = (roomId) => `room:${roomId}`;
const ROOM_NAME_KEY = (roomNameLower) => `room:name:${roomNameLower}`;
const ROOM_SET_KEY = 'rooms:ids';
const ACTIVE_USER_KEY = (username) => `active:${username}`;
const ACTIVE_USER_SET_KEY = 'active:users';
const DELETED_ROOM_KEY = (roomId) => `room:deleted:${roomId}`;
const DELETED_ROOM_TTL_SECONDS = 10 * 60; // retain deletion info for 10 minutes
const USER_KICKED_KEY = (username) => `user:kicked:${username}`;
const ROOM_DELETED_KEY = (roomId) => `room:deleted:admin:${roomId}`;
const ADMIN_TOKEN_KEY = (token) => `app:admin:token:${token}`;
const ADMIN_SESSION_SET_KEY = 'admin:sessions';
const USER_KICKED_TTL_SECONDS = 30; // 30 seconds - just enough for polling to detect
const ROOM_DELETED_TTL_SECONDS = 30; // 30 seconds

// In-memory fallback (for local development with no Redis credentials)
const memoryStore = {
  rooms: new Map(),
  roomNameIndex: new Map(), // roomNameLower -> roomId
  activeUsers: new Map(),
  deletedRooms: new Map(),
  appShutdown: false,
  adminPassword: null,
  userKicked: new Map(),
  roomDeletedByAdmin: new Map(),
  adminTokens: new Map()
};

const toSerializableRoom = (room) => ({
  ...room,
  users: Array.from(room.users.entries()),
  selections: Array.from(room.selections.entries()),
  returnedToWaiting: room.returnedToWaiting ? Array.from(room.returnedToWaiting) : []
});

const fromSerializableRoom = (room) => {
  if (!room) return null;
  return {
    ...room,
    users: new Map(room.users || []),
    selections: new Map(room.selections || []),
    returnedToWaiting: room.returnedToWaiting ? new Set(room.returnedToWaiting) : new Set()
  };
};

async function redisRequest(command, args = [], options = {}) {
  const { method = 'GET', body } = options;
  const url = `${REST_URL}/${command}/${args.map((arg) => encodeURIComponent(arg)).join('/')}`;
  const response = await fetchFn(url, {
    method,
    headers: {
      Authorization: `Bearer ${REST_TOKEN}`
    },
    body
  });
  const data = await response.json();
  if ('error' in data) {
    throw new Error(`Redis error (${command}): ${data.error}`);
  }
  return data.result;
}

// ---------- Room helpers ----------

async function getRoomById(roomId) {
  if (!roomId) return null;
  if (!REDIS_ENABLED) {
    return memoryStore.rooms.get(roomId) || null;
  }
  const result = await redisRequest('get', [ROOM_KEY(roomId)]);
  if (!result) return null;
  return fromSerializableRoom(JSON.parse(result));
}

async function getRoomByName(roomNameLower) {
  if (!roomNameLower) return null;
  if (!REDIS_ENABLED) {
    const roomId = memoryStore.roomNameIndex.get(roomNameLower);
    if (!roomId) return null;
    return memoryStore.rooms.get(roomId) || null;
  }
  const roomId = await redisRequest('get', [ROOM_NAME_KEY(roomNameLower)]);
  if (!roomId) return null;
  return getRoomById(roomId);
}

async function saveRoom(room) {
  if (!room || !room.id) return;
  const serializable = JSON.stringify(toSerializableRoom(room));
  const roomNameLower = room.roomName.toLowerCase();

  if (!REDIS_ENABLED) {
    memoryStore.rooms.set(room.id, room);
    memoryStore.roomNameIndex.set(roomNameLower, room.id);
    return;
  }

  await redisRequest('set', [ROOM_KEY(room.id), serializable], { method: 'POST' });
  await redisRequest('sadd', [ROOM_SET_KEY, room.id], { method: 'POST' });
  await redisRequest('set', [ROOM_NAME_KEY(roomNameLower), room.id], { method: 'POST' });
}

async function deleteRoom(roomId) {
  if (!roomId) return;

  if (!REDIS_ENABLED) {
    const room = memoryStore.rooms.get(roomId);
    if (room) {
      memoryStore.rooms.delete(roomId);
      memoryStore.roomNameIndex.delete(room.roomName.toLowerCase());
      memoryStore.deletedRooms.set(roomId, Date.now());
    }
    return;
  }

  const room = await getRoomById(roomId);
  await redisRequest('del', [ROOM_KEY(roomId)], { method: 'POST' });
  await redisRequest('srem', [ROOM_SET_KEY, roomId], { method: 'POST' });
  if (room) {
    await redisRequest('del', [ROOM_NAME_KEY(room.roomName.toLowerCase())], { method: 'POST' });
  }
  await redisRequest('setex', [DELETED_ROOM_KEY(roomId), DELETED_ROOM_TTL_SECONDS, Date.now().toString()], { method: 'POST' });
}

async function listRoomIds() {
  if (!REDIS_ENABLED) {
    return Array.from(memoryStore.rooms.keys());
  }
  const result = await redisRequest('smembers', [ROOM_SET_KEY]);
  if (!result) return [];
  return Array.isArray(result) ? result : [result];
}

async function markRoomDeleted(roomId) {
  if (!roomId) return;
  if (!REDIS_ENABLED) {
    memoryStore.deletedRooms.set(roomId, Date.now());
    return;
  }
  await redisRequest('setex', [DELETED_ROOM_KEY(roomId), DELETED_ROOM_TTL_SECONDS, Date.now().toString()], { method: 'POST' });
}

async function wasRoomDeleted(roomId) {
  if (!roomId) return false;
  if (!REDIS_ENABLED) {
    const deletedAt = memoryStore.deletedRooms.get(roomId);
    if (!deletedAt) return false;
    if (Date.now() - deletedAt > DELETED_ROOM_TTL_SECONDS * 1000) {
      memoryStore.deletedRooms.delete(roomId);
      return false;
    }
    return true;
  }

  const result = await redisRequest('get', [DELETED_ROOM_KEY(roomId)]);
  return Boolean(result);
}

// ---------- Active user helpers ----------

async function getActiveUser(username) {
  if (!username) return null;
  if (!REDIS_ENABLED) {
    return memoryStore.activeUsers.get(username) || null;
  }
  const result = await redisRequest('get', [ACTIVE_USER_KEY(username)]);
  if (!result) return null;
  return JSON.parse(result);
}

async function saveActiveUser(username, userData) {
  if (!username) return;
  const serializable = JSON.stringify(userData);

  if (!REDIS_ENABLED) {
    memoryStore.activeUsers.set(username, userData);
    return;
  }

  await redisRequest('set', [ACTIVE_USER_KEY(username), serializable], { method: 'POST' });
  await redisRequest('sadd', [ACTIVE_USER_SET_KEY, username], { method: 'POST' });
}

async function deleteActiveUser(username) {
  if (!username) return;

  if (!REDIS_ENABLED) {
    memoryStore.activeUsers.delete(username);
    return;
  }

  await redisRequest('del', [ACTIVE_USER_KEY(username)], { method: 'POST' });
  await redisRequest('srem', [ACTIVE_USER_SET_KEY, username], { method: 'POST' });
}

async function listActiveUsers() {
  if (!REDIS_ENABLED) {
    return Array.from(memoryStore.activeUsers.entries()).map(([username, data]) => ({
      username,
      ...data
    }));
  }

  const usernames = await redisRequest('smembers', [ACTIVE_USER_SET_KEY]);
  const list = [];
  if (!usernames) return list;

  const normalized = Array.isArray(usernames) ? usernames : [usernames];
  for (const username of normalized) {
    const data = await getActiveUser(username);
    if (data) {
      list.push({ username, ...data });
    }
  }
  return list;
}

// ---------- App state helpers (shutdown state & admin password) ----------

const APP_SHUTDOWN_KEY = 'app:shutdown';
const ADMIN_PASSWORD_KEY = 'app:admin:password';
const ADMIN_TOKEN_TTL_SECONDS = 30 * 60; // 30 minutes

async function getAppShutdown() {
  if (!REDIS_ENABLED) {
    return memoryStore.appShutdown || false;
  }
  const result = await redisRequest('get', [APP_SHUTDOWN_KEY]);
  return result === 'true' || result === true;
}

async function setAppShutdown(shutdown) {
  if (!REDIS_ENABLED) {
    memoryStore.appShutdown = shutdown;
    return;
  }
  await redisRequest('set', [APP_SHUTDOWN_KEY, shutdown ? 'true' : 'false'], { method: 'POST' });
}

async function getAdminPassword() {
  // First check Redis/storage, then fall back to env var
  if (!REDIS_ENABLED) {
    return memoryStore.adminPassword || process.env.ADMIN_SECRET_KEY || null;
  }
  const result = await redisRequest('get', [ADMIN_PASSWORD_KEY]);
  // If not in Redis, use env var as default
  return result || process.env.ADMIN_SECRET_KEY || null;
}

async function setAdminPassword(password) {
  if (!REDIS_ENABLED) {
    memoryStore.adminPassword = password;
    return;
  }
  await redisRequest('set', [ADMIN_PASSWORD_KEY, password], { method: 'POST' });
}

async function storeAdminToken(token) {
  if (!token) return;
  if (!REDIS_ENABLED) {
    memoryStore.adminTokens.set(token, Date.now() + ADMIN_TOKEN_TTL_SECONDS * 1000);
    return;
  }
  await redisRequest('sadd', [ADMIN_SESSION_SET_KEY, token], { method: 'POST' });
  await redisRequest('setex', [ADMIN_TOKEN_KEY(token), ADMIN_TOKEN_TTL_SECONDS, '1'], { method: 'POST' });
}

async function isAdminTokenValid(token) {
  if (!token) return false;
  if (!REDIS_ENABLED) {
    const expiresAt = memoryStore.adminTokens.get(token);
    if (!expiresAt) return false;
    if (Date.now() > expiresAt) {
      memoryStore.adminTokens.delete(token);
      return false;
    }
    return true;
  }
  const result = await redisRequest('get', [ADMIN_TOKEN_KEY(token)]);
  return Boolean(result);
}

async function deleteAdminToken(token) {
  if (!token) return;
  if (!REDIS_ENABLED) {
    memoryStore.adminTokens.delete(token);
    return;
  }
  await redisRequest('srem', [ADMIN_SESSION_SET_KEY, token], { method: 'POST' });
  await redisRequest('del', [ADMIN_TOKEN_KEY(token)], { method: 'POST' });
}

async function getAdminTokenTtlSeconds(token) {
  if (!token) return 0;
  if (!REDIS_ENABLED) {
    const expiresAt = memoryStore.adminTokens.get(token);
    if (!expiresAt) return 0;
    const remainingMs = expiresAt - Date.now();
    return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
  }
  const result = await redisRequest('ttl', [ADMIN_TOKEN_KEY(token)]);
  if (typeof result !== 'number' || result < 0) {
    return 0;
  }
  return result;
}

async function listAdminSessions() {
  if (!REDIS_ENABLED) {
    return Array.from(memoryStore.adminTokens.entries())
      .map(([token, expiresAt]) => ({
        token,
        remainingSeconds: Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))
      }))
      .filter((session) => session.remainingSeconds > 0);
  }

  const tokens = await redisRequest('smembers', [ADMIN_SESSION_SET_KEY]);
  if (!tokens) return [];
  const normalized = Array.isArray(tokens) ? tokens : [tokens];
  const sessions = [];

  for (const token of normalized) {
    const ttl = await redisRequest('ttl', [ADMIN_TOKEN_KEY(token)]);
    if (typeof ttl !== 'number' || ttl <= 0) {
      await redisRequest('srem', [ADMIN_SESSION_SET_KEY, token], { method: 'POST' });
      continue;
    }
    sessions.push({ token, remainingSeconds: ttl });
  }
  return sessions;
}

// ---------- Admin action markers (for alerts) ----------

async function markUserKickedByAdmin(username) {
  if (!username) return;
  if (!REDIS_ENABLED) {
    memoryStore.userKicked.set(username, Date.now());
    return;
  }
  await redisRequest('setex', [USER_KICKED_KEY(username), USER_KICKED_TTL_SECONDS, '1'], { method: 'POST' });
}

async function wasUserKickedByAdmin(username) {
  if (!username) return false;
  if (!REDIS_ENABLED) {
    return memoryStore.userKicked.has(username);
  }
  const result = await redisRequest('get', [USER_KICKED_KEY(username)]);
  return Boolean(result);
}

async function markRoomDeletedByAdmin(roomId) {
  if (!roomId) return;
  if (!REDIS_ENABLED) {
    memoryStore.roomDeletedByAdmin.set(roomId, Date.now());
    return;
  }
  await redisRequest('setex', [ROOM_DELETED_KEY(roomId), ROOM_DELETED_TTL_SECONDS, '1'], { method: 'POST' });
}

async function wasRoomDeletedByAdmin(roomId) {
  if (!roomId) return false;
  if (!REDIS_ENABLED) {
    return memoryStore.roomDeletedByAdmin.has(roomId);
  }
  const result = await redisRequest('get', [ROOM_DELETED_KEY(roomId)]);
  return Boolean(result);
}

module.exports = {
  REDIS_ENABLED,
  getRoomById,
  getRoomByName,
  saveRoom,
  deleteRoom,
  listRoomIds,
  markRoomDeleted,
  wasRoomDeleted,
  getActiveUser,
  saveActiveUser,
  deleteActiveUser,
  listActiveUsers,
  fromSerializableRoom,
  toSerializableRoom,
  getAppShutdown,
  setAppShutdown,
  getAdminPassword,
  setAdminPassword,
  storeAdminToken,
  isAdminTokenValid,
  deleteAdminToken,
  getAdminTokenTtlSeconds,
  listAdminSessions,
  markUserKickedByAdmin,
  wasUserKickedByAdmin,
  markRoomDeletedByAdmin,
  wasRoomDeletedByAdmin
};

