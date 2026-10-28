"use strict";
/* Mercado do mês
   Tudo fica no Google Planilhas (via Apps Script). Cada toque vira uma operação pequena
   (set/del/ini) que é aplicada na hora aqui e enviada em seguida; a planilha aplica as
   mesmas operações. Assim duas pessoas usando juntas não sobrescrevem uma à outra. */

/* ================= Utilidades ================= */

const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const copia=o=>o===undefined?undefined:JSON.parse(JSON.stringify(o));
const num=v=>v.toLocaleString("pt-BR",{maximumFractionDigits:2});
const brl=v=>(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL",minimumFractionDigits:v%1?2:0,maximumFractionDigits:2});
const brlEdit=v=>v==null?"":v.toLocaleString("pt-BR",{minimumFractionDigits:v%1?2:0,maximumFractionDigits:2});
// Aceita "1.535", "1535,50", "1.480,50", "1,234.5", "R$ 12"
function parse(s){
  if(s==null||s==="")return null;
  if(/[\/]/.test(s))return null;
  s=String(s).replace(/[^\d,.-]/g,"");
  if(!s)return null;
  const v=s.lastIndexOf(","), p=s.lastIndexOf(".");
  if(v>=0&&p>=0)s=v>p?s.replace(/\./g,"").replace(",","."):s.replace(/,/g,""); // o último separador é o decimal
  else if(v>=0)s=s.split(",").length>2?s.replace(/,/g,""):s.replace(",",".");
  else if(/^-?\d{1,3}(\.\d{3})+$/.test(s))s=s.replace(/\./g,"");
  const n=parseFloat(s);return isFinite(n)?n:null;
}
const mesAtual=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")};
const somaMes=(m,d)=>{const[y,mo]=m.split("-").map(Number);const t=new Date(y,mo-1+d,1);return t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0")};
const mesNome=m=>{const[y,mo]=m.split("-");return new Date(+y,+mo-1,1).toLocaleDateString("pt-BR",{month:"long",year:"numeric"})};
const cap=t=>t.charAt(0).toUpperCase()+t.slice(1);
const mesCurto=m=>{const[y,mo]=m.split("-");return new Date(+y,+mo-1,1).toLocaleDateString("pt-BR",{month:"short"}).replace(".","")};
const hora=t=>new Date(t).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const ls={
  get(k){try{return localStorage.getItem(k)}catch(e){return null}},
  set(k,v){try{localStorage.setItem(k,v);return true}catch(e){return false}},
  json(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}}
};
const vibrar=()=>{try{navigator.vibrate&&navigator.vibrate(12)}catch(e){}};

const SVG={
  check:'<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  casa:'<svg viewBox="0 0 24 24"><path d="M4 11l8-7 8 7M6 9.5V20h12V9.5"/></svg>',
  x:'<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  lupa:'<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
  undo:'<svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/></svg>',
  lixo:'<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  mais:'<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
  plus:'<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  voltar:'<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  frente:'<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
  alerta:'<svg viewBox="0 0 24 24"><path d="M12 8v5M12 16.5v.5"/><circle cx="12" cy="12" r="9"/></svg>',
  baixo:'<svg viewBox="0 0 24 24"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
  cima:'<svg viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6"/></svg>'
};

/* ================= Lista padrão ================= */

const BASE=3; // a lista padrão foi planejada para 3 pessoas
const IDS=["i1","i2","i3","i4"];
const IDAS0={
  i1:{dia:1,nome:"Compra grande",est:1535},
  i2:{dia:8,nome:"Compra da semana",est:165},
  i3:{dia:15,nome:"Meio do mês",est:535},
  i4:{dia:22,nome:"Compra da semana",est:165}
};
const todas=q=>({i1:q,i2:q,i3:q,i4:q});
const so1=q=>({i1:q});
const dupla=q=>({i1:q,i3:q});
// [id, nome, seção, unidade, quantidade (para 3 pessoas) em cada ida, opções]
const L0=[
  ["frango","Filé de peito de frango","Açougue","kg",dupla(6)],
  ["patinho","Patinho moído","Açougue","kg",dupla(3)],
  ["pernil","Pernil suíno sem osso","Açougue","kg",dupla(1.5)],
  ["ovos","Ovos","Ovos e congelados","ovo",{i1:60,i3:50},{p:10}],
  ["brocolis","Brócolis congelado","Ovos e congelados","kg",dupla(1)],
  ["arroz","Arroz","Grãos","kg",so1(5),{p:1}],
  ["feijao","Feijão carioca","Grãos","pacote de 1 kg",so1(4)],
  ["aveia","Aveia","Grãos","g",so1(900),{p:100}],
  ["macarrao","Macarrão","Grãos","pacote de 500 g",so1(2)],
  ["cafe","Café em grão","Mercearia","kg",so1(1.5)],
  ["azeite","Azeite","Mercearia","ml",so1(500),{p:250}],
  ["oleo","Óleo","Mercearia","garrafa de 900 ml",so1(2)],
  ["amendoim","Amendoim torrado sem sal","Mercearia","kg",so1(1)],
  ["molho","Molho de tomate","Mercearia","sachê",so1(3)],
  ["temperos","Sal, alho e temperos","Mercearia","",so1(null)],
  ["batata-doce","Batata-doce","Hortifrúti","kg",so1(4.5)],
  ["cenoura","Cenoura","Hortifrúti","kg",so1(2)],
  ["cebola","Cebola","Hortifrúti","kg",so1(2)],
  ["repolho","Repolho","Hortifrúti","unidade grande",so1(1)],
  ["banana","Banana","Hortifrúti","kg",todas(2)],
  ["maca","Maçã","Hortifrúti","kg",todas(1.5)],
  ["laranja","Laranja","Hortifrúti","kg",todas(2)],
  ["mamao","Mamão","Hortifrúti","unidade",todas(2)],
  ["alface","Alface","Hortifrúti","unidade",todas(2)],
  ["tomate","Tomate","Hortifrúti","kg",todas(1)],
  ["abobrinha","Abobrinha","Hortifrúti","g",todas(600)],
  ["limao","Limão","Hortifrúti","g",todas(400)],
  ["iogurte","Iogurte natural","Frios e padaria","kg",todas(1.5)],
  ["queijo","Queijo branco","Frios e padaria","g",todas(300)],
  ["pao","Pão integral","Frios e padaria","pacote",todas(2)],
  ["chocolate","Chocolate","Frios e padaria","barra de 90–100 g",todas(3)],
  ["sabao","Sabão em pó","Limpeza","kg",so1(4),{p:1}],
  ["amaciante","Amaciante","Limpeza","L",so1(2),{p:1}],
  ["desinfetante","Desinfetante","Limpeza","frasco de 2 L",so1(3)],
  ["sanitaria","Água sanitária","Limpeza","frasco de 2 L",so1(3)],
  ["detergente","Detergente de louça","Limpeza","unidade",so1(8)],
  ["multiuso","Multiuso","Limpeza","unidade",so1(2)],
  ["desengordurante","Desengordurante","Limpeza","unidade",so1(1)],
  ["sanitario","Gel ou bloco sanitário","Limpeza","kit para 3 banheiros",so1(1),{fixo:true}],
  ["esponjas","Esponjas, panos e luvas","Limpeza","",so1(null)],
  ["papel","Papel higiênico","Limpeza","pacote de 12",so1(3)],
  ["lixo","Saco de lixo","Limpeza","pacote",so1(3)],
  ["toalha","Papel toalha","Limpeza","unidade",so1(2)],
  ["sabonete","Sabonete","Higiene","pacote com 6",so1(2)],
  ["pasta","Pasta de dente","Higiene","",so1(null)],
  ["desodorante","Desodorante","Higiene","",so1(null)]
];
// Na lista guardamos a quantidade POR PESSOA (exceto itens fixos), para escalar com o número de pessoas
const LISTA0=Object.fromEntries(L0.map(([id,n,sec,u,q,op],o)=>{
  const fixo=!!(op&&op.fixo);
  const it={n,sec,u,o,q:Object.fromEntries(Object.entries(q).map(([k,v])=>[k,v==null?null:fixo?v:v/BASE]))};
  if(fixo)it.fixo=true;
  if(op&&op.p)it.p=op.p;
  return [id,it];
}));
// Chaves da versão anterior do app (posição do item na lista) → ids novos
const SEM_H=["banana","maca","laranja","mamao","alface","tomate","abobrinha","limao"], SEM_F=["iogurte","queijo","pao","chocolate"], ACO=["frango","patinho","pernil"];
const OLD={
  i1:[ACO,["ovos","brocolis"],["arroz","feijao","aveia","macarrao"],["cafe","azeite","oleo","amendoim","molho","temperos"],["batata-doce","cenoura","cebola","repolho",...SEM_H],SEM_F,
      ["sabao","amaciante","desinfetante","sanitaria","detergente","multiuso","desengordurante","sanitario","esponjas","papel","lixo","toalha"],["sabonete","pasta","desodorante"]],
  i2:[SEM_H,SEM_F], i3:[ACO,["ovos","brocolis"],SEM_H,SEM_F], i4:[SEM_H,SEM_F]
};
const TAREFAS={
  carne:{t:"Porcionar as carnes em 200 g e 150 g, congelar achatado e anotar a data",idas:["i1","i3"]},
  choc:{t:"Dividir o chocolate em 7 porções para cada pessoa",idas:IDS},
  guardar:{t:"Guardar o hortifrúti e conferir a validade do iogurte",idas:IDS}
};
const UNIDADES=["kg","g","L","ml","unidade","pacote","caixa","garrafa","frasco","lata","barra","sachê","pote","dúzia","maço","bandeja","rolo","kit"];

/* ================= Quantidades ================= */

const SEM_PLURAL=new Set(["kg","g","l","ml","un","un.","cx"]);
const PLURAIS={"pão":"pães","mão":"mãos","grão":"grãos"};
const PARADAS=new Set(["de","do","da","dos","das","com","para","p/","em","sem"]);
function pluralPalavra(w){
  const l=w.toLowerCase();
  if(PLURAIS[l])return PLURAIS[l];
  if(SEM_PLURAL.has(l)||/s$/i.test(w)||/^\d/.test(w))return w;
  if(/ão$/.test(w))return w.slice(0,-2)+"ões";
  if(/[aeiouáéíóúâêô]$/i.test(w))return w+"s";
  if(/[rz]$/i.test(w))return w+"es";
  if(/el$/i.test(w))return w.slice(0,-2)+"éis";
  if(/ol$/i.test(w))return w.slice(0,-2)+"óis";
  if(/l$/i.test(w))return w.slice(0,-1)+"is";
  if(/m$/i.test(w))return w.slice(0,-1)+"ns";
  return w+"s";
}
// "unidade grande" → "unidades grandes"; "pacote de 1 kg" → "pacotes de 1 kg"
function plural(u){
  const p=u.split(" ");
  for(let i=0;i<p.length;i++){if(PARADAS.has(p[i].toLowerCase())||/^\d/.test(p[i]))break;p[i]=pluralPalavra(p[i])}
  return p.join(" ");
}
function passo(it){
  if(it.p)return it.p;
  const u=(it.u||"").toLowerCase();
  if(u==="kg"||u==="l")return .5;
  if(u==="g"||u==="ml")return 50;
  return 1;
}
function qtdNum(it,ida,pessoas){
  const q=it.q&&it.q[ida];
  if(q==null)return null;
  if(it.fixo)return q;
  const p=passo(it);
  return Math.max(p,Math.round(q*pessoas/p)*p);
}
function fmtQtd(v,u){
  if(v==null)return "";
  u=u||"";
  v=Math.round(v*100)/100;
  if(/^g$/i.test(u)&&v>=1000){v/=1000;u="kg"}
  if(/^ml$/i.test(u)&&v>=1000){v/=1000;u="L"}
  v=Math.round(v*100)/100;
  if(!u)return num(v);
  return num(v)+" "+(v<=1?u:plural(u));
}
const qtdTxt=(it,ida,pessoas)=>fmtQtd(qtdNum(it,ida,pessoas),it.u);

/* ================= Estado ================= */

let S={config:null,meses:{}};     // espelho da planilha + alterações ainda não enviadas
let rev=null;                     // revisão da planilha que S reflete
let fila=[];                      // operações ainda não confirmadas pela planilha
let API=ls.get("mercado_api")||"";
let DEV=ls.get("mercado_dev");if(!DEV){DEV=uid();ls.set("mercado_dev",DEV)}
// Cada abertura do app (aba) é uma sessão com numeração própria das operações;
// assim duas abas no mesmo celular não se atrapalham e reenvios são reconhecidos.
const SES=uid();let SEQ=0;
let NOME=ls.get("mercado_nome")||"";
let ver=mesAtual();
try{const v=sessionStorage.getItem("mercado_ver");if(/^\d{4}-\d{2}$/.test(v||""))ver=v}catch(e){}
let filtro=ls.get("mercado_filtro")||"faltam";
let pres=[];                      // outras pessoas com o app aberto agora
const net={enviando:false,baixando:false,online:true,antigo:false,confirmado:false,erro:"",ultima:0,ultimaFull:0,falhas:0,envios:0};
const recentes={};                // itens que acabaram de ser marcados (somem do filtro "Faltam" com atraso)
const flashes={};                 // itens marcados pela outra pessoa (piscam)
const remotos={};                 // quando a outra pessoa marcou cada item
let ultimoToque=0;                // os itens marcados só somem 2,6 s depois do ÚLTIMO toque
const ATRASO=2600;
const saiEm=k=>Math.max(recentes[k]||0,ultimoToque)+ATRASO;
let busca="";                     // texto da busca no modo mercado
let versao=0;                     // muda a cada alteração local

const apiParam=new URLSearchParams(location.search).get("api");
if(apiParam){API=apiParam.trim();ls.set("mercado_api",API);history.replaceState(null,"",location.pathname+location.hash)}

(function carregar(){
  const c=ls.json("mercado3",null);
  if(c&&c.S){S=normalizar(c.S);rev=c.rev??null}
  // adota as filas que ficaram de outras abas/aberturas (cada operação mantém sua numeração)
  try{
    const chaves=[];
    for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k==="mercado3_fila"||k.startsWith("mercado3_fila:"))chaves.push(k)}
    chaves.forEach(k=>{const f=ls.json(k,[]);if(Array.isArray(f))fila.push(...f);localStorage.removeItem(k)});
  }catch(e){}
  fila.forEach(op=>{if(!op.s){op.s="antiga-"+DEV;op.n=++SEQ}}); // fila de versões anteriores do app
  fila.forEach(op=>{S=normalizar(aplicar(S,op))});
})();

function persistir(){
  ls.set("mercado3",JSON.stringify({S,rev}));
  if(fila.length)ls.set("mercado3_fila:"+SES,JSON.stringify(fila));
  else try{localStorage.removeItem("mercado3_fila:"+SES)}catch(e){}
}
// Põe operações na fila de envio, numeradas dentro da sessão
function enfileirar(ops){ops.forEach(op=>{op.s=SES;op.n=++SEQ;fila.push(op)})}
function normalizar(s){
  s=s&&typeof s==="object"?s:{};
  return{config:s.config&&typeof s.config==="object"?s.config:null,meses:s.meses&&typeof s.meses==="object"?s.meses:{}};
}

// Configuração atual, completando o que não existir na planilha com o padrão
function cfg(){
  const c=S.config||{};
  const idas={};
  IDS.forEach(i=>{
    idas[i]=Object.assign({},IDAS0[i],(c.idas||{})[i]||{});
    if(c.est&&c.est[i]!=null&&((c.idas||{})[i]||{}).est==null)idas[i].est=c.est[i]; // versão anterior
  });
  return{pessoas:c.pessoas||BASE,idas,lista:c.lista||LISTA0,temLista:!!c.lista};
}
// Pessoas e valores previstos de um mês (cada mês guarda os da época)
function cfgMes(mes){
  const C=cfg(), m=S.meses[mes];
  const est=Object.fromEntries(IDS.map(i=>[i,C.idas[i].est]));
  if(!m||!m.cfg)return{pessoas:C.pessoas,est};
  return{pessoas:m.cfg.pessoas||C.pessoas,est:Object.assign(est,m.cfg.est||{})};
}
const novoMes=mes=>{const c=cfgMes(mes);return{mes,cfg:{pessoas:c.pessoas,est:c.est},itens:{},notas:{},extras:{},cheg:{}}};
const dadosMes=mes=>Object.assign({itens:{},notas:{},extras:{},cheg:{}},S.meses[mes]||{});
function estadoItem(m,k){
  const v=(m.itens||{})[k];
  if(v==null)return null;
  if(v===1)return{s:"ok"};        // versão anterior
  if(v===2)return{s:"casa"};
  return typeof v==="object"&&v.s?v:null;
}
function itensIda(mes,ida){
  const C=cfg(), mc=cfgMes(mes), m=dadosMes(mes), out=[];
  Object.entries(C.lista).filter(([,it])=>it&&it.q&&ida in it.q).sort((a,b)=>(a[1].o??0)-(b[1].o??0)).forEach(([id,it])=>{
    out.push({k:ida+":"+id,id,n:it.n,sec:it.sec||"Outros",q:qtdTxt(it,ida,mc.pessoas)});
  });
  Object.entries((m.extras||{})[ida]||{}).sort(([a],[b])=>a<b?-1:1).forEach(([id,e])=>{
    if(e&&e.n)out.push({k:ida+":x:"+id,x:id,n:e.n,q:e.q||"",sec:"Extras",por:e.por});
  });
  return out;
}
function resumoIda(mes,ida){
  const m=dadosMes(mes), its=itensIda(mes,ida), r={total:its.length,ok:0,casa:0,falta:0,nada:0};
  its.forEach(i=>{const s=estadoItem(m,i.k);r[s?s.s:"nada"]++});
  r.feitos=r.total-r.nada;
  r.nota=(m.notas||{})[ida];
  r.est=cfgMes(mes).est[ida];
  return r;
}
const gastoMes=mes=>IDS.reduce((s,i)=>s+(dadosMes(mes).notas[i]||0),0);
const estMes=mes=>IDS.reduce((s,i)=>s+(cfgMes(mes).est[i]||0),0);
const temNotas=mes=>IDS.some(i=>dadosMes(mes).notas[i]!=null);
function idaDoMomento(){ // ida mais recente cujo dia já chegou
  if(ver!==mesAtual())return null;
  const C=cfg(), d=new Date().getDate();
  let melhor=null;
  IDS.forEach(i=>{if(C.idas[i].dia<=d&&(!melhor||C.idas[i].dia>=C.idas[melhor].dia))melhor=i});
  return melhor;
}
function proximaIda(mes,ida){
  const C=cfg(), ord=IDS.slice().sort((a,b)=>C.idas[a].dia-C.idas[b].dia), i=ord.indexOf(ida);
  return i<ord.length-1?{mes,ida:ord[i+1]}:{mes:somaMes(mes,1),ida:ord[0]};
}
const nomeIda=(ida)=>{const c=cfg().idas[ida];return`Dia ${c.dia}`};

/* ================= Operações e sincronização ================= */

const set=(path,value)=>({op:"set",path,value});
const del=path=>({op:"del",path});
const ini=(path,value)=>({op:"ini",path,value});

// Mesma lógica do aplicar_() do apps-script/Codigo.gs
function aplicar(s,op){
  const path=op.path||[];
  if(!path.length){
    if(op.op==="del")return undefined;
    if(op.op==="ini")return s===undefined?copia(op.value):s;
    return copia(op.value);
  }
  s=s||{};let o=s;
  for(let i=0;i<path.length-1;i++){const k=path[i];if(typeof o[k]!=="object"||o[k]===null)o[k]={};o=o[k]}
  const ult=path[path.length-1];
  if(op.op==="del")delete o[ult];
  else if(op.op==="ini"){if(o[ult]===undefined)o[ult]=copia(op.value)}
  else o[ult]=copia(op.value);
  return s;
}

function marcasDe(mes){const r={};Object.keys(dadosMes(mes).itens).forEach(k=>{const s=estadoItem(dadosMes(mes),k);if(s)r[k]=s.s});return r}
function notarNovos(antes,mes,remoto){
  const agora=Date.now(), depois=marcasDe(mes);
  Object.keys(depois).forEach(k=>{if(!antes[k]){recentes[k]=agora;if(remoto){flashes[k]=agora;remotos[k]=agora}}});
}

function muda(...ops){
  ops=ops.flat().filter(Boolean);
  if(!ops.length)return;
  const antes=marcasDe(ver);
  versao++;
  ops.forEach(op=>{S=normalizar(aplicar(S,op))});
  enfileirar(ops);
  notarNovos(antes,ver,false);
  persistir();render(true);agendarEnvio(120);
}
// Garante que o mês exista na planilha (com as pessoas e valores do momento) antes de mexer nele
const garanteMes=mes=>S.meses[mes]?[]:[ini(["meses",mes],novoMes(mes))];
const opsMes=(mes,...ops)=>[...garanteMes(mes),...ops];
const garanteLista=()=>cfg().temLista?[]:[ini(["config","lista"],LISTA0)];
// Mudanças de pessoas/valores valem para o mês atual em diante
function opsCfg(campo,ida,valor){
  const ops=[], atual=mesAtual();
  if(campo==="pessoas"){
    ops.push(set(["config","pessoas"],valor));
    Object.keys(S.meses).filter(m=>m>=atual).forEach(m=>ops.push(set(["meses",m,"cfg","pessoas"],valor)));
  }else if(campo==="est"){
    ops.push(set(["config","idas",ida,"est"],valor));
    Object.keys(S.meses).filter(m=>m>=atual).forEach(m=>ops.push(set(["meses",m,"cfg","est",ida],valor)));
  }else ops.push(set(["config","idas",ida,campo],valor));
  return ops;
}

// Converte marcações da versão anterior (chaves por posição) para as chaves novas
function migracoes(){
  const ops=[];
  Object.entries(S.meses).forEach(([mes,m])=>{
    Object.entries((m&&m.itens)||{}).forEach(([k,v])=>{
      let nk=null;
      const a=k.match(/^(i\d)_(\d+)_(\d+)$/), b=k.match(/^(i\d)_x_(.+)$/);
      if(a){const id=(((OLD[a[1]]||[])[+a[2]])||[])[+a[3]];if(id)nk=a[1]+":"+id}
      else if(b)nk=b[1]+":x:"+b[2];
      else if(typeof v==="number")nk=k;
      if(!nk)return;
      const val=v===1?{s:"ok"}:v===2?{s:"casa"}:v;
      if(nk!==k){ops.push(del(["meses",mes,"itens",k]));ops.push(ini(["meses",mes,"itens",nk],val))}
      else ops.push(set(["meses",mes,"itens",nk],val));
    });
  });
  return ops;
}

let tEnvio=null;
function agendarEnvio(ms){clearTimeout(tEnvio);tEnvio=setTimeout(enviar,ms)}

// Busca JSON com tempo limite (inclusive para ler a resposta)
async function fetchJSON(url,opts,ms){
  const ctl=typeof AbortController!=="undefined"?new AbortController():null;
  let t;
  const limite=new Promise((_,rej)=>{t=setTimeout(()=>{if(ctl)ctl.abort();rej(new Error("tempo esgotado"))},ms)});
  try{return await Promise.race([fetch(url,Object.assign({},opts,ctl?{signal:ctl.signal}:{})).then(r=>r.json()),limite])}
  finally{clearTimeout(t)}
}

async function enviar(){
  clearTimeout(tEnvio);
  if(!API||net.enviando||!fila.length)return;
  // Só envia depois de confirmar que a planilha roda o script novo (o antigo entenderia "ini" como "set")
  if(!net.confirmado){
    await baixar(true);
    if(!net.confirmado){if(!net.antigo)agendarEnvio(Math.min(30000,1500*2**Math.min(++net.falhas,5)));return}
  }
  if(net.antigo||net.enviando)return;
  net.enviando=true;renderSync();
  const lote=fila.slice(0,150);
  try{
    // o servidor pode esperar até 25 s pelo lock; o reenvio é seguro (operações numeradas)
    const j=await fetchJSON(API,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({v:3,ops:lote,rev,dev:DEV})},40000);
    if(j.v!==3){net.antigo=true;net.confirmado=false;throw new Error("script antigo")}
    if(!j.ok){net.erroPlanilha=j.erro||"erro na planilha";throw new Error(net.erroPlanilha)}
    net.erroPlanilha="";
    fila=fila.slice(lote.length);
    net.envios++;
    net.online=true;net.falhas=0;net.erro="";net.ultima=Date.now();
    if(j.estado){rev=j.rev;receber(j.estado,false)}
    else{rev=j.rev;persistir()}
  }catch(e){
    net.falhas++;
    if(!net.antigo&&!net.erroPlanilha){net.online=false;net.erro=String(e&&e.message||e)}
  }finally{
    net.enviando=false;renderSync();
  }
  if(fila.length&&!net.antigo){const ms=net.falhas?Math.min(30000,1500*2**Math.min(net.falhas,5)):50;net.proximoEnvio=Date.now()+ms;agendarEnvio(ms)}
}

async function baixar(full){
  if(!API||net.baixando||net.enviando)return;
  net.baixando=true;
  const envios=net.envios;
  try{
    const r=rotaAtual();
    const q=new URLSearchParams({rev:full||rev==null?"":String(rev),dev:DEV,nome:NOME,onde:r.v==="ida"?ver+"/"+r.ida:""});
    const j=await fetchJSON(API+(API.includes("?")?"&":"?")+q,{},15000);
    if(j.v!==3){net.antigo=true;net.confirmado=false;net.online=true;net.erro="";return}
    if(!j.ok)throw new Error(j.erro||"erro na planilha");
    const eraAntigo=net.antigo;
    net.antigo=false;net.confirmado=true;net.online=true;net.falhas=0;net.erro="";net.ultima=Date.now();
    if(full)net.ultimaFull=Date.now();
    const presAntes=JSON.stringify(pres.map(p=>[p.dev,p.onde,p.nome]));
    pres=j.pres||[];
    const mudouPres=presAntes!==JSON.stringify(pres.map(p=>[p.dev,p.onde,p.nome]));
    // a fila é reaplicada por cima, então só é preciso descartar se um envio terminou durante a consulta
    if(j.estado&&envios===net.envios&&!net.enviando){rev=j.rev;receber(j.estado,true)}
    else if(mudouPres)render();
    if(eraAntigo&&fila.length)agendarEnvio(50);
  }catch(e){
    net.online=false;net.erro=String(e&&e.message||e);
  }finally{
    net.baixando=false;renderSync();
  }
}

function receber(estado,remoto){
  const antes=marcasDe(ver), recente=remoto&&net.ultimaRecebida&&Date.now()-net.ultimaRecebida<30000;
  net.ultimaRecebida=Date.now();
  let s=normalizar(estado);
  fila.forEach(op=>{s=normalizar(aplicar(s,op))}); // o que ainda não subiu continua valendo
  S=s;
  if(recente)notarNovos(antes,ver,true);
  const mig=migracoes();
  if(mig.length){mig.forEach(op=>{S=normalizar(aplicar(S,op))});enfileirar(mig);agendarEnvio(50)}
  persistir();render();
}

// Consulta a planilha: a cada 3 s no modo mercado, a cada 12 s nas outras telas
let tLoop=null;
function loop(){
  clearTimeout(tLoop);
  if(document.hidden||!API)return;
  const ms=net.antigo?30000:rotaAtual().v==="ida"?3000:12000;
  tLoop=setTimeout(async()=>{
    if(fila.length&&!(net.proximoEnvio>Date.now()))await enviar();
    else await baixar(Date.now()-net.ultimaFull>120000);
    loop();
  },ms);
}
function sincronizarJa(){if(fila.length)enviar();else baixar(true);loop()}

/* ================= Rotas ================= */

function rotaAtual(){
  const [a,b]=location.hash.replace(/^#\/?/,"").split("/");
  if(a==="ida"&&IDS.includes(b))return{v:"ida",ida:b};
  if(a==="historico")return{v:"hist"};
  if(a==="ajustes")return{v:"ajustes"};
  if(a==="lista")return{v:"lista"};
  return{v:"compras"};
}
let navegouNoApp=false;
function ir(hash){navegouNoApp=true;location.hash=hash}
function voltar(padrao){if(navegouNoApp&&history.length>1)history.back();else location.replace(padrao||"#/")}
function setVer(m){ver=m;try{sessionStorage.setItem("mercado_ver",m)}catch(e){}}

/* ================= Renderização ================= */

let renderPendente=false, tocando=false;
// Redesenhos "de fundo" (sincronização, timers) esperam o dedo sair da tela e a digitação acabar;
// os causados por um toque da própria pessoa (render(true)) são imediatos.
function render(forcar){
  const main=$("main"), ae=document.activeElement;
  if(ae&&main.contains(ae)&&/^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName)&&!(forcar&&ae.id==="busca")){renderPendente=true;renderSync();return}
  if(tocando&&!forcar){renderPendente=true;return}
  renderPendente=false;
  const foco=ae&&main.contains(ae)?{k:ae.dataset.k,act:ae.dataset.act,f:ae.dataset.f}:null;
  const r=rotaAtual();
  document.querySelector(".app").classList.toggle("modo-ida",r.v==="ida");
  const tab={compras:"compras",ida:"compras",hist:"historico",ajustes:"ajustes",lista:"ajustes"}[r.v];
  document.querySelectorAll("#tabbar a").forEach(a=>{if(a.dataset.tab===tab)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current")});
  main.innerHTML=r.v==="ida"?telaIda(r.ida):r.v==="hist"?telaHistorico():r.v==="ajustes"?telaAjustes():r.v==="lista"?telaLista():telaCompras();
  document.title=r.v==="ida"?`${nomeIda(r.ida)} · Mercado`:"Mercado do mês";
  if(ae&&ae.id==="busca"&&$("busca")){const b=$("busca");b.focus({preventScroll:true});try{b.setSelectionRange(b.value.length,b.value.length)}catch(e){}}
  else if(foco&&foco.act){ // devolve o foco ao mesmo botão (teclado / leitor de tela)
    const alvo=[...main.querySelectorAll(`[data-act="${foco.act}"]`)].find(x=>x.dataset.k===foco.k&&x.dataset.f===foco.f);
    if(alvo)alvo.focus({preventScroll:true});
  }
  renderSync();
  if(r.v==="ida"){aplicarBusca();agendarSaida()}
}
document.addEventListener("pointerdown",e=>{if(e.pointerType!=="mouse")tocando=true},{passive:true,capture:true});
const soltarToque=()=>{if(!tocando)return;setTimeout(()=>{tocando=false;if(renderPendente)render()},120)};
document.addEventListener("pointerup",soltarToque,{passive:true,capture:true});
document.addEventListener("pointercancel",soltarToque,{passive:true,capture:true});
document.addEventListener("focusout",()=>setTimeout(()=>{if(renderPendente)render()},0));

function statusSync(){
  if(!API)return{c:"",t:"Só neste aparelho"};
  if(net.antigo)return{c:"off",t:"Atualize o script"};
  if(net.erroPlanilha&&fila.length)return{c:"off",t:"Erro na planilha"};
  if(fila.length&&!net.online)return{c:"off",t:`Offline · ${fila.length} pendente${fila.length>1?"s":""}`};
  if(fila.length||net.enviando)return{c:"envio",t:"Salvando…"};
  if(!net.online)return{c:"off",t:"Offline"};
  if(!net.ultima)return{c:"envio",t:"Conectando…"};
  return{c:"ok",t:"Salvo"};
}
const pillSync=()=>{const s=statusSync();return`<button class="sync ${s.c}" data-act="sync" id="syncpill" aria-label="Sincronização: ${esc(s.t)}"><i></i><span>${esc(s.t)}</span></button>`};
function renderSync(){
  const el=$("syncpill");if(!el)return;
  const s=statusSync();el.className="sync "+s.c;el.querySelector("span").textContent=s.t;el.setAttribute("aria-label","Sincronização: "+s.t);
}
function banners(){
  if(!API)return`<div class="banner">${SVG.alerta}<div><b>Conecte a planilha</b>Por enquanto tudo fica só neste aparelho. Conecte o Google Planilhas para salvar e usar em dupla.<br><button class="btn small" data-act="api">Conectar planilha</button></div></div>`;
  if(net.antigo)return`<div class="banner err">${SVG.alerta}<div><b>O script da planilha precisa ser atualizado</b>Suas marcações ficam guardadas neste aparelho e sobem assim que o script novo for publicado. Veja o passo a passo no README do projeto.</div></div>`;
  return"";
}
const presNome=p=>p.nome||"Outra pessoa";
function unicos(lista){
  const vistos=new Set();
  return lista.filter(p=>{const n=presNome(p).toLowerCase();if((NOME&&n===NOME.toLowerCase())||vistos.has(n))return false;vistos.add(n);return true});
}
const presEm=(mes,ida)=>unicos(pres.filter(p=>p.onde===mes+"/"+ida));

/* ---------- Tela: Compras (o mês) ---------- */
function limitesMes(){
  const ms=Object.keys(S.meses).sort(), at=mesAtual();
  const min=[ms[0]||at,at].sort()[0], max=[ms[ms.length-1]||at,somaMes(at,1)].sort()[1];
  return{min,max};
}
function telaCompras(){
  const C=cfg(), mc=cfgMes(ver), gasto=gastoMes(ver), est=estMes(ver), lim=limitesMes(), agora=idaDoMomento();
  const pct=est?Math.min(100,gasto/est*100):0, acima=gasto>est;
  const ord=IDS.slice().sort((a,b)=>C.idas[a].dia-C.idas[b].dia);
  const cards=ord.map(ida=>{
    const r=resumoIda(ver,ida), c=C.idas[ida], feita=r.nota!=null, p=presEm(ver,ida);
    let det,dir="";
    if(feita){
      const d=r.nota-r.est;
      det=`${r.feitos} de ${r.total} itens`;
      dir=`<div class="valor"><b>${brl(r.nota)}</b><small class="${d>0?"bad":"good"}">${d>0?brl(d)+" acima":d<0?brl(-d)+" abaixo":"no previsto"}</small></div>`;
    }else if(r.feitos)det=`${r.feitos} de ${r.total} itens · previsto ${brl(r.est)}`;
    else det=`${r.total} itens · previsto ${brl(r.est)}`;
    const bar=!feita&&r.feitos?`<div class="mini"><i style="width:${r.feitos/r.total*100}%"></i></div>`:"";
    const chips=(agora===ida&&!feita?` <span class="chip good">Agora</span>`:"")+p.map(x=>` <span class="pres"><i></i>${esc(presNome(x))} está aqui</span>`).join("");
    return`<a class="ida${feita?" feita":""}${agora===ida&&!feita?" agora":""}" href="#/ida/${ida}">
      <div class="dia"><small>Dia</small><b>${c.dia}</b></div>
      <div class="info"><div class="nome">${esc(c.nome)}${chips}</div><div class="det">${det}</div>${bar}</div>
      ${dir||SVG.frente.replace("<svg ",'<svg class="seta" ')}</a>`;
  }).join("");
  const lancadas=IDS.filter(i=>dadosMes(ver).notas[i]!=null), faltamIdas=4-lancadas.length;
  const estLanc=lancadas.reduce((s2,i)=>s2+mc.est[i],0), difLanc=gasto-estLanc;
  const chip=!gasto?`<span class="chip">Lance o valor ao finalizar cada ida</span>`:acima?`<span class="chip bad">${SVG.cima}${brl(gasto-est)} acima</span>`:`<span class="chip good">${SVG.check}Sobram ${brl(est-gasto)}</span>`;
  const parcial=lancadas.length&&faltamIdas?`<div class="linha"><span>${lancadas.length===1?"Na ida lançada":`Nas ${lancadas.length} idas lançadas`}: ${brl(gasto)} de ${brl(estLanc)}</span>${difLanc>0?`<span class="chip bad">${SVG.cima}${brl(difLanc)} acima</span>`:difLanc<0?`<span class="chip good">${brl(-difLanc)} abaixo</span>`:`<span class="chip good">no previsto</span>`}</div>`:"";
  return`
  <div class="top"><span class="eyebrow">Mercado do mês</span>${pillSync()}</div>
  <div class="monthnav">
    <button class="icobtn" data-act="mes" data-d="-1" aria-label="Mês anterior" ${ver<=lim.min?"disabled":""}>${SVG.voltar}</button>
    <h1>${cap(mesNome(ver))}</h1>
    <button class="icobtn" data-act="mes" data-d="1" aria-label="Próximo mês" ${ver>=lim.max?"disabled":""}>${SVG.frente}</button>
  </div>
  ${banners()}
  <section class="card resumo" aria-label="Resumo do mês">
    <div class="lbl">Gasto no mês</div>
    <div class="pricetag"><b>${brl(gasto)}</b></div>
    <div class="meter${acima?" over":""}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}" aria-label="Gasto em relação ao previsto"><i style="width:${pct}%"></i></div>
    <div class="linha"><span>de ${brl(est)} previstos no mês</span>${chip}</div>
    ${parcial}
  </section>
  <h2 class="secao-t">Idas ao mercado <small>${mc.pessoas} ${mc.pessoas===1?"pessoa":"pessoas"}</small></h2>
  <div class="idas">${cards}</div>
  ${ver!==mesAtual()?`<p class="rodape"><button class="linkbtn" data-act="hoje">Ir para ${mesNome(mesAtual())}</button></p>`:""}`;
}

/* ---------- Tela: uma ida (modo mercado) ---------- */
let tSaida=null;
function agendarSaida(){
  clearTimeout(tSaida);
  const agora=Date.now();let prox=Infinity;
  Object.keys(recentes).forEach(k=>{const f=saiEm(k)-agora;if(f<=0)delete recentes[k];else prox=Math.min(prox,f)});
  Object.entries(flashes).forEach(([k,t])=>{if(agora-t>1500)delete flashes[k]});
  if(prox<Infinity)tSaida=setTimeout(render,prox+30);
}
let buscaAberta=false;
const semAcento=t=>t.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
// Filtra as linhas já desenhadas (sem redesenhar, para não atrapalhar a digitação)
function aplicarBusca(){
  if(!buscaAberta)return;
  const q=semAcento(busca.trim());
  let algum=false;
  document.querySelectorAll("#main .secs .sec").forEach(sec=>{
    let n=0;
    sec.querySelectorAll(".it[data-k]").forEach(li=>{const ok=!q||semAcento(li.querySelector(".it-n").textContent).includes(q);li.hidden=!ok;if(ok)n++});
    sec.hidden=!n&&!sec.querySelector(".addrow");
    if(n)algum=true;
  });
  const v=$("semres");if(v)v.hidden=algum||!q;
}
function telaIda(ida){
  const C=cfg(), c=C.idas[ida], mc=cfgMes(ver), m=dadosMes(ver), r=resumoIda(ver,ida), its=itensIda(ver,ida), agora=Date.now();
  const outros=presEm(ver,ida);
  const grupos=new Map();
  its.forEach(i=>{if(!grupos.has(i.sec))grupos.set(i.sec,[]);grupos.get(i.sec).push(i)});
  const visivel=i=>{
    const s=estadoItem(m,i.k);
    if(filtro==="todos"||buscaAberta)return true;
    if(filtro==="carrinho")return s&&s.s==="ok";
    return !s||(recentes[i.k]&&agora<saiEm(i.k));
  };
  const linha=i=>{
    const s=estadoItem(m,i.k), st=s?s.s:"";
    const ic=st==="casa"?SVG.casa:st==="falta"?SVG.x:SVG.check;
    let tag="";
    if(st==="casa")tag=`<span class="it-tag">em casa</span>`;
    else if(st==="falta")tag=`<span class="it-tag">não achei</span>`;
    else if(st==="ok"&&s.por&&s.por!==NOME)tag=`<span class="it-tag por">${esc(s.por)}</span>`;
    const cls=["it"];
    if(st)cls.push("s-"+st);
    if(filtro==="faltam"&&st)cls.push("saindo");
    if(flashes[i.k]&&agora-flashes[i.k]<1500)cls.push("flash");
    const rotulo=st==="ok"?"No carrinho":st==="casa"?"Tem em casa":st==="falta"?"Não achou":"Falta pegar";
    return`<li class="${cls.join(" ")}" data-k="${esc(i.k)}">
      <button class="it-main" data-act="tog" data-k="${esc(i.k)}" aria-label="${esc(i.n)}${i.q?", "+esc(i.q):""}. ${rotulo}">
        <span class="chk" aria-hidden="true">${ic}</span>
        <span class="it-txt"><span class="it-n">${esc(i.n)}</span>${i.q?`<span class="it-q">${esc(i.q)}</span>`:""}</span>${tag}
      </button>
      <button class="it-more" data-act="item" data-k="${esc(i.k)}" aria-label="Mais opções: ${esc(i.n)}">${SVG.mais}</button></li>`;
  };
  let html="";
  grupos.forEach((arr,sec)=>{
    if(sec==="Extras")return;
    const vis=arr.filter(visivel);
    if(!vis.length)return;
    const feitos=arr.filter(i=>estadoItem(m,i.k)).length;
    html+=`<section class="sec"><h3>${esc(sec)}<small><span class="sr">resolvidos: </span>${feitos}/${arr.length}</small></h3><ul class="its">${vis.map(linha).join("")}</ul></section>`;
  });
  const ex=grupos.get("Extras")||[], exVis=ex.filter(visivel);
  const addBtn=filtro!=="carrinho"?`<button class="addrow" data-act="extra">${SVG.plus}Adicionar item fora da lista</button>`:"";
  if(exVis.length||addBtn)html+=`<section class="sec"><h3>Extras<small>${ex.length?ex.filter(i=>estadoItem(m,i.k)).length+"/"+ex.length:"só nesta compra"}</small></h3>${exVis.length?`<ul class="its">${exVis.map(linha).join("")}</ul>`:""}${addBtn}</section>`;
  const nadaVisivel=!its.some(visivel);
  let vazio="";
  if(nadaVisivel&&filtro==="faltam")vazio=`<div class="card vazio"><b>Tudo resolvido 🎉</b>${r.nota==null?`Agora é só lançar o valor que deu no caixa.<br><button class="btn" data-act="finalizar" style="margin-top:12px">Lançar valor</button>`:"Valor lançado: "+brl(r.nota)}</div>`;
  if(nadaVisivel&&filtro==="carrinho")vazio=`<div class="card vazio"><b>Carrinho vazio</b>Toque num item da lista quando colocar no carrinho.</div>`;
  const tarefas=Object.entries(TAREFAS).filter(([,t])=>t.idas.includes(ida));
  const tarefasHtml=filtro!=="carrinho"?`<section class="sec tarefas"><h3>Ao chegar em casa<small>${tarefas.filter(([k])=>m.cheg[ida+"_"+k]).length}/${tarefas.length}</small></h3><ul class="its">${tarefas.map(([k,t])=>{const on=!!m.cheg[ida+"_"+k];
    return`<li class="it${on?" s-ok":""}"><button class="it-main" data-act="tarefa" data-t="${k}" aria-pressed="${on}"><span class="chk" aria-hidden="true">${SVG.check}</span><span class="it-txt"><span class="it-n">${esc(t.t)}</span></span></button></li>`}).join("")}</ul></section>`:"";
  const cont=k=>{if(k==="faltam")return r.nada;if(k==="carrinho")return r.ok;return r.total};
  const segBtn=(k,t)=>`<button data-act="filtro" data-f="${k}" aria-pressed="${filtro===k}">${t} <b>${cont(k)}</b></button>`;
  const d=r.nota!=null?r.nota-r.est:0;
  return`
  <header class="idahead">
    <div class="row1">
      <button class="icobtn" data-act="voltar" aria-label="Voltar para o mês">${SVG.voltar}</button>
      <div class="ttl"><h1>Dia ${c.dia} · ${esc(c.nome)}</h1><small>${cap(mesNome(ver))}${outros.length?` · <span class="pres"><i></i>com ${esc(outros.map(presNome).join(" e "))}</span>`:` · ${mc.pessoas} ${mc.pessoas===1?"pessoa":"pessoas"}`}</small></div>
      <button class="icobtn" data-act="buscar" aria-label="Buscar item" aria-expanded="${busca!==null&&buscaAberta}">${SVG.lupa}</button>
      ${pillSync()}
    </div>
    <div class="prog"><div class="meter" role="progressbar" aria-label="Itens resolvidos" aria-valuemin="0" aria-valuemax="${r.total}" aria-valuenow="${r.feitos}"><i style="width:${r.total?r.feitos/r.total*100:0}%"></i></div><span>${r.feitos} de ${r.total}</span></div>
    ${buscaAberta?`<div class="buscarow"><input class="inp" id="busca" type="search" placeholder="Buscar na lista" autocomplete="off" enterkeyhint="search" value="${esc(busca)}" aria-label="Buscar item"><button class="linkbtn" data-act="fecharbusca">Fechar</button></div>`
      :`<div class="seg" role="group" aria-label="Mostrar">${segBtn("faltam","Faltam")}${segBtn("carrinho","Carrinho")}${segBtn("todos","Todos")}</div>`}
  </header>
  ${net.antigo?banners():""}
  ${buscaAberta?`<div class="card vazio" id="semres" hidden><b>Nada encontrado</b>Use “Adicionar item fora da lista” para incluir.</div>`:vazio}
  <div class="secs">${html}</div>
  ${buscaAberta?"":tarefasHtml}
  <div class="actionbar"><div class="in">
    <div class="tot">${r.nota!=null?`<small>Pago no caixa</small><b>${brl(r.nota)}</b> <span class="chip ${d>0?"bad":"good"}">${d>0?brl(d)+" acima":d<0?brl(-d)+" abaixo":"no previsto"}</span>`:`<small>Previsto</small><b>${brl(r.est)}</b>`}</div>
    <button class="btn" data-act="finalizar">${r.nota!=null?"Editar valor":"Finalizar compra"}</button>
  </div></div>`;
}

/* ---------- Tela: Histórico ---------- */
let histSel=null;
function telaHistorico(){
  const C=cfg(), atual=mesAtual();
  const meses=[...new Set([...Object.keys(S.meses),atual])].filter(m=>temNotas(m)||m===atual).sort();
  const completo=m=>IDS.every(i=>dadosMes(m).notas[i]!=null);
  const passados=meses.filter(m=>m<atual&&completo(m));
  const comNotas=meses.filter(m=>m<atual&&temNotas(m));
  const ult3=passados.slice(-3);
  const media=ult3.length?ult3.reduce((s,m)=>s+gastoMes(m),0)/ult3.length:null;
  const estAtual=IDS.reduce((s,i)=>s+C.idas[i].est,0);
  const dentro=passados.filter(m=>gastoMes(m)<=estMes(m)).length;
  const gAt=gastoMes(atual), eAt=estMes(atual);
  const stat=(l,v,d)=>`<div class="stat"><div class="l">${l}</div><div class="v">${v}</div><div class="d">${d}</div></div>`;
  const stats=`<div class="stats">
    ${stat("Este mês",brl(gAt),gAt>eAt?`<span class="chip bad">${SVG.cima}${brl(gAt-eAt)} acima</span>`:`<span class="chip">de ${brl(eAt)}</span>`)}
    ${stat(`Média ${ult3.length>1?"dos últimos "+ult3.length+" meses":"mensal"}`,media==null?"—":brl(media),media==null?`<span class="chip">sem meses anteriores</span>`:media>estAtual?`<span class="chip bad">${SVG.cima}${brl(media-estAtual)} acima</span>`:`<span class="chip good">${SVG.check}dentro do previsto</span>`)}
    ${stat("Previsto por mês",brl(estAtual),`<span class="chip">${C.pessoas} ${C.pessoas===1?"pessoa":"pessoas"}</span>`)}
    ${stat("Dentro do previsto",passados.length?`${dentro} de ${passados.length}`:"—",`<span class="chip">meses completos</span>`)}
  </div>`;
  if(!meses.some(temNotas))return`
    <div class="top"><h1 class="title">Histórico</h1>${pillSync()}</div>
    ${stats}
    <div class="card vazio"><b>Ainda não há valores lançados</b>Ao finalizar cada compra, lance o valor que deu no caixa. Aqui você acompanha mês a mês se está dentro do previsto.</div>`;

  // Gráfico: gasto (barras) x previsto (traço), últimos 12 meses
  const ult=meses.slice(-12);
  if(!histSel||!ult.includes(histSel))histSel=ult[ult.length-1];
  const W=Math.round(Math.min(760,Math.max(280,(($("main").clientWidth||390)-(innerWidth>=700?48:32))-32))),H=220,PL=42,PR=6,PT=12,PB=28, cw=W-PL-PR, ch=H-PT-PB;
  const vmax=Math.max(1,...ult.map(m=>Math.max(gastoMes(m),estMes(m))));
  const passos=[50,100,200,250,500,1000,2000,2500,5000,10000,20000];
  const st=passos.find(p=>vmax/p<=4)||Math.ceil(vmax/4);
  const top=Math.ceil(vmax/st)*st, y=v=>PT+ch-(v/top)*ch;
  const slot=cw/Math.max(ult.length,1), bw=Math.min(24,slot*.55);
  let g="";
  for(let v=0;v<=top+1e-6;v+=st)g+=`<line class="grid" x1="${PL}" x2="${W-PR}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${PL-8}" y="${y(v)+4}" text-anchor="end">${v>=1000?num(v/1000)+" mil":num(v)}</text>`;
  ult.forEach((m,i)=>{
    const cx=PL+slot*i+slot/2, gv=gastoMes(m), ev=estMes(m), yb=y(gv), h=Math.max(0,PT+ch-yb), rr=Math.min(4,h);
    const path=h>0?`M${cx-bw/2},${PT+ch}V${yb+rr}Q${cx-bw/2},${yb} ${cx-bw/2+rr},${yb}H${cx+bw/2-rr}Q${cx+bw/2},${yb} ${cx+bw/2},${yb+rr}V${PT+ch}Z`:"";
    g+=`<path class="bar${m===histSel?" sel":""}" d="${path}"/>`;
    g+=`<line class="alvo" x1="${cx-bw/2-6}" x2="${cx+bw/2+6}" y1="${y(ev)}" y2="${y(ev)}"/>`;
    const lbl=slot<34&&i%2&&i!==ult.length-1?"":mesCurto(m)+(i===0||m.endsWith("-01")?"/"+m.slice(2,4):"");
    g+=`<text class="axis" x="${cx}" y="${H-8}" text-anchor="middle">${lbl}</text>`;
    g+=`<rect class="hit" x="${PL+slot*i}" y="${PT}" width="${slot}" height="${ch}" tabindex="0" role="button" data-act="histsel" data-m="${m}" aria-label="${mesNome(m)}: gasto ${brl(gv)}, previsto ${brl(ev)}"/>`;
  });
  const sg=gastoMes(histSel), se=estMes(histSel), sd=sg-se;
  const grafico=`<section class="card">
    <h2>Gasto x previsto</h2>
    <div class="legend"><span><i class="sw"></i>Gasto</span><span><i class="ln"></i>Previsto</span></div>
    <div class="chart"><svg viewBox="0 0 ${W} ${H}" role="group" aria-label="Gráfico de gasto e previsto por mês. Toque numa barra para ver o mês.">${g}</svg></div>
    <div class="tip"><b>${cap(mesNome(histSel))}</b>${histSel===atual&&!completo(histSel)?" (em andamento)":""} · gasto ${brl(sg)} de ${brl(se)} previstos ${sg&&(sd>0||completo(histSel))?`<span class="chip ${sd>0?"bad":"good"}">${sd>0?brl(sd)+" acima":brl(-sd)+" abaixo"}</span>`:""}</div>
  </section>`;

  // Sugestões de ajuste por ida (média dos últimos 3 meses com valor lançado)
  const sugs=IDS.slice().sort((a,b)=>C.idas[a].dia-C.idas[b].dia).map(ida=>{
    const vals=comNotas.map(m=>dadosMes(m).notas[ida]).filter(v=>v!=null).slice(-3);
    const e=C.idas[ida].est;
    if(vals.length<2)return`<div class="sug"><div class="t">Dia ${C.idas[ida].dia} · ${esc(C.idas[ida].nome)}<small>Previsto ${brl(e)} · precisa de 2 meses com valor lançado</small></div></div>`;
    const md=Math.round(vals.reduce((s,v)=>s+v,0)/vals.length), dif=md-e, novo=Math.round(md/5)*5;
    const ok=Math.abs(dif)<=Math.max(10,e*.05);
    return`<div class="sug"><div class="t">Dia ${C.idas[ida].dia} · ${esc(C.idas[ida].nome)}<small>Previsto ${brl(e)} · média real ${brl(md)} (${vals.length} meses)</small></div>
      ${ok?`<span class="chip good">${SVG.check}Em dia</span>`:`<button class="btn small soft" data-act="usarmedia" data-ida="${ida}" data-v="${novo}">Usar ${brl(novo)}</button>`}</div>`;
  }).join("");

  const linhas=meses.slice().reverse().map(m=>{
    const gv=gastoMes(m), ev=estMes(m), d=gv-ev, n=IDS.filter(i=>dadosMes(m).notas[i]!=null).length;
    return`<tr data-act="abrirmes" data-mes="${m}" tabindex="0" role="link" aria-label="Abrir ${mesNome(m)}"><td class="mes">${cap(mesNome(m))}<small>${cfgMes(m).pessoas} ${cfgMes(m).pessoas===1?"pessoa":"pessoas"} · ${n} de 4 compras</small></td>
      <td class="n">${brl(gv)}<small>de ${brl(ev)}</small></td><td class="n">${gv?`<span class="chip ${d>0?"bad":"good"}">${d>0?"+":"−"}${brl(Math.abs(d))}</span>`:"—"}</td></tr>`;
  }).join("");

  return`
  <div class="top"><h1 class="title">Histórico</h1>${pillSync()}</div>
  ${stats}
  ${grafico}
  <section class="card"><h2>Ajustar valores previstos</h2><p class="sub">Compara o previsto de cada ida com a média do que vocês realmente gastaram.</p>${sugs}</section>
  <section class="card"><h2>Mês a mês</h2><p class="sub">Toque num mês para abrir.</p>
    <div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Mês</th><th class="n">Gasto</th><th class="n">Diferença</th></tr></thead><tbody>${linhas}</tbody></table></div>
  </section>`;
}

/* ---------- Tela: Ajustes ---------- */
function telaAjustes(){
  const C=cfg(), ord=IDS.slice().sort((a,b)=>C.idas[a].dia-C.idas[b].dia);
  const nItens=Object.values(C.lista).filter(Boolean).length, nSec=new Set(Object.values(C.lista).filter(Boolean).map(i=>i.sec)).size;
  const idas=ord.map(ida=>{const c=C.idas[ida];return`
    <div class="idacfg">
      <div class="g">
        <div><label for="dia-${ida}">Dia</label><input class="inp" id="dia-${ida}" type="number" min="1" max="31" inputmode="numeric" value="${c.dia}" data-cfg="dia" data-ida="${ida}"></div>
        <div><label for="nome-${ida}">Nome</label><input class="inp" id="nome-${ida}" value="${esc(c.nome)}" data-cfg="nome" data-ida="${ida}" maxlength="40"></div>
        <div class="full"><label for="est-${ida}">Valor previsto</label><div class="money"><input class="inp" id="est-${ida}" inputmode="decimal" value="${brlEdit(c.est)}" data-cfg="est" data-ida="${ida}"></div></div>
      </div>
    </div>`}).join("");
  const s=statusSync();
  return`
  <div class="top"><h1 class="title">Ajustes</h1>${pillSync()}</div>
  ${banners()}
  <section class="card">
    <div class="cfg-row">
      <div class="t">Pessoas na casa<small>As quantidades da lista se ajustam sozinhas</small></div>
      <div class="stepper">
        <button data-act="pessoas" data-d="-1" aria-label="Menos uma pessoa" ${C.pessoas<=1?"disabled":""}>−</button>
        <output aria-live="polite">${C.pessoas}</output>
        <button data-act="pessoas" data-d="1" aria-label="Mais uma pessoa" ${C.pessoas>=20?"disabled":""}>+</button>
      </div>
    </div>
  </section>
  <section class="card">
    <h2>Idas ao mercado</h2>
    <p class="sub">Dia do mês, nome e quanto vocês esperam gastar em cada ida.</p>
    ${idas}
    <div class="total"><span>Total previsto no mês</span><b>${brl(IDS.reduce((s,i)=>s+C.idas[i].est,0))}</b></div>
  </section>
  <section class="card">
    <a class="navrow" href="#/lista"><div class="t"><b>Lista de compras</b><small>${nItens} itens em ${nSec} seções · editar itens e quantidades</small></div>${SVG.frente}</a>
  </section>
  <section class="card">
    <label class="fld" style="margin:0"><span>Seu nome <small>neste aparelho</small></span><input class="inp" id="meunome" value="${esc(NOME)}" placeholder="Ex.: Leo" maxlength="30" autocomplete="given-name"></label>
    <p class="hint">Aparece para a outra pessoa quando você marca um item.</p>
  </section>
  <section class="card">
    <h2>Google Planilhas</h2>
    <p class="sub">${API?`Status: <b>${esc(s.t)}</b>${net.ultima?` · última sincronização às ${hora(net.ultima)}`:""}`:"Não conectado. Tudo fica só neste aparelho."}</p>
    <div class="btns" style="margin-top:0">${API?`<button class="btn ghost" data-act="syncja">Sincronizar</button>`:""}<button class="btn ${API?"ghost":""}" data-act="api">${API?"Trocar planilha":"Conectar planilha"}</button></div>
    ${API?`<button class="btn soft block" data-act="convidar" style="margin-top:10px">Convidar outra pessoa</button><p class="hint">Manda um link que já conecta o celular da outra pessoa nesta planilha. Quem tiver o link pode ver e mudar a lista.</p>`:""}
  </section>
  <p class="rodape">Pessoas e valores valem para ${mesNome(mesAtual())} em diante. Meses anteriores guardam os valores da época.</p>`;
}

/* ---------- Tela: editor da lista ---------- */
function telaLista(){
  const C=cfg();
  const its=Object.entries(C.lista).filter(([,i])=>i).sort((a,b)=>(a[1].o??0)-(b[1].o??0));
  const grupos=new Map();
  its.forEach(([id,it])=>{const s=it.sec||"Outros";if(!grupos.has(s))grupos.set(s,[]);grupos.get(s).push([id,it])});
  const ord=IDS.slice().sort((a,b)=>C.idas[a].dia-C.idas[b].dia);
  let html="";
  grupos.forEach((arr,sec)=>{
    html+=`<section class="sec"><h3>${esc(sec)}<small>${arr.length} ${arr.length===1?"item":"itens"}</small></h3><ul class="its">${arr.map(([id,it])=>{
      const q=ord.filter(i=>it.q&&i in it.q).map(i=>{const t=qtdTxt(it,i,C.pessoas);return`Dia ${C.idas[i].dia}${t?": "+t:""}`}).join(" · ")||"Fora de todas as idas";
      return`<li class="it edit-it"><button class="it-main" data-act="editar" data-id="${esc(id)}"><span class="it-txt"><span class="it-n">${esc(it.n)}${it.fixo?' <span class="chip">fixo</span>':""}</span><span class="it-q">${esc(q)}</span></span><svg class="seta" viewBox="0 0 24 24" style="width:20px;height:20px;fill:none;stroke:var(--muted);stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round"><path d="M9 5l7 7-7 7"/></svg></button></li>`;
    }).join("")}</ul></section>`;
  });
  return`
  <div class="top"><div style="display:flex;align-items:center;gap:4px"><button class="icobtn" data-act="voltar" data-padrao="#/ajustes" aria-label="Voltar para ajustes">${SVG.voltar}</button><h1 class="title">Lista de compras</h1></div>${pillSync()}</div>
  <p class="sub" style="color:var(--muted);margin:0 0 14px">Quantidades para ${C.pessoas} ${C.pessoas===1?"pessoa":"pessoas"}. Itens fixos não mudam com o número de pessoas.</p>
  <button class="btn block" data-act="novoitem" style="margin-bottom:14px">${SVG.plus}Novo item</button>
  <div class="secs">${html||`<div class="card vazio"><b>Lista vazia</b>Adicione o primeiro item.</div>`}</div>`;
}

/* ================= Folha inferior e avisos ================= */

let sheetCtx=null, ajuste=null;
function abrirSheet(html,ctx,foco){
  const d=$("sheet");
  $("sheet-body").innerHTML=`<button class="sheet-x" data-act="fechar" aria-label="Fechar">${SVG.x}</button>`+html;
  sheetCtx=ctx||{};
  if(!d.open){try{d.showModal()}catch(e){d.setAttribute("open","")}}
  const f=foco&&$(foco);
  if(f)setTimeout(()=>{f.focus();if(f.select)f.select()},60);
}
function fecharSheet(){const d=$("sheet");if(d.open){try{d.close()}catch(e){d.removeAttribute("open")}}sheetCtx=null}
$("sheet").addEventListener("click",e=>{if(e.target===$("sheet"))fecharSheet()});
$("sheet").addEventListener("close",()=>{sheetCtx=null;if(renderPendente)render()});

let tToast=null,toastAcao=null;
function toast(msg,acao,fn,ms){
  const t=$("toast");clearTimeout(tToast);
  toastAcao=fn||null;
  t.innerHTML=`<span>${esc(msg)}</span>${acao?`<button data-act="toast">${esc(acao)}</button>`:""}`;
  t.hidden=false;
  tToast=setTimeout(()=>{t.hidden=true;toastAcao=null},ms||(acao?5000:2600));
}

function sheetItem(k){
  const [ida]=k.split(":"), it=itensIda(ver,ida).find(i=>i.k===k);
  if(!it)return;
  const s=estadoItem(dadosMes(ver),k), st=s?s.s:"";
  const op=(v,ic,cls,t,sub)=>`<button class="acao" data-act="st" data-s="${v}" aria-pressed="${st===v}"><span class="ic ${cls}">${ic}</span><span>${t}<small>${sub}</small></span></button>`;
  abrirSheet(`
    <h2 id="sheet-title">${esc(it.n)}</h2>
    <p class="sub">${esc([it.q,it.sec].filter(Boolean).join(" · "))}${s&&s.por?` · marcado por ${esc(s.por)}${s.t?" às "+hora(s.t):""}`:""}</p>
    <div class="acoes">
      ${op("ok",SVG.check,"ok","Peguei","Está no carrinho")}
      ${op("casa",SVG.casa,"casa","Tenho em casa","Não precisa comprar desta vez")}
      ${op("falta",SVG.x,"falta","Não achei","Faltou no mercado")}
      ${st?op("",SVG.undo,"limpa","Desmarcar","Volta para a lista do que falta"):""}
      ${it.x?`<button class="acao" data-act="rmextra"><span class="ic falta">${SVG.lixo}</span><span>Remover item<small>Tira este extra da compra</small></span></button>`:""}
    </div>`,{tipo:"item",k,x:it.x,ida});
}

// Itens que ficaram de fora (sem marcar ou "não achei") e ainda não estão na próxima ida
function pendentesParaLevar(ida){
  const m=dadosMes(ver), prox=proximaIda(ver,ida);
  const ja=new Set(itensIda(prox.mes,prox.ida).map(i=>semAcento(i.n)));
  return itensIda(ver,ida).filter(i=>{
    const s=estadoItem(m,i.k);
    if(s&&s.s!=="falta")return false;
    const n=semAcento(i.n);if(ja.has(n))return false;ja.add(n);return true;
  });
}
function sheetFinalizar(ida){
  const r=resumoIda(ver,ida), c=cfg().idas[ida];
  const pend=pendentesParaLevar(ida), prox=proximaIda(ver,ida), dProx=cfg().idas[prox.ida].dia;
  abrirSheet(`
    <h2 id="sheet-title">Finalizar compra</h2>
    <p class="sub">Dia ${c.dia} · ${esc(c.nome)} · ${mesNome(ver)}</p>
    <label class="fld" style="margin-bottom:6px"><span>Quanto deu no caixa?</span><div class="money big"><input class="inp" id="valor" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${brlEdit(r.nota)}" aria-describedby="valor-hint"></div></label>
    <p class="hint" id="valor-hint">${dicaValor(r.nota,r.est)}</p>
    <div class="btns"><button class="btn ghost" data-act="fechar">Cancelar</button><button class="btn" data-act="salvarvalor">Salvar valor</button></div>
    ${r.nota!=null?`<p style="text-align:center;margin:10px 0 0"><button class="linkbtn" data-act="apagarvalor" style="color:var(--red)">Apagar valor lançado</button></p>`:""}
    <div class="resumo-fim" aria-label="Resumo dos itens">
      <div><b>${r.ok}</b><small>no carrinho</small></div>
      <div><b>${r.casa}</b><small>em casa</small></div>
      <div><b>${r.falta}</b><small>não achei</small></div>
      <div><b>${r.nada}</b><small>sem marcar</small></div>
    </div>
    ${pend.length?`<div class="faltas"><b>${pend.length} ${pend.length===1?"item ficou":"itens ficaram"} de fora</b> e ${pend.length===1?"não está":"não estão"} na lista do dia ${dProx}: ${esc(pend.slice(0,8).map(i=>i.n).join(", "))}${pend.length>8?"…":""}
      <div style="margin-top:8px"><button class="btn small ghost" data-act="levar">Passar ${pend.length===1?"para":"os "+pend.length+" para"} o dia ${dProx}${prox.mes!==ver?" de "+mesNome(prox.mes):""}</button></div></div>`:""}`,
    {tipo:"fim",ida},r.nota==null&&window.matchMedia&&matchMedia("(pointer:fine)").matches?"valor":null);
}
function dicaValor(v,est){
  if(v==null)return`Previsto para esta ida: ${brl(est)}`;
  const d=v-est;
  return d>0?`${brl(d)} acima do previsto de ${brl(est)}`:d<0?`${brl(-d)} abaixo do previsto de ${brl(est)}`:"Exatamente o previsto";
}

function sheetExtra(ida){
  abrirSheet(`
    <h2 id="sheet-title">Adicionar item</h2>
    <p class="sub">Só nesta compra (dia ${cfg().idas[ida].dia}). Para incluir em todos os meses, use Ajustes → Lista de compras.</p>
    <label class="fld"><span>Item</span><input class="inp" id="ex-n" maxlength="60" placeholder="Ex.: Pilhas AA" autocomplete="off" enterkeyhint="next"></label>
    <label class="fld"><span>Quantidade <small>opcional</small></span><input class="inp" id="ex-q" maxlength="30" placeholder="Ex.: 1 pacote" autocomplete="off" enterkeyhint="done"></label>
    <div class="btns"><button class="btn ghost" data-act="fechar">Cancelar</button><button class="btn" data-act="salvarextra">Adicionar</button></div>`,{tipo:"extra",ida},"ex-n");
}

function sheetNome(depois){
  abrirSheet(`
    <h2 id="sheet-title">Como você se chama?</h2>
    <p class="sub">Assim a outra pessoa vê quem pegou cada item quando vocês estiverem no mercado juntos.</p>
    <label class="fld"><span>Seu nome</span><input class="inp" id="nm" maxlength="30" placeholder="Ex.: Leo" autocomplete="given-name" enterkeyhint="done"></label>
    <div class="btns"><button class="btn ghost" data-act="fechar">Agora não</button><button class="btn" data-act="salvarnome">Salvar</button></div>`,{tipo:"nome",depois},"nm");
}

function sheetApi(){
  abrirSheet(`
    <h2 id="sheet-title">Conectar planilha</h2>
    <p class="sub">Cole a URL do Apps Script publicado como App da Web (termina em <b>/exec</b>). Todo mundo que usar a mesma URL vê a mesma lista.</p>
    <label class="fld"><span>URL do Apps Script</span><input class="inp" id="apiurl" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(API)}"></label>
    <p class="hint">Deixe vazio para usar só neste aparelho.</p>
    <div class="btns"><button class="btn ghost" data-act="fechar">Cancelar</button><button class="btn" data-act="salvarapi">Salvar</button></div>`,{tipo:"api"},"apiurl");
}

function sheetSync(){
  const s=statusSync();
  const linhas=[];
  if(!API)linhas.push("Tudo está salvo só neste aparelho. Conecte a planilha para salvar no Google Planilhas e usar em dupla.");
  else{
    if(net.erroPlanilha&&fila.length)linhas.push(`A planilha recusou a última gravação: ${net.erroPlanilha}`);
    if(net.antigo)linhas.push("A planilha está com o script antigo. Publique a versão nova do Codigo.gs (Implantar → Gerenciar implantações → Nova versão).");
    if(fila.length)linhas.push(`${fila.length} ${fila.length===1?"alteração esperando":"alterações esperando"} para subir. Elas ficam guardadas neste aparelho até a conexão voltar.`);
    if(net.ultima)linhas.push(`Última sincronização às ${hora(net.ultima)}.`);
    if(net.erro&&!net.online)linhas.push(`Sem conexão com a planilha agora.`);
    if(unicos(pres).length)linhas.push(`Também com o app aberto agora: ${unicos(pres).map(presNome).join(", ")}.`);
  }
  abrirSheet(`
    <h2 id="sheet-title">${esc(s.t)}</h2>
    ${linhas.map(l=>`<p class="sub">${esc(l)}</p>`).join("")}
    <div class="btns">${API?`<button class="btn ghost" data-act="api">Trocar planilha</button><button class="btn" data-act="syncja">Sincronizar agora</button>`:`<button class="btn block" data-act="api">Conectar planilha</button>`}</div>`,{tipo:"sync"});
}

function sheetEditarItem(id){
  const C=cfg(), it=id?C.lista[id]:null, ord=IDS.slice().sort((a,b)=>C.idas[a].dia-C.idas[b].dia);
  const secs=[...new Set(Object.values(C.lista).filter(Boolean).map(i=>i.sec))];
  const dias=ord.map(i=>{
    const tem=it?!!(it.q&&i in it.q):i==="i1";
    const v=it?qtdNum(it,i,C.pessoas):null;
    return`<label class="diaq${tem?"":" off"}" data-diaq="${i}"><input type="checkbox" data-dia="${i}" ${tem?"checked":""}><span class="n">Dia ${C.idas[i].dia}<small>${esc(C.idas[i].nome)}</small></span><input class="inp" data-q="${i}" inputmode="decimal" placeholder="qtd." value="${v==null?"":esc(num(v))}" aria-label="Quantidade no dia ${C.idas[i].dia}" ${tem?"":"disabled"}></label>`;
  }).join("");
  abrirSheet(`
    <h2 id="sheet-title">${it?"Editar item":"Novo item"}</h2>
    <label class="fld"><span>Nome</span><input class="inp" id="ed-n" maxlength="60" value="${esc(it?it.n:"")}" placeholder="Ex.: Arroz" autocomplete="off"></label>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <label class="fld"><span>Seção</span><input class="inp" id="ed-s" list="dl-secs" maxlength="40" value="${esc(it?it.sec:"")}" placeholder="Ex.: Grãos" autocomplete="off"></label>
      <label class="fld"><span>Unidade</span><input class="inp" id="ed-u" list="dl-uns" maxlength="40" value="${esc(it?it.u:"kg")}" placeholder="kg, pacote…" autocomplete="off"></label>
    </div>
    <datalist id="dl-secs">${secs.map(s=>`<option value="${esc(s)}">`).join("")}</datalist>
    <datalist id="dl-uns">${UNIDADES.map(s=>`<option value="${esc(s)}">`).join("")}</datalist>
    <div class="fld"><span id="lbl-q">Em quais idas e quanto <small>para ${C.pessoas} ${C.pessoas===1?"pessoa":"pessoas"}</small></span><div class="dias" role="group" aria-labelledby="lbl-q">${dias}</div></div>
    <label class="check"><input type="checkbox" id="ed-f" ${it&&it.fixo?"checked":""}><span>Quantidade fixa<small>Não muda com o número de pessoas (ex.: produto por banheiro)</small></span></label>
    <div class="btns"><button class="btn ghost" data-act="fechar">Cancelar</button><button class="btn" data-act="salvaritem">Salvar</button></div>
    ${it?`<p style="text-align:center;margin:10px 0 0"><button class="linkbtn" data-act="excluiritem" style="color:var(--red)">Excluir item da lista</button></p>`:""}`,{tipo:"editar",id},it?null:"ed-n");
}

/* ================= Ações ================= */

function marcar(k,novo,comToast){
  const m=dadosMes(ver), antes=(m.itens||{})[k];
  ultimoToque=Date.now();
  const op=novo?set(["meses",ver,"itens",k],{s:novo,por:NOME||"",t:Date.now()}):del(["meses",ver,"itens",k]);
  muda(opsMes(ver,op));
  vibrar();
  if(novo==="ok"){
    const li=[...document.querySelectorAll(".it[data-k]")].find(x=>x.dataset.k===k);
    if(li)li.classList.add("pop");
  }
  if(comToast){
    const [ida]=k.split(":"), it=itensIda(ver,ida).find(i=>i.k===k), mesK=ver;
    const msg={ok:"no carrinho",casa:"marcado como em casa",falta:"marcado como não achado","":"desmarcado"}[novo||""];
    toast(`${it?it.n:"Item"} ${msg}`,"Desfazer",()=>muda(antes==null?del(["meses",mesK,"itens",k]):set(["meses",mesK,"itens",k],antes)));
  }
}

const acoes={
  tog(el){
    const k=el.dataset.k, s=estadoItem(dadosMes(ver),k);
    if(s&&s.por&&s.por!==NOME&&remotos[k]&&Date.now()-remotos[k]<4000){
      toast(`${s.por} acabou de marcar este item`);return;
    }
    marcar(k,s?null:"ok",true);
  },
  item(el){sheetItem(el.dataset.k)},
  st(el){
    if(!sheetCtx||sheetCtx.tipo!=="item")return;
    const k=sheetCtx.k;fecharSheet();marcar(k,el.dataset.s||null,true);
  },
  rmextra(){
    if(!sheetCtx)return;
    const {ida,x,k}=sheetCtx, mes=ver;fecharSheet();
    const e=copia(((dadosMes(mes).extras||{})[ida]||{})[x]), st=copia(dadosMes(mes).itens[k]);
    muda(opsMes(mes,del(["meses",mes,"extras",ida,x]),del(["meses",mes,"itens",k])));
    toast("Item removido","Desfazer",()=>muda(opsMes(mes,set(["meses",mes,"extras",ida,x],e),st?set(["meses",mes,"itens",k],st):null)));
  },
  extra(){sheetExtra(rotaAtual().ida)},
  salvarextra(){
    const n=$("ex-n").value.trim(), q=$("ex-q").value.trim();
    if(!n){$("ex-n").focus();return}
    const ida=sheetCtx.ida;fecharSheet();
    muda(opsMes(ver,set(["meses",ver,"extras",ida,uid()],{n,q,por:NOME||""})));
    toast(`${n} adicionado`);
  },
  filtro(el){filtro=el.dataset.f;ls.set("mercado_filtro",filtro);Object.keys(recentes).forEach(k=>delete recentes[k]);render()},
  tarefa(el){
    const ida=rotaAtual().ida, k=ida+"_"+el.dataset.t, on=!!dadosMes(ver).cheg[k];
    muda(opsMes(ver,on?del(["meses",ver,"cheg",k]):set(["meses",ver,"cheg",k],1)));vibrar();
  },
  finalizar(){sheetFinalizar(rotaAtual().ida)},
  salvarvalor(){
    const v=parse($("valor").value), ida=sheetCtx.ida;
    if(v==null||v<0){$("valor").focus();$("valor-hint").textContent="Digite o valor, por exemplo 1.480,50";$("valor-hint").className="hint bad";return}
    fecharSheet();
    muda(opsMes(ver,set(["meses",ver,"notas",ida],Math.round(v*100)/100)));
    const est=cfgMes(ver).est[ida], d=v-est;
    toast("Valor salvo · "+dicaValor(v,est).replace(/ de R\$.*$/,""));
  },
  apagarvalor(){
    const ida=sheetCtx.ida, mes=ver, antes=dadosMes(mes).notas[ida];fecharSheet();
    muda(del(["meses",mes,"notas",ida]));
    toast("Valor apagado","Desfazer",()=>muda(opsMes(mes,set(["meses",mes,"notas",ida],antes))));
  },
  levar(){
    const ida=sheetCtx.ida, prox=proximaIda(ver,ida), novos=pendentesParaLevar(ida);
    const ops=garanteMes(prox.mes), ids=[];
    novos.forEach(i=>{const id=uid();ids.push(id);ops.push(set(["meses",prox.mes,"extras",prox.ida,id],{n:i.n,q:i.q||"",por:NOME||"",de:ida}))});
    if(!novos.length)return;
    muda(ops);
    const dd=cfg().idas[prox.ida].dia, digitado=$("valor")?$("valor").value:"";
    sheetFinalizar(ida);
    if(digitado&&$("valor")){$("valor").value=digitado;$("valor").dispatchEvent(new Event("input",{bubbles:true}))}
    toast(`${novos.length} ${novos.length===1?"item passado":"itens passados"} para o dia ${dd}`,"Desfazer",()=>muda(ids.map(id=>del(["meses",prox.mes,"extras",prox.ida,id]))));
  },
  fechar(){fecharSheet()},
  voltar(el){voltar(el.dataset.padrao||"#/")},
  mes(el){
    const lim=limitesMes(), n=somaMes(ver,+el.dataset.d);
    if(n<lim.min||n>lim.max)return;
    setVer(n);render();
  },
  hoje(){setVer(mesAtual());render();window.scrollTo(0,0)},
  sync(){sheetSync()},
  syncja(){fecharSheet();net.antigo=false;sincronizarJa();toast("Sincronizando…")},
  api(){sheetApi()},
  salvarapi(){
    const v=$("apiurl").value.trim();
    if(v&&!/^https:\/\/script\.google(usercontent)?\.com\//.test(v)){$("apiurl").focus();toast("A URL precisa ser do script.google.com");return}
    fecharSheet();
    if(v!==API){API=v;ls.set("mercado_api",API);rev=null;net.antigo=false;net.confirmado=false;net.erroPlanilha="";net.ultima=0;net.online=true;persistir()}
    render();if(API)sincronizarJa();
    if(API&&!NOME)setTimeout(()=>{ls.set("mercado_nome_perguntado","1");sheetNome()},300);
  },
  async convidar(){
    const link=location.origin+location.pathname+"?api="+encodeURIComponent(API);
    const texto="Abre esse link para usarmos juntos a lista do mercado:";
    try{
      if(navigator.share){await navigator.share({title:"Mercado do mês",text:texto,url:link});return}
    }catch(e){if(e&&e.name==="AbortError")return}
    try{await navigator.clipboard.writeText(link);toast("Link copiado. Mande só para quem vai usar a lista.")}
    catch(e){abrirSheet(`<h2 id="sheet-title">Link de convite</h2><p class="sub">Copie e mande só para quem vai usar a lista.</p><input class="inp" id="convite" readonly value="${esc(link)}">`,{tipo:"convite"},"convite")}
  },
  salvarnome(){
    const v=$("nm").value.trim();
    NOME=v;ls.set("mercado_nome",v);ls.set("mercado_nome_perguntado","1");
    fecharSheet();if(v)toast(`Oi, ${v}!`);render();
  },
  pessoas(el){
    const C=cfg(), antes=C.pessoas, n=Math.min(20,Math.max(1,antes+ +el.dataset.d));
    if(n===antes)return;
    // vários cliques seguidos (3 → 4 → 5) ajustam os valores a partir do número inicial
    if(!ajuste||Date.now()-ajuste.t>7000)ajuste={base:antes,est:Object.fromEntries(IDS.map(i=>[i,C.idas[i].est]))};
    ajuste.t=Date.now();
    const a=ajuste;
    muda(opsCfg("pessoas",null,n));
    toast(`Lista ajustada para ${n} ${n===1?"pessoa":"pessoas"}`,"Ajustar valores também",()=>{
      muda(IDS.flatMap(i=>opsCfg("est",i,Math.round(a.est[i]*n/a.base/5)*5)));
      ajuste=null;
      toast("Valores previstos ajustados na mesma proporção");
    },7000);
  },
  usarmedia(el){
    const ida=el.dataset.ida, v=+el.dataset.v, antes=cfg().idas[ida].est;
    muda(opsCfg("est",ida,v));
    toast(`Previsto do dia ${cfg().idas[ida].dia} agora é ${brl(v)}`,"Desfazer",()=>muda(opsCfg("est",ida,antes)));
  },
  histsel(el){histSel=el.dataset.m;render()},
  abrirmes(el){setVer(el.dataset.mes);ir("#/")},
  novoitem(){sheetEditarItem(null)},
  editar(el){sheetEditarItem(el.dataset.id)},
  salvaritem(){
    const C=cfg(), id=sheetCtx.id||(($("ed-n").value.trim().toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"item")+"-"+uid().slice(-4));
    const n=$("ed-n").value.trim(), sec=$("ed-s").value.trim()||"Outros", u=$("ed-u").value.trim(), fixo=$("ed-f").checked;
    if(!n){$("ed-n").focus();return}
    const velho=C.lista[id];
    const q={}, digitados=[];let algum=false;
    document.querySelectorAll("[data-dia]").forEach(cb=>{
      if(!cb.checked)return;
      algum=true;
      const ida=cb.dataset.dia, inp=document.querySelector(`[data-q="${ida}"]`), v=parse(inp.value);
      // valor não alterado (e mesmo modo fixo/escalado): mantém o original, sem arredondamentos
      if(velho&&inp.value===inp.defaultValue&&!!velho.fixo===fixo&&velho.q&&ida in velho.q){q[ida]=velho.q[ida];return}
      if(v!=null)digitados.push(v);
      q[ida]=v==null?null:fixo?v:v/C.pessoas;
    });
    if(!algum){toast("Escolha pelo menos uma ida");return}
    const os=Object.values(C.lista).filter(Boolean).map(i=>i.o??0);
    const it={n,sec,u,q,o:velho?velho.o:(os.length?Math.max(...os)+1:0)};
    if(fixo)it.fixo=true;
    // arredondamento: o padrão da unidade, a não ser que o valor digitado precise de um menor (2,5 kg de arroz)
    const cabe=p=>digitados.every(v=>Math.abs(v/p-Math.round(v/p))<1e-6);
    const base=passo({u});
    if(velho&&velho.p&&velho.u===u&&cabe(velho.p))it.p=velho.p;
    else if(!cabe(base)){const c=[500,250,100,50,25,10,5,1,.5,.25,.1,.05,.01].find(p=>p<=base&&cabe(p));if(c)it.p=c}
    fecharSheet();
    muda(garanteLista(),set(["config","lista",id],it));
    toast(velho?"Item atualizado":`${n} adicionado à lista`);
  },
  excluiritem(){
    const id=sheetCtx.id, velho=copia(cfg().lista[id]);fecharSheet();
    muda(garanteLista(),del(["config","lista",id]));
    if(velho)toast(`${velho.n} excluído`,"Desfazer",()=>muda(set(["config","lista",id],velho)));
  },
  buscar(){buscaAberta=true;busca="";render(true);const b=$("busca");if(b)b.focus()},
  fecharbusca(){buscaAberta=false;busca="";render(true)},
  toast(){const fn=toastAcao;$("toast").hidden=true;toastAcao=null;if(fn)fn()}
};

document.addEventListener("click",e=>{
  const el=e.target.closest("[data-act]");
  if(!el||el.disabled)return;
  const fn=acoes[el.dataset.act];
  if(fn){e.preventDefault();fn(el)}
});
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"&&e.target.id==="busca"){acoes.fecharbusca();return}
  if(e.key==="Enter"){
    const id=e.target.id;
    if(id==="valor")acoes.salvarvalor();
    else if(id==="ex-n")$("ex-q").focus();
    else if(id==="ex-q")acoes.salvarextra();
    else if(id==="nm")acoes.salvarnome();
    else if(id==="apiurl")acoes.salvarapi();
    else if(e.target.matches("tr[data-act],rect[data-act]")){e.preventDefault();e.target.dispatchEvent(new MouseEvent("click",{bubbles:true}))}
  }
  if(e.key===" "&&e.target.matches("tr[data-act],rect[data-act]")){e.preventDefault();e.target.dispatchEvent(new MouseEvent("click",{bubbles:true}))}
});
document.addEventListener("input",e=>{
  if(e.target.id==="busca"){busca=e.target.value;aplicarBusca();return}
  if(e.target.id==="valor"&&sheetCtx){
    const r=resumoIda(ver,sheetCtx.ida), v=parse(e.target.value), h=$("valor-hint");
    h.textContent=dicaValor(v,r.est);h.className="hint"+(v==null?"":v>r.est?" bad":" good");
  }
});
document.addEventListener("change",e=>{
  const t=e.target;
  if(t.dataset.cfg){
    const ida=t.dataset.ida, campo=t.dataset.cfg, C=cfg();
    let v;
    if(campo==="dia"){v=parseInt(t.value,10);if(!(v>=1&&v<=31)){t.value=C.idas[ida].dia;return}}
    else if(campo==="nome"){v=t.value.trim();if(!v){t.value=C.idas[ida].nome;return}}
    else{v=parse(t.value);if(v==null||v<0){t.value=brlEdit(C.idas[ida].est);return}v=Math.round(v*100)/100;t.value=brlEdit(v)}
    if(v===C.idas[ida][campo])return;
    muda(opsCfg(campo,ida,v));
    toast("Salvo");
  }
  if(t.id==="meunome"){NOME=t.value.trim();ls.set("mercado_nome",NOME);ls.set("mercado_nome_perguntado","1");toast("Nome salvo")}
  if(t.dataset.dia){
    const box=t.closest(".diaq"), inp=box.querySelector("[data-q]");
    box.classList.toggle("off",!t.checked);inp.disabled=!t.checked;
    if(t.checked)inp.focus();
  }
});

/* ================= Teclado do celular sobre a folha inferior ================= */

if(window.visualViewport){
  const vv=window.visualViewport;
  const ajustar=()=>{const kb=Math.max(0,Math.round(innerHeight-vv.height-vv.offsetTop));document.documentElement.style.setProperty("--kb",kb+"px")};
  vv.addEventListener("resize",ajustar);vv.addEventListener("scroll",ajustar);
}

/* ================= Tela sempre ligada no mercado ================= */

let wake=null;
async function pedirTelaLigada(){
  if(wake||document.hidden||rotaAtual().v!=="ida"||!("wakeLock" in navigator))return;
  try{wake=await navigator.wakeLock.request("screen");wake.addEventListener("release",()=>{wake=null})}catch(e){wake=null}
}
function soltarTela(){if(wake){wake.release().catch(()=>{});wake=null}}

/* ================= Início ================= */

window.addEventListener("hashchange",()=>{
  const ae=document.activeElement;if(ae&&$("main").contains(ae)&&ae.blur)ae.blur();
  fecharSheet();buscaAberta=false;busca="";$("toast").hidden=true;
  Object.keys(recentes).forEach(k=>delete recentes[k]);
  const r=rotaAtual();
  render(true);window.scrollTo(0,0);
  try{$("main").focus({preventScroll:true})}catch(e){}
  if(r.v==="ida"){
    pedirTelaLigada();
    if(!NOME&&API&&!ls.get("mercado_nome_perguntado")){ls.set("mercado_nome_perguntado","1");sheetNome()}
    if(API&&!fila.length)baixar(false);
  }else soltarTela();
  loop();
});
document.addEventListener("visibilitychange",()=>{
  tocando=false;
  if(document.hidden){clearTimeout(tLoop);return}
  pedirTelaLigada();sincronizarJa();
});
window.addEventListener("online",()=>sincronizarJa());

if(!S.meses[ver]&&ver!==mesAtual()&&!Object.keys(S.meses).length)setVer(mesAtual());
const mig0=migracoes();
if(mig0.length){mig0.forEach(op=>{S=normalizar(aplicar(S,op))});enfileirar(mig0);persistir()}
render();
if(rotaAtual().v==="ida")pedirTelaLigada();
if(API)sincronizarJa();

if("serviceWorker" in navigator&&location.protocol==="https:"){
  window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
}
