/* =========================================================
   MARIANA RUNNER — tela de conta (entrar / criar conta / sair)

   Só DOM. Toda a lógica de autenticação, fusão e sincronização mora
   em js/cloud-save.js; aqui não existe nenhuma regra de jogo, nem
   acesso a moedas, skins ou pontuação. O jogo não chama este arquivo
   e não sabe que ele existe.
   ========================================================= */

(function () {
  'use strict';

  const overlay = document.getElementById('overlay-account');
  const form = document.getElementById('account-form');
  const titleEl = document.getElementById('account-title');
  const nickInput = document.getElementById('account-nick-input');
  const passInput = document.getElementById('account-pass-input');
  const confirmField = document.getElementById('account-confirm-field');
  const confirmInput = document.getElementById('account-confirm-input');
  const msgEl = document.getElementById('account-msg');
  const submitBtn = document.getElementById('btn-account-submit');
  const toggleBtn = document.getElementById('btn-account-toggle');
  const backBtn = document.getElementById('btn-account-back');

  const openBtn = document.getElementById('btn-account');
  const signedBox = document.getElementById('account-signed');
  const nickLabel = document.getElementById('account-nick');
  const signOutBtn = document.getElementById('btn-signout');

  if (!overlay || !openBtn) return;

  let mode = 'signin'; // 'signin' | 'signup'
  let busy = false;

  function setMessage(text, kind) {
    msgEl.textContent = text || '';
    msgEl.className = 'account-msg' + (kind ? ' account-msg--' + kind : '');
  }

  function setMode(next) {
    mode = next;
    const creating = mode === 'signup';
    titleEl.textContent = creating ? 'CRIAR CONTA' : 'ENTRAR';
    submitBtn.textContent = creating ? 'CRIAR CONTA' : 'ENTRAR';
    toggleBtn.textContent = creating ? 'JÁ TENHO CONTA' : 'CRIAR UMA CONTA';
    confirmField.hidden = !creating;
    confirmInput.required = creating;
    setMessage('');
  }

  function setBusy(on) {
    busy = on;
    submitBtn.disabled = on;
    toggleBtn.disabled = on;
    backBtn.disabled = on;
    if (on) setMessage(mode === 'signup' ? 'Criando conta…' : 'Entrando…');
  }

  function openOverlay() {
    setMode('signin');
    nickInput.value = '';
    passInput.value = '';
    confirmInput.value = '';
    overlay.hidden = false;
    nickInput.focus();
  }

  function closeOverlay() {
    overlay.hidden = true;
    setBusy(false);
  }

  // Reflete o estado da conta na tela inicial: ou o convite para entrar,
  // ou o nick conectado com a opção discreta de sair.
  function renderState(state) {
    const on = state && state.loggedIn;
    openBtn.hidden = !!on;
    signedBox.hidden = !on;
    if (on) nickLabel.textContent = state.nick || '';
    signOutBtn.textContent = state.syncing ? 'SALVANDO…' : 'SAIR';
    signOutBtn.disabled = !!state.syncing;
  }

  // Depois de entrar ou criar conta, o progresso pode ter mudado. O
  // game.js leu moedas e recorde para variáveis próprias quando abriu,
  // então recarregar é a forma segura de ele enxergar os valores novos —
  // e só acontece quando algo realmente mudou.
  function finish(result) {
    if (!result.ok) {
      setBusy(false);
      setMessage(result.error || 'Não deu certo. Tente de novo.', 'error');
      return;
    }
    if (result.reloadNeeded) {
      setMessage('Progresso restaurado! Recarregando…', 'ok');
      setTimeout(() => window.location.reload(), 700);
      return;
    }
    setBusy(false);
    closeOverlay();
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (busy) return;
    const nick = nickInput.value.trim();
    const pass = passInput.value;

    if (mode === 'signup') {
      if (!CloudSave.nickIsValid(nick)) {
        setMessage('Nick inválido. Use 3 a 20 caracteres: letras, números ou _', 'error');
        return;
      }
      if (pass.length < 6) {
        setMessage('A senha precisa ter pelo menos 6 caracteres.', 'error');
        return;
      }
      if (pass !== confirmInput.value) {
        setMessage('As senhas não são iguais.', 'error');
        return;
      }
      setBusy(true);
      CloudSave.signUp(nick, pass).then(finish).catch(() => finish({ ok: false }));
      return;
    }

    if (!nick || !pass) {
      setMessage('Preencha nick e senha.', 'error');
      return;
    }
    setBusy(true);
    CloudSave.signIn(nick, pass).then(finish).catch(() => finish({ ok: false }));
  });

  toggleBtn.addEventListener('click', () => setMode(mode === 'signup' ? 'signin' : 'signup'));
  backBtn.addEventListener('click', closeOverlay);

  // A tela inicial inteira é "toque para jogar" (game.js liga um clique na
  // overlay toda). Como estes dois botões moram dentro dela, o clique
  // precisa parar aqui — senão abrir a conta também começaria uma partida
  // por trás da tela de login.
  openBtn.addEventListener('click', (e) => { e.stopPropagation(); openOverlay(); });
  signOutBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (busy) return;
    // Sair encerra a sessão deste aparelho. A conta e o save na nuvem
    // continuam lá, e o progresso segue no aparelho também.
    CloudSave.signOut().then(() => renderState(CloudSave.state()));
  });

  // Enquanto a tela de conta está aberta, o teclado é dela. Sem isto o
  // Espaço faria a Mariana pular (e não entraria na senha), e Escape
  // pausaria o jogo por baixo. Captura na janela para rodar antes dos
  // atalhos do jogo, sem precisar alterar game.js.
  window.addEventListener('keydown', (e) => {
    if (overlay.hidden) return;
    e.stopPropagation();
    if (e.code === 'Escape') { e.preventDefault(); if (!busy) closeOverlay(); }
  }, true);

  CloudSave.onChange(renderState);
  renderState(CloudSave.state());

  // Restaura a sessão salva e ressincroniza no boot.
  CloudSave.init().then((res) => {
    renderState(CloudSave.state());
    if (res && res.reloadNeeded) window.location.reload();
  }).catch(() => {});
})();
