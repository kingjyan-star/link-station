import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import './App.css';

const SERVER_URL = process.env.NODE_ENV === 'production' 
  ? window.location.origin 
  : 'http://localhost:3001';

function App() {
  const [socket, setSocket] = useState(null);
  const [currentView, setCurrentView] = useState('login'); // login, matching, result
  const [nickname, setNickname] = useState('');
  const [roomId, setRoomId] = useState('');
  const [users, setUsers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [unmatched, setUnmatched] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    const newSocket = io(SERVER_URL);
    setSocket(newSocket);

    // URL에서 방 ID 가져오기
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');
    if (roomFromUrl) {
      setRoomId(roomFromUrl);
    }

    // 사용자 목록 업데이트
    newSocket.on('userList', (data) => {
      setUsers(data.users);
      setCurrentView('matching');
    });

    // 매칭 결과
    newSocket.on('matchResult', (data) => {
      setMatches(data.matches);
      setUnmatched(data.unmatched);
      setCurrentView('result');
    });

    // 다음 라운드
    newSocket.on('nextRound', (data) => {
      setUsers(data.users);
      setCurrentView('matching');
      setSelectedUser(null);
      setMatches([]);
      setUnmatched([]);
    });

    return () => newSocket.close();
  }, []);

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (nickname && roomId && socket) {
      socket.emit('joinRoom', { roomId, nickname });
    }
  };

  const handleSelectUser = (userId) => {
    if (socket && roomId) {
      socket.emit('selectUser', { roomId, selectedUserId: userId });
      setSelectedUser(userId);
    }
  };

  const handleNewGame = () => {
    // 소켓 연결 해제 후 재연결
    if (socket) {
      socket.disconnect();
    }
    
    // 상태 초기화
    setCurrentView('login');
    setUsers([]);
    setMatches([]);
    setUnmatched([]);
    setSelectedUser(null);
    setShowQR(false);
    
    // 새로운 소켓 연결
    const newSocket = io(SERVER_URL);
    setSocket(newSocket);
    
    // 이벤트 리스너 재설정
    newSocket.on('userList', (data) => {
      setUsers(data.users);
      setCurrentView('matching');
    });

    newSocket.on('matchResult', (data) => {
      setMatches(data.matches);
      setUnmatched(data.unmatched);
      setCurrentView('result');
    });

    newSocket.on('nextRound', (data) => {
      setUsers(data.users);
      setCurrentView('matching');
      setSelectedUser(null);
      setMatches([]);
      setUnmatched([]);
    });
  };

  const generateRoomURL = () => {
    return `${window.location.origin}?room=${roomId}`;
  };

  const renderLogin = () => (
    <div className="login-container">
      <div className="login-box">
        <h1 className="app-title">🔗 링크 스테이션</h1>
        <p className="app-subtitle">3:3 또는 4:4 매칭 게임</p>
        
        <form onSubmit={handleJoinRoom} className="login-form">
          <div className="input-group">
            <label htmlFor="nickname">닉네임</label>
            <input
              type="text"
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="닉네임을 입력하세요"
              required
            />
          </div>
          
          <div className="input-group">
            <label htmlFor="roomId">방 ID</label>
            <input
              type="text"
              id="roomId"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="방 ID를 입력하세요"
              required
            />
          </div>
          
          <button type="submit" className="join-button">
            게임 시작
          </button>
        </form>

      </div>
    </div>
  );

  const renderMatching = () => (
    <div className="matching-container">
      <div className="matching-header">
        <h2>🔗 링크 스테이션</h2>
        <p>방 ID: {roomId} | 참여자: {users.length}명</p>
        
        <div className="qr-section">
          <button 
            className="qr-button"
            onClick={() => setShowQR(!showQR)}
          >
            {showQR ? 'QR코드 숨기기' : 'QR코드로 공유하기'}
          </button>
          {showQR && (
            <div className="qr-container">
              <QRCodeSVG value={generateRoomURL()} size={200} />
              <p className="qr-text">QR코드를 스캔하여 같은 방에 참여하세요!</p>
            </div>
          )}
        </div>
      </div>
      
      <div className="users-list">
        <h3>참여자 목록</h3>
        <div className="users-grid">
          {users.map(user => (
            <div key={user.id} className="user-card">
              <div className="user-info">
                <span className="user-nickname">{user.nickname}</span>
                {user.id === socket?.id && <span className="you-badge">나</span>}
              </div>
              {user.id !== socket?.id && (
                <button
                  className={`select-button ${selectedUser === user.id ? 'selected' : ''}`}
                  onClick={() => handleSelectUser(user.id)}
                  disabled={selectedUser !== null}
                >
                  {selectedUser === user.id ? '선택됨' : '선택'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {selectedUser && (
        <div className="selection-info">
          <p>✅ 선택을 완료했습니다. 다른 참여자들의 선택을 기다리는 중...</p>
        </div>
      )}
    </div>
  );

  const renderResult = () => (
    <div className="result-container">
      <div className="result-header">
        <h2>🎉 매칭 결과</h2>
        <p>방 ID: {roomId}</p>
        
        <div className="qr-section">
          <button 
            className="qr-button"
            onClick={() => setShowQR(!showQR)}
          >
            {showQR ? 'QR코드 숨기기' : 'QR코드로 공유하기'}
          </button>
          {showQR && (
            <div className="qr-container">
              <QRCodeSVG value={generateRoomURL()} size={200} />
              <p className="qr-text">QR코드를 스캔하여 같은 방에 참여하세요!</p>
            </div>
          )}
        </div>
      </div>
      
      {matches.length > 0 && (
        <div className="matches-section">
          <h3>✅ 매칭 성공!</h3>
          {matches.map((match, index) => (
            <div key={index} className="match-card success">
              <div className="match-pair">
                <span className="user-name">{match.user1.nickname}</span>
                <span className="match-arrow">↔️</span>
                <span className="user-name">{match.user2.nickname}</span>
              </div>
              <p className="match-message">축하합니다! 파트너가 되셨습니다! 🎊</p>
            </div>
          ))}
        </div>
      )}
      
      {unmatched.length > 0 && (
        <div className="unmatched-section">
          <h3>😔 매칭 실패</h3>
          {unmatched.map((user, index) => (
            <div key={index} className="match-card fail">
              <span className="user-name">{user.nickname}</span>
              <p className="match-message">아쉽네요. 다음 라운드에 도전하세요!</p>
            </div>
          ))}
        </div>
      )}
      
      <button className="new-game-button" onClick={handleNewGame}>
        새 게임 시작
      </button>
    </div>
  );

  return (
    <div className="App">
      {currentView === 'login' && renderLogin()}
      {currentView === 'matching' && renderMatching()}
      {currentView === 'result' && renderResult()}
    </div>
  );
}

export default App;