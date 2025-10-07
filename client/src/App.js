import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import './App.css';

const API_URL = process.env.NODE_ENV === 'production' 
  ? window.location.origin 
  : 'http://localhost:3000';

function App() {
  // State management
  const [currentState, setCurrentState] = useState('enter'); // enter, makeroom, enterroom, checkpassword, enterroomwithqr, waitingroom, linking, linkresult
  const [username, setUsername] = useState('');
  const [roomName, setRoomName] = useState('');
  const [roomPassword, setRoomPassword] = useState('');
  const [memberLimit, setMemberLimit] = useState(8);
  const [enteredRoomName, setEnteredRoomName] = useState('');
  const [enteredPassword, setEnteredPassword] = useState('');
  
  // Room and user data
  const [roomId, setRoomId] = useState('');
  const [userId, setUserId] = useState('');
  const [users, setUsers] = useState([]);
  const [isMaster, setIsMaster] = useState(false);
  const [roomData, setRoomData] = useState(null);
  
  // Game data
  const [matches, setMatches] = useState([]);
  const [unmatched, setUnmatched] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [hasVoted, setHasVoted] = useState(false);
  
  // UI state
  const [showQR, setShowQR] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Polling
  const pollingInterval = useRef(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, []);

  // Check URL parameters for QR code access
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomIdFromURL = urlParams.get('room');
    
    if (roomIdFromURL) {
      setRoomId(roomIdFromURL);
      setCurrentState('enterroomwithqr');
    }
  }, []);

  // Start waiting room polling when in waiting room state
  useEffect(() => {
    if (currentState === 'waitingroom') {
      startWaitingRoomPolling();
    } else {
      stopPolling();
    }
    
    return () => stopPolling();
  }, [currentState]);

  // Validation functions
  const validateUsername = (name) => {
    if (!name || name.trim() === '') {
      return { valid: false, message: '사용자 이름을 입력해주세요.' };
    }
    if (name.length > 32) {
      return { valid: false, message: '사용자 이름은 32자 이하여야 합니다.' };
    }
    return { valid: true };
  };

  const validateRoomName = (name) => {
    if (!name || name.trim() === '') {
      return { valid: false, message: '방 이름을 입력해주세요.' };
    }
    if (name.length > 128) {
      return { valid: false, message: '방 이름은 128자 이하여야 합니다.' };
    }
    return { valid: true };
  };

  const validatePassword = (password) => {
    if (password && password.length > 16) {
      return { valid: false, message: '비밀번호는 16자 이하여야 합니다.' };
    }
    return { valid: true };
  };

  const validateMemberLimit = (limit) => {
    if (!limit || limit < 2) {
      return { valid: false, message: '최소 2명 이상이어야 합니다.' };
    }
    if (limit > 99) {
      return { valid: false, message: '최대 99명까지 가능합니다.' };
    }
    return { valid: true };
  };

  // API functions
  const checkUsernameDuplication = async (name) => {
    try {
      const response = await fetch(`${API_URL}/api/check-username`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: name })
      });
      const data = await response.json();
      return data.duplicate;
    } catch (error) {
      console.error('Error checking username:', error);
      return false;
    }
  };

  const createRoom = async () => {
    try {
      const response = await fetch(`${API_URL}/api/create-room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName,
          roomPassword: roomPassword || null,
          memberLimit,
          username
        })
      });
      const data = await response.json();
      
      if (data.success) {
        setRoomId(data.roomId);
        setUserId(data.userId);
        setUsers(data.users);
        setIsMaster(true);
        setRoomData(data.roomData);
        setCurrentState('waitingroom');
        setSuccess('방이 생성되었습니다!');
      } else {
        setError(data.message || '방 생성에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error creating room:', error);
      setError('방 생성 중 오류가 발생했습니다.');
    }
  };

  const joinRoom = async () => {
    try {
      const response = await fetch(`${API_URL}/api/join-room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: enteredRoomName,
          username
        })
      });
      const data = await response.json();
      
      if (data.success) {
        if (data.requiresPassword) {
          setCurrentState('checkpassword');
        } else {
          setRoomId(data.roomId);
          setUserId(data.userId);
          setUsers(data.users);
          setIsMaster(data.isMaster);
          setRoomData(data.roomData);
          setCurrentState('waitingroom');
          setSuccess('방에 참여했습니다!');
        }
      } else {
        setError(data.message || '방 참여에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error joining room:', error);
      setError('방 참여 중 오류가 발생했습니다.');
    }
  };

  const checkPassword = async () => {
    try {
      const response = await fetch(`${API_URL}/api/check-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: enteredRoomName,
          password: enteredPassword,
          username
        })
      });
      const data = await response.json();
      
      if (data.success) {
        setRoomId(data.roomId);
        setUserId(data.userId);
        setUsers(data.users);
        setIsMaster(data.isMaster);
        setRoomData(data.roomData);
        setCurrentState('waitingroom');
        setSuccess('방에 참여했습니다!');
      } else {
        setError(data.message || '비밀번호가 올바르지 않습니다.');
      }
    } catch (error) {
      console.error('Error checking password:', error);
      setError('비밀번호 확인 중 오류가 발생했습니다.');
    }
  };

  const joinRoomWithQR = async () => {
    try {
      const response = await fetch(`${API_URL}/api/join-room-qr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          username
        })
      });
      const data = await response.json();
      
      if (data.success) {
        setUserId(data.userId);
        setUsers(data.users);
        setIsMaster(data.isMaster);
        setRoomData(data.roomData);
        setCurrentState('waitingroom');
        setSuccess('방에 참여했습니다!');
      } else {
        setError(data.message || '방 참여에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error joining room with QR:', error);
      setError('방 참여 중 오류가 발생했습니다.');
    }
  };

  // Event handlers
  const handleMakeRoom = async () => {
    const validation = validateUsername(username);
    if (!validation.valid) {
      setError(validation.message);
      return;
    }

    const isDuplicate = await checkUsernameDuplication(username);
    if (isDuplicate) {
      setError('이미 사용 중인 사용자 이름입니다.');
      return;
    }

    setCurrentState('makeroom');
    setError('');
  };

  const handleEnterRoom = async () => {
    const validation = validateUsername(username);
    if (!validation.valid) {
      setError(validation.message);
      return;
    }

    const isDuplicate = await checkUsernameDuplication(username);
    if (isDuplicate) {
      setError('이미 사용 중인 사용자 이름입니다.');
      return;
    }

    setCurrentState('enterroom');
    setError('');
  };

  const handleCreateRoom = async () => {
    const roomNameValidation = validateRoomName(roomName);
    if (!roomNameValidation.valid) {
      setError(roomNameValidation.message);
      return;
    }

    const passwordValidation = validatePassword(roomPassword);
    if (!passwordValidation.valid) {
      setError(passwordValidation.message);
      return;
    }

    const memberLimitValidation = validateMemberLimit(memberLimit);
    if (!memberLimitValidation.valid) {
      setError(memberLimitValidation.message);
      return;
    }

    setIsLoading(true);
    await createRoom();
    setIsLoading(false);
  };

  const handleJoinRoom = async () => {
    const roomNameValidation = validateRoomName(enteredRoomName);
    if (!roomNameValidation.valid) {
      setError(roomNameValidation.message);
      return;
    }

    setIsLoading(true);
    await joinRoom();
    setIsLoading(false);
  };

  const handleCheckPassword = async () => {
    const passwordValidation = validatePassword(enteredPassword);
    if (!passwordValidation.valid) {
      setError(passwordValidation.message);
      return;
    }

    setIsLoading(true);
    await checkPassword();
    setIsLoading(false);
  };

  const handleJoinWithQR = async () => {
    const validation = validateUsername(username);
    if (!validation.valid) {
      setError(validation.message);
      return;
    }

    const isDuplicate = await checkUsernameDuplication(username);
    if (isDuplicate) {
      setError('이미 사용 중인 사용자 이름입니다.');
      return;
    }

    setIsLoading(true);
    await joinRoomWithQR();
    setIsLoading(false);
  };

  const handleStartGame = async () => {
    if (!isMaster) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/start-game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, userId })
      });
      const data = await response.json();
      
      if (data.success) {
        setCurrentState('linking');
        startPolling();
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

  const handleSelectUser = async (selectedUserId) => {
    if (hasVoted) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          userId,
          selectedUserId
        })
      });
      const data = await response.json();
      
      if (data.success) {
        setSelectedUser(selectedUserId);
        setHasVoted(true);
        
        if (data.matches || data.unmatched) {
          setMatches(data.matches || []);
          setUnmatched(data.unmatched || []);
          setCurrentState('linkresult');
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

  const handleNextRound = () => {
    setMatches([]);
    setUnmatched([]);
    setSelectedUser(null);
    setHasVoted(false);
    setCurrentState('linking');
    startPolling();
  };

  const handleLeaveRoom = () => {
    setCurrentState('enter');
    setUsername('');
    setRoomId('');
    setUserId('');
    setUsers([]);
    setIsMaster(false);
    setRoomData(null);
    setMatches([]);
    setUnmatched([]);
    setSelectedUser(null);
    setHasVoted(false);
    stopPolling();
  };

  // Polling functions
  const startPolling = () => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
    }
    pollingInterval.current = setInterval(pollRoomStatus, 2000);
  };

  const startWaitingRoomPolling = () => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
    }
    pollingInterval.current = setInterval(pollWaitingRoomStatus, 2000);
  };

  const stopPolling = () => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }
  };

  const pollRoomStatus = async () => {
    if (!roomId) return;
    
    try {
      const response = await fetch(`${API_URL}/api/room/${roomId}`);
      const data = await response.json();
      
      if (data.success && data.room) {
        setUsers(data.room.users);
        
        if (currentState === 'linking') {
          if (data.room.gameState === 'completed' && data.matchResult) {
            setMatches(data.matchResult.matches || []);
            setUnmatched(data.matchResult.unmatched || []);
            setCurrentState('linkresult');
            stopPolling();
          }
        }
      }
    } catch (error) {
      console.error('Error polling room status:', error);
    }
  };

  const pollWaitingRoomStatus = async () => {
    if (!roomId) return;
    
    try {
      const response = await fetch(`${API_URL}/api/room/${roomId}`);
      const data = await response.json();
      
      if (data.success && data.room) {
        // Update users and master status
        setUsers(data.room.users);
        setIsMaster(data.room.masterId === userId);
        
        // Check if game started
        if (data.room.gameState === 'linking') {
          setCurrentState('linking');
          startPolling(); // Switch to game polling
        }
      }
    } catch (error) {
      console.error('Error polling waiting room status:', error);
    }
  };

  // Render functions
  const renderEnter = () => (
    <div className="enter-container">
      <div className="enter-header">
        <h1>🔗 링크 스테이션</h1>
        <p>사용자 이름을 입력하고 방을 만들거나 참여하세요</p>
      </div>
      
      <div className="enter-form">
        <div className="input-group">
          <label htmlFor="username">사용자 이름 (최대 32자)</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="사용자 이름을 입력하세요"
            maxLength={32}
          />
        </div>
        
        <div className="button-group">
          <button 
            className="make-room-button"
            onClick={handleMakeRoom}
            disabled={!username.trim()}
          >
            방 만들기
          </button>
          <button 
            className="enter-room-button"
            onClick={handleEnterRoom}
            disabled={!username.trim()}
          >
            방 참여하기
          </button>
        </div>
      </div>
    </div>
  );

  const renderMakeRoom = () => (
    <div className="makeroom-container">
      <div className="makeroom-header">
        <h2>방 만들기</h2>
        <p>방 설정을 입력하세요</p>
      </div>
      
      <div className="makeroom-form">
        <div className="input-group">
          <label htmlFor="roomName">방 이름 (최대 128자)</label>
          <input
            id="roomName"
            type="text"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="방 이름을 입력하세요"
            maxLength={128}
          />
        </div>
        
        <div className="input-group">
          <label htmlFor="roomPassword">방 비밀번호 (선택사항, 최대 16자)</label>
          <input
            id="roomPassword"
            type="password"
            value={roomPassword}
            onChange={(e) => setRoomPassword(e.target.value)}
            placeholder="비밀번호를 입력하세요 (선택사항)"
            maxLength={16}
          />
        </div>
        
        <div className="input-group">
          <label htmlFor="memberLimit">최대 인원 (2-99명)</label>
          <input
            id="memberLimit"
            type="number"
            value={memberLimit}
            onChange={(e) => setMemberLimit(parseInt(e.target.value) || 8)}
            min="2"
            max="99"
          />
        </div>
        
        <div className="button-group">
          <button 
            className="create-room-button"
            onClick={handleCreateRoom}
            disabled={isLoading || !roomName.trim() || memberLimit < 2}
          >
            {isLoading ? '방 생성 중...' : '방 생성하기'}
          </button>
          <button 
            className="cancel-button"
            onClick={() => {
              setCurrentState('enter');
              setRoomName('');
              setRoomPassword('');
              setMemberLimit(8);
            }}
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );

  const renderEnterRoom = () => (
    <div className="enterroom-container">
      <div className="enterroom-header">
        <h2>방 참여하기</h2>
        <p>참여할 방의 이름을 입력하세요</p>
      </div>
      
      <div className="enterroom-form">
        <div className="input-group">
          <label htmlFor="enteredRoomName">방 이름 (최대 128자)</label>
          <input
            id="enteredRoomName"
            type="text"
            value={enteredRoomName}
            onChange={(e) => setEnteredRoomName(e.target.value)}
            placeholder="방 이름을 입력하세요"
            maxLength={128}
          />
        </div>
        
        <div className="button-group">
          <button 
            className="join-room-button"
            onClick={handleJoinRoom}
            disabled={isLoading || !enteredRoomName.trim()}
          >
            {isLoading ? '참여 중...' : '방 참여하기'}
          </button>
          <button 
            className="cancel-button"
            onClick={() => {
              setCurrentState('enter');
              setEnteredRoomName('');
            }}
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );

  const renderCheckPassword = () => (
    <div className="checkpassword-container">
      <div className="checkpassword-header">
        <h2>비밀번호 확인</h2>
        <p>방 "{enteredRoomName}"의 비밀번호를 입력하세요</p>
      </div>
      
      <div className="checkpassword-form">
        <div className="input-group">
          <label htmlFor="enteredPassword">방 비밀번호 (최대 16자)</label>
          <input
            id="enteredPassword"
            type="password"
            value={enteredPassword}
            onChange={(e) => setEnteredPassword(e.target.value)}
            placeholder="비밀번호를 입력하세요"
            maxLength={16}
          />
        </div>
        
        <div className="button-group">
          <button 
            className="enter-button"
            onClick={handleCheckPassword}
            disabled={isLoading}
          >
            {isLoading ? '확인 중...' : '입장하기'}
          </button>
          <button 
            className="cancel-button"
            onClick={() => {
              setCurrentState('enterroom');
              setEnteredPassword('');
            }}
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );

  const renderEnterRoomWithQR = () => (
    <div className="enterroomwithqr-container">
      <div className="enterroomwithqr-header">
        <h2>QR 코드로 참여하기</h2>
        <p>사용자 이름을 입력하고 방에 참여하세요</p>
      </div>
      
      <div className="enterroomwithqr-form">
        <div className="input-group">
          <label htmlFor="qrUsername">사용자 이름 (최대 32자)</label>
          <input
            id="qrUsername"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="사용자 이름을 입력하세요"
            maxLength={32}
          />
        </div>
        
        <div className="button-group">
          <button 
            className="join-button"
            onClick={handleJoinWithQR}
            disabled={isLoading || !username.trim()}
          >
            {isLoading ? '참여 중...' : '참여하기'}
          </button>
          <button 
            className="cancel-button"
            onClick={() => setCurrentState('enterroom')}
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );

  const renderWaitingRoom = () => (
    <div className="waitingroom-container">
      <div className="waitingroom-header">
        <h2>🔗 링크 스테이션</h2>
        <p>방: {roomData?.roomName} | 참여자: {users.length}/{roomData?.memberLimit}명</p>
        {isMaster && <span className="master-badge">방장</span>}
      </div>
      
      <div className="qr-section">
        <button 
          className="qr-button"
          onClick={() => setShowQR(!showQR)}
        >
          {showQR ? 'QR코드 숨기기' : 'QR코드로 공유하기'}
        </button>
        {showQR && (
          <div className="qr-container">
            <QRCodeSVG value={`${window.location.origin}?room=${roomId}`} size={200} />
            <p className="qr-text">QR코드를 스캔하여 같은 방에 참여하세요!</p>
            <p className="qr-link">링크: {window.location.origin}?room={roomId}</p>
          </div>
        )}
      </div>
      
      <div className="users-list">
        <h3>참여자 목록</h3>
        <div className="users-grid">
          {users.map(user => (
            <div key={user.id} className="user-card">
              <div className="user-info">
                <span className="user-nickname">{user.displayName || user.nickname}</span>
                {user.id === userId && <span className="you-badge">나</span>}
                {user.isMaster && <span className="master-badge">방장</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {isMaster && (
        <div className="master-controls">
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
      
      <div className="room-actions">
        <button className="leave-room-button" onClick={handleLeaveRoom}>
          방 나가기
        </button>
      </div>
    </div>
  );

  const renderLinking = () => (
    <div className="linking-container">
      <div className="linking-header">
        <h2>🔗 링크하기</h2>
        <p>연결하고 싶은 사람을 선택하세요</p>
      </div>
      
      <div className="users-list">
        <h3>참여자 목록</h3>
        <div className="users-grid">
          {users.map(user => (
            <div key={user.id} className="user-card">
              <div className="user-info">
                <span className="user-nickname">{user.displayName || user.nickname}</span>
                {user.id === userId && <span className="you-badge">나</span>}
                {user.hasVoted && <span className="voted-badge">투표완료</span>}
              </div>
              {!hasVoted && user.id !== userId && (
                <button 
                  className="select-button"
                  onClick={() => handleSelectUser(user.id)}
                  disabled={isLoading}
                >
                  선택
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {hasVoted && (
        <div className="voted-message">
          <p>투표가 완료되었습니다. 다른 참여자들의 선택을 기다리는 중...</p>
        </div>
      )}
    </div>
  );

  const renderLinkResult = () => (
    <div className="linkresult-container">
      <div className="linkresult-header">
        <h2>🎉 링크 결과</h2>
        <p>이번 라운드의 결과입니다</p>
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
        {isMaster && unmatched.length > 0 && (
          <button className="next-round-button" onClick={handleNextRound}>
            다음 라운드 ({unmatched.length}명)
          </button>
        )}
        <button className="leave-room-button" onClick={handleLeaveRoom}>
          방 나가기
        </button>
      </div>
    </div>
  );

  return (
    <div className="App">
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      
      {currentState === 'enter' && renderEnter()}
      {currentState === 'makeroom' && renderMakeRoom()}
      {currentState === 'enterroom' && renderEnterRoom()}
      {currentState === 'checkpassword' && renderCheckPassword()}
      {currentState === 'enterroomwithqr' && renderEnterRoomWithQR()}
      {currentState === 'waitingroom' && renderWaitingRoom()}
      {currentState === 'linking' && renderLinking()}
      {currentState === 'linkresult' && renderLinkResult()}
    </div>
  );
}

export default App;