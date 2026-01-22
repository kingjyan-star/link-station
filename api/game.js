const express = require('express');
const crypto = require('crypto');
const app = express();

app.use(express.json());

const storage = require('./storage');

const ADMIN_USERNAME = 'link-station-admin';

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
    
    // Set kick marker for inactivity
    await storage.setUserKickMarker(username, storage.KICK_REASONS.INACTIVITY);
    
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
      await storage.setRoomDeleteMarker(roomId, storage.ROOM_DELETE_REASONS.EMPTY);
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
      await storage.setRoomDeleteMarker(roomId, storage.ROOM_DELETE_REASONS.INACTIVITY);
      
      for (const user of room.users.values()) {
        await storage.setUserKickMarker(user.username, storage.KICK_REASONS.ROOM_DELETED, storage.ROOM_DELETE_REASONS.INACTIVITY);
        await storage.deleteActiveUser(user.username);
      }
      
      await storage.deleteRoom(roomId);
      console.log(`   🧟 Room "${room.roomName}" deleted - zombie room (inactive for ${Math.floor(timeSinceActivity / 1000 / 60)} minutes)`);
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

  if (username.trim().toLowerCase() === ADMIN_USERNAME) {
    return res.json({ duplicate: false, available: true, reserved: true });
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
  
  // Check if app is shutdown (block all users including admin from creating rooms)
  const isShutdown = await storage.getAppShutdown();
  if (isShutdown) {
    return res.status(503).json({ success: false, message: '앱이 종료되어 게임을 할 수 없습니다.' });
  }
  
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

  if (trimmedUsername.toLowerCase() === ADMIN_USERNAME) {
    return res.status(400).json({ success: false, message: '관리자 전용 이름입니다. 다른 이름을 사용해주세요.' });
  }

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
    returnedToWaiting: new Set(), // Track which users have returned to waiting room after results
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
  
  // Check if app is shutdown (block all users including admin from joining rooms)
  const isShutdown = await storage.getAppShutdown();
  if (isShutdown) {
    return res.status(503).json({ success: false, message: '앱이 종료되어 게임을 할 수 없습니다.' });
  }
  
  const trimmedRoomName = roomName.trim();
  const trimmedUsername = username ? username.trim() : '';

  if (trimmedUsername.toLowerCase() === ADMIN_USERNAME) {
    return res.status(400).json({ success: false, message: '관리자 전용 이름입니다. 다른 이름을 사용해주세요.' });
  }
  
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
  if (trimmedUsername.toLowerCase() === ADMIN_USERNAME) {
    return res.status(400).json({ success: false, message: '관리자 전용 이름입니다. 다른 이름을 사용해주세요.' });
  }
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
  
  // Check if app is shutdown (block all users including admin from joining rooms)
  const isShutdown = await storage.getAppShutdown();
  if (isShutdown) {
    return res.status(503).json({ success: false, message: '앱이 종료되어 게임을 할 수 없습니다.' });
  }
  
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
  if (trimmedUsername.toLowerCase() === ADMIN_USERNAME) {
    return res.status(400).json({ success: false, message: '관리자 전용 이름입니다. 다른 이름을 사용해주세요.' });
  }
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
  
  // Check if room is in waiting state (all users must be back from results)
  if (room.gameState !== 'waiting') {
    return res.status(400).json({ 
      success: false, 
      message: '모든 사용자가 대기실로 돌아올 때까지 기다려주세요.' 
    });
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
  // Clear returnedToWaiting tracking for new game
  if (room.returnedToWaiting) {
    room.returnedToWaiting.clear();
  } else {
    room.returnedToWaiting = new Set();
  }
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
  
  // ========== UNIFIED MARKER CHECK ==========
  const userKickMarker = username ? await storage.getUserKickMarker(username) : null;
  const roomDeleteMarker = roomId ? await storage.getRoomDeleteMarker(roomId) : null;
  
  let kickReason = userKickMarker ? userKickMarker.reason : null;
  let roomDeleteReason = null;
  
  if (userKickMarker && userKickMarker.roomDeleteReason) {
    roomDeleteReason = userKickMarker.roomDeleteReason;
  } else if (roomDeleteMarker) {
    roomDeleteReason = roomDeleteMarker.reason;
  }
  
  // Legacy: Check if user was disconnected (only if no marker)
  let userDisconnected = false;
  if (!kickReason) {
    userDisconnected = Boolean(username && !(await storage.getActiveUser(username)));
  }
  
  // Legacy: Check if room was deleted (only if no marker)
  let roomDeleted = false;
  if (!roomDeleteReason && roomId) {
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
    kickReason,
    roomDeleteReason,
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
  
  // Block role changes during game (only allow in waiting state)
  if (room.gameState !== 'waiting') {
    return res.status(400).json({ success: false, message: '게임 중에는 역할을 변경할 수 없습니다.' });
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
  
  // Initialize returnedToWaiting Set if it doesn't exist (for rooms created before this update)
  if (!room.returnedToWaiting) {
    room.returnedToWaiting = new Set();
  }
  
  // Mark this user as returned to waiting room
  room.returnedToWaiting.add(userId);
  
  // Get all attenders (users who need to return)
  const attenders = Array.from(room.users.values()).filter(user => (user.role || 'attender') === 'attender');
  const allReturned = attenders.every(user => room.returnedToWaiting.has(user.id));
  
  // Only set gameState to 'waiting' when ALL attenders have returned
  if (allReturned) {
    room.gameState = 'waiting';
    room.selections.clear();
    room.matchResult = null;
    console.log(`🔄 Room ${room.roomName} - All users returned to waiting state`);
  } else {
    console.log(`🔄 Room ${room.roomName} - User returned, waiting for others (${room.returnedToWaiting.size}/${attenders.length})`);
  }
  
  room.lastActivity = Date.now();
  await storage.saveRoom(room);
  
  res.json({ 
    success: true,
    allReturned,
    returnedCount: room.returnedToWaiting.size,
    totalAttenders: attenders.length
  });
});

// Get room status
app.get('/api/room/:roomId', async (req, res) => {
  const { roomId } = req.params;
  const { username } = req.query; // Get requesting user's username for admin kick check
  const room = await storage.getRoomById(roomId);
  
  if (!room) {
    // Check if room was deleted by admin
    const wasDeletedByAdmin = await storage.wasRoomDeletedByAdmin(roomId);
    // Also check if the requesting user was kicked by admin
    const wasKickedByAdmin = username ? await storage.wasUserKickedByAdmin(username) : false;
    return res.json({ 
      success: false, 
      message: '방을 찾을 수 없습니다.',
      roomDeletedByAdmin: wasDeletedByAdmin,
      kickedByAdmin: wasKickedByAdmin ? [username] : undefined
    });
  }
  
  // Initialize returnedToWaiting Set if it doesn't exist (for rooms created before this update)
  if (!room.returnedToWaiting) {
    room.returnedToWaiting = new Set();
  }
  
  // Add voting status, master status, role, and returned status to users
  const usersWithVotingStatus = Array.from(room.users.values()).map(user => ({
    ...user,
    hasVoted: room.selections.has(user.id),
    isMaster: user.id === room.masterId,
    role: user.role || 'attender', // Default to attender if no role set
    hasReturnedToWaiting: room.returnedToWaiting.has(user.id) // Track if user returned from results
  }));
  
  console.log(`📊 Room status request for ${room.roomName}:`);
  console.log(`   Game state: ${room.gameState}`);
  console.log(`   Users: ${room.users.size}, Selections: ${room.selections.size}`);
  console.log(`   Has match result: ${!!room.matchResult}`);
  console.log(`   Users voted: ${Array.from(room.users.values()).filter(u => room.selections.has(u.id)).length}/${room.users.size}`);
  
  // Check if requesting user was kicked by admin (user not in room but was kicked)
  const kickedUsers = [];
  if (username && await storage.wasUserKickedByAdmin(username)) {
    kickedUsers.push(username);
  }
  // Also check users still in room (edge case)
  for (const user of usersWithVotingStatus) {
    if (await storage.wasUserKickedByAdmin(user.username)) {
      if (!kickedUsers.includes(user.username)) {
        kickedUsers.push(user.username);
      }
    }
  }
  
  res.json({
    success: true,
    room: {
      id: roomId,
      users: usersWithVotingStatus,
      selections: Object.fromEntries(room.selections),
      gameState: room.gameState,
      masterId: room.masterId
    },
    matchResult: room.matchResult,
    kickedByAdmin: kickedUsers.length > 0 ? kickedUsers : undefined,
    roomDeletedByAdmin: false // Room still exists, so not deleted
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
  
  // Set kick marker for master kick
  await storage.setUserKickMarker(targetUser.username, storage.KICK_REASONS.MASTER);
  
  // Remove user from room
  room.users.delete(targetUserId);
  room.selections.delete(targetUserId);
  await storage.deleteActiveUser(targetUser.username);
  room.lastActivity = Date.now();
  if (room.users.size === 0) {
    await storage.setRoomDeleteMarker(roomId, storage.ROOM_DELETE_REASONS.EMPTY);
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

// ============================================================================
// 🔐 ADMIN ENDPOINTS
// ============================================================================
// Admin password is stored in ADMIN_SECRET_KEY environment variable
// 2nd password for changing admin password is hardcoded: "19951025"
// ============================================================================

const ADMIN_SECOND_PASSWORD = '19951025'; // Hardcoded 2nd password for changing admin password
const ADMIN_TOKEN_TTL_SECONDS = 30 * 60; // 30 minutes

// Helper function to verify admin password
async function verifyAdminPassword(password) {
  const storedPassword = await storage.getAdminPassword();
  if (!storedPassword) {
    return false;
  }
  return password === storedPassword;
}

function getAdminToken(req) {
  return req.get('x-admin-token') || (req.body ? req.body.token : null);
}

async function requireAdminToken(req, res, options = { refresh: true }) {
  const token = getAdminToken(req);
  if (!token) {
    res.status(401).json({ success: false, message: '관리자 토큰이 필요합니다.' });
    return null;
  }
  const isValid = await storage.isAdminTokenValid(token);
  if (!isValid) {
    res.status(401).json({ success: false, message: '관리자 세션이 만료되었습니다. 다시 로그인해주세요.' });
    return null;
  }
  if (options.refresh) {
    // Sliding expiration: keep admin logged in while actively using admin endpoints.
    await storage.storeAdminToken(token);
  }
  return token;
}

// Admin login (verify password)
app.post('/api/admin-login', async (req, res) => {
  const { password } = req.body;
  
  if (await verifyAdminPassword(password)) {
    const token = crypto.randomBytes(32).toString('hex');
    await storage.storeAdminToken(token);
    return res.json({ 
      success: true, 
      message: '관리자 인증 성공',
      token,
      expiresIn: ADMIN_TOKEN_TTL_SECONDS
    });
  } else {
    return res.status(403).json({ success: false, message: '비밀번호가 올바르지 않습니다.' });
  }
});

// Admin logout (revoke token)
app.post('/api/admin-logout', async (req, res) => {
  const token = getAdminToken(req);
  if (token) {
    await storage.deleteAdminToken(token);
  }
  return res.json({ success: true });
});

// Admin token status (for warning before logout)
app.get('/api/admin-token-status', async (req, res) => {
  const token = await requireAdminToken(req, res, { refresh: false });
  if (!token) return;
  const remainingSeconds = await storage.getAdminTokenTtlSeconds(token);
  if (remainingSeconds <= 0) {
    return res.status(401).json({ success: false, message: '관리자 세션이 만료되었습니다. 다시 로그인해주세요.' });
  }
  return res.json({
    success: true,
    remainingSeconds,
    warning: remainingSeconds <= 60
  });
});

// Keep admin session alive (explicit refresh)
app.post('/api/admin-keep-alive', async (req, res) => {
  const token = await requireAdminToken(req, res, { refresh: true });
  if (!token) return;
  return res.json({ success: true });
});

// Get shutdown status
app.get('/api/admin-shutdown-status', async (req, res) => {
  const isShutdown = await storage.getAppShutdown();
  return res.json({ success: true, isShutdown });
});

// Toggle shutdown state
app.post('/api/admin-shutdown', async (req, res) => {
  const { shutdown } = req.body;
  
  const token = await requireAdminToken(req, res);
  if (!token) return;
  
  await storage.setAppShutdown(shutdown === true);
  return res.json({ 
    success: true, 
    message: shutdown ? '앱이 종료되었습니다.' : '앱이 복구되었습니다.',
    isShutdown: shutdown === true
  });
});

// Get admin status (counts of rooms and users by type)
app.post('/api/admin-status', async (req, res) => {
  const token = await requireAdminToken(req, res);
  if (!token) return;
  
  try {
    const adminSessions = await storage.listAdminSessions();
    const allRooms = [];
    const allRoomIds = await storage.listRoomIds();
    for (const roomId of allRoomIds) {
      const room = await storage.getRoomById(roomId);
      if (room) {
        allRooms.push(room);
      }
    }
    
    const allUsers = await storage.listActiveUsers();
    
    // Count rooms by type
    const roomCounts = {
      total: allRooms.length,
      waiting: 0,
      playing: 0,
      result: 0
    };
    
    // Count users by type
    const userCounts = {
      total: allUsers.length,
      notInRoom: 0,
      waiting: 0,
      playing: 0,
      result: 0
    };
    
    // Categorize rooms
    for (const room of allRooms) {
      if (room.gameState === 'waiting') {
        roomCounts.waiting++;
      } else if (room.gameState === 'linking') {
        roomCounts.playing++;
      } else if (room.gameState === 'completed') {
        roomCounts.result++;
      }
    }
    
    // Categorize users
    const roomMap = new Map();
    for (const room of allRooms) {
      for (const user of room.users.values()) {
        roomMap.set(user.username, room);
      }
    }
    
    for (const user of allUsers) {
      const room = roomMap.get(user.username);
      if (!room) {
        userCounts.notInRoom++;
      } else {
        if (room.gameState === 'waiting') {
          userCounts.waiting++;
        } else if (room.gameState === 'linking') {
          userCounts.playing++;
        } else if (room.gameState === 'completed') {
          userCounts.result++;
        }
      }
    }
    
    return res.json({
      success: true,
      roomCounts,
      userCounts,
      adminSessions: {
        total: adminSessions.length
      }
    });
  } catch (error) {
    console.error('Admin status error:', error);
    return res.status(500).json({ success: false, message: '상태 조회 중 오류가 발생했습니다.' });
  }
});

// Get users list (with filter)
app.post('/api/admin-users', async (req, res) => {
  const { filter } = req.body; // filter: 'all', 'notInRoom', 'waiting', 'playing', 'result'
  
  const token = await requireAdminToken(req, res);
  if (!token) return;
  
  try {
    const allUsers = await storage.listActiveUsers();
    const allRooms = [];
    const allRoomIds = await storage.listRoomIds();
    for (const roomId of allRoomIds) {
      const room = await storage.getRoomById(roomId);
      if (room) {
        allRooms.push(room);
      }
    }
    
    // Build room map
    const roomMap = new Map();
    const userRoomState = new Map();
    for (const room of allRooms) {
      for (const user of room.users.values()) {
        roomMap.set(user.username, room);
        userRoomState.set(user.username, {
          roomId: room.id,
          roomName: room.roomName,
          gameState: room.gameState,
          isMaster: user.isMaster
        });
      }
    }
    
    let filteredUsers = [];
    
    if (filter === 'all') {
      filteredUsers = allUsers.map(u => ({
        username: u.username,
        roomId: u.roomId || null,
        state: userRoomState.get(u.username) ? userRoomState.get(u.username).gameState : 'notInRoom',
        roomName: userRoomState.get(u.username) ? userRoomState.get(u.username).roomName : null,
        isMaster: userRoomState.get(u.username) ? userRoomState.get(u.username).isMaster : false
      }));
    } else if (filter === 'notInRoom') {
      filteredUsers = allUsers
        .filter(u => !userRoomState.has(u.username))
        .map(u => ({ username: u.username, roomId: null, state: 'notInRoom', roomName: null, isMaster: false }));
    } else {
      filteredUsers = allUsers
        .filter(u => {
          const state = userRoomState.get(u.username);
          return state && state.gameState === filter;
        })
        .map(u => {
          const state = userRoomState.get(u.username);
          return {
            username: u.username,
            roomId: state.roomId,
            state: state.gameState,
            roomName: state.roomName,
            isMaster: state.isMaster
          };
        });
    }
    
    return res.json({ success: true, users: filteredUsers });
  } catch (error) {
    console.error('Admin users error:', error);
    return res.status(500).json({ success: false, message: '사용자 목록 조회 중 오류가 발생했습니다.' });
  }
});

// Get rooms list (with filter)
app.post('/api/admin-rooms', async (req, res) => {
  const { filter } = req.body; // filter: 'all', 'waiting', 'playing', 'result'
  
  const token = await requireAdminToken(req, res);
  if (!token) return;
  
  try {
    const allRooms = [];
    const allRoomIds = await storage.listRoomIds();
    for (const roomId of allRoomIds) {
      const room = await storage.getRoomById(roomId);
      if (room) {
        allRooms.push(room);
      }
    }
    
    let filteredRooms = [];
    
    if (filter === 'all') {
      filteredRooms = allRooms.map(room => ({
        id: room.id,
        roomName: room.roomName,
        gameState: room.gameState,
        userCount: room.users.size,
        memberLimit: room.memberLimit,
        hasPassword: !!room.roomPassword,
        password: room.roomPassword || null,
        masterId: room.masterId
      }));
    } else {
      filteredRooms = allRooms
        .filter(room => room.gameState === filter)
        .map(room => ({
          id: room.id,
          roomName: room.roomName,
          gameState: room.gameState,
          userCount: room.users.size,
          memberLimit: room.memberLimit,
          hasPassword: !!room.roomPassword,
          password: room.roomPassword || null,
          masterId: room.masterId
        }));
    }
    
    return res.json({ success: true, rooms: filteredRooms });
  } catch (error) {
    console.error('Admin rooms error:', error);
    return res.status(500).json({ success: false, message: '방 목록 조회 중 오류가 발생했습니다.' });
  }
});

// Admin kick user
app.post('/api/admin-kick-user', async (req, res) => {
  const { username } = req.body;
  
  const token = await requireAdminToken(req, res);
  if (!token) return;
  
  try {
    const userData = await storage.getActiveUser(username);
    if (!userData) {
      return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
    }
    
    // Set kick marker for admin kick (highest priority)
    await storage.setUserKickMarker(username, storage.KICK_REASONS.ADMIN);
    
    // Remove from room if in a room
    if (userData.roomId) {
      const room = await storage.getRoomById(userData.roomId);
      if (room) {
        room.users.delete(userData.userId);
        room.selections.delete(userData.userId);
        
        // If user was master, assign new master
        if (room.masterId === userData.userId && room.users.size > 0) {
          const newMaster = Array.from(room.users.values())[0];
          room.masterId = newMaster.id;
          newMaster.isMaster = true;
          room.users.set(newMaster.id, newMaster);
        }
        
        // Delete room if empty
        if (room.users.size === 0) {
          await storage.setRoomDeleteMarker(userData.roomId, storage.ROOM_DELETE_REASONS.EMPTY);
          await storage.deleteRoom(userData.roomId);
        } else {
          await storage.saveRoom(room);
        }
      }
    }
    
    // Delete user
    await storage.deleteActiveUser(username);
    
    return res.json({ success: true, message: `사용자 "${username}"가 추방되었습니다.` });
  } catch (error) {
    console.error('Admin kick user error:', error);
    return res.status(500).json({ success: false, message: '사용자 추방 중 오류가 발생했습니다.' });
  }
});

// Admin delete room
app.post('/api/admin-delete-room', async (req, res) => {
  const { roomId } = req.body;
  
  const token = await requireAdminToken(req, res);
  if (!token) return;
  
  try {
    const room = await storage.getRoomById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: '방을 찾을 수 없습니다.' });
    }
    
    // Set room delete marker (admin has highest priority)
    await storage.setRoomDeleteMarker(roomId, storage.ROOM_DELETE_REASONS.ADMIN);
    
    // Set kick markers for all users in the room (include room delete reason)
    for (const user of room.users.values()) {
      await storage.setUserKickMarker(user.username, storage.KICK_REASONS.ROOM_DELETED, storage.ROOM_DELETE_REASONS.ADMIN);
      await storage.deleteActiveUser(user.username);
    }
    
    await storage.deleteRoom(roomId);
    
    return res.json({ success: true, message: `방 "${room.roomName}"가 삭제되었습니다.` });
  } catch (error) {
    console.error('Admin delete room error:', error);
    return res.status(500).json({ success: false, message: '방 삭제 중 오류가 발생했습니다.' });
  }
});

// Admin cleanup
app.post('/api/admin-cleanup', async (req, res) => {
  const { cleanupType } = req.body; // cleanupType: 'users', 'rooms', 'both'
  
  const token = await requireAdminToken(req, res);
  if (!token) return;
  
  try {
    if (cleanupType === 'users' || cleanupType === 'both') {
      // Cleanup all inactive users (this will also cleanup empty rooms)
      await cleanupInactiveUsersAndRooms();
      const now = Date.now();
      await cleanupEmptyRooms(now);
    } else if (cleanupType === 'rooms') {
      // Cleanup only empty rooms
      const now = Date.now();
      await cleanupEmptyRooms(now);
    }
    
    return res.json({ 
      success: true, 
      message: cleanupType === 'users' ? '모든 사용자와 빈 방이 정리되었습니다.' : 
               cleanupType === 'both' ? '모든 사용자와 방이 정리되었습니다.' :
               '빈 방이 정리되었습니다.'
    });
  } catch (error) {
    console.error('Admin cleanup error:', error);
    return res.status(500).json({ success: false, message: '정리 중 오류가 발생했습니다.' });
  }
});

// Admin change password
app.post('/api/admin-change-password', async (req, res) => {
  const { currentPassword, password, secondPassword, newPassword } = req.body;
  
  const token = await requireAdminToken(req, res);
  if (!token) return;

  const passwordToVerify = currentPassword || password;
  if (!(await verifyAdminPassword(passwordToVerify))) {
    return res.status(403).json({ success: false, message: '현재 비밀번호가 올바르지 않습니다.' });
  }
  
  if (secondPassword !== ADMIN_SECOND_PASSWORD) {
    return res.status(403).json({ success: false, message: '2차 비밀번호가 올바르지 않습니다.' });
  }
  
  if (!newPassword || newPassword.trim() === '') {
    return res.status(400).json({ success: false, message: '새 비밀번호를 입력해주세요.' });
  }
  
  // Store new password in Redis (or memory fallback)
  await storage.setAdminPassword(newPassword.trim());
  
  return res.json({ 
    success: true, 
    message: '비밀번호가 변경되었습니다.' 
  });
});

// Get admin sessions list
app.get('/api/admin-sessions', async (req, res) => {
  const token = await requireAdminToken(req, res);
  if (!token) return;

  const sessions = await storage.listAdminSessions();
  return res.json({
    success: true,
    sessions,
    total: sessions.length
  });
});

// Kick admin session (revoke token)
app.post('/api/admin-kick-session', async (req, res) => {
  const { token: targetToken } = req.body;
  const token = await requireAdminToken(req, res);
  if (!token) return;

  if (!targetToken) {
    return res.status(400).json({ success: false, message: '토큰이 필요합니다.' });
  }

  await storage.deleteAdminToken(targetToken);
  return res.json({ success: true, message: '관리자 세션이 종료되었습니다.' });
});

// Manual cleanup endpoint (for debugging/admin use)
// This allows manual cleanup of stale usernames and rooms
// SECURITY: Requires ADMIN_SECRET_KEY environment variable to prevent unauthorized access
app.post('/api/manual-cleanup', async (req, res) => {
  const { username, roomId, forceAll, secretKey } = req.body;
  
  // Check secret key (set in Vercel environment variables)
  const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY;
  if (!ADMIN_SECRET_KEY) {
    return res.status(500).json({ 
      success: false, 
      message: 'Admin cleanup is not configured' 
    });
  }
  
  if (secretKey !== ADMIN_SECRET_KEY) {
    return res.status(403).json({ 
      success: false, 
      message: 'Unauthorized: Invalid secret key' 
    });
  }
  
  try {
    if (forceAll) {
      // Force cleanup all inactive users and empty rooms
      await cleanupInactiveUsersAndRooms();
      const now = Date.now();
      await cleanupEmptyRooms(now);
      return res.json({ 
        success: true, 
        message: 'All inactive users and empty rooms cleaned up',
        timestamp: Date.now()
      });
    }
    
    if (username) {
      // Delete specific username
      const userData = await storage.getActiveUser(username);
      if (userData) {
        await storage.deleteActiveUser(username);
        
        // Also remove from room if user is in a room
        if (userData.roomId) {
          const room = await storage.getRoomById(userData.roomId);
          if (room) {
            room.users.delete(userData.userId);
            room.selections.delete(userData.userId);
            
            // If user was master, assign new master
            if (room.masterId === userData.userId && room.users.size > 0) {
              const newMaster = Array.from(room.users.values())[0];
              room.masterId = newMaster.id;
              newMaster.isMaster = true;
              room.users.set(newMaster.id, newMaster);
            }
            
            // Delete room if empty
            if (room.users.size === 0) {
              await storage.deleteRoom(userData.roomId);
            } else {
              await storage.saveRoom(room);
            }
          }
        }
        
        return res.json({ 
          success: true, 
          message: `Username "${username}" has been manually removed`,
          timestamp: Date.now()
        });
      } else {
        return res.json({ 
          success: false, 
          message: `Username "${username}" not found in active users`
        });
      }
    }
    
    if (roomId) {
      // Delete specific room
      const room = await storage.getRoomById(roomId);
      if (room) {
        // Delete all users in the room
        for (const user of room.users.values()) {
          await storage.deleteActiveUser(user.username);
        }
        await storage.deleteRoom(roomId);
        return res.json({ 
          success: true, 
          message: `Room "${room.roomName}" has been manually deleted`,
          timestamp: Date.now()
        });
      } else {
        return res.json({ 
          success: false, 
          message: `Room with ID "${roomId}" not found`
        });
      }
    }
    
    return res.status(400).json({ 
      success: false, 
      message: 'Please provide username, roomId, or set forceAll=true'
    });
  } catch (error) {
    console.error('Manual cleanup error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error during manual cleanup',
      error: error.message
    });
  }
});

module.exports = app;