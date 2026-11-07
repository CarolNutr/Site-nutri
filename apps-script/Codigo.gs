/**
 * Área do paciente · Nutricionista Ana Carolina Pereira
 *
 * Código da planilha (Google Apps Script). Faz o papel de "servidor":
 *  - a recepção cadastra o paciente (painel das administradoras) e ele recebe
 *    por e-mail o link pessoal da área do paciente;
 *  - o paciente entra confirmando e-mail e celular;
 *  - a ficha de saúde, o "como estou" e os exames ficam nesta planilha e numa
 *    pasta do Google Drive de cada paciente.
 *
 * Passo a passo para ligar: veja apps-script/LEIA-ME.md.
 */

// ===================== Ajuste aqui =====================
// Endereço da área do paciente (o link que vai no e-mail).
const URL_AREA_PACIENTE = "https://SEU-SITE/paciente/";
// Uma senha para cada administradora. O nome aparece na coluna "Cadastrado por".
const SENHAS_ADMIN = {
  "Ana Carolina": "TROQUE-ESTA-SENHA-1",
  "Recepção": "TROQUE-ESTA-SENHA-2"
};
const NOME_REMETENTE = "Ana Carolina Pereira · Nutricionista";
const NOME_PASTA = "Pacientes · Nutri Ana Carolina";
const MAX_ARQUIVO_MB = 10;
// =======================================================

const VERSAO = 1;
const HORAS_SESSAO = 6;
const ABAS = {
  Pacientes: ["ID", "Cadastro", "Nome", "E-mail", "Celular", "Nascimento", "Objetivo", "Status", "Cadastrado por", "Token", "Pasta", "Consentimento em", "Último acesso"],
  Fichas: ["Data", "Paciente", "Tipo", "Valores (JSON)"],
  Respostas: ["Data", "Paciente", "Nome", "Tipo", "Seção", "Pergunta", "Resposta"],
  Exames: ["Data", "Paciente", "Nome", "Arquivo", "Descrição", "Link", "ID no Drive"],
  Documentos: ["ID", "Data", "Paciente", "Título", "Tipo", "Link", "ID no Drive"]
};
// Posição das colunas da aba Pacientes (começando em 0)
const P = { id: 0, cadastro: 1, nome: 2, email: 3, celular: 4, nascimento: 5, objetivo: 6, status: 7, por: 8, token: 9, pasta: 10, consentimento: 11, acesso: 12 };
const TIPOS_OK = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

// ---------------------------------------------------------------- Entrada

function doGet() {
  return saida({ ok: true, app: "nutri-area-paciente", versao: VERSAO });
}

function doPost(e) {
  let c;
  try { c = JSON.parse(e.postData.contents); } catch (err) { return saida({ ok: false, erro: "dados_invalidos" }); }
  try {
    switch (c.acao) {
      // Paciente
      case "entrar": return saida(entrar(c));
      case "reenviarLink": return saida(reenviarLink(c));
      case "portal": return saida(portal(c));
      case "ficha": return saida(salvarRespostas(c, "Ficha"));
      case "checkin": return saida(salvarRespostas(c, "Como estou"));
      case "arquivo": return saida(salvarExame(c));
      case "documento": return saida(baixarDocumento(c));
      // Administradoras
      case "cadastrar": return saida(cadastrar(c));
      default: return saida({ ok: false, erro: "acao_desconhecida" });
    }
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    return saida({ ok: false, erro: "falha_interna" });
  }
}

function saida(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------- Administradoras

function adminPelaSenha(senha) {
  for (const nome in SENHAS_ADMIN) {
    if (SENHAS_ADMIN[nome].indexOf("TROQUE-ESTA-SENHA") === 0) continue; // senha de exemplo não vale
    if (String(senha || "") === SENHAS_ADMIN[nome]) return nome;
  }
  return null;
}

/** Cadastro feito pela recepção. Cria o paciente, a pasta no Drive e manda o e-mail com o link. */
function cadastrar(c) {
  const admin = adminPelaSenha(c.senha);
  if (!admin) return { ok: false, erro: "senha_invalida" };
  const nome = texto(c.nome, 120);
  const email = texto(c.email, 120).toLowerCase();
  const celular = celularNormal(c.celular);
  if (nome.split(" ").length < 2 || !emailValido(email) || celular.length < 10) return { ok: false, erro: "dados_invalidos" };

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (acharPaciente(function (l) { return String(l[P.email]).toLowerCase() === email; })) return { ok: false, erro: "email_ja_cadastrado" };
    const id = novoId("P");
    const token = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
    const pasta = criarPastaPaciente(nome, id);
    const linha = [];
    linha[P.id] = id;
    linha[P.cadastro] = new Date();
    linha[P.nome] = seguro(nome);
    linha[P.email] = seguro(email);
    linha[P.celular] = "'" + formatarCelular(celular);
    linha[P.nascimento] = c.nascimento && dataValida(c.nascimento) ? "'" + dataBR(c.nascimento) : "";
    linha[P.objetivo] = seguro(texto(c.objetivo, 120));
    linha[P.status] = "Novo";
    linha[P.por] = admin;
    linha[P.token] = token;
    linha[P.pasta] = pasta.getUrl();
    linha[P.consentimento] = "";
    linha[P.acesso] = "";
    aba("Pacientes").appendRow(linha);
    enviarEmailDeAcesso(nome, email, token);
    return { ok: true, id: id };
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------- Acesso do paciente

function entrar(c) {
  const token = texto(c.token, 80);
  if (!token) return { ok: false, erro: "link_invalido" };
  if (!tentativaPermitida("entrar_" + token, 8)) return { ok: false, erro: "muitas_tentativas" };
  const p = acharPaciente(function (l) { return l[P.token] === token; });
  if (!p) return { ok: false, erro: "link_invalido" };
  const v = p.valores;
  const emailOk = String(v[P.email]).toLowerCase() === texto(c.email, 120).toLowerCase();
  const celOk = celularNormal(v[P.celular]) === celularNormal(c.celular);
  if (!emailOk || !celOk) return { ok: false, erro: "nao_confere" };

  const sh = aba("Pacientes");
  const agora = new Date();
  sh.getRange(p.linha, P.acesso + 1).setValue(agora);
  if (c.consentimento && !v[P.consentimento]) sh.getRange(p.linha, P.consentimento + 1).setValue(agora);

  const sessao = Utilities.getUuid();
  CacheService.getScriptCache().put("sessao_" + sessao, v[P.id], HORAS_SESSAO * 3600);
  return { ok: true, sessao: sessao, nome: String(v[P.nome]) };
}

/** "Não achou o e-mail?" Sempre responde ok, para não revelar quem é paciente. */
function reenviarLink(c) {
  const email = texto(c.email, 120).toLowerCase();
  if (!emailValido(email) || !tentativaPermitida("reenviar_" + email, 3)) return { ok: true };
  const p = acharPaciente(function (l) { return String(l[P.email]).toLowerCase() === email; });
  if (p) enviarEmailDeAcesso(String(p.valores[P.nome]), email, p.valores[P.token]);
  return { ok: true };
}

function pacienteDaSessao(c) {
  const id = CacheService.getScriptCache().get("sessao_" + texto(c.sessao, 60));
  if (!id) return null;
  return acharPaciente(function (l) { return l[P.id] === id; });
}

// ---------------------------------------------------------------- Dados da área do paciente

function portal(c) {
  const p = pacienteDaSessao(c);
  if (!p) return { ok: false, erro: "sessao_expirada" };
  const id = p.valores[P.id];
  const fichas = linhasDoPaciente("Fichas", 1, id);
  const ultimaFicha = fichas.filter(function (l) { return l[2] === "Ficha"; }).pop();
  return {
    ok: true,
    paciente: { nome: String(p.valores[P.nome]), objetivo: String(p.valores[P.objetivo] || ""), cadastro: dataISO(p.valores[P.cadastro]) },
    ficha: ultimaFicha ? { data: dataISO(ultimaFicha[0]), valores: lerJSON(ultimaFicha[3]) } : null,
    checkins: fichas.filter(function (l) { return l[2] === "Como estou"; }).map(function (l) { return { data: dataISO(l[0]), valores: lerJSON(l[3]) }; }),
    exames: linhasDoPaciente("Exames", 1, id).map(function (l) { return { data: dataISO(l[0]), nome: String(l[3]), descricao: String(l[4] || "") }; }),
    documentos: linhasDoPaciente("Documentos", 2, id).map(function (l) { return { id: String(l[0]), data: dataISO(l[1]), titulo: String(l[3]), tipo: String(l[4] || "") }; })
  };
}

/** Ficha de saúde ou "Como estou": guarda os valores (para reabrir) e as respostas legíveis. */
function salvarRespostas(c, tipo) {
  const p = pacienteDaSessao(c);
  if (!p) return { ok: false, erro: "sessao_expirada" };
  const valores = c.valores && typeof c.valores === "object" ? c.valores : {};
  const json = JSON.stringify(valores);
  if (json.length > 40000) return { ok: false, erro: "dados_invalidos" };
  const respostas = Array.isArray(c.respostas) ? c.respostas.slice(0, 150) : [];
  const id = p.valores[P.id], nome = p.valores[P.nome], agora = new Date();

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    aba("Fichas").appendRow([agora, id, tipo, json]);
    const linhas = respostas.map(function (r) {
      return [agora, id, nome, tipo, seguro(texto(r.secao, 80)), seguro(texto(r.pergunta, 300)), seguro(textoLongo(r.resposta, 3000))];
    }).filter(function (l) { return l[6] !== ""; });
    if (linhas.length) {
      const sh = aba("Respostas");
      sh.getRange(sh.getLastRow() + 1, 1, linhas.length, linhas[0].length).setValues(linhas);
    }
    if (tipo === "Ficha" && p.valores[P.status] === "Novo") aba("Pacientes").getRange(p.linha, P.status + 1).setValue("Ficha respondida");
  } finally {
    lock.releaseLock();
  }
  return { ok: true, data: dataISO(agora) };
}

function salvarExame(c) {
  const p = pacienteDaSessao(c);
  if (!p) return { ok: false, erro: "sessao_expirada" };
  const tipo = String(c.tipo || "").toLowerCase();
  if (TIPOS_OK.indexOf(tipo) < 0) return { ok: false, erro: "tipo_invalido" };
  let bytes;
  try { bytes = Utilities.base64Decode(String(c.base64 || "")); } catch (err) { return { ok: false, erro: "dados_invalidos" }; }
  if (!bytes.length) return { ok: false, erro: "dados_invalidos" };
  if (bytes.length > MAX_ARQUIVO_MB * 1024 * 1024) return { ok: false, erro: "arquivo_grande" };
  if (tipo === "application/pdf" && String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) !== "%PDF") return { ok: false, erro: "tipo_invalido" };
  if (!tentativaPermitida("upload_" + p.valores[P.id], 40)) return { ok: false, erro: "muitas_tentativas" };

  const nomeArq = texto(c.nome, 120).replace(/[\\/:*?"<>|]/g, "_") || "exame";
  const descricao = texto(c.descricao, 200);
  const agora = new Date();
  const pasta = subpasta(p, "Exames");
  const arquivo = pasta.createFile(Utilities.newBlob(bytes, tipo, Utilities.formatDate(agora, fuso(), "yyyy-MM-dd") + " - " + nomeArq));
  if (descricao) arquivo.setDescription(descricao);
  aba("Exames").appendRow([agora, p.valores[P.id], p.valores[P.nome], seguro(nomeArq), seguro(descricao), arquivo.getUrl(), arquivo.getId()]);
  return { ok: true, exame: { data: dataISO(agora), nome: nomeArq, descricao: descricao } };
}

/** O paciente baixa um documento que a nutricionista publicou para ele. */
function baixarDocumento(c) {
  const p = pacienteDaSessao(c);
  if (!p) return { ok: false, erro: "sessao_expirada" };
  const doc = linhasDoPaciente("Documentos", 2, p.valores[P.id]).filter(function (l) { return String(l[0]) === texto(c.id, 40); })[0];
  if (!doc) return { ok: false, erro: "dados_invalidos" };
  const blob = DriveApp.getFileById(doc[6]).getBlob();
  if (blob.getBytes().length > 20 * 1024 * 1024) return { ok: false, erro: "arquivo_grande" };
  return { ok: true, nome: blob.getName(), tipo: blob.getContentType(), base64: Utilities.base64Encode(blob.getBytes()) };
}

// ---------------------------------------------------------------- Menu da planilha

function onOpen() {
  SpreadsheetApp.getUi().createMenu("Nutri")
    .addItem("Publicar documentos das pastas", "publicarDocumentos")
    .addItem("Preparar planilha (primeira vez)", "configurar")
    .addToUi();
}

/** Cria as abas e a pasta no Drive, e pede as autorizações. Rode uma vez. */
function configurar() {
  Object.keys(ABAS).forEach(aba);
  pastaRaiz();
  MailApp.getRemainingDailyQuota();
}

/**
 * Enquanto o painel das administradoras não fica pronto: coloque o PDF (plano alimentar,
 * orientações...) na subpasta "Da nutricionista" do paciente e use o menu Nutri >
 * Publicar documentos. Ele aparece na área do paciente.
 */
function publicarDocumentos() {
  const sh = aba("Pacientes");
  const n = sh.getLastRow();
  if (n < 2) return;
  const pacientes = sh.getRange(2, 1, n - 1, ABAS.Pacientes.length).getValues();
  const shDocs = aba("Documentos");
  const ja = {};
  if (shDocs.getLastRow() > 1) shDocs.getRange(2, 7, shDocs.getLastRow() - 1, 1).getValues().forEach(function (l) { ja[l[0]] = true; });
  let novos = 0;
  pacientes.forEach(function (v, i) {
    const pasta = subpasta({ valores: v, linha: i + 2 }, "Da nutricionista");
    const arquivos = pasta.getFiles();
    while (arquivos.hasNext()) {
      const f = arquivos.next();
      if (ja[f.getId()]) continue;
      const titulo = f.getName().replace(/\.[^.]+$/, "");
      shDocs.appendRow([novoId("D"), new Date(), v[P.id], seguro(titulo), tipoDoTitulo(titulo), f.getUrl(), f.getId()]);
      novos++;
    }
  });
  try { SpreadsheetApp.getActive().toast(novos ? novos + " documento(s) publicado(s)." : "Nenhum documento novo.", "Nutri"); } catch (e) {}
}

function tipoDoTitulo(t) {
  t = t.toLowerCase();
  if (t.indexOf("plano") >= 0) return "Plano alimentar";
  if (t.indexOf("receita") >= 0) return "Receitas";
  if (t.indexOf("compra") >= 0) return "Lista de compras";
  if (t.indexOf("exame") >= 0 || t.indexOf("pedido") >= 0) return "Pedido de exame";
  return "Orientações";
}

/** Para testar o e-mail pelo editor: troque os dados e rode esta função. */
function testarCadastro() {
  const senha = Object.keys(SENHAS_ADMIN).map(function (k) { return SENHAS_ADMIN[k]; })[0];
  console.log(cadastrar({ senha: senha, nome: "Paciente Teste", email: Session.getActiveUser().getEmail(), celular: "21999999999", objetivo: "Emagrecimento" }));
}

// ---------------------------------------------------------------- E-mail

function enviarEmailDeAcesso(nome, email, token) {
  const primeiro = String(nome).split(" ")[0];
  const link = URL_AREA_PACIENTE + (URL_AREA_PACIENTE.indexOf("?") >= 0 ? "&" : "?") + "p=" + encodeURIComponent(token);
  const html =
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#2c2f26">' +
    '<div style="background:#5d6e35;color:#ffffff;padding:20px 24px;border-radius:12px 12px 0 0;font-size:20px;font-weight:bold">Ana Carolina Pereira · Nutricionista</div>' +
    '<div style="border:1px solid #e0e2d7;border-top:0;padding:24px;border-radius:0 0 12px 12px;line-height:1.6;font-size:16px">' +
    "<p>Olá, " + escHtml(primeiro) + "!</p>" +
    "<p>Seu cadastro foi feito. Pela sua área do paciente você responde a ficha de saúde, envia seus exames e recebe o plano alimentar e as orientações.</p>" +
    '<p style="text-align:center;margin:28px 0"><a href="' + link + '" style="background:#5d6e35;color:#ffffff;text-decoration:none;padding:14px 26px;border-radius:6px;font-weight:bold;display:inline-block">Acessar minha área</a></p>' +
    "<p>Para entrar, confirme o e-mail e o celular que você informou na recepção.</p>" +
    '<p style="color:#727667;font-size:14px">Este link é pessoal. Não encaminhe este e-mail para outras pessoas. Guarde-o para entrar outras vezes.</p>' +
    "</div></div>";
  const texto = "Olá, " + primeiro + "!\n\nSeu cadastro foi feito. Acesse sua área do paciente por este link pessoal:\n" + link +
    "\n\nPara entrar, confirme o e-mail e o celular que você informou na recepção.\nNão encaminhe este e-mail para outras pessoas.";
  MailApp.sendEmail({ to: email, subject: "Sua área do paciente · Ana Carolina Pereira", body: texto, htmlBody: html, name: NOME_REMETENTE });
}

// ---------------------------------------------------------------- Planilha e Drive

function aba(nome) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(nome);
  if (!sh) {
    sh = ss.insertSheet(nome);
    sh.appendRow(ABAS[nome]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, ABAS[nome].length).setFontWeight("bold");
  }
  return sh;
}

function acharPaciente(teste) {
  const sh = aba("Pacientes");
  const n = sh.getLastRow();
  if (n < 2) return null;
  const linhas = sh.getRange(2, 1, n - 1, ABAS.Pacientes.length).getValues();
  for (let i = 0; i < linhas.length; i++) if (teste(linhas[i])) return { linha: i + 2, valores: linhas[i] };
  return null;
}

function linhasDoPaciente(nomeAba, colunaPaciente, id) {
  const sh = aba(nomeAba);
  const n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, ABAS[nomeAba].length).getValues().filter(function (l) { return l[colunaPaciente] === id; });
}

function pastaRaiz() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty("PASTA_RAIZ");
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  const pasta = DriveApp.createFolder(NOME_PASTA);
  props.setProperty("PASTA_RAIZ", pasta.getId());
  return pasta;
}

function criarPastaPaciente(nome, id) {
  const pasta = pastaRaiz().createFolder(nome + " · " + id);
  pasta.createFolder("Exames");
  pasta.createFolder("Da nutricionista");
  return pasta;
}

/** Subpasta "Exames" ou "Da nutricionista" do paciente (cria se faltar). */
function subpasta(p, nome) {
  let pasta;
  const m = String(p.valores[P.pasta] || "").match(/folders\/([\w-]+)/);
  if (m) { try { pasta = DriveApp.getFolderById(m[1]); } catch (e) {} }
  if (!pasta) {
    pasta = criarPastaPaciente(String(p.valores[P.nome]), p.valores[P.id]);
    aba("Pacientes").getRange(p.linha, P.pasta + 1).setValue(pasta.getUrl());
  }
  const it = pasta.getFoldersByName(nome);
  return it.hasNext() ? it.next() : pasta.createFolder(nome);
}

// ---------------------------------------------------------------- Ajudantes

function tentativaPermitida(chave, limite) {
  const cache = CacheService.getScriptCache();
  const n = Number(cache.get("t_" + chave) || 0) + 1;
  cache.put("t_" + chave, String(n), 600);
  return n <= limite;
}
function texto(v, max) { return String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max || 500); }
function textoLongo(v, max) { return String(v == null ? "" : v).replace(/\r/g, "").trim().slice(0, max || 3000); }
// Impede que um texto vire fórmula na planilha
function seguro(v) { const s = String(v == null ? "" : v); return /^[=+\-@\t\r]/.test(s) ? "'" + s : s; }
function emailValido(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e); }
function celularNormal(v) { let d = String(v || "").replace(/\D/g, ""); if (d.length >= 12 && d.indexOf("55") === 0) d = d.slice(2); return d; }
function formatarCelular(d) { return d.length === 11 ? "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7) : "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6); }
function dataValida(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s)); }
function dataBR(iso) { return String(iso).split("-").reverse().join("/"); }
function fuso() { return Session.getScriptTimeZone() || "America/Sao_Paulo"; }
function dataISO(v) { return v instanceof Date ? Utilities.formatDate(v, fuso(), "yyyy-MM-dd") : String(v || ""); }
function lerJSON(s) { try { return JSON.parse(s); } catch (e) { return {}; } }
function novoId(prefixo) { return prefixo + Utilities.getUuid().replace(/-/g, "").slice(0, 8).toUpperCase(); }
function escHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
