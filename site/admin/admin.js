import { createClient } from '../vendor/supabase-js-2.119.0.js';
import { SUPABASE_URL, SUPABASE_CHAVE } from '../supabase-config.js';

// O cliente consome e limpa o hash; a intenção precisa ser lida antes.
const parametrosIniciais = new URLSearchParams(location.hash.slice(1));
let precisaSenha = ['invite', 'recovery'].includes(parametrosIniciais.get('type'));
const cliente = createClient(SUPABASE_URL, SUPABASE_CHAVE);
const $ = s => document.querySelector(s);
const area = $('#area');
// Mesmo ponto de corte do admin.css: abaixo dele, as abas vão para o menu sanduíche.
const celularAdmin = window.matchMedia('(max-width: 650px)');
let abaAtual = 'projetos', dados = {}, alterado = false, ocupado = false;
let usuarioPainel = null, versaoAcesso = 0, temEditor = false;
// Mensagem para mostrar quando o painel terminar de abrir. O Supabase dispara uma segunda
// verificação logo depois de ativar a 2FA ou salvar a senha; quem abrir o painel por último mostra.
let avisoAoAbrir = null;
const ERRO_SALVAR = 'Não foi possível salvar. Verifique sua internet e tente de novo.';
const ERRO_FORMATO = 'Algum campo tem um formato ou tamanho que o site não aceita. Confira os dados e tente de novo.';
const NOMES = {projetos:'Projetos', sobre:'Quem somos', contato:'Contato', animacao:'Animação', textos:'Textos da página', seguranca:'Segurança'};
const TABELA = {projetos:'projetos', sobre:'blocos_sobre', contato:'contatos'};
const SLOTS = {abertura:'Abertura', entendimento:'Entendimento', solucao:'Solução', entrega:'Entrega'};
const TIPOS = {whatsapp:'WhatsApp', telefone:'Telefone', email:'E-mail', instagram:'Instagram', link:'Link'};
function el(tag, classe, texto) { const n = document.createElement(tag); if (classe) n.className = classe; if (texto !== undefined) n.textContent = texto; return n; }
function aviso(texto = '', estado = '') { $('#aviso').textContent = texto; $('#aviso').dataset.estado = estado; }
function botao(texto, fn, classe = '') { const b = el('button', classe, texto); b.type = 'button'; b.addEventListener('click', fn); return b; }
function tela(nome) {
  for (const id of ['acesso', 'criar-senha', 'codigo-2fa', 'ativar-2fa', 'painel']) $('#'+id).hidden = id !== nome;
  $('#sair').hidden = nome !== 'painel';
  atualizarMenu();
}
function confirmar(texto, titulo = 'Confirmar alteração') {
  const dialog = $('#confirmacao'); $('#confirmacao-titulo').textContent = titulo; $('#confirmacao-texto').textContent = texto;
  return new Promise(resolve => {
    dialog.returnValue = '';
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirmar'), {once:true}); dialog.showModal();
  });
}
async function podeSair() { return !alterado || await confirmar('Você tem alterações não salvas. Sair sem salvar?', 'Descartar alterações?'); }
window.addEventListener('beforeunload', e => { if (alterado) { e.preventDefault(); e.returnValue = ''; } });
function marcar(form) { form.addEventListener('input', () => { alterado = true; }); form.addEventListener('change', () => { alterado = true; }); }
function ativarOcupado(valor) {
  ocupado = valor;
  for (const b of document.querySelectorAll('#painel button, #sair')) b.disabled = valor || b.dataset.limite === 'true';
  // Campos travados enquanto salva: nada digitado agora pode se perder quando a resposta chegar.
  for (const c of document.querySelectorAll('#painel input, #painel textarea, #painel select')) c.disabled = valor;
}
async function operacao(fn, sucesso = 'Salvo! Já está no site.') {
  if (ocupado) return;
  ativarOcupado(true); aviso('Salvando…');
  try { const complemento = await fn(); aviso(complemento || sucesso, complemento ? '' : 'sucesso'); }
  catch (erro) { aviso(erro.exibir || (erro.code === '23514' ? ERRO_FORMATO : ERRO_SALVAR), erro.estado ?? 'erro'); }
  finally { ativarOcupado(false); }
}
async function operacaoLista(fn) {
  if (ocupado || !await podeSair()) return;
  alterado = false;
  await operacao(fn);
}
function falha(texto, estado = 'erro') { return Object.assign(new Error(texto), {exibir:texto, estado}); }
async function exigir(resultado) { const r = await resultado; if (r.error) throw r.error; return r.data; }
async function lerTudo() {
  const tabelas = ['projetos','blocos_sobre','contatos','legendas','textos'];
  const respostas = await Promise.all(tabelas.map(t => {
    let q = cliente.from(t).select('*'); if (['projetos','blocos_sobre','contatos'].includes(t)) q = q.order('ordem').order('created_at'); return exigir(q);
  }));
  dados = Object.fromEntries(tabelas.map((t,i) => [t,respostas[i]]));
}
function textoValor(chave) { return dados.textos.find(t => t.chave === chave)?.valor || ''; }
function campo(form, nome, rotulo, valor = '', tipo = 'text', ajuda = '') {
  const id = `campo-${nome}`;
  const label = el('label', '', rotulo); label.htmlFor = id;
  const input = el(tipo === 'textarea' ? 'textarea' : 'input');
  if (tipo !== 'textarea') input.type = tipo;
  input.id = id; input.name = nome; input.value = valor ?? '';
  // Mesmos limites do banco (supabase/006_validacoes.sql): o navegador para de aceitar antes.
  if (tipo !== 'file') input.maxLength = tipo === 'textarea' ? 5000 : 300;
  form.append(label,input);
  if (ajuda) { const hint=el('p','ajuda',ajuda); hint.id=id+'-ajuda'; input.setAttribute('aria-describedby',hint.id); form.append(hint); }
  return input;
}
function check(form,nome,rotulo,valor) {
  const label = el('label','check'); const input=el('input');input.type='checkbox';input.id=`campo-${nome}`;input.name=nome;input.checked=!!valor;label.htmlFor=input.id;label.append(input,document.createTextNode(rotulo));form.append(label);return input;
}
function formulario(titulo, cancelar = true) {
  const box = el('section','editor'); const h = el('h2','',titulo); box.append(h);
  const form = el('form');box.append(form);marcar(form);temEditor=true;
  const acoes = el('div','form-acoes');const salvar=el('button','acao','Salvar');salvar.type='submit';acoes.append(salvar);
  if(cancelar) acoes.append(botao('Cancelar',async()=>{if(!ocupado&&await podeSair()){alterado=false;renderizarAba();}}));
  return {box,form,acoes,salvar};
}
function contador(form,input,avisoLongo=false) {
  const count=el('p','contador');form.append(count);
  const hint=el('p','aviso-suave','Títulos longos podem cobrir a animação no celular');if(avisoLongo)form.append(hint);
  const atualizar=()=>{count.textContent=`${input.value.length} caracteres`;hint.hidden=input.value.length<=60};input.addEventListener('input',atualizar);atualizar();
}
function cabeca(titulo,acao) {const head=el('div','area-cabeca');head.append(el('h2','',titulo));if(acao)head.append(acao);area.append(head);}
async function abrirEditor(fn) {if(ocupado||!await podeSair())return;alterado=false;area.replaceChildren();fn();area.querySelector('input,textarea,select')?.focus();}
const SALVO_SEM_LISTA = 'Salvo! Mas não foi possível atualizar a tela. Toque em “Atualizar lista”.';
// Chamada só depois que a gravação deu certo. Se a releitura falhar, o formulário sai da tela
// para que "Salvar" não seja repetido (o que criaria o item de novo).
async function recarregar() {
  try { await lerTudo(); }
  catch { mostrarAtualizarLista(); throw falha(SALVO_SEM_LISTA, ''); }
  renderizarAba();
  limparImagensPendentes();
}
// Para formulários que só editam (textos, frases): repetir é seguro, então o formulário fica.
async function releitura() {
  try { await lerTudo(); } catch { throw falha(SALVO_SEM_LISTA.replace(' Toque em “Atualizar lista”.', ' Atualize a página para conferir.'), ''); }
}
function mostrarAtualizarLista() {
  alterado = false; formsAlterados.clear(); temEditor = false;
  area.replaceChildren(
    el('p', 'apoio', 'Sua alteração foi salva, mas a lista não pôde ser carregada agora.'),
    botao('Atualizar lista', () => operacao(async () => {
      try { await lerTudo(); } catch { throw falha('Ainda não foi possível carregar. Verifique sua internet e tente de novo.'); }
      renderizarAba();
    }, 'Lista atualizada.'), 'acao')
  );
}
async function salvarTextos(valores) {
  await Promise.all(Object.entries(valores).map(([chave,valor])=>exigir(cliente.from('textos').update({valor}).eq('chave',chave).select('chave').single())));
}
async function salvarItem(tabela,id,payload) {
  const atual = dados[tabela].find(r=>r.principal&&r.id!==id);
  let anteriorDesmarcado=false;
  try {
    if(payload.principal&&atual) {await exigir(cliente.from(tabela).update({principal:false}).eq('id',atual.id).select('id').single());anteriorDesmarcado=true;}
    const query=id?cliente.from(tabela).update(payload).eq('id',id):cliente.from(tabela).insert(payload);
    return await exigir(query.select().single());
  } catch(erro) {
    if(anteriorDesmarcado) {
      try {await exigir(cliente.from(tabela).update({principal:true}).eq('id',atual.id).select('id').single());}
      catch {throw falha('Não foi possível concluir a troca do principal. Recarregue a lista e confira qual está marcado.');}
    }
    throw erro;
  }
}
// Imagens antigas ficam salvas como caminho do site (img/projetos/x.webp).
// O painel está em /admin/, então esse caminho precisa subir uma pasta.
function srcImagem(url){return typeof url==='string'&&url.startsWith('img/')?'../'+url:url;}
function caminhoImagem(url) {
  try {
    const u=new URL(url), base=new URL(SUPABASE_URL), prefixo='/storage/v1/object/public/projetos/';
    if(u.origin!==base.origin||!u.pathname.startsWith(prefixo))return null;
    const caminho=decodeURIComponent(u.pathname.slice(prefixo.length));
    return caminho&&!caminho.includes('..')?caminho:null;
  } catch {return null;}
}
// Imagens que não puderam ser apagadas ficam anotadas neste navegador e são
// apagadas de novo, sem aviso, na próxima vez que o painel carregar a lista.
const CHAVE_PENDENTES='everos-imagens-pendentes';
function imagensPendentes(){try{const l=JSON.parse(localStorage.getItem(CHAVE_PENDENTES));return Array.isArray(l)?l.filter(u=>typeof u==='string'):[]}catch{return []}}
function guardarPendentes(lista){try{if(lista.length)localStorage.setItem(CHAVE_PENDENTES,JSON.stringify([...new Set(lista)]));else localStorage.removeItem(CHAVE_PENDENTES);}catch{}}
async function apagarImagemAgora(url) {
  const caminho=caminhoImagem(url);if(!caminho)return;
  const outros=await exigir(cliente.from('projetos').select('id').eq('imagem_url',url).limit(1));if(outros.length)return;
  await exigir(cliente.storage.from('projetos').remove([caminho]));
}
async function apagarImagem(url) {
  try {await apagarImagemAgora(url);}
  catch(erro){if(caminhoImagem(url))guardarPendentes([...imagensPendentes(),url]);throw erro;}
}
let limpandoPendentes=false;
async function limparImagensPendentes() {
  if(limpandoPendentes)return;const lista=imagensPendentes();if(!lista.length)return;
  limpandoPendentes=true;const restantes=[];
  for(const url of lista){try{await apagarImagemAgora(url);}catch{restantes.push(url);}}
  // Mantém anotações feitas enquanto esta limpeza rodava.
  guardarPendentes([...restantes,...imagensPendentes().filter(u=>!lista.includes(u))]);limpandoPendentes=false;
}
async function enviarImagem(arquivo) {
  // Aceita qualquer imagem que o navegador consiga abrir (JPG, PNG, WebP, GIF, AVIF, BMP, HEIC no iPhone...).
  // Ela é convertida aqui para WebP ou JPEG antes do envio, então o Supabase sempre recebe um formato leve.
  const extensaoImagem=/\.(jpe?g|png|webp|gif|avif|bmp|heic|heif|tiff?|svg|ico|jfif)$/i.test(arquivo.name||'');
  if(!arquivo.type.startsWith('image/')&&!extensaoImagem)throw falha('Este arquivo não é uma imagem. Escolha uma foto ou print da página.');
  if(arquivo.size>40*1024*1024)throw falha('Esta imagem passa de 40 MB. Escolha uma imagem menor.');
  const local=URL.createObjectURL(arquivo);const img=new Image();
  try {
    img.src=local;
    try{await img.decode();}catch{throw falha('Não foi possível abrir este formato neste navegador. Tente salvar a imagem como JPG ou PNG e envie de novo.');}
    if(!img.naturalWidth||!img.naturalHeight)throw falha('Não foi possível ler o tamanho desta imagem. Tente salvar como JPG ou PNG e envie de novo.');
    const fator=Math.min(1,1920/img.naturalWidth,1200/img.naturalHeight);
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*fator));canvas.height=Math.max(1,Math.round(img.naturalHeight*fator));
    const contexto=canvas.getContext('2d');if(!contexto)throw new Error('Imagem indisponível');contexto.drawImage(img,0,0,canvas.width,canvas.height);
    const gerar=(tipo)=>new Promise(resolve=>canvas.toBlob(resolve,tipo,.85));
    let blob=await gerar('image/webp');
    // O Safari (iPhone/Mac) não gera WebP e devolve PNG; nesse caso usa JPEG, com fundo branco no lugar da transparência.
    if(!blob||blob.type!=='image/webp'){
      contexto.globalCompositeOperation='destination-over';contexto.fillStyle='#ffffff';contexto.fillRect(0,0,canvas.width,canvas.height);
      blob=await gerar('image/jpeg');
    }
    if(!blob||!['image/webp','image/jpeg'].includes(blob.type))throw falha('Não foi possível preparar esta imagem. Escolha outra e tente de novo.');
    if(blob.size>3145728)throw falha('Essa imagem ficou muito grande. Escolha outra imagem e tente de novo.');
    const nome=`${crypto.randomUUID()}.${blob.type==='image/webp'?'webp':'jpg'}`;await exigir(cliente.storage.from('projetos').upload(nome,blob,{contentType:blob.type,upsert:false}));
    return cliente.storage.from('projetos').getPublicUrl(nome).data.publicUrl;
  } finally { URL.revokeObjectURL(local); }
}
// 5537991106200 -> +55 (37) 99110-6200, só para mostrar no cartão.
function valorLegivel(c){const d=String(c.valor||'').replace(/\D/g,'');if(!['whatsapp','telefone'].includes(c.tipo)||!/^\d{12,13}$/.test(d))return c.valor;return `+${d.slice(0,2)} (${d.slice(2,4)}) ${d.slice(4,-4)}-${d.slice(-4)}`;}
function listaItens(tabela) {
  const itens=dados[tabela];const lista=el('div','lista');area.append(lista);
  if(!itens.length){lista.append(el('p','apoio','Ainda não há itens aqui. Use o botão acima para adicionar o primeiro.'));return;}
  itens.forEach((item,i)=>{
    const cartao=el('article','cartao');const linha=el('div','cartao__linha');
    if(tabela==='projetos'&&item.imagem_url){const img=el('img','miniatura');img.src=srcImagem(item.imagem_url);img.alt=item.imagem_alt||'';img.loading='lazy';linha.append(img);}
    const info=el('div','cartao__info');info.append(el('h3','',item.nome||item.titulo||item.rotulo));info.append(el('p','apoio',tabela==='projetos'?item.tipo:tabela==='contatos'?`${TIPOS[item.tipo]} · ${valorLegivel(item)}`:item.rotulo));
    const selos=el('div','selos');if(!item.visivel)selos.append(el('span','selo','Oculto'));if(item.principal)selos.append(el('span','selo selo--principal','Principal'));info.append(selos);linha.append(info);cartao.append(linha);
    const acoes=el('div','cartao__acoes');
    acoes.append(botao('Editar',()=>abrirEditor(()=>editarItem(tabela,item))));
    acoes.append(botao(item.visivel?'Ocultar':'Mostrar',()=>operacaoLista(async()=>{await exigir(cliente.from(tabela).update({visivel:!item.visivel}).eq('id',item.id).select('id').single());await recarregar();})));
    for(const [delta,seta] of [[-1,'↑'],[1,'↓']]) {
      const mover=botao(seta,()=>operacaoLista(async()=>{
        const vizinho=itens[i+delta];const ordemA=item.ordem,ordemB=vizinho.ordem;
        if(ordemA===ordemB)throw falha('Há dois itens na mesma posição. Recarregue a lista antes de reordenar.');
        await exigir(cliente.from(tabela).update({ordem:ordemB}).eq('id',item.id).select('id').single());
        try {await exigir(cliente.from(tabela).update({ordem:ordemA}).eq('id',vizinho.id).select('id').single());}
        catch(e){await exigir(cliente.from(tabela).update({ordem:ordemA}).eq('id',item.id).select('id').single());throw e;}
        await recarregar();
      }));
      mover.setAttribute('aria-label',`${delta<0?'Mover para cima':'Mover para baixo'}: ${item.nome||item.titulo||item.rotulo}`);mover.dataset.limite=String(!itens[i+delta]);mover.disabled=!itens[i+delta];acoes.append(mover);
    }
    acoes.append(botao('Remover',async()=>{
      if(ocupado)return;const nome=item.nome||item.titulo||item.rotulo;
      if(!await confirmar(`Remover ${tabela==='projetos'?'o projeto':tabela==='contatos'?'o canal':'o bloco'} ${nome}? Isso não pode ser desfeito.`, 'Remover item?'))return;
      await operacaoLista(async()=>{
        await exigir(cliente.from(tabela).delete().eq('id',item.id).select('id').single());
        let avisoImagem='';if(tabela==='projetos')try{await apagarImagem(item.imagem_url)}catch{avisoImagem='Projeto removido. A imagem antiga será apagada sozinha na próxima vez que você abrir o painel.'}
        await recarregar();return avisoImagem;
      });
    },'perigo'));cartao.append(acoes);lista.append(cartao);
  });
}
function editarItem(tabela,item={}) {
  if(tabela==='projetos')return editarProjeto(item);
  if(tabela==='contatos')return editarContato(item);
  const {box,form,acoes}=formulario(item.id?'Editar bloco':'Novo bloco');
  const rotulo=campo(form,'rotulo','Rótulo pequeno',item.rotulo,'text','Por exemplo: Objetivo');const titulo=campo(form,'titulo','Título',item.titulo);const texto=campo(form,'texto','Texto',item.texto,'textarea','Deixe uma linha em branco para começar outro parágrafo');
  form.append(acoes);area.append(box);form.addEventListener('submit',e=>{e.preventDefault();operacao(async()=>{await salvarItem(tabela,item.id,{rotulo:rotulo.value.trim(),titulo:titulo.value.trim(),texto:texto.value.trim(),...(!item.id?{ordem:proximaOrdem(tabela)}:{})});alterado=false;await recarregar();})});
}
function proximaOrdem(tabela) {return Math.max(-1,...dados[tabela].map(r=>r.ordem))+1;}
function editarProjeto(item) {
  const {box,form,acoes}=formulario(item.id?'Editar projeto':'Novo projeto');
  const nome=campo(form,'nome','Nome do projeto *',item.nome);nome.required=true;nome.maxLength=120;
  const tipo=campo(form,'tipo','Tipo de projeto',item.tipo);const texto=campo(form,'texto','Descrição',item.texto,'textarea');contador(form,texto);
  const url=campo(form,'url','Endereço do site',item.url,'url','Use um endereço que comece com https://');url.placeholder='https://exemplo.com.br';url.pattern='https://.+';url.addEventListener('input',()=>url.setCustomValidity(''));
  const exibicao=campo(form,'url_exibicao','Texto da barrinha (opcional)',item.url_exibicao);
  const arquivo=campo(form,'imagem','Imagem do projeto','','file','Aceita JPG, PNG, WebP, GIF e outros formatos de imagem. Tamanho ideal: 1920×1200 (formato 16:10).');arquivo.accept='image/*,.heic,.heif,.avif';
  const preview=el('img','preview');preview.alt='Pré-visualização da imagem do projeto';preview.hidden=!item.imagem_url;if(item.imagem_url)preview.src=srcImagem(item.imagem_url);form.append(preview);
  let previewUrl=null;
  arquivo.addEventListener('change',()=>{
    if(previewUrl)URL.revokeObjectURL(previewUrl);
    if(arquivo.files[0]){previewUrl=URL.createObjectURL(arquivo.files[0]);preview.src=previewUrl;preview.hidden=false;}
    else{preview.hidden=!item.imagem_url;if(item.imagem_url)preview.src=srcImagem(item.imagem_url);}
  });
  const alt=campo(form,'imagem_alt','Texto alternativo da imagem',item.imagem_alt,'text','Descreva a imagem para quem usa leitor de tela.');
  const principal=check(form,'principal','É o projeto principal?',item.principal);
  const extra=el('div','grupo');form.append(extra);extra.hidden=!principal.checked;principal.addEventListener('change',()=>{extra.hidden=!principal.checked});
  const heading=el('h3','','Tópicos do projeto principal');extra.append(heading);const topicos=el('div');extra.append(topicos);
  // Mesmos limites do banco (006): até 30 tópicos e 5000 caracteres somados.
  const MAX_TOPICOS=30,MAX_TEXTO_TOPICOS=5000;let botaoTopico=null;
  const atualizarBotaoTopico=()=>{if(botaoTopico)botaoTopico.hidden=topicos.children.length>=MAX_TOPICOS;};
  function adicionarTopico(valor='') {
    const linha=el('div','topico');const input=el('input');input.type='text';input.maxLength=300;input.value=valor;input.id=`topico-${crypto.randomUUID()}`;const label=el('label','somente-leitor',`Tópico ${topicos.children.length+1}`);label.htmlFor=input.id;linha.append(label);
    const remover=botao('Remover',()=>{linha.remove();alterado=true;atualizarBotaoTopico();});remover.setAttribute('aria-label','Remover este tópico');linha.append(input,remover);topicos.append(linha);atualizarBotaoTopico();return input;
  }
  for(const texto of item.lista||[])adicionarTopico(texto);
  botaoTopico=botao('+ Adicionar tópico',()=>{if(topicos.children.length>=MAX_TOPICOS)return;adicionarTopico().focus();alterado=true;});extra.append(botaoTopico);atualizarBotaoTopico();const botaoTexto=campo(extra,'botao_texto','Texto do botão',item.botao_texto);
  form.append(acoes);area.append(box);
  form.addEventListener('submit',e=>{e.preventDefault();url.setCustomValidity(url.value.trim() && !enderecoHttps(url.value.trim()) ? 'Use um endereço válido que comece com https://' : '');if(!form.reportValidity())return;
    const camposTopicos=[...topicos.querySelectorAll('input')];
    if(camposTopicos.reduce((soma,i)=>soma+i.value.trim().length,0)>MAX_TEXTO_TOPICOS){aviso(`Os tópicos passam de ${MAX_TEXTO_TOPICOS} caracteres somados. Encurte ou remova algum e salve de novo.`,'erro');camposTopicos.at(-1)?.focus();return;}
    operacao(async()=>{
    let novaUrl=item.imagem_url||null;
    if(arquivo.files[0])novaUrl=await enviarImagem(arquivo.files[0]);
    try {await salvarItem('projetos',item.id,{nome:nome.value.trim(),tipo:tipo.value.trim(),texto:texto.value.trim(),url:url.value.trim()||null,url_exibicao:exibicao.value.trim()||null,imagem_url:novaUrl,imagem_alt:alt.value.trim(),principal:principal.checked,lista:[...topicos.querySelectorAll('input')].map(i=>i.value.trim()).filter(Boolean),botao_texto:botaoTexto.value.trim()||null,...(!item.id?{ordem:proximaOrdem('projetos')}:{})});}
    catch(erro){if(novaUrl!==item.imagem_url)try{await apagarImagem(novaUrl)}catch{}throw erro;}
    alterado=false;let avisoImagem='';if(novaUrl!==item.imagem_url)try{await apagarImagem(item.imagem_url)}catch{avisoImagem='Projeto salvo. A imagem antiga será apagada sozinha na próxima vez que você abrir o painel.'}
    if(previewUrl)URL.revokeObjectURL(previewUrl);await recarregar();return avisoImagem;
  })});
}
function editarContato(item) {
  const {box,form,acoes}=formulario(item.id?'Editar canal':'Novo canal');
  const label=el('label','','Tipo de contato');label.htmlFor='campo-tipo';const tipo=el('select');tipo.id='campo-tipo';tipo.name='tipo';
  for(const [valor,nome] of Object.entries(TIPOS)){const option=el('option','',nome);option.value=valor;tipo.append(option)}tipo.value=item.tipo||'whatsapp';form.append(label,tipo);
  const rotulo=campo(form,'rotulo','Texto mostrado',item.rotulo);rotulo.required=true;
  const valor=campo(form,'valor','Número com DDD',item.valor);valor.required=true;
  const mensagemBox=el('div');form.append(mensagemBox);const mensagem=campo(mensagemBox,'mensagem','Mensagem pronta',item.mensagem,'textarea');
  const principal=check(form,'principal','Usar como botão principal',item.principal);
  function atualizarTipo(){
    const op={whatsapp:['Número com DDD','(37) 99110-6200','tel'],telefone:['Número com DDD','(37) 99110-6200','tel'],email:['E-mail','contato@exemplo.com.br','email'],instagram:['Usuário do Instagram','everosprojetos','text'],link:['Endereço do link','https://exemplo.com.br','url']}[tipo.value];
    form.querySelector('label[for="campo-valor"]').textContent=op[0];valor.placeholder=op[1];valor.type=op[2];valor.setCustomValidity('');mensagemBox.hidden=!['whatsapp','email'].includes(tipo.value);
  }tipo.addEventListener('change',atualizarTipo);valor.addEventListener('input',()=>valor.setCustomValidity(''));atualizarTipo();
  form.append(acoes);area.append(box);
  form.addEventListener('submit',e=>{
    e.preventDefault();let salvo=valor.value.trim();
    if(['telefone','whatsapp'].includes(tipo.value)){
      salvo=salvo.replace(/\D/g,'');if(salvo.length===10||salvo.length===11)salvo='55'+salvo;
      if(!/^\d{12,13}$/.test(salvo))valor.setCustomValidity('Informe um telefone com DDD, com 12 ou 13 dígitos incluindo o código do país.');
    }
    if(tipo.value==='email'&&!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(salvo))valor.setCustomValidity('Informe um e-mail válido.');
    if(tipo.value==='link'&&!enderecoHttps(salvo))valor.setCustomValidity('Use um endereço que comece com https://');
    if(tipo.value==='instagram'){salvo=salvo.replace(/^@/,'');if(!/^[a-zA-Z0-9._]{1,30}$/.test(salvo))valor.setCustomValidity('Informe apenas o usuário do Instagram (até 30 caracteres), sem o endereço do site.');}
    if(!form.reportValidity())return;
    operacao(async()=>{await salvarItem('contatos',item.id,{tipo:tipo.value,rotulo:rotulo.value.trim(),valor:salvo,mensagem:['whatsapp','email'].includes(tipo.value)?mensagem.value.trim():null,principal:principal.checked,...(!item.id?{ordem:proximaOrdem('contatos')}:{})});alterado=false;await recarregar();});
  });
}
function enderecoHttps(valor){try{const u=new URL(valor);return valor.startsWith('https://')&&u.protocol==='https:'&&!u.username&&!u.password}catch{return false}}
function formTextos(titulo,campos) {
  const {box,form,acoes}=formulario(titulo,false);const inputs={};
  for(const [chave,rotulo,tipo='text'] of campos)inputs[chave]=campo(form,chave,rotulo,textoValor(chave),tipo);
  form.append(acoes);form.addEventListener('submit',e=>{e.preventDefault();operacao(async()=>{await salvarTextos(Object.fromEntries(Object.entries(inputs).map(([k,v])=>[k,v.value.trim()])));alterado=false;await releitura();});});area.append(box);
}
function animacao() {
  cabeca('Frases da animação');area.append(el('p','apoio','Estas são as 4 frases que aparecem sobre a animação no topo do site, na ordem em que aparecem.'));
  for(const [slot,nome] of Object.entries(SLOTS)) {
    const item=dados.legendas.find(l=>l.slot===slot);if(!item){aviso('Não foi possível carregar todas as frases. Atualize a página e tente novamente.','erro');continue;}
    const {box,form,acoes}=formulario(nome,false);const rotulo=campo(form,`${slot}-rotulo`,'Rótulo',item.rotulo);const titulo=campo(form,`${slot}-titulo`,'Título',item.titulo);contador(form,titulo,true);const texto=campo(form,`${slot}-texto`,'Texto',item.texto,'textarea');form.append(acoes);
    form.addEventListener('submit',e=>{e.preventDefault();operacao(async()=>{await exigir(cliente.from('legendas').update({rotulo:rotulo.value.trim(),titulo:titulo.value.trim(),texto:texto.value.trim()}).eq('slot',slot).select('slot').single());limparFormSalvo(form);await releitura();});});area.append(box);
  }
}
const formsAlterados=new Set();
document.addEventListener('input',e=>{if(e.target.closest('#painel form'))formsAlterados.add(e.target.closest('form'))});
document.addEventListener('change',e=>{if(e.target.closest('#painel form'))formsAlterados.add(e.target.closest('form'))});
function limparFormSalvo(form){formsAlterados.delete(form);alterado=formsAlterados.size>0;}
function renderizarAba() {
  area.replaceChildren();temEditor=false;formsAlterados.clear();
  for(const b of document.querySelectorAll('[data-aba]')){const ativo=b.dataset.aba===abaAtual;b.setAttribute('aria-selected',String(ativo));b.tabIndex=ativo?0:-1;}
  area.setAttribute('aria-labelledby',`aba-${abaAtual}`);
  if(TABELA[abaAtual]) {
    const tabela=TABELA[abaAtual];const textoNovo=abaAtual==='projetos'?'+ Novo projeto':abaAtual==='sobre'?'+ Novo bloco':'+ Novo canal';
    cabeca(NOMES[abaAtual],botao(textoNovo,()=>abrirEditor(()=>editarItem(tabela))));
    if(abaAtual==='contato')formTextos('Textos da seção',[['contato_titulo','Título'],['contato_texto','Texto','textarea']]);
    listaItens(tabela);
  } else if(abaAtual==='animacao')animacao();
  else if(abaAtual==='seguranca')seguranca();
  else {cabeca('Textos da página');formTextos('Apresentação e rodapé',[['projetos_rotulo','Rótulo dos projetos'],['projetos_titulo','Título dos projetos'],['projetos_intro','Introdução dos projetos','textarea'],['rodape_frase','Frase do rodapé']]);}
}
async function trocarAba(nome) {if(ocupado||!await podeSair())return;alterado=false;abaAtual=nome;renderizarAba();aviso();}
for(const b of document.querySelectorAll('[data-aba]'))b.addEventListener('click',()=>trocarAba(b.dataset.aba));
$('.abas').addEventListener('keydown',async e=>{
  const tabs=[...document.querySelectorAll('[data-aba]')],i=tabs.indexOf(document.activeElement);if(i<0)return;
  let destino;if(e.key==='ArrowRight')destino=(i+1)%tabs.length;else if(e.key==='ArrowLeft')destino=(i+tabs.length-1)%tabs.length;else if(e.key==='Home')destino=0;else if(e.key==='End')destino=tabs.length-1;else return;
  e.preventDefault();await trocarAba(tabs[destino].dataset.aba);if(abaAtual===tabs[destino].dataset.aba)tabs[destino].focus();
});
async function verificarAcesso(session) {
  const versao=++versaoAcesso;
  if(!session){avisoAoAbrir=null;tela('acesso');aviso(alterado?'Sua sessão terminou. Entre novamente; o que você digitou está guardado nesta página.':'');return;}
  // O Supabase repete o aviso de login ao voltar para a aba (e ao abrir a galeria no celular).
  // Se o painel já está aberto para a mesma pessoa, não recarrega: o formulário aberto fica como está.
  if(session.user.id===usuarioPainel&&!$('#painel').hidden&&!precisaSenha)return;
  try {
    const admin=await exigir(cliente.from('admins').select('user_id').eq('user_id',session.user.id).maybeSingle());
    if(versao!==versaoAcesso)return;
    if(!admin){avisoAoAbrir=null;await cliente.auth.signOut();tela('acesso');aviso('Esta conta não tem permissão para editar o site.','erro');return;}
    // Verificação em duas etapas: quem já ativou precisa do código antes de qualquer outra tela
    // (inclusive criar senha, que o Supabase só permite depois do código).
    const nivel=await exigir(cliente.auth.mfa.getAuthenticatorAssuranceLevel());
    if(versao!==versaoAcesso)return;
    if(nivel.nextLevel==='aal2'&&nivel.currentLevel!=='aal2'){tela('codigo-2fa');aviso();$('#codigo').focus();return;}
    mostrarStatus2fa(nivel.currentLevel==='aal2');
    if(precisaSenha){tela('criar-senha');aviso();return;}
    const preservar=usuarioPainel===session.user.id&&alterado&&area.childElementCount;
    if(!preservar){await lerTudo();if(versao!==versaoAcesso)return;alterado=false;renderizarAba();limparImagensPendentes();}
    usuarioPainel=session.user.id;tela('painel');
    if(avisoAoAbrir){aviso(...avisoAoAbrir);avisoAoAbrir=null;}else aviso(preservar?'Você entrou novamente. Suas alterações ainda estão aqui.':'');
  } catch{if(versao!==versaoAcesso)return;avisoAoAbrir=null;tela('acesso');aviso('Não foi possível abrir o painel. Verifique sua internet e entre novamente.','erro');}
}
$('#form-entrar').addEventListener('submit',async e=>{
  e.preventDefault();const b=e.currentTarget.querySelector('[type=submit]');b.disabled=true;aviso('Entrando…');
  try{const {data,error}=await cliente.auth.signInWithPassword({email:$('#email').value.trim(),password:$('#senha').value});$('#senha').value='';if(error){aviso('Não foi possível entrar. Confira seu e-mail e sua senha.','erro');return;}
    // A senha ainda entra, mas foi criada antes da regra atual do Supabase (12 caracteres, maiúscula, minúscula e número).
    if(data.weakPassword)avisoAoAbrir=['Sua senha é de antes da regra nova: 12 caracteres, com letra minúscula, letra maiúscula e número. Para trocar, toque em Sair e depois em “Esqueci minha senha”.',''];
    await verificarAcesso(data.session);}
  catch{aviso('Não foi possível entrar. Verifique sua internet e tente novamente.','erro');}finally{b.disabled=false;}
});
$('#recuperar').addEventListener('click',async()=>{
  const email=$('#email');if(!email.value||!email.reportValidity()){aviso('Preencha seu e-mail para receber o link de recuperação.','erro');email.focus();return;}
  const b=$('#recuperar');b.disabled=true;
  try{const {error}=await cliente.auth.resetPasswordForEmail(email.value.trim(),{redirectTo:new URL('./',location.href).href});if(error)throw error;aviso('Se este e-mail tiver acesso, você receberá um link para criar uma nova senha.','sucesso');}
  catch{aviso('Não foi possível enviar o link. Verifique sua internet e tente de novo.','erro');}finally{b.disabled=false;}
});
$('#form-senha').addEventListener('submit',async e=>{
  e.preventDefault();const senha=$('#nova-senha'),confirmacao=$('#confirmar-senha');confirmacao.setCustomValidity(senha.value===confirmacao.value?'':'As senhas precisam ser iguais.');if(!e.currentTarget.reportValidity())return;
  const b=e.currentTarget.querySelector('[type=submit]');b.disabled=true;
  try{const {error}=await cliente.auth.updateUser({password:senha.value});if(error)throw error;senha.value='';confirmacao.value='';precisaSenha=false;avisoAoAbrir=['Senha salva! Você já pode cuidar do site.','sucesso'];const {data}=await cliente.auth.getSession();await verificarAcesso(data.session);}
  catch(erro){aviso(erro?.code==='weak_password'?'Senha fraca: use pelo menos 12 caracteres, com letra minúscula, letra maiúscula e número.':'Não foi possível salvar a senha. O link pode ter expirado. Solicite outro em “Esqueci minha senha”.','erro');}finally{b.disabled=false;}
});
$('#confirmar-senha').addEventListener('input',()=>$('#confirmar-senha').setCustomValidity(''));
$('#voltar-entrar').addEventListener('click',async()=>{precisaSenha=false;await cliente.auth.signOut();tela('acesso');aviso();});
$('#sair').addEventListener('click',async()=>{if(ocupado||!await podeSair())return;const {error}=await cliente.auth.signOut();if(error){aviso('Não foi possível sair. Verifique sua internet e tente de novo.','erro');return;}alterado=false;usuarioPainel=null;area.replaceChildren();tela('acesso');aviso();});
// ============ Verificação em duas etapas (aplicativo autenticador) ============
const ERRO_CODIGO='Código incorreto ou expirado. Confira o aplicativo e digite o código que está aparecendo agora.';
async function sessaoAtual(){const {data}=await cliente.auth.getSession();return data.session;}
$('#form-codigo').addEventListener('submit',async e=>{
  e.preventDefault();const b=e.currentTarget.querySelector('[type=submit]'),campo=$('#codigo');b.disabled=true;aviso('Confirmando…');
  try{
    const fatores=await exigir(cliente.auth.mfa.listFactors());
    const fator=fatores.all.find(f=>f.factor_type==='totp'&&f.status==='verified');
    if(!fator)throw new Error('sem fator');
    const {error}=await cliente.auth.mfa.challengeAndVerify({factorId:fator.id,code:campo.value.trim()});campo.value='';
    if(error){aviso(ERRO_CODIGO,'erro');campo.focus();return;}
    await verificarAcesso(await sessaoAtual());
  }catch{aviso('Não foi possível confirmar o código. Verifique sua internet e tente de novo.','erro');}finally{b.disabled=false;}
});
$('#codigo-sair').addEventListener('click',async()=>{avisoAoAbrir=null;await cliente.auth.signOut();tela('acesso');aviso();});
let fatorNovo=null;
async function cancelarFatorNovo(){if(fatorNovo){const id=fatorNovo;fatorNovo=null;try{await cliente.auth.mfa.unenroll({factorId:id});}catch{}}}
async function iniciar2fa(){
  if(ocupado||!await podeSair())return;alterado=false;ativarOcupado(true);aviso('Preparando…');
  try{
    // Uma tentativa anterior não concluída deixa um fator pendente; ele é descartado antes de criar outro.
    const fatores=await exigir(cliente.auth.mfa.listFactors());
    for(const f of fatores.all.filter(f=>f.status!=='verified'))await exigir(cliente.auth.mfa.unenroll({factorId:f.id}));
    const novo=await exigir(cliente.auth.mfa.enroll({factorType:'totp',issuer:'Éveros Projetos',friendlyName:'Painel Éveros'}));
    fatorNovo=novo.id;$('#qr-2fa').src=novo.totp.qr_code;$('#segredo-2fa').textContent=novo.totp.secret;
    tela('ativar-2fa');aviso();$('#codigo-novo').focus();
  }catch{aviso('Não foi possível iniciar a verificação em duas etapas. Atualize a página e tente de novo.','erro');}finally{ativarOcupado(false);}
}
$('#ativar-2fa-botao').addEventListener('click',iniciar2fa);
$('#form-ativar').addEventListener('submit',async e=>{
  e.preventDefault();const b=e.currentTarget.querySelector('[type=submit]'),campo=$('#codigo-novo');b.disabled=true;aviso('Confirmando…');
  try{
    const {error}=await cliente.auth.mfa.challengeAndVerify({factorId:fatorNovo,code:campo.value.trim()});campo.value='';
    if(error){aviso(ERRO_CODIGO,'erro');campo.focus();return;}
    fatorNovo=null;$('#qr-2fa').removeAttribute('src');$('#segredo-2fa').textContent='';
    avisoAoAbrir=['Verificação em duas etapas ativada! A partir de agora o painel vai pedir o código do aplicativo ao entrar.','sucesso'];
    await verificarAcesso(await sessaoAtual());
  }catch{aviso('Não foi possível ativar. Verifique sua internet e tente de novo.','erro');}finally{b.disabled=false;}
});
// A verificação é opcional: o convite pode ser adiado; ativar e desativar ficam na aba Segurança.
const CHAVE_ADIADO='everos-2fa-adiado';
let doisFatores=false;
function mostrarStatus2fa(ativa){
  doisFatores=ativa;
  let adiado=false;try{adiado=localStorage.getItem(CHAVE_ADIADO)==='1';}catch{}
  $('#convite-2fa').hidden=ativa||adiado;
  if(abaAtual==='seguranca'&&!$('#painel').hidden)renderizarAba();
}
$('#adiar-2fa').addEventListener('click',()=>{try{localStorage.setItem(CHAVE_ADIADO,'1');}catch{}$('#convite-2fa').hidden=true;aviso('Tudo bem. Você pode ativar quando quiser na aba Segurança.');});
async function desativar2fa(){
  if(ocupado||!await confirmar('Sem a verificação, o painel volta a pedir só a senha para entrar. Desativar mesmo assim?','Desativar verificação em duas etapas?'))return;
  ativarOcupado(true);aviso('Desativando…');
  try{
    const fatores=await exigir(cliente.auth.mfa.listFactors());
    for(const f of fatores.all.filter(f=>f.factor_type==='totp'))await exigir(cliente.auth.mfa.unenroll({factorId:f.id}));
    await cliente.auth.refreshSession();
    mostrarStatus2fa(false);$('#convite-2fa').hidden=true;
    aviso('Verificação em duas etapas desativada. O painel volta a pedir só a senha.','sucesso');
  }catch{aviso('Não foi possível desativar. Atualize a página, entre com o código e tente de novo.','erro');}finally{ativarOcupado(false);}
}
async function sairOutros(){
  if(ocupado||!await confirmar('Isso encerra o painel em todos os outros computadores e celulares. Este aparelho continua conectado.','Sair dos outros aparelhos?'))return;
  ativarOcupado(true);aviso('Encerrando…');
  try{const {error}=await cliente.auth.signOut({scope:'others'});if(error)throw error;aviso('Pronto! O painel foi encerrado nos outros aparelhos.','sucesso');}
  catch{aviso('Não foi possível encerrar as outras sessões. Verifique sua internet e tente de novo.','erro');}finally{ativarOcupado(false);}
}
function seguranca(){
  cabeca('Segurança');
  const box=el('section','editor');box.append(el('h2','','Verificação em duas etapas'));
  box.append(el('p',doisFatores?'estado-2fa estado-2fa--ligada':'estado-2fa',doisFatores?'Ligada':'Desligada'));
  box.append(el('p','apoio',doisFatores
    ?'Ao entrar, o painel pede a senha e o código de 6 números do aplicativo autenticador do seu celular.'
    :'Hoje o painel pede só a senha. Com a verificação ligada, também é preciso o código de 6 números do aplicativo autenticador do celular. Assim, mesmo quem descobrir a senha não consegue entrar.'));
  if(!doisFatores)box.append(el('p','ajuda','Você vai precisar de um aplicativo autenticador no celular, como Google Authenticator ou Microsoft Authenticator.'));
  const acoes=el('div','form-acoes');acoes.append(doisFatores?botao('Desativar',desativar2fa,'perigo'):botao('Ativar verificação em duas etapas',iniciar2fa,'acao'));box.append(acoes);area.append(box);
  const outros=el('section','editor');outros.append(el('h2','','Outros aparelhos'));
  outros.append(el('p','apoio','Entrou no painel em um computador ou celular que não é seu, ou esqueceu de sair? Encerre o painel em todos os outros aparelhos. Este continua conectado.'));
  const acoes2=el('div','form-acoes');acoes2.append(botao('Sair dos outros aparelhos',sairOutros));outros.append(acoes2);area.append(outros);
}
$('#ativar-cancelar').addEventListener('click',async()=>{await cancelarFatorNovo();$('#qr-2fa').removeAttribute('src');$('#segredo-2fa').textContent='';tela('painel');aviso();});

cliente.auth.onAuthStateChange((evento,session)=>{
  if(evento==='PASSWORD_RECOVERY')precisaSenha=true;
  // Consulta fora do callback evita aguardar outras operações sob a trava de Auth.
  setTimeout(()=>{if(evento==='SIGNED_OUT'){versaoAcesso++;tela('acesso');if(alterado)aviso('Sua sessão terminou. Entre novamente; o que você digitou está guardado nesta página.');}else verificarAcesso(session);},0);
});
cliente.auth.getSession().then(({data,error})=>{if(error){tela('acesso');aviso('Seu link expirou ou não pôde ser aberto. Solicite outro em “Esqueci minha senha”.','erro');}else verificarAcesso(data.session)}).catch(()=>{tela('acesso');aviso('Não foi possível conectar. Verifique sua internet e atualize a página.','erro')});

// ============ Menu sanduíche (celular) ============
function atualizarMenu() {
  const usar = celularAdmin.matches && !$('#painel').hidden;
  document.body.classList.toggle('painel-celular', usar);
  $('#menu-admin').hidden = !usar;
  if (!usar) abrirMenu(false);
}
function abrirMenu(sim) {
  const botaoMenu = $('#menu-admin');
  if (sim) montarMenu();
  $('#gaveta').hidden = !sim; $('#gaveta-fundo').hidden = !sim;
  botaoMenu.setAttribute('aria-expanded', String(sim));
  botaoMenu.setAttribute('aria-label', sim ? 'Fechar menu' : 'Abrir menu');
  document.body.classList.toggle('menu-aberto', sim);
  // Com o menu aberto, o resto da página fica inativo: o Tab não sai do menu.
  for (const parte of document.querySelectorAll('body > .pular, body > header, body > main, body > footer')) parte.inert = sim;
  if (sim) $('#gaveta [aria-current]')?.focus();
}
function montarMenu() {
  $('#gaveta-abas').replaceChildren(...Object.entries(NOMES).map(([chave, nome]) => {
    const item = botao(nome, async () => { abrirMenu(false); await trocarAba(chave); $('#menu-admin').focus(); }, 'gaveta__item');
    if (chave === abaAtual) item.setAttribute('aria-current', 'page');
    return item;
  }));
}
$('#menu-admin').addEventListener('click', () => abrirMenu($('#gaveta').hidden));
$('#gaveta-fechar').addEventListener('click', () => { abrirMenu(false); $('#menu-admin').focus(); });
$('#gaveta-fundo').addEventListener('click', () => abrirMenu(false));
$('#gaveta-sair').addEventListener('click', () => { abrirMenu(false); $('#sair').click(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#gaveta').hidden) { abrirMenu(false); $('#menu-admin').focus(); } });
if (celularAdmin.addEventListener) celularAdmin.addEventListener('change', atualizarMenu);
else if (celularAdmin.addListener) celularAdmin.addListener(atualizarMenu);
