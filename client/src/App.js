import React, { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import './App.css';

const API_URL = process.env.NODE_ENV === 'production' 
  ? window.location.origin 
  : 'http://localhost:3000';

function App() {
  // State management
  const [currentState, setCurrentState] = useState('registerName'); // registerName, makeOrJoinRoom, makeroom, joinroom, checkpassword, joinroomwithqr, waitingroom, linking, linkresult, adminPassword, adminDashboard, adminStatus, adminCleanup, adminShutdown, adminChangePassword
  const [username, setUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminToken, setAdminToken] = useState('');
  const [adminSecondPassword, setAdminSecondPassword] = useState('');
  const [adminNewPassword, setAdminNewPassword] = useState('');
  const [adminNewPasswordConfirm, setAdminNewPasswordConfirm] = useState('');
  const [adminStatusFilter, setAdminStatusFilter] = useState(null); // 'rooms' or 'users'
  const [adminUserFilter, setAdminUserFilter] = useState(null); // 'all', 'notInRoom', 'waiting', 'playing', 'result'
  const [adminRoomFilter, setAdminRoomFilter] = useState(null); // 'all', 'waiting', 'playing', 'result'
  const [adminStatusData, setAdminStatusData] = useState(null);
  const [adminUsersList, setAdminUsersList] = useState([]);
  const [adminRoomsList, setAdminRoomsList] = useState([]);
  const [adminSessions, setAdminSessions] = useState(null);
  const [adminPasswordStep, setAdminPasswordStep] = useState(1); // 1 = second password, 2 = new password
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
  const [gameState, setGameState] = useState('waiting'); // 'waiting', 'linking', 'completed'
  
  // UI state
  const [showQR, setShowQR] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Warning state
  const [showUserWarning, setShowUserWarning] = useState(false);
  const [showRoomWarning, setShowRoomWarning] = useState(false);
  const [userTimeLeft, setUserTimeLeft] = useState(0);
  const [roomTimeLeft, setRoomTimeLeft] = useState(0);
  const [showAdminWarning, setShowAdminWarning] = useState(false);
  const [adminTimeLeft, setAdminTimeLeft] = useState(0);
  const [shutdownStatus, setShutdownStatus] = useState(null);
  
  // Polling
  const pollingInterval = useRef(null);
  const heartbeatInterval = useRef(null);
  const warningInterval = useRef(null);
  const adminWarningInterval = useRef(null);
  const isLeavingRoom = useRef(false); // Flag to prevent "kicked" alert when user leaves voluntarily

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
      if (adminWarningInterval.current) {
        clearInterval(adminWarningInterval.current);
      }
    };
  }, []);

  // Free username when tab closes (but not when tab goes to background)
  useEffect(() => {
    if (!username) return; // No username = nothing to clean up
    
    const freeUsername = () => {
      // Use sendBeacon for reliable delivery during page unload
      // sendBeacon requires Blob or FormData with proper Content-Type
      if (navigator.sendBeacon) {
        try {
          const blob = new Blob([JSON.stringify({ username })], {
            type: 'application/json'
          });
          const success = navigator.sendBeacon(
            `${API_URL}/api/remove-user`,
            blob
          );
          if (success) {
            console.log(`🔓 Username "${username}" freed on tab close`);
          } else {
            console.warn('Failed to send beacon - username may remain locked until timeout');
          }
        } catch (error) {
          console.error('Error freeing username on tab close:', error);
        }
      } else {
        // Fallback for browsers that don't support sendBeacon
        // Use synchronous XMLHttpRequest (blocking, but only on unload)
        try {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', `${API_URL}/api/remove-user`, false); // false = synchronous
          xhr.setRequestHeader('Content-Type', 'application/json');
          xhr.send(JSON.stringify({ username }));
        } catch (error) {
          console.error('Error freeing username (fallback):', error);
        }
      }
    };
    
    const handleBeforeUnload = () => {
      // Free username when tab is closing
      freeUsername();
    };
    
    const handlePageHide = (event) => {
      // pagehide is more reliable on mobile browsers
      if (event.persisted) {
        // Page is being cached (not actually closed) - don't free username
        console.log('📄 Page cached (back/forward navigation), keeping username');
        return;
      }
      // Page is actually unloading - free username
      freeUsername();
    };
    
    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);
    
    return () => {
      // Cleanup event listeners
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [username]);

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
    // Send heartbeat every 5 minutes (well under 30 minute timeout)
    heartbeatInterval.current = setInterval(sendHeartbeat, 5 * 60 * 1000);
    // Send initial heartbeat immediately
    sendHeartbeat();
  }, [sendHeartbeat]);

  const stopHeartbeat = () => {
    if (heartbeatInterval.current) {
      clearInterval(heartbeatInterval.current);
      heartbeatInterval.current = null;
    }
  };

  // Warning check function
  const checkWarning = useCallback(async () => {
    if (!username || !userId) return;
    
    try {
      const response = await fetch(`${API_URL}/api/check-warning`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, userId, roomId })
      });
      const data = await response.json();
      
      if (data.userWarning) {
        setShowUserWarning(true);
        setUserTimeLeft(data.userTimeLeft);
      } else {
        setShowUserWarning(false);
      }
      
      // Show room warning to all users (not just master)
      if (data.roomWarning) {
        setShowRoomWarning(true);
        setRoomTimeLeft(data.roomTimeLeft);
      } else {
        setShowRoomWarning(false);
      }
      
      // Handle disconnection - user is completely logged out
      if (data.userDisconnected) {
        alert('⚠️ 장시간 활동이 감지되지 않아 로그아웃되었습니다.');
        // Complete logout - clear everything including username
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
        stopWarningCheck();
        setCurrentState('registerName'); // Go back to name registration (complete logout)
      }
      
      // Handle room deletion
      if (data.roomDeleted) {
        alert('⚠️ 장시간 활동이 감지되지 않아 방이 사라졌습니다.');
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
        stopWarningCheck();
        setCurrentState('makeOrJoinRoom');
      }
    } catch (error) {
      console.error('Warning check error:', error);
    }
  }, [username, userId, roomId]); // Removed isMaster (not used), stopPolling and stopWarningCheck (refs, stable)

  const startWarningCheck = useCallback(() => {
    if (warningInterval.current) {
      clearInterval(warningInterval.current);
    }
    // Check every 10 seconds
    warningInterval.current = setInterval(checkWarning, 10000);
    // Check immediately
    checkWarning();
  }, [checkWarning]);

  const stopWarningCheck = () => {
    if (warningInterval.current) {
      clearInterval(warningInterval.current);
      warningInterval.current = null;
    }
    setShowUserWarning(false);
    setShowRoomWarning(false);
  };

  const clearAdminSession = useCallback(() => {
    setUsername('');
    setAdminPassword('');
    setAdminToken('');
    setAdminSecondPassword('');
    setAdminNewPassword('');
    setAdminNewPasswordConfirm('');
    setAdminPasswordStep(1);
    setAdminStatusFilter(null);
    setAdminUserFilter(null);
    setAdminRoomFilter(null);
    setAdminStatusData(null);
    setAdminUsersList([]);
    setAdminRoomsList([]);
    setAdminSessions(null);
    setCurrentState('registerName');
  }, []);

  const handleAdminAuthFailure = useCallback((message) => {
    clearAdminSession();
    setError(message || '관리자 세션이 만료되었습니다. 다시 로그인해주세요.');
  }, [clearAdminSession]);

  const checkAdminTokenStatus = useCallback(async () => {
    if (!adminToken) return;
    if (!currentState.startsWith('admin')) return;

    try {
      const response = await fetch(`${API_URL}/api/admin-token-status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken }
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          handleAdminAuthFailure(data.message);
          return;
        }
        return;
      }

      if (data.warning) {
        setShowAdminWarning(true);
        setAdminTimeLeft(data.remainingSeconds);
    } else {
        setShowAdminWarning(false);
      }
    } catch (error) {
      console.error('Admin token status error:', error);
    }
  }, [adminToken, currentState, handleAdminAuthFailure]);

  const startAdminWarningCheck = useCallback(() => {
    if (adminWarningInterval.current) {
      clearInterval(adminWarningInterval.current);
    }
    adminWarningInterval.current = setInterval(checkAdminTokenStatus, 10000);
    checkAdminTokenStatus();
  }, [checkAdminTokenStatus]);

  const stopAdminWarningCheck = useCallback(() => {
    if (adminWarningInterval.current) {
      clearInterval(adminWarningInterval.current);
      adminWarningInterval.current = null;
    }
    setShowAdminWarning(false);
  }, []);

  const handleKeepAdminAlive = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin-keep-alive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: JSON.stringify({ token: adminToken })
      });
      if (!response.ok) {
        const data = await response.json();
        if (response.status === 401) {
          handleAdminAuthFailure(data.message);
        }
        return;
      }
      setShowAdminWarning(false);
    } catch (error) {
      console.error('Admin keep-alive error:', error);
    }
  };

  useEffect(() => {
    if (adminToken && currentState.startsWith('admin')) {
      startAdminWarningCheck();
      return () => stopAdminWarningCheck();
    }
    stopAdminWarningCheck();
  }, [adminToken, currentState, startAdminWarningCheck, stopAdminWarningCheck]);

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
          // Only show alert if user didn't leave voluntarily
          if (!isLeavingRoom.current) {
            console.log('❌ User not in room (kicked), redirecting...');
            // Check if kicked by admin or room deleted by admin
            if (data.kickedByAdmin && data.kickedByAdmin.includes(username)) {
              alert('⚠️ 관리자에 의해 추방되었습니다.');
              setUsername(''); // Clear username on admin kick
              setCurrentState('registerName');
            } else if (data.roomDeletedByAdmin) {
              alert('⚠️ 관리자에 의해 방이 삭제되었습니다.');
              setUsername(''); // Clear username when room deleted by admin
              setCurrentState('registerName');
            } else {
              alert('⚠️ 방장에 의해 추방되었습니다.');
              setCurrentState('makeOrJoinRoom'); // Keep username for master kick
            }
          } else {
            console.log('✅ User left voluntarily, no alert needed');
          }
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
          stopWarningCheck();
          isLeavingRoom.current = false; // Reset flag
          return;
        }
        
        // Check if room was deleted by admin (room doesn't exist in response)
        if (data.roomDeletedByAdmin) {
          console.log('❌ Room deleted by admin');
          alert('⚠️ 관리자에 의해 방이 삭제되었습니다.');
          setUsername('');
          setRoomId('');
          setUserId('');
          setUsers([]);
          setIsMaster(false);
          setRoomData(null);
          stopPolling();
          stopWarningCheck();
          setCurrentState('registerName');
          return;
        }
        
        // Check if user was kicked by admin (but still in room response - edge case)
        if (data.kickedByAdmin && data.kickedByAdmin.includes(username)) {
          console.log('❌ User kicked by admin');
          alert('⚠️ 관리자에 의해 추방되었습니다.');
          setUsername('');
          setRoomId('');
          setUserId('');
          setUsers([]);
          setIsMaster(false);
          setRoomData(null);
          stopPolling();
          stopWarningCheck();
          setCurrentState('registerName');
          return;
        }
        
        // Update users with voting status
        console.log('👥 Users update:', data.room.users.map(u => ({ name: u.displayName, voted: u.hasVoted })));
        console.log('🔄 Setting users state with voting status...');
        setUsers(data.room.users);
        setGameState(data.room.gameState || 'waiting'); // Track game state
        
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
  }, [roomId, currentState, userId, hasVoted, username]);

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
        // Check if room was deleted by admin
        if (data.roomDeletedByAdmin) {
          console.log('❌ Room deleted by admin');
          alert('⚠️ 관리자에 의해 방이 삭제되었습니다.');
          setUsername('');
          setRoomId('');
          setUserId('');
          setUsers([]);
          setIsMaster(false);
          setRoomData(null);
          stopPolling();
          stopWarningCheck();
          setCurrentState('registerName');
          return;
        }
        
        // Check if current user is still in the room
        const currentUserInRoom = data.room.users.find(user => user.id === userId);
        if (!currentUserInRoom) {
          // User has been kicked or removed
          // Only show alert if user didn't leave voluntarily
          if (!isLeavingRoom.current) {
            // Check if kicked by admin
            if (data.kickedByAdmin && data.kickedByAdmin.includes(username)) {
              alert('⚠️ 관리자에 의해 추방되었습니다.');
              setUsername(''); // Clear username on admin kick
              setCurrentState('registerName');
            } else {
              alert('⚠️ 방장에 의해 추방되었습니다.');
              setCurrentState('makeOrJoinRoom'); // Keep username for master kick
            }
          }
          setRoomId('');
          setUserId('');
          setUsers([]);
          setIsMaster(false);
          setRoomData(null);
          stopPolling();
          stopWarningCheck();
          isLeavingRoom.current = false; // Reset flag
          return;
        }
        
        // Check if user was kicked by admin (but still in room response - edge case)
        if (data.kickedByAdmin && data.kickedByAdmin.includes(username)) {
          console.log('❌ User kicked by admin');
          alert('⚠️ 관리자에 의해 추방되었습니다.');
          setUsername('');
          setRoomId('');
          setUserId('');
          setUsers([]);
          setIsMaster(false);
          setRoomData(null);
          stopPolling();
          stopWarningCheck();
          setCurrentState('registerName');
          return;
        }
        
        // Update users and master status
        setUsers(data.room.users);
        setIsMaster(data.room.masterId === userId);
        setGameState(data.room.gameState || 'waiting'); // Track game state
        
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
  }, [roomId, userId, startPolling, username]);

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

  // Send heartbeat when tab becomes visible (handles Chrome tab switching)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && (currentState === 'waitingroom' || currentState === 'linking' || currentState === 'linkresult')) {
        console.log('Tab became visible, sending heartbeat...');
        sendHeartbeat();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [currentState, sendHeartbeat]);

  // Start/stop warning check based on state
  useEffect(() => {
    if (currentState === 'waitingroom' || currentState === 'linking' || currentState === 'linkresult') {
      startWarningCheck();
    } else {
      stopWarningCheck();
    }
    
    return () => stopWarningCheck();
  }, [currentState, startWarningCheck]);

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

  useEffect(() => {
    if (currentState !== 'adminShutdown') return;
    let isMounted = true;

    const checkStatus = async () => {
      try {
        const response = await fetch(`${API_URL}/api/admin-shutdown-status`);
        const data = await response.json();
        if (isMounted && data.success) {
          setShutdownStatus(data.isShutdown);
        }
      } catch (error) {
        console.error('Error checking shutdown status:', error);
      }
    };

    checkStatus();
    return () => {
      isMounted = false;
    };
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    try {
      const response = await fetch(`${API_URL}/api/check-username`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: name }),
        signal: controller.signal
      });
      const data = await response.json();
      return data.duplicate;
    } catch (error) {
      console.error('Error checking username:', error);
      return false;
    } finally {
      clearTimeout(timeoutId);
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
            setGameState('waiting'); // Initialize game state
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
          setGameState('waiting'); // Initialize game state
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
    // Check if app is shutdown (except for admin)
    try {
      const shutdownResponse = await fetch(`${API_URL}/api/admin-shutdown-status`);
      const shutdownData = await shutdownResponse.json();
      if (shutdownData.success && shutdownData.isShutdown && username !== 'link-station-admin') {
        setError('앱이 종료되어 게임을 할 수 없습니다.');
        return;
      }
    } catch (error) {
      console.error('Error checking shutdown status:', error);
    }

    const validation = validateUsername(username);
    if (!validation.valid) {
      setError(validation.message);
      return;
    }

    // Check if admin username
    if (username.trim().toLowerCase() === 'link-station-admin') {
      setCurrentState('adminPassword');
      setError('');
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
    if (username.trim().toLowerCase() === 'link-station-admin') {
      setError('관리자 전용 이름입니다. 다른 이름을 사용해주세요.');
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
    // Set flag to prevent "kicked" alert when user leaves voluntarily
    isLeavingRoom.current = true;
    
    // Stop polling FIRST to prevent race condition with alert
    stopPolling();
    stopWarningCheck();
    
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
    
    // Go back to makeOrJoinRoom state (user keeps their username)
    setCurrentState('makeOrJoinRoom');
  };

  const handleReturnToWaitingRoom = async () => {
    // Return to waiting room after results - keep room alive
      setMatches([]);
      setUnmatched([]);
    setSelectedUser(null);
    setHasVoted(false);
    setGameState('waiting'); // Reset game state
    
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

  // Warning handlers
  const handleKeepUserAlive = async () => {
    try {
      await fetch(`${API_URL}/api/keep-alive-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      setShowUserWarning(false);
      console.log('✅ User session extended');
    } catch (error) {
      console.error('Error keeping user alive:', error);
    }
  };

  const handleKeepRoomAlive = async () => {
    try {
      await fetch(`${API_URL}/api/keep-alive-room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId })
      });
      setShowRoomWarning(false);
      console.log('✅ Room lifetime extended');
    } catch (error) {
      console.error('Error keeping room alive:', error);
    }
  };

  const handleImmediateLogout = () => {
    setShowUserWarning(false);
    handleLeaveRoom();
  };

  // Admin handlers
  const handleAdminLogin = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword })
      });
      const data = await response.json();
      
      if (data.success) {
        setCurrentState('adminDashboard');
        setError('');
        setAdminToken(data.token || '');
      } else {
        setAdminToken('');
        setError(data.message || '비밀번호가 올바르지 않습니다.');
      }
    } catch (error) {
      console.error('Admin login error:', error);
      setError('관리자 로그인 중 오류가 발생했습니다.');
    }
  };


  const handleAdminStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken }
      });
      const data = await response.json();
      
      if (data.success) {
        setAdminStatusData(data);
        setCurrentState('adminStatus');
        setError('');
      } else {
        if (response.status === 401) {
          handleAdminAuthFailure(data.message);
          return;
        }
        setError(data.message || '상태 조회에 실패했습니다.');
      }
    } catch (error) {
      console.error('Admin status error:', error);
      setError('상태 조회 중 오류가 발생했습니다.');
    }
  };

  const handleAdminSessions = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin-sessions`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken }
      });
      const data = await response.json();
      
      if (data.success) {
        setAdminSessions(data.sessions || []);
      } else {
        if (response.status === 401) {
          handleAdminAuthFailure(data.message);
          return;
        }
        setError(data.message || '관리자 목록 조회에 실패했습니다.');
      }
    } catch (error) {
      console.error('Admin sessions error:', error);
      setError('관리자 목록 조회 중 오류가 발생했습니다.');
    }
  };

  const handleAdminKickSession = async (targetToken) => {
    if (!window.confirm('이 관리자 세션을 종료하시겠습니까?')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/admin-kick-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: JSON.stringify({ token: targetToken })
      });
      const data = await response.json();

      if (data.success) {
        if (targetToken === adminToken) {
          handleAdminAuthFailure('관리자 세션이 종료되었습니다.');
          return;
        }
        await handleAdminSessions();
        setSuccess(data.message);
      } else {
        if (response.status === 401) {
          handleAdminAuthFailure(data.message);
          return;
        }
        setError(data.message || '관리자 세션 종료에 실패했습니다.');
      }
    } catch (error) {
      console.error('Admin kick session error:', error);
      setError('관리자 세션 종료 중 오류가 발생했습니다.');
    }
  };

  const handleAdminUsersList = async (filter) => {
    try {
      const response = await fetch(`${API_URL}/api/admin-users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: JSON.stringify({ filter })
      });
      const data = await response.json();
      
      if (data.success) {
        setAdminUsersList(data.users);
        setAdminUserFilter(filter);
        setError('');
      } else {
        if (response.status === 401) {
          handleAdminAuthFailure(data.message);
          return;
        }
        setError(data.message || '사용자 목록 조회에 실패했습니다.');
      }
    } catch (error) {
      console.error('Admin users list error:', error);
      setError('사용자 목록 조회 중 오류가 발생했습니다.');
    }
  };

  const handleAdminRoomsList = async (filter) => {
    try {
      const response = await fetch(`${API_URL}/api/admin-rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: JSON.stringify({ filter })
      });
      const data = await response.json();
      
      if (data.success) {
        setAdminRoomsList(data.rooms);
        setAdminRoomFilter(filter);
        setError('');
      } else {
        if (response.status === 401) {
          handleAdminAuthFailure(data.message);
          return;
        }
        setError(data.message || '방 목록 조회에 실패했습니다.');
      }
    } catch (error) {
      console.error('Admin rooms list error:', error);
      setError('방 목록 조회 중 오류가 발생했습니다.');
    }
  };

  const handleAdminKickUser = async (targetUsername) => {
    if (!window.confirm(`사용자 "${targetUsername}"를 추방하시겠습니까?`)) {
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/api/admin-kick-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: JSON.stringify({ username: targetUsername })
      });
      const data = await response.json();
      
      if (data.success) {
        setSuccess(data.message);
        // Refresh user list
        if (adminUserFilter) {
          await handleAdminUsersList(adminUserFilter);
        }
      } else {
        if (response.status === 401) {
          handleAdminAuthFailure(data.message);
          return;
        }
        setError(data.message || '사용자 추방에 실패했습니다.');
      }
    } catch (error) {
      console.error('Admin kick user error:', error);
      setError('사용자 추방 중 오류가 발생했습니다.');
    }
  };

  const handleAdminDeleteRoom = async (targetRoomId, roomName) => {
    if (!window.confirm(`방 "${roomName}"를 삭제하시겠습니까? 방의 모든 사용자가 나가게 됩니다.`)) {
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/api/admin-delete-room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: JSON.stringify({ roomId: targetRoomId })
      });
      const data = await response.json();
      
      if (data.success) {
        setSuccess(data.message);
        // Refresh room list
        if (adminRoomFilter) {
          await handleAdminRoomsList(adminRoomFilter);
        }
      } else {
        if (response.status === 401) {
          handleAdminAuthFailure(data.message);
          return;
        }
        setError(data.message || '방 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Admin delete room error:', error);
      setError('방 삭제 중 오류가 발생했습니다.');
    }
  };

  const handleAdminCleanup = async (cleanupType) => {
    const confirmMessage = cleanupType === 'users' 
      ? '모든 사용자를 정리하시겠습니까? (빈 방도 함께 정리됩니다)'
      : cleanupType === 'both'
      ? '모든 사용자와 방을 정리하시겠습니까?'
      : '빈 방을 정리하시겠습니까?';
    
    if (!window.confirm(confirmMessage)) {
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/api/admin-cleanup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: JSON.stringify({ cleanupType })
      });
      const data = await response.json();
      
      if (data.success) {
        setSuccess(data.message);
      } else {
        if (response.status === 401) {
          handleAdminAuthFailure(data.message);
          return;
        }
        setError(data.message || '정리에 실패했습니다.');
      }
    } catch (error) {
      console.error('Admin cleanup error:', error);
      setError('정리 중 오류가 발생했습니다.');
    }
  };

  const handleAdminShutdown = async (shutdown) => {
    const confirmMessage = shutdown 
      ? '앱을 종료하시겠습니까? 모든 사용자가 게임을 할 수 없게 됩니다.'
      : '앱을 복구하시겠습니까?';
    
    if (!window.confirm(confirmMessage)) {
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/api/admin-shutdown`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: JSON.stringify({ shutdown })
      });
      const data = await response.json();
      
      if (data.success) {
        setSuccess(data.message);
      } else {
        if (response.status === 401) {
          handleAdminAuthFailure(data.message);
          return;
        }
        setError(data.message || '작업에 실패했습니다.');
      }
    } catch (error) {
      console.error('Admin shutdown error:', error);
      setError('작업 중 오류가 발생했습니다.');
    }
  };

  const handleAdminChangePassword = async () => {
    if (adminPasswordStep === 1) {
      // Verify second password
      if (adminSecondPassword !== '19951025') {
        setError('2차 비밀번호가 올바르지 않습니다.');
        return;
      }
      setAdminPasswordStep(2);
      setError('');
      return;
    }
    
    // Step 2: Change password
    if (!adminNewPassword || adminNewPassword.trim() === '') {
      setError('새 비밀번호를 입력해주세요.');
      return;
    }
    
    if (adminNewPassword !== adminNewPasswordConfirm) {
      setError('새 비밀번호가 일치하지 않습니다.');
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/api/admin-change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: JSON.stringify({ 
          currentPassword: adminPassword, 
          secondPassword: adminSecondPassword,
          newPassword: adminNewPassword.trim()
        })
      });
      const data = await response.json();
      
      if (data.success) {
        setSuccess('비밀번호가 변경되었습니다. 다음 로그인부터 새 비밀번호를 사용하세요.');
        setAdminPassword(adminNewPassword.trim());
        setAdminSecondPassword('');
        setAdminNewPassword('');
        setAdminNewPasswordConfirm('');
        setAdminPasswordStep(1);
        setCurrentState('adminDashboard');
      } else {
        if (response.status === 401) {
          handleAdminAuthFailure(data.message);
          return;
        }
        setError(data.message || '비밀번호 변경에 실패했습니다.');
      }
    } catch (error) {
      console.error('Admin change password error:', error);
      setError('비밀번호 변경 중 오류가 발생했습니다.');
    }
  };

  const handleAdminExit = async () => {
    if (adminToken) {
      fetch(`${API_URL}/api/admin-logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: JSON.stringify({ token: adminToken })
      }).catch(error => console.error('Admin logout error:', error));
    }
    clearAdminSession();
    setError('');
    setSuccess('');
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
                {/* Show badges to help master identify who has returned */}
                {gameState === 'completed' && !user.hasReturnedToWaiting && (
                  <span className="viewing-results-badge" title="결과 화면을 보고 있습니다">결과 확인 중</span>
                )}
                {gameState === 'completed' && user.hasReturnedToWaiting && (
                  <span className="returned-badge" title="대기실로 돌아왔습니다">대기실</span>
                )}
                {/* Also show "대기실" badge when gameState is waiting but user just returned (helps with visibility) */}
                {gameState === 'waiting' && user.hasReturnedToWaiting && (
                  <span className="returned-badge" title="대기실로 돌아왔습니다">대기실</span>
                )}
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
            disabled={gameState !== 'waiting' || users.filter(user => user.role === 'attender').length < 2 || isLoading}
          >
            {isLoading ? '게임 시작 중...' : `게임 시작 (참가자 ${users.filter(user => user.role === 'attender').length}명)`}
          </button>
          {gameState !== 'waiting' && (
            <p className="waiting-message">모든 사용자가 대기실로 돌아올 때까지 기다려주세요.</p>
          )}
          {gameState === 'waiting' && users.filter(user => user.role === 'attender').length < 2 && (
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

  // Admin render functions
  const renderAdminPassword = () => (
    <div className="register-name-container">
      <div className="register-name-header">
        <h1>🔐 관리자 로그인</h1>
        <p>관리자 비밀번호를 입력하세요</p>
      </div>
      
      <div className="register-name-form">
        <div className="input-group">
          <label htmlFor="adminPassword">관리자 비밀번호</label>
          <input
            id="adminPassword"
            type="password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            placeholder="비밀번호를 입력하세요"
            onKeyPress={(e) => e.key === 'Enter' && handleAdminLogin()}
          />
        </div>
        
        <div className="button-group">
          <button 
            className="register-button"
            onClick={handleAdminLogin}
            disabled={!adminPassword || isLoading}
          >
            {isLoading ? '로그인 중...' : '로그인'}
          </button>
          <button 
            className="cancel-button"
            onClick={() => {
              setUsername('');
              setAdminPassword('');
              setCurrentState('registerName');
            }}
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );

  const renderAdminDashboard = () => (
    <div className="register-name-container" style={{ maxWidth: '600px' }}>
      <div className="register-name-header">
        <h1>🔐 관리자 대시보드</h1>
        <p>관리 기능을 선택하세요</p>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '30px' }}>
        <button 
          className="register-button"
          onClick={handleAdminStatus}
          style={{ padding: '15px', fontSize: '1.1rem' }}
        >
          1. 현재 상태
        </button>
        <button 
          className="register-button"
          onClick={() => setCurrentState('adminCleanup')}
          style={{ padding: '15px', fontSize: '1.1rem' }}
        >
          2. 정리
        </button>
        <button 
          className="register-button"
          onClick={() => setCurrentState('adminShutdown')}
          style={{ padding: '15px', fontSize: '1.1rem' }}
        >
          3. 종료/복구
        </button>
        <button 
          className="register-button"
          onClick={() => {
            setAdminPasswordStep(1);
            setCurrentState('adminChangePassword');
          }}
          style={{ padding: '15px', fontSize: '1.1rem' }}
        >
          4. 비밀번호 변경
        </button>
        <button 
          className="cancel-button"
          onClick={handleAdminExit}
          style={{ padding: '15px', fontSize: '1.1rem', marginTop: '20px' }}
        >
          나가기
        </button>
      </div>
    </div>
  );

  const renderAdminStatus = () => {
    if (!adminStatusData) {
      handleAdminStatus();
      return <div>로딩 중...</div>;
    }
    if (adminSessions === null) {
      handleAdminSessions();
    }

    if (adminStatusFilter === 'users' && adminUserFilter) {
      // Show users list
  return (
        <div className="register-name-container" style={{ maxWidth: '800px' }}>
          <div className="register-name-header">
            <h2>사용자 목록</h2>
            <p>
              {adminUserFilter === 'all' && '전체 사용자'}
              {adminUserFilter === 'notInRoom' && '방 없음'}
              {adminUserFilter === 'waiting' && '대기 중'}
              {adminUserFilter === 'playing' && '게임 중'}
              {adminUserFilter === 'result' && '결과 확인 중'}
            </p>
          </div>
          
          <div style={{ marginTop: '20px', textAlign: 'left' }}>
            {adminUsersList.map((user, idx) => (
              <div key={idx} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '10px',
                borderBottom: '1px solid #eee',
                gap: '10px'
              }}>
                <div style={{ flex: 1 }}>
                  <strong>{user.username}</strong>
                  {adminUserFilter === 'all' && (
                    <span style={{ marginLeft: '10px', color: '#666', fontSize: '0.9rem' }}>
                      ({user.state === 'notInRoom' ? '방 없음' : 
                        user.state === 'waiting' ? '대기' :
                        user.state === 'linking' ? '게임 중' : '결과 확인'})
                    </span>
                  )}
                  {user.roomName && (
                    <span style={{ marginLeft: '10px', color: '#666', fontSize: '0.9rem' }}>
                      - {user.roomName}
                    </span>
                  )}
                  {user.isMaster && (
                    <span style={{ marginLeft: '10px', color: '#f59e0b', fontSize: '0.9rem' }}>
                      (방장)
                    </span>
                  )}
                </div>
                <button 
                  onClick={() => handleAdminKickUser(user.username)}
                  style={{ 
                    background: '#ef4444', 
                    color: 'white', 
                    border: 'none',
                    padding: '5px 10px',
                    borderRadius: '5px',
                    cursor: 'pointer'
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
            {adminUsersList.length === 0 && <p>사용자가 없습니다.</p>}
          </div>
          
          <div className="button-group" style={{ marginTop: '20px' }}>
            <button className="cancel-button" onClick={() => {
              setAdminUserFilter(null);
              setAdminUsersList([]);
            }}>
              뒤로
            </button>
          </div>
        </div>
      );
    }

    if (adminStatusFilter === 'rooms' && adminRoomFilter) {
      // Show rooms list
      return (
        <div className="register-name-container" style={{ maxWidth: '800px' }}>
          <div className="register-name-header">
            <h2>방 목록</h2>
            <p>
              {adminRoomFilter === 'all' && '전체 방'}
              {adminRoomFilter === 'waiting' && '대기 중인 방'}
              {adminRoomFilter === 'linking' && '게임 중인 방'}
              {adminRoomFilter === 'result' && '결과 확인 중인 방'}
            </p>
          </div>
          
          <div style={{ marginTop: '20px', textAlign: 'left' }}>
            {adminRoomsList.map((room, idx) => (
              <div key={idx} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '10px',
                borderBottom: '1px solid #eee',
                gap: '10px'
              }}>
                <div style={{ flex: 1 }}>
                  {room.hasPassword && (
                    <span 
                      onClick={() => alert(`방 비밀번호: ${room.password}`)}
                      style={{ 
                        marginRight: '10px', 
                        cursor: 'pointer',
                        fontSize: '1.2rem'
                      }}
                      title={`비밀번호: ${room.password}`}
                    >
                      🔒
                    </span>
                  )}
                  <strong>{room.roomName}</strong>
                  {adminRoomFilter === 'all' && (
                    <span style={{ marginLeft: '10px', color: '#666', fontSize: '0.9rem' }}>
                      ({room.gameState === 'waiting' ? '대기' :
                        room.gameState === 'linking' ? '게임 중' : '결과 확인'})
                    </span>
                  )}
                  <span style={{ marginLeft: '10px', color: '#666', fontSize: '0.9rem' }}>
                    ({room.userCount}/{room.memberLimit}명)
                  </span>
                </div>
                <button 
                  onClick={() => handleAdminDeleteRoom(room.id, room.roomName)}
                  style={{ 
                    background: '#ef4444', 
                    color: 'white', 
                    border: 'none',
                    padding: '5px 10px',
                    borderRadius: '5px',
                    cursor: 'pointer'
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
            {adminRoomsList.length === 0 && <p>방이 없습니다.</p>}
          </div>
          
          <div className="button-group" style={{ marginTop: '20px' }}>
            <button className="cancel-button" onClick={() => {
              setAdminRoomFilter(null);
              setAdminRoomsList([]);
            }}>
              뒤로
            </button>
          </div>
        </div>
      );
    }

    // Show status overview
    return (
      <div className="register-name-container" style={{ maxWidth: '800px' }}>
        <div className="register-name-header">
          <h2>현재 상태</h2>
        </div>
        
        <div style={{ marginTop: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div 
            onClick={() => setAdminStatusFilter('rooms')}
            style={{ 
              padding: '20px', 
              background: '#f3f4f6', 
              borderRadius: '10px',
              cursor: 'pointer',
              border: '2px solid #e5e7eb'
            }}
          >
            <h3>방: {adminStatusData.roomCounts.total}개</h3>
            <p style={{ marginTop: '10px', color: '#666' }}>
              대기: {adminStatusData.roomCounts.waiting} | 
              게임 중: {adminStatusData.roomCounts.playing} | 
              결과: {adminStatusData.roomCounts.result}
            </p>
          </div>
          
          <div 
            onClick={() => setAdminStatusFilter('users')}
            style={{ 
              padding: '20px', 
              background: '#f3f4f6', 
              borderRadius: '10px',
              cursor: 'pointer',
              border: '2px solid #e5e7eb'
            }}
          >
            <h3>사용자: {adminStatusData.userCounts.total}명</h3>
            <p style={{ marginTop: '10px', color: '#666' }}>
              방 없음: {adminStatusData.userCounts.notInRoom} | 
              대기: {adminStatusData.userCounts.waiting} | 
              게임 중: {adminStatusData.userCounts.playing} | 
              결과: {adminStatusData.userCounts.result}
            </p>
          </div>
          
          <div style={{ 
            padding: '20px', 
            background: '#f3f4f6', 
            borderRadius: '10px',
            border: '2px solid #e5e7eb'
          }}>
            <h3>관리자: {adminSessions ? adminSessions.length : 0}명</h3>
            {adminSessions === null ? (
              <p style={{ marginTop: '10px', color: '#666' }}>불러오는 중...</p>
            ) : (
              <div style={{ marginTop: '10px' }}>
                {adminSessions.length === 0 && (
                  <p style={{ color: '#666' }}>활성 관리자 세션이 없습니다.</p>
                )}
                {adminSessions.map((session) => (
                  <div key={session.token} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: '1px solid #e5e7eb',
                    gap: '10px'
                  }}>
                    <div style={{ flex: 1, color: '#374151' }}>
                      세션 {session.token.slice(0, 6)}… (남은 {session.remainingSeconds}초)
                    </div>
                    <button 
                      onClick={() => handleAdminKickSession(session.token)}
                      style={{ 
                        background: '#ef4444', 
                        color: 'white', 
                        border: 'none',
                        padding: '5px 10px',
                        borderRadius: '5px',
                        cursor: 'pointer'
                      }}
                    >
                      종료
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {adminStatusFilter === 'rooms' && (
          <div style={{ marginTop: '30px' }}>
            <h3>방 유형 선택</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>
              <button className="register-button" onClick={() => handleAdminRoomsList('all')}>
                전체 방 ({adminStatusData.roomCounts.total})
              </button>
              <button className="register-button" onClick={() => handleAdminRoomsList('waiting')}>
                대기 중 ({adminStatusData.roomCounts.waiting})
              </button>
              <button className="register-button" onClick={() => handleAdminRoomsList('linking')}>
                게임 중 ({adminStatusData.roomCounts.playing})
              </button>
              <button className="register-button" onClick={() => handleAdminRoomsList('completed')}>
                결과 확인 ({adminStatusData.roomCounts.result})
              </button>
            </div>
          </div>
        )}
        
        {adminStatusFilter === 'users' && (
          <div style={{ marginTop: '30px' }}>
            <h3>사용자 유형 선택</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>
              <button className="register-button" onClick={() => handleAdminUsersList('all')}>
                전체 사용자 ({adminStatusData.userCounts.total})
              </button>
              <button className="register-button" onClick={() => handleAdminUsersList('notInRoom')}>
                방 없음 ({adminStatusData.userCounts.notInRoom})
              </button>
              <button className="register-button" onClick={() => handleAdminUsersList('waiting')}>
                대기 중 ({adminStatusData.userCounts.waiting})
              </button>
              <button className="register-button" onClick={() => handleAdminUsersList('linking')}>
                게임 중 ({adminStatusData.userCounts.playing})
              </button>
              <button className="register-button" onClick={() => handleAdminUsersList('completed')}>
                결과 확인 ({adminStatusData.userCounts.result})
              </button>
            </div>
          </div>
        )}
        
        <div className="button-group" style={{ marginTop: '30px' }}>
          <button className="cancel-button" onClick={() => {
            setAdminStatusFilter(null);
            setAdminStatusData(null);
            setCurrentState('adminDashboard');
          }}>
            뒤로
          </button>
        </div>
      </div>
    );
  };

  const renderAdminCleanup = () => (
    <div className="register-name-container" style={{ maxWidth: '600px' }}>
      <div className="register-name-header">
        <h2>정리</h2>
        <p>정리할 항목을 선택하세요</p>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '30px' }}>
        <button 
          className="register-button"
          onClick={() => handleAdminCleanup('users')}
          style={{ padding: '15px', fontSize: '1.1rem' }}
        >
          사용자 정리 (빈 방도 함께 정리)
        </button>
        <button 
          className="register-button"
          onClick={() => handleAdminCleanup('rooms')}
          style={{ padding: '15px', fontSize: '1.1rem' }}
        >
          빈 방만 정리
        </button>
        <button 
          className="cancel-button"
          onClick={() => setCurrentState('adminDashboard')}
          style={{ padding: '15px', fontSize: '1.1rem', marginTop: '20px' }}
        >
          뒤로
        </button>
      </div>
    </div>
  );

  const renderAdminShutdown = () => {
    return (
      <div className="register-name-container" style={{ maxWidth: '600px' }}>
        <div className="register-name-header">
          <h2>종료/복구</h2>
          <p>앱 상태: {shutdownStatus === null ? '확인 중...' : shutdownStatus ? '종료됨' : '활성'}</p>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '30px' }}>
          <button 
            className="register-button"
            onClick={() => handleAdminShutdown(true)}
            disabled={shutdownStatus === true}
            style={{ padding: '15px', fontSize: '1.1rem', opacity: shutdownStatus === true ? 0.5 : 1 }}
          >
            종료하기
          </button>
          <button 
            className="register-button"
            onClick={() => handleAdminShutdown(false)}
            disabled={shutdownStatus === false}
            style={{ padding: '15px', fontSize: '1.1rem', opacity: shutdownStatus === false ? 0.5 : 1 }}
          >
            복구하기
          </button>
          <button 
            className="cancel-button"
            onClick={() => setCurrentState('adminDashboard')}
            style={{ padding: '15px', fontSize: '1.1rem', marginTop: '20px' }}
          >
            뒤로
          </button>
        </div>
      </div>
    );
  };

  const renderAdminChangePassword = () => (
    <div className="register-name-container" style={{ maxWidth: '600px' }}>
      <div className="register-name-header">
        <h2>비밀번호 변경</h2>
        <p>
          {adminPasswordStep === 1 
            ? '2차 비밀번호를 입력하세요' 
            : '새 비밀번호를 입력하세요 (두 번 입력)'}
        </p>
      </div>
      
      <div className="register-name-form">
        {adminPasswordStep === 1 ? (
          <div className="input-group">
            <label htmlFor="adminSecondPassword">2차 비밀번호</label>
            <input
              id="adminSecondPassword"
              type="password"
              value={adminSecondPassword}
              onChange={(e) => setAdminSecondPassword(e.target.value)}
              placeholder="2차 비밀번호를 입력하세요"
              onKeyPress={(e) => e.key === 'Enter' && handleAdminChangePassword()}
            />
          </div>
        ) : (
          <>
            <div className="input-group">
              <label htmlFor="adminNewPassword">새 비밀번호</label>
              <input
                id="adminNewPassword"
                type="password"
                value={adminNewPassword}
                onChange={(e) => setAdminNewPassword(e.target.value)}
                placeholder="새 비밀번호를 입력하세요"
              />
            </div>
            <div className="input-group">
              <label htmlFor="adminNewPasswordConfirm">새 비밀번호 확인</label>
              <input
                id="adminNewPasswordConfirm"
                type="password"
                value={adminNewPasswordConfirm}
                onChange={(e) => setAdminNewPasswordConfirm(e.target.value)}
                placeholder="새 비밀번호를 다시 입력하세요"
                onKeyPress={(e) => e.key === 'Enter' && handleAdminChangePassword()}
              />
            </div>
          </>
        )}
        
        <div className="button-group">
          <button 
            className="register-button"
            onClick={handleAdminChangePassword}
            disabled={isLoading || (adminPasswordStep === 1 ? !adminSecondPassword : !adminNewPassword || !adminNewPasswordConfirm)}
          >
            {isLoading ? '처리 중...' : adminPasswordStep === 1 ? '다음' : '변경하기'}
          </button>
          <button 
            className="cancel-button"
            onClick={() => {
              setAdminPasswordStep(1);
              setAdminSecondPassword('');
              setAdminNewPassword('');
              setAdminNewPasswordConfirm('');
              setCurrentState('adminDashboard');
            }}
          >
            취소
          </button>
        </div>
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
      {currentState === 'adminPassword' && renderAdminPassword()}
      {currentState === 'adminDashboard' && renderAdminDashboard()}
      {currentState === 'adminStatus' && renderAdminStatus()}
      {currentState === 'adminCleanup' && renderAdminCleanup()}
      {currentState === 'adminShutdown' && renderAdminShutdown()}
      {currentState === 'adminChangePassword' && renderAdminChangePassword()}
      
      {/* User Inactivity Warning Modal */}
      {showUserWarning && (
        <div className="warning-modal-overlay">
          <div className="warning-modal">
            <h2>⚠️ 비활동 경고</h2>
            <p>활동이 감지되지 않아 <strong>{userTimeLeft}초</strong> 후 로그아웃됩니다</p>
            <div className="warning-buttons">
              <button className="keep-alive-button" onClick={handleKeepUserAlive}>
                로그인 유지
              </button>
              <button className="immediate-exit-button" onClick={handleImmediateLogout}>
                로그아웃
              </button>
      </div>
          </div>
        </div>
      )}

      {/* Admin Session Warning Modal */}
      {showAdminWarning && (
        <div className="warning-modal-overlay">
          <div className="warning-modal">
            <h2>⚠️ 관리자 세션 경고</h2>
            <p>비활동으로 <strong>{adminTimeLeft}초</strong> 후 관리자 로그아웃됩니다</p>
            <div className="warning-buttons">
              <button className="keep-alive-button" onClick={handleKeepAdminAlive}>
                로그인 유지
              </button>
              <button className="immediate-exit-button" onClick={handleAdminExit}>
                로그아웃
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Room Inactivity Warning Modal */}
      {showRoomWarning && (
        <div className="warning-modal-overlay">
          <div className="warning-modal">
            <h2>⚠️ 방 비활동 경고</h2>
            {isMaster ? (
              <p>활동이 감지되지 않아 <strong>{roomTimeLeft}초</strong> 후 방이 사라집니다</p>
            ) : (
              <p>활동이 감지되지 않아 <strong>{roomTimeLeft}초</strong> 후 방이 사라집니다<br/>방을 유지하려면 방장에게 알려주세요</p>
            )}
            {isMaster ? (
              <div className="warning-buttons">
                <button className="keep-alive-button" onClick={handleKeepRoomAlive}>
                  방 유지
                </button>
                <button className="immediate-exit-button" onClick={handleLeaveRoom}>
                  방 나가기
                </button>
              </div>
            ) : (
              <div className="warning-buttons">
                <button className="immediate-exit-button" onClick={handleLeaveRoom} style={{ flex: '1' }}>
                  방 나가기
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
  );
}

export default App;