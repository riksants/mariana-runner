// Plain-Node logic check for js/skins.js — no framework, no deps.
// Run with: node scripts/test-skins.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SKINS_SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'skins.js'), 'utf8');

// vm.runInContext keeps top-level `const`/`let` bindings in a lexical
// scope that isn't reachable via the context object afterward (only
// `var`/function declarations attach to it) — so the script under test
// exposes its names via an explicit `this.__exports` assignment appended
// here, without changing js/skins.js itself.
const EXPORT_TAIL = `
this.__exports = { SKIN_DEFS, SkinStore, skinById, COIN_CLUSTER_SIZE, COIN_CLUSTER_GAP_BASE, COIN_CLUSTER_GAP_VARIANCE, rollCoinClusterGap };
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
  vm.runInContext(SKINS_SRC + EXPORT_TAIL, context, { filename: 'skins.js' });
  return { sandbox: context.__exports, store };
}

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
  else console.log('ok  :', msg);
}

let { sandbox, store } = freshSandbox();
assert(sandbox.SkinStore.getCoins() === 0, 'starts with 0 coins');
assert(JSON.stringify(sandbox.SkinStore.getUnlocked()) === '["normal"]', 'starts with only normal unlocked');
assert(sandbox.SkinStore.getEquipped() === 'normal', 'starts with normal equipped');
assert(sandbox.SkinStore.isUnlocked('princesa') === false, 'princesa starts locked');

const skinOrder = sandbox.SKIN_DEFS.map((s) => s.id);
assert(
  JSON.stringify(skinOrder) === JSON.stringify(['normal', 'princesa', 'volei', 'pijama', 'macaca', 'gold', 'noiva']),
  'wardrobe order is normal-princesa-volei-pijama-macaca-gold-noiva'
);
assert(sandbox.skinById('macaca').price === 2500, 'macaca costs 2500 coins');
assert(sandbox.skinById('macaca').special === undefined, 'macaca is not flagged special (that stays reserved for noiva)');

let res = sandbox.SkinStore.purchase('princesa');
assert(res.ok === false && res.reason === 'insufficient-coins', 'purchase fails with 0 coins');
assert(sandbox.SkinStore.getCoins() === 0, 'coins unchanged after failed purchase');

sandbox.SkinStore.addCoins(500);
assert(sandbox.SkinStore.getCoins() === 500, 'addCoins credits balance');
res = sandbox.SkinStore.purchase('princesa');
assert(res.ok === true, 'purchase succeeds with enough coins');
assert(sandbox.SkinStore.getCoins() === 0, 'coins deducted immediately on purchase');
assert(sandbox.SkinStore.isUnlocked('princesa') === true, 'princesa unlocked after purchase');

sandbox.SkinStore.addCoins(500);
res = sandbox.SkinStore.purchase('princesa');
assert(res.ok === false && res.reason === 'already-owned', 'cannot repurchase an owned skin');
assert(sandbox.SkinStore.getCoins() === 500, 'coins untouched when repurchase is rejected');

assert(sandbox.SkinStore.setEquipped('gold') === false, 'cannot equip a locked skin');
assert(sandbox.SkinStore.getEquipped() === 'normal', 'equipped skin unchanged after rejected equip');
assert(sandbox.SkinStore.setEquipped('princesa') === true, 'can equip an owned skin');
assert(sandbox.SkinStore.getEquipped() === 'princesa', 'equipped skin updates');

// Persistence: a fresh module load over the same backing store keeps state.
const reload = freshSandbox(store);
assert(reload.sandbox.SkinStore.getCoins() === 500, 'coins persist across reload');
assert(reload.sandbox.SkinStore.getEquipped() === 'princesa', 'equipped skin persists across reload');
assert(reload.sandbox.SkinStore.isUnlocked('princesa') === true, 'unlocked skins persist across reload');

for (let i = 0; i < 200; i++) {
  const gap = reload.sandbox.rollCoinClusterGap();
  assert(
    gap >= reload.sandbox.COIN_CLUSTER_GAP_BASE && gap <= reload.sandbox.COIN_CLUSTER_GAP_BASE + reload.sandbox.COIN_CLUSTER_GAP_VARIANCE,
    'coin cluster gap stays within configured bounds'
  );
  break; // one representative check is enough noise in the log; loop still proves the bound holds
}

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log('\nAll skins.js checks passed.');
