import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

export function WaitingRoom({
  roomData,
  roomId,
  users,
  userId,
  isMaster,
  gameState,
  gameType,
  userRole,
  showQR,
  setShowQR,
  showGameSelect,
  setShowGameSelect,
  liarSubject,
  liarMethod,
  liarCustomSubject,
  setLiarCustomSubject,
  liarCustomSubjectInputFocusedRef,
  isLoading,
  attenderCount,
  onRoleChange,
  onKickUserClick,
  onSetGameType,
  onSetLiarSettings,
  onStartGame,
  onLeaveRoom
}) {
  return (
    <div className="waitingroom-container">
      <div className="waitingroom-header">
        <h2>🔗 링크 스테이션</h2>
        <p>방: {roomData?.roomName} | 참여자: {users.length}/{roomData?.memberLimit ?? '?'}명</p>
        <p className="current-game-badge">현재 게임: {gameType === 'telepathy' ? '텔레파시 게임' : '라이어 게임'}</p>
        {isMaster && <span className="master-badge">방장</span>}
      </div>

      <div className="qr-section">
        <button className="qr-button" onClick={() => setShowQR(!showQR)}>
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

      <div className="role-selection">
        <div
          className={`role-box attender-box ${userRole === 'attender' ? 'active' : ''}`}
          onClick={() => onRoleChange('attender')}
        >
          <h3>참가자</h3>
        </div>
        <div
          className={`role-box observer-box ${userRole === 'observer' ? 'active' : ''}`}
          onClick={() => onRoleChange('observer')}
        >
          <h3>관전자</h3>
        </div>
      </div>

      <div className="attenders-list">
        <h3>참가자 목록</h3>
        <div className="users-grid">
          {users.filter((u) => u.role === 'attender').map((user) => (
            <div
              key={user.id}
              className={`user-card ${user.id === userId ? 'user-card-you' : ''} ${(gameState === 'completed' || gameState === 'liarResult') && !user.hasReturnedToWaiting ? 'user-card-still-in-result' : ''}`}
            >
              <div className="user-info">
                <span className="user-nickname">{user.displayName || user.nickname}</span>
                {user.isMaster && <span className="master-badge">방장</span>}
                {(gameState === 'completed' || gameState === 'liarResult') && !user.hasReturnedToWaiting && (
                  <span className="viewing-results-badge" title="결과 화면을 보고 있습니다">결과 확인 중</span>
                )}
              </div>
              {isMaster && user.id !== userId && (
                <button className="kick-button" onClick={() => onKickUserClick(user)} title="사용자 추방">
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="observers-list">
        <h3>관전자 목록</h3>
        <div className="users-grid">
          {users.filter((u) => u.role === 'observer').map((user) => (
            <div
              key={user.id}
              className={`user-card observer-card ${user.id === userId ? 'user-card-you' : ''}`}
            >
              <div className="user-info">
                <span className="user-nickname">{user.displayName || user.nickname}</span>
                {user.isMaster && <span className="master-badge">방장</span>}
              </div>
              {isMaster && user.id !== userId && (
                <button className="kick-button" onClick={() => onKickUserClick(user)} title="사용자 추방">
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
            <button className="game-select-button" onClick={() => setShowGameSelect(true)} title="게임 선택">
              게임 선택: {gameType === 'telepathy' ? '텔레파시 게임' : '라이어 게임'}
            </button>
          </div>
          {showGameSelect && (
            <div className="game-select-modal-overlay" onClick={() => setShowGameSelect(false)}>
              <div className="game-select-modal" onClick={(e) => e.stopPropagation()}>
                <h3>게임 선택</h3>
                <button
                  className={`game-option ${gameType === 'telepathy' ? 'active' : ''}`}
                  onClick={() => { setShowGameSelect(false); onSetGameType('telepathy'); }}
                >
                  텔레파시 게임
                </button>
                <button
                  className={`game-option ${gameType === 'liar' ? 'active' : ''}`}
                  onClick={() => { setShowGameSelect(false); onSetGameType('liar'); }}
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
                    onSetLiarSettings(newSubj, newSubj === '커스텀주제' ? '커스텀' : liarMethod, newSubj === '커스텀주제' ? liarCustomSubject : null);
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
                      onSetLiarSettings('커스텀주제', '커스텀', e.target.value.trim().slice(0, 16));
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
                    onChange={(e) => onSetLiarSettings(liarSubject, e.target.value, null)}
                  >
                    <option value="랜덤">랜덤</option>
                    <option value="커스텀">커스텀</option>
                  </select>
                </div>
              )}
              {!isMaster && (
                <p className="liar-settings-display">
                  주제: {liarSubject === '커스텀주제' ? (liarCustomSubject || '(입력 대기)') : liarSubject} | 방식: {liarSubject === '커스텀주제' ? '커스텀' : liarMethod}
                </p>
              )}
            </div>
          )}
          <button
            className="start-game-button"
            onClick={onStartGame}
            disabled={
              gameState !== 'waiting' ||
              isLoading ||
              (gameType === 'telepathy' && attenderCount < 2) ||
              (gameType === 'liar' && attenderCount < 3)
            }
          >
            {isLoading ? '게임 시작 중...' : `게임 시작 (참가자 ${attenderCount}명)`}
          </button>
          {gameState !== 'waiting' && <p className="waiting-message">모든 사용자가 대기실로 돌아올 때까지 기다려주세요.</p>}
          {gameState === 'waiting' && gameType === 'telepathy' && attenderCount < 2 && (
            <p className="waiting-message">참가자는 최소 2명 이상 필요합니다.</p>
          )}
          {gameState === 'waiting' && gameType === 'liar' && attenderCount < 3 && (
            <p className="waiting-message">라이어 게임은 참가자 3명 이상 필요합니다.</p>
          )}
        </div>
      )}

      <div className="room-actions">
        <button className="leave-room-button" onClick={onLeaveRoom}>
          방 나가기
        </button>
      </div>
    </div>
  );
}
