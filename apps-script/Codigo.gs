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
const URL_AREA_PACIENTE = "https://carolnutr.github.io/Site-nutri/paciente/";
// Senha do painel (a mesma para a Ana Carolina e para a recepção).
// O código fica público no GitHub, então a senha não aparece aqui: fica só a versão
// embaralhada dela (hash). Para trocar a senha, veja a função gerarHashDaSenha.
const SENHA_ADMIN_HASH = "34e35a716c4d17a44e67f0877e52b6d38b6a4399eb0c8cab04ec72a9aa3158ce";
const SAL_SENHA = "nutri-ana-carolina";
// Quem pode aparecer na coluna "Cadastrado por" (o painel pergunta quem está usando).
const ADMINISTRADORAS = ["Ana Carolina", "Recepção"];
// A recepção vê só os dados do cadastro. Ficha, exames, acompanhamento e anotações
// ficam só com a nutricionista. Troque para true se a recepção também deve ver tudo.
const RECEPCAO_VE_SAUDE = false;
const NOME_REMETENTE = "Ana Carolina Pereira · Nutricionista";
const NOME_PASTA = "Pacientes · Nutri Ana Carolina";
const MAX_ARQUIVO_MB = 10;
// =======================================================

const VERSAO = 1;
const HORAS_SESSAO = 6;
const HORAS_SESSAO_ADMIN = 12;
const STATUS = ["Novo", "Ficha respondida", "Em acompanhamento", "Pausado", "Alta"];
const ABAS = {
  Pacientes: ["ID", "Cadastro", "Nome", "E-mail", "Celular", "Nascimento", "Objetivo", "Status", "Cadastrado por", "Token", "Pasta", "Consentimento em", "Último acesso", "Anotações (só a nutricionista)"],
  Fichas: ["Data", "Paciente", "Tipo", "Valores (JSON)"],
  Respostas: ["Data", "Paciente", "Nome", "Tipo", "Seção", "Pergunta", "Resposta"],
  Exames: ["Data", "Paciente", "Nome", "Arquivo", "Descrição", "Link", "ID no Drive"],
  Documentos: ["ID", "Data", "Paciente", "Título", "Tipo", "Link", "ID no Drive"]
};
// Posição das colunas da aba Pacientes (começando em 0)
const P = { id: 0, cadastro: 1, nome: 2, email: 3, celular: 4, nascimento: 5, objetivo: 6, status: 7, por: 8, token: 9, pasta: 10, consentimento: 11, acesso: 12, anotacoes: 13 };
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
      case "adminEntrar": return saida(adminEntrar(c));
      case "adminPacientes": return saida(adminPacientes(c));
      case "adminPaciente": return saida(adminPaciente(c));
      case "adminAtualizar": return saida(adminAtualizar(c));
      case "adminReenviar": return saida(adminReenviar(c));
      case "adminRemover": return saida(adminRemover(c));
      case "adminArquivo": return saida(adminArquivo(c));
      case "adminDocumento": return saida(adminDocumento(c));
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

function adminEntrar(c) {
  if (!SENHA_ADMIN_HASH) return { ok: false, erro: "senha_nao_configurada" };
  const cache = CacheService.getScriptCache();
  const erros = Number(cache.get("t_admin_erros") || 0);
  if (erros >= 10) return { ok: false, erro: "muitas_tentativas" };
  if (hashSenha(String(c.senha || "")) !== SENHA_ADMIN_HASH) {
    cache.put("t_admin_erros", String(erros + 1), 600);
    return { ok: false, erro: "senha_invalida" };
  }
  const por = ADMINISTRADORAS.indexOf(c.por) >= 0 ? c.por : "Recepção";
  const sessao = Utilities.getUuid();
  cache.put("adm_" + sessao, por, HORAS_SESSAO_ADMIN * 3600);
  return { ok: true, sessao: sessao, por: por, veSaude: veSaude(por) };
}
function hashSenha(senha) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, SAL_SENHA + ":" + senha, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ((b + 256) % 256).toString(16).padStart(2, "0"); }).join("");
}

/**
 * Para trocar a senha do painel: escreva a nova senha entre as aspas abaixo, rode esta
 * função no editor, copie o código que aparece no registro para SENHA_ADMIN_HASH,
 * apague a senha daqui e implante uma nova versão.
 */
function gerarHashDaSenha() {
  const novaSenha = "";
  if (!novaSenha) { console.log("Escreva a nova senha entre as aspas primeiro."); return; }
  console.log(hashSenha(novaSenha));
}

function veSaude(por) { return por === "Ana Carolina" || RECEPCAO_VE_SAUDE; }
function adminDaSessao(c) {
  const por = CacheService.getScriptCache().get("adm_" + texto(c.sessao, 60));
  return por ? { por: por, veSaude: veSaude(por) } : null;
}

/**
 * Cadastro feito pela recepção: nome, e-mail, celular e data de nascimento.
 * Cria o paciente e a pasta no Drive e manda o e-mail com o link.
 * Objetivo e status ficam com a nutricionista (painel).
 */
function cadastrar(c) {
  const adm = adminDaSessao(c);
  if (!adm) return { ok: false, erro: "sessao_expirada" };
  const admin = adm.por;
  const nome = texto(c.nome, 120);
  const email = texto(c.email, 120).toLowerCase();
  const celular = celularNormal(c.celular);
  if (nome.split(" ").length < 2 || !emailValido(email) || celular.length < 10 || !dataValida(c.nascimento)) return { ok: false, erro: "dados_invalidos" };

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
    linha[P.nascimento] = "'" + dataBR(c.nascimento);
    linha[P.objetivo] = "";
    linha[P.status] = "Novo";
    linha[P.por] = admin;
    linha[P.token] = token;
    linha[P.pasta] = pasta.getUrl();
    linha[P.consentimento] = "";
    linha[P.acesso] = "";
    linha[P.anotacoes] = "";
    aba("Pacientes").appendRow(linha);
    enviarEmailDeAcesso(nome, email, token);
    return { ok: true, id: id, link: linkDeAcesso(token) };
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

// ---------------------------------------------------------------- Painel das administradoras

function adminPacientes(c) {
  const adm = adminDaSessao(c);
  if (!adm) return { ok: false, erro: "sessao_expirada" };
  const sh = aba("Pacientes");
  const n = sh.getLastRow();
  const linhas = n < 2 ? [] : sh.getRange(2, 1, n - 1, ABAS.Pacientes.length).getValues();
  const exames = {};
  const se = aba("Exames");
  if (se.getLastRow() > 1) se.getRange(2, 1, se.getLastRow() - 1, 2).getValues().forEach(function (l) {
    const e = exames[l[1]] = exames[l[1]] || { n: 0, ultimo: "" };
    const d = dataISO(l[0]);
    e.n++; if (d > e.ultimo) e.ultimo = d;
  });
  const fichas = {};
  const sf = aba("Fichas");
  if (sf.getLastRow() > 1) sf.getRange(2, 1, sf.getLastRow() - 1, 3).getValues().forEach(function (l) {
    const f = fichas[l[1]] = fichas[l[1]] || { ficha: "", checkins: 0, ultimoCheckin: "" };
    const d = dataISO(l[0]);
    if (l[2] === "Ficha") { if (d > f.ficha) f.ficha = d; }
    else { f.checkins++; if (d > f.ultimoCheckin) f.ultimoCheckin = d; }
  });
  return {
    ok: true,
    pacientes: linhas.filter(function (v) { return v[P.id]; }).map(function (v) {
      const id = v[P.id], f = fichas[id] || {}, e = exames[id] || {};
      return {
        id: id, nome: String(v[P.nome]), email: String(v[P.email]), celular: String(v[P.celular]),
        nascimento: nascISO(v[P.nascimento]), objetivo: String(v[P.objetivo] || ""), status: String(v[P.status] || "Novo"),
        cadastro: dataISO(v[P.cadastro]), por: String(v[P.por] || ""), ultimoAcesso: dataISO(v[P.acesso]),
        ficha: f.ficha || "", checkins: f.checkins || 0, ultimoCheckin: f.ultimoCheckin || "",
        exames: e.n || 0, ultimoExame: e.ultimo || ""
      };
    })
  };
}

function adminPaciente(c) {
  const adm = adminDaSessao(c);
  if (!adm) return { ok: false, erro: "sessao_expirada" };
  const p = acharPaciente(function (l) { return l[P.id] === texto(c.id, 20); });
  if (!p) return { ok: false, erro: "nao_encontrado" };
  const v = p.valores, id = v[P.id];
  const out = {
    ok: true, veSaude: adm.veSaude,
    paciente: {
      id: id, nome: String(v[P.nome]), email: String(v[P.email]), celular: String(v[P.celular]),
      nascimento: nascISO(v[P.nascimento]), objetivo: String(v[P.objetivo] || ""), status: String(v[P.status] || "Novo"),
      cadastro: dataISO(v[P.cadastro]), por: String(v[P.por] || ""), ultimoAcesso: dataISO(v[P.acesso]),
      consentimento: dataISO(v[P.consentimento]),
      pasta: adm.veSaude ? String(v[P.pasta] || "") : "",
      anotacoes: adm.veSaude ? String(v[P.anotacoes] || "") : "",
      link: linkDeAcesso(v[P.token])
    }
  };
  if (!adm.veSaude) return out;
  // Respostas agrupadas por envio (mesma data e hora, mesmo tipo)
  const grupos = {}, ordem = [];
  linhasDoPaciente("Respostas", 1, id).forEach(function (l) {
    const chave = (l[0] instanceof Date ? l[0].getTime() : String(l[0])) + "|" + l[3];
    if (!grupos[chave]) { grupos[chave] = { data: dataISO(l[0]), tipo: String(l[3]), respostas: [] }; ordem.push(chave); }
    grupos[chave].respostas.push({ secao: String(l[4]), pergunta: String(l[5]), resposta: String(l[6]) });
  });
  const envios = ordem.map(function (k) { return grupos[k]; });
  const fichas = envios.filter(function (e) { return e.tipo === "Ficha"; });
  out.ficha = fichas.length ? fichas[fichas.length - 1] : null;
  out.fichasAnteriores = fichas.slice(0, -1).map(function (f) { return f.data; });
  out.checkins = envios.filter(function (e) { return e.tipo === "Como estou"; });
  out.exames = linhasDoPaciente("Exames", 1, id).map(function (l) { return { id: String(l[6]), data: dataISO(l[0]), nome: String(l[3]), descricao: String(l[4] || "") }; });
  out.documentos = linhasDoPaciente("Documentos", 2, id).map(function (l) { return { id: String(l[6]), data: dataISO(l[1]), titulo: String(l[3]), tipo: String(l[4] || "") }; });
  return out;
}

/** Edita cadastro e acompanhamento. Objetivo e anotações só a nutricionista. */
function adminAtualizar(c) {
  const adm = adminDaSessao(c);
  if (!adm) return { ok: false, erro: "sessao_expirada" };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const p = acharPaciente(function (l) { return l[P.id] === texto(c.id, 20); });
    if (!p) return { ok: false, erro: "nao_encontrado" };
    const mudar = [];
    if (c.nome !== undefined) {
      const nome = texto(c.nome, 120);
      if (nome.split(" ").length < 2) return { ok: false, erro: "dados_invalidos" };
      mudar.push([P.nome, seguro(nome)]);
    }
    if (c.email !== undefined) {
      const email = texto(c.email, 120).toLowerCase();
      if (!emailValido(email)) return { ok: false, erro: "dados_invalidos" };
      if (acharPaciente(function (l) { return String(l[P.email]).toLowerCase() === email && l[P.id] !== p.valores[P.id]; })) return { ok: false, erro: "email_ja_cadastrado" };
      mudar.push([P.email, seguro(email)]);
    }
    if (c.celular !== undefined) {
      const cel = celularNormal(c.celular);
      if (cel.length < 10) return { ok: false, erro: "dados_invalidos" };
      mudar.push([P.celular, "'" + formatarCelular(cel)]);
    }
    if (c.nascimento !== undefined) {
      if (!dataValida(c.nascimento)) return { ok: false, erro: "dados_invalidos" };
      mudar.push([P.nascimento, "'" + dataBR(c.nascimento)]);
    }
    if (c.status !== undefined) {
      if (STATUS.indexOf(c.status) < 0) return { ok: false, erro: "dados_invalidos" };
      mudar.push([P.status, c.status]);
    }
    if (c.objetivo !== undefined || c.anotacoes !== undefined) {
      if (!adm.veSaude) return { ok: false, erro: "sem_permissao" };
      if (c.objetivo !== undefined) mudar.push([P.objetivo, seguro(texto(c.objetivo, 120))]);
      if (c.anotacoes !== undefined) mudar.push([P.anotacoes, seguro(textoLongo(c.anotacoes, 20000))]);
    }
    const sh = aba("Pacientes");
    mudar.forEach(function (m) { sh.getRange(p.linha, m[0] + 1).setValue(m[1]); });
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function adminReenviar(c) {
  const adm = adminDaSessao(c);
  if (!adm) return { ok: false, erro: "sessao_expirada" };
  const p = acharPaciente(function (l) { return l[P.id] === texto(c.id, 20); });
  if (!p) return { ok: false, erro: "nao_encontrado" };
  if (!tentativaPermitida("reenviar_adm_" + p.valores[P.id], 5)) return { ok: false, erro: "muitas_tentativas" };
  enviarEmailDeAcesso(String(p.valores[P.nome]), String(p.valores[P.email]), p.valores[P.token]);
  return { ok: true };
}

/**
 * Remove o paciente: apaga a linha dele e as fichas, respostas, exames e documentos na
 * planilha. A pasta dele no Drive vai para a lixeira (dá para recuperar por 30 dias).
 */
function adminRemover(c) {
  const adm = adminDaSessao(c);
  if (!adm) return { ok: false, erro: "sessao_expirada" };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const p = acharPaciente(function (l) { return l[P.id] === texto(c.id, 20); });
    if (!p) return { ok: false, erro: "nao_encontrado" };
    const id = p.valores[P.id];
    [["Fichas", 1], ["Respostas", 1], ["Exames", 1], ["Documentos", 2]].forEach(function (a) {
      const sh = aba(a[0]);
      const n = sh.getLastRow();
      if (n < 2) return;
      const ids = sh.getRange(2, a[1] + 1, n - 1, 1).getValues();
      for (let i = ids.length - 1; i >= 0; i--) if (ids[i][0] === id) apagarLinha(sh, i + 2);
    });
    const m = String(p.valores[P.pasta] || "").match(/folders\/([\w-]+)/);
    if (m) { try { DriveApp.getFolderById(m[1]).setTrashed(true); } catch (e) {} }
    apagarLinha(aba("Pacientes"), p.linha);
    console.log("Paciente removido por " + adm.por + ": " + id);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function apagarLinha(sh, linha) {
  // A planilha não deixa apagar a última linha abaixo do cabeçalho: aí só limpa.
  if (sh.getMaxRows() - sh.getFrozenRows() <= 1) sh.getRange(linha, 1, 1, sh.getMaxColumns()).clearContent();
  else sh.deleteRow(linha);
}

/** Abre um exame ou documento de paciente (só arquivos registrados na planilha). */
function adminArquivo(c) {
  const adm = adminDaSessao(c);
  if (!adm) return { ok: false, erro: "sessao_expirada" };
  if (!adm.veSaude) return { ok: false, erro: "sem_permissao" };
  const id = texto(c.id, 80);
  const registrado = [["Exames", 7], ["Documentos", 7]].some(function (a) {
    const sh = aba(a[0]);
    if (sh.getLastRow() < 2) return false;
    return sh.getRange(2, a[1], sh.getLastRow() - 1, 1).getValues().some(function (l) { return String(l[0]) === id; });
  });
  if (!id || !registrado) return { ok: false, erro: "nao_encontrado" };
  const blob = DriveApp.getFileById(id).getBlob();
  if (blob.getBytes().length > 20 * 1024 * 1024) return { ok: false, erro: "arquivo_grande" };
  return { ok: true, nome: blob.getName(), tipo: blob.getContentType(), base64: Utilities.base64Encode(blob.getBytes()) };
}

/** A nutricionista envia um plano, orientação ou pedido de exame para a área do paciente. */
function adminDocumento(c) {
  const adm = adminDaSessao(c);
  if (!adm) return { ok: false, erro: "sessao_expirada" };
  if (!adm.veSaude) return { ok: false, erro: "sem_permissao" };
  const p = acharPaciente(function (l) { return l[P.id] === texto(c.id, 20); });
  if (!p) return { ok: false, erro: "nao_encontrado" };
  const titulo = texto(c.titulo, 120);
  const tipoDoc = texto(c.tipoDoc, 40) || "Orientações";
  const mime = String(c.mime || "").toLowerCase();
  if (!titulo) return { ok: false, erro: "dados_invalidos" };
  if (TIPOS_OK.indexOf(mime) < 0) return { ok: false, erro: "tipo_invalido" };
  let bytes;
  try { bytes = Utilities.base64Decode(String(c.base64 || "")); } catch (err) { return { ok: false, erro: "dados_invalidos" }; }
  if (!bytes.length) return { ok: false, erro: "dados_invalidos" };
  if (bytes.length > 15 * 1024 * 1024) return { ok: false, erro: "arquivo_grande" };
  const ext = mime === "application/pdf" ? ".pdf" : mime === "image/png" ? ".png" : mime === "image/webp" ? ".webp" : mime.indexOf("hei") >= 0 ? ".heic" : ".jpg";
  const arquivo = subpasta(p, "Da nutricionista").createFile(Utilities.newBlob(bytes, mime, titulo.replace(/[\\/:*?"<>|]/g, "_") + ext));
  const docId = novoId("D"), agora = new Date();
  aba("Documentos").appendRow([docId, agora, p.valores[P.id], seguro(titulo), seguro(tipoDoc), arquivo.getUrl(), arquivo.getId()]);
  if (p.valores[P.status] === "Novo" || p.valores[P.status] === "Ficha respondida") aba("Pacientes").getRange(p.linha, P.status + 1).setValue("Em acompanhamento");
  return { ok: true, documento: { id: arquivo.getId(), data: dataISO(agora), titulo: titulo, tipo: tipoDoc } };
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
  const sessao = Utilities.getUuid();
  CacheService.getScriptCache().put("adm_" + sessao, "Recepção", 600);
  console.log(cadastrar({ sessao: sessao, nome: "Paciente Teste", email: Session.getActiveUser().getEmail(), celular: "21999999999", nascimento: "1990-01-01" }));
}

// ---------------------------------------------------------------- E-mail

function linkDeAcesso(token) {
  return URL_AREA_PACIENTE + (URL_AREA_PACIENTE.indexOf("?") >= 0 ? "&" : "?") + "p=" + encodeURIComponent(token);
}

/**
 * E-mail com o link da área do paciente. Escrito como uma mensagem normal do consultório
 * (texto simples, assinatura completa, sem cara de aviso automático) para não cair no spam.
 */
function enviarEmailDeAcesso(nome, email, token) {
  const primeiro = String(nome).split(" ")[0];
  const link = linkDeAcesso(token);
  const assinatura = ["Ana Carolina dos Santos Pereira", "Nutricionista · CRN-4 23101599", "Av. Nossa Senhora de Copacabana, 540, sala 1105 · Copacabana, Rio de Janeiro", "WhatsApp (21) 96693-7967"];
  const texto =
    "Olá, " + primeiro + "!\n\n" +
    "Seu cadastro no consultório da nutricionista Ana Carolina Pereira está pronto.\n\n" +
    "Pela sua área do paciente você responde a ficha de saúde, envia seus exames e recebe o plano alimentar:\n" + link + "\n\n" +
    "Para entrar, use o mesmo e-mail e celular que você informou na recepção. Guarde este e-mail para entrar outras vezes.\n\n" +
    "Qualquer dúvida, é só responder este e-mail ou chamar no WhatsApp (21) 96693-7967.\n\n" +
    assinatura.join("\n");
  const html =
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#2c2f26;max-width:560px">' +
    "<p>Olá, " + escHtml(primeiro) + "!</p>" +
    "<p>Seu cadastro no consultório da nutricionista Ana Carolina Pereira está pronto.</p>" +
    "<p>Pela sua área do paciente você responde a ficha de saúde, envia seus exames e recebe o plano alimentar:</p>" +
    '<p><a href="' + link + '" style="display:inline-block;background:#5d6e35;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:bold">Abrir minha área do paciente</a></p>' +
    "<p>Para entrar, use o mesmo e-mail e celular que você informou na recepção. Guarde este e-mail para entrar outras vezes.</p>" +
    "<p>Qualquer dúvida, é só responder este e-mail ou chamar no WhatsApp (21) 96693-7967.</p>" +
    '<p style="margin-top:24px;color:#555">' + assinatura.map(escHtml).join("<br>") + "</p>" +
    "</div>";
  MailApp.sendEmail({ to: email, subject: "Seu cadastro com a nutricionista Ana Carolina Pereira", body: texto, htmlBody: html, name: NOME_REMETENTE });
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
function nascISO(v) {
  if (v instanceof Date) return Utilities.formatDate(v, fuso(), "yyyy-MM-dd");
  const m = String(v || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? m[3] + "-" + m[2] + "-" + m[1] : "";
}
function lerJSON(s) { try { return JSON.parse(s); } catch (e) { return {}; } }
function novoId(prefixo) { return prefixo + Utilities.getUuid().replace(/-/g, "").slice(0, 8).toUpperCase(); }
function escHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
