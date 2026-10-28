// Backend do Mercado do mês: guarda o estado inteiro como JSON na célula A1 da aba "dados".
// O app manda uma lista de operações (set/del/replace) e recebe o estado atualizado.

const ABA = "dados";

function aba_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(ABA) || ss.insertSheet(ABA);
}

function ler_() {
  const v = aba_().getRange("A1").getValue();
  return v ? JSON.parse(v) : null;
}

function gravar_(estado) {
  aba_().getRange("A1").setValue(JSON.stringify(estado));
}

function resposta_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Mesma lógica do aplicar() do index.html
function aplicar_(s, op) {
  if (op.op === "replace") {
    // "se" evita que dois celulares fechem o mesmo mês duas vezes
    if (op.se && s && s.mes !== op.se.mes) return s;
    return op.value;
  }
  s = s || {};
  let o = s;
  for (let i = 0; i < op.path.length - 1; i++) {
    const k = op.path[i];
    if (typeof o[k] !== "object" || o[k] === null) o[k] = {};
    o = o[k];
  }
  const ult = op.path[op.path.length - 1];
  if (op.op === "del") delete o[ult];
  else o[ult] = op.value;
  return s;
}

function doGet() {
  return resposta_({ ok: true, estado: ler_() });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ops = JSON.parse(e.postData.contents).ops || [];
    let s = ler_();
    ops.forEach(op => { s = aplicar_(s, op); });
    gravar_(s);
    return resposta_({ ok: true, estado: s });
  } catch (err) {
    return resposta_({ ok: false, erro: String(err) });
  } finally {
    lock.releaseLock();
  }
}
