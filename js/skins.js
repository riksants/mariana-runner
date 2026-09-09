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
  { id: 'praia',    name: 'Mariana Praia',    price: 700,  icon: 'sun' },
  { id: 'mini',     name: 'Mariana Mini',     price: 800,  icon: 'tinystar' },
  { id: 'kawaii',   name: 'Mariana Kawaii',   price: 950,  icon: 'ribbon' },
  { id: 'volei',    name: 'Mariana Vôlei',    price: 1000, icon: 'volleyball' },
  { id: 'chef',     name: 'Mariana Chef',     price: 1100, icon: 'chefhat' },
  { id: 'cupido',   name: 'Mariana Cupido',   price: 1350, icon: 'heartarrow' },
  { id: 'pijama',   name: 'Mariana Pijama',   price: 1500, icon: 'moon' },
  { id: 'vampira',  name: 'Mariana Vampira',  price: 1600, icon: 'fang' },
  { id: 'fada',     name: 'Mariana Fada',     price: 1700, icon: 'wand' },
  { id: 'gotica',   name: 'Mariana Gótica',   price: 1900, icon: 'bat' },
  { id: 'arabe',    name: 'Mariana Árabe',    price: 2050, icon: 'lamp' },
  { id: 'gatinha',  name: 'Mariana Gatinha',  price: 2150, icon: 'pawprint' },
  { id: 'macaca',   name: 'Mariana Macaca',   price: 2500, icon: 'monkey' },
  { id: 'professora', name: 'Mariana Professora', price: 1200, icon: 'book' },
  { id: 'retro',    name: 'Mariana 8-Bits',   price: 1250, icon: 'pixel' },
  { id: 'cowgirl',  name: 'Mariana Cowgirl',  price: 2200, icon: 'sheriffstar' },
  { id: 'sakura',   name: 'Mariana Sakura',   price: 2300, icon: 'blossom' },
  { id: 'bruxa',    name: 'Mariana Bruxa',    price: 2450, icon: 'witchhat' },
  { id: 'pirata',   name: 'Mariana Pirata',   price: 2600, icon: 'skull' },
  { id: 'heroina',  name: 'Mariana Heroína',  price: 2750, icon: 'bolt' },
  { id: 'gold',     name: 'Mariana Gold',     price: 3000, icon: 'gem' },
  { id: 'diabinha', name: 'Mariana Diabinha', price: 3250, icon: 'devilhorns' },
  { id: 'boneca',   name: 'Mariana Boneca',   price: 3400, icon: 'doll' },
  { id: 'fenix',    name: 'Mariana Fênix',    price: 3600, icon: 'flame' },
  { id: 'ninja',    name: 'Mariana Ninja',    price: 4000, icon: 'shuriken' },
  { id: 'coelhinha', name: 'Mariana Coelhinha', price: 4300, icon: 'bunny' },
  { id: 'anjo',     name: 'Mariana Anjo',     price: 4850, icon: 'halo' },
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
// Gap widened 2026-09-06 (was 90/70, ~125 avg): the gap is a *distance*
// threshold that the game already scales by speed every frame
// (distanceSinceLastCoinCluster += speed * dt), so at max speed the old
// ~125 average worked out to ~17-18 coins/second on screen — a
// continuous field of independently-bobbing shapes that was both hard to
// read past and, per a visual-fatigue review, itself a contributor to
// eye strain from constant diffuse motion. Doubling the average gap
// roughly halves the coin rate at every speed (game speed and cluster
// size are untouched) while keeping coins "common" as designed.
const COIN_CLUSTER_SIZE = 3;
const COIN_CLUSTER_GAP_BASE = 180;
const COIN_CLUSTER_GAP_VARIANCE = 140;

function rollCoinClusterGap() {
  return COIN_CLUSTER_GAP_BASE + Math.random() * COIN_CLUSTER_GAP_VARIANCE;
}
