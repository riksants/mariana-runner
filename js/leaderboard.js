/* =========================================================
   MARIANA RUNNER — ranking global

   Só DOM e duas leituras. Este arquivo NÃO envia pontuação: o
   recorde já viaja dentro do save normal (js/cloud-save.js), e um
   gatilho no banco alimenta o ranking a partir dele. Por isso não
   existe botão de "enviar pontuação", e por isso o jogo não precisa
   saber que este arquivo existe — game.js não é tocado.

   As duas funções do banco devolvem apenas posição, nick e recorde.
   Nenhum identificador, save, moeda, skin ou conquista passa por
   aqui, nem poderia: a tabela em si é inacessível pela API.
   ========================================================= */

(function () {
  'use strict';

  const overlay = document.getElementById('overlay-ranking');
  const openBtn = document.getElementById('btn-ranking');
  const backBtn = document.getElementById('btn-ranking-back');
  const listEl = document.getElementById('ranking-list');
  const msgEl = document.getElementById('ranking-msg');
  const meEl = document.getElementById('ranking-me');

  if (!overlay || !openBtn || typeof CloudSave === 'undefined') return;

  const TOP = 10;
  const MEDALHAS = ['🥇', '🥈', '🥉'];
  let carregando = false;

  const formatar = (n) => Number(n || 0).toLocaleString('pt-BR');

  function mensagem(texto) {
    msgEl.textContent = texto || '';
    msgEl.hidden = !texto;
  }

  // Monta a linha por nó, nunca por innerHTML: o nick vem do banco e
  // vai para a tela como texto, jamais como marcação.
  function linha(item, ehVoce) {
    const li = document.createElement('li');
    li.className = 'rank-row' + (ehVoce ? ' rank-row--me' : '');

    const pos = document.createElement('span');
    const medalha = MEDALHAS[item.posicao - 1];
    pos.className = 'rank-pos' + (medalha ? ' rank-pos--medal' : '');
    pos.textContent = medalha || item.posicao + '.';

    const nick = document.createElement('span');
    nick.className = 'rank-nick';
    nick.textContent = item.nick;

    const score = document.createElement('span');
    score.className = 'rank-score';
    score.textContent = formatar(item.high_score);

    li.append(pos, nick, score);
    return li;
  }

  function limpar() {
    while (listEl.firstChild) listEl.removeChild(listEl.firstChild);
    meEl.hidden = true;
    while (meEl.firstChild) meEl.removeChild(meEl.firstChild);
  }

  function renderMinhaPosicao(eu) {
    const rotulo = document.createElement('span');
    rotulo.className = 'rank-me-label';
    rotulo.textContent = 'SUA POSIÇÃO';
    const ul = document.createElement('ul');
    ul.className = 'rank-list';
    ul.appendChild(linha({ posicao: eu.posicao, nick: eu.nick, high_score: eu.high_score }, true));
    meEl.append(rotulo, ul);
    meEl.hidden = false;
  }

  async function carregar() {
    if (carregando) return;
    carregando = true;
    limpar();
    mensagem('Carregando…');

    const logado = CloudSave.state().loggedIn;
    let topo = null;
    let eu = null;

    try {
      const r = await CloudSave.rpc('leaderboard_top', { p_limit: TOP });
      if (!r.ok || !Array.isArray(r.data)) throw new Error('sem resposta');
      topo = r.data;
      if (logado) {
        // Falha aqui não estraga o painel: o Top 10 já está em mãos.
        try {
          const m = await CloudSave.rpc('leaderboard_me', {}, { auth: true });
          if (m.ok && Array.isArray(m.data) && m.data.length) eu = m.data[0];
        } catch (e) { /* segue sem a linha pessoal */ }
      }
    } catch (e) {
      carregando = false;
      mensagem(navigator.onLine === false
        ? 'Ranking indisponível offline.'
        : 'Não consegui carregar o ranking agora.');
      return;
    }

    if (!topo.length) {
      mensagem('Ninguém no ranking ainda. Seja a primeira!');
      carregando = false;
      return;
    }

    const noTopo = eu && eu.posicao <= TOP;
    topo.forEach((item) => listEl.appendChild(linha(item, !!(eu && item.posicao === eu.posicao && noTopo))));

    if (eu && !noTopo) renderMinhaPosicao(eu);
    if (!logado) mensagem('Entre na sua conta para aparecer no ranking.');
    else if (!eu) mensagem('Jogue uma partida para entrar no ranking.');
    else mensagem('');

    carregando = false;
  }

  function abrir() {
    overlay.hidden = false;
    carregar();
  }

  function fechar() {
    overlay.hidden = true;
  }

  // A tela inicial inteira é "toque para jogar" (game.js liga um clique na
  // overlay toda). Como este botão mora dentro dela, o clique precisa
  // parar aqui — senão abrir o ranking também começaria uma partida por
  // trás do painel. Mesmo motivo dos botões de conta.
  openBtn.addEventListener('click', (e) => { e.stopPropagation(); abrir(); });
  backBtn.addEventListener('click', (e) => { e.stopPropagation(); fechar(); });
  overlay.addEventListener('click', (e) => e.stopPropagation());

  // Enquanto o painel está aberto, Escape fecha ele em vez de pausar o
  // jogo por baixo. Captura na janela para rodar antes dos atalhos do
  // jogo, sem precisar alterar game.js.
  window.addEventListener('keydown', (e) => {
    if (overlay.hidden) return;
    e.stopPropagation();
    if (e.code === 'Escape') { e.preventDefault(); fechar(); }
  }, true);
})();
