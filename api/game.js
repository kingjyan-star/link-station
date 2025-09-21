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
      isMatching: false
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
  
  const user = {
    id: userId,
    nickname,
    displayName,
    joinedAt: new Date().toISOString()
  };
  
  room.users.set(userId, user);
  
  console.log(`User joined: ${displayName} in room ${roomId}`);
  console.log(`Room now has ${room.users.size} users`);
  
  res.json({
    success: true,
    userId,
    users: Array.from(room.users.values())
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
    
    // 매칭된 사용자들 제거
    matches.forEach(match => {
      room.users.delete(match.user1.id);
      room.users.delete(match.user2.id);
      room.selections.delete(match.user1.id);
      room.selections.delete(match.user2.id);
    });
    
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
  
  res.json({
    success: true,
    room: {
      id: roomId,
      users: Array.from(room.users.values()),
      selections: Object.fromEntries(room.selections),
      isMatching: room.isMatching
    }
  });
});

module.exports = app;
