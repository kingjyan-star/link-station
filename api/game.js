const express = require('express');
const app = express();

app.use(express.json());

// In-memory storage (persisted across module reloads via globalThis)
const globalStore = globalThis.__linkStationStore || {
  rooms: new Map(),
  activeUsers: new Map(),
  deletedRooms: new Map(), // roomId -> timestamp of deletion (for diagnostics)
  cleanupInterval: null
};

globalThis.__linkStationStore = globalStore;

const rooms = globalStore.rooms;
const activeUsers = globalStore.activeUsers; // Track active usernames globally with last activity time
const deletedRooms = globalStore.deletedRooms;
// Structure: username -> { roomId, userId, lastActivity }

// Constants for user activity tracking
// HOW "AWAY" IS DETECTED:
// 1. Each user has a 'lastActivity' timestamp updated by heartbeat pings
// 2. Frontend sends heartbeat every 5 minutes via /api/ping endpoint
// 3. Frontend also sends heartbeat when Chrome tab becomes visible (Page Visibility API)
// 4. Backend cleanup runs every 5 minutes to check for inactive users
// 5. Users inactive for 30+ minutes are marked as disconnected and removed
// 6. This handles Chrome's tab throttling (background tabs slow down timers)
// 
// ROOM DELETION POLICY:
// - Empty rooms (0 users) are deleted IMMEDIATELY when all users leave
// - Zombie rooms (users still "in" but inactive for 2+ hours) are deleted to save resources
// - room.lastActivity is updated on all critical actions (vote, kick, role change, join)
// - This prevents both "room not found" errors and resource waste from abandoned rooms
const USER_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes of inactivity = disconnected
const USER_WARNING_MS = 29 * 60 * 1000; // 29 minutes - show warning 1 minute before timeout
const ZOMBIE_ROOM_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours - delete zombie rooms
const ROOM_WARNING_MS = (2 * 60 * 60 * 1000) - (60 * 1000); // 1 minute before room deletion
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Run cleanup every 5 minutes

// Helper function to clean up inactive users and empty rooms
function cleanupInactiveUsersAndRooms() {
  const now = Date.now();
  const disconnectedUsers = [];
  
  // Prune stale deletion records (older than 24 hours)
  for (const [roomId, deletedAt] of deletedRooms.entries()) {
    if (now - deletedAt > 24 * 60 * 60 * 1000) {
      deletedRooms.delete(roomId);
    }
  }

  console.log(`🧹 Running cleanup... Active users: ${activeUsers.size}, Total rooms: ${rooms.size}`);
  
  // Find disconnected users
  for (const [username, userData] of activeUsers.entries()) {
    const inactiveTime = now - userData.lastActivity;
    if (inactiveTime > USER_TIMEOUT_MS) {
      console.log(`   Found inactive user: ${username} (inactive for ${Math.floor(inactiveTime / 1000)}s)`);
      disconnectedUsers.push({ username, ...userData });
    }
  }
  
  if (disconnectedUsers.length === 0) {
    console.log(`   No inactive users found`);
    // Still check for old empty rooms
    cleanupEmptyRooms(now);
    return;
  }
  
  // Remove disconnected users from rooms and activeUsers
  for (const { username, roomId, userId } of disconnectedUsers) {
    const room = rooms.get(roomId);
    if (room) {
      // Mark user as disconnected due to inactivity
      const user = room.users.get(userId);
      if (user) {
        user.disconnected = true;
        user.disconnectReason = 'inactivity';
      }
      
      room.users.delete(userId);
      room.selections.delete(userId);
      console.log(`   ⚠️ User ${username} disconnected from room ${room.roomName} due to inactivity`);
      
      // If master disconnected, assign new master
      if (room.masterId === userId && room.users.size > 0) {
        const newMaster = Array.from(room.users.values())[0];
        room.masterId = newMaster.id;
        newMaster.isMaster = true;
        room.users.set(newMaster.id, newMaster);
        console.log(`   👑 Master handover: ${newMaster.displayName} is now master of ${room.roomName}`);
      }
      
      // Delete empty rooms immediately
      if (room.users.size === 0) {
        rooms.delete(roomId);
        console.log(`   🗑️ Room "${room.roomName}" deleted - all users left`);
        deletedRooms.set(roomId, now);
      }
    }
    activeUsers.delete(username);
  }
  
  console.log(`🧹 Cleanup complete. Active users: ${activeUsers.size}, Total rooms: ${rooms.size}`);
}

// Helper function to clean up empty and zombie rooms
function cleanupEmptyRooms(now) {
  for (const [roomId, room] of rooms.entries()) {
    // Use lastActivity if available, otherwise fallback to createdAt timestamp
    const lastActivityTime = room.lastActivity || (room.createdAt ? Date.parse(room.createdAt) : 0);
    const timeSinceActivity = now - lastActivityTime;
    
    // Case 1: Delete empty rooms immediately
    if (room.users.size === 0) {
      rooms.delete(roomId);
      deletedRooms.set(roomId, now);
      console.log(`   🗑️ Room "${room.roomName}" deleted - empty room`);
    }
    // Case 2: Delete zombie rooms (users still "in" but no activity for 2+ hours)
    else if (timeSinceActivity > ZOMBIE_ROOM_TIMEOUT) {
      rooms.delete(roomId);
      deletedRooms.set(roomId, now);
      console.log(`   🧟 Room "${room.roomName}" deleted - zombie room (inactive for ${Math.floor(timeSinceActivity / 1000 / 60)} minutes)`);
      
      // Also remove all users from activeUsers
      for (const user of room.users.values()) {
        activeUsers.delete(user.username);
      }
    }
  }
}

// Start cleanup interval (make sure we only register once even if module reloads)
if (!globalStore.cleanupInterval) {
  globalStore.cleanupInterval = setInterval(cleanupInactiveUsersAndRooms, CLEANUP_INTERVAL_MS);
  console.log(`🕒 Started cleanup interval (every ${CLEANUP_INTERVAL_MS / 60000} minutes)`);
}

// Check username duplication
app.post('/api/check-username', (req, res) => {
  const { username } = req.body;
  
  if (!username || username.trim() === '') {
    return res.json({ duplicate: false });
  }
  
  const isDuplicate = activeUsers.has(username.trim());
  res.json({ duplicate: isDuplicate, available: !isDuplicate });
});

// Check room name duplication
app.post('/api/check-roomname', (req, res) => {
  const { roomName } = req.body;
  
  if (!roomName || roomName.trim() === '') {
    return res.json({ duplicate: false });
  }
  
  const existingRoom = Array.from(rooms.values()).find(room => 
    room.roomName.toLowerCase() === roomName.trim().toLowerCase()
  );
  res.json({ duplicate: !!existingRoom });
});

// Create room
app.post('/api/create-room', (req, res) => {
  const { roomName, roomPassword, memberLimit, username } = req.body;
  
  // Validate input
  if (!roomName || roomName.trim() === '') {
    return res.status(400).json({ success: false, message: '방 이름을 입력해주세요.' });
  }
  
  if (memberLimit < 2 || memberLimit > 99) {
    return res.status(400).json({ success: false, message: '최대 인원은 2-99명 사이여야 합니다.' });
  }
  
  // Check room name duplication
  console.log(`Creating room: "${roomName}"`);
  console.log(`Current rooms:`, Array.from(rooms.values()).map(r => ({ name: r.roomName, id: r.id, users: r.users.size })));
  
  const existingRoom = Array.from(rooms.values()).find(room => 
    room.roomName.toLowerCase() === roomName.trim().toLowerCase()
  );
  if (existingRoom) {
    console.log(`❌ Duplicate room name detected: "${roomName}" already exists as "${existingRoom.roomName}"`);
    return res.status(400).json({ success: false, message: '이미 존재하는 방 이름입니다. 다른 이름을 사용해주세요.' });
  }
  
  console.log(`✓ Room name "${roomName}" is available`);
  
  // Check username duplication
  if (activeUsers.has(username)) {
    return res.status(400).json({ success: false, message: '이미 사용 중인 사용자 이름입니다.' });
  }
  
  // Generate room ID
  const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Create room
  const room = {
    id: roomId,
    roomName: roomName.trim(),
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
    username: username.trim(),
    displayName: username.trim(),
    joinedAt: new Date().toISOString(),
    isMaster: true,
    role: 'attender'
  };
  
  room.users.set(userId, user);
  rooms.set(roomId, room);
  activeUsers.set(username.trim(), {
    roomId,
    userId,
    lastActivity: Date.now()
  });
  
  console.log(`✅ Room created: "${roomName}" (ID: ${roomId}) by "${username}"`);
  console.log(`   Total rooms now: ${rooms.size}`);
  
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
app.post('/api/join-room', (req, res) => {
  const { roomName, username } = req.body;
  
  console.log(`Join room attempt: "${roomName}" by "${username}"`);
  console.log(`Total rooms: ${rooms.size}`);
  console.log(`Available rooms:`, Array.from(rooms.values()).map(r => ({ name: r.roomName, id: r.id, users: r.users.size })));
  
  // Find room by name (case-insensitive)
  let targetRoom = null;
  for (const [roomId, room] of rooms) {
    if (room.roomName.toLowerCase() === roomName.trim().toLowerCase()) {
      targetRoom = room;
      break;
    }
  }
  
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
  if (activeUsers.has(username)) {
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
    username: username.trim(),
    displayName: username.trim(),
    joinedAt: new Date().toISOString(),
    isMaster: false,
    role: 'attender'
  };
  
  targetRoom.users.set(userId, user);
  targetRoom.lastActivity = Date.now(); // Update room activity on join
  activeUsers.set(username.trim(), {
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
app.post('/api/check-password', (req, res) => {
  const { roomName, password, username } = req.body;
  
  console.log(`Check password attempt: "${roomName}" by "${username}"`);
  
  // Find room by name (case-insensitive)
  let targetRoom = null;
  for (const [roomId, room] of rooms) {
    if (room.roomName.toLowerCase() === roomName.trim().toLowerCase()) {
      targetRoom = room;
      break;
    }
  }
  
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
  if (activeUsers.has(username)) {
    return res.status(400).json({ success: false, message: '이미 사용 중인 사용자 이름입니다.' });
  }
  
  // Join room
  const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const user = {
    id: userId,
    username: username.trim(),
    displayName: username.trim(),
    joinedAt: new Date().toISOString(),
    isMaster: false,
    role: 'attender'
  };
  
  targetRoom.users.set(userId, user);
  targetRoom.lastActivity = Date.now(); // Update room activity on join
  activeUsers.set(username.trim(), {
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
app.post('/api/join-room-qr', (req, res) => {
  const { roomId, username } = req.body;
  
  const room = rooms.get(roomId);
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
  if (activeUsers.has(username)) {
    return res.status(400).json({ success: false, message: '이미 사용 중인 사용자 이름입니다.' });
  }
  
  // Join room
  const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const user = {
    id: userId,
    username: username.trim(),
    displayName: username.trim(),
    joinedAt: new Date().toISOString(),
    isMaster: false,
    role: 'attender'
  };
  
  room.users.set(userId, user);
  activeUsers.set(username.trim(), {
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
app.post('/api/start-game', (req, res) => {
  const { roomId, userId } = req.body;
  
  const room = rooms.get(roomId);
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
  
  res.json({
    success: true,
    message: '게임이 시작되었습니다!',
    gameState: room.gameState
  });
});

// Select user
app.post('/api/select', (req, res) => {
  const { roomId, userId, selectedUserId } = req.body;
  
  console.log(`Selection attempt: ${userId} selects ${selectedUserId} in room ${roomId}`);
  
  const room = rooms.get(roomId);
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
    
    res.json({
      success: true,
      message: '선택이 기록되었습니다. 다른 참여자들의 선택을 기다리는 중...',
      users: usersWithVotingStatus
    });
  }
});

// Heartbeat/Ping endpoint to keep user connection alive
app.post('/api/ping', (req, res) => {
  const { username, userId } = req.body;
  
  if (activeUsers.has(username)) {
    const userData = activeUsers.get(username);
    if (userData.userId === userId) {
      userData.lastActivity = Date.now();
      activeUsers.set(username, userData);
    }
  }
  
  res.json({ success: true, timestamp: Date.now() });
});

// Check if user or room needs warning
app.post('/api/check-warning', (req, res) => {
  const { username, userId, roomId } = req.body;
  const now = Date.now();
  
  let userWarning = false;
  let roomWarning = false;
  let userTimeLeft = 0;
  let roomTimeLeft = 0;
  
  // Check user inactivity warning
  if (username && activeUsers.has(username)) {
    const userData = activeUsers.get(username);
    const inactiveTime = now - userData.lastActivity;
    
    if (inactiveTime >= USER_WARNING_MS && inactiveTime < USER_TIMEOUT_MS) {
      userWarning = true;
      userTimeLeft = Math.ceil((USER_TIMEOUT_MS - inactiveTime) / 1000); // seconds left
    }
  }
  
  // Check room inactivity warning (only for master)
  if (roomId) {
    const room = rooms.get(roomId);
    if (room && room.users.size > 0) {
      const timeSinceActivity = now - (room.lastActivity || 0);
      
      if (timeSinceActivity >= ROOM_WARNING_MS && timeSinceActivity < ZOMBIE_ROOM_TIMEOUT) {
        roomWarning = true;
        roomTimeLeft = Math.ceil((ZOMBIE_ROOM_TIMEOUT - timeSinceActivity) / 1000); // seconds left
      }
    }
  }
  
  // Check if user was disconnected
  let userDisconnected = false;
  if (username && !activeUsers.has(username)) {
    userDisconnected = true;
  }
  
  // Check if room was deleted
  let roomDeleted = false;
  if (roomId && !rooms.has(roomId)) {
    const deletedAt = deletedRooms.get(roomId);
    if (deletedAt) {
      roomDeleted = true;
    } else {
      // If we have no record of deletion, this is likely a cold/warm boot of another instance.
      console.warn(`⚠️ Room ${roomId} not found in current instance – treating as transient (no deletion record).`);
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
app.post('/api/keep-alive-user', (req, res) => {
  const { username } = req.body;
  
  if (username && activeUsers.has(username)) {
    const userData = activeUsers.get(username);
    userData.lastActivity = Date.now();
    console.log(`✅ User ${username} extended their session`);
  }
  
  res.json({ success: true });
});

// Keep room alive (extend timeout)
app.post('/api/keep-alive-room', (req, res) => {
  const { roomId } = req.body;
  
  const room = rooms.get(roomId);
  if (room) {
    room.lastActivity = Date.now();
    console.log(`✅ Room "${room.roomName}" extended its lifetime`);
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, message: '방을 찾을 수 없습니다.' });
  }
});

// Remove user from active users when they exit
app.post('/api/remove-user', (req, res) => {
  const { username } = req.body;
  
  if (username && activeUsers.has(username)) {
    activeUsers.delete(username);
    console.log(`👋 User ${username} removed from active users`);
  }
  
  res.json({ success: true });
});

// Change user role (attender/observer)
app.post('/api/change-role', (req, res) => {
  const { roomId, userId, role } = req.body;
  const room = rooms.get(roomId);
  
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
  const activeUserData = activeUsers.get(user.username);
  if (activeUserData) {
    activeUserData.lastActivity = Date.now();
  }
  room.lastActivity = Date.now(); // Prevent room deletion during active use
  
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
app.post('/api/return-to-waiting', (req, res) => {
  const { roomId, userId } = req.body;
  const room = rooms.get(roomId);
  
  if (!room) {
    return res.status(404).json({ success: false, message: '방을 찾을 수 없습니다.' });
  }
  
  // Reset game state to waiting
  room.gameState = 'waiting';
  room.selections.clear();
  room.matchResult = null;
  
  console.log(`🔄 Room ${room.roomName} returned to waiting state`);
  
  res.json({ success: true });
});

// Get room status
app.get('/api/room/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = rooms.get(roomId);
  
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
app.post('/api/kick-user', (req, res) => {
  const { roomId, masterUserId, targetUserId } = req.body;
  
  const room = rooms.get(roomId);
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
  activeUsers.delete(targetUser.username);
  room.lastActivity = Date.now(); // Prevent room deletion during kick
  
  console.log(`User kicked: ${targetUser.displayName} from ${room.roomName} by master`);
  
  res.json({
    success: true,
    message: '사용자가 추방되었습니다.',
    users: Array.from(room.users.values())
  });
});

// Leave room
app.post('/api/leave-room', (req, res) => {
  const { roomId, userId } = req.body;
  
  const room = rooms.get(roomId);
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
  activeUsers.delete(user.username);
  
  // If user was master, assign new master
  if (room.masterId === userId && room.users.size > 0) {
    const newMaster = room.users.values().next().value;
    room.masterId = newMaster.id;
    newMaster.isMaster = true;
    console.log(`New master assigned: ${newMaster.displayName}`);
  }
  
  // If no users left, delete room
  if (room.users.size === 0) {
    rooms.delete(roomId);
    deletedRooms.set(roomId, Date.now());
    console.log(`Room deleted: ${room.roomName}`);
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