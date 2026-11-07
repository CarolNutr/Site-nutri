# Planilha da área do paciente (Google Apps Script)

A planilha funciona como o "servidor" da área do paciente. Ela guarda os cadastros, as
fichas, os exames (numa pasta do Google Drive) e manda o e-mail com o link de acesso.

**Use a conta Google da Ana Carolina.** Os dados de saúde ficam no Drive dela, e o
e-mail com o link sai do Gmail dela (até 100 e-mails por dia numa conta Gmail comum).

## Ligar pela primeira vez

1. No Google Drive da Ana Carolina, crie uma planilha nova chamada **Pacientes · Nutri**.
2. Na planilha, abra **Extensões › Apps Script**.
3. Apague o que estiver lá, cole todo o conteúdo de `Codigo.gs` e clique em **Salvar**.
4. No começo do código, troque:
   - `URL_AREA_PACIENTE`: o endereço da área do paciente, quando o site estiver no ar.
   - `SENHAS_ADMIN`: uma senha para cada administradora. As senhas de exemplo não funcionam.
5. No editor, escolha a função **configurar** e clique em **Executar**. O Google pede
   autorização (Planilhas, Drive e Gmail): aceite com a conta da Ana Carolina.
   Isso cria as abas e a pasta **Pacientes · Nutri Ana Carolina** no Drive.
6. Clique em **Implantar › Nova implantação**, tipo **App da Web**:
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
7. Copie o link que termina em `/exec` e cole em `CONFIG.api`, no começo do script de
   `src/paciente.html` (e, depois, no painel das administradoras).

Toda vez que mudar o código, use **Implantar › Gerenciar implantações › Editar › Nova
versão**. Assim o link `/exec` continua o mesmo.

## Testar o e-mail

No editor, rode a função **testarCadastro**. Ela cadastra um "Paciente Teste" com o seu
próprio e-mail e manda o e-mail de acesso. Depois apague a linha de teste na aba
Pacientes.

## Abas da planilha

| Aba | O que tem |
|---|---|
| Pacientes | Um paciente por linha: cadastro, contato, objetivo, status, quem cadastrou, pasta no Drive, data da autorização (LGPD) e último acesso. **A coluna Token é o link pessoal: não compartilhe.** |
| Fichas | Cada ficha e cada "como estou" com todas as respostas, para reabrir no site. |
| Respostas | As mesmas respostas, uma por linha, fáceis de ler. |
| Exames | Os exames enviados, com link para o arquivo no Drive. |
| Documentos | Planos e orientações publicados para o paciente. |

## Mandar o plano alimentar (até o painel ficar pronto)

1. No Drive, abra a pasta do paciente › **Da nutricionista** e coloque o PDF. O nome do
   arquivo vira o título (ex.: "Plano alimentar - novembro.pdf").
2. Na planilha, use o menu **Nutri › Publicar documentos das pastas**.
3. O documento aparece na área do paciente, em "Da nutricionista".

## Segurança

- O link de cada paciente é pessoal. Para entrar, a pessoa ainda confirma o e-mail e o
  celular do cadastro.
- Depois de 8 tentativas erradas em 10 minutos, o acesso fica bloqueado por 10 minutos.
- A sessão dura 6 horas. Depois disso, a pessoa entra de novo pelo link do e-mail.
- Os arquivos ficam no Drive da Ana Carolina, sem compartilhamento. Não deixe a pasta
  "Pacientes · Nutri Ana Carolina" pública.
