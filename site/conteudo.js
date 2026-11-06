import { SUPABASE_URL, SUPABASE_CHAVE } from './supabase-config.js';

const CHAVE_CACHE = 'everos-conteudo';
const TABELAS = ['projetos', 'blocos_sobre', 'contatos', 'legendas', 'textos'];
const SLOTS = ['abertura', 'entendimento', 'solucao', 'entrega'];
const CAMPOS = ['rotulo', 'titulo', 'texto'];

function elemento(tag, classe, texto) {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  if (texto !== undefined) el.textContent = texto;
  return el;
}
function https(valor) {
  if (typeof valor !== 'string' || !valor.startsWith('https://')) return null;
  try {
    const url = new URL(valor);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
function enderecoImagem(valor) {
  if (typeof valor !== 'string') return null;
  if (/^img\/[a-zA-Z0-9_./-]+$/.test(valor) && !valor.includes('..')) return valor;
  return https(valor);
}
function link(url, classe, texto, seta = false) {
  const el = elemento(url ? 'a' : 'span', classe, texto);
  if (url) {
    el.href = url;
    if (url.startsWith('https://')) { el.target = '_blank'; el.rel = 'noopener'; }
  }
  if (seta) {
    el.append(document.createTextNode(' '));
    const icon = elemento('span', '', '↗'); icon.setAttribute('aria-hidden', 'true'); el.append(icon);
  }
  return el;
}
function projeto(p, destaque) {
  const article = elemento('article', destaque ? 'projeto projeto--destaque' : 'projeto');
  const url = https(p.url);
  const janela = link(url, 'janela');
  const barra = elemento('span', 'janela__barra');
  for (let i = 0; i < 3; i++) barra.append(elemento('i'));
  const dominio = url ? new URL(url).hostname.replace(/^www\./, '') : '';
  barra.append(elemento('span', 'janela__url', p.url_exibicao || dominio));
  janela.append(barra);
  const imagemUrl = enderecoImagem(p.imagem_url);
  if (imagemUrl) {
    const img = elemento('img'); img.src = imagemUrl; img.alt = p.imagem_alt || '';
    img.loading = 'lazy'; img.width = 960; img.height = 600; janela.append(img);
  }
  article.append(janela);
  const info = destaque ? elemento('div', 'projeto__info') : article;
  info.append(elemento('p', 'projeto__tipo', p.tipo), elemento('h3', 'projeto__nome', p.nome), elemento('p', 'projeto__texto', p.texto));
  if (destaque && p.lista.length) {
    const lista = elemento('ul', 'projeto__lista');
    for (const texto of p.lista) lista.append(elemento('li', '', texto));
    info.append(lista);
  }
  if (url) info.append(link(url, destaque ? 'botao' : 'projeto__link', destaque ? (p.botao_texto || `Visitar ${dominio}`) : 'Visitar site', true));
  if (destaque) article.append(info);
  return article;
}
function canalUrl(c) {
  const valor = c.valor.trim();
  if (c.tipo === 'whatsapp' || c.tipo === 'telefone') {
    const digitos = valor.replace(/\D/g, '');
    if (!/^\d{12,13}$/.test(digitos)) return null;
    return c.tipo === 'telefone' ? `tel:+${digitos}` : `https://api.whatsapp.com/send/?phone=${digitos}${c.mensagem ? `&text=${encodeURIComponent(c.mensagem)}` : ''}`;
  }
  if (c.tipo === 'email') return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(valor) ? `mailto:${encodeURIComponent(valor).replace(/%40/g, '@')}${c.mensagem ? `?body=${encodeURIComponent(c.mensagem)}` : ''}` : null;
  if (c.tipo === 'instagram') {
    const usuario = valor.replace(/^@/, '');
    return /^[a-zA-Z0-9._]+$/.test(usuario) ? `https://instagram.com/${usuario}` : null;
  }
  return c.tipo === 'link' ? https(valor) : null;
}
function validar(dados) {
  if (!dados || !TABELAS.every(t => Array.isArray(dados[t]))) throw new Error('Conteúdo incompleto.');
  for (const p of dados.projetos) {
    if (!['nome', 'tipo', 'texto', 'imagem_alt'].every(k => typeof p[k] === 'string') || !Array.isArray(p.lista) || !p.lista.every(v => typeof v === 'string')) throw new Error('Projeto inválido.');
  }
  for (const b of dados.blocos_sobre) if (!CAMPOS.every(k => typeof b[k] === 'string')) throw new Error('Bloco inválido.');
  for (const c of dados.contatos) if (!['tipo', 'rotulo', 'valor'].every(k => typeof c[k] === 'string')) throw new Error('Contato inválido.');
  for (const l of dados.legendas) if (!SLOTS.includes(l.slot) || !CAMPOS.every(k => typeof l[k] === 'string')) throw new Error('Legenda inválida.');
  for (const t of dados.textos) if (typeof t.chave !== 'string' || typeof t.valor !== 'string') throw new Error('Texto inválido.');
  return dados;
}
function renderizar(dados) {
  validar(dados);
  // Prepara todos os elementos antes de alterar o HTML: nenhuma resposta parcial.
  const projetos = dados.projetos.filter(p => p.visivel).sort((a, b) => a.ordem - b.ordem);
  const principal = projetos.find(p => p.principal);
  const destaque = principal ? projeto(principal, true) : elemento('article', 'projeto projeto--destaque');
  destaque.hidden = !principal;
  const grade = document.createDocumentFragment();
  const demais = projetos.filter(p => p !== principal);
  for (const p of demais) grade.append(projeto(p, false));
  const sobre = document.createDocumentFragment();
  const blocos = dados.blocos_sobre.filter(b => b.visivel).sort((a, b) => a.ordem - b.ordem);
  blocos.forEach((b, i) => {
    const el = elemento('div', 'quem__texto');
    const titulo = elemento('h2', 'quem__titulo', b.titulo);
    if (i === 0) titulo.id = 'quem-titulo';
    el.append(elemento('p', 'rotulo', b.rotulo), titulo);
    for (const texto of b.texto.split(/\n\s*\n/).filter(Boolean)) el.append(elemento('p', '', texto));
    sobre.append(el);
  });
  const acoes = document.createDocumentFragment();
  const contatos = dados.contatos.filter(c => c.visivel).sort((a, b) => a.ordem - b.ordem).map(c => ({...c, href: canalUrl(c)})).filter(c => c.href);
  const botao = contatos.find(c => c.principal);
  if (botao) acoes.append(link(botao.href, 'botao botao--grande', botao.rotulo));
  const lista = elemento('ul', 'contato__canais');
  for (const c of contatos.filter(c => c !== botao)) {
    const li = elemento('li'); li.append(link(c.href, '', c.rotulo)); lista.append(li);
  }
  if (lista.childElementCount) acoes.append(lista);

  document.querySelector('.projeto--destaque').replaceWith(destaque);
  const gradeEl = document.querySelector('.projetos__grade'); gradeEl.replaceChildren(grade); gradeEl.hidden = !demais.length;
  const quem = document.querySelector('.quem'); quem.replaceChildren(sobre); quem.hidden = !blocos.length;
  document.querySelector('.contato__acoes').replaceChildren(acoes);
  // Mantém os articles e os intervalos da animação referenciados por script.js.
  for (const legenda of dados.legendas) for (const campo of CAMPOS) {
    const el = document.querySelector(`[data-slot="${legenda.slot}"] [data-campo="${campo}"]`);
    if (el) el.textContent = legenda[campo];
  }
  for (const el of document.querySelectorAll('[data-texto]')) {
    const texto = dados.textos.find(t => t.chave === el.dataset.texto);
    if (texto) el.textContent = texto.valor;
  }
}

try {
  const cache = localStorage.getItem(CHAVE_CACHE);
  if (cache) renderizar(JSON.parse(cache));
} catch (erro) { console.warn('Éveros: não foi possível usar o conteúdo salvo.', erro); }

async function atualizar() {
  const controller = new AbortController();
  let temporizador;
  try {
    const busca = (async () => {
      // Importação após o cache: o conteúdo salvo aparece antes de a biblioteca carregar.
      // Cópia local com versão fixa (vendor/LEIA-ME.txt): nenhum código de terceiros muda sem revisão.
      const { createClient } = await import('./vendor/supabase-js-2.119.0.js');
      if (controller.signal.aborted) throw new Error('Tempo esgotado.');
      // O site público não reutiliza a sessão do admin, portanto não recebe ocultos.
      const cliente = createClient(SUPABASE_URL, SUPABASE_CHAVE, {auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false}});
      const respostas = await Promise.all(TABELAS.map(tabela => {
        let query = cliente.from(tabela).select('*');
        if (['projetos', 'blocos_sobre', 'contatos'].includes(tabela)) query = query.eq('visivel', true).order('ordem');
        return query.abortSignal(controller.signal);
      }));
      for (const r of respostas) if (r.error) throw r.error;
      return Object.fromEntries(TABELAS.map((t, i) => [t, respostas[i].data]));
    })();
    const limite = new Promise((_, rejeitar) => {
      temporizador = setTimeout(() => { controller.abort(); rejeitar(new Error('Tempo esgotado.')); }, 5000);
    });
    const dados = validar(await Promise.race([busca, limite]));
    renderizar(dados);
    try { localStorage.setItem(CHAVE_CACHE, JSON.stringify(dados)); }
    catch (erro) { console.warn('Éveros: não foi possível guardar o conteúdo.', erro); }
  } catch (erro) { console.warn('Éveros: mantendo o conteúdo disponível.', erro); }
  finally { clearTimeout(temporizador); }
}
atualizar();
