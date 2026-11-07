# Sites da nutricionista Ana Carolina Pereira

Ana Carolina dos Santos Pereira · Nutricionista · CRN-4 23101599
Av. Nossa Senhora de Copacabana, 540, sala 1105 · Copacabana, Rio de Janeiro – RJ

## Links

| Site | Endereço | Para quem |
|---|---|---|
| Agendamento | Guardado, fora do ar (ver abaixo) | Quem quer marcar consulta. Termina no WhatsApp. |
| Área do paciente | https://carolnutr.github.io/Site-nutri/paciente/ | Pacientes cadastrados na recepção (o link pessoal chega por e-mail). |
| Painel da equipe | https://carolnutr.github.io/Site-nutri/admin/ | Ana Carolina e recepção. |
| Política de privacidade | https://carolnutr.github.io/Site-nutri/privacidade/ | Pacientes (link no rodapé e na autorização da área do paciente). |

Enquanto a planilha não estiver ligada (`CONFIG.api` vazio), a área do paciente e o
painel abrem em modo prévia, com pacientes de exemplo, e nada é salvo.

O endereço principal (https://carolnutr.github.io/Site-nutri/) leva à área do paciente.

### Site de agendamento guardado

O código continua em `src/agendamento.html`, mas não vai para o site publicado. Para
colocar no ar de novo, troque `PUBLICAR_AGENDAMENTO` para `true` no começo de `server.js`
e rode `npm run build`. Ele volta no endereço principal.

## Como funciona

1. A pessoa marca pelo site de agendamento e confirma pelo WhatsApp.
2. Na recepção, cadastram nome, e-mail, celular e data de nascimento no painel.
3. Na hora, a pessoa recebe um e-mail com o link pessoal da área do paciente.
4. Ela entra confirmando e-mail e celular, responde a ficha de saúde e envia os exames.
5. A Ana Carolina vê tudo no painel, define o objetivo e a situação, e envia o plano
   alimentar e as orientações, que aparecem na área do paciente.
6. Tudo fica na planilha do Google e no Drive da Ana Carolina (`apps-script/`).

No painel, a recepção vê só os dados do cadastro. Ficha, exames, evolução e anotações
ficam só com a nutricionista (dá para mudar em `RECEPCAO_VE_SAUDE`, no código da planilha).

## Segurança

Toda página gerada em `docs/` sai com estas proteções (montadas em `server.js`):

- **Regra de segurança (CSP):** a página só roda os próprios códigos, conferidos um a um,
  e só conversa com a planilha (Apps Script) e com as fontes do Google.
- **Link pessoal protegido:** o endereço com o link do paciente não é repassado a outros sites.
- **Contra moldura:** o site fica escondido se alguém tentar abrir ele dentro de outro site.

Contato de privacidade (LGPD): nutricarol19@gmail.com e WhatsApp (21) 96693-7967.

## Pastas

- `src/`: as páginas (é aqui que se mexe).
  - `agendamento.html`, `paciente.html`, `admin.html`, `privacidade.html`
- `docs/`: o site pronto, gerado a partir de `src/`. O GitHub Pages publica esta pasta.
- `apps-script/`: código da planilha e o passo a passo para ligar (`LEIA-ME.md`).
- `server.js`: servidor para testar no computador e gerar a pasta `docs/`.

## Onde mexer

- Dados da nutricionista, WhatsApp e horários: objeto `CONFIG` no começo do `<script>` de cada página.
- Perguntas da ficha: lista `SECOES` em `src/paciente.html`.
- Link da planilha: `CONFIG.api` em `src/paciente.html` e `src/admin.html`.

Depois de mexer em `src/`, gere o site de novo e suba:

```bash
npm run build
```

## Testar no computador

```bash
npm start
```

- Agendamento: http://localhost:3000
- Área do paciente: http://localhost:3000/paciente/
- Painel: http://localhost:3000/admin/
