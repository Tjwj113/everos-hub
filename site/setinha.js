// Setinha: ↓ leva à próxima seção (Projetos → Quem somos → Fale com a Éveros) e some ao chegar
// no contato; ao rolar para cima vira ↑ e volta direto para o começo da animação.
// A próxima parada vem da posição na página, então continua certa se a pessoa rolar com o dedo.
(() => {
  const seta = document.querySelector('.setinha');
  if (!seta) return;
  const paradas = ['#projetos', '#quem-somos', '#contato'].map((s) => document.querySelector(s)).filter(Boolean);
  const contato = document.querySelector('#contato');
  const rodape = document.querySelector('.rodape');
  const suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Só conta como "rolou para cima" depois de subir isto: ignora pequenos ajustes do navegador
  // (imagens terminando de carregar, barra do navegador aparecendo).
  const SUBIDA_MINIMA = 60;
  let modo = 'descer', ancora = window.scrollY, rodapeVisivel = false, pedido = false;
  let destino = null, fimDoSalto = 0; // salto em andamento, iniciado pela própria setinha

  const alturaTopo = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topo-h')) || 0;
  const posicao = (el) => el.getBoundingClientRect().top + window.scrollY - alturaTopo();
  const contatoNaTela = () => contato && contato.getBoundingClientRect().top < window.innerHeight * 0.6;

  // Próxima parada depois de `base` (a posição atual, ou o destino do salto em andamento).
  const proxima = (base) => {
    const alvo = paradas.find((el) => !el.hidden && el.getClientRects().length && posicao(el) > base + 8);
    if (!alvo || (alvo === contato && contatoNaTela())) return null;
    return alvo;
  };

  const atualizar = () => {
    pedido = false;
    const y = window.scrollY;
    const saltando = destino !== null && performance.now() < fimDoSalto;
    if (!saltando) {
      destino = null;
      if (y < 40) { modo = 'descer'; ancora = y; }
      else if (modo === 'descer') { if (y > ancora) ancora = y; else if (ancora - y > SUBIDA_MINIMA) { modo = 'subir'; ancora = y; } }
      else { if (y < ancora) ancora = y; else if (y - ancora > SUBIDA_MINIMA) { modo = 'descer'; ancora = y; } }
    }
    const mostrar = !rodapeVisivel && (modo === 'subir' || !!proxima(saltando ? destino : y));
    seta.classList.toggle('visivel', mostrar);
    seta.classList.toggle('setinha--subir', modo === 'subir');
    seta.setAttribute('aria-label', modo === 'subir' ? 'Voltar para a animação' : 'Ir para a próxima seção');
  };
  const agendar = () => { if (!pedido) { pedido = true; requestAnimationFrame(atualizar); } };

  const saltar = (y) => {
    destino = y;
    // O salto longo pela animação leva alguns segundos; depois disso a direção volta a valer.
    fimDoSalto = performance.now() + 2500;
    window.scrollTo({ top: y, behavior: suave ? 'smooth' : 'auto' });
  };

  seta.addEventListener('click', () => {
    if (modo === 'subir') { saltar(0); return; }
    const saltando = destino !== null && performance.now() < fimDoSalto;
    const alvo = proxima(saltando ? destino : window.scrollY);
    if (alvo) saltar(posicao(alvo));
    agendar();
  });

  // O salto terminou: a direção volta a seguir a rolagem da pessoa a partir daqui.
  window.addEventListener('scrollend', () => {
    if (destino === null) return;
    destino = null; fimDoSalto = 0; ancora = window.scrollY;
    if (window.scrollY < 40) modo = 'descer';
    agendar();
  });

  // Some enquanto o rodapé está na tela, para não cobrir o Login.
  if (rodape && 'IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { rodapeVisivel = e.isIntersecting; agendar(); }).observe(rodape);
  }
  window.addEventListener('scroll', agendar, { passive: true });
  window.addEventListener('resize', agendar);
  seta.hidden = false;
  atualizar();
})();
