/* =========================================================
   MARIANA RUNNER — conta e save em nuvem (Supabase)

   Regra que orienta o arquivo inteiro: o jogo NÃO sabe que isto
   existe. Nenhum sistema de gameplay, economia ou conquista foi
   alterado para acomodar sincronização — este módulo observa as
   mesmas chaves de localStorage que o jogo já usava antes e as
   espelha na nuvem. Sem conta, sem internet ou com o Supabase fora
   do ar, o jogo continua funcionando exatamente como antes, com o
   save local.

   Fala com o Supabase por fetch direto, sem a biblioteca oficial:
   são só quatro endpoints (cadastro, login, refresh e a linha do
   save), e a biblioteca custaria ~120KB num jogo cujo carregamento
   acabamos de otimizar.
   ========================================================= */

const CLOUD_CONFIG = {
  url: 'https://nygkdacddwvmklrszquy.supabase.co',
  // Chave "publishable": feita para ficar no frontend. Quem a possui só
  // consegue o que as políticas de RLS permitirem — ler e gravar a
  // própria linha, depois de autenticado. Nenhuma chave administrativa
  // aparece aqui.
  key: 'sb_publishable_suIU6KIJq5SUuGrzpyb1jg_2srDicYV',
  // Endereço técnico derivado do nick. O jogador nunca vê isto: existe
  // só porque o Supabase Auth precisa de um identificador com formato
  // de e-mail para login por senha.
  emailDomain: 'marianarunner.local',
};

// As oito chaves que o jogo já persistia antes desta funcionalidade.
// Nomes conferidos um a um em skins.js, achievements.js, audio.js e
// game.js — nada aqui foi inventado.
const CLOUD_KEYS = {
  coins: 'marianaRunnerCoins',
  unlocked: 'marianaRunnerUnlockedSkins',
  equipped: 'marianaRunnerEquippedSkin',
  highScore: 'marianaRunnerHighScore',
  achievements: 'marianaRunnerAchievements',
  lifetimeCoins: 'marianaRunnerLifetimeCoins',
  muted: 'marianaRunnerMuted',
  seenHint: 'marianaRunnerSeenHint',
};
const WATCHED = new Set(Object.values(CLOUD_KEYS));

// Estado da conta neste aparelho. Fica fora de CLOUD_KEYS de propósito:
// é sessão local, não progresso, e portanto nunca vai para a nuvem.
const SESSION_KEY = 'marianaRunnerCloudSession';
const DIRTY_KEY = 'marianaRunnerCloudDirty';
const SYNCED_AT_KEY = 'marianaRunnerCloudSyncedAt';

const PUSH_DELAY_MS = 4000; // agrupa rajadas (moeda a moeda vira 1 request)

const CloudSave = (() => {
  let session = null;      // { accessToken, refreshToken, expiresAt, userId, nick }
  let pushTimer = null;
  let pushing = false;
  let applying = false;    // evita que nossa própria escrita marque "sujo"
  const listeners = [];

  // ---------- utilidades ----------
  function readRaw(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function writeRaw(k, v) {
    try {
      applying = true;
      if (v === null || v === undefined) localStorage.removeItem(k);
      else localStorage.setItem(k, String(v));
    } catch (e) { /* modo privado / cota cheia: o jogo segue sem persistir */ }
    finally { applying = false; }
  }
  function parseList(raw, fallback) {
    try {
      const v = JSON.parse(raw);
      return Array.isArray(v) ? v : fallback;
    } catch (e) { return fallback; }
  }
  function emit() { listeners.forEach((fn) => { try { fn(publicState()); } catch (e) {} }); }

  // ---------- nick ----------
  // "  Mariana  ", "MARIANA" e "mariana" são a mesma conta.
  function normalizeNick(nick) { return String(nick || '').trim().toLowerCase(); }
  function nickIsValid(nick) { return /^[A-Za-z0-9_]{3,20}$/.test(String(nick || '').trim()); }
  function emailForNick(nick) { return `${normalizeNick(nick)}@${CLOUD_CONFIG.emailDomain}`; }

  // ---------- snapshot local ----------
  function snapshot() {
    return {
      coins: Number(readRaw(CLOUD_KEYS.coins) || 0),
      unlocked: parseList(readRaw(CLOUD_KEYS.unlocked), ['normal']),
      equipped: readRaw(CLOUD_KEYS.equipped) || 'normal',
      highScore: Number(readRaw(CLOUD_KEYS.highScore) || 0),
      achievements: parseList(readRaw(CLOUD_KEYS.achievements), []),
      lifetimeCoins: Number(readRaw(CLOUD_KEYS.lifetimeCoins) || 0),
      muted: readRaw(CLOUD_KEYS.muted),
      seenHint: readRaw(CLOUD_KEYS.seenHint),
    };
  }

  // Um save "vazio" é o de quem nunca jogou. Serve para nunca deixar um
  // aparelho recém-instalado sobrescrever uma conta com progresso.
  function isEmpty(s) {
    if (!s) return true;
    return !s.coins && !s.highScore && !s.lifetimeCoins &&
           (s.unlocked || []).filter((id) => id !== 'normal').length === 0 &&
           (s.achievements || []).length === 0;
  }

  function union(a, b) {
    const out = [];
    for (const v of [...(a || []), ...(b || [])]) if (v && !out.includes(v)) out.push(v);
    return out;
  }

  /* Fusão de saves. As regras seguem uma ideia só: nada que o jogador
     conquistou pode sumir por causa de sincronização.
       - recorde e moedas acumuladas: sempre o MAIOR (só crescem)
       - skins e conquistas: UNIÃO (desbloqueio é permanente)
       - saldo e skin equipada: valem os do lado mais recente, porque
         moeda é gasta e equipar é uma troca — mas se os dois lados
         mudaram sem se falar, fica o maior saldo, para o erro pender
         a favor do jogador.
     `localIsNewer` vem de termos ou não alterações locais pendentes
     desde a última sincronização bem-sucedida. */
  function merge(local, cloud, localIsNewer) {
    if (isEmpty(cloud)) return { ...local };          // conta nova: sobe o progresso do aparelho
    if (isEmpty(local)) return { ...cloud };          // aparelho novo: desce a conta inteira

    const unlocked = union(local.unlocked, cloud.unlocked);
    if (!unlocked.includes('normal')) unlocked.unshift('normal');

    const preferred = localIsNewer ? local : cloud;
    let equipped = preferred.equipped;
    if (!unlocked.includes(equipped)) equipped = unlocked.includes(local.equipped) ? local.equipped : 'normal';

    return {
      coins: localIsNewer ? Math.max(local.coins, cloud.coins) : cloud.coins,
      unlocked,
      equipped,
      highScore: Math.max(local.highScore || 0, cloud.highScore || 0),
      achievements: union(local.achievements, cloud.achievements),
      lifetimeCoins: Math.max(local.lifetimeCoins || 0, cloud.lifetimeCoins || 0),
      muted: local.muted !== null ? local.muted : cloud.muted,      // preferência do aparelho
      seenHint: local.seenHint || cloud.seenHint || null,
    };
  }

  // Grava o snapshot no localStorage. Devolve true se algo que o game.js
  // já leu para dentro de si mudou — nesse caso quem chama recarrega a
  // página, que é mais seguro do que tentar reinjetar estado no meio do
  // jogo rodando.
  function applySnapshot(s) {
    const before = snapshot();
    writeRaw(CLOUD_KEYS.coins, s.coins);
    writeRaw(CLOUD_KEYS.unlocked, JSON.stringify(s.unlocked));
    writeRaw(CLOUD_KEYS.equipped, s.equipped);
    writeRaw(CLOUD_KEYS.highScore, s.highScore);
    writeRaw(CLOUD_KEYS.achievements, JSON.stringify(s.achievements));
    writeRaw(CLOUD_KEYS.lifetimeCoins, s.lifetimeCoins);
    if (s.muted !== null && s.muted !== undefined) writeRaw(CLOUD_KEYS.muted, s.muted);
    if (s.seenHint) writeRaw(CLOUD_KEYS.seenHint, s.seenHint);
    return before.coins !== s.coins ||
           before.highScore !== s.highScore ||
           before.equipped !== s.equipped ||
           before.unlocked.length !== s.unlocked.length;
  }

  // ---------- sessão ----------
  function loadSession() {
    try {
      const raw = readRaw(SESSION_KEY);
      session = raw ? JSON.parse(raw) : null;
    } catch (e) { session = null; }
    return session;
  }
  function saveSession(s) {
    session = s;
    if (s) writeRaw(SESSION_KEY, JSON.stringify(s));
    else writeRaw(SESSION_KEY, null);
    emit();
  }

  function publicState() {
    return {
      loggedIn: !!(session && session.accessToken),
      nick: session ? session.nick : null,
      syncing: pushing,
    };
  }

  // ---------- HTTP ----------
  async function api(path, { method = 'GET', body, token, headers } = {}) {
    const res = await fetch(`${CLOUD_CONFIG.url}${path}`, {
      method,
      headers: {
        apikey: CLOUD_CONFIG.key,
        Authorization: `Bearer ${token || CLOUD_CONFIG.key}`,
        'Content-Type': 'application/json',
        ...(headers || {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
    return { ok: res.ok, status: res.status, data };
  }

  function sessionFromAuth(data, nick) {
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (Number(data.expires_in || 3600) * 1000),
      userId: data.user ? data.user.id : (session && session.userId),
      nick,
    };
  }

  // O access token dura cerca de uma hora; o refresh token renova sem
  // pedir a senha de novo. É isto que mantém a pessoa conectada.
  async function ensureFreshToken() {
    if (!session) return null;
    if (Date.now() < session.expiresAt - 60000) return session.accessToken;
    const r = await api('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', body: { refresh_token: session.refreshToken },
    });
    if (!r.ok || !r.data || !r.data.access_token) {
      // Refresh recusado (sessão revogada/expirada): cai para deslogado,
      // sem tocar no save local — o jogo continua com o progresso daqui.
      saveSession(null);
      return null;
    }
    saveSession(sessionFromAuth(r.data, session.nick));
    return session.accessToken;
  }

  // ---------- nuvem ----------
  async function pullRemote(token) {
    const r = await api(`/rest/v1/saves?select=data,updated_at&limit=1`, { token });
    if (!r.ok || !Array.isArray(r.data) || !r.data.length) return null;
    return { data: r.data[0].data || {}, updatedAt: r.data[0].updated_at };
  }

  async function pushRemote(token, snap) {
    // upsert: cria na primeira vez, atualiza depois.
    const r = await api('/rest/v1/saves?on_conflict=user_id', {
      method: 'POST',
      token,
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: [{ user_id: session.userId, nick: session.nick, data: snap }],
    });
    return r;
  }

  function markDirty() {
    if (applying || !session) return;
    writeRaw(DIRTY_KEY, '1');
    schedulePush();
  }

  function schedulePush() {
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => { pushTimer = null; flush(); }, PUSH_DELAY_MS);
  }

  async function flush() {
    if (pushing || !session) return;
    if (readRaw(DIRTY_KEY) !== '1') return;
    pushing = true;
    emit();
    try {
      const token = await ensureFreshToken();
      if (!token) return;
      const r = await pushRemote(token, snapshot());
      if (r.ok) {
        writeRaw(DIRTY_KEY, null);
        const row = Array.isArray(r.data) ? r.data[0] : null;
        if (row && row.updated_at) writeRaw(SYNCED_AT_KEY, row.updated_at);
      }
      // Sem rede: a marca de "sujo" fica, e a próxima oportunidade envia.
    } catch (e) { /* offline */ }
    finally { pushing = false; emit(); }
  }

  // Puxa a nuvem, funde com o local e grava. Devolve se é preciso
  // recarregar para o jogo enxergar os valores novos.
  async function pullAndMerge() {
    const token = await ensureFreshToken();
    if (!token) return { ok: false, reloadNeeded: false };
    let remote = null;
    try { remote = await pullRemote(token); } catch (e) { return { ok: false, reloadNeeded: false }; }

    const local = snapshot();
    const localIsNewer = readRaw(DIRTY_KEY) === '1';
    const merged = merge(local, remote ? remote.data : null, localIsNewer);
    const reloadNeeded = applySnapshot(merged);

    // Devolve o resultado da fusão para a nuvem sempre que ela diferir do
    // que está lá — é isto que faz a migração do save local funcionar.
    const remoteSnap = remote ? remote.data : null;
    if (!remoteSnap || JSON.stringify(remoteSnap) !== JSON.stringify(merged)) {
      writeRaw(DIRTY_KEY, '1');
      await flush();
    } else if (remote) {
      writeRaw(SYNCED_AT_KEY, remote.updatedAt);
    }
    return { ok: true, reloadNeeded };
  }

  // ---------- API pública ----------
  async function signUp(nick, password) {
    const clean = String(nick || '').trim();
    if (!nickIsValid(clean)) return { ok: false, error: 'Nick inválido. Use 3 a 20 caracteres: letras, números ou _' };
    if (String(password || '').length < 6) return { ok: false, error: 'A senha precisa ter pelo menos 6 caracteres.' };

    const r = await api('/auth/v1/signup', {
      method: 'POST', body: { email: emailForNick(clean), password },
    });
    if (!r.ok || !r.data || !r.data.access_token) {
      const msg = (r.data && (r.data.msg || r.data.error_description || r.data.message)) || '';
      if (/already registered|already exists/i.test(msg)) return { ok: false, error: 'Esse nick já está em uso.' };
      if (/weak|password/i.test(msg)) return { ok: false, error: 'Senha muito fraca. Tente outra.' };
      return { ok: false, error: 'Não consegui criar a conta agora. Tente de novo.' };
    }
    saveSession(sessionFromAuth(r.data, clean));
    const res = await pullAndMerge();   // leva o progresso deste aparelho para a conta nova
    return { ok: true, reloadNeeded: res.reloadNeeded };
  }

  async function signIn(nick, password) {
    const clean = String(nick || '').trim();
    if (!clean || !password) return { ok: false, error: 'Preencha nick e senha.' };

    const r = await api('/auth/v1/token?grant_type=password', {
      method: 'POST', body: { email: emailForNick(clean), password },
    });
    if (!r.ok || !r.data || !r.data.access_token) {
      return { ok: false, error: 'Nick ou senha incorretos.' };
    }
    saveSession(sessionFromAuth(r.data, clean));
    const res = await pullAndMerge();
    return { ok: true, reloadNeeded: res.reloadNeeded };
  }

  // Sair encerra a sessão DESTE aparelho. A conta e o save na nuvem
  // permanecem intactos — nada é apagado lá.
  async function signOut() {
    const token = session && session.accessToken;
    if (readRaw(DIRTY_KEY) === '1') { try { await flush(); } catch (e) {} }
    if (token) { try { await api('/auth/v1/logout', { method: 'POST', token }); } catch (e) {} }
    saveSession(null);
    writeRaw(DIRTY_KEY, null);
    writeRaw(SYNCED_AT_KEY, null);
    return { ok: true };
  }

  // Chamado uma vez no boot: restaura a sessão salva e ressincroniza.
  async function init() {
    loadSession();
    installWatcher();
    if (!session) { emit(); return { loggedIn: false, reloadNeeded: false }; }
    emit();
    let reloadNeeded = false;
    try { reloadNeeded = (await pullAndMerge()).reloadNeeded; } catch (e) {}
    return { loggedIn: !!session, reloadNeeded };
  }

  // Observa as mesmas chaves que o jogo já gravava. É o que permite
  // sincronizar sem alterar uma linha de skins.js, achievements.js,
  // audio.js ou game.js.
  function installWatcher() {
    if (installWatcher.done) return;
    installWatcher.done = true;
    const proto = window.Storage && window.Storage.prototype;
    if (!proto || typeof proto.setItem !== 'function') return;
    const original = proto.setItem;
    proto.setItem = function (key, value) {
      original.call(this, key, value);
      if (this === window.localStorage && WATCHED.has(key)) markDirty();
    };
    // Última chance de enviar quando a aba some (trocar de app no
    // celular, fechar o jogo) — o atraso de agrupamento pode estar
    // pendente nesse momento.
    document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
    window.addEventListener('pagehide', () => { flush(); });
  }

  return {
    init, signUp, signIn, signOut, flush,
    state: publicState,
    onChange(fn) { listeners.push(fn); },
    // expostos para teste e para a interface
    normalizeNick, nickIsValid, snapshot, merge, isEmpty,
    KEYS: CLOUD_KEYS,
  };
})();
