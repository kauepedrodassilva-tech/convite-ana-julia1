# Convite digital — Ana Júlia (projeto completo)

Projeto independente em Node.js, sem dependências externas. Inclui página responsiva, confirmação de presença, lista de presentes com escolha única, painel administrativo, exportação CSV e persistência em `data/db.json`.

## Requisitos
- Node.js 18 ou superior.
- Internet para carregar as fontes do Google Fonts (o site funciona sem elas, usando fontes alternativas).

## Executar no Windows
1. Extraia a pasta do ZIP.
2. Abra a pasta no VS Code.
3. Instale Node.js caso ainda não tenha: https://nodejs.org/
4. No terminal do VS Code, execute `node server.mjs`.
5. Acesse `http://localhost:4173`.
6. Painel: `http://localhost:4173/admin.html`.

## Acesso inicial ao painel
- E-mail: `admin@convite.local`
- Senha: `AnaJulia19!Troque`

**Altere a senha antes de publicar na internet.** No PowerShell, pode iniciar assim:
`$env:ADMIN_EMAIL="seuemail@exemplo.com"; $env:ADMIN_PASSWORD="uma-senha-forte"; node server.mjs`

## Configurar convite
No painel administrativo, atualize data/hora, endereço, link do mapa e e-mail. Para música, informe uma URL direta para arquivo de áudio (por exemplo, `.mp3`) hospedado num serviço que permita acesso público direto. Navegadores exigem um clique do visitante antes de tocar áudio; o botão de música permite pausar/retomar.

## Funcionamento
**Fluxo do convidado:** confirmar presença → lista de presentes → escolher presente.
- O convidado informa nome, se irá comparecer e o **total de pessoas** (incluindo ele). Se marcar "Não", a quantidade não é pedida.
- Ao confirmar, o servidor gera um código pessoal (guardado no navegador do convidado). É ele que identifica o convidado na escolha do presente — o nome não é pedido de novo, e continua valendo ao recarregar a página.
- Cada nome só pode confirmar uma vez (a comparação ignora maiúsculas, acentos e espaços extras) e cada convidado só pode escolher **um** presente.
- Cada presente pode ser escolhido por **uma** pessoa. A verificação e a gravação acontecem de forma indivisível no servidor (`tx()` em `server.mjs`), então duas pessoas clicando ao mesmo tempo nunca ficam com o mesmo item: a segunda recebe um aviso e a lista é atualizada. A lista também se atualiza sozinha a cada 15 s.
- Convidados que não vão comparecer podem ver a lista, mas não escolhem presente.

**Painel administrativo**
- Cadastrar, editar, ocultar e excluir presentes (nome, descrição opcional, foto por upload ou link, e link de compra opcional). Só o nome é obrigatório.
- O link de compra é validado (apenas http/https; se faltar o `https://`, ele é acrescentado) e aparece para os convidados como botão **Onde comprar?**, que abre em nova aba. Presentes já escolhidos continuam mostrando foto, nome e link, com o selo **Já escolhido**.
- Editar um presente nunca altera a escolha já feita nem quem o escolheu.
- Ver quem escolheu cada presente e **liberar** um presente já escolhido (ele volta a ficar disponível e o convidado pode escolher outro).
- Excluir um presente escolhido exige liberá-lo antes. Excluir uma confirmação libera o presente daquele convidado.
- Ver confirmações, total de pessoas confirmadas, exportar CSV.
- **Copiar link** (na tabela de confirmações): link pessoal para um convidado recuperar o acesso caso troque de aparelho ou limpe o navegador.
- Sessão do painel expira em 12 h e há limite de tentativas de login.

**Dados:** tudo fica em `data/db.json`; imagens enviadas ficam em `data/uploads/`. Faça backup das duas coisas.

**Atualizando de uma versão anterior (roleta):** ao iniciar, o servidor converte o `db.json` antigo automaticamente (guarda uma cópia em `db.json.backup-pre-v2`). Reservas antigas viram "presente escolhido"; "acompanhantes" viram "pessoas" (acompanhantes + 1). Convidados antigos que ainda não têm código pessoal podem confirmar de novo uma única vez com o mesmo nome para "assumir" o cadastro (a escolha de presente feita antes é mantida).

## Estrutura
- `server.mjs`: servidor e API.
- `public/index.html`: convite.
- `public/admin.html`: painel.
- `public/css/style.css`: visual responsivo.
- `public/js/app.js`: música, contagem, confirmação e lista de presentes.
- `public/js/admin.js`: painel administrativo.
- `data/db.json` e `data/uploads/`: criados automaticamente no primeiro início.
