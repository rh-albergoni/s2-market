// Ambiente de teste: Codigo.gs real + planilha/cache/propriedades falsas + vários "celulares" (jsdom)
import {JSDOM} from "jsdom"; import fs from "fs"; import vm from "vm"; import path from "path"; import {fileURLToPath} from "url";
const ROOT=path.join(path.dirname(fileURLToPath(import.meta.url)),"..")+"/";
export const wait=ms=>new Promise(r=>setTimeout(r,ms));

export function servidor({versao="v3",linhas=null}={}){
  const sheets={}; const grid=nome=>sheets[nome]||(sheets[nome]=[]);
  if(linhas)sheets.dados=linhas.map(r=>r.slice());
  const mkSheet=nome=>({
    getLastRow:()=>{const g=grid(nome);let n=g.length;while(n&&(g[n-1]||[]).every(v=>v===""||v==null))n--;return n},
    getRange:(r,c,nr=1,nc=1)=>{if(typeof r==="string"){const m=r.match(/^([A-Z])(\d+)$/);c=m[1].charCodeAt(0)-64;r=+m[2]}return{
      getValues:()=>Array.from({length:nr},(_,i)=>Array.from({length:nc},(_,j)=>((grid(nome)[r-1+i]||[])[c-1+j])??"")),
      getValue:()=>((grid(nome)[r-1]||[])[c-1])??"",
      setValue:v=>{const g=grid(nome);g[r-1]=g[r-1]||[];g[r-1][c-1]=v},
      setValues:v=>{const g=grid(nome);v.forEach((row,i)=>{g[r-1+i]=g[r-1+i]||[];row.forEach((x,j)=>g[r-1+i][c-1+j]=x)})},
      setNumberFormat(){},clearContent:()=>{const g=grid(nome);for(let i=0;i<nr;i++)if(g[r-1+i])for(let j=0;j<nc;j++)g[r-1+i][c-1+j]=""}
    }},
    clearContents:()=>{sheets[nome]=[]}
  });
  const cache={}, props={};
  const gs={console,JSON,Date,Math,String,Number,Object,
    SpreadsheetApp:{flush(){},getActiveSpreadsheet:()=>({getSheetByName:n=>sheets[n]?mkSheet(n):null,insertSheet:n=>{grid(n);return mkSheet(n)}})},
    SpreadsheetApp_flush:null,ContentService:{createTextOutput:t=>({t,setMimeType(){return t}}),MimeType:{JSON:"json"}},
    LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
    CacheService:{getScriptCache:()=>({remove:k=>{delete cache[k]},get:k=>k in cache?cache[k]:null,put:(k,v)=>{cache[k]=v},getAll:ks=>Object.fromEntries(ks.filter(k=>k in cache).map(k=>[k,cache[k]]))})},
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>k in props?props[k]:null,setProperty:(k,v)=>{props[k]=v}})}
  };
  vm.createContext(gs);
  const codigo=versao==="v3"?fs.readFileSync(ROOT+"apps-script/Codigo.gs","utf8"):fs.readFileSync(path.join(ROOT,"tests",versao),"utf8");
  vm.runInContext(codigo,gs);
  const srv={sheets,cache,props,gs,posts:0,gets:0,offline:new Set(),log:[]};
  srv.fetch=dev=>async(url,o={})=>{
    await wait(25);
    if(srv.offline.has(dev))throw new TypeError("Failed to fetch");
    let t;
    if(o.method==="POST"){srv.posts++;srv.log.push(["POST",dev,JSON.parse(o.body).ops.length]);t=gs.doPost({postData:{contents:o.body}})}
    else{srv.gets++;const u=new URL(url);t=gs.doGet({parameter:Object.fromEntries(u.searchParams)})}
    await wait(25);
    return {json:async()=>JSON.parse(t)};
  };
  srv.estado=()=>gs.ler_?gs.ler_():null;
  return srv;
}

const html=fs.readFileSync(ROOT+"index.html","utf8").replace('<script src="app.js"></script>',()=>"<script>"+fs.readFileSync(ROOT+"app.js","utf8")+"</script>");
export function celular(srv,{nome="",api=true,hash="#/",storage=null,larg=390}={}){
  const erros=[];
  const url="https://rh-albergoni.github.io/s2-market/"+(api?"?api="+encodeURIComponent("https://script.google.com/macros/s/X/exec"):"")+hash;
  const dom=new JSDOM(html,{url,runScripts:"dangerously",pretendToBeVisual:true,
    beforeParse(w){
      w.fetch=srv.fetch(nome||"anon");
      w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute("open","");this.open=true};
      w.HTMLDialogElement.prototype.close=function(){this.removeAttribute("open");this.open=false;this.dispatchEvent(new w.Event("close"))};
      Object.defineProperty(w.HTMLDialogElement.prototype,"open",{get(){return this.hasAttribute("open")},set(v){},configurable:true});
      w.scrollTo=()=>{};w.navigator.vibrate=()=>true;
      if(storage)for(const[k,v]of Object.entries(storage))w.localStorage.setItem(k,v);
      if(nome){w.localStorage.setItem("mercado_nome",nome);w.localStorage.setItem("mercado_nome_perguntado","1")}
      w.addEventListener("error",e=>erros.push(e.message||String(e.error)));
      w.console.error=(...a)=>erros.push(a.join(" "));
    }});
  const w=dom.window;
  const c={w,erros,
    q:s=>w.document.querySelector(s), qa:s=>[...w.document.querySelectorAll(s)],
    txt:s=>{const e=w.document.querySelector(s);return e?e.textContent.replace(/\s+/g," ").trim():null},
    ev:code=>w.eval(code),
    click(sel){const e=typeof sel==="string"?w.document.querySelector(sel):sel;if(!e)throw new Error("não achei "+sel);e.dispatchEvent(new w.MouseEvent("click",{bubbles:true}));},
    item:k=>[...w.document.querySelectorAll(".it[data-k]")].find(x=>x.dataset.k===k),
    tap(k){const li=c.item(k);if(!li)throw new Error("item não visível "+k);c.click(li.querySelector(".it-main"))},
    ir:h=>{w.location.hash=h;},
    type(sel,v){const e=c.q(sel);e.value=v;e.dispatchEvent(new w.Event("input",{bubbles:true}));e.dispatchEvent(new w.Event("change",{bubbles:true}))},
    async sync(){await w.eval("(async()=>{ if(fila.length) await enviar(); await baixar(false) })()")},
    close(){w.close()}
  };
  return c;
}
let falhas=0;
export function ok(cond,msg){if(cond)console.log("  ✓",msg);else{falhas++;console.log("  ✗",msg)}}
export const resultado=()=>{console.log(falhas?`\n${falhas} FALHA(S)`:"\nTUDO OK");return falhas};
