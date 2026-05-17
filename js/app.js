// js/app.js
// ═══════════════════════════════════════════════════════════
//  GRUPO VANGUARDA — Sistema de Recibos
//  GitHub Pages + Supabase
// ═══════════════════════════════════════════════════════════

// ── Estado global ─────────────────────────────────────────
let baseAtual = '102';
let todosRecibos = [], todosAnexos = [];
let filtroStatus = 'todos', filtroAnexoSt = 'todos';
let fornecedores = [], motoristas = [], placas = [], produtos = [];
let acIdxMap = {};

const CNPJS = {
  '102': '31.838.128/0002-33',
  '103': '31.838.128/0003-14'
};

// ── Init ──────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  // Carrega config salva
  const url = localStorage.getItem('sb_url') || '';
  const key = localStorage.getItem('sb_key') || '';
  if (url && key) {
    SupabaseClient.init(url, key);
    document.getElementById('sb-url').value = url;
    document.getElementById('sb-key').value = key;
    iniciarApp();
  } else {
    document.getElementById('setup-alert').style.display = 'block';
  }

  document.addEventListener('click', e => {
    if (!e.target.closest('.ac-wrap')) {
      document.querySelectorAll('.ac-dropdown').forEach(d => d.classList.remove('open'));
      acIdxMap = {};
    }
  });
});

function iniciarApp() {
  carregarSelectPgmt();
  carregarProximoNum();
  carregarCadastros();
}

// ── Config Supabase ───────────────────────────────────────
function salvarConfig() {
  const url = document.getElementById('sb-url').value.trim();
  const key = document.getElementById('sb-key').value.trim();
  if (!url || !key) { showToast('Preencha URL e chave!', 'err'); return; }
  localStorage.setItem('sb_url', url);
  localStorage.setItem('sb_key', key);
  SupabaseClient.init(url, key);
  document.getElementById('setup-alert').style.display = 'none';
  showToast('✅ Configuração salva!', 'ok');
  iniciarApp();
}

async function testarConexao() {
  const el = document.getElementById('conn-status');
  el.textContent = '⏳ Testando...';
  el.style.color = '#888';
  try {
    await SupabaseClient.get('tipos_pagamento', 'limit=1');
    el.textContent = '✅ Conexão OK! Supabase está respondendo.';
    el.style.color = 'var(--green)';
  } catch (e) {
    el.textContent = '❌ Falhou: ' + e.message;
    el.style.color = 'var(--red)';
  }
}

// ── Base ──────────────────────────────────────────────────
function selecionarBase(b) {
  baseAtual = b;
  document.getElementById('btn-base-102').classList.toggle('active', b === '102');
  document.getElementById('btn-base-103').classList.toggle('active', b === '103');
  document.getElementById('base-cnpj-label').textContent = 'CNPJ: ' + CNPJS[b];
  carregarProximoNum();
  carregarCadastros();
  todosRecibos = []; todosAnexos = [];
  if (document.getElementById('page-lista').classList.contains('active')) carregarRecibos();
  if (document.getElementById('page-anexos').classList.contains('active')) carregarAnexos();
}

function goTab(name, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  btn.classList.add('active');
}

// ── Próximo número ────────────────────────────────────────
async function carregarProximoNum() {
  if (!SupabaseClient.isReady()) return;
  try {
    const data = await SupabaseClient.rpc('next_recibo_numero', { p_base: baseAtual });
    document.getElementById('badge-num').textContent = 'Nº ' + String(data).padStart(4, '0');
  } catch (e) {
    document.getElementById('badge-num').textContent = 'Nº —';
  }
}

// ── Cadastros (autocomplete) ──────────────────────────────
async function carregarCadastros() {
  if (!SupabaseClient.isReady()) return;
  try {
    const [forn, mot, plc, prod] = await Promise.all([
      SupabaseClient.get('fornecedores', `base=eq.${baseAtual}&order=nome`),
      SupabaseClient.get('motoristas',   `base=eq.${baseAtual}&order=nome`),
      SupabaseClient.get('placas',       `base=eq.${baseAtual}&order=placa`),
      SupabaseClient.get('produtos',     `base=eq.${baseAtual}&order=nome`)
    ]);
    fornecedores = forn.map(r => r.nome);
    motoristas   = mot.map(r => r.nome);
    placas       = plc.map(r => r.placa);
    produtos     = prod.map(r => r.nome);
  } catch (e) {
    console.warn('Erro ao carregar cadastros:', e);
  }
}

// ── AUTOCOMPLETE ──────────────────────────────────────────
function acFiltrar(inputId, dropId, lista, tipo) {
  const q = document.getElementById(inputId).value.trim().toLowerCase();
  const drop = document.getElementById(dropId);
  acIdxMap[dropId] = -1;
  if (!q) { drop.classList.remove('open'); return; }
  const filtrados = lista.filter(f => f.toLowerCase().includes(q));
  let html = '';
  filtrados.slice(0, 8).forEach(f => {
    const dest = f.replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), m => `<b>${m}</b>`);
    html += `<div class="ac-item" data-val="${f}" onmousedown="acSelecionar('${inputId}','${dropId}','${f.replace(/'/g,"&#39;")}')">${dest}</div>`;
  });
  if (tipo === 'forn') {
    html += `<div class="ac-novo" onmousedown="abrirModalForn('${document.getElementById(inputId).value.trim()}')">＋ Cadastrar novo fornecedor</div>`;
  }
  drop.innerHTML = html;
  drop.classList.add('open');
}

function acAbrir(inputId, dropId, lista, tipo) {
  if (document.getElementById(inputId).value.trim()) acFiltrar(inputId, dropId, lista, tipo);
}

function acSelecionar(inputId, dropId, val) {
  document.getElementById(inputId).value = val;
  document.getElementById(dropId).classList.remove('open');
  acIdxMap[dropId] = -1;
}

function acNavegar(e, dropId) {
  const items = document.querySelectorAll('#' + dropId + ' .ac-item');
  if (!items.length) return;
  const idx = acIdxMap[dropId] || -1;
  if (e.key === 'ArrowDown') { e.preventDefault(); acIdxMap[dropId] = Math.min(idx + 1, items.length - 1); acDestaque(items, dropId); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); acIdxMap[dropId] = Math.max(idx - 1, 0); acDestaque(items, dropId); }
  else if (e.key === 'Enter' && (acIdxMap[dropId] || 0) >= 0 && idx >= 0) {
    e.preventDefault();
    const v = items[acIdxMap[dropId]].getAttribute('data-val');
    const inp = items[0].closest('.ac-wrap').querySelector('input');
    if (inp) acSelecionar(inp.id, dropId, v);
  }
  else if (e.key === 'Escape') document.getElementById(dropId).classList.remove('open');
}

function acDestaque(items, dropId) {
  const idx = acIdxMap[dropId] || 0;
  items.forEach((el, i) => el.classList.toggle('selected', i === idx));
  if (idx >= 0 && items[idx]) items[idx].scrollIntoView({ block: 'nearest' });
}

// ── MODAL FORNECEDOR ──────────────────────────────────────
function abrirModalForn(nome) {
  document.getElementById('novo-forn-input').value = nome.toUpperCase();
  document.getElementById('modal-forn').classList.add('open');
  setTimeout(() => document.getElementById('novo-forn-input').focus(), 100);
}

async function salvarNovoFornecedor() {
  const nome = document.getElementById('novo-forn-input').value.trim().toUpperCase();
  if (!nome) { showToast('Digite o nome!', 'err'); return; }
  const btn = document.getElementById('btn-salvar-forn');
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span>';
  try {
    await SupabaseClient.post('fornecedores', { nome, base: baseAtual });
    showToast('✅ Fornecedor cadastrado!', 'ok');
    document.getElementById('modal-forn').classList.remove('open');
    carregarCadastros();
    document.getElementById('f-forn').value = nome;
  } catch (e) {
    if (e.message.includes('unique')) showToast('⚠️ Fornecedor já cadastrado!', 'warn');
    else showToast('❌ ' + e.message, 'err');
  } finally {
    btn.disabled = false; btn.innerHTML = '✅ Cadastrar';
  }
}

// ── MOEDA / EXTENSO ───────────────────────────────────────
function fmtMoney(el) {
  let v = el.value.replace(/\D/g, '');
  if (!v) { el.value = ''; return; }
  el.value = 'R$ ' + (parseInt(v) / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function parseMoney(s) {
  if (s === undefined || s === null || s === '') return 0;
  if (typeof s === 'number') return s;
  return parseFloat(String(s).replace(/[R$\s.]/g, '').replace(',', '.')) || 0;
}

function toMoney(v) {
  const n = parseFloat(v);
  if (isNaN(n)) return '—';
  return 'R$ ' + n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function extenso(valor) {
  const un = ['','UM','DOIS','TRÊS','QUATRO','CINCO','SEIS','SETE','OITO','NOVE','DEZ','ONZE','DOZE','TREZE','QUATORZE','QUINZE','DEZESSEIS','DEZESSETE','DEZOITO','DEZENOVE'];
  const dz = ['','','VINTE','TRINTA','QUARENTA','CINQUENTA','SESSENTA','SETENTA','OITENTA','NOVENTA'];
  const ct = ['','CENTO','DUZENTOS','TREZENTOS','QUATROCENTOS','QUINHENTOS','SEISCENTOS','SETECENTOS','OITOCENTOS','NOVECENTOS'];
  function c(n) {
    if (!n) return '';
    if (n === 100) return 'CEM';
    if (n < 20) return un[n];
    if (n < 100) { const d = Math.floor(n/10), u = n%10; return dz[d] + (u ? ' E ' + un[u] : ''); }
    const h = Math.floor(n/100), r = n%100; return ct[h] + (r ? ' E ' + c(r) : '');
  }
  if (!valor || isNaN(valor)) return '';
  const reais = Math.floor(valor), cents = Math.round((valor - reais) * 100);
  let res = '';
  if (reais) res += c(reais) + (reais === 1 ? ' REAL' : ' REAIS');
  if (cents) res += (res ? ' E ' : '') + c(cents) + (cents === 1 ? ' CENTAVO' : ' CENTAVOS');
  return res || 'ZERO REAIS';
}

// ── CALC ──────────────────────────────────────────────────
function recalc() {
  const sel = document.getElementById('f-ref');
  const opt = sel.options[sel.selectedIndex];
  const vu = opt ? parseFloat(opt.getAttribute('data-val')) || 0 : 0;
  const qtd = parseFloat(document.getElementById('f-qtd').value) || 0;
  const desc = parseMoney(document.getElementById('f-descarga').value);
  const tp = vu * qtd, tg = tp + desc;
  document.getElementById('calc-total').textContent = tp > 0 ? toMoney(tp) : 'R$ 0,00';
  document.getElementById('total-geral').textContent = tg > 0 ? toMoney(tg) : 'R$ 0,00';
}

// ── SELECT TIPOS PAGAMENTO ────────────────────────────────
async function carregarSelectPgmt() {
  if (!SupabaseClient.isReady()) return;
  try {
    const data = await SupabaseClient.get('tipos_pagamento', 'order=descricao');
    const sel = document.getElementById('f-ref');
    sel.innerHTML = '<option value="">— Selecione —</option>' +
      data.map(t => `<option value="${t.id}" data-val="${t.valor}">${t.descricao} — ${toMoney(t.valor)}</option>`).join('');
  } catch (e) { console.warn('Erro tipos:', e); }
}

// ── SALVAR RECIBO ─────────────────────────────────────────
async function salvar() {
  if (!SupabaseClient.isReady()) { showToast('⚠️ Configure o Supabase primeiro!', 'warn'); return; }
  const sel = document.getElementById('f-ref');
  const opt = sel.options[sel.selectedIndex];
  const vu = opt ? parseFloat(opt.getAttribute('data-val')) || 0 : 0;
  const qtd = parseFloat(document.getElementById('f-qtd').value) || 0;
  const desc = parseMoney(document.getElementById('f-descarga').value);
  const tp = vu * qtd, tg = tp + desc;
  const tipoRecibo = document.querySelector('input[name="tipoRecibo"]:checked')?.value || 'AUTOMATICO';
  const transportadora = document.getElementById('f-transp').value.trim();
  const motorista = document.getElementById('f-motor').value.trim().toUpperCase();
  if (!transportadora || !motorista) { showToast('Preencha Transportadora e Motorista!', 'err'); return; }

  const btn = document.getElementById('btn-salvar');
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Salvando...';
  try {
    // Pega próximo número
    const numero = await SupabaseClient.rpc('next_recibo_numero', { p_base: baseAtual });

    const rec = {
      numero,
      base: baseAtual,
      transportadora,
      nf: document.getElementById('f-nf').value.trim(),
      ref_pgmt: opt && opt.value ? opt.text.split(' —')[0] : '',
      quantidade: document.getElementById('f-qtd').value.trim(),
      motorista,
      placa: document.getElementById('f-placa').value.trim().toUpperCase(),
      produto: document.getElementById('f-produto').value.trim().toUpperCase(),
      fornecedor: document.getElementById('f-forn').value.trim().toUpperCase(),
      vlr_descarga: desc,
      num_carga: document.getElementById('f-ncarga').value.trim(),
      tipo_recibo: tipoRecibo,
      valor_total: tg,
      status: 'EM ABERTO'
    };

    const [saved] = await SupabaseClient.post('recibos', rec);
    showToast('✅ Recibo #' + String(numero).padStart(4, '0') + ' salvo!', 'ok');

    // Salva cadastros novos em background
    const forn = rec.fornecedor, mot = rec.motorista, plc = rec.placa, prod = rec.produto;
    if (forn) SupabaseClient.post('fornecedores', { nome: forn, base: baseAtual }).catch(() => {});
    if (mot)  SupabaseClient.post('motoristas',   { nome: mot, base: baseAtual }).catch(() => {});
    if (plc)  SupabaseClient.post('placas',       { placa: plc, base: baseAtual }).catch(() => {});
    if (prod) SupabaseClient.post('produtos',     { nome: prod, base: baseAtual }).catch(() => {});

    renderRecibo2Vias({
      ...rec,
      numero: String(numero).padStart(4, '0'),
      vlrDescarga: toMoney(desc),
      totalProduto: toMoney(tp),
      totalGeral: toMoney(tg),
      valorPgmt: toMoney(vu),
      dataCriacao: new Date().toLocaleString('pt-BR')
    });

    carregarProximoNum();
    carregarCadastros();
    limpar();
  } catch (e) {
    showToast('❌ ' + e.message, 'err');
  } finally {
    btn.disabled = false; btn.innerHTML = '💾 Salvar Recibo';
  }
}

function limpar() {
  ['f-transp','f-nf','f-ncarga','f-placa','f-produto','f-motor','f-forn','f-descarga','f-qtd']
    .forEach(id => document.getElementById(id).value = '');
  document.getElementById('f-ref').value = '';
  document.getElementById('calc-total').textContent = 'R$ 0,00';
  document.getElementById('total-geral').textContent = 'R$ 0,00';
  document.getElementById('rb-auto').checked = true;
}

// ── RECIBO 2 VIAS ─────────────────────────────────────────
function buildViaHTML(r) {
  const desc = parseMoney(r.vlrDescarga), tp = parseMoney(r.totalProduto) || 0;
  const tg = parseMoney(r.totalGeral) || (desc + tp);
  const cnpj = CNPJS[r.base] || CNPJS['102'];
  const tipoLabel = r.tipo_recibo === 'MANUAL' ? '✍️ MANUAL' : '🖥️ AUTOMÁTICO';
  return `
    <div class="rec-topo">
      <div>
        <div class="rec-nome">GRUPO VANGUARDA &nbsp; S.A</div>
        <div class="rec-info">CNPJ: ${cnpj}<br/>Av. Deputado Paulo Ferraz Nº 4888 - Beira Rio — TERESINA-PI</div>
      </div>
      <div class="rec-logo">🦅</div>
    </div>
    <div class="rec-titulo">R E C I B O</div>
    <div class="rec-linha"><span class="lbl">Recebemos da Transportadora:</span><span class="val">&nbsp;${r.transportadora||'___________________'}&nbsp;</span><span class="lbl" style="margin-left:auto">${tipoLabel}</span></div>
    <div class="rec-linha">
      <span class="lbl">A quantia de:</span><span class="val" style="min-width:80px">&nbsp;${r.vlrDescarga||'__________'}&nbsp;</span>
      <span style="font-weight:400;font-size:11px;color:#555;">${extenso(desc)}</span>
    </div>
    <div class="rec-linha">
      <span class="lbl">Ref. Pagamento:</span><span class="val" style="min-width:90px">&nbsp;${r.ref_pgmt||'___________'}&nbsp;</span>
      <span class="lbl">&nbsp;&nbsp;Fornecedor:</span><span class="val">&nbsp;${r.fornecedor||'___________'}&nbsp;</span>
    </div>
    <div class="rec-linha">
      <span class="lbl">MOTORISTA:</span><span class="val">&nbsp;${r.motorista||'________________'}&nbsp;</span>
      <span class="lbl">&nbsp;&nbsp;PLACA:</span><span class="val" style="min-width:70px">&nbsp;${r.placa||'________'}&nbsp;</span>
    </div>
    <div class="rec-linha">
      <span class="lbl">PRODUTO:</span><span class="val" style="min-width:80px">&nbsp;${r.produto||'__________'}&nbsp;</span>
      <span class="lbl">&nbsp;&nbsp;QTD/PESO:</span><span class="val" style="min-width:40px">&nbsp;${r.quantidade||'___'}&nbsp;</span>
    </div>
    <div class="rec-linha">
      <span class="lbl">NF:</span><span class="val" style="min-width:80px">&nbsp;${r.nf||'__________'}&nbsp;</span>
      <span class="lbl">&nbsp;&nbsp;VLR UNIT.:</span><span class="val green">&nbsp;${r.valorPgmt||'_______'}&nbsp;</span>
      <span class="lbl">&nbsp;&nbsp;Nº CARGA:</span><span class="val">&nbsp;${r.num_carga||r.numCarga||'______'}&nbsp;</span>
    </div>
    ${tp > 0 ? `<div class="rec-linha"><span class="lbl">TOTAL PRODUTO (QTD × Unit.):</span><span class="val green">&nbsp;${r.totalProduto}&nbsp;</span></div>` : ''}
    <div class="rec-total-print">
      <span class="tpl">💵 VALOR TOTAL DO RECIBO</span>
      <span class="tpv">${toMoney(tg)}</span>
    </div>
    <div class="rec-rodape">
      <span>TERESINA-PI &nbsp; ${r.dataCriacao||''}</span>
      <span>BASE ${r.base||''} &nbsp;|&nbsp; Nº ${r.numero}</span>
    </div>`;
}

function renderRecibo2Vias(r) {
  const html = buildViaHTML(r);
  document.getElementById('print-area').innerHTML = `
    <div class="via-1">${html}</div>
    <div class="via-separator">✂ &nbsp; 2ª VIA &nbsp; ✂</div>
    <div class="via-2">${html}</div>`;
  const wrap = document.getElementById('recibo-wrap');
  wrap.style.display = 'block';
  wrap.scrollIntoView({ behavior: 'smooth' });
}

// ── HISTÓRICO ─────────────────────────────────────────────
async function carregarRecibos() {
  if (!SupabaseClient.isReady()) { showToast('⚠️ Configure o Supabase!', 'warn'); return; }
  document.getElementById('lista-box').innerHTML = '<div class="empty"><div class="ei">⏳</div><p>Carregando...</p></div>';
  try {
    const data = await SupabaseClient.get('recibos', `base=eq.${baseAtual}&order=numero.desc`);
    todosRecibos = data;
    aplicarFiltros();
  } catch (e) {
    document.getElementById('lista-box').innerHTML = `<div class="empty"><div class="ei">⚠️</div><p>${e.message}</p></div>`;
  }
}

function setStatusFiltro(s, btn) {
  filtroStatus = s;
  document.querySelectorAll('#page-lista .ftab').forEach(b => b.classList.remove('fa','fg','fo','fn'));
  btn.classList.add(s==='todos'?'fn':s==='EM ABERTO'?'fa':s==='PRESTADO'?'fg':'fo');
  aplicarFiltros();
}

function limparDatas(ctx) {
  document.getElementById('data-de-'+ctx).value = '';
  document.getElementById('data-ate-'+ctx).value = '';
  if (ctx === 'lista') aplicarFiltros(); else filtrarAnexos();
}

function parseDateISO(str) {
  if (!str) return null;
  return new Date(str);
}

function dentroDoIntervalo(dataCriacao, deStr, ateStr) {
  if (!deStr && !ateStr) return true;
  const d = dataCriacao ? new Date(dataCriacao) : null;
  if (!d) return true;
  if (deStr) { const de = new Date(deStr + 'T00:00:00'); if (d < de) return false; }
  if (ateStr) { const ate = new Date(ateStr + 'T23:59:59'); if (d > ate) return false; }
  return true;
}

function aplicarFiltros() {
  let lista = todosRecibos;
  const q = (document.getElementById('busca-lista').value || '').toLowerCase();
  const de = document.getElementById('data-de-lista').value;
  const ate = document.getElementById('data-ate-lista').value;
  if (filtroStatus !== 'todos') lista = lista.filter(r => (r.status || 'EM ABERTO') === filtroStatus);
  if (q) lista = lista.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(q)));
  lista = lista.filter(r => dentroDoIntervalo(r.data_criacao, de, ate));
  renderLista(lista);
}

function renderLista(lista) {
  if (!lista.length) {
    document.getElementById('lista-box').innerHTML = '<div class="empty"><div class="ei">📭</div><p>Nenhum recibo encontrado</p></div>';
    return;
  }
  document.getElementById('lista-box').innerHTML = lista.map(r => {
    const st = r.status || 'EM ABERTO';
    const cls = st === 'PRESTADO' ? 'recibo-item prestado' : st === 'FOTO ANEXADA' ? 'recibo-item foto' : 'recibo-item';
    const bc = st === 'PRESTADO' ? 'sbadge prestado' : st === 'FOTO ANEXADA' ? 'sbadge foto' : 'sbadge aberto';
    const bt = st === 'PRESTADO' ? '✅ PRESTADO' : st === 'FOTO ANEXADA' ? '🟠 FOTO ANEXADA' : '🔴 EM ABERTO';
    const num = String(r.numero).padStart(4, '0');
    const dt = r.data_criacao ? new Date(r.data_criacao).toLocaleString('pt-BR') : '';
    return `
    <div class="recibo-item ${st === 'PRESTADO' ? 'prestado' : st === 'FOTO ANEXADA' ? 'foto' : ''}" id="rec-${r.id}">
      <div class="ri-top">
        <div><div class="ri-sub">Nº Recibo</div><div class="ri-num">#${num}</div></div>
        <div><div class="ri-sub">Transportadora · Motorista</div><div class="ri-main">${r.transportadora||'—'} · ${r.motorista||'—'}</div></div>
        <div><div class="ri-sub">Total</div><div class="ri-valor">${toMoney(r.valor_total)}</div></div>
        <span class="${bc}">${bt}</span>
      </div>
      <div class="ri-actions">
        <button class="btn btn-primary btn-sm" onclick="imprimirItem('${r.id}')">🖨️ Imprimir</button>
        <button class="btn btn-blue btn-sm" onclick="verComprovantes('${r.id}','${num}')">📎 Ver Comprovante</button>
        <button class="btn btn-orange btn-sm" onclick="abrirEdicaoRecibo('${r.id}')">✏️ Editar</button>
        ${st !== 'PRESTADO'
          ? `<button class="btn btn-green btn-sm" onclick="mudarStatus('${r.id}','PRESTADO',this)">✅ Prestar Contas</button>`
          : `<button class="btn btn-ghost btn-sm" onclick="mudarStatus('${r.id}','EM ABERTO',this)">↩ Reabrir</button>`}
        <span style="font-size:11px;color:var(--muted);margin-left:auto">${dt}</span>
      </div>
    </div>`;
  }).join('');
}

// ── VER COMPROVANTES ──────────────────────────────────────
async function verComprovantes(reciboId, num) {
  document.getElementById('comp-titulo').textContent = `📎 Comprovantes — Recibo #${num}`;
  document.getElementById('comp-body').innerHTML = '<div class="empty"><div class="ei">⏳</div><p>Carregando...</p></div>';
  document.getElementById('modal-comp').classList.add('open');
  try {
    const fotos = await SupabaseClient.get('comprovantes', `recibo_id=eq.${reciboId}&order=created_at`);
    if (!fotos.length) {
      document.getElementById('comp-body').innerHTML = `
        <div class="empty"><div class="ei">📭</div><p>Nenhum comprovante anexado para este recibo.</p></div>
        <p style="text-align:center;margin-top:10px"><button class="btn btn-orange" onclick="goToAnexarRecibo('${reciboId}')">📎 Ir para Anexar Foto</button></p>`;
      return;
    }
    // Galeria de fotos
    document.getElementById('comp-body').innerHTML = `
      <p style="font-size:12px;color:var(--muted);margin-bottom:8px">${fotos.length} comprovante(s) anexado(s). Clique para ampliar.</p>
      <div class="comp-galeria" id="comp-galeria-${reciboId}">
        ${fotos.map(f => `
          <div class="comp-card" onclick="ampliarFoto('${f.url_publica}','${f.nome_arquivo||''}')">
            <img src="${f.url_publica}" alt="${f.nome_arquivo||'foto'}"
              onerror="this.src='';this.parentNode.style.background='#f2f2f2';this.parentNode.innerHTML='<div style=padding:20px;text-align:center;color:#888;font-size:12px>⚠️ Não carregou</div>'"/>
            <div class="comp-card-info">
              <span>${f.nome_arquivo||'foto'}</span>
              <a href="${f.url_publica}" target="_blank" onclick="event.stopPropagation()" style="color:var(--blue);font-size:11px">↗</a>
            </div>
          </div>`).join('')}
      </div>`;
  } catch (e) {
    document.getElementById('comp-body').innerHTML = `<div class="empty"><div class="ei">❌</div><p>${e.message}</p></div>`;
  }
}

function ampliarFoto(url, nome) {
  const win = window.open('', '_blank', 'width=900,height=700');
  win.document.write(`<html><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh">
    <img src="${url}" style="max-width:100%;max-height:100vh;object-fit:contain" title="${nome}"/>
  </body></html>`);
}

function goToAnexarRecibo(reciboId) {
  document.getElementById('modal-comp').classList.remove('open');
  goTab('anexos', document.querySelectorAll('.nav-tab')[2]);
  carregarAnexos();
}

function fecharModal(id, e) {
  if (e && e.target === document.getElementById(id))
    document.getElementById(id).classList.remove('open');
}

// ── EDITAR RECIBO ─────────────────────────────────────────
function abrirEdicaoRecibo(id) {
  const r = todosRecibos.find(x => x.id === id);
  if (!r) return;
  document.getElementById('edit-recibo-id').value = id;
  document.getElementById('edit-transp').value = r.transportadora || '';
  document.getElementById('edit-forn').value = r.fornecedor || '';
  document.getElementById('edit-motor').value = r.motorista || '';
  document.getElementById('edit-placa').value = r.placa || '';
  document.getElementById('edit-nf').value = r.nf || '';
  document.getElementById('edit-ncarga').value = r.num_carga || '';
  document.getElementById('edit-produto').value = r.produto || '';
  document.getElementById('edit-descarga').value = r.vlr_descarga ? toMoney(r.vlr_descarga) : '';
  document.getElementById('edit-status').value = r.status || 'EM ABERTO';
  document.getElementById('modal-editar').classList.add('open');
}

async function confirmarEdicaoRecibo() {
  const id = document.getElementById('edit-recibo-id').value;
  const btn = document.getElementById('btn-confirmar-edit');
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Salvando...';
  const vlr_descarga = parseMoney(document.getElementById('edit-descarga').value);
  const status = document.getElementById('edit-status').value;
  try {
    await SupabaseClient.patch('recibos', id, {
      transportadora: document.getElementById('edit-transp').value.trim(),
      fornecedor:     document.getElementById('edit-forn').value.trim().toUpperCase(),
      motorista:      document.getElementById('edit-motor').value.trim().toUpperCase(),
      placa:          document.getElementById('edit-placa').value.trim().toUpperCase(),
      nf:             document.getElementById('edit-nf').value.trim(),
      num_carga:      document.getElementById('edit-ncarga').value.trim(),
      produto:        document.getElementById('edit-produto').value.trim().toUpperCase(),
      vlr_descarga,
      status
    });
    showToast('✅ Recibo atualizado!', 'ok');
    document.getElementById('modal-editar').classList.remove('open');
    carregarRecibos();
  } catch (e) {
    showToast('❌ ' + e.message, 'err');
  } finally {
    btn.disabled = false; btn.innerHTML = '💾 Salvar Alterações';
  }
}

function imprimirItem(id) {
  const r = todosRecibos.find(x => x.id === id);
  if (!r) return;
  renderRecibo2Vias({
    ...r,
    numero: String(r.numero).padStart(4, '0'),
    vlrDescarga: toMoney(r.vlr_descarga),
    totalProduto: toMoney(0),
    totalGeral: toMoney(r.valor_total),
    valorPgmt: toMoney(0),
    dataCriacao: r.data_criacao ? new Date(r.data_criacao).toLocaleString('pt-BR') : ''
  });
  goTab('novo', document.querySelectorAll('.nav-tab')[0]);
  setTimeout(() => window.print(), 400);
}

async function mudarStatus(id, novoStatus, btn) {
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span>';
  try {
    await SupabaseClient.patch('recibos', id, { status: novoStatus });
    showToast('✅ Status atualizado!', 'ok');
    carregarRecibos();
    if (document.getElementById('page-anexos').classList.contains('active')) carregarAnexos();
  } catch (e) {
    showToast('❌ ' + e.message, 'err');
    btn.disabled = false;
  }
}

// ── ANEXAR FOTOS ──────────────────────────────────────────
async function carregarAnexos() {
  if (!SupabaseClient.isReady()) { showToast('⚠️ Configure o Supabase!', 'warn'); return; }
  document.getElementById('anexos-box').innerHTML = '<div class="empty"><div class="ei">⏳</div><p>Carregando...</p></div>';
  try {
    // Busca recibos e comprovantes juntos
    const [recibos, comps] = await Promise.all([
      SupabaseClient.get('recibos', `base=eq.${baseAtual}&order=numero.desc`),
      SupabaseClient.get('comprovantes', `base=eq.${baseAtual}&order=created_at`)
    ]);
    // Agrupa comprovantes por recibo_id
    const compMap = {};
    comps.forEach(c => {
      if (!compMap[c.recibo_id]) compMap[c.recibo_id] = [];
      compMap[c.recibo_id].push(c);
    });
    todosAnexos = recibos.map(r => ({ ...r, comprovantes: compMap[r.id] || [] }));
    filtrarAnexos();
  } catch (e) {
    document.getElementById('anexos-box').innerHTML = `<div class="empty"><div class="ei">⚠️</div><p>${e.message}</p></div>`;
  }
}

function setFiltroAnexo(s, btn) {
  filtroAnexoSt = s;
  document.querySelectorAll('#page-anexos .ftab').forEach(b => b.classList.remove('fa','fg','fo','fn'));
  btn.classList.add(s==='todos'?'fn':s==='AGUARDANDO FOTO'?'fa':s==='FOTO ANEXADA'?'fo':'fg');
  filtrarAnexos();
}

function filtrarAnexos() {
  let lista = todosAnexos;
  const q = (document.getElementById('busca-anexos').value || '').toLowerCase();
  const de = document.getElementById('data-de-anexos').value;
  const ate = document.getElementById('data-ate-anexos').value;

  if (filtroAnexoSt !== 'todos') {
    lista = lista.filter(a => {
      const temFoto = (a.comprovantes || []).length > 0;
      if (filtroAnexoSt === 'AGUARDANDO FOTO') return !temFoto && a.status !== 'PRESTADO';
      if (filtroAnexoSt === 'FOTO ANEXADA')    return temFoto && a.status !== 'PRESTADO';
      if (filtroAnexoSt === 'PRESTADO')        return a.status === 'PRESTADO';
      return true;
    });
  }
  if (q) lista = lista.filter(a => Object.values(a).some(v => String(v).toLowerCase().includes(q)));
  lista = lista.filter(a => dentroDoIntervalo(a.data_criacao, de, ate));
  renderAnexos(lista);
}

function renderAnexos(lista) {
  if (!lista.length) {
    document.getElementById('anexos-box').innerHTML = '<div class="empty"><div class="ei">📭</div><p>Nenhum recibo</p></div>';
    return;
  }
  document.getElementById('anexos-box').innerHTML = lista.map(a => {
    const temFoto = (a.comprovantes || []).length > 0;
    const prestado = a.status === 'PRESTADO';
    const cls = prestado ? 'anexo-item prestado' : temFoto ? 'anexo-item com-foto' : 'anexo-item';
    const bc = prestado ? 'sbadge prestado' : temFoto ? 'sbadge foto' : 'sbadge aguard';
    const bt = prestado ? '✅ PRESTADO' : temFoto ? `🟠 ${a.comprovantes.length} FOTO(S)` : '⏳ AGUARDANDO';
    const num = String(a.numero).padStart(4, '0');
    const dt = a.data_criacao ? new Date(a.data_criacao).toLocaleString('pt-BR') : '';

    // Miniatura das fotos existentes
    const galeria = temFoto ? `
      <div class="galeria" style="margin-top:8px">
        ${a.comprovantes.map(c => `
          <div class="galeria-thumb" onclick="ampliarFoto('${c.url_publica}','${c.nome_arquivo||''}')">
            <img src="${c.url_publica}" alt="foto"
              onerror="this.parentNode.style.background='#eee';this.style.display='none'"/>
            ${!prestado ? `<button class="del-btn" onclick="event.stopPropagation();deletarComprovante('${c.id}','${a.id}',this)" title="Remover">×</button>` : ''}
          </div>`).join('')}
      </div>` : '';

    return `
    <div class="${cls}" id="anexo-${a.id}">
      <div class="ri-top" style="grid-template-columns:80px 1fr 120px 150px">
        <div><div class="ri-sub">Nº Recibo</div><div class="ri-num" style="color:${prestado?'var(--green)':temFoto?'var(--orange)':'var(--red)'}">#${num}</div></div>
        <div>
          <div class="ri-sub">Transportadora · Motorista</div>
          <div class="ri-main">${a.transportadora||'—'} · ${a.motorista||'—'}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">${dt}</div>
        </div>
        <div><div class="ri-sub">Total</div><div class="ri-valor">${toMoney(a.valor_total)}</div></div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
          <span class="${bc}">${bt}</span>
        </div>
      </div>
      ${galeria}
      ${!prestado ? `
      <div class="upload-area">
        <div style="margin-bottom:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <label style="font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;color:var(--red-dark)">📎 Adicionar foto(s)</label>
          <span style="font-size:11px;color:var(--muted)">— Pode selecionar mais de uma</span>
        </div>
        <div class="upload-zone" id="zone-${a.id}"
          ondragover="event.preventDefault();this.classList.add('drag')"
          ondragleave="this.classList.remove('drag')"
          ondrop="handleDrop(event,'${a.id}','${a.numero}')"
          onclick="document.getElementById('file-${a.id}').click()">
          <strong>📷 Clique ou arraste as fotos</strong>
          <p>JPG, PNG, WEBP aceitos — Múltiplas fotos permitidas</p>
        </div>
        <input type="file" id="file-${a.id}" accept="image/*" multiple style="display:none"
          onchange="handleFiles(this,'${a.id}','${a.numero}')"/>
        <div id="preview-${a.id}" style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px"></div>
        ${temFoto ? `<div style="margin-top:6px"><button class="btn btn-green btn-sm" onclick="prestarContas('${a.id}',this)">✅ Prestar Contas</button></div>` : ''}
      </div>` : ''}
    </div>`;
  }).join('');
}

// ── UPLOAD MÚLTIPLAS FOTOS ────────────────────────────────
function handleDrop(e, reciboId, numero) {
  e.preventDefault();
  document.getElementById('zone-' + reciboId).classList.remove('drag');
  const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'));
  if (files.length) processFiles(files, reciboId, numero);
}

function handleFiles(input, reciboId, numero) {
  const files = [...input.files];
  if (files.length) processFiles(files, reciboId, numero);
}

function processFiles(files, reciboId, numero) {
  const preview = document.getElementById('preview-' + reciboId);
  const num = String(numero).padStart(4, '0');

  files.forEach((file, idx) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        const MAX = 1200; let w = img.width, h = img.height;
        if (w > MAX || h > MAX) { if (w > h) { h = Math.round(h * MAX / w); w = MAX; } else { w = Math.round(w * MAX / h); h = MAX; } }
        const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const blob64 = canvas.toDataURL('image/jpeg', 0.80);
        const blob = dataURLtoBlob(blob64);
        const kb = Math.round(blob.size / 1024);
        const ts = Date.now() + idx;
        const nomeArq = `Recibo-${num}_${ts}.jpg`;

        // Mini preview no UI
        const div = document.createElement('div');
        div.id = `prev-${reciboId}-${ts}`;
        div.style.cssText = 'position:relative;display:inline-block';
        div.innerHTML = `
          <img src="${blob64}" style="width:80px;height:60px;object-fit:cover;border-radius:6px;border:2px solid var(--border)"/>
          <div style="font-size:10px;color:var(--muted);text-align:center">${kb}KB</div>
          <button style="position:absolute;top:1px;right:1px;background:var(--red);color:#fff;border:none;border-radius:50%;width:16px;height:16px;font-size:9px;cursor:pointer;display:flex;align-items:center;justify-content:center"
            onclick="this.closest('#prev-${reciboId}-${ts}').remove()">×</button>`;
        preview.appendChild(div);

        // Adiciona botão de enviar (só uma vez)
        let btnEnviar = document.getElementById('btn-enviar-' + reciboId);
        if (!btnEnviar) {
          btnEnviar = document.createElement('div');
          btnEnviar.id = 'btn-enviar-' + reciboId;
          btnEnviar.style.cssText = 'width:100%;margin-top:8px';
          btnEnviar.innerHTML = `<button class="btn btn-green" id="btn-up-${reciboId}" onclick="uploadTodas('${reciboId}','${numero}')">⬆️ Enviar todas as fotos</button>`;
          preview.parentNode.appendChild(btnEnviar);
        }

        // Guarda blob para upload
        if (!window._blobs) window._blobs = {};
        if (!window._blobs[reciboId]) window._blobs[reciboId] = [];
        window._blobs[reciboId].push({ blob, nomeArq });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function dataURLtoBlob(dataURL) {
  const arr = dataURL.split(','), mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8 = new Uint8Array(n);
  while (n--) u8[n] = bstr.charCodeAt(n);
  return new Blob([u8], { type: mime });
}

async function uploadTodas(reciboId, numero) {
  const blobs = window._blobs?.[reciboId];
  if (!blobs || !blobs.length) { showToast('⚠️ Nenhuma foto para enviar!', 'warn'); return; }
  const btn = document.getElementById('btn-up-' + reciboId);
  btn.disabled = true;
  let ok = 0;
  for (let i = 0; i < blobs.length; i++) {
    btn.innerHTML = `<span class="spin"></span> Enviando ${i+1}/${blobs.length}...`;
    const { blob, nomeArq } = blobs[i];
    try {
      const path = `${baseAtual}/${numero}/${nomeArq}`;
      const url = await SupabaseClient.uploadFile('comprovantes', path, blob, 'image/jpeg');
      // Busca id do recibo
      const recs = todosAnexos.filter(a => a.id === reciboId);
      await SupabaseClient.post('comprovantes', {
        recibo_id: reciboId,
        numero_recibo: parseInt(numero),
        base: baseAtual,
        nome_arquivo: nomeArq,
        storage_path: path,
        url_publica: url
      });
      // Atualiza status do recibo
      await SupabaseClient.patch('recibos', reciboId, { status: 'FOTO ANEXADA' });
      ok++;
    } catch (e) {
      showToast(`❌ Erro na foto ${i+1}: ${e.message}`, 'err');
    }
  }
  delete window._blobs[reciboId];
  showToast(`✅ ${ok} foto(s) enviada(s)!`, 'ok');
  carregarAnexos();
}

async function deletarComprovante(compId, reciboId, btn) {
  if (!confirm('Remover este comprovante?')) return;
  btn.disabled = true;
  try {
    // Busca o path para deletar do storage
    const comps = await SupabaseClient.get('comprovantes', `id=eq.${compId}`);
    if (comps.length && comps[0].storage_path) {
      await SupabaseClient.deleteFile('comprovantes', comps[0].storage_path);
    }
    await SupabaseClient.del('comprovantes', compId);
    // Verifica se ficou sem foto
    const restantes = await SupabaseClient.get('comprovantes', `recibo_id=eq.${reciboId}`);
    if (!restantes.length) {
      await SupabaseClient.patch('recibos', reciboId, { status: 'EM ABERTO' });
    }
    showToast('✅ Comprovante removido!', 'ok');
    carregarAnexos();
  } catch (e) {
    showToast('❌ ' + e.message, 'err');
  }
}

async function prestarContas(reciboId, btn) {
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span>';
  try {
    await SupabaseClient.patch('recibos', reciboId, { status: 'PRESTADO' });
    showToast('✅ Contas prestadas!', 'ok');
    carregarAnexos();
    if (document.getElementById('page-lista').classList.contains('active')) carregarRecibos();
  } catch (e) {
    showToast('❌ ' + e.message, 'err');
    btn.disabled = false;
  }
}

// ── ADM (TIPOS PAGAMENTO) ─────────────────────────────────
async function carregarAdm() {
  if (!SupabaseClient.isReady()) return;
  document.getElementById('adm-lista').innerHTML = '<div class="empty"><div class="ei">⏳</div></div>';
  try {
    const lista = await SupabaseClient.get('tipos_pagamento', 'order=descricao');
    if (!lista.length) {
      document.getElementById('adm-lista').innerHTML = '<div class="empty"><div class="ei">📋</div><p>Nenhum tipo</p></div>';
      return;
    }
    document.getElementById('adm-lista').innerHTML = lista.map(t => `
      <div class="pgmt-item">
        <div><div class="pgmt-desc">${t.descricao}</div><div class="pgmt-val">${toMoney(t.valor)}/un</div></div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm" onclick="abrirEditTipo('${t.id}','${t.descricao}','${t.valor}')">✏️</button>
          <button class="btn btn-sm" style="background:#fadbd8;color:var(--red)" onclick="deletePgmt('${t.id}')">🗑️</button>
        </div>
      </div>`).join('');
  } catch (e) { console.warn(e); }
}

async function addPgmt() {
  const desc = document.getElementById('adm-desc').value.trim();
  const val = parseMoney(document.getElementById('adm-val').value);
  if (!desc || !val) { showToast('Preencha os campos!', 'err'); return; }
  const btn = document.getElementById('btn-adm-add');
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span>';
  try {
    await SupabaseClient.post('tipos_pagamento', { descricao: desc, valor: val });
    showToast('✅ Tipo adicionado!', 'ok');
    document.getElementById('adm-desc').value = '';
    document.getElementById('adm-val').value = '';
    carregarAdm(); carregarSelectPgmt();
  } catch (e) { showToast('❌ ' + e.message, 'err'); }
  finally { btn.disabled = false; btn.innerHTML = '＋ Adicionar'; }
}

function abrirEditTipo(id, desc, val) {
  document.getElementById('edit-tipo-id').value = id;
  document.getElementById('edit-tipo-desc').value = desc;
  document.getElementById('edit-tipo-val').value = toMoney(val);
  document.getElementById('modal-edit').classList.add('open');
}

async function confirmarEdicaoTipo() {
  const id = document.getElementById('edit-tipo-id').value;
  const desc = document.getElementById('edit-tipo-desc').value.trim();
  const val = parseMoney(document.getElementById('edit-tipo-val').value);
  if (!desc || !val) { showToast('Preencha tudo!', 'err'); return; }
  try {
    await SupabaseClient.patch('tipos_pagamento', id, { descricao: desc, valor: val });
    showToast('✅ Atualizado!', 'ok');
    document.getElementById('modal-edit').classList.remove('open');
    carregarAdm(); carregarSelectPgmt();
  } catch (e) { showToast('❌ ' + e.message, 'err'); }
}

async function deletePgmt(id) {
  if (!confirm('Excluir?')) return;
  try {
    await SupabaseClient.del('tipos_pagamento', id);
    showToast('✅ Excluído!', 'ok');
    carregarAdm(); carregarSelectPgmt();
  } catch (e) { showToast('❌ ' + e.message, 'err'); }
}

// ── TOAST ─────────────────────────────────────────────────
function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show ' + type;
  setTimeout(() => t.className = '', 3500);
}
