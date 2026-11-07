# Planilha da área do paciente (Google Apps Script)

A planilha funciona como o "servidor" da área do paciente. Ela guarda os cadastros, as
fichas, os exames (numa pasta do Google Drive) e manda o e-mail com o link de acesso.

**Use a conta Google da Ana Carolina.** Os dados de saúde ficam no Drive dela, e o
e-mail com o link sai do Gmail dela (até 100 e-mails por dia numa conta Gmail comum).

## Ligar pela primeira vez

1. No Google Drive da Ana Carolina, crie uma planilha nova chamada **Pacientes · Nutri**.
2. Na planilha, abra **Extensões › Apps Script**.
3. Apague o que estiver lá, cole todo o conteúdo de `Codigo.gs` e clique em **Salvar**.
4. Não precisa trocar nada no código: o endereço da área do paciente (GitHub Pages) e a
   senha do painel já estão prontos. Se ela tiver um domínio próprio, troque
   `URL_AREA_PACIENTE`.
5. No editor, escolha a função **configurar** e clique em **Executar**. O Google pede
   autorização (Planilhas, Drive e Gmail): aceite com a conta da Ana Carolina.
   Isso cria as abas e a pasta **Pacientes · Nutri Ana Carolina** no Drive.
6. Clique em **Implantar › Nova implantação**, tipo **App da Web**:
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
7. Copie o link que termina em `/exec` e cole em `CONFIG.api`, no começo do script de
   `src/paciente.html` e de `src/admin.html`. Depois rode `npm run build` e suba no GitHub.

Toda vez que mudar o código, use **Implantar › Gerenciar implantações › Editar › Nova
versão**. Assim o link `/exec` continua o mesmo.

## Consultas na Google Agenda e link do Google Meet

Cada consulta marcada no painel vira um evento na Google Agenda da Ana Carolina, com
lembrete 1 hora antes. A consulta online ganha um link do Google Meet, que vai no e-mail,
nas mensagens de WhatsApp do painel e no botão "Entrar na consulta" da área do paciente.
O paciente também recebe o convite do Google Agenda por e-mail.

Para funcionar, ative o serviço da agenda uma vez:

1. No Apps Script, na coluna da esquerda, ao lado de **Serviços**, clique no **+**.
2. Escolha **Google Calendar API** e clique em **Adicionar**.
3. Rode a função **configurar** de novo e aceite a autorização da agenda.
4. Implante uma nova versão (**Implantar › Gerenciar implantações › lápis › Nova versão**).

Se trocar a consulta de dia, horário ou de presencial para online, o evento antigo é
cancelado (o paciente recebe o aviso) e um novo é criado. Consultas que já passaram ficam
na agenda como histórico. Para não mandar convite ao paciente, troque
`CONVIDAR_PACIENTE` para `false`.

## Testar o e-mail

No editor, rode a função **testarCadastro**. Ela cadastra um "Paciente Teste" com o seu
próprio e-mail e manda o e-mail de acesso. Depois apague a linha de teste na aba
Pacientes.

## Abas da planilha

| Aba | O que tem |
|---|---|
| Pacientes | Um paciente por linha: cadastro, contato, objetivo, status, quem cadastrou, pasta no Drive, data da autorização (LGPD), último acesso, a próxima consulta, o tipo de atendimento, o evento na agenda e o link do Meet (presencial aos sábados, das 9h às 17h; online às segundas e quintas, das 17h às 21h). A agenda fica em `AGENDA`, no começo do código. **A coluna Token é o link pessoal: não compartilhe.** |
| Fichas | Cada ficha e cada "como estou" com todas as respostas, para reabrir no site. |
| Respostas | As mesmas respostas, uma por linha, fáceis de ler. |
| Exames | Os exames enviados, com link para o arquivo no Drive. |
| Documentos | Planos e orientações publicados para o paciente. |

## Mandar o plano alimentar

O jeito normal é pelo painel: abra o paciente e use "Enviar para a paciente".

Também dá pelo Drive: coloque o PDF na pasta do paciente › **Da nutricionista** (o nome
do arquivo vira o título) e use o menu da planilha **Nutri › Publicar documentos das pastas**.

## Painel da equipe

- A senha é a mesma para a Ana Carolina e para a recepção. Ao entrar, o painel pergunta
  quem está usando.
- No código fica só a senha embaralhada (`SENHA_ADMIN_HASH`), porque o repositório é
  público. Para trocar a senha, use a função `gerarHashDaSenha` (instruções no código).
- A recepção cadastra e vê os dados do cadastro. Ficha, exames, evolução, documentos e
  anotações ficam só com a nutricionista (`RECEPCAO_VE_SAUDE = false`).
- Depois de 10 senhas erradas em 10 minutos, o painel bloqueia por 10 minutos.
- **Nunca escreva a senha de verdade no código do GitHub.**

## Segurança

- O link de cada paciente é pessoal. Para entrar, a pessoa ainda confirma o e-mail e o
  celular do cadastro.
- Depois de 8 tentativas erradas em 10 minutos, o acesso fica bloqueado por 10 minutos.
- A sessão dura 6 horas. Depois disso, a pessoa entra de novo pelo link do e-mail.
- Os arquivos ficam no Drive da Ana Carolina, sem compartilhamento. Não deixe a pasta
  "Pacientes · Nutri Ana Carolina" pública.
