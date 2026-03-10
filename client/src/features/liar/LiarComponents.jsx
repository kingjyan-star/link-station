import React, { useState, useEffect, useRef } from 'react';

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
      <p>당신의 희망단어를 외쳐주세요! (최대 16자)</p>
      {notSubmittedNames.length > 0 && (
        <p className="liar-pending-list">아직 외치지 않은 사람들: {notSubmittedNames.join(', ')}</p>
      )}
      <input
        value={word}
        onChange={(e) => setWord(e.target.value.slice(0, 16))}
        maxLength={16}
        placeholder="희망단어"
      />
      <button onClick={handleSubmit} disabled={isLoading}>외치기</button>
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
  const prevTimeLeftRef = useRef(null);
  const [timerAnimating, setTimerAnimating] = useState(false);
  const [difficultWordTimeLeft, setDifficultWordTimeLeft] = useState(null);

  useEffect(() => {
    if (!mainTimerEndsAt) return;
    const tick = () => setTimeLeft(Math.max(0, Math.ceil((mainTimerEndsAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [mainTimerEndsAt]);

  useEffect(() => {
    if (timeLeft === null) return;
    const prev = prevTimeLeftRef.current;
    prevTimeLeftRef.current = timeLeft;
    if (prev !== null && Math.abs(timeLeft - prev) > 1) {
      setTimerAnimating(true);
      const t = setTimeout(() => setTimerAnimating(false), 500);
      return () => clearTimeout(t);
    }
  }, [timeLeft]);

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
      <p className="liar-play-header">평화로운 마을에 라이어가 침입했습니다.</p>
      <p className="liar-play-subheader">카드 뒷면의 비밀 단어를 숨긴 채 라이어를 색출해주세요!</p>
      <div className={`liar-timer ${timerAnimating ? 'liar-timer-animate' : ''}`}>{timeLeft !== null ? fmt(timeLeft) : '--:--'}</div>
      <div
        className={`liar-card ${cardFlipped ? 'flipped' : ''}`}
        onTouchStart={() => setCardFlipped(true)}
        onMouseDown={() => setCardFlipped(true)}
        onTouchEnd={() => setCardFlipped(false)}
        onMouseUp={() => setCardFlipped(false)}
        onMouseLeave={() => setCardFlipped(false)}
        style={{ userSelect: 'none', WebkitTouchCallout: 'none' }}
      >
        <div className="liar-card-inner">
          {cardFlipped ? (
            <div className="liar-card-front">
              {amILiar ? '당신은 라이어입니다' : (liarMyWord || '?')}
            </div>
          ) : (
            <div className="liar-card-back">
              <span className="liar-card-secret-label">Top 1 Secret</span>
            </div>
          )}
        </div>
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
          <button className="liar-time-extend" onClick={() => onExtendTime('extend')} title="시간 연장">
            <span className="liar-time-arrow">▲</span>
            <span>시간 연장</span>
          </button>
          <button className="liar-time-shorten" onClick={() => onExtendTime('shorten')} title="시간 단축">
            <span className="liar-time-arrow">▼</span>
            <span>시간 단축</span>
          </button>
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
      <p className="liar-vote-header">
        {tieTargets?.length ? '동점! 아래 중에서 다시 투표하세요' : '당신의 라이어에 투표하세요'}
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
  userId,
  voterNames = []
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
        {voterNames.length > 0 && (
          <p className="liar-argument-voters">투표한 사람: {voterNames.join(', ')}</p>
        )}
        <div className="liar-argument-timer">{timerDisplay}</div>
      </div>
    );
  }

  return (
    <div className="liar-argument">
      <div className="liar-argument-timer">{timerDisplay}</div>
      <p className="liar-argument-header">사형수: {condemned?.displayName || condemned?.nickname}</p>
      <p>최후의 변론</p>
      {voterNames.length > 0 && (
        <p className="liar-argument-voters">투표한 사람: {voterNames.join(', ')}</p>
      )}
      {myChoice ? (
        <p>선택: {myChoice === 'forgive' ? '사면하기' : '처형하기'}</p>
      ) : (
        <div className="liar-forgive-execute-buttons">
          <button className="liar-forgive-btn" onClick={() => onForgiveExecute('forgive')}>사면하기</button>
          <button className="liar-execute-btn" onClick={() => onForgiveExecute('execute')}>처형하기</button>
        </div>
      )}
    </div>
  );
}

export function LiarIdentify({
  attenders,
  amILiar,
  condemnedUserId,
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
  const condemned = attenders.find((u) => u.id === condemnedUserId);
  const condemnedNickname = condemned?.displayName || condemned?.nickname || '사형수';
  const [guess, setGuess] = useState('');
  const [guessSubmitted, setGuessSubmitted] = useState(false);
  const [guessTimeLeft, setGuessTimeLeft] = useState(null);
  const myIdentifyVote = identifyVotes && identifyVotes[userId];

  useEffect(() => {
    if (!guessEndsAt || !condemnedIsLiar) return;
    const tick = () => setGuessTimeLeft(Math.max(0, Math.ceil((guessEndsAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [guessEndsAt, condemnedIsLiar]);

  if (!condemnedIsLiar) {
    const sec = identifyEndsAt ? Math.max(0, Math.ceil((identifyEndsAt - Date.now()) / 1000)) : 10;
    return (
      <div className="liar-identify-wait">
        <p>처형된 {condemnedNickname}은(는) 라이어가 아닙니다.</p>
        <p>라이어가 모습을 드러내기 시작합니다</p>
        <div className="liar-identify-timer">{sec}초</div>
      </div>
    );
  }

  const guessExpired = guessTimeLeft !== null && guessTimeLeft <= 0;

  if (canGuess) {
    const timerDisplay = guessTimeLeft !== null ? `${guessTimeLeft}초` : '30';
    return (
      <div className="liar-guess">
        <p>처형된 <span className="liar-highlight">&quot;{condemnedNickname}&quot;</span>은(는) 라이어가 맞습니다.</p>
        <p><span className="liar-highlight">&quot;{condemnedNickname}&quot;</span>이(가) 처형대 밑에서 읊조리기 시작합니다..</p>
        <div className="liar-guess-timer">{timerDisplay}</div>
        <input
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          placeholder="추측"
          disabled={guessSubmitted}
        />
        <button className="liar-guess-submit" onClick={async () => { const ok = await onGuess(guess); if (ok) setGuessSubmitted(true); }} disabled={guessExpired || guessSubmitted}>
          제출
        </button>
      </div>
    );
  }

  if (!amILiar && condemnedIsLiar && !guessedWord) {
    return (
      <div className="liar-identify-wait-liar">
        <p>처형된 <span className="liar-highlight">&quot;{condemnedNickname}&quot;</span>은(는) 라이어가 맞습니다.</p>
        <p><span className="liar-highlight">&quot;{condemnedNickname}&quot;</span>이(가) 처형대 밑에서 읊조리기 시작합니다..</p>
        <div className="liar-guess-timer">{guessTimeLeft !== null ? `${guessTimeLeft}초` : '30'}</div>
      </div>
    );
  }

  if (guessedWord && !amILiar) {
    return (
      <div className="liar-identify-vote">
        <p>{condemnedNickname}는 <span className="liar-guessed-word">&quot;{guessedWord}&quot;</span>라고 읊조렸습니다. 인정하십니까?</p>
        {myIdentifyVote ? (
          <p>선택: {myIdentifyVote}</p>
        ) : (
          <div className="liar-identify-vote-buttons">
            <button className="liar-identify-btn liar-identify-yes" onClick={() => onIdentifyVote('인정')}>인정</button>
            <button className="liar-identify-btn liar-identify-no" onClick={() => onIdentifyVote('노인정')}>노인정</button>
          </div>
        )}
      </div>
    );
  }

  return <p>결과를 기다리는 중...</p>;
}

export function LiarResult({ scenario, data, liarMethod, attenders = [], votes = {}, onReturnToWaiting, onLeave }) {
  const liar = data?.liarNickname || '라이어';
  const word = data?.secretWord || '';
  const guessed = data?.guessedWord || '';
  const liarNoGuess = data?.liarNoGuess;
  const condemned = data?.condemnedNickname || '';
  const author = data?.wordAuthorNickname || '';

  const scenarioKey = scenario && String(scenario).toUpperCase();
  let messages = [];
  if (scenarioKey === 'A') {
    messages = [
      <>{liar}이(가) 비밀 단어를 읊조리자 강력한 힘이 샘솟으며 벌떡 일어났습니다.</>,
      <>{liar}은(는) <span className="liar-result-highlight">&quot;{word}&quot;</span>을(를) 연신 외치며 마을 주민들을 모두 학살했습니다!</>
    ];
  } else if (scenarioKey === 'B') {
    const firstMsg = liarNoGuess
      ? <>{liar}은(는) 아무 말도 하지 못했습니다..</>
      : <>{liar}은(는) <span className="liar-result-highlight">&quot;{guessed}&quot;</span>(이)라고 읊조리며 생명을 다했습니다..</>;
    messages = [
      firstMsg,
      <>마을주민들은 <span className="liar-result-highlight">&quot;{word}&quot;</span>을(를) 연신 외치며 {liar}을(를) 비웃었습니다 &gt;_&lt;</>
    ];
  } else if (scenarioKey === 'C') {
    messages = [
      <>라이어 {liar}이(가) 음흉한 미소를 지으며 쓰러진 {condemned} 주머니를 뒤적거립니다.</>,
      <>{liar}는 주머니 속 쪽지에 쓰여진 <span className="liar-result-highlight">&quot;{word}&quot;</span>를 읊조리며 강력한 힘을 얻었습니다</>,
      <>{liar}은(는) <span className="liar-result-highlight">&quot;{word}&quot;</span>을(를) 연신 외치며 마을 주민들을 모두 학살했습니다!</>
    ];
  } else if (scenarioKey === 'D') {
    if (liarMethod === '랜덤') {
      messages = [
        <>비밀 단어는 <span className="liar-result-highlight">&quot;{word}&quot;</span>였습니다.</>,
        <>라이어 {liar}은(는) 어이없는 표정을 지으며 안도했습니다..</>
      ];
    } else {
      messages = [
        <>비밀 단어는 {author}이(가) 창조한 <span className="liar-result-highlight">&quot;{word}&quot;</span>였습니다.</>,
        <>마을주민들은 고개를 저으며 {author}을(를) 손가락질했습니다!</>,
        <>라이어 {liar}은(는) 어이없는 표정을 지으며 안도했습니다..</>
      ];
    }
  } else {
    messages = [<>게임 종료</>];
  }

  // Result Status: use snapshot from result time (like Telepathy matchResult) so names persist when users leave
  const snapshot = data?.voteRankingSnapshot;
  const ranked = snapshot && snapshot.length > 0
    ? snapshot
    : (() => {
        const voteCounts = {};
        const votersByTarget = {};
        for (const [voterId, targetId] of Object.entries(votes)) {
          voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
          (votersByTarget[targetId] = votersByTarget[targetId] || []).push(voterId);
        }
        const allTargetIds = [...new Set(Object.values(votes))];
        return allTargetIds
          .filter((id) => voteCounts[id] != null)
          .sort((a, b) => (voteCounts[b] || 0) - (voteCounts[a] || 0))
          .map((id) => {
            const u = attenders.find((a) => a.id === id);
            return { id, name: u ? (u.displayName || u.nickname) : '?', voteCount: voteCounts[id], voterNames: (votersByTarget[id] || []).map((vid) => {
              const vu = attenders.find((a) => a.id === vid);
              return vu ? (vu.displayName || vu.nickname) : '?';
            }) };
          });
      })();

  return (
    <div className="liar-result">
      <h3>게임 결과</h3>
      <div className="liar-result-msgs">
        {messages.map((msg, i) => (
          <p key={i} className="liar-result-msg">{msg}</p>
        ))}
      </div>
      {ranked.length > 0 && (
        <div className="liar-result-status">
          <h4>투표 결과</h4>
          <ul>
            {ranked.map((r) => (
              <li key={r.id}>
                {r.name}: {r.voteCount}표
                {r.voterNames?.length > 0 && (
                  <span className="liar-voters">
                    ({r.voterNames.join(', ')})
                  </span>
                )}
              </li>
            ))}
          </ul>
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
