// Plain-Node logic check for js/skins.js's Alberto-facing additions
// (ALBERTO_SKIN_DEFS / AlbertoSkinStore) — same harness as test-skins.js.
// Run with: node scripts/test-alberto-skins.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SKINS_SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'skins.js'), 'utf8');

const EXPORT_TAIL = `
this.__exports = { SKIN_DEFS, SkinStore, ALBERTO_SKIN_DEFS, AlbertoSkinStore, albertoSkinById };
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

// ---------- catalog shape ----------
const ids = sandbox.ALBERTO_SKIN_DEFS.map((s) => s.id);
assert(new Set(ids).size === ids.length, 'every Alberto skin id is unique');
assert(ids[0] === 'normal' && sandbox.ALBERTO_SKIN_DEFS[0].price === 0, 'default Alberto skin is free and first');
assert(
  sandbox.ALBERTO_SKIN_DEFS.every((s) => s.name === 'Alberto' || s.name.startsWith('Alberto ')),
  'every Alberto skin name starts with "Alberto "'
);
const nonFree = sandbox.ALBERTO_SKIN_DEFS.filter((s) => s.id !== 'normal');
assert(new Set(nonFree.map((s) => s.price)).size === nonFree.length, 'every non-free Alberto skin has a distinct price');
assert(
  JSON.stringify(sandbox.ALBERTO_SKIN_DEFS.map((s) => [s.id, s.price])) === JSON.stringify([
    ['normal', 0], ['anjo', 900], ['pijama', 1150], ['cowboy', 1400], ['ninja', 1650],
    ['pirata', 1900], ['vampiro', 2150], ['diabinho', 2400], ['principe', 2700],
  ]),
  'prices match exactly what the project owner specified 2026-09-16'
);
// Note: several ids ARE deliberately reused across catalogs (e.g. both
// have a "pirata"/"ninja"/"pijama"/"anjo") — that's harmless thematic
// naming, not a bug: SKIN_DEFS/SkinStore and ALBERTO_SKIN_DEFS/
// AlbertoSkinStore are fully separate storage keys, and their art lives
// under separate folders (assets/sprites/skins/<id>/ vs
// assets/sprites/skins/alberto/<id>/) so the shared id string never
// makes them read or write the same data.

// ---------- defaults ----------
assert(JSON.stringify(sandbox.AlbertoSkinStore.getUnlocked()) === '["normal"]', 'Alberto starts with only normal unlocked');
assert(sandbox.AlbertoSkinStore.getEquipped() === 'normal', 'Alberto starts with normal equipped');
assert(sandbox.AlbertoSkinStore.isUnlocked('pirata') === false, 'Alberto pirata starts locked');

// ---------- shared coin balance with SkinStore ----------
let res = sandbox.AlbertoSkinStore.purchase('anjo');
assert(res.ok === false && res.reason === 'insufficient-coins', 'Alberto purchase fails with 0 coins');

sandbox.SkinStore.addCoins(900);
assert(sandbox.SkinStore.getCoins() === 900, 'coins credited via the shared SkinStore balance');
res = sandbox.AlbertoSkinStore.purchase('anjo');
assert(res.ok === true, 'Alberto anjo purchase succeeds with enough shared coins');
assert(sandbox.SkinStore.getCoins() === 0, 'purchase deducts from the SAME shared coin balance, not a second one');
assert(sandbox.AlbertoSkinStore.isUnlocked('anjo') === true, 'Alberto anjo unlocked after purchase');

res = sandbox.AlbertoSkinStore.purchase('anjo');
assert(res.ok === false && res.reason === 'already-owned', 'cannot repurchase an owned Alberto skin');

// ---------- independence from Mariana's own wardrobe state ----------
assert(sandbox.SkinStore.getEquipped() === 'normal', "buying/equipping Alberto's anjo never touched Mariana's equipped skin");
assert(sandbox.SkinStore.isUnlocked('anjo') === false, '"anjo" unlocked for Alberto is not also unlocked for Mariana (separate storage keys)');

assert(sandbox.AlbertoSkinStore.setEquipped('pirata') === false, 'cannot equip a locked Alberto skin');
assert(sandbox.AlbertoSkinStore.getEquipped() === 'normal', 'Alberto equipped skin unchanged after rejected equip');
assert(sandbox.AlbertoSkinStore.setEquipped('anjo') === true, 'can equip an owned Alberto skin');
assert(sandbox.AlbertoSkinStore.getEquipped() === 'anjo', 'Alberto equipped skin updates');

// ---------- persistence across reload, and storage-key isolation ----------
const reload = freshSandbox(store);
assert(reload.sandbox.AlbertoSkinStore.getEquipped() === 'anjo', "Alberto's equipped skin persists across reload");
assert(reload.sandbox.AlbertoSkinStore.isUnlocked('anjo') === true, "Alberto's unlocked skins persist across reload");
assert(reload.sandbox.SkinStore.getEquipped() === 'normal', "Mariana's equipped skin is untouched by any of the above");
assert(
  JSON.stringify(Object.keys(store).sort()) === JSON.stringify([
    'marianaRunnerAlbertoEquippedSkin', 'marianaRunnerAlbertoUnlockedSkins', 'marianaRunnerCoins',
  ]),
  'Alberto persists under its own two localStorage keys, distinct from every Mariana key'
);

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log('\nAll Alberto skins.js checks passed.');
