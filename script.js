// Scroll film: draws the video frame that matches the scroll position.
(() => {
  const TOTAL = 437;
  const secao = document.querySelector('.filme');
  const tela = document.querySelector('.filme__tela');
  const ctx = tela.getContext('2d');
  const legendas = [...document.querySelectorAll('.legenda')];
  const etapas = [...document.querySelectorAll('.trilha li')];
  const trilha = document.querySelector('.trilha');
  const seguir = document.querySelector('.filme__seguir');

  const pasta = window.matchMedia('(max-width: 699px)').matches ? 'mobile' : 'desktop';
  const caminho = (i) => `frames/${pasta}/frame_${String(i + 1).padStart(4, '0')}.webp`;

  const quadros = new Array(TOTAL);
  const prontos = new Uint8Array(TOTAL);
  let atual = 0;
  let pedido = false;

  // Load a sparse set first so scrubbing works early, then fill the gaps.
  const ordem = [];
  for (let passo of [32, 8, 2, 1]) {
    for (let i = 0; i < TOTAL; i += passo) if (!ordem.includes(i)) ordem.push(i);
  }
  let fila = 0;
  const carregarProximo = () => {
    if (fila >= ordem.length) return;
    const i = ordem[fila++];
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      quadros[i] = img; prontos[i] = 1;
      if (Math.abs(i - atual) < 40) agendar();
      carregarProximo();
    };
    img.onerror = carregarProximo;
    img.src = caminho(i);
  };
  for (let n = 0; n < 6; n++) carregarProximo();

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
    const i = maisProximo(atual);
    if (i < 0) return;
    const img = quadros[i];
    const W = tela.width, H = tela.height;
    // "contain" so nothing in the scene is cropped
    const escala = Math.min(W / img.naturalWidth, H / img.naturalHeight);
    const w = img.naturalWidth * escala, h = img.naturalHeight * escala;
    ctx.fillStyle = '#F9F9F1';
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
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

  const atualizar = () => {
    const r = secao.getBoundingClientRect();
    const percurso = secao.offsetHeight - window.innerHeight;
    const p = Math.min(1, Math.max(0, -r.top / percurso));
    alvo = p * (TOTAL - 1);
    if (!suave) { mostrado = alvo; mostrarQuadro(Math.round(alvo)); return; }
    if (!animando) { animando = true; requestAnimationFrame(passo); }
  };

  const mostrarQuadro = (quadro) => {
    if (quadro !== atual) { atual = quadro; agendar(); }

    legendas.forEach((el) => {
      const de = +el.dataset.de, ate = +el.dataset.ate;
      el.classList.toggle('visivel', quadro >= de && quadro <= ate);
    });

    let etapa = 0;
    if (quadro >= 290) etapa = 3; else if (quadro >= 146) etapa = 2; else if (quadro >= 58) etapa = 1;
    etapas.forEach((li, n) => li.classList.toggle('ativa', n === etapa));
    trilha.classList.toggle('oculta', quadro >= 368);
    seguir.classList.toggle('visivel', quadro >= 400);
  };

  window.addEventListener('scroll', atualizar, { passive: true });
  window.addEventListener('resize', () => { ajustarTela(); atualizar(); });
  ajustarTela();
  atualizar();
})();
