# Sites da nutricionista Ana Carolina Pereira

São três sites com a mesma cara (verde musgo, fundo branco):

| Site | Arquivo | Para quem | Situação |
|---|---|---|---|
| Agendamento | `src/agendamento.html` | Quem quer marcar consulta. Termina no WhatsApp. | Prévia aprovada em partes |
| Área do paciente | `src/paciente.html` | Pacientes já cadastrados na recepção. Ficha de saúde, exames, plano alimentar e acompanhamento. | Prévia, perguntas de exemplo |
| Painel das administradoras | (próxima etapa) | Recepção e nutricionista. Cadastro de pacientes e acesso a tudo de cada um. | A fazer |

Prévias para mostrar:
- Agendamento: https://claude.ai/artifact/DoySCW9ouY7vRERUYRLmr3
- Área do paciente: https://claude.ai/artifact/HuTBMtEwN7ETgTkmDCP7kd

## Como funciona

1. A pessoa marca pelo site de agendamento e confirma pelo WhatsApp.
2. Na recepção, uma administradora cadastra nome, e-mail e celular no painel.
3. Na hora, a pessoa recebe um e-mail com o link pessoal da área do paciente.
4. Ela entra confirmando o e-mail e o celular, responde a ficha e envia os exames.
5. Tudo fica na planilha do Google e no Drive da Ana Carolina (`apps-script/`).

## Rodar no computador

```bash
npm start
```

- Agendamento: http://localhost:3000
- Área do paciente: http://localhost:3000/paciente/

Sem o link da planilha (`CONFIG.api` vazio), a área do paciente abre com uma paciente de
exemplo e nada é enviado.

## Onde mexer

- Dados da nutricionista, WhatsApp e horários: objeto `CONFIG` no começo do `<script>` de cada página.
- Perguntas da ficha: lista `SECOES` em `src/paciente.html`. Tipos: `texto`, `texto-longo`, `numero`, `escolha`, `multi`, `escala`.
- Planilha e e-mail: `apps-script/Codigo.gs` e `apps-script/LEIA-ME.md`.

## Publicar como site estático

```bash
npm run build
```

Gera a pasta `dist/` (agendamento na raiz e área do paciente em `paciente/`), que pode ir
para o GitHub Pages ou qualquer hospedagem estática.
