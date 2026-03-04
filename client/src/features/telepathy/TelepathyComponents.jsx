import React from 'react';

export function TelepathyPlay({
  users,
  userId,
  hasVoted,
  selectedUser,
  userRole,
  onSelectUser,
  isLoading
}) {
  const attenders = users.filter((u) => (u.role || 'attender') === 'attender');

  return (
    <div className="telepathy-container">
      <div className="telepathy-header">
        <h2>🔗 텔레파시 게임</h2>
        <p>
          {userRole === 'observer' ? '투표 상황을 관전하세요' : '연결하고 싶은 사람을 선택하세요'}
        </p>
        <p className="role-indicator">
          현재 역할: {userRole === 'attender' ? '참가자' : '관전자'}
        </p>
      </div>

      <div className="users-list">
        <h3>참가자 목록</h3>
        <div className="users-grid">
          {attenders.map((user) => (
            <div key={user.id} className="user-card">
              <div className="user-info">
                <span className="user-nickname">{user.displayName || user.nickname}</span>
                {user.id === userId && <span className="you-badge">나</span>}
              </div>

              <div className="user-indicators">
                {user.isMaster && (
                  <div className="master-indicator">
                    <span>👑 방장</span>
                  </div>
                )}
                {hasVoted && selectedUser === user.id && (
                  <div className="selected-indicator">
                    <span>🎯 당신의 선택</span>
                  </div>
                )}
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
                  onClick={() => onSelectUser(user.id)}
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
}

export function TelepathyResult({ matches, unmatched, onReturnToWaiting, onLeave }) {
  return (
    <div className="telepathy-result-container">
      <div className="telepathy-result-header">
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
        <button className="return-to-waiting-button" onClick={onReturnToWaiting}>
          대기실로 돌아가기
        </button>
        <button className="leave-room-button" onClick={onLeave}>
          방 나가기
        </button>
      </div>
    </div>
  );
}
