import React, { useState, useEffect } from 'react';

export function LiarWordInput({ attenders, submittedCount, notSubmittedNames = [], userRole, onSubmit, setError, isLoading, setIsLoading }) {
  const [word, setWord] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    const w = word.trim().slice(0, 16);
    if (!w) {
      setError('단어를 입력하세요');
      return;
    }
    setIsLoading(true);
    const ok = await onSubmit(w);
    setIsLoading(false);
    if (ok) {
      setSubmitted(true);
      setWord('');
    }
  };

  if (userRole === 'observer') return <p>참가자가 단어를 입력하는 중입니다...</p>;
  if (submitted) {
    return (
      <div className="liar-word-input">
        <p>제출 완료! 다른 참가자를 기다리는 중... ({submittedCount}/{attenders.length})</p>
        {notSubmittedNames.length > 0 && (
          <p className="liar-pending-list">아직 외치지 않은 사람들: {notSubmittedNames.join(', ')}</p>
        )}
      </div>
    );
  }
  return (
    <div className="liar-word-input">
      <p>주제에 맞는 단어를 입력하세요 (최대 16자)</p>
      {notSubmittedNames.length > 0 && (
        <p className="liar-pending-list">아직 외치지 않은 사람들: {notSubmittedNames.join(', ')}</p>
      )}
      <input
        value={word}
        onChange={(e) => setWord(e.target.value.slice(0, 16))}
        maxLength={16}
        placeholder="단어 입력"
      />
      <button onClick={handleSubmit} disabled={isLoading}>제출</button>
    </div>
  );
}

const DIFFICULT_WORD_WINDOW_MS = 30 * 1000;

export function LiarPlay({
  attenders,
  amILiar,
  liarMyWord,
  mainTimerEndsAt,
  playStartedAt,
  extendedBy,
  lastTimeChange,
  onExtendTime,
  onDifficultWord,
  onStartVote,
  isMaster,
  userId,
  setError
}) {
  const [cardFlipped, setCardFlipped] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [difficultWordTimeLeft, setDifficultWordTimeLeft] = useState(null);

  useEffect(() => {
    if (!mainTimerEndsAt) return;
    const tick = () => setTimeLeft(Math.max(0, Math.ceil((mainTimerEndsAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [mainTimerEndsAt]);

  useEffect(() => {
    if (!playStartedAt) return;
    const endsAt = playStartedAt + DIFFICULT_WORD_WINDOW_MS;
    const tick = () => setDifficultWordTimeLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [playStartedAt]);

  const usedExtend = Array.isArray(extendedBy) && extendedBy.includes(userId);
  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const difficultWordExpired = difficultWordTimeLeft !== null && difficultWordTimeLeft <= 0;

  return (
    <div className="liar-play">
      <div className="liar-timer">{timeLeft !== null ? fmt(timeLeft) : '--:--'}</div>
      <div
        className={`liar-card ${cardFlipped ? 'flipped' : ''}`}
        onTouchStart={() => setCardFlipped(true)}
        onMouseDown={() => setCardFlipped(true)}
        onTouchEnd={() => setCardFlipped(false)}
        onMouseUp={() => setCardFlipped(false)}
        onMouseLeave={() => setCardFlipped(false)}
        style={{ userSelect: 'none', WebkitTouchCallout: 'none' }}
      >
        {cardFlipped
          ? (amILiar ? '당신은 라이어입니다' : (liarMyWord || '?'))
          : '?'}
      </div>
      <p className="liar-role-hint">
        {amILiar ? '단어를 맞혀보세요!' : '카드를 눌러 단어를 확인하세요'}
      </p>
      {!amILiar && !difficultWordExpired && (
        <div className="liar-difficult-row">
          <button className="liar-difficult-btn" onClick={onDifficultWord}>
            이 단어는 선 넘었지
          </button>
          <span className="liar-difficult-timer">{difficultWordTimeLeft !== null ? `${difficultWordTimeLeft}초` : '30'}</span>
        </div>
      )}
      {lastTimeChange && (
        <p className="liar-time-change-msg">
          {lastTimeChange.nickname}이(가) 시간을 {lastTimeChange.action === 'extend' ? '연장' : '단축'}했다!
        </p>
      )}
      {!usedExtend ? (
        <div className="liar-time-buttons">
          <button onClick={() => onExtendTime('extend')}>+1분</button>
          <button onClick={() => onExtendTime('shorten')}>-1분</button>
        </div>
      ) : null}
      {isMaster && (
        <button className="liar-start-vote-btn" onClick={onStartVote}>
          투표 진행
        </button>
      )}
    </div>
  );
}

export function LiarVote({ attenders, votes, tieTargets, onVote, userId, setError }) {
  const targets = tieTargets && tieTargets.length > 0
    ? attenders.filter((u) => tieTargets.includes(u.id))
    : attenders;
  const myVote = votes && votes[userId];
  const voted = !!myVote;

  return (
    <div className="liar-vote">
      <span className={`liar-vote-status ${voted ? 'voted' : ''}`}>
        {voted ? '투표완료' : '투표중'}
      </span>
      <p>
        {tieTargets?.length ? '동점! 아래 중에서 다시 투표하세요' : '라이어라고 생각하는 사람에게 투표하세요'}
      </p>
      <div className="liar-vote-list">
        {targets.map((u) => (
          <button
            key={u.id}
            className={u.id === myVote ? 'selected' : ''}
            onClick={() => onVote(u.id)}
          >
            {u.displayName || u.nickname}
          </button>
        ))}
      </div>
    </div>
  );
}

export function LiarArgument({
  attenders,
  condemnedUserId,
  choices,
  iVotedCondemned,
  argumentEndsAt,
  onForgiveExecute,
  userId
}) {
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    if (!argumentEndsAt) return;
    const tick = () => setTimeLeft(Math.max(0, Math.ceil((argumentEndsAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [argumentEndsAt]);

  const condemned = attenders.find((u) => u.id === condemnedUserId);
  const myChoice = choices && choices[userId];
  const amICondemned = userId === condemnedUserId;
  const canChoose = iVotedCondemned && !amICondemned;

  const timerDisplay = timeLeft !== null ? `${timeLeft}초` : '--';

  if (!canChoose) {
    return (
      <div className="liar-argument-wait">
        <p>사형수를 지목한 사람들이 사면/처형을 결정합니다...</p>
        <div className="liar-argument-timer">{timerDisplay}</div>
      </div>
    );
  }

  return (
    <div className="liar-argument">
      <div className="liar-argument-timer">{timerDisplay}</div>
      <p>사형수: {condemned?.displayName || condemned?.nickname}</p>
      <p>사면하면 재투표, 처형하면 최종 발표로</p>
      {myChoice ? (
        <p>선택: {myChoice === 'forgive' ? '사면' : '처형'}</p>
      ) : (
        <div className="liar-forgive-execute-buttons">
          <button className="liar-forgive-btn" onClick={() => onForgiveExecute('forgive')}>사면</button>
          <button className="liar-execute-btn" onClick={() => onForgiveExecute('execute')}>처형</button>
        </div>
      )}
    </div>
  );
}

export function LiarIdentify({
  attenders,
  amILiar,
  condemnedIsLiar,
  canGuess,
  guessedWord,
  identifyVotes,
  guessEndsAt,
  identifyEndsAt,
  onGuess,
  onIdentifyVote,
  userId,
  setError
}) {
  const [guess, setGuess] = useState('');
  const [guessTimeLeft, setGuessTimeLeft] = useState(null);
  const myIdentifyVote = identifyVotes && identifyVotes[userId];

  useEffect(() => {
    if (!guessEndsAt || !canGuess) return;
    const tick = () => setGuessTimeLeft(Math.max(0, Math.ceil((guessEndsAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [guessEndsAt, canGuess]);

  if (!condemnedIsLiar) {
    const sec = identifyEndsAt ? Math.max(0, Math.ceil((identifyEndsAt - Date.now()) / 1000)) : 10;
    return (
      <p>
        사형수는 라이어가 아닙니다... 결과를 기다리는 중 ({sec}초)
      </p>
    );
  }

  if (canGuess) {
    const timerDisplay = guessTimeLeft !== null ? `${guessTimeLeft}초` : '30';
    return (
      <div className="liar-guess">
        <div className="liar-guess-timer">{timerDisplay}</div>
        <p>단어를 맞혀보세요!</p>
        <input
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          placeholder="추측"
        />
        <button onClick={() => onGuess(guess)}>제출</button>
      </div>
    );
  }

  if (guessedWord && !amILiar) {
    return (
      <div className="liar-identify-vote">
        <p>라이어의 추측: &quot;{guessedWord}&quot; — 인정하시겠습니까?</p>
        {myIdentifyVote ? (
          <p>선택: {myIdentifyVote}</p>
        ) : (
          <div>
            <button onClick={() => onIdentifyVote('인정')}>인정</button>
            <button onClick={() => onIdentifyVote('노인정')}>노인정</button>
          </div>
        )}
      </div>
    );
  }

  return <p>결과를 기다리는 중...</p>;
}

export function LiarResult({ scenario, data, onReturnToWaiting, onLeave }) {
  const msgs = {
    A: `라이어 승리! "${data?.secretWord || ''}" 맞췄습니다. ${data?.liarNickname || '라이어'} 🎭`,
    B: `일반인 승리! 라이어가 "${data?.guessedWord || ''}"로 틀렸습니다. 정답: "${data?.secretWord || ''}"`,
    C: `라이어 승리! 사형수 ${data?.condemnedNickname || ''}는 라이어가 아니었습니다. 정답: "${data?.secretWord || ''}"`,
    D: `"이 단어는 선 넘었지"로 종료. 라이어: ${data?.liarNickname || ''}, 정답: ${data?.secretWord || ''}`
  };
  const scenarioKey = scenario && String(scenario).toUpperCase();
  const msg = msgs[scenarioKey] || '게임 종료';

  return (
    <div className="liar-result">
      <h3>게임 결과</h3>
      <p className="liar-result-msg">{msg}</p>
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
