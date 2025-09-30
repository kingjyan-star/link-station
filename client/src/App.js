import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import ErrorBoundary from './ErrorBoundary';
import './App.css';

const API_URL = process.env.NODE_ENV === 'production' 
  ? window.location.origin 
  : 'http://localhost:3000';

function App() {
  const [currentView, setCurrentView] = useState('login'); // login, waiting, matching, result
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
  const [isHost, setIsHost] = useState(false);
  const [gameState, setGameState] = useState('waiting');
  const pollingInterval = useRef(null);
  const [debugInfo, setDebugInfo] = useState('');

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
        console.log('Game state:', data.room.gameState);
        console.log('Current users state before update:', users);
        
        setUsers(data.room.users);
        setGameState(data.room.gameState);
        
        // 호스트 정보 업데이트
        if (data.room.hostId) {
          setIsHost(data.room.hostId === userId);
        }
        
        setDebugInfo(`Polling: ${data.room.users.length} users, Host: ${data.room.hostId === userId}, State: ${data.room.gameState}`);
        
        // 게임 상태에 따라 뷰 변경
        if (data.room.gameState === 'matching' && currentView === 'waiting') {
          console.log('Game started by host, moving to matching view');
          setCurrentView('matching');
        } else if (data.room.gameState === 'completed' && data.matchResult) {
          console.log('Match result received via polling:', data.matchResult);
          setMatches(data.matchResult.matches || []);
          setUnmatched(data.matchResult.unmatched || []);
          setCurrentView('result');
        }
      }
    } catch (error) {
      console.error('Error polling room status:', error);
    }
  };

  // 폴링 시작
  const startPolling = (interval = 2000) => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
    }
    pollingInterval.current = setInterval(pollRoomStatus, interval);
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
        console.log('Is host:', data.isHost);
        console.log('Game state:', data.gameState);
        console.log('Number of users in response:', data.users.length);
        
        setUserId(data.userId);
        setUsers(data.users);
        setIsHost(data.isHost);
        setGameState(data.gameState);
        setCurrentView('waiting');
        setDebugInfo(`Joined: ${data.users.length} users, Host: ${data.isHost}, State: ${data.gameState}`);
        
        // 대기실에서도 실시간 폴링 (2초마다)
        startPolling(2000);
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


  const handleStartGame = async () => {
    if (!isHost) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${API_URL}/api/start-game`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomId,
          userId
        })
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('Game started successfully');
        setGameState('matching');
        setCurrentView('matching');
        startPolling(2000); // 게임 시작 시 폴링 시작
      } else {
        setError(data.message || '게임 시작에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error starting game:', error);
      setError('게임 시작 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReturnToWaiting = async () => {
    if (!isHost) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${API_URL}/api/return-to-waiting`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomId,
          userId
        })
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('Returned to waiting room');
        setGameState('waiting');
        setCurrentView('waiting');
        setMatches([]);
        setUnmatched([]);
        setSelectedUser(null);
        stopPolling(); // 대기실로 돌아가면 폴링 중지
      } else {
        setError(data.message || '대기실로 돌아가기에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error returning to waiting room:', error);
      setError('대기실로 돌아가는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewGame = async () => {
    // 상태 초기화
    setCurrentView('login');
    setUsers([]);
    setMatches([]);
    setUnmatched([]);
    setSelectedUser(null);
    setShowQR(false);
    setUserId('');
    setIsHost(false);
    setGameState('waiting');
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

  const renderWaiting = () => (
    <div className="waiting-container">
      <div className="waiting-header">
        <h2>🔗 링크 스테이션</h2>
        <p>방 ID: {roomId} | 참여자: {users.length}명</p>
        {isHost && <span className="host-badge">방장</span>}
        
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
                {user.id === userId && isHost && <span className="host-badge">방장</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {isHost && (
        <div className="host-controls">
          <button 
            className="start-game-button"
            onClick={handleStartGame}
            disabled={users.length < 2 || isLoading}
          >
            {isLoading ? '게임 시작 중...' : `게임 시작 (${users.length}명)`}
          </button>
          {users.length < 2 && (
            <p className="waiting-message">최소 2명 이상 필요합니다.</p>
          )}
        </div>
      )}
      
      {!isHost && (
        <div className="waiting-message">
          <p>방장이 게임을 시작할 때까지 기다려주세요...</p>
        </div>
      )}
      
      {error && <div className="error-message">{error}</div>}
      
      <div style={{position: 'fixed', top: '10px', right: '10px', background: 'rgba(0,0,0,0.8)', color: 'white', padding: '10px', fontSize: '12px', zIndex: 1000}}>
        <div>View: {currentView}</div>
        <div>Users: {users.length}</div>
        <div>IsHost: {isHost.toString()}</div>
        <div>GameState: {gameState}</div>
        <div>UserId: {userId}</div>
        <div>{debugInfo}</div>
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
              {user.id !== userId && gameState === 'matching' && (
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
      
      {gameState === 'waiting' && (
        <div className="waiting-message">
          <p>방장이 게임을 시작할 때까지 기다려주세요...</p>
        </div>
      )}
      
      {selectedUser && gameState === 'matching' && (
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
      
      <div className="result-actions">
        {isHost && (
          <button className="return-waiting-button" onClick={handleReturnToWaiting}>
            대기실로 돌아가기
          </button>
        )}
        <button className="new-game-button" onClick={handleNewGame}>
          새 게임 시작
        </button>
      </div>
    </div>
  );

  return (
    <ErrorBoundary>
      <div className="App">
        {currentView === 'login' && renderLogin()}
        {currentView === 'waiting' && renderWaiting()}
        {currentView === 'matching' && renderMatching()}
        {currentView === 'result' && renderResult()}
      </div>
    </ErrorBoundary>
  );
}

export default App;