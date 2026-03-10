import React from 'react';

export function JoinRoom({ enteredRoomName, setEnteredRoomName, onSubmit, onCancel, isLoading }) {
  return (
    <div className="enterroom-container">
      <div className="enterroom-header">
        <h2>방 참여하기</h2>
        <p>참여할 방의 이름을 입력하세요</p>
      </div>

      <div className="enterroom-form">
        <div className="input-group">
          <label htmlFor="enteredRoomName">방 이름 (최대 16자)</label>
          <input
            id="enteredRoomName"
            type="text"
            value={enteredRoomName}
            onChange={(e) => setEnteredRoomName(e.target.value)}
            placeholder="방 이름을 입력하세요"
            maxLength={16}
          />
        </div>

        <div className="button-group">
          <button
            className="join-room-button"
            onClick={onSubmit}
            disabled={isLoading || !enteredRoomName.trim()}
          >
            {isLoading ? '참여 중...' : '방 참여하기'}
          </button>
          <button className="cancel-button" onClick={onCancel}>
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
