# Controle de Transferências

App para registrar a movimentação de máquinas e equipamentos entre fazendas e os envios para conserto na cidade, com checklist de saída e de chegada.

Funciona no celular, inclusive **sem internet**, e sincroniza os dados entre todos os usuários quando há sinal. Pode ser instalado na tela inicial como um app.

## O que faz

- **Cadastro** de fazendas e de máquinas/equipamentos (código de frota, tipo, marca, série/placa).
- **Transferência entre fazendas**: checklist na saída e checklist na chegada. O app compara os dois e aponta divergências (ex.: saiu com tanque cheio e chegou com 1/2; pneu OK na saída e com problema na chegada; horímetro menor na chegada).
- **Conserto na cidade**: oficina, defeito, orçamento, prazo (avisa quando vence), retorno com custo final, nota fiscal e serviço feito, e checklist de envio e retorno.
- **Histórico por máquina**: tudo o que a máquina passou e quanto já se gastou com conserto.
- **Fotos** no checklist (tiradas pela câmera, comprimidas para não lotar o celular).
- **Exportação para planilha** (CSV que abre no Excel/Google Planilhas): transferências, consertos e máquinas.
- **Login com níveis** (administrador e operador) e **dados compartilhados** entre os aparelhos.
- **Checklist editável** em *Mais → Itens do checklist*.

### Checklist padrão

Horímetro/odômetro, nível de combustível, pneus/esteiras, óleo do motor, óleo hidráulico, baterias, vazamentos, lataria/estrutura, luzes e sinalização, extintor, documentos e ferramentas, acessórios/implementos que acompanham. Sempre entram também: responsável, data/hora, observações e fotos.

## Login e dados compartilhados

Os dados ficam num banco online (Firebase, do Google) e numa cópia em cada aparelho. Assim todo mundo vê as mesmas máquinas e registros, e o app continua funcionando **sem internet**: o que for lançado offline sobe sozinho quando o sinal voltar.

- **Administrador** (só um, criado no primeiro acesso): tudo, inclusive cadastrar fazendas e máquinas, criar e desativar usuários (só ele cria contas, e sempre como operador), editar o checklist, cancelar transferências e excluir consertos, importar backup.
- **Operador**: lança transferências e consertos, registra chegada e retorno, vê tudo e exporta planilhas.
- Login por **usuário e senha** (não precisa de e-mail). Cada registro guarda quem lançou.
- Esqueceu a senha: o administrador desativa o usuário antigo e cria um novo. A própria pessoa pode trocar a senha em *Mais → Minha conta*.
- O primeiro login e a criação de usuários precisam de internet. Depois de entrar uma vez, o app abre offline.

### Configurar o Firebase (uma vez)

1. Em https://console.firebase.google.com, crie um projeto.
2. Em *Visão geral do projeto*, adicione um app **Web** (ícone `</>`) e copie o objeto `firebaseConfig` para `firebase-config.js`.
3. *Authentication → Começar →* ative **E-mail/senha**.
4. *Firestore Database → Criar banco* (local `southamerica-east1`, modo produção).
5. *Firestore Database → Regras*: cole o conteúdo de `firestore.rules` e clique em **Publicar**.
6. Abra o app, toque em **Primeiro acesso** e crie o administrador. Isso só funciona uma vez.
7. Em *Mais → Usuários*, crie os operadores.

Dados da versão antiga (que ficavam só no celular): entre como administrador **no mesmo aparelho** e, em *Mais*, toque em **Enviar para o servidor** no aviso amarelo. Se tiver um arquivo de backup antigo, use *Mais → Importar backup*.

### Limites do plano gratuito do Firebase

Para o tamanho de uma operação de fazendas, o plano gratuito (Spark) deve bastar: 1 GB de armazenamento, 50 mil leituras e 20 mil gravações por dia. As fotos são o que mais ocupa (cerca de 100 KB cada, comprimidas), então 1 GB dá para algo na casa de 10 mil fotos. Acompanhe em *Firestore → Uso*.

## Rodar no computador

Qualquer servidor de arquivos estáticos serve, por exemplo:

```
python3 -m http.server 8000
```

e abra `http://localhost:8000`.

Para testar sem mexer no banco real, use o Firebase Emulator (`firebase emulators:start --only auth,firestore`) e abra `http://localhost:8000/?emulador`.

## Estrutura

| Arquivo | O que é |
|---|---|
| `index.html` | Página principal |
| `app.js` | Telas e regras do app |
| `db.js` | Login e dados (Firebase Auth + Firestore com cópia offline) |
| `firebase-config.js` | Identificação do projeto Firebase |
| `firestore.rules` | Regras de acesso do banco (quem pode ler e gravar o quê) |
| `vendor/firebase/` | SDK do Firebase 10.14.1, copiado para abrir sem internet |
| `styles.css` | Visual |
| `sw.js` | Service worker (funcionamento offline). Ao alterar arquivos, aumente a `VERSAO` |
| `manifest.webmanifest`, `icon.svg` | Instalação como app |
