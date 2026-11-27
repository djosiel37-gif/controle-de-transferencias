// Camada de dados local (IndexedDB). Tudo fica salvo no próprio aparelho.
const DB = (() => {
  const NOME = 'controle-transferencias';
  const VERSAO = 1;
  const LOJAS = ['fazendas', 'maquinas', 'transferencias', 'consertos', 'config'];
  let conexao;

  function abrir() {
    if (conexao) return Promise.resolve(conexao);
    return new Promise((ok, erro) => {
      const req = indexedDB.open(NOME, VERSAO);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const loja of LOJAS) {
          if (!db.objectStoreNames.contains(loja)) db.createObjectStore(loja, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => { conexao = req.result; ok(conexao); };
      req.onerror = () => erro(req.error);
    });
  }

  async function tx(loja, modo, fn) {
    const db = await abrir();
    return new Promise((ok, erro) => {
      const t = db.transaction(loja, modo);
      const store = t.objectStore(loja);
      const resultado = fn(store);
      t.oncomplete = () => ok(resultado instanceof IDBRequest ? resultado.result : resultado);
      t.onerror = () => erro(t.error);
    });
  }

  const novoId = () =>
    (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

  return {
    novoId,
    todos: (loja) => tx(loja, 'readonly', (s) => s.getAll()),
    obter: (loja, id) => tx(loja, 'readonly', (s) => s.get(id)),
    salvar: (loja, obj) => {
      if (!obj.id) obj.id = novoId();
      obj.atualizadoEm = new Date().toISOString();
      return tx(loja, 'readwrite', (s) => s.put(obj)).then(() => obj);
    },
    remover: (loja, id) => tx(loja, 'readwrite', (s) => s.delete(id)),
    limpar: (loja) => tx(loja, 'readwrite', (s) => s.clear()),
    LOJAS
  };
})();
