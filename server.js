const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: false
  }
});

const PORT = process.env.PORT || 3001;

// 정적 파일 서빙 (React 빌드 파일)
app.use(express.static(path.join(__dirname, 'client/build'), {
  index: false,
  setHeaders: (res, path) => {
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    } else if (path.endsWith('.json')) {
      res.setHeader('Content-Type', 'application/json');
    }
  }
}));

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
  const processedUsers = new Set(); // 이미 처리된 사용자 추적
  
  // 선택 결과를 분석하여 매칭 처리
  for (const [userId, selectedUserId] of selections) {
    // 이미 처리된 사용자는 건너뛰기
    if (processedUsers.has(userId)) continue;
    
    const user = room.users.get(userId);
    const selectedUser = room.users.get(selectedUserId);
    
    if (selectedUser && selections.get(selectedUserId) === userId) {
      // 상호 선택된 경우 매칭 성공
      matches.push({
        user1: user,
        user2: selectedUser
      });
      
      // 두 사용자 모두 처리됨으로 표시
      processedUsers.add(userId);
      processedUsers.add(selectedUserId);
    } else {
      // 매칭 실패
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
    // 방이 비었으면 5분 후 삭제 (새 게임을 위한 대기 시간)
    setTimeout(() => {
      if (rooms.has(roomId) && rooms.get(roomId).users.size === 0) {
        rooms.delete(roomId);
        console.log(`방 ${roomId}이 5분 후 삭제되었습니다.`);
      }
    }, 5 * 60 * 1000); // 5분
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

// 정적 파일 명시적 라우트
app.get('/static/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', req.path));
});

app.get('/*.(js|css|json)', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', req.path));
});

// React 앱 라우트 - 모든 경로에 대해 React 앱 서빙
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

server.listen(PORT, () => {
  console.log(`링크 스테이션 서버가 포트 ${PORT}에서 실행 중입니다.`);
});
