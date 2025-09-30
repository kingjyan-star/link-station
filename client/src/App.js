import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import ErrorBoundary from './ErrorBoundary';
import './App.css';

const API_URL = process.env.NODE_ENV === 'production' 
  ? window.location.origin 
  : 'http://localhost:3000';

function App() {
  const [currentView, setCurrentView] = useState('login'); // login, matching, result
  const [nickname, setNickname] = useState('');
  const [roomId, setRoomId] = useState('');
  const [userId, setUserId] = useState('');
  const [users, setUsers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [unmatched, setUnmatched] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showQR, setShowQR] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const pollingInterval = useRef(null);

  // 디버깅을 위한 강제 렌더링 확인
  console.log('App component rendering...');
  console.log('currentView:', currentView);
  console.log('NODE_ENV:', process.env.NODE_ENV);

  useEffect(() => {
    console.log('App component mounted');
    console.log('API_URL:', API_URL);
    
    // URL에서 방 ID 가져오기
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');
    if (roomFromUrl) {
      setRoomId(roomFromUrl);
    }

    return () => {
      // 컴포넌트 언마운트 시 폴링 정리
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, []);

  // 방 상태 폴링
  const pollRoomStatus = async () => {
    if (!roomId) return;
    
    try {
      const response = await fetch(`${API_URL}/api/room/${roomId}`);
      const data = await response.json();
      
      if (data.success && data.room) {
        console.log('Polling update - Room users:', data.room.users);
        console.log('My userId:', userId);
        setUsers(data.room.users);
        if (data.room.users.length > 0) {
          setCurrentView('matching');
        }
        
        // 매칭 결과가 있으면 처리
        if (data.matchResult) {
          console.log('Match result received via polling:', data.matchResult);
          setMatches(data.matchResult.matches || []);
          setUnmatched(data.matchResult.unmatched || []);
          setCurrentView('result');
          stopPolling();
        }
      }
    } catch (error) {
      console.error('Error polling room status:', error);
    }
  };

  // 폴링 시작
  const startPolling = () => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
    }
    pollingInterval.current = setInterval(pollRoomStatus, 2000); // 2초마다 폴링
  };

  // 폴링 중지
  const stopPolling = () => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    console.log('handleJoinRoom called');
    console.log('nickname:', nickname);
    console.log('roomId:', roomId);
    
    if (!nickname || !roomId) {
      setError('닉네임과 방 ID를 모두 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomId,
          nickname
        })
      });

      const data = await response.json();
      
      console.log('Join response:', data);
      
      if (data.success) {
        console.log('Setting userId:', data.userId);
        console.log('Setting users:', data.users);
        setUserId(data.userId);
        setUsers(data.users);
        setCurrentView('matching');
        startPolling();
      } else {
        setError(data.message || '방 참여에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error joining room:', error);
      setError('방 참여 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectUser = async (selectedUserId) => {
    if (!userId || !roomId) return;

    setIsLoading(true);
    
    try {
      const response = await fetch(`${API_URL}/api/select`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomId,
          userId,
          selectedUserId
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setSelectedUser(selectedUserId);
        
        if (data.matches || data.unmatched) {
          // 매칭 결과가 있음
          setMatches(data.matches || []);
          setUnmatched(data.unmatched || []);
          setCurrentView('result');
          stopPolling();
        }
      } else {
        setError(data.message || '선택에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error selecting user:', error);
      setError('선택 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewGame = async () => {
    // 서버에서 방 초기화
    if (roomId) {
      try {
        await fetch(`${API_URL}/api/reset/${roomId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        });
      } catch (error) {
        console.error('Error resetting room:', error);
      }
    }
    
    // 상태 초기화
    setCurrentView('login');
    setUsers([]);
    setMatches([]);
    setUnmatched([]);
    setSelectedUser(null);
    setShowQR(false);
    setUserId('');
    setError('');
    stopPolling();
  };

  const generateRoomURL = () => {
    return `${window.location.origin}?room=${roomId}`;
  };

  const renderLogin = () => (
    <div className="login-container">
      <div className="login-box">
        <h1 className="app-title">🔗 링크 스테이션</h1>
        <p className="app-subtitle">3:3 또는 4:4 매칭 게임</p>
        
        {error && <div className="error-message">{error}</div>}
        
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
              disabled={isLoading}
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
              disabled={isLoading}
            />
          </div>
          
          <button type="submit" className="join-button" disabled={isLoading}>
            {isLoading ? '참여 중...' : '게임 시작'}
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
                <span className="user-nickname">{user.displayName || user.nickname}</span>
                {user.id === userId && <span className="you-badge">나</span>}
              </div>
              {user.id !== userId && (
                <button
                  className={`select-button ${selectedUser === user.id ? 'selected' : ''}`}
                  onClick={() => handleSelectUser(user.id)}
                  disabled={selectedUser !== null || isLoading}
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
      
      {isLoading && (
        <div className="loading-info">
          <p>처리 중...</p>
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
                <span className="user-name">{match.user1.displayName || match.user1.nickname}</span>
                <span className="match-arrow">↔️</span>
                <span className="user-name">{match.user2.displayName || match.user2.nickname}</span>
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
              <span className="user-name">{user.displayName || user.nickname}</span>
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
    <ErrorBoundary>
      <div className="App">
        {currentView === 'login' && renderLogin()}
        {currentView === 'matching' && renderMatching()}
        {currentView === 'result' && renderResult()}
      </div>
    </ErrorBoundary>
  );
}

export default App;