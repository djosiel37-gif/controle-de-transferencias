# Controle de Transferências

App para registrar a movimentação de máquinas e equipamentos entre fazendas e os envios para conserto na cidade, com checklist de saída e de chegada.

Funciona no celular, **sem internet** (os dados ficam salvos no próprio aparelho). Pode ser instalado na tela inicial como um app.

## O que faz

- **Cadastro** de fazendas e de máquinas/equipamentos (código de frota, tipo, marca, série/placa).
- **Transferência entre fazendas**: checklist na saída e checklist na chegada. O app compara os dois e aponta divergências (ex.: saiu com tanque cheio e chegou com 1/2; pneu OK na saída e com problema na chegada; horímetro menor na chegada).
- **Conserto na cidade**: oficina, defeito, orçamento, prazo (avisa quando vence), retorno com custo final, nota fiscal e serviço feito, e checklist de envio e retorno.
- **Histórico por máquina**: tudo o que a máquina passou e quanto já se gastou com conserto.
- **Fotos** no checklist (tiradas pela câmera, comprimidas para não lotar o celular).
- **Exportação para planilha** (CSV que abre no Excel/Google Planilhas): transferências, consertos e máquinas.
- **Backup e restauração** em arquivo.
- **Checklist editável** em *Mais → Itens do checklist*.

### Checklist padrão

Horímetro/odômetro, nível de combustível, pneus/esteiras, óleo do motor, óleo hidráulico, baterias, vazamentos, lataria/estrutura, luzes e sinalização, extintor, documentos e ferramentas, acessórios/implementos que acompanham. Sempre entram também: responsável, data/hora, observações e fotos.

## Atenção: onde ficam os dados

Nesta versão os dados ficam **somente no aparelho** onde foram lançados. Isso quer dizer:

- Cada celular tem os seus registros; um não vê o do outro.
- Se limpar os dados do navegador ou perder o celular, perde os registros. **Faça backup com frequência** (Mais → Baixar backup) e guarde o arquivo no Drive ou WhatsApp.

Se mais de uma pessoa precisar lançar e ver os mesmos dados, o próximo passo é ligar o app a um banco de dados online.

## Como colocar no ar (GitHub Pages)

1. No repositório, vá em **Settings → Pages**.
2. Em *Source*, escolha **Deploy from a branch**, branch `main`, pasta `/ (root)`, e salve.
3. Em 1 ou 2 minutos aparece o link (algo como `https://djosiel37-gif.github.io/controle-de-transferencias/`).
4. Abra o link no celular e use **Adicionar à tela inicial**. Depois de aberto uma vez com internet, funciona offline.

> GitHub Pages em repositório **privado** só funciona em conta paga. Em conta gratuita, o repositório precisa ser público (os dados lançados **não** vão para o GitHub, ficam no celular; o que fica público é só o código do app).

## Rodar no computador

Qualquer servidor de arquivos estáticos serve, por exemplo:

```
python3 -m http.server 8000
```

e abra `http://localhost:8000`.

## Estrutura

| Arquivo | O que é |
|---|---|
| `index.html` | Página principal |
| `app.js` | Telas e regras do app |
| `db.js` | Gravação local (IndexedDB) |
| `styles.css` | Visual |
| `sw.js` | Service worker (funcionamento offline). Ao alterar arquivos, aumente a `VERSAO` |
| `manifest.webmanifest`, `icon.svg` | Instalação como app |
