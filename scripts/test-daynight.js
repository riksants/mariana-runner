// scripts/test-daynight.js — verifies the score-based cycle formula
// this task implements. Run with: node scripts/test-daynight.js
'use strict';
const PHASE_CYCLE_SCORE = 3000;

function cyclePosition(score) {
  const span = ((score % PHASE_CYCLE_SCORE) + PHASE_CYCLE_SCORE) % PHASE_CYCLE_SCORE;
  return span / PHASE_CYCLE_SCORE;
}
function darkness(score) {
  return (1 - Math.cos(2 * Math.PI * cyclePosition(score))) / 2;
}

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
  else console.log('ok  :', msg);
}

assert(Math.abs(darkness(0)) < 1e-9, 'score 0 is full daylight (darkness ~0)');
assert(Math.abs(darkness(1500) - 1) < 1e-9, 'score 1500 (half cycle) is peak night (darkness ~1)');
assert(Math.abs(darkness(3000)) < 1e-9, 'score 3000 (full cycle) is back to full daylight');
assert(Math.abs(darkness(6000)) < 1e-9, 'the cycle repeats every 3000 points regardless of magnitude');
assert(darkness(750) > 0.45 && darkness(750) < 0.55, 'score 750 (quarter cycle) is near the dusk midpoint (~0.5)');

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log('\nAll day/night formula checks passed.');
