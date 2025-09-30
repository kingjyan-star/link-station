// Simple API-based game functionality for Vercel
const express = require('express');
const app = express();

// CORS 설정
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  next();
});

app.use(express.json());

// In-memory storage (실제로는 데이터베이스 사용)
let rooms = new Map();

// 방 참여
app.post('/api/join', (req, res) => {
  const { roomId, nickname } = req.body;
  
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      users: new Map(),
      selections: new Map(),
      gameState: 'waiting', // waiting, started, matching, completed
      matchResult: null,
      hostId: null
    });
  }
  
  const room = rooms.get(roomId);
  const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // 같은 닉네임이 이미 있는지 확인하고 고유하게 만들기
  let displayName = nickname;
  let nameCount = 1;
  while (Array.from(room.users.values()).some(u => u.displayName === displayName)) {
    displayName = `${nickname}(${nameCount})`;
    nameCount++;
  }
  
  // 게임이 진행 중이면 참여 불가
  if (room.gameState !== 'waiting') {
    return res.status(400).json({ 
      success: false, 
      message: '게임이 진행 중입니다. 게임이 끝난 후 다시 시도해주세요.' 
    });
  }

  const user = {
    id: userId,
    nickname,
    displayName,
    joinedAt: new Date().toISOString()
  };
  
  room.users.set(userId, user);
  
  // 첫 번째 사용자를 호스트로 설정
  if (!room.hostId) {
    room.hostId = userId;
    console.log(`Host set: ${displayName} (${userId})`);
  }
  
  console.log(`User joined: ${displayName} in room ${roomId}`);
  console.log(`Room now has ${room.users.size} users`);
  console.log('All users in room:', Array.from(room.users.values()));
  console.log('Host ID:', room.hostId);
  
  res.json({
    success: true,
    userId,
    users: Array.from(room.users.values()),
    isHost: room.hostId === userId,
    gameState: room.gameState
  });
});

// 게임 시작
app.post('/api/start-game', (req, res) => {
  const { roomId, userId } = req.body;
  
  const room = rooms.get(roomId);
  if (!room) {
    return res.status(404).json({ success: false, message: 'Room not found' });
  }
  
  // 호스트만 게임을 시작할 수 있음
  if (room.hostId !== userId) {
    return res.status(403).json({ success: false, message: 'Only host can start the game' });
  }
  
  // 최소 2명 이상 필요
  if (room.users.size < 2) {
    return res.status(400).json({ success: false, message: 'At least 2 players needed to start' });
  }
  
  room.gameState = 'matching';
  console.log(`Game started in room ${roomId} by ${userId}`);
  
  res.json({
    success: true,
    message: 'Game started!',
    gameState: room.gameState
  });
});

// 사용자 선택
app.post('/api/select', (req, res) => {
  const { roomId, userId, selectedUserId } = req.body;
  
  console.log(`Selection: ${userId} selects ${selectedUserId} in room ${roomId}`);
  
  const room = rooms.get(roomId);
  if (!room) {
    return res.status(404).json({ success: false, message: 'Room not found' });
  }
  
  // 게임이 매칭 단계가 아니면 선택 불가
  if (room.gameState !== 'matching') {
    return res.status(400).json({ success: false, message: 'Game is not in matching phase' });
  }
  
  room.selections.set(userId, selectedUserId);
  
  console.log(`Selections so far: ${room.selections.size}/${room.users.size}`);
  
  // 매칭 처리
  const users = Array.from(room.users.values());
  if (room.selections.size === users.length) {
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
    
    // 사용자들은 그대로 유지 (매칭 결과만 저장)
    
    console.log(`Results: ${matches.length} matches, ${unmatched.length} unmatched`);
    
    // 게임 상태를 완료로 변경하고 매칭 결과 저장
    room.gameState = 'completed';
    room.matchResult = {
      matches,
      unmatched,
      completedAt: new Date().toISOString()
    };
    
    res.json({
      success: true,
      matches,
      unmatched,
      users: Array.from(room.users.values())
    });
  } else {
    res.json({
      success: true,
      message: 'Selection recorded, waiting for others'
    });
  }
});

// 방 상태 조회
app.get('/api/room/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = rooms.get(roomId);
  
  if (!room) {
    return res.status(404).json({ success: false, message: 'Room not found' });
  }
  
  // 저장된 매칭 결과가 있으면 반환
  const matchResult = room.matchResult;
  
  console.log(`Room status request for ${roomId}:`);
  console.log(`Users in room: ${room.users.size}`);
  console.log(`All users:`, Array.from(room.users.values()));
  console.log(`Game state: ${room.gameState}`);
  console.log(`Host ID: ${room.hostId}`);
  
  res.json({
    success: true,
    room: {
      id: roomId,
      users: Array.from(room.users.values()),
      selections: Object.fromEntries(room.selections),
      gameState: room.gameState,
      hostId: room.hostId
    },
    matchResult
  });
});

// 대기실로 돌아가기 (새 게임 준비)
app.post('/api/return-to-waiting', (req, res) => {
  const { roomId, userId } = req.body;
  const room = rooms.get(roomId);
  
  if (!room) {
    return res.status(404).json({ success: false, message: 'Room not found' });
  }
  
  // 호스트만 대기실로 돌아갈 수 있음
  if (room.hostId !== userId) {
    return res.status(403).json({ success: false, message: 'Only host can return to waiting room' });
  }
  
  // 게임 상태를 대기로 변경하고 선택 초기화
  room.gameState = 'waiting';
  room.selections.clear();
  room.matchResult = null;
  console.log(`Room ${roomId} returned to waiting room`);
  
  res.json({ 
    success: true, 
    message: 'Returned to waiting room',
    gameState: room.gameState
  });
});

module.exports = app;
