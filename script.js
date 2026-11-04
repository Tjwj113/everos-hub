// Scroll film: draws the video frame that matches the scroll position.
(() => {
  // Phones get the vertical film; each film has its own length, background and step frames.
  const vertical = window.matchMedia('(max-width: 699px)').matches;
  const filme = vertical
    ? { pasta: 'vertical', total: 240, fundo: '#F5F0E5', etapas: [48, 108, 184], ocultarTrilha: 226, seguir: 228 }
    : { pasta: 'desktop', total: 437, fundo: '#F9F9F1', etapas: [58, 146, 290], ocultarTrilha: 368, seguir: 400 };
  const TOTAL = filme.total;
  const secao = document.querySelector('.filme');
  const tela = document.querySelector('.filme__tela');
  const ctx = tela.getContext('2d');
  const legendas = [...document.querySelectorAll('.legenda')];
  const etapas = [...document.querySelectorAll('.trilha li')];
  const trilha = document.querySelector('.trilha');
  const seguir = document.querySelector('.filme__seguir');

  const caminho = (i) => `frames/${filme.pasta}/frame_${String(i + 1).padStart(4, '0')}.webp`;

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
      const de = +(vertical ? el.dataset.mDe : el.dataset.de);
      const ate = +(vertical ? el.dataset.mAte : el.dataset.ate);
      el.classList.toggle('visivel', quadro >= de && quadro <= ate);
    });

    const etapa = filme.etapas.filter((inicio) => quadro >= inicio).length;
    etapas.forEach((li, n) => li.classList.toggle('ativa', n === etapa));
    trilha.classList.toggle('oculta', quadro >= filme.ocultarTrilha);
    seguir.classList.toggle('visivel', quadro >= filme.seguir);
  };

  window.addEventListener('scroll', atualizar, { passive: true });
  window.addEventListener('resize', () => { ajustarTela(); atualizar(); });
  ajustarTela();
  atualizar();
})();
