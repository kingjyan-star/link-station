const express = require('express');
const app = express();

app.use(express.json());

const storage = require('./storage');

// ============================================================================
// ⏰ TIMEOUT & ALARM CONFIGURATION
// ============================================================================
// These constants control when users/rooms timeout and when warnings appear.
// Modify these values to change timeout behavior (all values in milliseconds).
// ============================================================================

// ───────────────────────────────────────────────────────────────────────────
// USER TIMEOUT SETTINGS
// ───────────────────────────────────────────────────────────────────────────
// How long a user can be inactive before being automatically logged out.
// User activity is updated by: heartbeat pings, room actions, game actions.

const USER_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes = 1,800,000 ms
// User is disconnected if no activity for this duration.

const USER_WARNING_MS = 29 * 60 * 1000; // 29 minutes = 1,740,000 ms
// Warning appears when user has been inactive for this duration.
// Warning shows: "You'll be logged out in X seconds" (1 minute before timeout).

// ───────────────────────────────────────────────────────────────────────────
// ROOM TIMEOUT SETTINGS
// ───────────────────────────────────────────────────────────────────────────
// How long a room can be inactive before being automatically deleted.
// Room activity is updated by: game actions (vote, start game, role change, etc.)
// Note: Heartbeat pings do NOT update room activity (only user activity).

const ZOMBIE_ROOM_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours = 7,200,000 ms
// Room is deleted if no game activity for this duration (even if users are present).
// "Zombie room" = room with users but no game activity.

const ROOM_WARNING_MS = (2 * 60 * 60 * 1000) - (60 * 1000); // 1 hour 59 minutes = 7,140,000 ms
// Warning appears when room has been inactive for this duration.
// Warning shows: "Room will be deleted in X seconds" (1 minute before deletion).
// Master can click "방 유지" (Keep Room) to extend room lifetime.

// ───────────────────────────────────────────────────────────────────────────
// CLEANUP INTERVAL
// ───────────────────────────────────────────────────────────────────────────
// How often the backend checks for inactive users and rooms.

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes = 300,000 ms
// Backend runs cleanup job every 5 minutes to:
// - Remove inactive users (30+ min inactive)
// - Delete empty rooms (0 users)
// - Delete zombie rooms (2+ hours inactive)

// ============================================================================
// 📝 HOW TIMEOUTS WORK
// ============================================================================
// USER TIMEOUT:
//   1. User does activity → lastActivity = Date.now()
//   2. Frontend sends heartbeat every 5 minutes → updates lastActivity
//   3. After 29 minutes of inactivity → Warning appears
//   4. After 30 minutes of inactivity → User is disconnected
//
// ROOM TIMEOUT:
//   1. Game action happens → room.lastActivity = Date.now()
//   2. After 1 hour 59 minutes of no game activity → Warning appears
//   3. After 2 hours of no game activity → Room is deleted
//   4. Note: Heartbeat pings do NOT reset room timeout (only game actions do)
//
// CLEANUP JOB:
//   - Runs every 5 minutes
//   - Checks all users and rooms
//   - Removes inactive users and deletes empty/zombie rooms
// ============================================================================

// Helper function to clean up inactive users and empty rooms
async function cleanupInactiveUsersAndRooms() {
  const now = Date.now();
  console.log('🧹 Running cleanup...');

  const activeUserEntries = await storage.listActiveUsers();
  const processedRooms = new Map();

  for (const { username, roomId, userId, lastActivity } of activeUserEntries) {
    const inactiveTime = now - lastActivity;
    if (inactiveTime <= USER_TIMEOUT_MS) {
      continue;
    }

    console.log(`   Found inactive user: ${username} (inactive for ${Math.floor(inactiveTime / 1000)}s)`);
    const room = processedRooms.get(roomId) || (await storage.getRoomById(roomId));

    if (room) {
      const user = room.users.get(userId);
      if (user) {
        user.disconnected = true;
        user.disconnectReason = 'inactivity';
        room.users.set(userId, user);
      }

      room.users.delete(userId);
      room.selections.delete(userId);

      console.log(`   ⚠️ User ${username} removed from room ${room.roomName} due to inactivity`);

      if (room.masterId === userId && room.users.size > 0) {
        const newMaster = Array.from(room.users.values())[0];
        room.masterId = newMaster.id;
        newMaster.isMaster = true;
        room.users.set(newMaster.id, newMaster);
        console.log(`   👑 Master handover: ${newMaster.displayName} is now master of ${room.roomName}`);
      }

      processedRooms.set(roomId, room);
    }

    await storage.deleteActiveUser(username);
  }

  for (const [roomId, room] of processedRooms.entries()) {
    if (room.users.size === 0) {
      await storage.deleteRoom(roomId);
      console.log(`   🗑️ Room "${room.roomName}" deleted - all users left`);
    } else {
      await storage.saveRoom(room);
    }
  }

  await cleanupEmptyRooms(now);

  console.log('🧹 Cleanup complete.');
}

// Helper function to clean up empty and zombie rooms
async function cleanupEmptyRooms(now) {
  const roomIds = await storage.listRoomIds();

  for (const roomId of roomIds) {
    const room = await storage.getRoomById(roomId);
    if (!room) continue;

    const lastActivityTime = room.lastActivity || (room.createdAt ? Date.parse(room.createdAt) : 0);
    const timeSinceActivity = now - lastActivityTime;

    if (room.users.size === 0) {
      await storage.deleteRoom(roomId);
      console.log(`   🗑️ Room "${room.roomName}" deleted - empty room`);
    } else if (timeSinceActivity > ZOMBIE_ROOM_TIMEOUT) {
      await storage.deleteRoom(roomId);
      console.log(`   🧟 Room "${room.roomName}" deleted - zombie room (inactive for ${Math.floor(timeSinceActivity / 1000 / 60)} minutes)`);

      for (const user of room.users.values()) {
        await storage.deleteActiveUser(user.username);
      }
    }
  }
}

if (!globalThis.__linkStationCleanupInterval) {
  globalThis.__linkStationCleanupInterval = setInterval(() => {
    cleanupInactiveUsersAndRooms().catch((error) => {
      console.error('Cleanup error:', error);
    });
  }, CLEANUP_INTERVAL_MS);
  console.log(`🕒 Started cleanup interval (every ${CLEANUP_INTERVAL_MS / 60000} minutes)`);
}

// Run an initial cleanup on cold start
cleanupInactiveUsersAndRooms().catch((error) => {
  console.error('Cleanup error:', error);
});

// Check username duplication
app.post('/api/check-username', async (req, res) => {
  const { username } = req.body;
  
  if (!username || username.trim() === '') {
    return res.json({ duplicate: false });
  }
  
  const userData = await storage.getActiveUser(username.trim());
  const isDuplicate = !!userData;
  res.json({ duplicate: isDuplicate, available: !isDuplicate });
});

// Check room name duplication
app.post('/api/check-roomname', async (req, res) => {
  const { roomName } = req.body;
  
  if (!roomName || roomName.trim() === '') {
    return res.json({ duplicate: false });
  }
  
  const existingRoom = await storage.getRoomByName(roomName.trim().toLowerCase());
  res.json({ duplicate: !!existingRoom });
});

// Create room
app.post('/api/create-room', async (req, res) => {
  const { roomName, roomPassword, memberLimit, username } = req.body;
  
  // Validate input
  if (!roomName || roomName.trim() === '') {
    return res.status(400).json({ success: false, message: '방 이름을 입력해주세요.' });
  }
  
  if (memberLimit < 2 || memberLimit > 99) {
    return res.status(400).json({ success: false, message: '최대 인원은 2-99명 사이여야 합니다.' });
  }
  
  const trimmedRoomName = roomName.trim();
  const roomNameLower = trimmedRoomName.toLowerCase();
  const trimmedUsername = username ? username.trim() : '';

  // Check room name duplication
  console.log(`Creating room: "${roomName}"`);
  
  const existingRoom = await storage.getRoomByName(roomNameLower);
  if (existingRoom) {
    console.log(`❌ Duplicate room name detected: "${roomName}" already exists as "${existingRoom.roomName}"`);
    return res.status(400).json({ success: false, message: '이미 존재하는 방 이름입니다. 다른 이름을 사용해주세요.' });
  }
  
  console.log(`✓ Room name "${roomName}" is available`);
  
  // Check username duplication
  const existingUser = await storage.getActiveUser(trimmedUsername);
  if (existingUser) {
    return res.status(400).json({ success: false, message: '이미 사용 중인 사용자 이름입니다.' });
  }
  
  // Generate room ID
  const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Create room
  const room = {
    id: roomId,
    roomName: trimmedRoomName,
    roomPassword: roomPassword || null,
    memberLimit: parseInt(memberLimit),
    users: new Map(),
    selections: new Map(),
    gameState: 'waiting', // waiting, linking, completed
    matchResult: null,
    masterId: userId,
    createdAt: new Date().toISOString(),
    lastActivity: Date.now() // Track room activity to prevent deletion during active games
  };
  
  // Add user to room
  const user = {
    id: userId,
    username: trimmedUsername,
    displayName: trimmedUsername,
    joinedAt: new Date().toISOString(),
    isMaster: true,
    role: 'attender'
  };
  
  room.users.set(userId, user);
  await storage.saveRoom(room);
  await storage.saveActiveUser(trimmedUsername, {
    roomId,
    userId,
    lastActivity: Date.now()
  });
  
  console.log(`✅ Room created: "${roomName}" (ID: ${roomId}) by "${username}"`);
  
  res.json({
    success: true,
    roomId,
    userId,
    users: Array.from(room.users.values()),
    isMaster: true,
    roomData: {
      roomName: room.roomName,
      memberLimit: room.memberLimit,
      hasPassword: !!room.roomPassword
    }
  });
});

// Join room
app.post('/api/join-room', async (req, res) => {
  const { roomName, username } = req.body;
  
  console.log(`Join room attempt: "${roomName}" by "${username}"`);
  
  const trimmedRoomName = roomName.trim();
  const trimmedUsername = username ? username.trim() : '';
  
  // Find room by name (case-insensitive)
  const targetRoom = await storage.getRoomByName(trimmedRoomName.toLowerCase());
  
  if (!targetRoom) {
    console.log(`Room not found: "${roomName}"`);
    return res.status(404).json({ success: false, message: '방을 찾을 수 없습니다.' });
  }
  
  console.log(`Room found: ${targetRoom.roomName} (${targetRoom.id})`);

  
  // Check if room is full
  if (targetRoom.users.size >= targetRoom.memberLimit) {
    return res.status(400).json({ success: false, message: '방이 가득 찼습니다.' });
  }
  
  // Check if game is in progress
  if (targetRoom.gameState !== 'waiting') {
    return res.status(400).json({ success: false, message: '게임이 진행 중입니다.' });
  }
  
  // Check username duplication
  const existingUser = await storage.getActiveUser(trimmedUsername);
  if (existingUser) {
    return res.status(400).json({ success: false, message: '이미 사용 중인 사용자 이름입니다.' });
  }
  
  // Check if room requires password
  if (targetRoom.roomPassword) {
    return res.json({
      success: true,
      requiresPassword: true,
      message: '비밀번호가 필요합니다.'
    });
  }
  
  // Join room without password
  const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const user = {
    id: userId,
    username: trimmedUsername,
    displayName: trimmedUsername,
    joinedAt: new Date().toISOString(),
    isMaster: false,
    role: 'attender'
  };
  
  targetRoom.users.set(userId, user);
  targetRoom.lastActivity = Date.now(); // Update room activity on join
  await storage.saveRoom(targetRoom);
  await storage.saveActiveUser(trimmedUsername, {
    roomId: targetRoom.id,
    userId,
    lastActivity: Date.now()
  });
  
  console.log(`User joined room: ${username} in ${roomName}`);
  
  res.json({
    success: true,
    roomId: targetRoom.id,
    userId,
    users: Array.from(targetRoom.users.values()),
    isMaster: false,
    role: 'attender',
    roomData: {
      roomName: targetRoom.roomName,
      memberLimit: targetRoom.memberLimit,
      hasPassword: !!targetRoom.roomPassword
    }
  });
});

// Check password
app.post('/api/check-password', async (req, res) => {
  const { roomName, password, username } = req.body;
  
  console.log(`Check password attempt: "${roomName}" by "${username}"`);
  
  // Find room by name (case-insensitive)
  const targetRoom = await storage.getRoomByName(roomName.trim().toLowerCase());
  
  if (!targetRoom) {
    console.log(`Room not found for password check: "${roomName}"`);
    return res.status(404).json({ success: false, message: '방을 찾을 수 없습니다.' });
  }
  
  console.log(`Room found for password check: ${targetRoom.roomName}`);
  
  // Check password
  if (targetRoom.roomPassword !== password) {
    return res.status(400).json({ success: false, message: '비밀번호가 올바르지 않습니다.' });
  }
  
  // Check if room is full
  if (targetRoom.users.size >= targetRoom.memberLimit) {
    return res.status(400).json({ success: false, message: '방이 가득 찼습니다.' });
  }
  
  // Check if game is in progress
  if (targetRoom.gameState !== 'waiting') {
    return res.status(400).json({ success: false, message: '게임이 진행 중입니다.' });
  }
  
  // Check username duplication
  const trimmedUsername = username ? username.trim() : '';
  const existingUser = await storage.getActiveUser(trimmedUsername);
  if (existingUser) {
    return res.status(400).json({ success: false, message: '이미 사용 중인 사용자 이름입니다.' });
  }
  
  // Join room
  const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const user = {
    id: userId,
    username: trimmedUsername,
    displayName: trimmedUsername,
    joinedAt: new Date().toISOString(),
    isMaster: false,
    role: 'attender'
  };
  
  targetRoom.users.set(userId, user);
  targetRoom.lastActivity = Date.now(); // Update room activity on join
  await storage.saveRoom(targetRoom);
  await storage.saveActiveUser(trimmedUsername, {
    roomId: targetRoom.id,
    userId,
    lastActivity: Date.now()
  });
  
  console.log(`User joined room with password: ${username} in ${roomName}`);
  
  res.json({
    success: true,
    roomId: targetRoom.id,
    userId,
    users: Array.from(targetRoom.users.values()),
    isMaster: false,
    role: 'attender',
    roomData: {
      roomName: targetRoom.roomName,
      memberLimit: targetRoom.memberLimit,
      hasPassword: !!targetRoom.roomPassword
    }
  });
});

// Join room with QR
app.post('/api/join-room-qr', async (req, res) => {
  const { roomId, username } = req.body;
  
  const room = await storage.getRoomById(roomId);
  if (!room) {
    return res.status(404).json({ success: false, message: '방을 찾을 수 없습니다.' });
  }
  
  // Check if room is full
  if (room.users.size >= room.memberLimit) {
    return res.status(400).json({ success: false, message: '방이 가득 찼습니다.' });
  }
  
  // Check if game is in progress
  if (room.gameState !== 'waiting') {
    return res.status(400).json({ success: false, message: '게임이 진행 중입니다.' });
  }
  
  // Check username duplication
  const trimmedUsername = username ? username.trim() : '';
  const existingUser = await storage.getActiveUser(trimmedUsername);
  if (existingUser) {
    return res.status(400).json({ success: false, message: '이미 사용 중인 사용자 이름입니다.' });
  }
  
  // Join room
  const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const user = {
    id: userId,
    username: trimmedUsername,
    displayName: trimmedUsername,
    joinedAt: new Date().toISOString(),
    isMaster: false,
    role: 'attender'
  };
  
  room.users.set(userId, user);
  await storage.saveRoom(room);
  await storage.saveActiveUser(trimmedUsername, {
    roomId: room.id,
    userId,
    lastActivity: Date.now()
  });
  
  console.log(`User joined room with QR: ${username} in ${room.roomName}`);
  
  res.json({
    success: true,
    roomId: room.id,
    userId,
    users: Array.from(room.users.values()),
    isMaster: false,
    role: 'attender',
    roomData: {
      roomName: room.roomName,
      memberLimit: room.memberLimit,
      hasPassword: !!room.roomPassword
    }
  });
});

// Start game
app.post('/api/start-game', async (req, res) => {
  const { roomId, userId } = req.body;
  
  const room = await storage.getRoomById(roomId);
  if (!room) {
    return res.status(404).json({ success: false, message: '방을 찾을 수 없습니다.' });
  }
  
  // Check if user is master
  if (room.masterId !== userId) {
    return res.status(403).json({ success: false, message: '방장만 게임을 시작할 수 있습니다.' });
  }
  
  // Check minimum attenders
  const attenders = Array.from(room.users.values()).filter(user => (user.role || 'attender') === 'attender');
  if (attenders.length < 2) {
    return res.status(400).json({ success: false, message: '참가자는 최소 2명 이상 필요합니다.' });
  }
  
  // Start game
  room.gameState = 'linking';
  room.selections.clear();
  room.matchResult = null;
  room.lastActivity = Date.now(); // Prevent room deletion during game
  
  console.log(`Game started in room: ${room.roomName}`);
  await storage.saveRoom(room);
  
  res.json({
    success: true,
    message: '게임이 시작되었습니다!',
    gameState: room.gameState
  });
});

// Select user
app.post('/api/select', async (req, res) => {
  const { roomId, userId, selectedUserId } = req.body;
  
  console.log(`Selection attempt: ${userId} selects ${selectedUserId} in room ${roomId}`);
  
  const room = await storage.getRoomById(roomId);
  if (!room) {
    console.log(`Room not found: ${roomId}`);
    return res.status(404).json({ success: false, message: '방을 찾을 수 없습니다.' });
  }
  
  // Check if user exists in room and is an attender
  if (!room.users.has(userId)) {
    console.log(`User not found in room: ${userId}`);
    return res.status(404).json({ success: false, message: '방에 참여하지 않은 사용자입니다.' });
  }
  
  const user = room.users.get(userId);
  if ((user.role || 'attender') !== 'attender') {
    console.log(`User is not an attender: ${userId}, role: ${user.role}`);
    return res.status(400).json({ success: false, message: '참가자만 투표할 수 있습니다.' });
  }
  
  // Check if selected user exists in room
  if (!room.users.has(selectedUserId)) {
    console.log(`Selected user not found in room: ${selectedUserId}`);
    return res.status(404).json({ success: false, message: '선택한 사용자를 찾을 수 없습니다.' });
  }
  
  // Check if game is in linking phase
  if (room.gameState !== 'linking') {
    console.log(`Game not in linking phase. Current state: ${room.gameState}`);
    return res.status(400).json({ success: false, message: '게임이 링킹 단계가 아닙니다.' });
  }
  
  // Check if user already voted
  if (room.selections.has(userId)) {
    console.log(`User already voted: ${userId}`);
    return res.status(400).json({ success: false, message: '이미 투표하셨습니다.' });
  }
  
  // Record selection
  room.selections.set(userId, selectedUserId);
  room.lastActivity = Date.now(); // Prevent room deletion during voting

  const selectingUser = room.users.get(userId);
  if (selectingUser) {
    const activeUser = await storage.getActiveUser(selectingUser.username);
    if (activeUser) {
      await storage.saveActiveUser(selectingUser.username, {
        ...activeUser,
        lastActivity: Date.now()
      });
    }
  }
  
  console.log(`Selection: ${userId} selects ${selectedUserId} in room ${roomId}`);
  console.log(`Selections so far: ${room.selections.size}/${room.users.size}`);
  
  // Check if all attenders have selected
  const attenders = Array.from(room.users.values()).filter(user => (user.role || 'attender') === 'attender');
  if (room.selections.size === attenders.length) {
    console.log('All users have selected, processing matches...');
    console.log(`Room users size: ${room.users.size}`);
    console.log(`Room selections size: ${room.selections.size}`);
    console.log('All users:', Array.from(room.users.keys()));
    console.log('All selections:', Array.from(room.selections.keys()));
    
    const matches = [];
    const unmatched = [];
    const processedUsers = new Set();
    
    for (const [userId, selectedUserId] of room.selections) {
      if (processedUsers.has(userId)) continue;
      
      const user = room.users.get(userId);
      const selectedUser = room.users.get(selectedUserId);
      
      if (selectedUser && room.selections.get(selectedUserId) === userId) {
        matches.push({
          user1: user,
          user2: selectedUser
        });
        processedUsers.add(userId);
        processedUsers.add(selectedUserId);
        console.log(`Match found: ${user.displayName} <-> ${selectedUser.displayName}`);
      } else {
        unmatched.push(user);
        processedUsers.add(userId);
        console.log(`No match for: ${user.displayName}`);
      }
    }
    
    // Update game state
    room.gameState = 'completed';
    room.matchResult = {
      matches,
      unmatched,
      completedAt: new Date().toISOString()
    };
    
    console.log(`✅ Results calculated: ${matches.length} matches, ${unmatched.length} unmatched`);
    console.log(`✅ Game state changed to: ${room.gameState}`);
    console.log(`✅ Match result stored in room object`);
    await storage.saveRoom(room);
    
    // Return users with voting status even in final response
    const usersWithVotingStatus = Array.from(room.users.values()).map(user => ({
      ...user,
      hasVoted: true, // All users have voted at this point
      isMaster: user.id === room.masterId
    }));
    
    res.json({
      success: true,
      matches,
      unmatched,
      users: usersWithVotingStatus
    });
  } else {
    // Return updated users with voting status
    const usersWithVotingStatus = Array.from(room.users.values()).map(user => ({
      ...user,
      hasVoted: room.selections.has(user.id),
      isMaster: user.id === room.masterId
    }));
    
    await storage.saveRoom(room);
    
    res.json({
      success: true,
      message: '선택이 기록되었습니다. 다른 참여자들의 선택을 기다리는 중...',
      users: usersWithVotingStatus
    });
  }
});

// Heartbeat/Ping endpoint to keep user connection alive
app.post('/api/ping', async (req, res) => {
  const { username, userId } = req.body;
  
  if (username) {
    const userData = await storage.getActiveUser(username);
    if (userData && userData.userId === userId) {
      await storage.saveActiveUser(username, {
        ...userData,
        lastActivity: Date.now()
      });
    }
  }
  
  res.json({ success: true, timestamp: Date.now() });
});

// Check if user or room needs warning
app.post('/api/check-warning', async (req, res) => {
  const { username, userId, roomId } = req.body;
  const now = Date.now();
  
  let userWarning = false;
  let roomWarning = false;
  let userTimeLeft = 0;
  let roomTimeLeft = 0;
  
  // Check user inactivity warning
  if (username) {
    const userData = await storage.getActiveUser(username);
    if (userData && userData.userId === userId) {
      const inactiveTime = now - userData.lastActivity;
      
      if (inactiveTime >= USER_WARNING_MS && inactiveTime < USER_TIMEOUT_MS) {
        userWarning = true;
        userTimeLeft = Math.ceil((USER_TIMEOUT_MS - inactiveTime) / 1000); // seconds left
      }
    }
  }
  
  // Check room inactivity warning (only for master)
  if (roomId) {
    const room = await storage.getRoomById(roomId);
    if (room && room.users.size > 0) {
      const timeSinceActivity = now - (room.lastActivity || 0);
      
      if (timeSinceActivity >= ROOM_WARNING_MS && timeSinceActivity < ZOMBIE_ROOM_TIMEOUT) {
        roomWarning = true;
        roomTimeLeft = Math.ceil((ZOMBIE_ROOM_TIMEOUT - timeSinceActivity) / 1000); // seconds left
      }
    }
  }
  
  // Check if user was disconnected
  const userDisconnected = Boolean(username && !(await storage.getActiveUser(username)));
  
  // Check if room was deleted
  let roomDeleted = false;
  if (roomId) {
    const roomExists = await storage.getRoomById(roomId);
    if (!roomExists) {
      roomDeleted = await storage.wasRoomDeleted(roomId);
    }
  }
  
  res.json({
    success: true,
    userWarning,
    userTimeLeft,
    roomWarning,
    roomTimeLeft,
    userDisconnected,
    roomDeleted
  });
});

// Keep user alive (extend timeout)
app.post('/api/keep-alive-user', async (req, res) => {
  const { username } = req.body;
  
  if (username) {
    const userData = await storage.getActiveUser(username);
    if (userData) {
      await storage.saveActiveUser(username, {
        ...userData,
        lastActivity: Date.now()
      });
      console.log(`✅ User ${username} extended their session`);
    }
  }
  
  res.json({ success: true });
});

// Keep room alive (extend timeout)
app.post('/api/keep-alive-room', async (req, res) => {
  const { roomId } = req.body;
  
  const room = await storage.getRoomById(roomId);
  if (room) {
    room.lastActivity = Date.now();
    await storage.saveRoom(room);
    console.log(`✅ Room "${room.roomName}" extended its lifetime`);
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, message: '방을 찾을 수 없습니다.' });
  }
});

// Remove user from active users when they exit
app.post('/api/remove-user', async (req, res) => {
  const { username } = req.body;
  
  if (username) {
    await storage.deleteActiveUser(username);
    console.log(`👋 User ${username} removed from active users`);
  }
  
  res.json({ success: true });
});

// Change user role (attender/observer)
app.post('/api/change-role', async (req, res) => {
  const { roomId, userId, role } = req.body;
  const room = await storage.getRoomById(roomId);
  
  if (!room) {
    return res.status(404).json({ success: false, message: '방을 찾을 수 없습니다.' });
  }
  
  const user = room.users.get(userId);
  if (!user) {
    return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
  }
  
  // Update user role
  user.role = role;
  room.users.set(userId, user);
  
  // Update lastActivity to keep user and room alive
  const activeUserData = await storage.getActiveUser(user.username);
  if (activeUserData) {
    await storage.saveActiveUser(user.username, {
      ...activeUserData,
      lastActivity: Date.now()
    });
  }
  room.lastActivity = Date.now(); // Prevent room deletion during active use
  await storage.saveRoom(room);
  
  console.log(`🔄 User ${user.displayName} changed role to ${role}`);
  
  // Return updated users list
  const usersWithVotingStatus = Array.from(room.users.values()).map(user => ({
    ...user,
    hasVoted: room.selections.has(user.id),
    isMaster: user.id === room.masterId,
    role: user.role || 'attender' // Default to attender if no role set
  }));
  
  res.json({
    success: true,
    users: usersWithVotingStatus
  });
});

// Return to waiting room after results
app.post('/api/return-to-waiting', async (req, res) => {
  const { roomId, userId } = req.body;
  const room = await storage.getRoomById(roomId);
  
  if (!room) {
    return res.status(404).json({ success: false, message: '방을 찾을 수 없습니다.' });
  }
  
  // Reset game state to waiting
  room.gameState = 'waiting';
  room.selections.clear();
  room.matchResult = null;
  room.lastActivity = Date.now();
  
  console.log(`🔄 Room ${room.roomName} returned to waiting state`);
  await storage.saveRoom(room);
  
  res.json({ success: true });
});

// Get room status
app.get('/api/room/:roomId', async (req, res) => {
  const { roomId } = req.params;
  const room = await storage.getRoomById(roomId);
  
  if (!room) {
    return res.status(404).json({ success: false, message: '방을 찾을 수 없습니다.' });
  }
  
  // Add voting status, master status, and role to users
  const usersWithVotingStatus = Array.from(room.users.values()).map(user => ({
    ...user,
    hasVoted: room.selections.has(user.id),
    isMaster: user.id === room.masterId,
    role: user.role || 'attender' // Default to attender if no role set
  }));
  
  console.log(`📊 Room status request for ${room.roomName}:`);
  console.log(`   Game state: ${room.gameState}`);
  console.log(`   Users: ${room.users.size}, Selections: ${room.selections.size}`);
  console.log(`   Has match result: ${!!room.matchResult}`);
  console.log(`   Users voted: ${Array.from(room.users.values()).filter(u => room.selections.has(u.id)).length}/${room.users.size}`);
  
  res.json({
    success: true,
    room: {
      id: roomId,
      users: usersWithVotingStatus,
      selections: Object.fromEntries(room.selections),
      gameState: room.gameState,
      masterId: room.masterId
    },
    matchResult: room.matchResult
  });
});

// Kick user (master only)
app.post('/api/kick-user', async (req, res) => {
  const { roomId, masterUserId, targetUserId } = req.body;
  
  const room = await storage.getRoomById(roomId);
  if (!room) {
    return res.status(404).json({ success: false, message: '방을 찾을 수 없습니다.' });
  }
  
  // Check if user is master
  if (room.masterId !== masterUserId) {
    return res.status(403).json({ success: false, message: '방장만 사용자를 추방할 수 있습니다.' });
  }
  
  // Check if target user exists
  const targetUser = room.users.get(targetUserId);
  if (!targetUser) {
    return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
  }
  
  // Cannot kick yourself
  if (targetUserId === masterUserId) {
    return res.status(400).json({ success: false, message: '자신을 추방할 수 없습니다.' });
  }
  
  // Remove user from room
  room.users.delete(targetUserId);
  room.selections.delete(targetUserId);
  await storage.deleteActiveUser(targetUser.username);
  room.lastActivity = Date.now(); // Prevent room deletion during kick
  if (room.users.size === 0) {
    await storage.deleteRoom(roomId);
  } else {
    await storage.saveRoom(room);
  }
  
  console.log(`User kicked: ${targetUser.displayName} from ${room.roomName} by master`);
  
  res.json({
    success: true,
    message: '사용자가 추방되었습니다.',
    users: Array.from(room.users.values())
  });
});

// Leave room
app.post('/api/leave-room', async (req, res) => {
  const { roomId, userId } = req.body;
  
  const room = await storage.getRoomById(roomId);
  if (!room) {
    return res.status(404).json({ success: false, message: '방을 찾을 수 없습니다.' });
  }
  
  const user = room.users.get(userId);
  if (!user) {
    return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
  }
  
  // Remove user from room
  room.users.delete(userId);
  room.selections.delete(userId);
  await storage.deleteActiveUser(user.username);
  
  // If user was master, assign new master
  if (room.masterId === userId && room.users.size > 0) {
    const newMaster = room.users.values().next().value;
    room.masterId = newMaster.id;
    newMaster.isMaster = true;
    console.log(`New master assigned: ${newMaster.displayName}`);
  }
  
  // If no users left, delete room
  if (room.users.size === 0) {
    await storage.deleteRoom(roomId);
    console.log(`Room deleted: ${room.roomName}`);
  } else {
    await storage.saveRoom(room);
  }
  
  console.log(`User left room: ${user.displayName} from ${room.roomName}`);
  
  res.json({
    success: true,
    message: '방을 나갔습니다.'
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'API is running' });
});

module.exports = app;