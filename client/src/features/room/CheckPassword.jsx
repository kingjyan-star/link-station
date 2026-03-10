import React from 'react';
import { PasswordToggle } from './PasswordToggle.jsx';

export function CheckPassword({
  enteredRoomName,
  enteredPassword,
  setEnteredPassword,
  showPassword,
  setShowPassword,
  onSubmit,
  onCancel,
  isLoading
}) {
  return (
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
              type={showPassword ? 'text' : 'password'}
              value={enteredPassword}
              onChange={(e) => setEnteredPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              maxLength={16}
            />
            <PasswordToggle visible={showPassword} onToggle={() => setShowPassword(!showPassword)} />
          </div>
        </div>

        <div className="button-group">
          <button
            className="enter-button"
            onClick={onSubmit}
            disabled={isLoading}
          >
            {isLoading ? '확인 중...' : '입장하기'}
          </button>
          <button className="cancel-button" onClick={onCancel}>
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
