// Servidorzinho do site de agendamento (sem dependências).
//   npm start        -> abre em http://localhost:3000 (agendamento) e /paciente/ (área do paciente)
//   npm run build    -> gera a pasta dist/ para hospedar como site estático
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 3000;
// Endereço no site -> arquivo em src/
const PAGINAS = {
  "/": "agendamento.html",
  "/paciente/": "paciente.html",
};
const DADOS = path.join(__dirname, "data", "agendamentos.json");

function montarHtml(arquivo, { servidor }) {
  const fonte = fs.readFileSync(path.join(__dirname, "src", arquivo), "utf8");
  const marca = "<!-- corpo -->";
  const i = fonte.indexOf(marca);
  const cabeca = i >= 0 ? fonte.slice(0, i) : "";
  const corpo = i >= 0 ? fonte.slice(i + marca.length) : fonte;
  return [
    "<!doctype html>",
    '<html lang="pt-BR">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    servidor ? "<script>window.__NUTRI_SERVER__ = true;</script>" : "",
    cabeca.trim(),
    "</head>",
    "<body>",
    corpo.trim(),
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

function lerAgendamentos() {
  try {
    return JSON.parse(fs.readFileSync(DADOS, "utf8"));
  } catch {
    return [];
  }
}

function salvarAgendamento(item) {
  const lista = lerAgendamentos();
  const novo = { id: Date.now().toString(36), criadoEm: new Date().toISOString(), ...item };
  lista.push(novo);
  fs.mkdirSync(path.dirname(DADOS), { recursive: true });
  fs.writeFileSync(DADOS, JSON.stringify(lista, null, 2));
  return novo;
}

function json(res, status, corpo) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(corpo));
}

const CAMPOS = ["data", "hora", "modalidade", "tipo", "nome", "email", "celular", "nascimento", "objetivos", "obs"];

const servidor = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");

  let caminho = url.pathname.replace(/index\.html$/, "");
  if (!caminho.endsWith("/")) caminho += "/";
  if (req.method === "GET" && PAGINAS[caminho]) {
    if (url.pathname !== caminho && !url.pathname.endsWith("index.html")) {
      res.writeHead(301, { Location: caminho + url.search });
      return res.end();
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    return res.end(montarHtml(PAGINAS[caminho], { servidor: true }));
  }

  if (url.pathname === "/api/agendamentos" && req.method === "GET") {
    return json(res, 200, lerAgendamentos());
  }

  if (url.pathname === "/api/agendamentos" && req.method === "POST") {
    let bruto = "";
    req.on("data", (parte) => {
      bruto += parte;
      if (bruto.length > 20000) req.destroy();
    });
    req.on("end", () => {
      try {
        const entrada = JSON.parse(bruto);
        const item = {};
        for (const c of CAMPOS) if (entrada[c] !== undefined) item[c] = entrada[c];
        if (!item.nome || !item.data || !item.hora) return json(res, 400, { erro: "Faltam nome, data ou hora." });
        const novo = salvarAgendamento(item);
        console.log(`Novo pré-agendamento: ${novo.nome} em ${novo.data} às ${novo.hora}`);
        json(res, 201, novo);
      } catch {
        json(res, 400, { erro: "Dados inválidos." });
      }
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Página não encontrada");
});

if (process.argv[2] === "build") {
  for (const [caminho, arquivo] of Object.entries(PAGINAS)) {
    const destino = path.join(__dirname, "dist", caminho, "index.html");
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, montarHtml(arquivo, { servidor: false }));
    console.log("Gerado:", destino);
  }
} else {
  servidor.listen(PORT, () => console.log(`Site no ar em http://localhost:${PORT}`));
}
