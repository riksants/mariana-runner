// scripts/test-daynight.js — verifies the real-time-based day/night cycle
// formula used in js/game.js (score-based cycling was tried and reverted:
// score accrues faster as the run speeds up, so a score-based cycle
// silently sped up over the course of a run, which read as the sun/moon
// jumping abruptly — real time doesn't have that problem).
// Run with: node scripts/test-daynight.js
'use strict';
const PHASE_CYCLE_SECONDS = 600;

function cyclePosition(elapsed) {
  const span = ((elapsed % PHASE_CYCLE_SECONDS) + PHASE_CYCLE_SECONDS) % PHASE_CYCLE_SECONDS;
  return span / PHASE_CYCLE_SECONDS;
}
function darkness(elapsed) {
  return (1 - Math.cos(2 * Math.PI * cyclePosition(elapsed))) / 2;
}

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
  else console.log('ok  :', msg);
}

assert(Math.abs(darkness(0)) < 1e-9, 't=0s is full daylight (darkness ~0)');
assert(Math.abs(darkness(300) - 1) < 1e-9, 't=300s (half cycle) is peak night (darkness ~1)');
assert(Math.abs(darkness(600)) < 1e-9, 't=600s (full cycle) is back to full daylight');
assert(Math.abs(darkness(1200)) < 1e-9, 'the cycle repeats every 600 real seconds regardless of magnitude');
assert(darkness(150) > 0.45 && darkness(150) < 0.55, 't=150s (quarter cycle) is near the dusk midpoint (~0.5)');

// The whole point of switching to real time: a short match barely moves
// along the cycle, regardless of how fast/well the run is going (score
// has no bearing on this formula at all anymore).
assert(darkness(90) < 0.25, 'a typical 90s match only sees a small, gentle change (not an abrupt jump)');
assert(darkness(30) < 0.05, 'a very short 30s match is nearly imperceptible');

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log('\nAll day/night formula checks passed.');
