/* =========================================================
   MARIANA RUNNER — achievement economy (permanent one-time unlocks)
   Pure data + localStorage persistence, no DOM/canvas dependency,
   mirrors js/skins.js so it can be exercised from a plain Node script
   (see scripts/test-achievements.js). game.js never touches these
   localStorage keys directly — it always goes through AchievementStore.
   ========================================================= */

const ACHIEVEMENT_DEFS = [
  { id: 'first_run', name: 'Primeiros Passos', desc: 'Termine sua primeira corrida.' },
  { id: 'streak_10', name: 'Sequência de 10', desc: 'Limpe 10 obstáculos seguidos sem bater.' },
  { id: 'streak_50', name: 'Sequência de 50', desc: 'Limpe 50 obstáculos seguidos sem bater.' },
  { id: 'coins_100', name: 'Colecionadora', desc: 'Colete 100 moedas no total.' },
  { id: 'coins_1000', name: 'Rica', desc: 'Colete 1000 moedas no total.' },
  { id: 'shield_save', name: 'Por um Triz', desc: 'Sobreviva a uma colisão usando um escudo.' },
  { id: 'new_record', name: 'Nova Marca', desc: 'Bata seu recorde pessoal.' },
  { id: 'score_5000', name: 'Maratonista', desc: 'Alcance 5000 pontos em uma corrida.' },
  { id: 'all_skins', name: 'Guarda-Roupa Cheia', desc: 'Desbloqueie todas as skins.' },
];

const ACHIEVEMENT_STORAGE_KEYS = {
  unlocked: 'marianaRunnerAchievements',
  lifetimeCoins: 'marianaRunnerLifetimeCoins',
};

function achievementById(id) {
  return ACHIEVEMENT_DEFS.find((a) => a.id === id);
}

const AchievementStore = {
  getUnlocked() {
    try {
      const raw = JSON.parse(localStorage.getItem(ACHIEVEMENT_STORAGE_KEYS.unlocked) || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch (e) {
      return [];
    }
  },
  isUnlocked(id) {
    return this.getUnlocked().includes(id);
  },
  // Returns true only the first time an id is unlocked — repeat calls for
  // an already-unlocked achievement are safe no-ops, so call sites never
  // need their own "have I already checked this" guard.
  unlock(id) {
    if (this.isUnlocked(id)) return false;
    const list = this.getUnlocked();
    list.push(id);
    localStorage.setItem(ACHIEVEMENT_STORAGE_KEYS.unlocked, JSON.stringify(list));
    return true;
  },
  getLifetimeCoins() {
    return Number(localStorage.getItem(ACHIEVEMENT_STORAGE_KEYS.lifetimeCoins) || 0);
  },
  // Lifetime coins only ever grows — unlike SkinStore's spendable balance,
  // which drops when a skin is purchased, this tracks total coins ever
  // collected across all runs, for the coins_100/coins_1000 milestones.
  addLifetimeCoins(amount) {
    const next = this.getLifetimeCoins() + amount;
    localStorage.setItem(ACHIEVEMENT_STORAGE_KEYS.lifetimeCoins, String(next));
    return next;
  },
};
