/* =========================================================
   MARIANA RUNNER — skin economy (coins, unlocks, equipped skin)
   Pure data + localStorage persistence, no DOM/canvas dependency,
   so it can be exercised from a plain Node script (see
   scripts/test-skins.js). game.js never touches these localStorage
   keys directly — it always goes through SkinStore.
   ========================================================= */

const SKIN_DEFS = [
  { id: 'normal',   name: 'Mariana',          price: 0,    icon: 'normal' },
  { id: 'princesa', name: 'Mariana Princesa', price: 500,  icon: 'crown' },
  { id: 'volei',    name: 'Mariana Vôlei',    price: 1000, icon: 'volleyball' },
  { id: 'pijama',   name: 'Mariana Pijama',   price: 1500, icon: 'moon' },
  { id: 'macaca',   name: 'Mariana Macaca',   price: 2500, icon: 'monkey' },
  { id: 'gold',     name: 'Mariana Gold',     price: 3000, icon: 'gem' },
  { id: 'noiva',    name: 'Mariana Noiva',    price: 5000, icon: 'ring', special: true },
];

const SKIN_STORAGE_KEYS = {
  coins: 'marianaRunnerCoins',
  unlocked: 'marianaRunnerUnlockedSkins',
  equipped: 'marianaRunnerEquippedSkin',
};

function skinById(id) {
  return SKIN_DEFS.find((s) => s.id === id) || SKIN_DEFS[0];
}

const SkinStore = {
  getCoins() {
    return Number(localStorage.getItem(SKIN_STORAGE_KEYS.coins) || 0);
  },
  addCoins(amount) {
    const next = this.getCoins() + amount;
    localStorage.setItem(SKIN_STORAGE_KEYS.coins, String(next));
    return next;
  },
  getUnlocked() {
    try {
      const raw = JSON.parse(localStorage.getItem(SKIN_STORAGE_KEYS.unlocked) || '["normal"]');
      return Array.isArray(raw) && raw.length ? raw : ['normal'];
    } catch (e) {
      return ['normal'];
    }
  },
  isUnlocked(id) {
    return this.getUnlocked().includes(id);
  },
  unlock(id) {
    const list = this.getUnlocked();
    if (!list.includes(id)) list.push(id);
    localStorage.setItem(SKIN_STORAGE_KEYS.unlocked, JSON.stringify(list));
  },
  getEquipped() {
    const id = localStorage.getItem(SKIN_STORAGE_KEYS.equipped) || 'normal';
    return this.isUnlocked(id) ? id : 'normal';
  },
  setEquipped(id) {
    if (!this.isUnlocked(id)) return false;
    localStorage.setItem(SKIN_STORAGE_KEYS.equipped, id);
    return true;
  },
  // Never throws — UI code calls this directly and branches on the result.
  purchase(id) {
    const skin = skinById(id);
    if (this.isUnlocked(id)) return { ok: false, reason: 'already-owned' };
    if (this.getCoins() < skin.price) return { ok: false, reason: 'insufficient-coins' };
    this.addCoins(-skin.price);
    this.unlock(id);
    return { ok: true };
  },
};

// Coin cluster economy — see docs/superpowers/specs/2026-09-05-wardrobe-skins-design.md
// "Coin economy" section for how these numbers were derived. Retune here only.
const COIN_CLUSTER_SIZE = 3;
const COIN_CLUSTER_GAP_BASE = 90;
const COIN_CLUSTER_GAP_VARIANCE = 70;

function rollCoinClusterGap() {
  return COIN_CLUSTER_GAP_BASE + Math.random() * COIN_CLUSTER_GAP_VARIANCE;
}
