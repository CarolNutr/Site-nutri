# Agenda Nutri

Site de agendamento da nutricionista Ana Carolina dos Santos Pereira.

## Rodar

```bash
npm start
```

Abre em http://localhost:3000. Os pré-agendamentos ficam em `data/agendamentos.json`
(e em `GET /api/agendamentos`).

## Onde mexer

- `src/pagina.html`: a página inteira. Os dados da nutricionista (nome, CRN, endereço,
  WhatsApp, horários de atendimento) ficam no objeto `CONFIG` no começo do `<script>`.
- `mostrarPrevia: false` tira a barrinha de "Prévia" quando o site for ao ar.

## Publicar como site estático

```bash
npm run build
```

Gera `dist/index.html`, que pode ir para qualquer hospedagem estática.
