#!/usr/bin/env node
/**
 * API-level test for tab-close reclaim logic.
 * Simulates: 2 users in room -> both "close tabs" (beacon) -> try to reclaim username + room.
 * Run with: node scripts/test-tab-close-reclaim.js
 * Requires: API running on http://localhost:5000 (or set BASE_URL)
 */
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

async function fetchJSON(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  return res.json();
}

async function main() {
  console.log('=== Tab-close reclaim API test ===\n');

  // 1. UserA creates room TestRoom
  console.log('1. UserA creates room TestRoom...');
  const createRes = await fetchJSON('/api/create-room', {
    method: 'POST',
    body: { username: 'TestUserA', roomName: 'TestRoomReclaim', memberLimit: 8 },
  });
  if (!createRes.success) {
    console.error('   FAIL:', createRes.message);
    return;
  }
  const { roomId, userId: userAId } = createRes;
  if (!roomId || !userAId) {
    console.error('   FAIL: Missing roomId or userId in create-room response');
    return;
  }
  console.log('   OK - Room created, userAId:', userAId);

  // 2. UserB joins
  console.log('\n2. UserB joins...');
  const joinRes = await fetchJSON('/api/join-room', {
    method: 'POST',
    body: { username: 'TestUserB', roomName: 'TestRoomReclaim' },
  });
  if (!joinRes.success) {
    console.error('   FAIL:', joinRes.message);
    return;
  }
  const userBId = joinRes.userId;
  console.log('   OK - UserB joined, userBId:', userBId);

  // 3. Simulate tab-close beacon for both users (pending removal)
  console.log('\n3. Simulate tab-close beacon (pending removal) for both users...');
  await fetch(`${BASE_URL}/api/remove-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'TestUserA',
      roomId,
      userId: userAId,
      immediate: false,
    }),
  });
  await fetch(`${BASE_URL}/api/remove-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'TestUserB',
      roomId,
      userId: userBId,
      immediate: false,
    }),
  });
  console.log('   OK - Pending removals queued');

  // 4. Immediately try to reclaim: check username TestUserA
  console.log('\n4. Check if TestUserA is available (should reclaim from pending)...');
  const checkUser = await fetchJSON('/api/check-username', {
    method: 'POST',
    body: { username: 'TestUserA' },
  });
  if (checkUser.duplicate) {
    console.error('   FAIL: TestUserA still duplicate (immediate reclaim did not run)');
    return;
  }
  console.log('   OK - TestUserA available');

  // 5. Try to create room TestRoomReclaim (should reclaim - all users had pending)
  console.log('\n5. Create room TestRoomReclaim with TestUserA (should reclaim room name)...');
  const create2 = await fetchJSON('/api/create-room', {
    method: 'POST',
    body: {
      username: 'TestUserA',
      roomName: 'TestRoomReclaim',
      memberLimit: 8,
    },
  });
  if (!create2.success) {
    console.error('   FAIL:', create2.message);
    return;
  }
  console.log('   OK - Room created successfully');

  console.log('\n✅ All tab-close reclaim checks passed.');
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
