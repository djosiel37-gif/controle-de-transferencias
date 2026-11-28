# Controle de Transferências

App para registrar a movimentação de máquinas e equipamentos entre fazendas e os envios para conserto na cidade, com checklist de saída e de chegada.

Funciona no celular e precisa de **internet**: só mostra "Salvo" depois que o servidor confirmar a gravação, para garantir que o dado chegou. Pode ser instalado na tela inicial como um app.

## O que faz

- **Cadastro** de fazendas e de máquinas/equipamentos (código de frota, tipo, marca, série/placa).
- **Transferência entre fazendas**: checklist na saída e checklist na chegada. O app compara os dois e aponta divergências (ex.: saiu com tanque cheio e chegou com 1/2; pneu OK na saída e com problema na chegada; horímetro menor na chegada).
- **Conserto na cidade**: oficina, defeito, orçamento, prazo (avisa quando vence), retorno com custo final, nota fiscal e serviço feito, e checklist de envio e retorno.
- **Histórico por máquina**: tudo o que a máquina passou e quanto já se gastou com conserto.
- **Fotos** no checklist (tiradas pela câmera, comprimidas para não lotar o celular).
- **Exportação para planilha** (CSV que abre no Excel/Google Planilhas): transferências, consertos e máquinas.
- **Login com níveis** (administrador e operador) e **dados compartilhados** entre os aparelhos.
- **Checklist editável** em *Mais → Itens do checklist*.
- **Alertas** na tela inicial: conserto com prazo vencido e máquina em trânsito há mais tempo que o limite (padrão 24 h, o administrador muda em *Mais → Alertas*).

### Checklist padrão

Horímetro/odômetro, nível de combustível, pneus/esteiras, óleo do motor, óleo hidráulico, baterias, vazamentos, lataria/estrutura, luzes e sinalização, extintor, documentos e ferramentas, acessórios/implementos que acompanham. Sempre entram também: responsável, data/hora, observações e fotos.

## Login e dados compartilhados

Os dados ficam num banco online (Firebase, do Google), então todo mundo vê as mesmas máquinas e registros.

**Só funciona com internet.** Sem sinal, o app bloqueia a tela. Cada gravação espera a confirmação do servidor (até 20 s); se não vier, aparece um aviso e nada é dado como salvo. Onde não pega sinal, anote no papel e lance depois.

- **Administrador** (só um, criado no primeiro acesso): tudo, inclusive cadastrar fazendas e máquinas, criar e desativar usuários (só ele cria contas, e sempre como operador), editar o checklist, cancelar transferências e excluir consertos, importar backup.
- **Operador**: lança transferências e consertos, registra chegada e retorno, vê tudo e exporta planilhas.
- Login por **usuário e senha** (não precisa de e-mail). Cada registro guarda quem lançou.
- Esqueceu a senha (operador): o administrador desativa o usuário antigo e cria um novo. A própria pessoa pode trocar a senha em *Mais → Minha conta*.
- Esqueceu a senha (administrador): cadastre antes um e-mail real em *Mais → Minha conta → E-mail para recuperar a senha* e confirme pelo link que chega. Depois disso o login do administrador passa a ser por esse e-mail, e na tela de login *Esqueci a senha* manda um link para criar outra.

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

## Endereço do app

**https://controle-transferencias.web.app** (Firebase Hosting, gratuito).

Toda alteração que entra na branch `main` é publicada sozinha pelo GitHub Actions (`.github/workflows/publicar.yml`). Quando `firestore.rules` mudar, cole o arquivo em *Firestore Database → Regras → Publicar* (a chave padrão do Firebase não tem permissão para publicar regras).

### Configurar a publicação automática (uma vez)

1. No Console do Firebase: ⚙️ *Configurações do projeto → Contas de serviço → Gerar nova chave privada*. Baixa um arquivo `.json`.
2. No GitHub: *Settings → Secrets and variables → Actions → New repository secret*.
   - Name: `FIREBASE_SERVICE_ACCOUNT`
   - Secret: cole o conteúdo inteiro do arquivo `.json`.
3. Em *Actions → Publicar no Firebase → Run workflow* para publicar a primeira vez.

O arquivo `.json` é uma senha de administrador do projeto: não mande para ninguém e apague do computador depois de colar no GitHub.

O endereço antigo do GitHub Pages mostra um aviso apontando para o novo. Quando todos tiverem migrado, desative o Pages em *Settings → Pages*.

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
| `db.js` | Login e dados (Firebase Auth + Firestore, gravação confirmada no servidor) |
| `firebase-config.js` | Identificação do projeto Firebase |
| `firestore.rules` | Regras de acesso do banco (quem pode ler e gravar o quê) |
| `firebase.json`, `.firebaserc`, `.github/workflows/publicar.yml` | Publicação no Firebase Hosting |
| `vendor/firebase/` | SDK do Firebase 10.14.1, copiado para o próprio site |
| `styles.css` | Visual |
| `sw.js` | Service worker (guarda os arquivos para abrir mais rápido). Ao alterar arquivos, aumente a `VERSAO` |
| `manifest.webmanifest`, `icon.svg` | Instalação como app |
