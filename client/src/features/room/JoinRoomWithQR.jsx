import React from 'react';

export function JoinRoomWithQR({ username, setUsername, onSubmit, onCancel, isLoading }) {
  return (
    <div className="enterroomwithqr-container">
      <div className="enterroomwithqr-header">
        <h2>QR 코드로 참여하기</h2>
        <p>사용자 이름을 입력하고 방에 참여하세요</p>
      </div>

      <div className="enterroomwithqr-form">
        <div className="input-group">
          <label htmlFor="qrUsername">사용자 이름 (최대 8자)</label>
          <input
            id="qrUsername"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="사용자 이름을 입력하세요"
            maxLength={8}
          />
        </div>

        <div className="button-group">
          <button
            className="join-button"
            onClick={onSubmit}
            disabled={isLoading || !username.trim()}
          >
            {isLoading ? '참여 중...' : '참여하기'}
          </button>
          <button className="cancel-button" onClick={onCancel}>
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
