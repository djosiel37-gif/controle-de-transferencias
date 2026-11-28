/* Controle de Transferências — app principal. */
import { firebaseConfig } from './firebase-config.js';
import { iniciar, sessao, DB, normalizarUsuario } from './db.js';

// ---------- Utilidades ----------
const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hojeISO = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
const dataBR = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return esc(iso);
  const temHora = String(iso).length > 10;
  return d.toLocaleDateString('pt-BR', temHora ? {} : { timeZone: 'UTC' }) +
    (temHora ? ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
};
const reais = (v) =>
  v === '' || v == null || isNaN(Number(v)) ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
// Ícones de traço (SVG) usados nas telas.
const ICONES = {
  alerta: '<path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  maquina: '<circle cx="7" cy="17" r="3"/><circle cx="18" cy="18" r="2"/><path d="M4 14V8h7l2 6M11 8V5h4l2 6h3v5h-2M10 17h6"/>',
  transito: '<path d="M4 8h14l-4-4M20 16H6l4 4"/>',
  conserto: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3 17.8V21h3.2l6.3-6.3a4 4 0 0 0 5.2-5.4l-2.5 2.5-2.5-.5-.5-2.5z"/>',
  seta: '<path d="m9 6 6 6-6 6"/>',
  mais: '<path d="M12 5v14M5 12h14"/>'
};
const icone = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONES[n]}</svg>`;
const num = (v) => (v === '' || v == null ? '' : Number(String(v).replace(',', '.')));

// ---------- Checklist padrão (editável em "Mais") ----------
const CHECKLIST_PADRAO = [
  { id: 'horimetro', rotulo: 'Horímetro / odômetro', tipo: 'numero' },
  { id: 'combustivel', rotulo: 'Nível de combustível', tipo: 'nivel' },
  { id: 'pneus', rotulo: 'Pneus / esteiras', tipo: 'ok' },
  { id: 'oleo_motor', rotulo: 'Nível de óleo do motor', tipo: 'ok' },
  { id: 'oleo_hidraulico', rotulo: 'Óleo hidráulico', tipo: 'ok' },
  { id: 'baterias', rotulo: 'Baterias', tipo: 'ok' },
  { id: 'vazamentos', rotulo: 'Sem vazamentos', tipo: 'ok' },
  { id: 'avarias', rotulo: 'Lataria / estrutura sem avarias', tipo: 'ok' },
  { id: 'luzes', rotulo: 'Luzes e sinalização', tipo: 'ok' },
  { id: 'extintor', rotulo: 'Extintor', tipo: 'ok' },
  { id: 'documentos', rotulo: 'Documentos e ferramentas', tipo: 'ok' },
  { id: 'acessorios', rotulo: 'Acessórios / implementos que acompanham', tipo: 'texto' }
];
const NIVEIS = ['Reserva', '1/4', '1/2', '3/4', 'Cheio'];
const STATUS_MAQ = {
  disponivel: ['Na fazenda', 'e-ok'],
  transito: ['Em trânsito', 'e-transito'],
  conserto: ['Em conserto', 'e-conserto']
};

async function checklistModelo() {
  const c = await DB.obter('config', 'checklist');
  return c ? c.itens : CHECKLIST_PADRAO;
}

// ---------- Cache simples por renderização ----------
async function carregarTudo() {
  const [fazendas, maquinas, transferencias, consertos] = await Promise.all(
    ['fazendas', 'maquinas', 'transferencias', 'consertos'].map((l) => DB.todos(l))
  );
  const fz = Object.fromEntries(fazendas.map((f) => [f.id, f]));
  const mq = Object.fromEntries(maquinas.map((m) => [m.id, m]));
  return { fazendas, maquinas, transferencias, consertos, fz, mq };
}
const nomeFazenda = (d, id) => (d.fz[id] ? d.fz[id].nome : '—');
const nomeMaquina = (d, id) => (d.mq[id] ? `${d.mq[id].codigo ? d.mq[id].codigo + ' · ' : ''}${d.mq[id].nome}` : '(máquina removida)');
const porData = (campo) => (a, b) => String(b[campo] || '').localeCompare(String(a[campo] || ''));

// ---------- Fotos (comprimidas para caber no aparelho) ----------
function comprimirFoto(arquivo, max = 1024, qualidade = 0.6) {
  return new Promise((ok, erro) => {
    const img = new Image();
    const url = URL.createObjectURL(arquivo);
    img.onload = () => {
      const escala = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * escala);
      c.height = Math.round(img.height * escala);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      ok(c.toDataURL('image/jpeg', qualidade));
    };
    img.onerror = erro;
    img.src = url;
  });
}

// ---------- Componente: formulário de checklist ----------
function htmlChecklist(itens, prefixo, anterior) {
  return itens.map((it) => {
    const nome = `${prefixo}_${it.id}`;
    const ref = anterior && anterior.respostas && anterior.respostas[it.id];
    const dica = ref ? `<div class="suave">Na saída: ${esc(textoResposta(it, ref))}</div>` : '';
    let campo;
    if (it.tipo === 'numero') {
      campo = `<input name="${nome}" inputmode="decimal" placeholder="Ex: 1520,5">`;
    } else if (it.tipo === 'nivel') {
      campo = `<select name="${nome}"><option value="">Selecione</option>${NIVEIS.map((n) => `<option>${n}</option>`).join('')}</select>`;
    } else if (it.tipo === 'texto') {
      campo = `<input name="${nome}" placeholder="Descreva">`;
    } else {
      campo = `<div class="opcoes">
        <label><input type="radio" name="${nome}" value="ok"> OK</label>
        <label><input type="radio" name="${nome}" value="problema"> Problema</label>
        <label><input type="radio" name="${nome}" value="na"> N/A</label>
      </div>
      <input name="${nome}_obs" placeholder="Observação (se tiver problema)" style="margin-top:6px">`;
    }
    return `<div class="check-item"><div class="titulo">${esc(it.rotulo)}</div>${dica}${campo}</div>`;
  }).join('');
}

function htmlBlocoChecklist(itens, prefixo, rotuloResp, anterior) {
  return `
    <h3>Checklist</h3>
    <div class="cartao">${htmlChecklist(itens, prefixo, anterior)}</div>
    <label>${rotuloResp} *</label>
    <input name="${prefixo}_responsavel" required>
    <label>Observações gerais</label>
    <textarea name="${prefixo}_obs"></textarea>
    <label>Fotos</label>
    <input type="file" accept="image/*" capture="environment" multiple data-fotos="${prefixo}">
    <div class="fotos" id="fotos_${prefixo}"></div>`;
}

const fotosPendentes = {};
function ligarFotos(form) {
  $$('[data-fotos]', form).forEach((inp) => {
    const p = inp.dataset.fotos;
    fotosPendentes[p] = [];
    inp.addEventListener('change', async () => {
      for (const f of inp.files) {
        try { fotosPendentes[p].push(await comprimirFoto(f)); } catch { alert('Não foi possível ler uma das fotos.'); }
      }
      inp.value = '';
      $(`#fotos_${p}`).innerHTML = fotosPendentes[p].map((src) => `<img src="${src}" alt="foto">`).join('');
    });
  });
}

async function lerChecklist(form, itens, prefixo) {
  const fd = new FormData(form);
  const respostas = {};
  for (const it of itens) {
    const v = fd.get(`${prefixo}_${it.id}`);
    if (it.tipo === 'ok') respostas[it.id] = { valor: v || '', obs: fd.get(`${prefixo}_${it.id}_obs`) || '' };
    else respostas[it.id] = { valor: it.tipo === 'numero' ? num(v) : (v || '') };
  }
  return {
    itens: itens.map((i) => ({ ...i })), // guarda o modelo usado, caso ele mude depois
    respostas,
    responsavel: fd.get(`${prefixo}_responsavel`) || '',
    obs: fd.get(`${prefixo}_obs`) || '',
    fotoIds: await Promise.all((fotosPendentes[prefixo] || []).map((f) => DB.salvarFoto(f))),
    data: fd.get(`${prefixo}_data`) || hojeISO()
  };
}

function textoResposta(it, r) {
  if (!r) return '—';
  if (it.tipo === 'ok') {
    const v = { ok: 'OK', problema: 'Problema', na: 'N/A' }[r.valor] || '—';
    return r.obs ? `${v} (${r.obs})` : v;
  }
  return r.valor === '' || r.valor == null ? '—' : String(r.valor);
}

function divergencias(saida, chegada) {
  if (!saida || !chegada) return [];
  const lista = [];
  for (const it of chegada.itens) {
    const a = saida.respostas[it.id], b = chegada.respostas[it.id];
    if (!a || !b) continue;
    if (it.tipo === 'ok' && a.valor === 'ok' && b.valor === 'problema') lista.push(`${it.rotulo}: estava OK na saída, chegou com problema${b.obs ? ' (' + b.obs + ')' : ''}`);
    if (it.tipo === 'nivel' && a.valor && b.valor && NIVEIS.indexOf(b.valor) < NIVEIS.indexOf(a.valor)) lista.push(`${it.rotulo}: saiu ${a.valor}, chegou ${b.valor}`);
    if (it.tipo === 'numero' && a.valor !== '' && b.valor !== '' && Number(b.valor) < Number(a.valor)) lista.push(`${it.rotulo}: valor na chegada (${b.valor}) menor que na saída (${a.valor})`);
    if (it.tipo === 'texto' && a.valor && b.valor && a.valor.trim().toLowerCase() !== b.valor.trim().toLowerCase()) lista.push(`${it.rotulo}: saída "${a.valor}" / chegada "${b.valor}"`);
  }
  return lista;
}

function htmlChecklistLeitura(ck, titulo, outro) {
  if (!ck) return '';
  const div = outro ? divergencias(outro, ck) : [];
  return `
    <h3>${esc(titulo)}</h3>
    ${div.length ? `<div class="aviso"><b>Divergências em relação à saída:</b><br>${div.map(esc).join('<br>')}</div>` : ''}
    <div class="cartao">
      <div class="linha"><span class="suave">${dataBR(ck.data)}</span><span>Resp.: <b>${esc(ck.responsavel)}</b></span></div>
      <table class="tabela-check">${ck.itens.map((it) => {
        const r = ck.respostas[it.id];
        const ruim = it.tipo === 'ok' && r && r.valor === 'problema';
        return `<tr><td>${esc(it.rotulo)}</td><td style="text-align:right${ruim ? ';color:var(--erro);font-weight:700' : ''}">${esc(textoResposta(it, r))}</td></tr>`;
      }).join('')}</table>
      ${ck.obs ? `<p><b>Obs.:</b> ${esc(ck.obs)}</p>` : ''}
      ${ck.fotos && ck.fotos.length ? `<div class="fotos">${ck.fotos.map((s) => `<a href="${s}" target="_blank"><img src="${s}" alt="foto"></a>`).join('')}</div>` : ''}
      ${ck.fotoIds && ck.fotoIds.length ? `<div class="fotos">${ck.fotoIds.map((id) => `<img data-foto="${esc(id)}" alt="carregando foto">`).join('')}</div>` : ''}
    </div>`;
}

function etiquetaMaquina(m) {
  const [t, c] = STATUS_MAQ[m.status || 'disponivel'];
  return `<span class="etiqueta ${c}">${t}</span>`;
}
const optFazendas = (d, sel, excluir) =>
  d.fazendas.filter((f) => f.id !== excluir).sort((a, b) => a.nome.localeCompare(b.nome))
    .map((f) => `<option value="${f.id}" ${f.id === sel ? 'selected' : ''}>${esc(f.nome)}</option>`).join('');

// ---------- Telas ----------
const telas = {};

// ---------- Alertas ----------
const HORAS_TRANSITO_PADRAO = 24;
async function calcularAlertas(d) {
  const cfg = (await DB.obter('config', 'alertas')) || {};
  const horas = Number(cfg.horasTransito) || HORAS_TRANSITO_PADRAO;
  const hoje = hojeISO().slice(0, 10);
  const agora = Date.now();
  const lista = [];
  for (const c of d.consertos.filter((x) => x.status === 'oficina' && x.prazo && x.prazo < hoje)) {
    const dias = Math.round((new Date(hoje) - new Date(c.prazo)) / 86400000);
    lista.push({ href: `#/consertos/${c.id}`, tipo: 'e-erro',
      texto: `${nomeMaquina(d, c.maquinaId)}: conserto em ${c.oficina} com prazo vencido há ${dias} dia${dias > 1 ? 's' : ''}` });
  }
  for (const t of d.transferencias.filter((x) => x.status === 'transito')) {
    const h = (agora - new Date(t.dataSaida).getTime()) / 3600000;
    if (h >= horas) lista.push({ href: `#/transferencias/${t.id}`, tipo: 'e-transito',
      texto: `${nomeMaquina(d, t.maquinaId)}: em trânsito há ${h >= 48 ? Math.floor(h / 24) + ' dias' : Math.floor(h) + ' horas'} (${nomeFazenda(d, t.origemId)} → ${nomeFazenda(d, t.destinoId)}), sem registro de chegada` });
  }
  if (sessao.admin && !sessao.emailReal) lista.push({ href: '#/mais', tipo: 'e-conserto',
    texto: 'Cadastre um e-mail para recuperar sua senha (Mais → Minha conta)' });
  return { lista, horas };
}
async function atualizarSelo() {
  try {
    const { lista } = await calcularAlertas(await carregarTudo());
    const selo = $('.abas a[data-aba="inicio"] .selo');
    if (selo) { selo.textContent = lista.length; selo.hidden = !lista.length; }
  } catch {}
}

const saudacao = () => { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; };

telas.inicio = async (_0, _1, ctx) => {
  const d = await carregarTudo();
  const { lista: alertas } = await calcularAlertas(d);
  const transito = d.transferencias.filter((t) => t.status === 'transito').sort(porData('dataSaida'));
  const oficina = d.consertos.filter((c) => c.status === 'oficina').sort(porData('dataEnvio'));
  const hoje = hojeISO().slice(0, 10);
  const semCadastro = !d.fazendas.length
    ? (sessao.admin ? `<div class="aviso">Comece cadastrando as fazendas em <a href="#/mais">Mais → Fazendas</a> e depois as máquinas.</div>`
      : `<div class="aviso">Ainda não há fazendas cadastradas. Peça ao administrador.</div>`) : '';
  return `
    ${semCadastro}
    <div class="saudacao">
      <h2>${saudacao()}, ${esc(sessao.perfil.nome.split(' ')[0])}</h2>
      <div class="suave">${((x) => x[0].toUpperCase() + x.slice(1))(new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }))}</div>
    </div>
    ${alertas.length ? `<div class="alertas">
      <div class="cab">${icone('alerta', 'peq')} Precisa de atenção (${alertas.length})</div>
      ${alertas.map((a) => `<a href="${a.href}"><span class="marcador" style="--cor:var(--${a.tipo === 'e-erro' ? 'erro' : a.tipo === 'e-transito' ? 'azul' : 'alerta'})"></span><span>${esc(a.texto)}</span>${icone('seta', 'peq')}</a>`).join('')}
    </div>` : ''}
    <div class="resumo">
      <a class="cartao" href="#/maquinas">${icone('maquina')}<b>${d.maquinas.length}</b><span class="suave">máquinas</span></a>
      <a class="cartao k-transito" href="#/transferencias">${icone('transito')}<b>${transito.length}</b><span class="suave">em trânsito</span></a>
      <a class="cartao k-conserto" href="#/consertos">${icone('conserto')}<b>${oficina.length}</b><span class="suave">em conserto</span></a>
    </div>
    <div class="acoes">
      <a class="botao" href="#/transferencias/nova">${icone('transito', 'peq')} Nova transferência</a>
      <a class="botao sec" href="#/consertos/novo">${icone('conserto', 'peq')} Enviar p/ conserto</a>
    </div>
    <h3>Aguardando recebimento</h3>
    ${transito.length ? transito.map((t) => `
      <a class="cartao" href="#/transferencias/${t.id}">
        <div class="linha"><b>${esc(nomeMaquina(d, t.maquinaId))}</b><span class="etiqueta e-transito">Em trânsito</span></div>
        <div class="suave">${esc(nomeFazenda(d, t.origemId))} → ${esc(nomeFazenda(d, t.destinoId))} · saiu ${dataBR(t.dataSaida)}</div>
      </a>`).join('') : '<p class="vazio">Nada em trânsito.</p>'}
    <h3>Na oficina</h3>
    ${oficina.length ? oficina.map((c) => {
      const atrasado = c.prazo && c.prazo < hoje;
      return `<a class="cartao" href="#/consertos/${c.id}">
        <div class="linha"><b>${esc(nomeMaquina(d, c.maquinaId))}</b>
          <span class="etiqueta ${atrasado ? 'e-erro' : 'e-conserto'}">${atrasado ? 'Prazo vencido' : 'Na oficina'}</span></div>
        <div class="suave">${esc(c.oficina)} · prazo ${dataBR(c.prazo)}</div>
      </a>`;
    }).join('') : '<p class="vazio">Nenhuma máquina na oficina.</p>'}`;
};

// --- Máquinas ---
telas.maquinas = async (_0, _1, ctx) => {
  const d = await carregarTudo();
  const lista = d.maquinas.sort((a, b) => (a.codigo || a.nome).localeCompare(b.codigo || b.nome));
  ctx.depois(() => {
    const b = $('#busca');
    if (b) b.addEventListener('input', () => {
      const q = b.value.toLowerCase();
      $$('[data-busca]').forEach((el) => (el.style.display = el.dataset.busca.includes(q) ? '' : 'none'));
    });
  });
  return `
    <div class="linha"><h2>Máquinas e equipamentos</h2>${sessao.admin ? '<a class="botao" href="#/maquinas/nova">+ Nova</a>' : ''}</div>
    <input id="busca" class="busca" placeholder="Buscar por código, nome, fazenda…">
    ${lista.length ? lista.map((m) => `
      <a class="cartao" href="#/maquinas/${m.id}" data-busca="${esc([m.codigo, m.nome, m.tipo, m.marca, nomeFazenda(d, m.fazendaId)].join(' ').toLowerCase())}">
        <div class="linha"><b>${esc(nomeMaquina(d, m.id))}</b>${etiquetaMaquina(m)}</div>
        <div class="suave">${esc(m.tipo || '')}${m.marca ? ' · ' + esc(m.marca) : ''} · ${m.status === 'conserto' ? 'Oficina' : esc(nomeFazenda(d, m.fazendaId))}</div>
      </a>`).join('') : '<p class="vazio">Nenhuma máquina cadastrada.</p>'}`;
};

telas.maquinaForm = async (id, _1, ctx) => {
  if (!sessao.admin) return '<p>Só o administrador pode fazer isso.</p>';
  const d = await carregarTudo();
  const m = id ? d.mq[id] : { status: 'disponivel' };
  if (!m) return '<p>Máquina não encontrada.</p>';
  if (!d.fazendas.length) return `<div class="aviso">Cadastre pelo menos uma fazenda antes. <a href="#/fazendas/nova">Cadastrar fazenda</a></div>`;
  ctx.depois(() => {
    $('#form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const obj = { ...m, ...Object.fromEntries(fd) };
      obj.status = obj.status || 'disponivel';
      await DB.salvar('maquinas', obj);
      location.hash = `#/maquinas/${obj.id}`;
    });
  });
  return `
    <h2>${id ? 'Editar máquina' : 'Nova máquina'}</h2>
    <form id="form">
      <div class="duas">
        <div><label>Código / frota</label><input name="codigo" value="${esc(m.codigo)}" placeholder="Ex: TR-04"></div>
        <div><label>Tipo</label><input name="tipo" value="${esc(m.tipo)}" list="tipos" placeholder="Trator, grade, pulverizador…"></div>
      </div>
      <datalist id="tipos">${['Trator', 'Colheitadeira', 'Pulverizador', 'Plantadeira', 'Grade', 'Roçadeira', 'Caminhão', 'Carreta', 'Pá carregadeira', 'Escavadeira', 'Motoniveladora', 'Gerador', 'Motobomba', 'Implemento'].map((t) => `<option>${t}</option>`).join('')}</datalist>
      <label>Nome / descrição *</label><input name="nome" required value="${esc(m.nome)}" placeholder="Ex: Trator John Deere 6110J">
      <div class="duas">
        <div><label>Marca / modelo</label><input name="marca" value="${esc(m.marca)}"></div>
        <div><label>Placa / nº de série / chassi</label><input name="serie" value="${esc(m.serie)}"></div>
      </div>
      <label>Fazenda onde está *</label>
      <select name="fazendaId" required ${id ? 'disabled' : ''}>${optFazendas(d, m.fazendaId)}</select>
      ${id ? '<div class="suave">A localização muda pelas transferências.</div>' : ''}
      <label>Observações</label><textarea name="obs">${esc(m.obs)}</textarea>
      <div class="acoes"><button>Salvar</button><a class="botao sec" href="#/maquinas">Cancelar</a></div>
    </form>`;
};

telas.maquina = async (id, _1, ctx) => {
  const d = await carregarTudo();
  const m = d.mq[id];
  if (!m) return '<p>Máquina não encontrada.</p>';
  const eventos = [
    ...d.transferencias.filter((t) => t.maquinaId === id).map((t) => ({ data: t.dataSaida, html: `
      <a class="cartao" href="#/transferencias/${t.id}">
        <div class="linha"><b>Transferência</b><span class="etiqueta ${t.status === 'transito' ? 'e-transito' : 'e-ok'}">${t.status === 'transito' ? 'Em trânsito' : 'Recebida'}</span></div>
        <div class="suave">${esc(nomeFazenda(d, t.origemId))} → ${esc(nomeFazenda(d, t.destinoId))}</div>
        <div class="suave">Saída ${dataBR(t.dataSaida)}${t.chegada ? ' · chegada ' + dataBR(t.chegada.data) : ''}</div>
      </a>` })),
    ...d.consertos.filter((c) => c.maquinaId === id).map((c) => ({ data: c.dataEnvio, html: `
      <a class="cartao" href="#/consertos/${c.id}">
        <div class="linha"><b>Conserto · ${esc(c.oficina)}</b><span class="etiqueta ${c.status === 'oficina' ? 'e-conserto' : 'e-ok'}">${c.status === 'oficina' ? 'Na oficina' : 'Retornou'}</span></div>
        <div class="suave">${esc(c.defeito)}</div>
        <div class="suave">Envio ${dataBR(c.dataEnvio)}${c.retorno ? ' · retorno ' + dataBR(c.retorno.data) : ''} · custo ${reais(c.custoFinal)}</div>
      </a>` }))
  ].sort(porData('data'));
  const custoTotal = d.consertos.filter((c) => c.maquinaId === id).reduce((s, c) => s + (Number(c.custoFinal) || 0), 0);
  const livre = (m.status || 'disponivel') === 'disponivel';
  return `
    <div class="linha"><h2>${esc(nomeMaquina(d, id))}</h2>${etiquetaMaquina(m)}</div>
    <div class="cartao">
      <div>${esc(m.tipo || '')}${m.marca ? ' · ' + esc(m.marca) : ''}</div>
      ${m.serie ? `<div class="suave">Série/placa: ${esc(m.serie)}</div>` : ''}
      <div>Local: <b>${m.status === 'conserto' ? 'Oficina' : m.status === 'transito' ? 'Em trânsito' : esc(nomeFazenda(d, m.fazendaId))}</b></div>
      <div class="suave">Gasto total com consertos: ${reais(custoTotal)}</div>
      ${m.obs ? `<p>${esc(m.obs)}</p>` : ''}
    </div>
    <div class="acoes">
      ${livre ? `<a class="botao" href="#/transferencias/nova?maquina=${id}">Transferir</a>
      <a class="botao sec" href="#/consertos/novo?maquina=${id}">Enviar p/ conserto</a>` : '<span class="suave">Ações liberadas quando a máquina estiver de volta a uma fazenda.</span>'}
    </div>
    ${sessao.admin ? `<div class="acoes"><a class="botao sec" href="#/maquinas/${id}/editar">Editar cadastro</a></div>` : ''}
    <h3>Histórico</h3>
    ${eventos.length ? `<div class="tl">${eventos.map((e) => e.html).join('')}</div>` : '<p class="vazio">Sem movimentações ainda.</p>'}`;
};

// --- Transferências ---
telas.transferencias = async (_0, _1, ctx) => {
  const d = await carregarTudo();
  const lista = d.transferencias.sort(porData('dataSaida'));
  return `
    <div class="linha"><h2>Transferências</h2><a class="botao" href="#/transferencias/nova">+ Nova</a></div>
    ${lista.length ? lista.map((t) => `
      <a class="cartao" href="#/transferencias/${t.id}">
        <div class="linha"><b>${esc(nomeMaquina(d, t.maquinaId))}</b><span class="etiqueta ${t.status === 'transito' ? 'e-transito' : 'e-ok'}">${t.status === 'transito' ? 'Em trânsito' : 'Recebida'}</span></div>
        <div class="suave">${esc(nomeFazenda(d, t.origemId))} → ${esc(nomeFazenda(d, t.destinoId))} · ${dataBR(t.dataSaida)}</div>
      </a>`).join('') : '<p class="vazio">Nenhuma transferência registrada.</p>'}`;
};

telas.transferenciaNova = async (_, params, ctx) => {
  const d = await carregarTudo();
  const itens = await checklistModelo();
  const livres = d.maquinas.filter((m) => (m.status || 'disponivel') === 'disponivel');
  if (d.fazendas.length < 2) return `<div class="aviso">Cadastre pelo menos duas fazendas para registrar uma transferência. <a href="#/fazendas/nova">Cadastrar fazenda</a></div>`;
  if (!livres.length) return `<div class="aviso">Nenhuma máquina disponível em fazenda. <a href="#/maquinas/nova">Cadastrar máquina</a></div>`;
  const sel = params.get('maquina');
  ctx.depois(() => {
    const form = $('#form');
    ligarFotos(form);
    const origem = () => (d.mq[form.maquinaId.value] || {}).fazendaId;
    const atualizar = () => {
      $('#origem').textContent = nomeFazenda(d, origem());
      form.destinoId.innerHTML = '<option value="">Selecione</option>' + optFazendas(d, null, origem());
    };
    form.maquinaId.addEventListener('change', atualizar);
    atualizar();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const m = d.mq[form.maquinaId.value];
      const t = {
        maquinaId: m.id,
        origemId: m.fazendaId,
        destinoId: form.destinoId.value,
        transporte: form.transporte.value,
        motorista: form.motorista.value,
        dataSaida: form.saida_data.value,
        saida: await lerChecklist(form, itens, 'saida'),
        status: 'transito'
      };
      await DB.lote([['salvar', 'transferencias', t], ['salvar', 'maquinas', { ...m, status: 'transito' }]]);
      location.hash = `#/transferencias/${t.id}`;
    });
  });
  return `
    <h2>Nova transferência</h2>
    <form id="form">
      <label>Máquina / equipamento *</label>
      <select name="maquinaId" required>${livres.map((m) => `<option value="${m.id}" ${m.id === sel ? 'selected' : ''}>${esc(nomeMaquina(d, m.id))}</option>`).join('')}</select>
      <label>Origem</label><div class="cartao" id="origem"></div>
      <label>Destino *</label><select name="destinoId" required></select>
      <div class="duas">
        <div><label>Data e hora de saída *</label><input type="datetime-local" name="saida_data" required value="${hojeISO()}"></div>
        <div><label>Transporte</label><input name="transporte" placeholder="Prancha, rodando, caminhão…"></div>
      </div>
      <label>Motorista / operador</label><input name="motorista">
      ${htmlBlocoChecklist(itens, 'saida', 'Responsável pela saída')}
      <div class="acoes"><button>Registrar saída</button><a class="botao sec" href="#/transferencias">Cancelar</a></div>
    </form>`;
};

// Cancelar/excluir um registro e devolver a máquina para onde estava antes.
// Só é permitido se for a última movimentação da máquina (senão bagunçaria o histórico).
function ultimaMovimentacao(d, maquinaId, idRegistro) {
  const eventos = [
    ...d.transferencias.filter((t) => t.maquinaId === maquinaId).map((t) => ({ id: t.id, data: t.dataSaida })),
    ...d.consertos.filter((c) => c.maquinaId === maquinaId).map((c) => ({ id: c.id, data: c.dataEnvio }))
  ].sort(porData('data'));
  return eventos.length && eventos[0].id === idRegistro;
}
async function cancelarRegistro(d, loja, reg, msg) {
  if (!confirm(msg)) return;
  const m = d.mq[reg.maquinaId];
  await DB.lote([['remover', loja, reg.id], ...(m ? [['salvar', 'maquinas', { ...m, status: 'disponivel', fazendaId: reg.origemId }]] : [])]);
  for (const ck of [reg.saida, reg.chegada, reg.retorno]) (ck && ck.fotoIds || []).forEach(DB.removerFoto);
  location.hash = m ? `#/maquinas/${m.id}` : '#/';
}

telas.transferencia = async (id, _1, ctx) => {
  const d = await carregarTudo();
  const t = d.transferencias.find((x) => x.id === id);
  if (!t) return '<p>Transferência não encontrada.</p>';
  const podeCancelar = ultimaMovimentacao(d, t.maquinaId, t.id);
  ctx.depois(() => {
    const b = $('#btn-cancelar');
    if (b) b.onclick = () => cancelarRegistro(d, 'transferencias', t,
      `Cancelar esta transferência? O registro e o checklist serão apagados e a máquina volta para ${nomeFazenda(d, t.origemId)}. Não dá para desfazer.`);
  });
  return `
    <div class="linha"><h2>Transferência</h2><span class="etiqueta ${t.status === 'transito' ? 'e-transito' : 'e-ok'}">${t.status === 'transito' ? 'Em trânsito' : 'Recebida'}</span></div>
    <div class="cartao">
      <div><a href="#/maquinas/${t.maquinaId}"><b>${esc(nomeMaquina(d, t.maquinaId))}</b></a></div>
      <div>${esc(nomeFazenda(d, t.origemId))} → <b>${esc(nomeFazenda(d, t.destinoId))}</b></div>
      ${t.transporte ? `<div class="suave">Transporte: ${esc(t.transporte)}</div>` : ''}
      ${t.motorista ? `<div class="suave">Motorista/operador: ${esc(t.motorista)}</div>` : ''}
      ${t.criadoPor ? `<div class="suave">Lançado por ${esc(t.criadoPor.nome)}${t.chegada && t.atualizadoPor ? ' · chegada lançada por ' + esc(t.atualizadoPor.nome) : ''}</div>` : ''}
    </div>
    ${t.status === 'transito' ? `<div class="acoes"><a class="botao" href="#/transferencias/${id}/chegada">Registrar chegada</a></div>` : ''}
    ${htmlChecklistLeitura(t.saida, 'Checklist de saída')}
    ${htmlChecklistLeitura(t.chegada, 'Checklist de chegada', t.saida)}
    <div class="acoes"><button class="sec" onclick="window.print()">Imprimir / PDF</button></div>
    ${!sessao.admin ? '' : podeCancelar ? '<div class="acoes"><button class="perigo" id="btn-cancelar">Cancelar transferência</button></div>'
      : '<p class="suave">Só dá para cancelar a última movimentação da máquina.</p>'}`;
};

telas.transferenciaChegada = async (id, _1, ctx) => {
  const d = await carregarTudo();
  const t = d.transferencias.find((x) => x.id === id);
  if (!t || t.status !== 'transito') return '<p>Essa transferência não está em trânsito.</p>';
  const itens = t.saida.itens;
  ctx.depois(() => {
    const form = $('#form');
    ligarFotos(form);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      t.chegada = await lerChecklist(form, itens, 'chegada');
      t.status = 'recebida';
      const m = d.mq[t.maquinaId];
      await DB.lote([['salvar', 'transferencias', t], ...(m ? [['salvar', 'maquinas', { ...m, status: 'disponivel', fazendaId: t.destinoId }]] : [])]);
      location.hash = `#/transferencias/${t.id}`;
    });
  });
  return `
    <h2>Chegada em ${esc(nomeFazenda(d, t.destinoId))}</h2>
    <div class="cartao"><b>${esc(nomeMaquina(d, t.maquinaId))}</b><div class="suave">Saiu de ${esc(nomeFazenda(d, t.origemId))} em ${dataBR(t.dataSaida)}</div></div>
    <form id="form">
      <label>Data e hora de chegada *</label><input type="datetime-local" name="chegada_data" required value="${hojeISO()}">
      ${htmlBlocoChecklist(itens, 'chegada', 'Responsável pelo recebimento', t.saida)}
      <div class="acoes"><button>Confirmar recebimento</button><a class="botao sec" href="#/transferencias/${id}">Cancelar</a></div>
    </form>`;
};

// --- Consertos ---
telas.consertos = async (_0, _1, ctx) => {
  const d = await carregarTudo();
  const lista = d.consertos.sort(porData('dataEnvio'));
  const hoje = hojeISO().slice(0, 10);
  return `
    <div class="linha"><h2>Consertos na cidade</h2><a class="botao" href="#/consertos/novo">+ Enviar</a></div>
    ${lista.length ? lista.map((c) => {
      const atrasado = c.status === 'oficina' && c.prazo && c.prazo < hoje;
      const [txt, cls] = c.status === 'oficina' ? (atrasado ? ['Prazo vencido', 'e-erro'] : ['Na oficina', 'e-conserto']) : ['Retornou', 'e-ok'];
      return `<a class="cartao" href="#/consertos/${c.id}">
        <div class="linha"><b>${esc(nomeMaquina(d, c.maquinaId))}</b><span class="etiqueta ${cls}">${txt}</span></div>
        <div class="suave">${esc(c.oficina)}${c.cidade ? ' (' + esc(c.cidade) + ')' : ''} · ${esc(c.defeito)}</div>
        <div class="suave">Envio ${dataBR(c.dataEnvio)} · ${c.status === 'oficina' ? 'prazo ' + dataBR(c.prazo) : 'custo ' + reais(c.custoFinal)}</div>
      </a>`;
    }).join('') : '<p class="vazio">Nenhum conserto registrado.</p>'}`;
};

telas.consertoNovo = async (_, params, ctx) => {
  const d = await carregarTudo();
  const itens = await checklistModelo();
  const livres = d.maquinas.filter((m) => (m.status || 'disponivel') === 'disponivel');
  if (!livres.length) return `<div class="aviso">Nenhuma máquina disponível em fazenda. <a href="#/maquinas/nova">Cadastrar máquina</a></div>`;
  const sel = params.get('maquina');
  ctx.depois(() => {
    const form = $('#form');
    ligarFotos(form);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const m = d.mq[fd.get('maquinaId')];
      const c = {
        maquinaId: m.id,
        origemId: m.fazendaId,
        oficina: fd.get('oficina'),
        cidade: fd.get('cidade'),
        contato: fd.get('contato'),
        defeito: fd.get('defeito'),
        dataEnvio: fd.get('saida_data'),
        orcamento: num(fd.get('orcamento')),
        prazo: fd.get('prazo'),
        saida: await lerChecklist(form, itens, 'saida'),
        status: 'oficina'
      };
      await DB.lote([['salvar', 'consertos', c], ['salvar', 'maquinas', { ...m, status: 'conserto' }]]);
      location.hash = `#/consertos/${c.id}`;
    });
  });
  return `
    <h2>Enviar para conserto</h2>
    <form id="form">
      <label>Máquina / equipamento *</label>
      <select name="maquinaId" required>${livres.map((m) => `<option value="${m.id}" ${m.id === sel ? 'selected' : ''}>${esc(nomeMaquina(d, m.id))} — ${esc(nomeFazenda(d, m.fazendaId))}</option>`).join('')}</select>
      <div class="duas">
        <div><label>Oficina *</label><input name="oficina" required></div>
        <div><label>Cidade</label><input name="cidade" value="Tailândia"></div>
      </div>
      <label>Contato da oficina</label><input name="contato" placeholder="Nome / telefone">
      <label>Defeito / serviço *</label><textarea name="defeito" required></textarea>
      <div class="duas">
        <div><label>Data de envio *</label><input type="datetime-local" name="saida_data" required value="${hojeISO()}"></div>
        <div><label>Prazo previsto</label><input type="date" name="prazo"></div>
      </div>
      <label>Orçamento (R$)</label><input name="orcamento" inputmode="decimal" placeholder="Pode preencher depois">
      ${htmlBlocoChecklist(itens, 'saida', 'Responsável pelo envio')}
      <div class="acoes"><button>Registrar envio</button><a class="botao sec" href="#/consertos">Cancelar</a></div>
    </form>`;
};

telas.conserto = async (id, _1, ctx) => {
  const d = await carregarTudo();
  const c = d.consertos.find((x) => x.id === id);
  if (!c) return '<p>Conserto não encontrado.</p>';
  const podeCancelar = ultimaMovimentacao(d, c.maquinaId, c.id);
  ctx.depois(() => {
    const b = $('#btn-cancelar');
    if (b) b.onclick = () => cancelarRegistro(d, 'consertos', c,
      `Excluir este conserto? O registro e o checklist serão apagados e a máquina volta para ${nomeFazenda(d, c.origemId)}. Não dá para desfazer.`);
    const f = $('#form-orc');
    if (f) f.addEventListener('submit', async (e) => {
      e.preventDefault();
      c.orcamento = num(f.orcamento.value);
      c.prazo = f.prazo.value;
      c.notas = f.notas.value;
      await DB.salvar('consertos', c);
      render();
    });
  });
  return `
    <div class="linha"><h2>Conserto</h2><span class="etiqueta ${c.status === 'oficina' ? 'e-conserto' : 'e-ok'}">${c.status === 'oficina' ? 'Na oficina' : 'Retornou'}</span></div>
    <div class="cartao">
      <div><a href="#/maquinas/${c.maquinaId}"><b>${esc(nomeMaquina(d, c.maquinaId))}</b></a></div>
      <div>Oficina: <b>${esc(c.oficina)}</b>${c.cidade ? ' · ' + esc(c.cidade) : ''}</div>
      ${c.contato ? `<div class="suave">Contato: ${esc(c.contato)}</div>` : ''}
      ${c.criadoPor ? `<div class="suave">Lançado por ${esc(c.criadoPor.nome)}${c.atualizadoPor && c.atualizadoPor.uid !== c.criadoPor.uid ? ' · última alteração: ' + esc(c.atualizadoPor.nome) : ''}</div>` : ''}
      <div>Defeito: ${esc(c.defeito)}</div>
      <div class="suave">Saiu de ${esc(nomeFazenda(d, c.origemId))} em ${dataBR(c.dataEnvio)}</div>
      <div class="suave">Orçamento: ${reais(c.orcamento)} · Prazo: ${dataBR(c.prazo)}</div>
      ${c.status !== 'oficina' ? `<div>Custo final: <b>${reais(c.custoFinal)}</b>${c.nf ? ' · NF ' + esc(c.nf) : ''} · voltou para <b>${esc(nomeFazenda(d, c.destinoId))}</b></div>
        ${c.servico ? `<div class="suave">Serviço feito: ${esc(c.servico)}</div>` : ''}` : ''}
    </div>
    ${c.status === 'oficina' ? `
      <div class="acoes"><a class="botao" href="#/consertos/${id}/retorno">Registrar retorno</a></div>
      <h3>Atualizar orçamento / prazo</h3>
      <form id="form-orc" class="cartao">
        <div class="duas">
          <div><label>Orçamento (R$)</label><input name="orcamento" inputmode="decimal" value="${esc(c.orcamento)}"></div>
          <div><label>Prazo previsto</label><input type="date" name="prazo" value="${esc(c.prazo)}"></div>
        </div>
        <label>Anotações</label><textarea name="notas">${esc(c.notas)}</textarea>
        <div class="acoes"><button class="sec">Salvar</button></div>
      </form>` : (c.notas ? `<div class="cartao"><b>Anotações:</b> ${esc(c.notas)}</div>` : '')}
    ${htmlChecklistLeitura(c.saida, 'Checklist de envio')}
    ${htmlChecklistLeitura(c.retorno, 'Checklist de retorno', c.saida)}
    <div class="acoes"><button class="sec" onclick="window.print()">Imprimir / PDF</button></div>
    ${!sessao.admin ? '' : podeCancelar ? '<div class="acoes"><button class="perigo" id="btn-cancelar">Excluir conserto</button></div>'
      : '<p class="suave">Só dá para excluir a última movimentação da máquina.</p>'}`;
};

telas.consertoRetorno = async (id, _1, ctx) => {
  const d = await carregarTudo();
  const c = d.consertos.find((x) => x.id === id);
  if (!c || c.status !== 'oficina') return '<p>Esse conserto não está em aberto.</p>';
  const itens = c.saida.itens;
  ctx.depois(() => {
    const form = $('#form');
    ligarFotos(form);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      c.retorno = await lerChecklist(form, itens, 'retorno');
      c.custoFinal = num(fd.get('custoFinal'));
      c.nf = fd.get('nf');
      c.servico = fd.get('servico');
      c.destinoId = fd.get('destinoId');
      c.status = 'retornou';
      const m = d.mq[c.maquinaId];
      await DB.lote([['salvar', 'consertos', c], ...(m ? [['salvar', 'maquinas', { ...m, status: 'disponivel', fazendaId: c.destinoId }]] : [])]);
      location.hash = `#/consertos/${c.id}`;
    });
  });
  return `
    <h2>Retorno do conserto</h2>
    <div class="cartao"><b>${esc(nomeMaquina(d, c.maquinaId))}</b><div class="suave">${esc(c.oficina)} · enviado em ${dataBR(c.dataEnvio)}</div></div>
    <form id="form">
      <div class="duas">
        <div><label>Data e hora do retorno *</label><input type="datetime-local" name="retorno_data" required value="${hojeISO()}"></div>
        <div><label>Voltou para a fazenda *</label><select name="destinoId" required>${optFazendas(d, c.origemId)}</select></div>
      </div>
      <div class="duas">
        <div><label>Custo final (R$)</label><input name="custoFinal" inputmode="decimal" value="${esc(c.orcamento)}"></div>
        <div><label>Nº da nota fiscal</label><input name="nf"></div>
      </div>
      <label>Serviço realizado</label><textarea name="servico"></textarea>
      ${htmlBlocoChecklist(itens, 'retorno', 'Responsável pelo recebimento', c.saida)}
      <div class="acoes"><button>Confirmar retorno</button><a class="botao sec" href="#/consertos/${id}">Cancelar</a></div>
    </form>`;
};

// --- Fazendas ---
telas.fazendaForm = async (id, _1, ctx) => {
  if (!sessao.admin) return '<p>Só o administrador pode fazer isso.</p>';
  const f = id ? await DB.obter('fazendas', id) : {};
  if (!f) return '<p>Fazenda não encontrada.</p>';
  ctx.depois(() => {
    $('#form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await DB.salvar('fazendas', { ...f, ...Object.fromEntries(new FormData(e.target)) });
      location.hash = '#/mais';
    });
  });
  return `
    <h2>${id ? 'Editar fazenda' : 'Nova fazenda'}</h2>
    <form id="form">
      <label>Nome *</label><input name="nome" required value="${esc(f.nome)}">
      <label>Município</label><input name="municipio" value="${esc(f.municipio || 'Tailândia - PA')}">
      <label>Responsável / gerente</label><input name="responsavel" value="${esc(f.responsavel)}">
      <div class="acoes"><button>Salvar</button><a class="botao sec" href="#/mais">Cancelar</a></div>
    </form>`;
};

// --- Mais: conta, usuários, fazendas, checklist, exportação ---
telas.mais = async (_0, _1, ctx) => {
  const d = await carregarTudo();
  const itens = await checklistModelo();
  const adm = sessao.admin;
  const eu = sessao.perfil || {};
  const antigos = adm ? await lerBancoAntigo() : null;
  const cfgAlertas = (await DB.obter('config', 'alertas')) || {};
  ctx.depois(() => {
    $('#btn-sair').onclick = async () => { if (confirm('Sair da conta neste aparelho?')) await sessao.sair(); };
    $('#form-senha').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      if (f.nova.value !== f.nova2.value) return alert('A senha nova e a confirmação não batem.');
      try { await sessao.trocarSenha(f.atual.value, f.nova.value); alert('Senha trocada.'); f.reset(); }
      catch (err) { alert(err.message); }
    });
    const fe = $('#form-email');
    if (fe) fe.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = fe.email.value.trim();
      try {
        await sessao.cadastrarEmail(fe.atual.value, email);
        alert(`Enviamos um link de confirmação para ${email}. Abra o e-mail e confirme (veja o spam).\n\nDepois de confirmar, você passa a entrar com o e-mail ${email} no lugar do usuário, com a mesma senha.`);
        fe.reset();
      } catch (err) { alert(err.message); }
    });
    $('#btn-csv-t').onclick = () => exportarTransferencias(d);
    $('#btn-csv-c').onclick = () => exportarConsertos(d);
    $('#btn-csv-m').onclick = () => exportarMaquinas(d);
    if (!adm) return;
    $('#btn-backup').onclick = exportarBackup;
    $('#inp-backup').onchange = importarBackup;
    const ba = $('#btn-antigo');
    if (ba) ba.onclick = async () => {
      try {
        if (await importarDados(antigos)) { try { localStorage.setItem('ct-antigo-importado', '1'); } catch {} }
      } catch (err) { alert('Não foi possível importar: ' + err.message); }
    };
    $('#form-ck').addEventListener('submit', async (e) => {
      e.preventDefault();
      const novos = $$('.ck-linha').map((l) => ({
        id: l.dataset.id,
        rotulo: $('.ck-rot', l).value.trim(),
        tipo: $('.ck-tipo', l).value
      })).filter((i) => i.rotulo);
      await DB.salvar('config', { id: 'checklist', itens: novos });
      alert('Checklist salvo. Vale para os próximos registros, em todos os aparelhos.');
      render();
    });
    $('#ck-add').onclick = () => {
      $('#ck-lista').insertAdjacentHTML('beforeend', linhaCk({ id: 'i' + Date.now().toString(36), rotulo: '', tipo: 'ok' }));
    };
    $('#ck-lista').addEventListener('click', (e) => { if (e.target.matches('.ck-del')) e.target.closest('.ck-linha').remove(); });
    $('#form-alertas').addEventListener('submit', async (e) => {
      e.preventDefault();
      const h = Number(e.target.horas.value);
      if (!(h >= 1)) return alert('Informe um número de horas (mínimo 1).');
      await DB.salvar('config', { ...(await DB.obter('config', 'alertas')), id: 'alertas', horasTransito: h });
      alert('Salvo.');
    });
    $('#ck-reset').onclick = async () => {
      if (!confirm('Voltar para o checklist padrão?')) return;
      await DB.remover('config', 'checklist');
      render();
    };
  });
  const tipos = { ok: 'OK / Problema / N/A', numero: 'Número', nivel: 'Nível (reserva a cheio)', texto: 'Texto livre' };
  const linhaCk = (i) => `
    <div class="ck-linha linha" data-id="${esc(i.id)}" style="margin-bottom:8px;flex-wrap:nowrap">
      <input class="ck-rot" value="${esc(i.rotulo)}" placeholder="Item" style="flex:2">
      <select class="ck-tipo" style="flex:1">${Object.entries(tipos).map(([k, v]) => `<option value="${k}" ${k === i.tipo ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <button type="button" class="ck-del perigo" aria-label="Remover" style="padding:10px 12px">✕</button>
    </div>`;
  return `
    <h2>Minha conta</h2>
    <div class="cartao">
      <div class="linha"><b>${esc(eu.nome)}</b><span class="etiqueta ${adm ? 'e-transito' : 'e-ok'}">${adm ? 'Administrador' : 'Operador'}</span></div>
      <div class="suave">Usuário: ${esc(eu.usuario)}</div>
      <details style="margin-top:8px"><summary>Trocar minha senha</summary>
        <form id="form-senha">
          <label>Senha atual</label><input type="password" name="atual" required autocomplete="current-password">
          <label>Senha nova (mínimo 6)</label><input type="password" name="nova" required minlength="6" autocomplete="new-password">
          <label>Repita a senha nova</label><input type="password" name="nova2" required minlength="6" autocomplete="new-password">
          <div class="acoes"><button>Trocar senha</button></div>
        </form>
      </details>
      ${adm ? `<details style="margin-top:8px" ${sessao.emailReal ? '' : 'open'}><summary>E-mail para recuperar a senha</summary>
        ${sessao.emailReal
          ? `<p>Cadastrado: <b>${esc(sessao.emailReal)}</b>. Você entra com esse e-mail. Se esquecer a senha, use "Esqueci a senha" na tela de entrada.</p>`
          : `<div class="aviso" style="margin-top:8px">Você é o único administrador. Sem um e-mail cadastrado, se esquecer a senha não há como recuperar.</div>`}
        <form id="form-email">
          <label>${sessao.emailReal ? 'Trocar para outro e-mail' : 'Seu e-mail'}</label><input type="email" name="email" required autocomplete="email">
          <label>Sua senha atual</label><input type="password" name="atual" required autocomplete="current-password">
          <div class="acoes"><button>Enviar confirmação</button></div>
        </form>
      </details>` : ''}
      <div class="acoes"><button class="sec" id="btn-sair">Sair</button></div>
    </div>

    ${adm ? `<div class="linha" style="margin-top:24px"><h2>Usuários</h2><a class="botao" href="#/usuarios/novo">+ Novo</a></div>
    ${(await DB.todos('usuarios')).sort((a, b) => (a.nome || '').localeCompare(b.nome || '')).map((u) => `
      <a class="cartao" href="#/usuarios/${u.id}">
        <div class="linha"><b>${esc(u.nome)}</b>
          <span class="etiqueta ${u.ativo === false ? 'e-erro' : u.papel === 'admin' ? 'e-transito' : 'e-ok'}">${u.ativo === false ? 'Desativado' : u.papel === 'admin' ? 'Administrador' : 'Operador'}</span></div>
        <div class="suave">${esc(u.usuario)}</div>
      </a>`).join('')}` : ''}

    <div class="linha" style="margin-top:24px"><h2>Fazendas</h2>${adm ? '<a class="botao" href="#/fazendas/nova">+ Nova</a>' : ''}</div>
    ${d.fazendas.length ? d.fazendas.sort((a, b) => a.nome.localeCompare(b.nome)).map((f) => `
      <${adm ? `a href="#/fazendas/${f.id}/editar"` : 'div'} class="cartao">
        <div class="linha"><b>${esc(f.nome)}</b><span class="suave">${d.maquinas.filter((m) => m.fazendaId === f.id && (m.status || 'disponivel') === 'disponivel').length} máquinas</span></div>
        <div class="suave">${esc(f.municipio || '')}${f.responsavel ? ' · ' + esc(f.responsavel) : ''}</div>
      </${adm ? 'a' : 'div'}>`).join('') : '<p class="vazio">Nenhuma fazenda cadastrada.</p>'}

    ${adm ? `<h2 style="margin-top:24px">Itens do checklist</h2>
    <p class="suave">Responsável, observações e fotos sempre entram. Mudanças valem só para registros novos.</p>
    <form id="form-ck" class="cartao">
      <div id="ck-lista">${itens.map(linhaCk).join('')}</div>
      <div class="acoes">
        <button type="button" class="sec" id="ck-add">+ Item</button>
        <button>Salvar checklist</button>
      </div>
      <button type="button" class="sec" id="ck-reset" style="width:100%">Restaurar padrão</button>
    </form>` : ''}

    ${adm ? `<h2 style="margin-top:24px">Alertas</h2>
    <form id="form-alertas" class="cartao">
      <p class="suave" style="margin-top:0">Conserto com prazo vencido sempre gera alerta. Transferência sem chegada registrada gera alerta depois de:</p>
      <div class="linha" style="flex-wrap:nowrap"><input name="horas" type="number" min="1" step="1" value="${esc(cfgAlertas.horasTransito || HORAS_TRANSITO_PADRAO)}" style="max-width:120px"> <span>horas</span>
        <button class="sec">Salvar</button></div>
    </form>` : ''}

    <h2 style="margin-top:24px">Exportar planilhas (CSV)</h2>
    <p class="suave">Abre no Excel ou Google Planilhas.</p>
    <div class="acoes">
      <button class="sec" id="btn-csv-t">Transferências</button>
      <button class="sec" id="btn-csv-c">Consertos</button>
      <button class="sec" id="btn-csv-m">Máquinas</button>
    </div>

    ${antigos ? `<div class="aviso" style="margin-top:24px"><b>Este aparelho tem dados da versão antiga do app</b>
      (${(antigos.maquinas || []).length} máquinas, ${(antigos.transferencias || []).length} transferências, ${(antigos.consertos || []).length} consertos).
      <div class="acoes"><button id="btn-antigo">Enviar para o servidor</button></div></div>` : ''}
    ${adm ? `<h2 style="margin-top:24px">Cópia e importação</h2>
    <p class="suave">Os dados ficam no servidor e em todos os aparelhos. A cópia em arquivo é opcional (não leva as fotos).
    "Importar" traz um backup da versão antiga do app (que guardava só no celular) e <b>soma</b> aos dados atuais.</p>
    <div class="acoes">
      <button class="sec" id="btn-backup">Baixar cópia</button>
      <label class="botao sec" style="margin:0">Importar backup<input type="file" id="inp-backup" accept=".json,application/json" hidden></label>
    </div>` : ''}
    <p class="suave" style="text-align:center;margin-top:24px">Controle de Transferências · v9</p>`;
};

// --- Usuários (só administrador) ---
telas.usuarioNovo = async (_0, _1, ctx) => {
  if (!sessao.admin) return '<p>Só o administrador cria usuários.</p>';
  ctx.depois(() => {
    const f = $('#form');
    f.usuario.addEventListener('input', () => { $('#usr-prev').textContent = normalizarUsuario(f.usuario.value) || '—'; });
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!normalizarUsuario(f.usuario.value)) return alert('Informe um usuário válido.');
      const b = $('button', f); b.disabled = true; b.textContent = 'Criando…';
      try {
        await sessao.criarUsuario({ nome: f.nome.value, usuario: f.usuario.value, senha: f.senha.value, papel: 'operador' });
        alert(`Usuário criado. Passe para a pessoa:\nUsuário: ${normalizarUsuario(f.usuario.value)}\nSenha: ${f.senha.value}`);
        location.hash = '#/mais';
      } catch (err) {
        alert(err.message); b.disabled = false; b.textContent = 'Criar usuário';
      }
    });
  });
  return `
    <h2>Novo usuário</h2>
    <p class="suave">Precisa de internet. A pessoa entra com o usuário e a senha que você definir e pode trocar a senha depois.</p>
    <form id="form">
      <label>Nome completo *</label><input name="nome" required>
      <label>Usuário para entrar *</label><input name="usuario" required autocapitalize="none" placeholder="ex: joao.silva">
      <div class="suave">Vai ficar: <b id="usr-prev">—</b></div>
      <label>Senha inicial * (mínimo 6)</label><input name="senha" required minlength="6">
      <p class="suave">Será criado como <b>Operador</b>: lança e recebe transferências e consertos. Administrador é só você.</p>
      <div class="acoes"><button>Criar usuário</button><a class="botao sec" href="#/mais">Cancelar</a></div>
    </form>`;
};

telas.usuario = async (id, _1, ctx) => {
  if (!sessao.admin) return '<p>Só o administrador gerencia usuários.</p>';
  const u = await DB.obter('usuarios', id);
  if (!u) return '<p>Usuário não encontrado.</p>';
  const souEu = sessao.perfil && sessao.perfil.id === id;
  ctx.depois(() => {
    $('#form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      await DB.salvar('usuarios', { ...u, nome: f.nome.value.trim(), papel: u.papel, ativo: souEu ? true : f.ativo.value === 'sim' });
      location.hash = '#/mais';
    });
  });
  return `
    <h2>${esc(u.nome)}</h2>
    <p class="suave">Usuário: <b>${esc(u.usuario)}</b>. Para quem esqueceu a senha: desative este e crie um usuário novo.</p>
    <form id="form">
      <label>Nome</label><input name="nome" value="${esc(u.nome)}" required>
      <label>Nível</label>
      <div class="cartao">${u.papel === 'admin' ? 'Administrador' : 'Operador'}</div>
      <label>Acesso</label>
      <select name="ativo" ${souEu ? 'disabled' : ''}>
        <option value="sim" ${u.ativo !== false ? 'selected' : ''}>Ativo</option>
        <option value="nao" ${u.ativo === false ? 'selected' : ''}>Desativado (não consegue mais entrar)</option>
      </select>
      ${souEu ? '<p class="suave">Você não pode desativar a própria conta.</p>' : ''}
      <div class="acoes"><button>Salvar</button><a class="botao sec" href="#/mais">Cancelar</a></div>
    </form>`;
};

// ---------- Exportação ----------
function baixar(nome, conteudo, tipo) {
  const blob = new Blob([conteudo], { type: tipo });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function csv(linhas) {
  const cel = (v) => {
    const s = String(v ?? '');
    return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  // Separador ";" e BOM para o Excel em português abrir certo.
  return '﻿' + linhas.map((l) => l.map(cel).join(';')).join('\r\n');
}
const numBR = (v) => (v === '' || v == null ? '' : String(v).replace('.', ','));
const resumoCk = (ck) => (ck ? ck.itens.map((it) => `${it.rotulo}: ${textoResposta(it, ck.respostas[it.id])}`).join(' | ') : '');
const problemas = (ck) => (ck ? ck.itens.filter((it) => it.tipo === 'ok' && ck.respostas[it.id] && ck.respostas[it.id].valor === 'problema').map((it) => it.rotulo).join(', ') : '');
const horim = (ck) => (ck && ck.respostas.horimetro ? numBR(ck.respostas.horimetro.valor) : '');
const carimbo = () => new Date().toISOString().slice(0, 10);

function exportarTransferencias(d) {
  const linhas = [['Máquina', 'Origem', 'Destino', 'Status', 'Saída', 'Resp. saída', 'Horímetro saída', 'Problemas na saída', 'Chegada', 'Resp. chegada', 'Horímetro chegada', 'Problemas na chegada', 'Divergências', 'Transporte', 'Motorista', 'Lançado por', 'Checklist saída', 'Checklist chegada']];
  for (const t of d.transferencias.sort(porData('dataSaida'))) {
    linhas.push([nomeMaquina(d, t.maquinaId), nomeFazenda(d, t.origemId), nomeFazenda(d, t.destinoId),
      t.status === 'transito' ? 'Em trânsito' : 'Recebida', dataBR(t.dataSaida), t.saida?.responsavel, horim(t.saida), problemas(t.saida),
      t.chegada ? dataBR(t.chegada.data) : '', t.chegada?.responsavel, horim(t.chegada), problemas(t.chegada),
      divergencias(t.saida, t.chegada).join(' | '), t.transporte, t.motorista, t.criadoPor?.nome, resumoCk(t.saida), resumoCk(t.chegada)]);
  }
  baixar(`transferencias-${carimbo()}.csv`, csv(linhas), 'text/csv;charset=utf-8');
}
function exportarConsertos(d) {
  const linhas = [['Máquina', 'Fazenda de origem', 'Oficina', 'Cidade', 'Defeito', 'Status', 'Envio', 'Prazo', 'Orçamento', 'Retorno', 'Custo final', 'NF', 'Serviço realizado', 'Voltou para', 'Resp. envio', 'Resp. retorno', 'Lançado por']];
  for (const c of d.consertos.sort(porData('dataEnvio'))) {
    linhas.push([nomeMaquina(d, c.maquinaId), nomeFazenda(d, c.origemId), c.oficina, c.cidade, c.defeito,
      c.status === 'oficina' ? 'Na oficina' : 'Retornou', dataBR(c.dataEnvio), c.prazo ? dataBR(c.prazo) : '', numBR(c.orcamento),
      c.retorno ? dataBR(c.retorno.data) : '', numBR(c.custoFinal), c.nf, c.servico,
      c.destinoId ? nomeFazenda(d, c.destinoId) : '', c.saida?.responsavel, c.retorno?.responsavel, c.criadoPor?.nome]);
  }
  baixar(`consertos-${carimbo()}.csv`, csv(linhas), 'text/csv;charset=utf-8');
}
function exportarMaquinas(d) {
  const linhas = [['Código', 'Nome', 'Tipo', 'Marca/modelo', 'Série/placa', 'Situação', 'Fazenda', 'Gasto com consertos']];
  for (const m of d.maquinas) {
    const gasto = d.consertos.filter((c) => c.maquinaId === m.id).reduce((s, c) => s + (Number(c.custoFinal) || 0), 0);
    linhas.push([m.codigo, m.nome, m.tipo, m.marca, m.serie, STATUS_MAQ[m.status || 'disponivel'][0], nomeFazenda(d, m.fazendaId), numBR(gasto)]);
  }
  baixar(`maquinas-${carimbo()}.csv`, csv(linhas), 'text/csv;charset=utf-8');
}
async function exportarBackup() {
  const dados = { app: 'controle-de-transferencias', versao: 2, geradoEm: new Date().toISOString() };
  for (const l of DB.LOJAS) dados[l] = await DB.todos(l);
  baixar(`copia-transferencias-${carimbo()}.json`, JSON.stringify(dados), 'application/json');
}
// Importa (soma) um backup. Serve para trazer os dados da versão antiga, que ficavam só no celular.
async function importarBackup(e) {
  const arq = e.target.files[0];
  if (!arq) return;
  try {
    const dados = JSON.parse(await arq.text());
    if (dados.app !== 'controle-de-transferencias') throw new Error('arquivo não é um backup deste app');
    await importarDados(dados);
  } catch (err) {
    alert('Não foi possível importar: ' + err.message);
  } finally {
    e.target.value = '';
  }
}
async function importarDados(dados) {
    const total = DB.LOJAS.reduce((n, l) => n + (dados[l] || []).length, 0);
    if (!confirm(`Importar ${total} registros para o servidor? Registros com o mesmo código são substituídos; os demais dados atuais continuam.`)) return false;
    for (const l of DB.LOJAS) {
      for (const obj of dados[l] || []) {
        for (const k of ['saida', 'chegada', 'retorno']) {
          const ck = obj[k];
          if (ck && Array.isArray(ck.fotos) && ck.fotos.length) {
            const ids = await Promise.all(ck.fotos.map((f) => DB.salvarFoto(f)));
            obj[k] = { ...ck, fotos: [], fotoIds: [...(ck.fotoIds || []), ...ids] };
          }
        }
        await DB.salvar(l, obj);
      }
    }
    alert('Importado e confirmado no servidor.');
    location.hash = '#/';
    return true;
}

// ---------- Dados da versão antiga (ficavam só no celular, em IndexedDB) ----------
function lerBancoAntigo() {
  return new Promise((ok) => {
    try { if (localStorage.getItem('ct-antigo-importado')) return ok(null); } catch {}
    if (!window.indexedDB) return ok(null);
    let criou = false;
    const req = indexedDB.open('controle-transferencias');
    req.onupgradeneeded = () => { criou = true; }; // não existia: nada a importar
    req.onerror = () => ok(null);
    req.onsuccess = async () => {
      const bd = req.result;
      if (criou || !bd.objectStoreNames.length) { bd.close(); return ok(null); }
      const dados = { app: 'controle-de-transferencias' };
      for (const l of ['fazendas', 'maquinas', 'transferencias', 'consertos', 'config']) {
        if (!bd.objectStoreNames.contains(l)) continue;
        dados[l] = await new Promise((r) => {
          const g = bd.transaction(l).objectStore(l).getAll();
          g.onsuccess = () => r(g.result); g.onerror = () => r([]);
        });
      }
      bd.close();
      const total = ['fazendas', 'maquinas', 'transferencias', 'consertos'].reduce((n, l) => n + (dados[l] || []).length, 0);
      ok(total ? dados : null);
    };
  });
}

// ---------- Roteador ----------

const rotas = [
  [/^\/$/, 'inicio', 'inicio'],
  [/^\/maquinas$/, 'maquinas', 'maquinas'],
  [/^\/maquinas\/nova$/, 'maquinaForm', 'maquinas'],
  [/^\/maquinas\/([^/]+)\/editar$/, 'maquinaForm', 'maquinas'],
  [/^\/maquinas\/([^/]+)$/, 'maquina', 'maquinas'],
  [/^\/transferencias$/, 'transferencias', 'transferencias'],
  [/^\/transferencias\/nova$/, 'transferenciaNova', 'transferencias'],
  [/^\/transferencias\/([^/]+)\/chegada$/, 'transferenciaChegada', 'transferencias'],
  [/^\/transferencias\/([^/]+)$/, 'transferencia', 'transferencias'],
  [/^\/consertos$/, 'consertos', 'consertos'],
  [/^\/consertos\/novo$/, 'consertoNovo', 'consertos'],
  [/^\/consertos\/([^/]+)\/retorno$/, 'consertoRetorno', 'consertos'],
  [/^\/consertos\/([^/]+)$/, 'conserto', 'consertos'],
  [/^\/fazendas\/nova$/, 'fazendaForm', 'mais'],
  [/^\/fazendas\/([^/]+)\/editar$/, 'fazendaForm', 'mais'],
  [/^\/usuarios\/novo$/, 'usuarioNovo', 'mais'],
  [/^\/usuarios\/([^/]+)$/, 'usuario', 'mais'],
  [/^\/mais$/, 'mais', 'mais']
];
// Telas só de leitura: podem ser redesenhadas quando chega dado novo de outro aparelho.
const TELAS_AO_VIVO = new Set(['inicio', 'maquinas', 'maquina', 'transferencias', 'transferencia', 'consertos', 'conserto']);
let telaAtual = null;

let renderAtual = 0;
async function render({ manterRolagem = false } = {}) {
  if (!sessao.perfil) return;
  const minha = ++renderAtual;
  const bruto = location.hash.replace(/^#/, '') || '/';
  const [caminho, qs] = bruto.split('?');
  const params = new URLSearchParams(qs || '');
  let tela = 'inicio', aba = 'inicio', arg;
  for (const [re, t, a] of rotas) {
    const m = caminho.match(re);
    if (m) { tela = t; aba = a; arg = m[1]; break; }
  }
  const rolagem = window.scrollY;
  try {
    const fila = [];
    const html = await telas[tela](arg, params, { depois: (fn) => fila.push(fn) });
    if (minha !== renderAtual) return; // outra tela foi aberta enquanto esta carregava
    telaAtual = tela;
    $('#app').innerHTML = html;
    fila.forEach((fn) => fn());
    carregarFotos();
    atualizarSelo();
  } catch (err) {
    console.error(err);
    $('#app').innerHTML = `<div class="aviso">Erro ao abrir a tela: ${esc(err.message)}</div>`;
  }
  $$('.abas a').forEach((a) => a.classList.toggle('ativa', a.dataset.aba === aba));
  window.scrollTo(0, manterRolagem ? rolagem : 0);
}

function carregarFotos() {
  $$('img[data-foto]').forEach(async (img) => {
    const id = img.dataset.foto;
    img.dataset.foto = '';
    try {
      const src = await DB.foto(id);
      if (!src) { img.alt = 'foto ainda não sincronizada'; return; }
      img.src = src;
      const a = document.createElement('a');
      a.href = src; a.target = '_blank';
      img.replaceWith(a); a.appendChild(img);
    } catch { img.alt = 'foto indisponível sem internet'; }
  });
}

// Dado novo chegou (de outro aparelho ou desta gravação): atualiza a tela se ela for só de leitura
// e a pessoa não estiver digitando.
let agendado = null;
DB.aoMudar((loja) => {
  if (loja === '__gravando__') return mostrarGravando();
  clearTimeout(agendado);
  agendado = setTimeout(() => {
    atualizarSelo();
    const digitando = document.activeElement && document.activeElement.closest('#app form');
    if (TELAS_AO_VIVO.has(telaAtual) && !digitando) render({ manterRolagem: true });
  }, 250);
});

// Alertas dependem da hora: confere de novo a cada 10 minutos.
setInterval(() => {
  if (!sessao.perfil) return;
  atualizarSelo();
  const digitando = document.activeElement && document.activeElement.closest('#app form');
  if (telaAtual === 'inicio' && !digitando) render({ manterRolagem: true });
}, 10 * 60 * 1000);

// ---------- Login ----------
function mostrarNavegacao(sim) {
  $('.abas').style.display = sim ? '' : 'none';
  const av = $('#usuario-topo'), p = sim && sessao.perfil;
  av.hidden = !p;
  av.textContent = p ? p.nome.trim().split(/\s+/).filter((_, i, a) => i === 0 || i === a.length - 1).map((x) => x[0]).join('').toUpperCase() : '';
  av.title = p ? p.nome : '';
}

function telaLogin(primeiroAcesso = false) {
  mostrarNavegacao(false);
  telaAtual = 'login';
  const logo = (titulo, sub) => `<div class="logo"><img src="icon.svg" alt=""><h2>${titulo}</h2><p>${sub}</p></div>`;
  $('#app').innerHTML = `<div class="entrada">` + (primeiroAcesso ? `
    ${logo('Primeiro acesso', 'Controle de Transferências')}
    <p class="suave">Crie a conta do administrador. Isso só funciona uma vez; depois, o administrador cria os outros usuários pelo app.</p>
    <form id="form-login">
      <label>Seu nome completo</label><input name="nome" required>
      <label>Usuário</label><input name="usuario" required autocapitalize="none" placeholder="ex: josiel">
      <label>Senha (mínimo 6)</label><input type="password" name="senha" required minlength="6" autocomplete="new-password">
      <div class="acoes"><button>Criar administrador</button></div>
      <p style="text-align:center"><a href="#" id="lnk-voltar">Voltar para o login</a></p>
    </form>` : `
    ${logo('Controle de Transferências', 'Máquinas, fazendas e consertos')}
    <form id="form-login" class="cartao">
      <label>Usuário</label><input name="usuario" required autocapitalize="none" autocomplete="username">
      <div class="suave">Se você cadastrou e-mail de recuperação, entre com o e-mail.</div>
      <label>Senha</label><input type="password" name="senha" required autocomplete="current-password">
      <div class="acoes"><button>Entrar</button></div>
    </form>
    <details class="cartao" style="margin-top:12px"><summary>Esqueci a senha</summary>
      <p class="suave">Operador: fale com o administrador. Administrador: informe o e-mail de recuperação cadastrado.</p>
      <form id="form-recuperar">
        <input type="email" name="email" required placeholder="seu@email.com" autocomplete="email">
        <div class="acoes"><button class="sec">Enviar link para trocar a senha</button></div>
      </form>
    </details>
    <form>
      <p style="text-align:center" id="p-primeiro" hidden><a href="#" id="lnk-primeiro">Primeiro acesso (criar administrador)</a></p>
    </form>
    <p class="rodape">Cada registro só é confirmado depois de chegar ao servidor.</p>`) + `</div>`;
  const f = $('#form-login');
  const lp = $('#lnk-primeiro'), lv = $('#lnk-voltar');
  if (lp) lp.onclick = (e) => { e.preventDefault(); telaLogin(true); };
  // "Primeiro acesso" só aparece enquanto não existe administrador.
  if (lp) sessao.existeAdmin().then((existe) => { if (existe !== true && $('#p-primeiro')) $('#p-primeiro').hidden = false; });
  if (lv) lv.onclick = (e) => { e.preventDefault(); telaLogin(false); };
  const fr = $('#form-recuperar');
  if (fr) fr.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await sessao.recuperarSenha(fr.email.value);
      alert('Se esse e-mail estiver cadastrado, chega um link para criar uma senha nova. Veja também o spam.');
    } catch (err) { alert(err.message); }
  });
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const b = $('button', f); b.disabled = true;
    try {
      if (primeiroAcesso) await sessao.criarPrimeiroAdmin(f.nome.value, f.usuario.value, f.senha.value);
      else await sessao.entrar(f.usuario.value, f.senha.value);
      // a troca de tela acontece em sessao.aoMudar
    } catch (err) {
      alert(err.message);
      b.disabled = false;
    }
  });
}

function telaBloqueado(msg) {
  mostrarNavegacao(false);
  telaAtual = 'bloqueado';
  $('#app').innerHTML = `<div class="aviso">${esc(msg)}</div><div class="acoes"><button id="btn-sair">Sair</button></div>`;
  $('#btn-sair').onclick = () => sessao.sair();
}

function telaSemConfiguracao() {
  mostrarNavegacao(false);
  $('#app').innerHTML = `<div class="aviso">O app ainda não foi ligado ao banco de dados. Preencha <code>firebase-config.js</code> (veja o README).</div>`;
}

// ---------- Início ----------
// O endereço oficial passou a ser o do Firebase. Quem ainda abre pelo GitHub vê o aviso.
const ENDERECO_OFICIAL = 'https://controle-transferencias.web.app/';
if (location.hostname.endsWith('github.io')) {
  const aviso = document.createElement('div');
  aviso.className = 'aviso';
  aviso.style.margin = '12px 16px 0';
  aviso.innerHTML = `O app mudou de endereço. Abra <a href="${ENDERECO_OFICIAL}"><b>controle-transferencias.web.app</b></a>,
    entre com seu usuário e adicione de novo à tela inicial. Seus dados continuam lá.`;
  document.body.insertBefore(aviso, $('#app'));
}

// O app só funciona com internet, para garantir que tudo que aparece como salvo está no servidor.
function statusRede() {
  const on = navigator.onLine;
  const p = $('#status-rede');
  p.classList.toggle('off', !on);
  p.title = on ? 'Conectado' : 'Sem internet';
  $('#bloqueio-rede').hidden = on;
}
function mostrarGravando() {
  $('#gravando').hidden = !DB.gravando;
}
// Erro numa gravação (sem internet, servidor não confirmou, sem permissão): avisa e não avança.
window.addEventListener('unhandledrejection', (e) => {
  const msg = e.reason && e.reason.message;
  if (msg) { e.preventDefault(); alert(msg); }
});

window.addEventListener('hashchange', () => render());
window.addEventListener('online', statusRede);
window.addEventListener('offline', statusRede);
statusRede();

if (!firebaseConfig) {
  telaSemConfiguracao();
} else {
  mostrarNavegacao(false);
  $('#app').innerHTML = '<p class="vazio">Carregando…</p>';
  sessao.aoMudar((p) => {
    if (!p) return telaLogin(false);
    if (p.bloqueado) return telaBloqueado(p.bloqueado);
    mostrarNavegacao(true);
    if (telaAtual === 'login' || telaAtual === 'bloqueado' || telaAtual === null) render();
  });
  iniciar(firebaseConfig);
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});
  // Quando uma versão nova do app assume, recarrega uma vez para mostrar a novidade.
  let recarregou = false;
  const tinhaControle = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!tinhaControle || recarregou) return;
    recarregou = true;
    location.reload();
  });
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
