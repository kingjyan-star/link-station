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

// In-memory fallback (for local development with no Redis credentials)
const memoryStore = {
  rooms: new Map(),
  roomNameIndex: new Map(), // roomNameLower -> roomId
  activeUsers: new Map(),
  deletedRooms: new Map()
};

const toSerializableRoom = (room) => ({
  ...room,
  users: Array.from(room.users.entries()),
  selections: Array.from(room.selections.entries())
});

const fromSerializableRoom = (room) => {
  if (!room) return null;
  return {
    ...room,
    users: new Map(room.users || []),
    selections: new Map(room.selections || [])
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
  toSerializableRoom
};

