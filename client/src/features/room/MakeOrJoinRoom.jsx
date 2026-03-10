import React from 'react';

export function MakeOrJoinRoom({ username, onMakeRoom, onJoinRoom, onExit }) {
  return (
    <div className="make-or-join-container">
      <div className="make-or-join-header">
        <h2>안녕하세요, {username}님!</h2>
        <p>원하시는 작업을 선택하세요</p>
      </div>

      <div className="make-or-join-options">
        <button className="make-room-button" onClick={onMakeRoom}>
          🏠 방 만들기
        </button>
        <button className="join-room-button" onClick={onJoinRoom}>
          🚪 방 참여하기
        </button>
        <button className="exit-button" onClick={onExit}>
          🚪 나가기
        </button>
      </div>
    </div>
  );
}
