const express = require('express');
const app = express();

app.use(express.json());

// In-memory storage
let rooms = new Map();
let activeUsers = new Set(); // Track active usernames globally

// Check username duplication
app.post('/api/check-username', (req, res) => {
  const { username } = req.body;
  
  if (!username || username.trim() === '') {
    return res.json({ duplicate: false });
  }
  
  const isDuplicate = activeUsers.has(username.trim());
  res.json({ duplicate: isDuplicate });
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
    createdAt: new Date().toISOString()
  };
  
  // Add user to room
  const user = {
    id: userId,
    username: username.trim(),
    displayName: username.trim(),
    joinedAt: new Date().toISOString(),
    isMaster: true
  };
  
  room.users.set(userId, user);
  rooms.set(roomId, room);
  activeUsers.add(username.trim());
  
  console.log(`Room created: ${roomName} (${roomId}) by ${username}`);
  
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
  
  // Find room by name
  let targetRoom = null;
  for (const [roomId, room] of rooms) {
    if (room.roomName === roomName.trim()) {
      targetRoom = room;
      break;
    }
  }
  
  if (!targetRoom) {
    return res.status(404).json({ success: false, message: '방을 찾을 수 없습니다.' });
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
    isMaster: false
  };
  
  targetRoom.users.set(userId, user);
  activeUsers.add(username.trim());
  
  console.log(`User joined room: ${username} in ${roomName}`);
  
  res.json({
    success: true,
    roomId: targetRoom.id,
    userId,
    users: Array.from(targetRoom.users.values()),
    isMaster: false,
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
  
  // Find room by name
  let targetRoom = null;
  for (const [roomId, room] of rooms) {
    if (room.roomName === roomName.trim()) {
      targetRoom = room;
      break;
    }
  }
  
  if (!targetRoom) {
    return res.status(404).json({ success: false, message: '방을 찾을 수 없습니다.' });
  }
  
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
    isMaster: false
  };
  
  targetRoom.users.set(userId, user);
  activeUsers.add(username.trim());
  
  console.log(`User joined room with password: ${username} in ${roomName}`);
  
  res.json({
    success: true,
    roomId: targetRoom.id,
    userId,
    users: Array.from(targetRoom.users.values()),
    isMaster: false,
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
    isMaster: false
  };
  
  room.users.set(userId, user);
  activeUsers.add(username.trim());
  
  console.log(`User joined room with QR: ${username} in ${room.roomName}`);
  
  res.json({
    success: true,
    roomId: room.id,
    userId,
    users: Array.from(room.users.values()),
    isMaster: false,
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
  
  // Check minimum players
  if (room.users.size < 2) {
    return res.status(400).json({ success: false, message: '최소 2명 이상 필요합니다.' });
  }
  
  // Start game
  room.gameState = 'linking';
  room.selections.clear();
  room.matchResult = null;
  
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
  
  const room = rooms.get(roomId);
  if (!room) {
    return res.status(404).json({ success: false, message: '방을 찾을 수 없습니다.' });
  }
  
  // Check if game is in linking phase
  if (room.gameState !== 'linking') {
    return res.status(400).json({ success: false, message: '게임이 링킹 단계가 아닙니다.' });
  }
  
  // Record selection
  room.selections.set(userId, selectedUserId);
  
  console.log(`Selection: ${userId} selects ${selectedUserId} in room ${roomId}`);
  console.log(`Selections so far: ${room.selections.size}/${room.users.size}`);
  
  // Check if all users have selected
  if (room.selections.size === room.users.size) {
    console.log('All users have selected, processing matches...');
    
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
    
    console.log(`Results: ${matches.length} matches, ${unmatched.length} unmatched`);
    
    res.json({
      success: true,
      matches,
      unmatched,
      users: Array.from(room.users.values())
    });
  } else {
    res.json({
      success: true,
      message: '선택이 기록되었습니다. 다른 참여자들의 선택을 기다리는 중...'
    });
  }
});

// Get room status
app.get('/api/room/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = rooms.get(roomId);
  
  if (!room) {
    return res.status(404).json({ success: false, message: '방을 찾을 수 없습니다.' });
  }
  
  // Add voting status to users
  const usersWithVotingStatus = Array.from(room.users.values()).map(user => ({
    ...user,
    hasVoted: room.selections.has(user.id)
  }));
  
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