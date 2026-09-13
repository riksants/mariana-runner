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
  const podioEl = document.getElementById('ranking-podio');
  const msgEl = document.getElementById('ranking-msg');
  const meEl = document.getElementById('ranking-me');
  const frame = document.getElementById('game-frame');

  if (!overlay || !openBtn || typeof CloudSave === 'undefined') return;

  const TOP = 10;
  const PODIO = 3;   // quantos sobem no pódio; do quarto em diante vira lista
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
    pos.className = 'rank-pos';
    pos.textContent = item.posicao;

    const nick = document.createElement('span');
    nick.className = 'rank-nick';
    nick.textContent = item.nick;

    const score = document.createElement('span');
    score.className = 'rank-score';
    score.textContent = formatar(item.high_score);

    li.append(pos, nick, score);
    return li;
  }

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const CROA = 'M3 6l5 4 4-6 4 6 5-4-1.6 9H4.6L3 6zm1.6 11h14.8v3H4.6z';
  // Ramo de louro: um talo curvo com quatro folhas. Desenhado uma vez e
  // espelhado por CSS para virar o par que ladeia o número.
  const LOURO = [
    ['path', { d: 'M17 22.5C9.5 20 5.6 13.8 7.1 4.5', fill: 'none', 'stroke-width': '2.2', 'stroke-linecap': 'round' }],
    ['ellipse', { cx: 7.1, cy: 7.6, rx: 3.4, ry: 1.9, transform: 'rotate(-44 7.1 7.6)' }],
    ['ellipse', { cx: 8.3, cy: 12.1, rx: 3.6, ry: 2, transform: 'rotate(-26 8.3 12.1)' }],
    ['ellipse', { cx: 10.8, cy: 16.3, rx: 3.7, ry: 2, transform: 'rotate(-8 10.8 16.3)' }],
    ['ellipse', { cx: 14.5, cy: 19.8, rx: 3.5, ry: 2, transform: 'rotate(13 14.5 19.8)' }],
  ];

  function svg(classe, filhos) {
    const el = document.createElementNS(SVG_NS, 'svg');
    el.setAttribute('viewBox', '0 0 24 24');
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('class', classe);
    filhos.forEach(([tag, attrs]) => {
      const f = document.createElementNS(SVG_NS, tag);
      Object.entries(attrs).forEach(([k, v]) => f.setAttribute(k, v));
      el.appendChild(f);
    });
    return el;
  }

  // Um degrau do pódio: coroa, nick e pontuação por cima; o bloco com
  // face superior mais clara e o número entre dois ramos de louro.
  // A altura vem da classe, não de cálculo.
  function degrau(item, ehVoce) {
    const div = document.createElement('div');
    div.className = `podio-lugar podio-lugar--${item.posicao}` + (ehVoce ? ' podio-lugar--me' : '');

    const nick = document.createElement('span');
    nick.className = 'podio-nick';
    nick.textContent = item.nick;

    const score = document.createElement('span');
    score.className = 'podio-score';
    score.textContent = formatar(item.high_score);

    const bloco = document.createElement('div');
    bloco.className = 'podio-bloco';
    const topo = document.createElement('span');
    topo.className = 'podio-topo';
    const face = document.createElement('span');
    face.className = 'podio-face';
    const num = document.createElement('span');
    num.className = 'podio-num';
    num.textContent = item.posicao;
    face.append(svg('podio-louro', LOURO), num, svg('podio-louro podio-louro--dir', LOURO));
    bloco.append(topo, face);

    div.append(svg('podio-coroa', [['path', { d: CROA }]]), nick, score, bloco);
    return div;
  }

  // Ordem VISUAL do pódio: segundo à esquerda, primeiro no meio, terceiro
  // à direita. Com menos de três jogadores os buracos somem e o que
  // sobra continua centralizado.
  function montarPodio(tres, euPos) {
    [tres[1], tres[0], tres[2]]
      .filter(Boolean)
      .forEach((item) => podioEl.appendChild(degrau(item, item.posicao === euPos)));
  }

  function limpar() {
    while (listEl.firstChild) listEl.removeChild(listEl.firstChild);
    while (podioEl.firstChild) podioEl.removeChild(podioEl.firstChild);
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
    const euPos = noTopo ? eu.posicao : -1;
    montarPodio(topo.slice(0, PODIO), euPos);
    topo.slice(PODIO).forEach((item) => listEl.appendChild(linha(item, item.posicao === euPos)));

    if (eu && !noTopo) renderMinhaPosicao(eu);
    if (!logado) mensagem('Entre na sua conta para aparecer no ranking.');
    else if (!eu) mensagem('Jogue uma partida para entrar no ranking.');
    else mensagem('');

    carregando = false;
  }

  // A marca no frame esconde o menu inicial enquanto o painel está
  // aberto. É só visibilidade: o menu volta intacto ao fechar, e assim o
  // Deserto que o próprio jogo já desenha no canvas (nuvens, montanhas,
  // chão, Mariana e o gato) aparece atrás do ranking, sem nenhum cenário
  // novo e sem nenhuma linha em game.js.
  function abrir() {
    if (frame) frame.classList.add('is-ranking-open');
    overlay.hidden = false;
    carregar();
  }

  function fechar() {
    overlay.hidden = true;
    if (frame) frame.classList.remove('is-ranking-open');
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
