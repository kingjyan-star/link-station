import React from 'react';
import { PasswordToggle } from './PasswordToggle.jsx';

export function MakeRoom({
  roomName,
  setRoomName,
  roomPassword,
  setRoomPassword,
  showPassword,
  setShowPassword,
  memberLimit,
  setMemberLimit,
  onCreate,
  onCancel,
  isLoading
}) {
  return (
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
              type={showPassword ? 'text' : 'password'}
              value={roomPassword}
              onChange={(e) => setRoomPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요 (선택사항)"
              maxLength={16}
            />
            <PasswordToggle visible={showPassword} onToggle={() => setShowPassword(!showPassword)} />
          </div>
        </div>

        <div className="input-group">
          <label htmlFor="memberLimit">최대 인원 (2-99명)</label>
          <div className="member-limit-control">
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
              className="member-limit-input"
            />
            <div className="member-limit-arrows">
              <button
                type="button"
                className="member-limit-arrow member-limit-up"
                onClick={() => setMemberLimit((m) => Math.min(99, (m || 2) + 1))}
                aria-label="인원 증가"
              >
                ▲
              </button>
              <button
                type="button"
                className="member-limit-arrow member-limit-down"
                onClick={() => setMemberLimit((m) => Math.max(2, (m || 8) - 1))}
                aria-label="인원 감소"
              >
                ▼
              </button>
            </div>
          </div>
        </div>

        <div className="button-group">
          <button
            className="create-room-button"
            onClick={onCreate}
            disabled={isLoading || !roomName.trim() || memberLimit < 2}
          >
            {isLoading ? '방 생성 중...' : '방 생성하기'}
          </button>
          <button className="cancel-button" onClick={onCancel}>
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
