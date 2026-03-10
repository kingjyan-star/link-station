import React, { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import './App.css';
import { API_URL } from './shared/api/client.js';
import { saveSession, loadSession, clearSession } from './shared/session/index.js';
import { checkUsernameDuplication } from './shared/api/checkUsername.js';
import { validateUsername } from './shared/utils/validateUsername.js';
import { RegisterName } from './features/auth';
import { TelepathyPlay, TelepathyResult } from './features/telepathy/TelepathyComponents.jsx';
import {
  LiarWordInput,
  LiarPlay,
  LiarVote,
  LiarArgument,
  LiarIdentify,
  LiarResult
} from './features/liar/LiarComponents.jsx';
import { playStateChange, playPhaseAdvance, playResult } from './shared/sound/playSound.js';

function App() {
  // VERSION: Session 18 - 2026-01-25 (check console to verify deployment)
  console.log('🔗 Link Station v3.0.3 loaded');
  
  // State management
  const [currentState, setCurrentState] = useState('registerName'); // registerName, makeOrJoinRoom, makeroom, joinroom, checkpassword, joinroomwithqr, waitingroom, telepathy, telepathyResult, adminPassword, adminDashboard, adminStatus, adminCleanup, adminShutdown, adminChangePassword
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
  
  // Password visibility toggles
  const [showRoomPassword, setShowRoomPassword] = useState(false);
  const [showEnteredPassword, setShowEnteredPassword] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [showAdminSecondPassword, setShowAdminSecondPassword] = useState(false);
  const [showAdminNewPassword, setShowAdminNewPassword] = useState(false);
  const [showAdminNewPasswordConfirm, setShowAdminNewPasswordConfirm] = useState(false);
  
  // Game selection (telepathy | liar)
  const [gameType, setGameType] = useState('telepathy');
  const [showGameSelect, setShowGameSelect] = useState(false);
  const [kickTargetUser, setKickTargetUser] = useState(null); // For kick confirmation modal
  // Liar game settings (when gameType is liar)
  const [liarSubject, setLiarSubject] = useState('물건');
  const [liarMethod, setLiarMethod] = useState('커스텀');
  const [liarCustomSubject, setLiarCustomSubject] = useState('');
  const [liarMyWord, setLiarMyWord] = useState(null); // Secret word for non-liar (from API)
  
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
  
  // Refs to hold the latest polling callbacks (fixes stale closure issue)
  const pollWaitingRoomStatusRef = useRef(null);
  const pollRoomStatusRef = useRef(null);
  const prevLiarGameStateRef = useRef(null); // For sound on liar state change
  const liarCustomSubjectInputFocusedRef = useRef(false); // Prevent poll from overwriting while typing
  const unloadRef = useRef({ username: '', roomId: '', userId: '' });

  // Keep unloadRef in sync so tab-close beacon sends current session
  useEffect(() => {
    unloadRef.current = { username: username || '', roomId: roomId || '', userId: userId || '' };
  }, [username, roomId, userId]);

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

  // Session recovery on page load (handles F5 refresh)
  useEffect(() => {
    const recoverSession = async () => {
      console.log('🔄 Session recovery starting...');
      
      // Skip if URL has room parameter (QR code join)
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('room')) {
        console.log('📍 QR code URL detected, skipping session recovery');
        return;
      }

      const session = loadSession();
      console.log('📦 Loaded session:', session);
      
      if (!session || !session.username || !session.roomId || !session.userId) {
        console.log('❌ No valid session found');
        return;
      }

      console.log('🔄 Attempting to recover session for:', session.username, 'in room:', session.roomId);

      try {
        // Check if the room still exists and user is still in it
        const response = await fetch(`${API_URL}/api/room/${session.roomId}?username=${encodeURIComponent(session.username || '')}`);
        const data = await response.json();
        console.log('📡 Room API response:', data.success, 'users:', data.room?.users?.length);

        if (data.success && data.room) {
          // Check if user is still in the room
          const userInRoom = data.room.users.find(u => u.id === session.userId);
          console.log('👤 User in room:', userInRoom ? 'YES' : 'NO', 'userId:', session.userId);
          
          if (userInRoom) {
            console.log('✅ Session recovered successfully!');
            // Restore state
            setUsername(session.username);
            setRoomId(session.roomId);
            setUserId(session.userId);
            setUsers(data.room.users);
            setIsMaster(data.room.masterId === session.userId);
            setRoomData(session.roomData);
            setUserRole(userInRoom.role || 'attender');
            setGameState(data.room.gameState || 'waiting');
            setGameType(data.room.gameType || 'telepathy');
            setLiarSubject(data.room.liarSubject || '물건');
            setLiarMethod(data.room.liarMethod || '커스텀');
            setLiarCustomSubject(data.room.liarCustomSubject || '');

            // Navigate to appropriate state based on game state
            const hasReturned = userInRoom?.hasReturnedToWaiting || false;
            if (data.room.gameState === 'linking') {
              console.log('🎮 Restoring to telepathy state');
              setCurrentState('telepathy');
            } else if (data.room.gameState === 'completed' && data.matchResult && !hasReturned) {
              console.log('🎉 Restoring to telepathyResult state (user has not returned)');
              setMatches(data.matchResult.matches || []);
              setUnmatched(data.matchResult.unmatched || []);
              setCurrentState('telepathyResult');
            } else {
              // waiting, or completed but user already returned, or all returned (matchResult cleared)
              console.log('⏳ Restoring to waitingroom state');
              setCurrentState('waitingroom');
            }
            return;
          } else {
            console.log('❌ User not found in room users list');
          }
        } else {
          console.log('❌ Room not found or API error:', data.message);
        }

        // Room not found or user not in room - clear session
        console.log('🗑️ Clearing invalid session');
        clearSession();
      } catch (error) {
        console.error('❌ Session recovery error:', error);
        clearSession();
      }
    };

    recoverSession();
  }, []); // Only run on mount

  // Free username when tab closes (server 10s grace: refresh cancels via ping, real close executes)
  useEffect(() => {
    const freeUsername = () => {
      const { username: u, roomId: r, userId: i } = unloadRef.current;
      if (!u) return;
      const payload = JSON.stringify({ username: u, roomId: r || undefined, userId: i || undefined });
      const url = `${API_URL}/api/remove-user`;
      try {
        // fetch with keepalive outlives page unload (often more reliable than sendBeacon)
        fetch(url, {
          method: 'POST',
          body: payload,
          headers: { 'Content-Type': 'application/json' },
          keepalive: true
        }).catch(() => {});
      } catch (e) {
        if (navigator.sendBeacon) {
          const blob = new Blob([payload], { type: 'application/json' });
          navigator.sendBeacon(url, blob);
        }
      }
    };
    const handleBeforeUnload = () => freeUsername();
    const handlePageHide = (e) => {
      if (!e.persisted) freeUsername();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
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

  // ========== UNIFIED KICK HANDLER ==========
  // Handles all kick scenarios with proper alerts and state transitions
  // Priority: ADMIN > MASTER > ROOM_DELETED > INACTIVITY
  const handleKickByReason = useCallback((kickReason, roomDeleteReason = null) => {
    let alertMessage = '';
    let clearUsername = false;
    
    switch (kickReason) {
      case 'ADMIN':
        alertMessage = '⚠️ 관리자에 의해 추방되었습니다.';
        clearUsername = true; // Admin kick = clear username
        break;
      case 'MASTER':
        alertMessage = '⚠️ 방장에 의해 추방되었습니다.';
        clearUsername = false; // Master kick = keep username, go to makeOrJoinRoom
        break;
      case 'ROOM_DELETED':
        // Show different message based on why the room was deleted
        if (roomDeleteReason === 'ADMIN') {
          alertMessage = '⚠️ 관리자에 의해 방이 삭제되었습니다.';
        } else if (roomDeleteReason === 'INACTIVITY') {
          alertMessage = '⚠️ 장시간 활동이 없어 방이 삭제되었습니다.';
        } else {
          alertMessage = '⚠️ 방이 삭제되었습니다.';
        }
        clearUsername = false; // Room deleted = keep username
        break;
      case 'INACTIVITY':
        alertMessage = '⚠️ 장시간 활동이 감지되지 않아 로그아웃되었습니다.';
        clearUsername = true; // Inactivity = clear username
        break;
      default:
        alertMessage = '⚠️ 연결이 끊어졌습니다.';
        clearUsername = true;
    }
    
    alert(alertMessage);
    
    // Clear session when kicked
    clearSession();
    
    // Clear room-related state
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
    
    if (clearUsername) {
      setUsername('');
      setCurrentState('registerName');
    } else {
      setCurrentState('makeOrJoinRoom');
    }
  }, []);

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
      
      // ========== UNIFIED MARKER CHECK ==========
      // Check kick marker first (has priority info)
      if (data.kickReason) {
        handleKickByReason(data.kickReason, data.roomDeleteReason);
        return;
      }
      
      // Legacy fallback: Handle disconnection
      if (data.userDisconnected) {
        handleKickByReason('INACTIVITY');
        return;
      }
      
      // Legacy fallback: Handle room deletion
      if (data.roomDeleted) {
        handleKickByReason('ROOM_DELETED', data.roomDeleteReason);
        return;
      }
    } catch (error) {
      console.error('Warning check error:', error);
    }
  }, [username, userId, roomId, handleKickByReason]);

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
      const response = await fetch(`${API_URL}/api/room/${roomId}?username=${encodeURIComponent(username || '')}&t=${Date.now()}`, {
        cache: 'no-store'
      });
      const data = await response.json();
      
      // Handle room not found (deleted or user kicked)
      if (!data.success) {
        console.log('❌ Room not found or access denied', data);
        if (!isLeavingRoom.current) {
          // Use unified marker system - roomDeleteReason tells us why
          handleKickByReason('ROOM_DELETED', data.roomDeleteReason);
        } else {
          // User left voluntarily, just clean up state
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
        }
        isLeavingRoom.current = false;
        return;
      }
      
      if (data.success && data.room) {
        console.log('📊 Polling response:', {
          gameState: data.room.gameState,
          userCount: data.room.users.length,
          hasMatchResult: !!data.matchResult,
          currentUserVoted: data.room.users.find(u => u.id === userId)?.hasVoted,
          allUsersVotingStatus: data.room.users.map(u => ({ name: u.displayName, voted: u.hasVoted, id: u.id }))
        });
        
        // ========== UNIFIED MARKER CHECK ==========
        // Check if current user has a kick marker
        if (data.userKickMarkers && data.userKickMarkers[username]) {
          const kickMarker = data.userKickMarkers[username];
          console.log('❌ User has kick marker:', kickMarker);
          if (!isLeavingRoom.current) {
            handleKickByReason(kickMarker.reason, kickMarker.roomDeleteReason);
          }
          isLeavingRoom.current = false;
          return;
        }
        
        // Check if current user is still in the room
        const currentUserInRoom = data.room.users.find(user => user.id === userId);
        if (!currentUserInRoom) {
          // User has been kicked or removed
          if (!isLeavingRoom.current) {
            console.log('❌ User not in room (kicked), redirecting...');
            // Fallback: assume master kick if no marker
            handleKickByReason('MASTER');
          } else {
            console.log('✅ User left voluntarily, no alert needed');
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
          }
          isLeavingRoom.current = false;
          return;
        }
        
        // Update users with voting status
        console.log('👥 Users update:', data.room.users.map(u => ({ name: u.displayName, voted: u.hasVoted })));
        console.log('🔄 Setting users state with voting status...');
        setUsers(data.room.users);
        setGameState(data.room.gameState || 'waiting');
        setGameType(data.room.gameType || 'telepathy');
        setLiarSubject(data.room.liarSubject || '물건');
        setLiarMethod(data.room.liarMethod || '커스텀');
        if (!liarCustomSubjectInputFocusedRef.current) {
          setLiarCustomSubject(data.room.liarCustomSubject || '');
        }
        setRoomData(data.room);
        if (data.liarMyWord !== undefined) setLiarMyWord(data.liarMyWord);
        
        // Check if current user has returned to waiting room
        const currentUserData = data.room.users.find(u => u.id === userId);
        const hasCurrentUserReturned = currentUserData?.hasReturnedToWaiting || false;
        
        // Liar game flow
        if (data.room.gameType === 'liar') {
          const newLiarState = data.room.gameState;
          if (prevLiarGameStateRef.current !== newLiarState) {
            if (newLiarState === 'liarResult') playResult();
            else if (['liarVote', 'liarArgument', 'liarIdentify'].includes(newLiarState)) playPhaseAdvance();
            else playStateChange();
            prevLiarGameStateRef.current = newLiarState;
          }
          if (newLiarState === 'waiting') {
            console.log('👤 Liar: back to waitingroom');
            prevLiarGameStateRef.current = null;
            setCurrentState('waitingroom');
          }
          return;
        }
        
        // Telepathy flow
        if (data.matchResult && !hasCurrentUserReturned) {
          console.log('✅ Match results found, showing results to user');
          setMatches(data.matchResult.matches || []);
          setUnmatched(data.matchResult.unmatched || []);
          if (currentState !== 'telepathyResult') {
            playResult();
            setCurrentState('telepathyResult');
          }
        } else if (hasCurrentUserReturned || (!data.matchResult && data.room.gameState === 'waiting')) {
          console.log('👤 User has returned (or all returned), switching to waitingroom');
          setCurrentState('waitingroom');
        }
      } else {
        console.log('❌ Polling failed:', data);
      }
    } catch (error) {
      console.error('❌ Error polling room status:', error);
    }
  }, [roomId, currentState, userId, hasVoted, username, handleKickByReason]);

  // Update ref synchronously during render (not in useEffect) to avoid stale closure
  pollRoomStatusRef.current = pollRoomStatus;

  const startPolling = useCallback(() => {
    console.log('🚀 startPolling called, roomId:', roomId);
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
    }
    // Do an immediate poll, then start interval
    // Use ref to always call the latest version of the callback
    if (pollRoomStatusRef.current) {
      pollRoomStatusRef.current();
    }
    pollingInterval.current = setInterval(() => {
      if (pollRoomStatusRef.current) {
        pollRoomStatusRef.current();
      }
    }, 2000);
  }, [roomId]); // Include roomId to restart polling when room changes

  const pollWaitingRoomStatus = useCallback(async () => {
    if (!roomId) {
      console.log('⏸️ pollWaitingRoomStatus: no roomId, skipping');
      return;
    }
    
    console.log('🔄 pollWaitingRoomStatus running for room:', roomId);
    
    try {
      const response = await fetch(`${API_URL}/api/room/${roomId}?username=${encodeURIComponent(username || '')}&t=${Date.now()}`, {
        cache: 'no-store'
      });
      const data = await response.json();
      
      console.log('📡 Poll response:', data.success ? `${data.room?.users?.length} users` : 'failed');
      
      // Handle room not found (deleted or user kicked)
      if (!data.success) {
        console.log('❌ Room not found or access denied', data);
        if (!isLeavingRoom.current) {
          // Use unified marker system
          handleKickByReason('ROOM_DELETED', data.roomDeleteReason);
        } else {
          setRoomId('');
          setUserId('');
          setUsers([]);
          setIsMaster(false);
          setRoomData(null);
          stopPolling();
          stopWarningCheck();
        }
        isLeavingRoom.current = false;
        return;
      }
      
      if (data.success && data.room) {
        // ========== UNIFIED MARKER CHECK ==========
        // Check if current user has a kick marker
        if (data.userKickMarkers && data.userKickMarkers[username]) {
          const kickMarker = data.userKickMarkers[username];
          console.log('❌ User has kick marker:', kickMarker);
          if (!isLeavingRoom.current) {
            handleKickByReason(kickMarker.reason, kickMarker.roomDeleteReason);
          }
          isLeavingRoom.current = false;
          return;
        }
        
        // Check if current user is still in the room
        const currentUserInRoom = data.room.users.find(user => user.id === userId);
        if (!currentUserInRoom) {
          if (!isLeavingRoom.current) {
            // Fallback: assume master kick if no marker
            handleKickByReason('MASTER');
          } else {
            setRoomId('');
            setUserId('');
            setUsers([]);
            setIsMaster(false);
            setRoomData(null);
            stopPolling();
            stopWarningCheck();
          }
          isLeavingRoom.current = false;
          return;
        }
        
        // Update users and master status
        setUsers(data.room.users);
        setIsMaster(data.room.masterId === userId);
        setGameState(data.room.gameState || 'waiting');
        setGameType(data.room.gameType || 'telepathy');
        setLiarSubject(data.room.liarSubject || '물건');
        setLiarMethod(data.room.liarMethod || '커스텀');
        setRoomData(data.room);
        if (!liarCustomSubjectInputFocusedRef.current) {
          setLiarCustomSubject(data.room.liarCustomSubject || '');
        }

        // Check if game started (don't switch back to liar if user already returned)
        const currentUserData = data.room.users?.find((u) => u.id === userId);
        const hasReturned = currentUserData?.hasReturnedToWaiting || false;
        if (data.room.gameState === 'linking') {
          console.log('🎮 Game state changed to telepathy, switching to game polling...');
          playStateChange();
          setCurrentState('telepathy');
          startPolling();
        } else if (['liarWordInput', 'liarPlay', 'liarVote', 'liarArgument', 'liarIdentify', 'liarResult'].includes(data.room.gameState)) {
          if (data.room.gameState === 'liarResult' && hasReturned) {
            // User returned to waiting; stay in waitingroom, don't bounce back
          } else {
            console.log('🎮 Liar game started, switching to liar polling...');
            playStateChange();
            prevLiarGameStateRef.current = data.room.gameState;
            setCurrentState('liar');
            startPolling();
          }
        }
      }
    } catch (error) {
      console.error('Error polling waiting room status:', error);
    }
  }, [roomId, userId, startPolling, username, handleKickByReason]);

  // Update ref synchronously during render (not in useEffect) to avoid stale closure
  pollWaitingRoomStatusRef.current = pollWaitingRoomStatus;

  const startWaitingRoomPolling = useCallback(() => {
    console.log('🚀 startWaitingRoomPolling called, roomId:', roomId);
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
    }
    // Do an immediate poll, then start interval
    // Use ref to always call the latest version of the callback
    if (pollWaitingRoomStatusRef.current) {
      pollWaitingRoomStatusRef.current();
    }
    pollingInterval.current = setInterval(() => {
      if (pollWaitingRoomStatusRef.current) {
        pollWaitingRoomStatusRef.current();
      }
    }, 500); // 500ms - faster sync when new users join (fixes 4+ user visibility)
  }, [roomId]); // Include roomId to restart polling when room changes

  const stopPolling = () => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }
  };

  // Start/stop heartbeat based on state
  useEffect(() => {
    if (currentState === 'waitingroom' || currentState === 'telepathy' || currentState === 'telepathyResult' || currentState === 'liar') {
      startHeartbeat();
    } else {
      stopHeartbeat();
    }
    
    return () => stopHeartbeat();
  }, [currentState, username, userId, startHeartbeat]);

  // Send heartbeat + immediate poll when tab becomes visible (syncs user list after tab switch)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && (currentState === 'waitingroom' || currentState === 'telepathy' || currentState === 'telepathyResult' || currentState === 'liar')) {
        console.log('Tab became visible, heartbeat + poll...');
        sendHeartbeat();
        if (currentState === 'waitingroom' && pollWaitingRoomStatusRef.current) {
          pollWaitingRoomStatusRef.current();
        } else if ((currentState === 'telepathy' || currentState === 'telepathyResult' || currentState === 'liar') && pollRoomStatusRef.current) {
          pollRoomStatusRef.current();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [currentState, sendHeartbeat]);

  // Start/stop warning check based on state
  useEffect(() => {
    if (currentState === 'waitingroom' || currentState === 'telepathy' || currentState === 'telepathyResult' || currentState === 'liar') {
      startWarningCheck();
    } else {
      stopWarningCheck();
    }
    
    return () => stopWarningCheck();
  }, [currentState, startWarningCheck]);

  // SIMPLE FIX: Start polling for any state that needs real-time updates
  // Also restart polling when roomId changes (fixes issue where new members aren't visible)
  useEffect(() => {
    if (currentState === 'waitingroom') {
      console.log('🔄 Starting waiting room polling for room:', roomId);
      startWaitingRoomPolling();
    } else if (currentState === 'telepathy' || currentState === 'telepathyResult' || currentState === 'liar') {
      console.log('🔄 Starting game polling for room:', roomId);
      startPolling(); // Start polling for linking, result, and liar states
    } else {
      stopPolling(); // Stop polling for other states
    }
    
    return () => stopPolling();
  }, [currentState, roomId, startWaitingRoomPolling, startPolling]);

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

  // Liar Play: Silent keep-alive every 1 min while Main Timer is running (CRITICAL: prevents zombie rooms)
  useEffect(() => {
    if (currentState !== 'liar' || !roomId || !username) return;
    const rd = roomData || {};
    const gs = rd.gameState;
    const ls = rd.liarState || gs;
    const mainTimerEndsAt = rd.liarMainTimerEndsAt;
    const inPlay = gs === 'liarPlay' || ls === 'play';
    if (!inPlay || !mainTimerEndsAt) return;

    const ping = () => {
      if (Date.now() >= mainTimerEndsAt) return; // Timer ended: stop pinging (fail-safe)
      fetch(`${API_URL}/api/keep-alive-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      }).catch(() => {});
      fetch(`${API_URL}/api/keep-alive-room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId })
      }).catch(() => {});
    };

    const id = setInterval(() => {
      if (Date.now() >= mainTimerEndsAt) {
        clearInterval(id);
        return;
      }
      ping();
    }, 60 * 1000);

    return () => clearInterval(id);
  }, [currentState, roomId, username, roomData?.gameState, roomData?.liarState, roomData?.liarMainTimerEndsAt]);

  // Validation functions
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
        // Save session for refresh recovery
        saveSession({
          username,
          roomId: data.roomId,
          userId: data.userId,
          roomData: data.roomData
        });
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
          // Save session for refresh recovery
          saveSession({
            username,
            roomId: data.roomId,
            userId: data.userId,
            roomData: data.roomData
          });
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
        // Save session for refresh recovery
        saveSession({
          username,
          roomId: data.roomId,
          userId: data.userId,
          roomData: data.roomData
        });
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
        // Save session for refresh recovery
        saveSession({
          username,
          roomId: roomId,
          userId: data.userId,
          roomData: data.roomData
        });
      } else {
        setError(data.message || '방 참여에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error joining room with QR:', error);
      setError('방 참여 중 오류가 발생했습니다.');
    }
  };

  // Event handlers
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
      // Call API to remove user from active users (immediate - not tab-close beacon)
      fetch(`${API_URL}/api/remove-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, roomId, userId, immediate: true })
      }).catch(error => console.error('Error removing user:', error));
    }
    // Clear session
    clearSession();
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(`${API_URL}/api/start-game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, userId }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const data = await response.json();
      
      if (data.success) {
        setCurrentState(gameType === 'liar' ? 'liar' : 'telepathy');
        console.log('🎮 Game started, starting polling...');
        startPolling();
      } else {
        setError(data.message || '게임 시작에 실패했습니다.');
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        setError('요청 시간이 초과되었습니다. 다시 시도해주세요.');
      } else {
        setError('게임 시작 중 오류가 발생했습니다.');
      }
      console.error('Error starting game:', error);
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

  const handleSetGameType = async (newGameType) => {
    if (!isMaster || !roomId || !userId) return;
    setGameType(newGameType); // Optimistic update
    try {
      await fetch(`${API_URL}/api/set-game-type`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, userId, gameType: newGameType })
      });
    } catch (err) {
      console.error('Error setting game type:', err);
    }
  };

  const handleSetLiarSettings = async (subject, method, customSubject) => {
    if (!isMaster || !roomId || !userId || gameType !== 'liar') return;
    setLiarSubject(subject);
    setLiarMethod(method);
    setLiarCustomSubject(customSubject || '');
    try {
      await fetch(`${API_URL}/api/set-liar-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          userId,
          liarSubject: subject,
          liarMethod: subject === '커스텀주제' ? '커스텀' : method,
          liarCustomSubject: subject === '커스텀주제' ? (customSubject || '').trim().slice(0, 16) : null
        })
      });
    } catch (err) {
      console.error('Error setting liar settings:', err);
    }
  };

  const handleKickUserClick = (user) => {
    if (!isMaster) return;
    setKickTargetUser(user);
  };

  const handleKickUserConfirm = async () => {
    if (!isMaster || !kickTargetUser) return;
    const targetUserId = kickTargetUser.id;
    setKickTargetUser(null);
    
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

  const handleKickUserCancel = () => {
    setKickTargetUser(null);
  };

  // Liar game API handlers
  const handleLiarSubmitWord = async (word) => {
    if (!roomId || !userId) return;
    try {
      const res = await fetch(`${API_URL}/api/liar-submit-word`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, userId, word: (word || '').trim().slice(0, 16) })
      });
      const data = await res.json();
      if (data.success) return true;
      setError(data.message || '제출 실패');
    } catch (e) {
      setError('네트워크 오류');
    }
    return false;
  };

  const handleLiarExtendTime = async (action) => {
    if (!roomId || !userId) return;
    try {
      const res = await fetch(`${API_URL}/api/liar-extend-time`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, userId, action })
      });
      const data = await res.json();
      if (data.success && pollRoomStatusRef.current) {
        pollRoomStatusRef.current(); // Immediate poll to reflect timer change
      } else if (!data.success) {
        setError(data.message || '시간 조절 실패');
      }
    } catch (e) {
      setError('네트워크 오류');
    }
  };

  const handleLiarDifficultWord = async () => {
    if (!roomId || !userId) return;
    try {
      const res = await fetch(`${API_URL}/api/liar-difficult-word`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, userId })
      });
      const data = await res.json();
      if (!data.success) setError(data.message || '실패');
    } catch (e) {
      setError('네트워크 오류');
    }
  };

  const handleLiarStartVote = async () => {
    if (!roomId || !userId) return;
    try {
      const res = await fetch(`${API_URL}/api/liar-start-vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, userId })
      });
      const data = await res.json();
      if (!data.success) setError(data.message || '투표 시작 실패');
    } catch (e) {
      setError('네트워크 오류');
    }
  };

  const handleLiarVote = async (targetUserId) => {
    if (!roomId || !userId) return;
    try {
      const res = await fetch(`${API_URL}/api/liar-vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, userId, targetUserId })
      });
      const data = await res.json();
      if (!data.success) setError(data.message || '투표 실패');
    } catch (e) {
      setError('네트워크 오류');
    }
  };

  const handleLiarForgiveExecute = async (choice) => {
    if (!roomId || !userId) return;
    try {
      const res = await fetch(`${API_URL}/api/liar-forgive-execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, userId, choice })
      });
      const data = await res.json();
      if (!data.success) setError(data.message || '선택 실패');
    } catch (e) {
      setError('네트워크 오류');
    }
  };

  const handleLiarGuess = async (guessedWord) => {
    if (!roomId || !userId) return false;
    try {
      const res = await fetch(`${API_URL}/api/liar-guess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, userId, guessedWord: (guessedWord || '').trim() })
      });
      const data = await res.json();
      if (data.success && pollRoomStatusRef.current) pollRoomStatusRef.current();
      if (!data.success) setError(data.message || '제출 실패');
      return !!data.success;
    } catch (e) {
      setError('네트워크 오류');
      return false;
    }
  };

  const handleLiarIdentifyVote = async (choice) => {
    if (!roomId || !userId) return;
    try {
      const res = await fetch(`${API_URL}/api/liar-identify-vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, userId, choice })
      });
      const data = await res.json();
      if (data.success && pollRoomStatusRef.current) pollRoomStatusRef.current();
      if (!data.success) setError(data.message || '투표 실패');
    } catch (e) {
      setError('네트워크 오류');
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
    
    // Clear session (user is intentionally leaving)
    clearSession();
    
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
    setLiarMyWord(null);
    
    // Go back to makeOrJoinRoom state (user keeps their username)
    setCurrentState('makeOrJoinRoom');
  };

  const handleReturnToWaitingRoom = async () => {
    // IMPORTANT: Stop polling FIRST to prevent race condition
    stopPolling();
    
    // Reset local state
    setMatches([]);
    setUnmatched([]);
    setSelectedUser(null);
    setHasVoted(false);
    setGameState('waiting');
    setLiarMyWord(null);
    
    // Change state to waitingroom BEFORE API call
    setCurrentState('waitingroom');
    
    // Notify server that user has returned to waiting room
    try {
      if (roomId && userId) {
        await fetch(`${API_URL}/api/return-to-waiting`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId, userId })
        });
        // Optimistic: mark current user as returned so badges render correctly before next poll
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, hasReturnedToWaiting: true } : u));
      }
    } catch (error) {
      console.error('Error returning to waiting room:', error);
    }
    
    // Start waiting room polling (this will now use pollWaitingRoomStatus, not pollRoomStatus)
    startWaitingRoomPolling();
  };

  const handleRoleChange = async (newRole) => {
    if (newRole === userRole) return;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(`${API_URL}/api/change-role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, userId, role: newRole }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const data = await response.json();
      
      if (data.success) {
        setUserRole(newRole);
        setUsers(data.users);
      } else {
        setError(data.message || '역할 변경에 실패했습니다.');
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        setError('요청 시간이 초과되었습니다. 다시 시도해주세요.');
      } else {
        setError('역할 변경 중 오류가 발생했습니다.');
      }
      console.error('Error changing role:', error);
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

  // Helper to refresh admin status data
  const refreshAdminStatusData = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken }
      });
      const data = await response.json();
      if (data.success) {
        setAdminStatusData(data);
      }
    } catch (error) {
      console.error('Error refreshing admin status:', error);
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
        // Refresh user list AND status data
        if (adminUserFilter) {
          await handleAdminUsersList(adminUserFilter);
        }
        await refreshAdminStatusData();
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
        // Refresh room list AND status data
        if (adminRoomFilter) {
          await handleAdminRoomsList(adminRoomFilter);
        }
        await refreshAdminStatusData();
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
        // Refresh status data after cleanup
        await refreshAdminStatusData();
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
          <div className="password-input-wrapper">
            <input
              id="roomPassword"
              type={showRoomPassword ? "text" : "password"}
              value={roomPassword}
              onChange={(e) => setRoomPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요 (선택사항)"
              maxLength={16}
            />
            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => setShowRoomPassword(!showRoomPassword)}
              tabIndex={-1}
            >
              {showRoomPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              )}
            </button>
          </div>
        </div>
          
          <div className="input-group">
          <label htmlFor="memberLimit">최대 인원 (2-99명)</label>
          <div className="member-limit-control">
            <button
              type="button"
              className="member-limit-btn member-limit-up"
              onClick={() => setMemberLimit((m) => Math.min(99, (m || 2) + 1))}
              aria-label="인원 증가"
            >
              ▲
            </button>
            <input
              id="memberLimit"
              type="number"
              value={memberLimit}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!Number.isNaN(v)) setMemberLimit(Math.min(99, Math.max(1, v)));
                else if (e.target.value === '') setMemberLimit(1);
              }}
              onBlur={() => {
                if (memberLimit < 2) setMemberLimit(2);
                else if (memberLimit > 99) setMemberLimit(99);
              }}
              min={1}
              max={99}
              inputMode="numeric"
            />
            <button
              type="button"
              className="member-limit-btn member-limit-down"
              onClick={() => setMemberLimit((m) => Math.max(2, (m || 8) - 1))}
              aria-label="인원 감소"
            >
              ▼
            </button>
          </div>
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
          <div className="password-input-wrapper">
            <input
              id="enteredPassword"
              type={showEnteredPassword ? "text" : "password"}
              value={enteredPassword}
              onChange={(e) => setEnteredPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              maxLength={16}
            />
            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => setShowEnteredPassword(!showEnteredPassword)}
              tabIndex={-1}
            >
              {showEnteredPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              )}
            </button>
          </div>
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
        <p className="current-game-badge">현재 게임: {gameType === 'telepathy' ? '텔레파시 게임' : '라이어 게임'}</p>
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
            <div
              key={user.id}
              className={`user-card ${user.id === userId ? 'user-card-you' : ''} ${(gameState === 'completed' || gameState === 'liarResult') && !user.hasReturnedToWaiting ? 'user-card-still-in-result' : ''}`}
            >
              <div className="user-info">
                <span className="user-nickname">{user.displayName || user.nickname}</span>
                {user.id === userId && <span className="you-badge">나</span>}
                {user.isMaster && <span className="master-badge">방장</span>}
                {/* Show badges to help master identify who has returned */}
                {(gameState === 'completed' || gameState === 'liarResult') && !user.hasReturnedToWaiting && (
                  <span className="viewing-results-badge" title="결과 화면을 보고 있습니다">결과 확인 중</span>
                )}
                {(gameState === 'completed' || gameState === 'liarResult') && user.hasReturnedToWaiting && (
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
                  onClick={() => handleKickUserClick(user)}
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
            <div
              key={user.id}
              className={`user-card observer-card ${user.id === userId ? 'user-card-you' : ''}`}
            >
              <div className="user-info">
                <span className="user-nickname">{user.displayName || user.nickname}</span>
                {user.id === userId && <span className="you-badge">나</span>}
                {user.isMaster && <span className="master-badge">방장</span>}
        </div>
              {isMaster && user.id !== userId && (
                <button
                  className="kick-button"
                  onClick={() => handleKickUserClick(user)}
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
          <div className="game-select-row">
            <button 
              className="game-select-button"
              onClick={() => setShowGameSelect(true)}
              title="게임 선택"
            >
              게임 선택: {gameType === 'telepathy' ? '텔레파시 게임' : '라이어 게임'}
            </button>
          </div>
          {showGameSelect && (
            <div className="game-select-modal-overlay" onClick={() => setShowGameSelect(false)}>
              <div className="game-select-modal" onClick={e => e.stopPropagation()}>
                <h3>게임 선택</h3>
                <button 
                  className={`game-option ${gameType === 'telepathy' ? 'active' : ''}`}
                  onClick={() => { setShowGameSelect(false); handleSetGameType('telepathy'); }}
                >
                  텔레파시 게임
                </button>
                <button 
                  className={`game-option ${gameType === 'liar' ? 'active' : ''}`}
                  onClick={() => { setShowGameSelect(false); handleSetGameType('liar'); }}
                >
                  라이어 게임
                </button>
                <button className="game-select-cancel" onClick={() => setShowGameSelect(false)}>취소</button>
              </div>
            </div>
          )}
          {gameType === 'liar' && (
            <div className="liar-settings">
              <h4>라이어 게임 설정</h4>
              <div className="liar-setting-row">
                <label>주제</label>
                <select
                  value={liarSubject}
                  onChange={(e) => {
                    const newSubj = e.target.value;
                    handleSetLiarSettings(newSubj, newSubj === '커스텀주제' ? '커스텀' : liarMethod, newSubj === '커스텀주제' ? liarCustomSubject : null);
                  }}
                >
                  <option value="물건">물건</option>
                  <option value="동물">동물</option>
                  <option value="스포츠">스포츠</option>
                  <option value="요리">요리</option>
                  <option value="장소">장소</option>
                  <option value="직업">직업</option>
                  <option value="국가">국가</option>
                  <option value="인물">인물</option>
                  <option value="영화">영화</option>
                  <option value="드라마">드라마</option>
                  <option value="과일">과일</option>
                  <option value="채소">채소</option>
                  <option value="커스텀주제">커스텀주제</option>
                </select>
              </div>
              {liarSubject === '커스텀주제' ? (
                <div className="liar-setting-row">
                  <label>커스텀 주제 (최대 16자)</label>
                  <input
                    type="text"
                    value={liarCustomSubject}
                    onChange={(e) => setLiarCustomSubject(e.target.value.slice(0, 16))}
                    onFocus={() => { liarCustomSubjectInputFocusedRef.current = true; }}
                    onBlur={(e) => {
                      liarCustomSubjectInputFocusedRef.current = false;
                      handleSetLiarSettings('커스텀주제', '커스텀', e.target.value.trim().slice(0, 16));
                    }}
                    placeholder="주제를 입력하세요"
                    maxLength={16}
                  />
                  <p className="liar-setting-note">방식은 커스텀으로 고정됩니다</p>
                </div>
              ) : (
                <div className="liar-setting-row">
                  <label>방식</label>
                  <select
                    value={liarMethod}
                    onChange={(e) => handleSetLiarSettings(liarSubject, e.target.value, null)}
                  >
                    <option value="랜덤">랜덤</option>
                    <option value="커스텀">커스텀</option>
                  </select>
                </div>
              )}
              {!isMaster && (
                <p className="liar-settings-display">주제: {liarSubject === '커스텀주제' ? (liarCustomSubject || '(입력 대기)') : liarSubject} | 방식: {liarSubject === '커스텀주제' ? '커스텀' : liarMethod}</p>
              )}
            </div>
          )}
          <button 
            className="start-game-button"
            onClick={handleStartGame}
            disabled={
              gameState !== 'waiting' || isLoading ||
              (gameType === 'telepathy' && users.filter(u => u.role === 'attender').length < 2) ||
              (gameType === 'liar' && users.filter(u => u.role === 'attender').length < 3)
            }
          >
            {isLoading ? '게임 시작 중...' : `게임 시작 (참가자 ${users.filter(u => u.role === 'attender').length}명)`}
          </button>
          {gameState !== 'waiting' && (
            <p className="waiting-message">모든 사용자가 대기실로 돌아올 때까지 기다려주세요.</p>
          )}
          {gameState === 'waiting' && gameType === 'telepathy' && users.filter(u => u.role === 'attender').length < 2 && (
            <p className="waiting-message">참가자는 최소 2명 이상 필요합니다.</p>
          )}
          {gameState === 'waiting' && gameType === 'liar' && users.filter(u => u.role === 'attender').length < 3 && (
            <p className="waiting-message">라이어 게임은 참가자 3명 이상 필요합니다.</p>
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

  const renderTelepathy = () => (
    <TelepathyPlay
      users={users}
      userId={userId}
      hasVoted={hasVoted}
      selectedUser={selectedUser}
      userRole={userRole}
      onSelectUser={handleSelectUser}
      isLoading={isLoading}
    />
  );

  const renderTelepathyResult = () => (
    <TelepathyResult
      matches={matches}
      unmatched={unmatched}
      onReturnToWaiting={handleReturnToWaitingRoom}
      onLeave={handleLeaveRoom}
    />
  );

  const renderLiar = () => {
    const rd = roomData || {};
    const gs = rd.gameState || gameState || 'liarWordInput';
    const ls = rd.liarState || rd.gameState;
    const attenders = users.filter(u => (u.role || 'attender') === 'attender');
    const amILiar = rd.liarLiarUserId === userId;
    const subjectDisplay = rd.liarSubject === '커스텀주제' ? (rd.liarCustomSubject || '(입력 대기)') : (rd.liarSubject || '물건');
    const submittedCount = (gs === 'liarWordInput' || rd.liarState === 'wordInput')
      ? (rd.liarSubmittedCount ?? 0)
      : (rd.liarUserWords ? Object.keys(rd.liarUserWords).length : 0);
    const submittedUserIds = rd.liarSubmittedUserIds || [];
    const notSubmittedNames = attenders
      .filter((a) => !submittedUserIds.includes(a.id))
      .map((a) => a.displayName || a.nickname);
    const votersOfCondemned = rd.liarCondemnedUserId && rd.liarVotes
      ? Object.entries(rd.liarVotes).filter(([, tid]) => tid === rd.liarCondemnedUserId).map(([uid]) => uid)
      : [];
    const iVotedCondemned = votersOfCondemned.includes(userId);
    const canGuess = amILiar && rd.liarCondemnedUserId === rd.liarLiarUserId;
    const condemnedIsLiar = rd.liarCondemnedUserId === rd.liarLiarUserId;

    return (
      <div className="liar-container">
        <div className="liar-header">
          <h2>🎭 라이어 게임</h2>
          <p className="liar-subject">주제: {subjectDisplay}</p>
        </div>

        {gs === 'liarWordInput' && (
          <LiarWordInput
            attenders={attenders}
            submittedCount={submittedCount}
            notSubmittedNames={notSubmittedNames}
            userRole={userRole}
            onSubmit={handleLiarSubmitWord}
            setError={setError}
            isLoading={isLoading}
            setIsLoading={setIsLoading}
          />
        )}

        {(gs === 'liarPlay' || ls === 'play') && (
          <LiarPlay
            attenders={attenders}
            amILiar={amILiar}
            liarMyWord={liarMyWord}
            mainTimerEndsAt={rd.liarMainTimerEndsAt}
            playStartedAt={rd.liarPlayStartedAt}
            extendedBy={rd.liarMainTimerExtendedBy || []}
            lastTimeChange={rd.liarLastTimeChange}
            onExtendTime={handleLiarExtendTime}
            onDifficultWord={handleLiarDifficultWord}
            onStartVote={handleLiarStartVote}
            isMaster={isMaster}
            userId={userId}
            setError={setError}
          />
        )}

        {(gs === 'liarVote' || ls === 'vote') && (
          <LiarVote
            attenders={attenders}
            votes={rd.liarVotes || {}}
            tieTargets={rd.liarVoteTieTargets}
            onVote={handleLiarVote}
            userId={userId}
            setError={setError}
          />
        )}

        {(gs === 'liarArgument' || ls === 'argument') && (
          <LiarArgument
            attenders={attenders}
            condemnedUserId={rd.liarCondemnedUserId}
            choices={rd.liarArgumentChoices || {}}
            iVotedCondemned={iVotedCondemned}
            argumentEndsAt={rd.liarArgumentEndsAt}
            onForgiveExecute={handleLiarForgiveExecute}
            userId={userId}
            voterNames={votersOfCondemned.map(uid => attenders.find(a => a.id === uid)?.displayName || attenders.find(a => a.id === uid)?.nickname || '?')}
          />
        )}

        {(gs === 'liarIdentify' || ls === 'identify') && (
          <LiarIdentify
            attenders={attenders}
            amILiar={amILiar}
            condemnedUserId={rd.liarCondemnedUserId}
            condemnedIsLiar={condemnedIsLiar}
            canGuess={canGuess}
            guessedWord={rd.liarGuessedWord}
            identifyVotes={rd.liarIdentifyVotes || {}}
            guessEndsAt={rd.liarGuessEndsAt}
            identifyEndsAt={rd.liarIdentifyEndsAt}
            onGuess={handleLiarGuess}
            onIdentifyVote={handleLiarIdentifyVote}
            userId={userId}
            setError={setError}
          />
        )}

        {(gs === 'liarResult' || ls === 'result') && (
          <LiarResult
            scenario={rd.liarResultScenario}
            data={rd.liarResultData || {}}
            liarMethod={rd.liarMethod || liarMethod || '커스텀'}
            attenders={attenders}
            votes={rd.liarVotes || {}}
            onReturnToWaiting={handleReturnToWaitingRoom}
            onLeave={handleLeaveRoom}
          />
        )}
      </div>
    );
  };

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
          <div className="password-input-wrapper">
            <input
              id="adminPassword"
              type={showAdminPassword ? "text" : "password"}
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              onKeyPress={(e) => e.key === 'Enter' && handleAdminLogin()}
            />
            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => setShowAdminPassword(!showAdminPassword)}
              tabIndex={-1}
            >
              {showAdminPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              )}
            </button>
          </div>
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
              setShowAdminPassword(false);
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
            <div className="password-input-wrapper">
              <input
                id="adminSecondPassword"
                type={showAdminSecondPassword ? "text" : "password"}
                value={adminSecondPassword}
                onChange={(e) => setAdminSecondPassword(e.target.value)}
                placeholder="2차 비밀번호를 입력하세요"
                onKeyPress={(e) => e.key === 'Enter' && handleAdminChangePassword()}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowAdminSecondPassword(!showAdminSecondPassword)}
                tabIndex={-1}
              >
                {showAdminSecondPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="input-group">
              <label htmlFor="adminNewPassword">새 비밀번호</label>
              <div className="password-input-wrapper">
                <input
                  id="adminNewPassword"
                  type={showAdminNewPassword ? "text" : "password"}
                  value={adminNewPassword}
                  onChange={(e) => setAdminNewPassword(e.target.value)}
                  placeholder="새 비밀번호를 입력하세요"
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowAdminNewPassword(!showAdminNewPassword)}
                  tabIndex={-1}
                >
                  {showAdminNewPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <div className="input-group">
              <label htmlFor="adminNewPasswordConfirm">새 비밀번호 확인</label>
              <div className="password-input-wrapper">
                <input
                  id="adminNewPasswordConfirm"
                  type={showAdminNewPasswordConfirm ? "text" : "password"}
                  value={adminNewPasswordConfirm}
                  onChange={(e) => setAdminNewPasswordConfirm(e.target.value)}
                  placeholder="새 비밀번호를 다시 입력하세요"
                  onKeyPress={(e) => e.key === 'Enter' && handleAdminChangePassword()}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowAdminNewPasswordConfirm(!showAdminNewPasswordConfirm)}
                  tabIndex={-1}
                >
                  {showAdminNewPasswordConfirm ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  )}
                </button>
              </div>
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
      
      {currentState === 'registerName' && (
        <RegisterName
          username={username}
          setUsername={setUsername}
          setCurrentState={setCurrentState}
          setError={setError}
          setSuccess={setSuccess}
          setRoomId={setRoomId}
          setUserId={setUserId}
          setUsers={setUsers}
          setIsMaster={setIsMaster}
          setRoomData={setRoomData}
          setUserRole={setUserRole}
          setGameState={setGameState}
          setGameType={setGameType}
          setMatches={setMatches}
          setUnmatched={setUnmatched}
          setLiarSubject={setLiarSubject}
          setLiarMethod={setLiarMethod}
          setLiarCustomSubject={setLiarCustomSubject}
          setLiarMyWord={setLiarMyWord}
        />
      )}
      {currentState === 'makeOrJoinRoom' && renderMakeOrJoinRoom()}
      {currentState === 'makeroom' && renderMakeRoom()}
      {currentState === 'joinroom' && renderJoinRoom()}
      {currentState === 'checkpassword' && renderCheckPassword()}
      {currentState === 'joinroomwithqr' && renderJoinRoomWithQR()}
      {currentState === 'waitingroom' && renderWaitingRoom()}
      {currentState === 'telepathy' && renderTelepathy()}
      {currentState === 'telepathyResult' && renderTelepathyResult()}
      {currentState === 'liar' && renderLiar()}
      {currentState === 'adminPassword' && renderAdminPassword()}
      {currentState === 'adminDashboard' && renderAdminDashboard()}
      {currentState === 'adminStatus' && renderAdminStatus()}
      {currentState === 'adminCleanup' && renderAdminCleanup()}
      {currentState === 'adminShutdown' && renderAdminShutdown()}
      {currentState === 'adminChangePassword' && renderAdminChangePassword()}
      
      {/* Kick Confirmation Modal */}
      {kickTargetUser && (
        <div className="warning-modal-overlay">
          <div className="warning-modal">
            <h2>강퇴 확인</h2>
            <p>{(kickTargetUser.displayName || kickTargetUser.nickname)}을(를) 진짜 강퇴하겠습니까?</p>
            <div className="warning-buttons">
              <button className="keep-alive-button" onClick={handleKickUserConfirm}>예</button>
              <button className="immediate-exit-button" onClick={handleKickUserCancel}>아니오</button>
            </div>
          </div>
        </div>
      )}

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