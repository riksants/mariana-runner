// Plain-Node logic check for cloud-save.js's Alberto-related additions
// (CLOUD_KEYS.albertoUnlocked/albertoEquipped/playableCharacter, and the
// matching snapshot()/merge()/isEmpty() changes) -- same vm-sandbox
// approach as test-skins.js. Focused entirely on the backward-compat
// contract the task required: an old save/cloud row with NONE of these
// three fields must merge cleanly into safe defaults, never throw, and
// never lose any of the progress it already had.
// Run with: node scripts/test-cloud-save-alberto.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'cloud-save.js'), 'utf8');

// Top-level `const CloudSave = ...` doesn't attach to the vm context object
// on its own (same reason test-skins.js appends its own export tail) --
// make it reachable explicitly.
const EXPORT_TAIL = `
this.__exports = { CloudSave };
`;

function freshSandbox(backingStore) {
  const store = backingStore || {};
  const context = {
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
    console,
  };
  vm.createContext(context);
  vm.runInContext(SRC + EXPORT_TAIL, context, { filename: 'cloud-save.js' });
  return { CloudSave: context.__exports.CloudSave, store };
}

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
  else console.log('ok  :', msg);
}

const { CloudSave } = freshSandbox();

// ---------- snapshot() defaults on an empty device ----------
const emptySnap = CloudSave.snapshot();
assert(emptySnap.albertoUnlocked.length === 1 && emptySnap.albertoUnlocked[0] === 'normal', 'fresh device: albertoUnlocked defaults to ["normal"]');
assert(emptySnap.albertoEquipped === 'normal', 'fresh device: albertoEquipped defaults to "normal"');
assert(emptySnap.playableCharacter === 'mariana', 'fresh device: playableCharacter defaults to "mariana"');

// ---------- the exact scenario the task worried about: an OLD cloud row ----------
// A row written before this feature existed -- literally has no
// albertoUnlocked/albertoEquipped/playableCharacter keys at all, alongside
// real pre-existing progress that must never be lost.
const oldCloudRow = {
  coins: 3200,
  unlocked: ['normal', 'princesa', 'pirata'],
  equipped: 'pirata',
  highScore: 15000,
  achievements: ['first_run', 'all_skins'],
  lifetimeCoins: 9000,
  muted: null,
  seenHint: '1',
  // no albertoUnlocked / albertoEquipped / playableCharacter
};

// A brand-new device has an empty local snapshot, so merge() takes its
// "local has no progress yet, adopt the cloud wholesale" shortcut
// (isEmpty(local) -> return {...cloud}) -- the real pullAndMerge() flow
// then always runs applySnapshot() on whatever merge() returns before the
// game reads anything, so that's the pairing to test here, not merge()
// in isolation (its raw shortcut return can and does carry over cloud's
// missing fields as undefined -- applySnapshot is where every field gets
// a safe default on the way into localStorage).
const localEmpty = CloudSave.snapshot(); // brand-new device, nothing local yet
const merged = CloudSave.merge(localEmpty, oldCloudRow, /* localIsNewer */ false);
const writeTarget = freshSandbox();
writeTarget.CloudSave.applySnapshot(merged);
const freshStore = writeTarget.store;

assert(Number(freshStore.marianaRunnerCoins) === 3200, 'old-row migration: Mariana coins preserved');
assert(JSON.parse(freshStore.marianaRunnerUnlockedSkins).slice().sort().join(',') === 'normal,pirata,princesa', 'old-row migration: Mariana unlocked skins preserved');
assert(freshStore.marianaRunnerEquippedSkin === 'pirata', 'old-row migration: Mariana equipped skin preserved');
assert(Number(freshStore.marianaRunnerHighScore) === 15000, 'old-row migration: high score preserved');
assert(JSON.parse(freshStore.marianaRunnerAchievements).slice().sort().join(',') === 'all_skins,first_run', 'old-row migration: achievements preserved');
assert(Number(freshStore.marianaRunnerLifetimeCoins) === 9000, 'old-row migration: lifetime coins preserved');
assert(freshStore.marianaRunnerAlbertoUnlockedSkins === '["normal"]', 'old-row migration: missing albertoUnlocked defaults to ["normal"] on write, does not throw');
assert(freshStore.marianaRunnerAlbertoEquippedSkin === 'normal', 'old-row migration: missing albertoEquipped defaults to "normal" on write');
assert(freshStore.marianaRunnerPlayableCharacter === 'mariana', 'old-row migration: missing playableCharacter defaults to "mariana" on write');

// ---------- isEmpty() is unaffected by the new fields ----------
assert(CloudSave.isEmpty(oldCloudRow) === false, 'isEmpty still recognizes a real old row as non-empty (unaffected by missing Alberto fields)');
assert(CloudSave.isEmpty({ coins: 0, highScore: 0, lifetimeCoins: 0, unlocked: [], achievements: [] }) === true, 'isEmpty still recognizes a genuinely fresh account');

// ---------- two-sided merge: local device HAS Alberto progress, cloud row (old) does not ----------
const localWithAlberto = {
  ...localEmpty,
  coins: 500,
  albertoUnlocked: ['normal', 'anjo'],
  albertoEquipped: 'anjo',
  playableCharacter: 'alberto',
};
const mergedKeepsLocalAlberto = CloudSave.merge(localWithAlberto, oldCloudRow, /* localIsNewer */ true);
assert(JSON.stringify(mergedKeepsLocalAlberto.albertoUnlocked.slice().sort()) === JSON.stringify(['anjo', 'normal']), "local device's own Alberto unlocks survive merging with an old cloud row that has none");
assert(mergedKeepsLocalAlberto.albertoEquipped === 'anjo', "local device's Alberto equip choice wins when local is the newer side");
assert(mergedKeepsLocalAlberto.playableCharacter === 'alberto', "local device's playable-character choice wins when local is the newer side");
// Mariana's own unlocked-skin UNION still comes through untouched -- the
// old cloud row's "pirata"/"princesa" unlocks merge in alongside local's,
// same union rule Mariana always had, unaffected by Alberto's fields.
assert(JSON.stringify(mergedKeepsLocalAlberto.unlocked.slice().sort()) === JSON.stringify(['normal', 'pirata', 'princesa']), "Mariana's cloud-side unlocked skins still migrate in even though this merge is about Alberto");

// ---------- new-vs-new merge: both sides have Alberto fields, unlocked skins union ----------
const cloudWithAlberto = {
  coins: 1000,
  unlocked: ['normal'],
  equipped: 'normal',
  highScore: 100,
  achievements: [],
  lifetimeCoins: 1000,
  albertoUnlocked: ['normal', 'pirata'],
  albertoEquipped: 'pirata',
  playableCharacter: 'mariana',
};
const bothNew = CloudSave.merge(localWithAlberto, cloudWithAlberto, /* localIsNewer */ false);
assert(JSON.stringify(bothNew.albertoUnlocked.slice().sort()) === JSON.stringify(['anjo', 'normal', 'pirata']), 'Alberto unlocked skins UNION across devices, same rule as Mariana\'s');
assert(bothNew.albertoEquipped === 'pirata', 'equipped-skin tie-break picks the side flagged as newer (cloud here), same rule as Mariana\'s equipped');

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log('\nAll cloud-save.js Alberto-compat checks passed.');
