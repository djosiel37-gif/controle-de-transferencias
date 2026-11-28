// Camada de dados online (Firebase Auth + Firestore), com cópia local para funcionar sem internet.
// Gravações feitas offline ficam na fila do aparelho e sobem sozinhas quando volta o sinal.
import { initializeApp, deleteApp } from './vendor/firebase/firebase-app.js';
import {
  getAuth, initializeAuth, connectAuthEmulator, inMemoryPersistence, onAuthStateChanged,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut,
  updatePassword, EmailAuthProvider, reauthenticateWithCredential,
  sendPasswordResetEmail, verifyBeforeUpdateEmail
} from './vendor/firebase/firebase-auth.js';
import {
  initializeFirestore, connectFirestoreEmulator, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, onSnapshot, setDoc, deleteDoc, getDoc, writeBatch, serverTimestamp
} from './vendor/firebase/firebase-firestore.js';

// Coleções que o app mantém em memória (sincronizadas em tempo real).
const LOJAS = ['fazendas', 'maquinas', 'transferencias', 'consertos', 'config', 'usuarios'];
// Domínio fictício: o login é por "usuário", mas o Firebase exige um e-mail por baixo.
const DOMINIO = 'usuarios.controle-transferencias.app';

let app, auth, db, config, emulador = false;
const memoria = Object.fromEntries(LOJAS.map((l) => [l, new Map()]));
let cancelarEscutas = [];
let perfil = null;
const ouvintes = { dados: new Set(), sessao: new Set() };

const avisar = (tipo, ...a) => ouvintes[tipo].forEach((fn) => { try { fn(...a); } catch (e) { console.error(e); } });
const novoId = () => doc(collection(db, 'x')).id;

export function normalizarUsuario(u) {
  return String(u || '').trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '.').replace(/[^a-z0-9._-]/g, '');
}
// Quem cadastrou um e-mail real (o administrador) entra com o e-mail; os demais, com o usuário.
const emailDe = (usuario) => String(usuario).includes('@')
  ? String(usuario).trim().toLowerCase()
  : `${normalizarUsuario(usuario)}@${DOMINIO}`;

function traduzirErro(e) {
  const c = (e && e.code) || '';
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found') || c.includes('invalid-email'))
    return 'Usuário ou senha incorretos.';
  if (c.includes('email-already-in-use')) return 'Já existe alguém com esse usuário.';
  if (c.includes('weak-password')) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (c.includes('network-request-failed') || c.includes('unavailable')) return 'Sem internet. Essa ação precisa de conexão.';
  if (c.includes('too-many-requests')) return 'Muitas tentativas. Espere alguns minutos.';
  if (c.includes('permission-denied')) return 'Você não tem permissão para isso.';
  if (c.includes('requires-recent-login')) return 'Saia e entre de novo antes de fazer isso.';
  if (c.includes('missing-email')) return 'Informe o e-mail.';
  if (c.includes('operation-not-allowed')) return 'Ação não liberada no Firebase (veja o README).';
  return (e && e.message) || 'Erro desconhecido.';
}
const comErro = async (fn) => { try { return await fn(); } catch (e) { throw new Error(traduzirErro(e)); } };

// ---------- Inicialização ----------
export function iniciar(cfg) {
  config = cfg;
  app = initializeApp(cfg);
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    ignoreUndefinedProperties: true
  });
  auth = getAuth(app);
  // Só para testes no computador: http://localhost:8000/?emulador usa o Firebase Emulator.
  if (location.hostname === 'localhost' && new URLSearchParams(location.search).has('emulador')) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    emulador = true;
  }
  onAuthStateChanged(auth, (u) => {
    pararEscutas();
    perfil = null;
    if (!u) return avisar('sessao', null);
    // Perfil do usuário (nome, papel, ativo). Se for desativado, cai fora na hora.
    const parar = onSnapshot(doc(db, 'usuarios', u.uid), (s) => {
      const p = s.exists() ? { id: s.id, ...s.data() } : null;
      if (!p) {
        // Pode ser o 1º administrador sendo criado agora; espera a gravação chegar.
        if (!s.metadata.fromCache) avisar('sessao', { bloqueado: 'Usuário sem cadastro no app. Fale com o administrador.' });
        return;
      }
      if (p.ativo === false) {
        pararEscutasDados(); perfil = null;
        avisar('sessao', { bloqueado: 'Seu acesso foi desativado. Fale com o administrador.' });
        return;
      }
      // Espera o servidor confirmar o perfil (no 1º acesso ele acabou de ser gravado) antes de abrir as escutas.
      if (s.metadata.hasPendingWrites) return;
      const primeira = !perfil;
      perfil = p;
      if (primeira) iniciarEscutas();
      avisar('sessao', perfil);
    }, (e) => avisar('sessao', { bloqueado: traduzirErro(e) }));
    cancelarEscutas.push(parar);
  });
}

function iniciarEscutas() {
  LOJAS.forEach((loja) => escutar(loja));
}
// Uma escuta que dá erro (ex.: permissão ainda propagando) é encerrada pelo Firebase; tenta de novo.
function escutar(loja, tentativa = 0) {
  const parar = onSnapshot(collection(db, loja), (snap) => {
    tentativa = 0;
    for (const ch of snap.docChanges()) {
      if (ch.type === 'removed') memoria[loja].delete(ch.doc.id);
      else memoria[loja].set(ch.doc.id, { ...ch.doc.data(), id: ch.doc.id });
    }
    avisar('dados', loja);
  }, (e) => {
    console.warn('Sincronização de', loja, 'falhou; tentando de novo.', e.code);
    const t = setTimeout(() => { if (perfil) escutar(loja, tentativa + 1); }, Math.min(30000, 2000 * 2 ** tentativa));
    cancelarDados.push(() => clearTimeout(t));
  });
  cancelarDados.push(parar);
}
let cancelarDados = [];
function pararEscutasDados() {
  cancelarDados.forEach((f) => f());
  cancelarDados = [];
  LOJAS.forEach((l) => memoria[l].clear());
}
function pararEscutas() {
  pararEscutasDados();
  cancelarEscutas.forEach((f) => f());
  cancelarEscutas = [];
}

// ---------- Sessão ----------
export const sessao = {
  get perfil() { return perfil; },
  get admin() { return !!perfil && perfil.papel === 'admin'; },
  aoMudar: (fn) => ouvintes.sessao.add(fn),
  entrar: (usuario, senha) => comErro(() => signInWithEmailAndPassword(auth, emailDe(usuario), senha)),
  sair: () => signOut(auth),
  // true / false, ou null se não deu para saber (sem internet).
  existeAdmin: async () => {
    try { return (await getDoc(doc(db, 'config', 'inicial'))).exists(); } catch { return null; }
  },

  // Primeiro acesso: cria a conta do administrador. As regras do banco só permitem isso uma vez.
  async criarPrimeiroAdmin(nome, usuario, senha) {
    return comErro(async () => {
      const ja = await getDoc(doc(db, 'config', 'inicial')).catch(() => null);
      if (ja && ja.exists()) throw Object.assign(new Error(), { message: 'Já existe um administrador. Peça para ele criar seu usuário.' });
      const cred = await createUserWithEmailAndPassword(auth, emailDe(usuario), senha);
      const b = writeBatch(db);
      b.set(doc(db, 'usuarios', cred.user.uid), {
        nome: nome.trim(), usuario: normalizarUsuario(usuario), papel: 'admin', ativo: true, criadoEm: serverTimestamp()
      });
      b.set(doc(db, 'config', 'inicial'), { criadoEm: serverTimestamp(), por: cred.user.uid });
      await b.commit();
    });
  },

  // Administrador cria outro usuário sem sair da própria conta (usa uma 2ª instância do Firebase).
  async criarUsuario({ nome, usuario, senha, papel }) {
    return comErro(async () => {
      const sec = initializeApp(config, 'secundario-' + Date.now());
      try {
        const secAuth = initializeAuth(sec, { persistence: inMemoryPersistence });
        if (emulador) connectAuthEmulator(secAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
        const cred = await createUserWithEmailAndPassword(secAuth, emailDe(usuario), senha);
        await setDoc(doc(db, 'usuarios', cred.user.uid), {
          nome: nome.trim(), usuario: normalizarUsuario(usuario), papel, ativo: true,
          criadoEm: serverTimestamp(), criadoPor: perfil ? perfil.nome : ''
        });
        await signOut(secAuth);
      } finally {
        await deleteApp(sec);
      }
    });
  },

  // E-mail real só existe se a pessoa cadastrou um (hoje, só o administrador).
  get emailReal() {
    const e = auth && auth.currentUser && auth.currentUser.email;
    return e && !e.endsWith('@' + DOMINIO) ? e : null;
  },

  // Cadastra um e-mail real para recuperar a senha. O Firebase manda um link de confirmação;
  // depois de confirmar, o login passa a ser por esse e-mail.
  async cadastrarEmail(senhaAtual, email) {
    return comErro(async () => {
      const u = auth.currentUser;
      await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, senhaAtual));
      await verifyBeforeUpdateEmail(u, email.trim().toLowerCase());
    });
  },

  // Só funciona para quem tem e-mail real cadastrado.
  recuperarSenha: (email) => comErro(() => sendPasswordResetEmail(auth, email.trim().toLowerCase())),

  async trocarSenha(atual, nova) {
    return comErro(async () => {
      const u = auth.currentUser;
      await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, atual));
      await updatePassword(u, nova);
    });
  }
};

// ---------- Dados ----------
const quem = () => (perfil ? { uid: perfil.id, nome: perfil.nome } : null);

// Toda gravação espera o servidor confirmar. Se não confirmar, quem chamou recebe erro e
// a tela não avança, para nunca parecer salvo o que não chegou no servidor.
const PRAZO_SERVIDOR = 20000;
let gravando = 0;
const avisarGravando = () => avisar('dados', '__gravando__');
// Recebe uma função (não a promessa) para checar a internet ANTES de pôr a gravação na fila.
async function confirmar(gravar) {
  if (!navigator.onLine) throw new Error('Sem internet. Nada foi salvo. Conecte-se e tente de novo.');
  gravando++; avisarGravando();
  try {
    const promessa = gravar();
    let t;
    const prazo = new Promise((_, rej) => { t = setTimeout(() => rej(new Error(
      'O servidor não confirmou a gravação (internet fraca). Não feche o app e confira em instantes se o registro aparece; se não aparecer, faça de novo.'
    )), PRAZO_SERVIDOR); });
    try { return await Promise.race([promessa, prazo]); } finally { clearTimeout(t); }
  } catch (e) {
    throw new Error(e.code ? 'Não foi salvo: ' + traduzirErro(e) : e.message);
  } finally {
    gravando--; avisarGravando();
  }
}
function carimbar(obj) {
  if (!obj.id) obj.id = novoId();
  obj.atualizadoEm = new Date().toISOString();
  obj.atualizadoPor = quem();
  if (!obj.criadoPor) { obj.criadoPor = quem(); obj.criadoEm = obj.atualizadoEm; }
  const { id, ...dados } = obj;
  return { id, dados };
}

export const DB = {
  novoId: () => novoId(),
  todos: async (loja) => [...memoria[loja].values()].map((o) => ({ ...o })),
  obter: async (loja, id) => { const o = memoria[loja].get(id); return o ? { ...o } : undefined; },
  get gravando() { return gravando > 0; },
  salvar: async (loja, obj) => {
    const { id, dados } = carimbar(obj);
    await confirmar(() => setDoc(doc(db, loja, id), dados));
    return obj;
  },
  remover: (loja, id) => confirmar(() => deleteDoc(doc(db, loja, id))),
  // Várias gravações juntas: ou todas entram, ou nenhuma (ex.: transferência + situação da máquina).
  // ops: [['salvar', loja, obj] | ['remover', loja, id]]
  lote: async (ops) => {
    if (!navigator.onLine) return confirmar(() => null);
    const b = writeBatch(db);
    for (const [acao, loja, x] of ops) {
      if (acao === 'remover') b.delete(doc(db, loja, x));
      else { const { id, dados } = carimbar(x); b.set(doc(db, loja, id), dados); }
    }
    await confirmar(() => b.commit());
  },
  // Fotos ficam numa coleção própria (cada documento do Firestore aceita no máximo 1 MB).
  salvarFoto: async (dataURL) => {
    const id = novoId();
    await confirmar(() => setDoc(doc(db, 'fotos', id), { dados: dataURL, criadoPor: quem(), criadoEm: new Date().toISOString() }));
    return id;
  },
  foto: async (id) => {
    const s = await getDoc(doc(db, 'fotos', id));
    return s.exists() ? s.data().dados : null;
  },
  removerFoto: (id) => deleteDoc(doc(db, 'fotos', id)).catch(() => {}),
  aoMudar: (fn) => ouvintes.dados.add(fn),
  LOJAS: ['fazendas', 'maquinas', 'transferencias', 'consertos', 'config']
};
