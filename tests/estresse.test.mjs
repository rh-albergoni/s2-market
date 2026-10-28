import {servidor,celular,wait,ok,resultado} from "./harness.mjs";
const MES=new Date().getFullYear()+"-"+String(new Date().getMonth()+1).padStart(2,"0");
let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
for(let rodada=1;rodada<=3;rodada++){
  console.log(`Rodada ${rodada}: duas pessoas, 60 toques cada, rede instável`);
  const srv=servidor();
  // rede lenta e variável
  const f0=srv.fetch;srv.fetch=dev=>{const f=f0(dev);return async(u,o)=>{await wait(Math.floor(rnd()*120));return f(u,o)}};
  const A=celular(srv,{nome:"Ana",hash:"#/ida/i1"}), B=celular(srv,{nome:"Leo",hash:"#/ida/i1"});
  await wait(400);
  for(const c of [A,B])c.click(`[data-act="filtro"][data-f="todos"]`);
  const keysA=A.qa(".it[data-k]").map(x=>x.dataset.k).filter((_,i)=>i%2===0);
  const keysB=A.qa(".it[data-k]").map(x=>x.dataset.k).filter((_,i)=>i%2===1);
  const esperado={};
  for(let i=0;i<120;i++){
    const quem=i%2?B:A, ks=i%2?keysB:keysA, nome=i%2?"Leo":"Ana";
    const k=ks[Math.floor(rnd()*ks.length)];
    if(rnd()<.15){if(srv.offline.has(nome))srv.offline.delete(nome);else srv.offline.add(nome)}
    // às vezes usa o menu (casa / não achei), às vezes o toque simples
    const li=quem.item(k);
    if(!li){quem.click(`[data-act="filtro"][data-f="todos"]`)}
    if(rnd()<.25){
      const s=["casa","falta",""][Math.floor(rnd()*3)];
      quem.click(quem.item(k).querySelector(".it-more"));
      if(quem.q(`.acao[data-s="${s}"]`)){quem.click(`.acao[data-s="${s}"]`);esperado[k]=s||undefined}
      else quem.click(`[data-act="fechar"]`);
    }else{
      quem.tap(k);
      esperado[k]=esperado[k]?undefined:"ok";
    }
    if(rnd()<.3)await (rnd()<.5?A:B).sync();
    if(rnd()<.2)await wait(Math.floor(rnd()*150));
  }
  srv.offline.clear();
  for(let i=0;i<6;i++){await A.sync();await B.sync();await wait(150)}
  const sv=srv.estado().meses[MES].itens, sa=A.ev(`JSON.stringify(S.meses["${MES}"].itens)`), sb=B.ev(`JSON.stringify(S.meses["${MES}"].itens)`);
  const norm=o=>JSON.stringify(Object.fromEntries(Object.entries(typeof o==="string"?JSON.parse(o):o).map(([k,v])=>[k,v.s]).sort()));
  ok(norm(sa)===norm(sv)&&norm(sb)===norm(sv),"A, B e planilha idênticos");
  const exp=JSON.stringify(Object.fromEntries(Object.entries(esperado).filter(([,v])=>v).sort()));
  ok(norm(sv)===exp,"resultado exato de cada toque preservado ("+Object.keys(JSON.parse(exp)).length+" itens marcados)");
  ok(A.ev("fila.length")===0&&B.ev("fila.length")===0,"nada pendente");
  ok(A.erros.length+B.erros.length===0,"sem erros "+A.erros.concat(B.erros).join("|"));
  console.log("   POSTs:",srv.posts,"GETs:",srv.gets);
  A.close();B.close();
}
process.exit(resultado());
