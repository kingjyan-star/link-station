import React, { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import './App.css';

const API_URL = process.env.NODE_ENV === 'production' 
  ? window.location.origin 
  : 'http://localhost:3000';

function App() {
  // State management
  const [currentState, setCurrentState] = useState('registerName'); // registerName, makeOrJoinRoom, makeroom, joinroom, checkpassword, joinroomwithqr, waitingroom, linking, linkresult
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
  const [userRole, setUserRole] = useState('attender'); // 'attender' or 'observer'
  
  // UI state
  const [showQR, setShowQR] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Polling
  const pollingInterval = useRef(null);
  const heartbeatInterval = useRef(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
    };
  }, []);

  // Check URL parameters for QR code access
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomIdFromURL = urlParams.get('room');
    
    if (roomIdFromURL) {
      setRoomId(roomIdFromURL);
      setCurrentState('joinroomwithqr');
    }
  }, []);

  // Auto-hide success messages after 3 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Auto-hide error messages after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Heartbeat functions to keep connection alive
  const sendHeartbeat = useCallback(async () => {
    if (!username || !userId) return;
    
    try {
      await fetch(`${API_URL}/api/ping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, userId })
      });
    } catch (error) {
      console.error('Heartbeat error:', error);
    }
  }, [username, userId]);

  const startHeartbeat = useCallback(() => {
    if (heartbeatInterval.current) {
      clearInterval(heartbeatInterval.current);
    }
    // Send heartbeat every 2 minutes (less than 5 minute timeout)
    heartbeatInterval.current = setInterval(sendHeartbeat, 120000);
  }, [sendHeartbeat]);

  const stopHeartbeat = () => {
    if (heartbeatInterval.current) {
      clearInterval(heartbeatInterval.current);
      heartbeatInterval.current = null;
    }
  };

  // Polling functions
  const pollRoomStatus = useCallback(async () => {
    if (!roomId) return;
    
    console.log('🔄 Polling room status...', { roomId, currentState, userId, hasVoted });
    
    try {
      const response = await fetch(`${API_URL}/api/room/${roomId}`);
      const data = await response.json();
      
      if (data.success && data.room) {
        console.log('📊 Polling response:', {
          gameState: data.room.gameState,
          userCount: data.room.users.length,
          hasMatchResult: !!data.matchResult,
          currentUserVoted: data.room.users.find(u => u.id === userId)?.hasVoted,
          allUsersVotingStatus: data.room.users.map(u => ({ name: u.displayName, voted: u.hasVoted, id: u.id }))
        });
        
        // Check if current user is still in the room
        const currentUserInRoom = data.room.users.find(user => user.id === userId);
        if (!currentUserInRoom) {
          // User has been kicked or removed
          console.log('❌ User not in room, redirecting...');
          setError('방에서 추방되었습니다.');
          setCurrentState('enter');
          setUsername('');
          setRoomId('');
          setUserId('');
          setUsers([]);
          setIsMaster(false);
          setRoomData(null);
          stopPolling();
          return;
        }
        
        // Update users with voting status
        console.log('👥 Users update:', data.room.users.map(u => ({ name: u.displayName, voted: u.hasVoted })));
        console.log('🔄 Setting users state with voting status...');
        setUsers(data.room.users);
        
        // SIMPLE FIX: Show results if they exist, regardless of game state
        if (data.matchResult) {
          console.log('✅ Match results found, showing results to all users');
          setMatches(data.matchResult.matches || []);
          setUnmatched(data.matchResult.unmatched || []);
          setCurrentState('linkresult');
          // Don't stop polling - let the useEffect handle it
        }
      } else {
        console.log('❌ Polling failed:', data);
      }
    } catch (error) {
      console.error('❌ Error polling room status:', error);
    }
  }, [roomId, currentState, userId, hasVoted]);

  const startPolling = useCallback(() => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
    }
    pollingInterval.current = setInterval(pollRoomStatus, 2000);
  }, [pollRoomStatus]);

  const pollWaitingRoomStatus = useCallback(async () => {
    if (!roomId) return;
    
    try {
      const response = await fetch(`${API_URL}/api/room/${roomId}`);
      const data = await response.json();
      
      if (data.success && data.room) {
        // Check if current user is still in the room
        const currentUserInRoom = data.room.users.find(user => user.id === userId);
        if (!currentUserInRoom) {
          // User has been kicked or removed
          setError('방에서 추방되었습니다.');
          setCurrentState('enter');
          setUsername('');
          setRoomId('');
          setUserId('');
          setUsers([]);
          setIsMaster(false);
          setRoomData(null);
          stopPolling();
          return;
        }
        
        // Update users and master status
        setUsers(data.room.users);
        setIsMaster(data.room.masterId === userId);
        
        // Check if game started
        if (data.room.gameState === 'linking') {
          console.log('🎮 Game state changed to linking, switching to game polling...');
          setCurrentState('linking');
          startPolling(); // Switch to game polling
        }
      }
    } catch (error) {
      console.error('Error polling waiting room status:', error);
    }
  }, [roomId, userId, startPolling]);

  const startWaitingRoomPolling = useCallback(() => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
    }
    pollingInterval.current = setInterval(pollWaitingRoomStatus, 2000);
  }, [pollWaitingRoomStatus]);

  const stopPolling = () => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }
  };

  // Start/stop heartbeat based on state
  useEffect(() => {
    if (currentState === 'waitingroom' || currentState === 'linking' || currentState === 'linkresult') {
      startHeartbeat();
    } else {
      stopHeartbeat();
    }
    
    return () => stopHeartbeat();
  }, [currentState, username, userId, startHeartbeat]);

  // SIMPLE FIX: Start polling for any state that needs real-time updates
  useEffect(() => {
    if (currentState === 'waitingroom') {
      startWaitingRoomPolling();
    } else if (currentState === 'linking' || currentState === 'linkresult') {
      startPolling(); // Start polling for linking and result states
    } else {
      stopPolling(); // Stop polling for other states
    }
    
    return () => stopPolling();
  }, [currentState, startWaitingRoomPolling, startPolling]);

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
            setUserRole('attender'); // Initialize as attender
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
          setUserRole('attender'); // Initialize as attender
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
        setUserRole('attender'); // Initialize as attender
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
        setUserRole('attender'); // Initialize as attender
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
  const handleRegisterName = async () => {
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

    setCurrentState('makeOrJoinRoom');
    setError('');
  };

  const handleMakeRoom = () => {
    setCurrentState('makeroom');
    setError('');
  };

  const handleJoinRoom = () => {
    setCurrentState('joinroom');
    setError('');
  };

  const handleExitFromMakeOrJoin = () => {
    // Remove user from active users when they exit
    if (username) {
      // Call API to remove user from active users
      fetch(`${API_URL}/api/remove-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      }).catch(error => console.error('Error removing user:', error));
    }
    setUsername('');
    setCurrentState('registerName');
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

  const handleJoinRoomSubmit = async () => {
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
        // Start polling immediately when game starts
        console.log('🎮 Game started, starting polling...');
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
        
        // Update users list immediately with voting status
        if (data.users) {
          console.log('✅ Vote successful, updating users list:', data.users.map(u => ({ name: u.displayName, voted: u.hasVoted })));
          setUsers(data.users);
        }
        
        // CRITICAL: Ensure polling continues after voting to see other users' status
        console.log('🎯 Vote completed, ensuring polling continues to track other users...');
        
        // Don't immediately show results even if we're the last voter
        // Let polling handle it so all users see results at the same time
        if (data.matches || data.unmatched) {
          console.log('All users have voted. Waiting for polling to broadcast results to all users...');
          // Results will be shown via polling to ensure all users see them simultaneously
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

  // Next round system removed - no rounds, only one game per session

  const handleKickUser = async (targetUserId) => {
    if (!isMaster) return;
    
    try {
      const response = await fetch(`${API_URL}/api/kick-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          masterUserId: userId,
          targetUserId
        })
      });
      const data = await response.json();
      
      if (data.success) {
        setUsers(data.users);
        setSuccess('사용자가 추방되었습니다.');
      } else {
        setError(data.message || '사용자 추방에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error kicking user:', error);
      setError('사용자 추방 중 오류가 발생했습니다.');
    }
  };

  const handleLeaveRoom = async () => {
    // Remove user from room via API
    try {
      if (roomId && userId) {
        await fetch(`${API_URL}/api/leave-room`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId, userId })
        });
      }
    } catch (error) {
      console.error('Error leaving room:', error);
    }
    
    // Clean up state and go back to makeOrJoinRoom (complete exit)
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
    
    // Go back to makeOrJoinRoom state (user keeps their username)
    setCurrentState('makeOrJoinRoom');
  };

  const handleReturnToWaitingRoom = async () => {
    // Return to waiting room after results - keep room alive
    setMatches([]);
    setUnmatched([]);
    setSelectedUser(null);
    setHasVoted(false);
    
    // Reset game state in API
    try {
      if (roomId && userId) {
        await fetch(`${API_URL}/api/return-to-waiting`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId, userId })
        });
      }
    } catch (error) {
      console.error('Error returning to waiting room:', error);
    }
    
    setCurrentState('waitingroom');
    // Start waiting room polling
    startWaitingRoomPolling();
  };

  const handleRoleChange = async (newRole) => {
    if (newRole === userRole) return;
    
    try {
      const response = await fetch(`${API_URL}/api/change-role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, userId, role: newRole })
      });
      const data = await response.json();
      
      if (data.success) {
        setUserRole(newRole);
        // Update users list to reflect role change
        setUsers(data.users);
      } else {
        setError(data.message || '역할 변경에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error changing role:', error);
      setError('역할 변경 중 오류가 발생했습니다.');
    }
  };


  // Render functions
  const renderRegisterName = () => (
    <div className="register-name-container">
      <div className="register-name-header">
        <h1>🔗 링크 스테이션</h1>
        <p>사용자 이름을 입력하세요</p>
      </div>
      
      <div className="register-name-form">
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
            className="register-button"
            onClick={handleRegisterName}
            disabled={!username.trim()}
          >
            계속하기
          </button>
        </div>
      </div>
    </div>
  );

  const renderMakeOrJoinRoom = () => (
    <div className="make-or-join-container">
      <div className="make-or-join-header">
        <h2>안녕하세요, {username}님!</h2>
        <p>원하시는 작업을 선택하세요</p>
      </div>
      
      <div className="make-or-join-options">
        <button 
          className="make-room-button"
          onClick={handleMakeRoom}
        >
          🏠 방 만들기
        </button>
        <button 
          className="join-room-button"
          onClick={handleJoinRoom}
        >
          🚪 방 참여하기
        </button>
        <button 
          className="exit-button"
          onClick={handleExitFromMakeOrJoin}
        >
          🚪 나가기
        </button>
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
              setCurrentState('makeOrJoinRoom');
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

  const renderJoinRoom = () => (
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
            onClick={handleJoinRoomSubmit}
            disabled={isLoading || !enteredRoomName.trim()}
          >
            {isLoading ? '참여 중...' : '방 참여하기'}
          </button>
          <button 
            className="cancel-button"
            onClick={() => {
              setCurrentState('makeOrJoinRoom');
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

  const renderJoinRoomWithQR = () => (
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
      
      {/* Role Selection Boxes */}
      <div className="role-selection">
        <div 
          className={`role-box attender-box ${userRole === 'attender' ? 'active' : ''}`}
          onClick={() => handleRoleChange('attender')}
        >
          <h3>참가자</h3>
        </div>
        <div 
          className={`role-box observer-box ${userRole === 'observer' ? 'active' : ''}`}
          onClick={() => handleRoleChange('observer')}
        >
          <h3>관전자</h3>
        </div>
      </div>

      {/* Attender List */}
      <div className="attenders-list">
        <h3>참가자 목록</h3>
        <div className="users-grid">
          {users.filter(user => user.role === 'attender').map(user => (
            <div key={user.id} className="user-card">
              <div className="user-info">
                <span className="user-nickname">{user.displayName || user.nickname}</span>
                {user.id === userId && <span className="you-badge">나</span>}
                {user.isMaster && <span className="master-badge">방장</span>}
              </div>
              {isMaster && user.id !== userId && (
                <button
                  className="kick-button"
                  onClick={() => handleKickUser(user.id)}
                  title="사용자 추방"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Observer List */}
      <div className="observers-list">
        <h3>관전자 목록</h3>
        <div className="users-grid">
          {users.filter(user => user.role === 'observer').map(user => (
            <div key={user.id} className="user-card observer-card">
              <div className="user-info">
                <span className="user-nickname">{user.displayName || user.nickname}</span>
                {user.id === userId && <span className="you-badge">나</span>}
                {user.isMaster && <span className="master-badge">방장</span>}
              </div>
              {isMaster && user.id !== userId && (
                <button
                  className="kick-button"
                  onClick={() => handleKickUser(user.id)}
                  title="사용자 추방"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {isMaster && (
        <div className="master-controls">
          <button 
            className="start-game-button"
            onClick={handleStartGame}
            disabled={users.filter(user => user.role === 'attender').length < 2 || isLoading}
          >
            {isLoading ? '게임 시작 중...' : `게임 시작 (참가자 ${users.filter(user => user.role === 'attender').length}명)`}
          </button>
          {users.filter(user => user.role === 'attender').length < 2 && (
            <p className="waiting-message">참가자는 최소 2명 이상 필요합니다.</p>
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
        <p>{userRole === 'observer' ? '투표 상황을 관전하세요' : '연결하고 싶은 사람을 선택하세요'}</p>
        <p className="role-indicator">현재 역할: {userRole === 'attender' ? '참가자' : '관전자'}</p>
      </div>
      
      <div className="users-list">
        <h3>참가자 목록</h3>
        <div className="users-grid">
          {users.filter(user => user.role === 'attender').map(user => (
            <div key={user.id} className="user-card">
              <div className="user-info">
                <span className="user-nickname">{user.displayName || user.nickname}</span>
                {user.id === userId && <span className="you-badge">나</span>}
              </div>
              
              <div className="user-indicators">
                {/* 1. Master badge */}
                {user.isMaster && (
                  <div className="master-indicator">
                    <span>👑 방장</span>
                  </div>
                )}
                
                {/* 2. Your selection indicator */}
                {hasVoted && selectedUser === user.id && (
                  <div className="selected-indicator">
                    <span>🎯 당신의 선택</span>
                  </div>
                )}
                
                {/* 3. Voting status indicator */}
                {user.hasVoted ? (
                  <div className="completed-indicator">
                    <span>✅ 투표완료</span>
                  </div>
                ) : (
                  <div className="waiting-indicator">
                    <span>⏳ 투표 중</span>
                  </div>
                )}
              </div>
              {!hasVoted && user.id !== userId && userRole === 'attender' && (
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
        <button className="return-to-waiting-button" onClick={handleReturnToWaitingRoom}>
          대기실로 돌아가기
        </button>
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
      
      {currentState === 'registerName' && renderRegisterName()}
      {currentState === 'makeOrJoinRoom' && renderMakeOrJoinRoom()}
      {currentState === 'makeroom' && renderMakeRoom()}
      {currentState === 'joinroom' && renderJoinRoom()}
      {currentState === 'checkpassword' && renderCheckPassword()}
      {currentState === 'joinroomwithqr' && renderJoinRoomWithQR()}
      {currentState === 'waitingroom' && renderWaitingRoom()}
      {currentState === 'linking' && renderLinking()}
      {currentState === 'linkresult' && renderLinkResult()}
      </div>
  );
}

export default App;