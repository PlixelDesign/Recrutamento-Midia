# Formulário de inscrição — Equipe de Mídia

Formulário em etapas para quem quer servir na equipe de mídia da Assembleia de Deus Subsede Industrial São Luiz (Contagem/MG). Fica hospedado no GitHub Pages e grava as respostas numa planilha do Google.

O formulário não aprova ninguém: ele coleta dados, interesse, experiência e alinha expectativas. É o passo 3 do processo (convite → conversa → **formulário** → teste prático → período de observação).

## Arquivos

| Arquivo | Para que serve |
| --- | --- |
| `index.html` | A página do formulário |
| `styles.css` | Visual. As cores ficam no topo (`--acento` e `--acento-suave`) |
| `script.js` | Etapas, validação, máscara de telefone, envio |
| `config.js` | **O que você edita:** URL do Apps Script, lista de cultos, nome do líder |
| `apps-script/Code.gs` | Código que roda no Google e grava na planilha |

Nenhuma resposta fica no repositório. No aparelho de quem preenche, o navegador guarda um rascunho (para não perder o que foi digitado se a página fechar). Ele é apagado assim que o envio dá certo, e também pode ser apagado pelo botão "Apagar e começar do zero" na abertura.

---

## Passo a passo para colocar no ar

### 1. Criar a planilha e abrir o Apps Script

1. Entre em [sheets.google.com](https://sheets.google.com) com a conta Google da igreja (ou a sua).
2. Crie uma planilha em branco. Dê um nome, por exemplo **Inscrições Mídia**.
3. No menu da planilha, clique em **Extensões → Apps Script**. Abre uma nova aba com um editor de código.

> O script precisa ser criado **de dentro da planilha** (por esse menu). Se você criar em script.google.com, ele não sabe em qual planilha gravar.

### 2. Colar o código e implantar como App da Web

1. No editor, apague todo o conteúdo do arquivo `Código.gs` que já vem aberto.
2. Abra o arquivo `apps-script/Code.gs` deste repositório, copie **tudo** e cole no editor.
3. Clique no ícone de disquete (**Salvar projeto**).
4. **Formatar a planilha:** no topo do editor, escolha a função **configurarPlanilha** e clique em **Executar**.
   - O Google vai pedir autorização. Clique em **Revisar permissões**, escolha sua conta.
   - Vai aparecer "O Google não verificou este app". Isso é normal para scripts próprios. Clique em **Avançado → Acessar (nome do projeto) (não seguro) → Permitir**.
   - Volte para a planilha: ela terá a aba **Inscricoes** (cabeçalho colorido, filtro, cores por status, menores destacados) e a aba **Resumo** (contagens automáticas por status, culto e frequência). Pode rodar de novo quando quiser: não apaga inscrições.
   - Se o script foi criado direto em script.google.com (fora de uma planilha), essa função **cria a planilha "Inscrições Mídia" no seu Google Drive** e mostra o link no **Registro de execução**.
5. (Recomendado) Teste antes de publicar: escolha a função **testarGravacao** e clique em **Executar**. Deve aparecer uma linha "Teste da Silva" na aba **Inscricoes**. Apague essa linha.
6. Clique em **Implantar → Nova implantação**.
7. Clique na engrenagem ao lado de "Selecione o tipo" e escolha **App da Web**.
8. Preencha:
   - **Descrição:** `Formulário mídia v1`
   - **Executar como:** **Eu** (seu e-mail)
   - **Quem pode acessar:** **Qualquer pessoa**
     (não escolha "Qualquer pessoa com Conta do Google": quem não estiver logado não conseguiria enviar)
9. Clique em **Implantar**. Autorize de novo se pedir.

### 3. Copiar a URL e colar no `config.js`

1. Depois de implantar, aparece a **URL do App da Web**, terminando em `/exec`. Clique em **Copiar**.
2. Abra `config.js` e troque o texto entre aspas:

   ```js
   const SCRIPT_URL = "https://script.google.com/macros/s/AKfy.../exec";
   ```

3. No mesmo arquivo, confira:
   - `CULTOS`: os cultos em que a mídia é escalada (um por linha, entre aspas, separados por vírgula).
   - `NOME_LIDER`: o nome que aparece na tela final ("O próximo passo é uma conversa com o líder de mídia, **Fulano**"). Pode deixar `""`.

Para conferir se a URL está certa, abra ela no navegador: deve aparecer "Formulário da Mídia: script ativo".

### 4. Subir no GitHub e ativar o GitHub Pages

1. Envie os arquivos para o repositório no GitHub, na branch `main` (pelo site: **Add file → Upload files**, arraste tudo, mantendo a pasta `apps-script`).
2. No repositório, vá em **Settings → Pages**.
3. Em **Build and deployment → Source**, escolha **Deploy from a branch**.
4. Em **Branch**, escolha **main** e a pasta **/ (root)**. Clique em **Save**.
5. Espere 1 a 2 minutos e recarregue a página. O endereço aparece no topo, algo como
   `https://seu-usuario.github.io/Recrutamento-Midia/`.

Esse é o link que vai para o culto, Instagram e WhatsApp.

### 5. Testar e atualizar depois

**Testar o formulário inteiro**

1. Abra o link do GitHub Pages no celular.
2. Preencha como se fosse um candidato. Faça pelo menos dois testes: um maior de idade e um menor (data de nascimento recente: os campos do responsável têm que aparecer).
3. Confira se as linhas chegaram na aba **Inscricoes**. Apague as linhas de teste depois.
4. Para testar o erro: ligue o modo avião antes de tocar em "Enviar inscrição". Deve aparecer uma mensagem de erro e os dados devem continuar lá. Desligue o modo avião e tente de novo.

> O formulário bloqueia envios feitos menos de 10 segundos depois de abrir a página (proteção contra robôs). Num teste muito rápido, espere um pouco e envie de novo.

**Atualizar o formulário (HTML, CSS, JS, config)**

Edite os arquivos no GitHub e salve (commit). O GitHub Pages atualiza sozinho em 1 a 2 minutos. Se o celular mostrar a versão antiga, recarregue a página.

**Atualizar o script (`Code.gs`)**

Salvar o código no editor **não** muda o que está no ar. Você precisa publicar uma nova versão. Há dois caminhos, e a diferença importa:

- **Gerenciar implantações (use este):** **Implantar → Gerenciar implantações** → clique no lápis ✏️ da implantação atual → em **Versão**, escolha **Nova versão** → **Implantar**.
  **A URL continua a mesma.** Não precisa mexer no `config.js`.
- **Nova implantação:** cria **outra URL**. Se fizer isso, tem que colar a URL nova no `config.js`, senão o formulário continua mandando para a versão antiga.

---

## A planilha

Cada inscrição vira uma linha na aba **Inscricoes**, com as colunas:

Data/hora · Nome · WhatsApp · Nascimento · Idade · Menor de idade · Responsável · WhatsApp responsável · Bairro/cidade · Tempo de igreja · Batismo · Serve em outro ministério/conjunto · Qual/frequência · Motivação · Resposta situacional · Áreas · Apps · Aprendizado recente · Link · Equipamento · Cultos · Frequência · Compromissos aceitos · Status

- Listas (áreas, apps, cultos etc.) ficam separadas por `; `.
- **Status** começa como `Aguardando conversa` e tem uma lista suspensa com: Conversa feita / Teste / Observação / Aprovado / Não seguiu.
- Não renomeie a aba nem mude a ordem das colunas: o script grava por posição.
- A idade é calculada no servidor (fuso de São Paulo), não no celular de quem preencheu.

**Cuidado com os dados.** A planilha tem telefone, data de nascimento e dados de menores de idade. Compartilhe só com quem faz parte da liderança de mídia, e nunca com "qualquer pessoa com o link".

## Proteções contra spam

- Campo escondido (honeypot): pessoas não veem; robôs preenchem. O script descarta esses envios sem avisar.
- Botão desabilitado durante o envio (evita inscrição duplicada por toque duplo).
- Envio bloqueado nos primeiros 10 segundos após abrir a página.
- O servidor valida de novo nome, WhatsApp, data de nascimento e, para menores, os dados do responsável.

## Mudar cores ou textos

- **Cores:** topo do `styles.css`, variáveis `--acento` (botões, barra de progresso) e `--acento-suave` (fundo das opções marcadas). Use um tom escuro em `--acento` para o texto branco do botão continuar legível.
- **Textos e perguntas:** `index.html`. Se mudar o texto de uma opção, as respostas novas chegam com o texto novo na planilha.
- **Logo:** não há logo. Para incluir, coloque o arquivo na raiz (ex.: `logo.png`) e adicione `<img src="logo.png" alt="Assembleia de Deus Industrial São Luiz" width="48" height="48">` dentro do `<p class="igreja">` no `index.html`.

## Problemas comuns

| Sintoma | Causa provável |
| --- | --- |
| "O formulário ainda não está ligado à planilha" | `SCRIPT_URL` no `config.js` ainda não foi preenchida, ou não começa com `https://script.google.com/` |
| "Confira sua conexão" mesmo com internet | Implantação com acesso diferente de **Qualquer pessoa**, ou URL errada/antiga no `config.js` |
| Mudei o `Code.gs` e nada mudou | Faltou publicar nova versão em **Gerenciar implantações** |
| Inscrição não aparece na planilha | O script foi criado fora da planilha. Refaça o passo 1 pelo menu Extensões → Apps Script |
