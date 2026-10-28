// Script versão 1 (o que está publicado hoje na planilha do usuário)
const ABA = "dados";
function aba_() { const ss = SpreadsheetApp.getActiveSpreadsheet(); return ss.getSheetByName(ABA) || ss.insertSheet(ABA); }
function ler_() { const v = aba_().getRange("A1").getValue(); return v ? JSON.parse(v) : null; }
function gravar_(s) { aba_().getRange("A1").setValue(JSON.stringify(s)); }
function resposta_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function aplicar_(s, op) {
  if (op.op === "replace") { if (op.se && s && s.mes !== op.se.mes) return s; return op.value; }
  s = s || {}; let o = s;
  for (let i = 0; i < op.path.length - 1; i++) { const k = op.path[i]; if (typeof o[k] !== "object" || o[k] === null) o[k] = {}; o = o[k]; }
  const ult = op.path[op.path.length - 1]; if (op.op === "del") delete o[ult]; else o[ult] = op.value; return s;
}
function doGet() { return resposta_({ ok: true, estado: ler_() }); }
function doPost(e) { const ops = JSON.parse(e.postData.contents).ops || []; let s = ler_() || {}; ops.forEach(op => s = aplicar_(s, op)); gravar_(s); return resposta_({ ok: true, estado: s }); }
