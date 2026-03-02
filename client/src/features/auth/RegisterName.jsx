import React from 'react';
import { API_URL } from '../../shared/api/client.js';
import { loadSession, clearSession } from '../../shared/session/index.js';
import { checkUsernameDuplication } from '../../shared/api/checkUsername.js';
import { validateUsername } from '../../shared/utils/validateUsername.js';

export function RegisterName({
  username,
  setUsername,
  setCurrentState,
  setError,
  setSuccess,
  setRoomId,
  setUserId,
  setUsers,
  setIsMaster,
  setRoomData,
  setUserRole,
  setGameState,
  setMatches,
  setUnmatched
}) {
  const handleRegisterName = async () => {
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

    if (username.trim().toLowerCase() === 'link-station-admin') {
      setCurrentState('adminPassword');
      setError('');
      return;
    }

    const isDuplicate = await checkUsernameDuplication(username);
    if (isDuplicate) {
      const session = loadSession();
      if (session && session.username === username.trim()) {
        console.log('🔄 Username is duplicate but we have a session, attempting recovery...');
        try {
          const response = await fetch(`${API_URL}/api/room/${session.roomId}`);
          const data = await response.json();

          if (data.success && data.room) {
            const userInRoom = data.room.users.find(u => u.id === session.userId);
            if (userInRoom) {
              console.log('✅ Session recovered via handleRegisterName');
              setUsername(session.username);
              setRoomId(session.roomId);
              setUserId(session.userId);
              setUsers(data.room.users);
              setIsMaster(data.room.masterId === session.userId);
              setRoomData(session.roomData);
              setUserRole(userInRoom.role || 'attender');
              setGameState(data.room.gameState || 'waiting');

              if (data.room.gameState === 'linking') {
                setCurrentState('linking');
              } else if (data.room.gameState === 'completed' && data.matchResult) {
                setMatches(data.matchResult.matches || []);
                setUnmatched(data.matchResult.unmatched || []);
                setCurrentState('linkresult');
              } else {
                setCurrentState('waitingroom');
              }
              return;
            }
          }
        } catch (error) {
          console.error('Session recovery in handleRegisterName failed:', error);
        }
        clearSession();
      }

      setError('이미 사용 중인 사용자 이름입니다. 다른 이름을 사용하거나 잠시 후 다시 시도해주세요.');
      return;
    }

    setCurrentState('makeOrJoinRoom');
    setError('');
  };

  return (
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
}
