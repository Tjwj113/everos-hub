// Scroll film: draws the video frame that matches the scroll position.
(() => {
  // Phones get the vertical film; each film has its own length, background and step frames.
  const FILMES = {
    vertical: { pasta: 'vertical', total: 240, fundo: '#F5F0E5', etapas: [48, 108, 184], ocultarTrilha: 226, seguir: 228 },
    desktop: { pasta: 'desktop', total: 437, fundo: '#F9F9F1', etapas: [58, 146, 290], ocultarTrilha: 368, seguir: 400 },
  };
  const celular = window.matchMedia('(max-width: 699px)');

  const secao = document.querySelector('.filme');
  const tela = document.querySelector('.filme__tela');
  const ctx = tela.getContext('2d');
  const legendas = [...document.querySelectorAll('.legenda')];
  const etapas = [...document.querySelectorAll('.trilha li')];
  const trilha = document.querySelector('.trilha');
  const seguir = document.querySelector('.filme__seguir');

  let vertical, filme, TOTAL, quadros, prontos, ordem, fila, geracao = 0;
  let atual = 0;
  let pedido = false;

  const caminho = (i) => `frames/${filme.pasta}/frame_${String(i + 1).padStart(4, '0')}.webp`;

  // Picks the film for the current width and starts loading it.
  // Loads still running for the previous film are ignored through `geracao`.
  const escolherFilme = () => {
    vertical = celular.matches;
    filme = vertical ? FILMES.vertical : FILMES.desktop;
    TOTAL = filme.total;
    quadros = new Array(TOTAL);
    prontos = new Uint8Array(TOTAL);
    atual = -1;
    geracao++;

    // Load a sparse set first so scrubbing works early, then fill the gaps.
    ordem = [];
    for (const passo of [32, 8, 2, 1]) {
      for (let i = 0; i < TOTAL; i += passo) if (!ordem.includes(i)) ordem.push(i);
    }
    fila = 0;
    for (let n = 0; n < 6; n++) carregarProximo(geracao);
  };

  const carregarProximo = (minha) => {
    if (minha !== geracao || fila >= ordem.length) return;
    const i = ordem[fila++];
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      if (minha !== geracao) return;
      quadros[i] = img; prontos[i] = 1;
      if (Math.abs(i - atual) < 40) agendar();
      carregarProximo(minha);
    };
    img.onerror = () => carregarProximo(minha);
    img.src = caminho(i);
  };

  const maisProximo = (i) => {
    for (let d = 0; d < TOTAL; d++) {
      if (i - d >= 0 && prontos[i - d]) return i - d;
      if (i + d < TOTAL && prontos[i + d]) return i + d;
    }
    return -1;
  };

  const ajustarTela = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = tela.getBoundingClientRect();
    tela.width = Math.round(r.width * dpr);
    tela.height = Math.round(r.height * dpr);
    agendar();
  };

  const desenhar = () => {
    pedido = false;
    const i = maisProximo(Math.max(0, atual));
    if (i < 0) return;
    const img = quadros[i];
    const W = tela.width, H = tela.height;
    // "contain" so nothing in the scene is cropped
    const escala = Math.min(W / img.naturalWidth, H / img.naturalHeight);
    const w = img.naturalWidth * escala, h = img.naturalHeight * escala;
    ctx.fillStyle = filme.fundo;
    ctx.fillRect(0, 0, W, H);
    // The vertical film sits on the bottom edge, so the spare space stays on top for the captions.
    const y = vertical ? H - h : (H - h) / 2;
    ctx.drawImage(img, (W - w) / 2, y, w, h);
  };
  const agendar = () => { if (!pedido) { pedido = true; requestAnimationFrame(desenhar); } };

  // The shown frame eases toward the scroll target, so the film glides instead of jumping.
  const suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let alvo = 0, mostrado = 0, animando = false;

  const passo = () => {
    const dif = alvo - mostrado;
    mostrado = Math.abs(dif) < 0.5 ? alvo : mostrado + dif * 0.12;
    mostrarQuadro(Math.round(mostrado));
    if (mostrado !== alvo) requestAnimationFrame(passo); else animando = false;
  };

  const progresso = () => {
    const r = secao.getBoundingClientRect();
    const percurso = secao.offsetHeight - window.innerHeight;
    return Math.min(1, Math.max(0, -r.top / percurso));
  };

  const atualizar = () => {
    alvo = progresso() * (TOTAL - 1);
    if (!suave) { mostrado = alvo; mostrarQuadro(Math.round(alvo)); return; }
    if (!animando) { animando = true; requestAnimationFrame(passo); }
  };

  const mostrarQuadro = (quadro) => {
    if (quadro !== atual) { atual = quadro; agendar(); }

    legendas.forEach((el) => {
      // Phone ranges come from data-m-*; if they are missing, scale the desktop ranges.
      const escala = (TOTAL - 1) / (FILMES.desktop.total - 1);
      const faixa = (m, d) => (vertical ? (m !== undefined ? +m : Math.round(+d * escala)) : +d);
      const de = faixa(el.dataset.mDe, el.dataset.de);
      const ate = faixa(el.dataset.mAte, el.dataset.ate);
      el.classList.toggle('visivel', quadro >= de && quadro <= ate);
    });

    const etapa = filme.etapas.filter((inicio) => quadro >= inicio).length;
    etapas.forEach((li, n) => li.classList.toggle('ativa', n === etapa));
    trilha.classList.toggle('oculta', quadro >= filme.ocultarTrilha);
    seguir.classList.toggle('visivel', quadro >= filme.seguir);
  };

  // Crossing the phone width swaps the film and keeps the same point in the story.
  const trocarFilme = () => {
    const p = progresso();
    escolherFilme();
    alvo = mostrado = p * (TOTAL - 1);
    ajustarTela();
    mostrarQuadro(Math.round(mostrado));
  };
  // Older Safari (iOS 13 and earlier) only has addListener.
  if (celular.addEventListener) celular.addEventListener('change', trocarFilme);
  else if (celular.addListener) celular.addListener(trocarFilme);

  window.addEventListener('scroll', atualizar, { passive: true });
  window.addEventListener('resize', () => { ajustarTela(); atualizar(); });
  escolherFilme();
  ajustarTela();
  atualizar();
})();
