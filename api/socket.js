const { Server } = require('socket.io');
const { createServer } = require('http');

// Vercel 서버리스 함수에서 Socket.IO 사용을 위한 설정
module.exports = (req, res) => {
  // CORS 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // Socket.IO 서버 생성
  const httpServer = createServer();
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  
  // 게임 방 관리
  const rooms = new Map();
  
  // 방 생성 또는 참여
  function createOrJoinRoom(roomId, user) {
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        users: new Map(),
        selections: new Map(),
        isMatching: false
      });
    }
    
    const room = rooms.get(roomId);
    room.users.set(user.id, user);
    return room;
  }
  
  // 매칭 로직
  function processMatching(roomId) {
    const room = rooms.get(roomId);
    if (!room) return;

    const users = Array.from(room.users.values());
    const selections = room.selections;
    
    // 모든 사용자가 선택을 완료했는지 확인
    if (selections.size !== users.length) {
      return;
    }

    const matches = [];
    const unmatched = [];
    const processedUsers = new Set();
    
    // 선택 결과를 분석하여 매칭 처리
    for (const [userId, selectedUserId] of selections) {
      if (processedUsers.has(userId)) continue;
      
      const user = room.users.get(userId);
      const selectedUser = room.users.get(selectedUserId);
      
      if (selectedUser && selections.get(selectedUserId) === userId) {
        matches.push({
          user1: user,
          user2: selectedUser
        });
        processedUsers.add(userId);
        processedUsers.add(selectedUserId);
      } else {
        unmatched.push(user);
        processedUsers.add(userId);
      }
    }

    // 매칭 결과 전송
    io.to(roomId).emit('matchResult', {
      matches,
      unmatched,
      roomId
    });

    // 매칭된 사용자들을 방에서 제거
    matches.forEach(match => {
      room.users.delete(match.user1.id);
      room.users.delete(match.user2.id);
      room.selections.delete(match.user1.id);
      room.selections.delete(match.user2.id);
    });

    // 남은 사용자들로 다음 라운드 준비
    if (room.users.size > 0) {
      room.selections.clear();
      io.to(roomId).emit('nextRound', {
        users: Array.from(room.users.values()),
        roomId
      });
    } else {
      // 방이 비었으면 5분 후 삭제
      setTimeout(() => {
        if (rooms.has(roomId) && rooms.get(roomId).users.size === 0) {
          rooms.delete(roomId);
        }
      }, 5 * 60 * 1000);
    }
  }
  
  // Socket.IO 연결 처리
  io.on('connection', (socket) => {
    console.log('새로운 유저가 접속했습니다:', socket.id);

    // 방 참여
    socket.on('joinRoom', (data) => {
      const { roomId, nickname } = data;
      const user = {
        id: socket.id,
        nickname,
        socketId: socket.id
      };

      socket.join(roomId);
      const room = createOrJoinRoom(roomId, user);
      
      console.log(`${nickname}님이 방 ${roomId}에 참여했습니다.`);
      
      // 방의 모든 사용자에게 업데이트된 사용자 목록 전송
      io.to(roomId).emit('userList', {
        users: Array.from(room.users.values()),
        roomId
      });
    });

    // 사용자 선택
    socket.on('selectUser', (data) => {
      const { roomId, selectedUserId } = data;
      const room = rooms.get(roomId);
      
      if (room) {
        room.selections.set(socket.id, selectedUserId);
        console.log(`${socket.id}님이 ${selectedUserId}를 선택했습니다.`);
        
        // 매칭 처리 시도
        processMatching(roomId);
      }
    });

    // 연결 해제
    socket.on('disconnect', () => {
      console.log('유저가 연결을 해제했습니다:', socket.id);
      
      // 모든 방에서 해당 사용자 제거
      for (const [roomId, room] of rooms) {
        if (room.users.has(socket.id)) {
          room.users.delete(socket.id);
          room.selections.delete(socket.id);
          
          // 방의 다른 사용자들에게 업데이트된 목록 전송
          if (room.users.size > 0) {
            io.to(roomId).emit('userList', {
              users: Array.from(room.users.values()),
              roomId
            });
          } else {
            // 방이 비었으면 삭제
            rooms.delete(roomId);
          }
          break;
        }
      }
    });
  });
  
  // HTTP 서버 시작
  httpServer.listen(0, () => {
    console.log('Socket.IO 서버가 시작되었습니다.');
  });
  
  res.status(200).json({ message: 'Socket.IO server running' });
};
