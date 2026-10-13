# Convite digital — Ana Júlia (projeto completo)

Projeto independente em Node.js, sem dependências externas. Inclui página responsiva, confirmação de presença, roleta de ideias de presente, reserva de presente, painel administrativo, exportação CSV e persistência em `data/db.json`.

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
- Confirmações e reservas são guardadas em `data/db.json`.
- A roleta só mostra presentes ativos que ainda tenham quantidade disponível.
- A reserva exige que o nome corresponda a uma confirmação de presença feita anteriormente.
- Quantidade `0` para um presente significa ilimitada.
- Painel permite ver/excluir respostas, gerenciar presentes, ajustar configurações e exportar CSV.
- Faça backup de `data/db.json` regularmente.
- O servidor é uma base funcional para evento pequeno. Para uso público em escala, use HTTPS, senha forte via variáveis de ambiente e hospedagem Node com armazenamento persistente; não publique em hospedagem apenas estática.

## Estrutura
- `server.mjs`: servidor e API.
- `public/index.html`: convite.
- `public/admin.html`: painel.
- `public/css/style.css`: visual responsivo.
- `public/js/app.js`: música, confirmação, contagem e roleta.
- `public/js/admin.js`: painel administrativo.
- `data/db.json`: criado automaticamente no primeiro início.
