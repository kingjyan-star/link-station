/**
 * Lightweight sound feedback for game state changes.
 * Uses Web Audio API - no external audio files required.
 * Plays a short chime to confirm state transitions to users.
 */

let audioContext = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!audioContext && (window.AudioContext || window.webkitAudioContext)) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

/**
 * Play a short tone.
 * @param {number} frequency - Hz (default 523 = C5)
 * @param {number} duration - ms (default 150)
 * @param {string} type - 'sine' | 'square' | 'triangle' (default 'sine')
 */
export function playTone(frequency = 523, duration = 150, type = 'sine') {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') ctx.resume();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    const now = ctx.currentTime;
    oscillator.frequency.value = frequency;
    oscillator.type = type;
    gainNode.gain.setValueAtTime(0.15, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration / 1000);
    oscillator.start(now);
    oscillator.stop(now + duration / 1000);
  } catch (e) {
    console.warn('Sound play failed:', e);
  }
}

/** Subtle "state changed" chime - soft, confirming */
export function playStateChange() {
  playTone(523, 120, 'sine');
}

/** Slightly higher - e.g. vote complete, phase advance */
export function playPhaseAdvance() {
  playTone(659, 100, 'sine');
}

/** Lower, rounder - e.g. result, game end */
export function playResult() {
  playTone(392, 200, 'sine');
}
