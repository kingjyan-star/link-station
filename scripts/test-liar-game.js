#!/usr/bin/env node
/**
 * API-level test for Liar Game flow.
 * Simulates 3 users: Master creates room, P2 and P3 join, start Liar game,
 * run through play → vote → argument → identify → result.
 *
 * Run: node scripts/test-liar-game.js
 * Or:  BASE_URL=https://lsta.app node scripts/test-liar-game.js
 *
 * Requires: API running (local: node dev-server.js, or use live URL)
 */
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

async function fetchJSON(path, options = {}) {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  return res.json();
}

function fail(msg) {
  throw new Error(msg);
}

async function pollRoom(roomId, username, maxAttempts = 20) {
  for (let i = 0; i < maxAttempts; i++) {
    const data = await fetchJSON(`/api/room/${roomId}?username=${encodeURIComponent(username)}`);
    if (data.success && data.room) return data.room;
    await new Promise((r) => setTimeout(r, 300));
  }
  fail('Room poll timeout');
}

async function main() {
  console.log('=== Liar Game API Test ===\n');
  console.log(`BASE_URL: ${BASE_URL}\n`);

  // 1. Master creates room
  console.log('1. Master creates room...');
  const createRes = await fetchJSON('/api/create-room', {
    method: 'POST',
    body: { username: 'TestMaster', roomName: 'LiarTestRoom', memberLimit: 8 },
  });
  if (!createRes.success) fail(`create-room: ${createRes.message}`);
  const { roomId, userId: masterId } = createRes;
  if (!roomId || !masterId) fail('Missing roomId or userId');
  console.log('   OK - Room:', roomId, 'Master:', masterId);

  // 2. P2 and P3 join
  console.log('\n2. P2, P3 join...');
  const join2 = await fetchJSON('/api/join-room-qr', {
    method: 'POST',
    body: { roomId, username: 'TestP2' },
  });
  if (!join2.success) fail(`P2 join: ${join2.message}`);
  const p2Id = join2.userId;

  const join3 = await fetchJSON('/api/join-room-qr', {
    method: 'POST',
    body: { roomId, username: 'TestP3' },
  });
  if (!join3.success) fail(`P3 join: ${join3.message}`);
  const p3Id = join3.userId;
  console.log('   OK - P2:', p2Id, 'P3:', p3Id);

  // 3. Set Liar game and settings
  console.log('\n3. Set game type Liar...');
  await fetchJSON('/api/set-game-type', {
    method: 'POST',
    body: { roomId, userId: masterId, gameType: 'liar' },
  });
  const setLiar = await fetchJSON('/api/set-liar-settings', {
    method: 'POST',
    body: { roomId, userId: masterId, liarSubject: '물건', liarMethod: '랜덤' },
  });
  if (!setLiar.success) fail(`set-liar-settings: ${setLiar.message}`);
  console.log('   OK');

  // 4. Start game
  console.log('\n4. Start Liar game...');
  const startRes = await fetchJSON('/api/start-game', {
    method: 'POST',
    body: { roomId, userId: masterId },
  });
  if (!startRes.success) fail(`start-game: ${startRes.message}`);
  if (startRes.gameState !== 'liarPlay') fail(`Expected liarPlay, got ${startRes.gameState}`);
  console.log('   OK - gameState:', startRes.gameState);

  // 5. Poll and verify liarPlayStartedAt (fix #4)
  const roomAfterStart = await pollRoom(roomId, 'TestMaster');
  if (!roomAfterStart.liarPlayStartedAt) fail('liarPlayStartedAt missing (30s button fix)');
  console.log('\n5. Verify liarPlayStartedAt present:', !!roomAfterStart.liarPlayStartedAt);

  // 6. Extend time (P2) - verify liarLastTimeChange (fix #7)
  console.log('\n6. P2 extends time...');
  const extRes = await fetchJSON('/api/liar-extend-time', {
    method: 'POST',
    body: { roomId, userId: p2Id, action: 'extend' },
  });
  if (!extRes.success) fail(`extend: ${extRes.message}`);

  const roomAfterExt = await pollRoom(roomId, 'TestMaster');
  if (!roomAfterExt.liarLastTimeChange) fail('liarLastTimeChange missing');
  if (roomAfterExt.liarLastTimeChange.nickname !== 'TestP2') fail('Wrong nickname in lastTimeChange');
  if (roomAfterExt.liarLastTimeChange.action !== 'extend') fail('Wrong action in lastTimeChange');
  console.log('   OK - liarLastTimeChange:', roomAfterExt.liarLastTimeChange.nickname, roomAfterExt.liarLastTimeChange.action);

  // 7. Master starts vote
  console.log('\n7. Master starts vote...');
  const voteStart = await fetchJSON('/api/liar-start-vote', {
    method: 'POST',
    body: { roomId, userId: masterId },
  });
  if (!voteStart.success) fail(`start-vote: ${voteStart.message}`);
  console.log('   OK');

  // 8. All vote for P3 (condemn P3)
  const condemnId = p3Id;
  console.log('\n8. All vote for P3 (condemn)...');
  await fetchJSON('/api/liar-vote', {
    method: 'POST',
    body: { roomId, userId: masterId, targetUserId: condemnId },
  });
  await fetchJSON('/api/liar-vote', {
    method: 'POST',
    body: { roomId, userId: p2Id, targetUserId: condemnId },
  });
  await fetchJSON('/api/liar-vote', {
    method: 'POST',
    body: { roomId, userId: p3Id, targetUserId: condemnId },
  });

  const roomVote = await pollRoom(roomId, 'TestMaster');
  if (roomVote.liarCondemnedUserId !== condemnId) fail(`Expected condemned ${condemnId}, got ${roomVote.liarCondemnedUserId}`);
  if (roomVote.gameState !== 'liarArgument') fail(`Expected liarArgument, got ${roomVote.gameState}`);
  console.log('   OK - condemned:', roomVote.liarCondemnedUserId, 'state:', roomVote.gameState);

  // 9. 사형수 (P3) cannot choose - API rejects (fix #10)
  console.log('\n9. Verify condemned cannot choose forgive/execute...');
  const condemnedForbid = await fetchJSON('/api/liar-forgive-execute', {
    method: 'POST',
    body: { roomId, userId: condemnId, choice: 'forgive' },
  });
  if (condemnedForbid.success) fail('Condemned should be forbidden to choose');
  if (!condemnedForbid.message?.includes('사형수')) fail('Expected 사형수 rejection message');
  console.log('   OK - condemned correctly rejected');

  // 10. Master and P2 vote execute (2 voters, need 2 for execute: floor(2/2)+1). Both vote -> immediate transition (fix #11)
  console.log('\n10. Voters choose execute (immediate execution, fix #11)...');
  await fetchJSON('/api/liar-forgive-execute', {
    method: 'POST',
    body: { roomId, userId: masterId, choice: 'execute' },
  });
  await fetchJSON('/api/liar-forgive-execute', {
    method: 'POST',
    body: { roomId, userId: p2Id, choice: 'execute' },
  });
  const afterExecute = await pollRoom(roomId, 'TestMaster');
  if (afterExecute.gameState !== 'liarIdentify') fail('Execute should transition immediately after threshold');
  console.log('   OK - immediate transition to identify');

  // 11. If condemned was liar: guess. If not: wait for identify timeout. Check result.
  const roomIdent = await pollRoom(roomId, 'TestMaster');
  const condemnedIsLiar = roomIdent.liarCondemnedUserId === roomIdent.liarLiarUserId;

  if (condemnedIsLiar) {
    console.log('\n11. Condemned is liar - submit guess...');
    const guessRes = await fetchJSON('/api/liar-guess', {
      method: 'POST',
      body: { roomId, userId: roomIdent.liarLiarUserId, guessedWord: roomIdent.liarSecretWord },
    });
    if (!guessRes.success) fail(`guess: ${guessRes.message}`);
  } else {
    console.log('\n11. Condemned is not liar - wait for identify phase...');
    await new Promise((r) => setTimeout(r, 12000));
  }

  const roomFinal = await pollRoom(roomId, 'TestMaster');
  if (roomFinal.gameState !== 'liarResult') fail(`Expected liarResult, got ${roomFinal.gameState}`);
  if (!roomFinal.liarResultScenario) fail('liarResultScenario missing');
  if (!roomFinal.liarResultData) fail('liarResultData missing');
  console.log('   OK - result scenario:', roomFinal.liarResultScenario);

  console.log('\n✅ All Liar Game API checks passed.');
}

main().catch((e) => {
  console.error('\n❌ FAIL:', e.message);
  process.exit(1);
});
