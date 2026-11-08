# Convite digital — Ana Júlia (projeto completo)

Projeto independente em Node.js, sem dependências externas. Inclui página responsiva, confirmação de presença (com total de pessoas), lista de presentes informativa, informações da aniversariante, painel administrativo, exportação CSV e persistência em `data/db.json`.

## Requisitos
- Node.js 18 ou superior.
- Internet para carregar as fontes do Google Fonts (o site funciona sem elas, usando fontes alternativas).

## Executar
1. Extraia a pasta do ZIP e abra no terminal.
2. Execute `node server.mjs` e acesse `http://localhost:4173`.
3. Painel: `http://localhost:4173/admin.html`.

## Acesso ao painel
- E-mail: `admin@convite.local`
- Senha: `AnaJulia19!Troque`

**Altere a senha antes de publicar.** Exemplo (PowerShell): `$env:ADMIN_EMAIL="seuemail@exemplo.com"; $env:ADMIN_PASSWORD="uma-senha-forte"; node server.mjs`

## Funcionamento
**Convidado**
- Informa nome, se irá e o **total de pessoas** (incluindo ele). Uma pessoa por família confirma: isso vale **1 confirmação** e soma o total de pessoas informado.
- Cada nome só confirma uma vez (ignora maiúsculas, acentos e espaços extras). O servidor gera um código pessoal guardado no navegador, que mantém a confirmação ao recarregar a página.
- **Lista de presentes:** apenas informativa (foto, nome e descrição). Não há escolha, reserva nem status.
- Antes da lista há o card com a sugestão de PIX; depois dela, a seção "Um pouquinho sobre a Ana Júlia" (campos vazios não aparecem).

**Painel**
- Indicadores: total de confirmações e pessoas confirmadas (soma das pessoas de cada confirmação).
- Confirmações: busca, filtro, **editar**, excluir, copiar link pessoal e exportar CSV (inclui a quantidade de pessoas).
- Presentes: cadastrar, editar (nome, descrição, foto por upload ou link), trocar foto, **reordenar (↑ ↓)**, ocultar/mostrar e excluir. Mudanças aparecem na lista pública automaticamente.
- **Informações da aniversariante:** nome, tamanho de roupa e número do calçado (os dois últimos opcionais).
- Configurações do convite: data, endereço, mapa, música etc. Sessão expira em 12 h; há limite de tentativas de login.

**Dados:** tudo fica em `data/db.json`; imagens em `data/uploads/`. Faça backup das duas coisas.

## Atualizando de versões anteriores
Ao iniciar, o servidor detecta bancos antigos, cria `data/db.json.backup-pre-v4-<data>` e converte (schema 4). Nada de confirmações é apagado (nomes, pessoas, mensagens e códigos pessoais são mantidos). Os campos de escolha/reserva de presentes e de link de compra são descartados; as informações da aniversariante são criadas com o nome "Ana Júlia" e tamanho/calçado em branco — preencha no painel. Registros sem quantidade de pessoas contam como 1.

## Estrutura
- `server.mjs`: servidor e API.
- `public/index.html`, `public/admin.html`: convite e painel.
- `public/css/style.css`: visual responsivo (regras de celular no final do arquivo).
- `public/js/app.js`, `public/js/admin.js`: lógica do convite e do painel.
