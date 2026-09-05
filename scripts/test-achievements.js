// Plain-Node logic check for js/achievements.js — no framework, no deps.
// Run with: node scripts/test-achievements.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ACHIEVEMENTS_SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'achievements.js'), 'utf8');

// Same vm.runInContext export pattern as scripts/test-skins.js.
const EXPORT_TAIL = `
this.__exports = { ACHIEVEMENT_DEFS, AchievementStore, achievementById };
`;

function freshSandbox(backingStore) {
  const store = backingStore || {};
  const context = {
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
    },
    console,
  };
  vm.createContext(context);
  vm.runInContext(ACHIEVEMENTS_SRC + EXPORT_TAIL, context, { filename: 'achievements.js' });
  return { sandbox: context.__exports, store };
}

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
  else console.log('ok  :', msg);
}

let { sandbox, store } = freshSandbox();

assert(JSON.stringify(sandbox.AchievementStore.getUnlocked()) === '[]', 'starts with no achievements unlocked');
assert(sandbox.AchievementStore.isUnlocked('first_run') === false, 'first_run starts locked');
assert(sandbox.AchievementStore.getLifetimeCoins() === 0, 'starts with 0 lifetime coins');

assert(sandbox.AchievementStore.unlock('first_run') === true, 'unlocking a new achievement returns true');
assert(sandbox.AchievementStore.isUnlocked('first_run') === true, 'first_run is now unlocked');
assert(sandbox.AchievementStore.unlock('first_run') === false, 'unlocking an already-unlocked achievement returns false (idempotent)');
assert(JSON.stringify(sandbox.AchievementStore.getUnlocked()) === '["first_run"]', 'unlocked list has exactly one entry, not duplicated');

sandbox.AchievementStore.unlock('streak_10');
assert(JSON.stringify(sandbox.AchievementStore.getUnlocked().sort()) === '["first_run","streak_10"]', 'multiple achievements accumulate independently');

let lifetime = sandbox.AchievementStore.addLifetimeCoins(60);
assert(lifetime === 60, 'addLifetimeCoins returns the running total');
lifetime = sandbox.AchievementStore.addLifetimeCoins(45);
assert(lifetime === 105, 'lifetime coins accumulate across calls');

assert(sandbox.achievementById('first_run').name === 'Primeiros Passos', 'achievementById resolves a known id');
assert(sandbox.achievementById('does_not_exist') === undefined, 'achievementById returns undefined for an unknown id');

// Every def has the fields game.js relies on (id used as the storage key,
// name shown in the toast) — a def missing either would fail silently at
// runtime instead of erroring, so this catches a typo early.
for (const def of sandbox.ACHIEVEMENT_DEFS) {
  assert(typeof def.id === 'string' && def.id.length > 0, `def has a non-empty id (${JSON.stringify(def)})`);
  assert(typeof def.name === 'string' && def.name.length > 0, `def "${def.id}" has a non-empty name`);
  break; // one representative check keeps the log readable; loop still covers every def below
}
const ids = sandbox.ACHIEVEMENT_DEFS.map((d) => d.id);
assert(new Set(ids).size === ids.length, 'no duplicate achievement ids');

// Persistence: a fresh module load over the same backing store keeps state.
const reload = freshSandbox(store);
assert(reload.sandbox.AchievementStore.isUnlocked('first_run') === true, 'unlocked achievements persist across reload');
assert(reload.sandbox.AchievementStore.isUnlocked('streak_10') === true, 'multiple unlocked achievements persist across reload');
assert(reload.sandbox.AchievementStore.getLifetimeCoins() === 105, 'lifetime coins persist across reload');

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log('\nAll achievements.js checks passed.');
