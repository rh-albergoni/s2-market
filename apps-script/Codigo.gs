// Backend do app Mercado do mês (versão 3).
//
// Aba "dados" (coluna A = chave, coluna B = JSON):
//   config        → pessoas, idas (dia, nome, valor previsto) e a lista de itens
//   mes:AAAA-MM   → um mês: itens marcados, valores pagos, extras...
// Aba "resumo": tabela gerada automaticamente, só para consulta.
//
// O app manda operações pequenas (set/del/ini) em vez do estado inteiro, então duas
// pessoas usando ao mesmo tempo não sobrescrevem uma à outra. Cada gravação aumenta
// um número de revisão; o app pergunta só esse número e baixa os dados quando ele muda.

const VERSAO = 3;
const ABA = "dados";
const ABA_RESUMO = "resumo";
const IDS = ["i1", "i2", "i3", "i4"];
const CFG_V1 = { pessoas: 3, est: { i1: 1535, i2: 165, i3: 535, i4: 165 } };

/* ---------------- Planilha ---------------- */

function aba_(nome) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(nome);
  if (sh) return sh;
  try { return ss.insertSheet(nome); }
  catch (e) { return ss.getSheetByName(nome); } // outra requisição criou ao mesmo tempo
}

function ler_() {
  const sh = aba_(ABA);
  const n = sh.getLastRow();
  const estado = { config: null, meses: {} };
  if (!n) return estado;
  const vals = sh.getRange(1, 1, n, 2).getValues();

  // Versão 1: o estado inteiro em A1 (e nenhuma linha no formato novo)
  const a1v1 = String(vals[0][0]).trim().charAt(0) === "{";
  // (o app antigo só usa A1; se B1 tem JSON, a planilha já está no formato novo)
  const temV3 = String(vals[0][1] || "").trim().charAt(0) === "{" ||
    vals.some(function (l) { const k = String(l[0]); return k === "config" || k.indexOf("mes:") === 0; });
  if (a1v1 && !temV3) return migrarV1_(JSON.parse(vals[0][0]));

  vals.forEach(function (linha, i) {
    let k = String(linha[0]), v = linha[1];
    // A1 sobrescrito por um app antigo: descobre pela coluna B o que era a linha 1
    if (i === 0 && a1v1) {
      if (v === "" || v === null) return;
      const o = JSON.parse(v);
      k = o && o.mes ? "mes:" + o.mes : "config";
    }
    if (!k || v === "" || v === null) return;
    if (k === "config") estado.config = JSON.parse(v);
    else if (k.indexOf("mes:") === 0) estado.meses[k.slice(4)] = JSON.parse(v);
  });
  return estado;
}

function migrarV1_(velho) {
  const vazio = function () { return { itens: {}, notas: {}, extras: {}, cheg: {} }; };
  const meses = Object.assign({}, velho.meses || {});
  (velho.hist || []).forEach(function (h) {
    if (!meses[h.mes]) meses[h.mes] = Object.assign(vazio(), { mes: h.mes, cfg: copia_(CFG_V1), notas: { i1: h.gasto } });
  });
  if (velho.mes && !meses[velho.mes]) {
    meses[velho.mes] = {
      mes: velho.mes, cfg: copia_(CFG_V1),
      itens: velho.itens || {}, notas: velho.notas || {}, extras: velho.extras || {}, cheg: velho.cheg || {}
    };
  }
  return { config: velho.config || null, meses: meses };
}

function copia_(o) { return JSON.parse(JSON.stringify(o)); }

function gravar_(estado) {
  const sh = aba_(ABA);
  const linhas = [];
  if (estado.config) linhas.push(["config", JSON.stringify(estado.config)]);
  Object.keys(estado.meses || {}).sort().forEach(function (m) {
    const o = estado.meses[m];
    if (!o || typeof o !== "object") return;
    o.mes = m; // cada linha sabe de que mês é
    linhas.push(["mes:" + m, JSON.stringify(o)]);
  });
  const antes = sh.getLastRow();
  if (linhas.length) sh.getRange(1, 1, linhas.length, 2).setValues(linhas);
  if (antes > linhas.length) sh.getRange(linhas.length + 1, 1, antes - linhas.length, 2).clearContent();
}

// Aba "resumo": uma linha por mês, para quem quiser olhar direto na planilha
function resumo_(estado) {
  const cfg = estado.config || {};
  const nomes = IDS.map(function (i) {
    const ida = (cfg.idas || {})[i] || {};
    return "Dia " + (ida.dia || { i1: 1, i2: 8, i3: 15, i4: 22 }[i]);
  });
  const linhas = [["Mês", "Pessoas", "Previsto", "Gasto", "Diferença"].concat(nomes)];
  Object.keys(estado.meses || {}).sort().forEach(function (k) {
    const m = estado.meses[k] || {};
    const c = m.cfg || {};
    const est = IDS.reduce(function (s, i) {
      const v = (c.est || {})[i] != null ? c.est[i] : ((cfg.idas || {})[i] || {}).est != null ? cfg.idas[i].est : (cfg.est || {})[i] != null ? cfg.est[i] : CFG_V1.est[i];
      return s + (Number(v) || 0);
    }, 0);
    const notas = m.notas || {};
    const gasto = IDS.reduce(function (s, i) { return s + (Number(notas[i]) || 0); }, 0);
    linhas.push([k, c.pessoas || cfg.pessoas || "", est, gasto, Math.round((gasto - est) * 100) / 100].concat(IDS.map(function (i) {
      return notas[i] == null ? "" : Number(notas[i]);
    })));
  });
  const sh = aba_(ABA_RESUMO);
  sh.clearContents();
  sh.getRange(1, 1, linhas.length, 1).setNumberFormat("@"); // "2026-10" como texto, não data
  sh.getRange(1, 1, linhas.length, linhas[0].length).setValues(linhas);
}

/* ---------------- Revisão e presença ---------------- */

// A revisão é um código único (não um contador), então nunca se repete.
// Só o doPost (com o lock) escreve; o doGet só lê.
function lerRev_() {
  const c = CacheService.getScriptCache().get("rev");
  if (c !== null) return c;
  return PropertiesService.getScriptProperties().getProperty("rev") || "0";
}

function novaRev_() {
  const r = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  PropertiesService.getScriptProperties().setProperty("rev", r);
  const cache = CacheService.getScriptCache();
  try { cache.put("rev", r, 21600); } catch (e) { try { cache.remove("rev"); } catch (e2) {} }
  return r;
}

// Quem está com o app aberto agora (fica só no cache, não vai para a planilha)
function lerDevs_() {
  const cache = CacheService.getScriptCache();
  const c = cache.get("devs");
  if (c !== null) return JSON.parse(c);
  const d = PropertiesService.getScriptProperties().getProperty("devs") || "[]";
  cache.put("devs", d, 21600);
  return JSON.parse(d);
}

function marcarPresenca_(p) {
  if (!p.dev) return;
  const dev = String(p.dev).slice(0, 40);
  const cache = CacheService.getScriptCache();
  cache.put("p:" + dev, JSON.stringify({
    nome: String(p.nome || "").slice(0, 40), onde: String(p.onde || "").slice(0, 40), t: Date.now()
  }), 120);
  const devs = lerDevs_();
  if (devs.indexOf(dev) < 0) {
    devs.push(dev);
    const novo = JSON.stringify(devs.slice(-20));
    PropertiesService.getScriptProperties().setProperty("devs", novo);
    cache.put("devs", novo, 21600);
  }
}

function presenca_(eu) {
  const devs = lerDevs_().filter(function (d) { return d !== eu; });
  if (!devs.length) return [];
  const vals = CacheService.getScriptCache().getAll(devs.map(function (d) { return "p:" + d; }));
  const agora = Date.now();
  const out = [];
  devs.forEach(function (d) {
    const v = vals["p:" + d];
    if (!v) return;
    const o = JSON.parse(v);
    if (agora - o.t < 30000) out.push({ dev: d, nome: o.nome, onde: o.onde, t: o.t });
  });
  return out;
}

/* ---------------- Operações ---------------- */

// Mesma lógica do aplicar() do app.js.
// set = grava, del = apaga, ini = grava só se ainda não existir
function aplicar_(s, op) {
  const path = op.path || [];
  if (!path.length) {
    if (op.op === "del") return undefined;
    if (op.op === "ini") return s === undefined ? op.value : s;
    return op.value;
  }
  s = s || {};
  let o = s;
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i];
    if (typeof o[k] !== "object" || o[k] === null) o[k] = {};
    o = o[k];
  }
  const ult = path[path.length - 1];
  if (op.op === "del") delete o[ult];
  else if (op.op === "ini") { if (o[ult] === undefined) o[ult] = op.value; }
  else o[ult] = op.value;
  return s;
}

// Só aceita operações do app novo: set/del/ini dentro de config ou de um mês
function opValida_(op) {
  if (!op || ["set", "del", "ini"].indexOf(op.op) < 0) return false;
  const p = op.path;
  if (!Array.isArray(p) || !p.length) return false;
  if (p[0] === "config") return true;
  return p[0] === "meses" && p.length >= 2 && /^\d{4}-\d{2}$/.test(String(p[1]));
}

function resposta_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------------- Web app ---------------- */

// GET ?rev=N&dev=...&nome=...&onde=...
// Se a revisão do app for a mesma da planilha, devolve só a revisão e a presença (rápido).
function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    const rev = lerRev_();
    marcarPresenca_(p);
    const out = { ok: true, v: VERSAO, rev: rev, pres: presenca_(p.dev) };
    if (String(p.rev) !== String(rev)) out.estado = ler_();
    return resposta_(out);
  } catch (err) {
    return resposta_({ ok: false, v: VERSAO, erro: String(err) });
  }
}

// POST {v:3, dev, ops:[{op, path, value, s, n}], rev}
// Cada operação tem a sessão do app que a criou (s: uma por aba/abertura) e um número
// crescente dentro dela (n). Se o app reenviar um lote que já foi aplicado (resposta
// perdida no caminho), as operações repetidas são ignoradas.
// Se o app já estava na revisão atual, ele já tem o resultado e recebe só a nova revisão.
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
    const body = JSON.parse(e.postData.contents);
    if (body.v !== VERSAO) return resposta_({ ok: false, v: VERSAO, erro: "Versão do app desatualizada. Recarregue a página." });
    const props = PropertiesService.getScriptProperties();
    const chaveSeq = "seq:" + String(body.dev || "").slice(0, 40);
    const seqs = JSON.parse(props.getProperty(chaveSeq) || "{}"); // {sessão: último n aplicado}
    const ops = (body.ops || []).filter(function (op) {
      return opValida_(op) && !(op.s && op.n <= (seqs[op.s] || 0));
    });
    const antes = PropertiesService.getScriptProperties().getProperty("rev") || "0";
    let s = ler_();
    ops.forEach(function (op) { s = aplicar_(s, op); });
    if (!s.meses) s.meses = {};
    if (ops.length) {
      gravar_(s);
      SpreadsheetApp.flush(); // grava de verdade antes de liberar o lock
      ops.forEach(function (op) {
        if (!op.s) return;
        delete seqs[op.s]; // reinsere no fim para manter as sessões mais recentes
        seqs[op.s] = Math.max(Number(op.n) || 0, 0);
      });
      const sessoes = Object.keys(seqs);
      sessoes.slice(0, Math.max(0, sessoes.length - 12)).forEach(function (k) { delete seqs[k]; });
      props.setProperty(chaveSeq, JSON.stringify(seqs));
    }
    const rev = ops.length ? novaRev_() : antes;
    if (ops.length) { try { resumo_(s); SpreadsheetApp.flush(); } catch (errResumo) { console.warn(errResumo); } }
    const out = { ok: true, v: VERSAO, rev: rev };
    if (String(body.rev) !== String(antes)) out.estado = s;
    return resposta_(out);
  } catch (err) {
    return resposta_({ ok: false, v: VERSAO, erro: String(err) });
  } finally {
    lock.releaseLock();
  }
}
