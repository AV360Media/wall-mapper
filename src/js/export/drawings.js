/* ========================= EXPORT ========================= */
function renderToCanvas(measure,paintFn){
  const probe=document.createElement('canvas').getContext('2d');
  const d=measure(probe);
  const K=Math.max(1.6,Math.min(3,2600/d.w));
  const c=document.createElement('canvas');
  c.width=Math.round(d.w*K); c.height=Math.round(d.h*K);
  const ctx=c.getContext('2d');
  ctx.fillStyle=C.bg; ctx.fillRect(0,0,c.width,c.height);
  ctx.setTransform(K,0,0,K,0,0);
  paintFn(ctx); return c;
}
/* one page per screen: power map and data map side by side (stacked if the wall is wide) */
function drawPair(ctx,s,measureOnly){
  const o=opt(), keep={p:o.showPower,d:o.showData};
  o.showPower=true;  o.showData=false; const bp=sbox(s);
  o.showPower=false; o.showData=true;  const bd=sbox(s);
  const G=30, CAP=15;
  const stack=bd.w>560;
  const W=stack?Math.max(bp.w,bd.w)+G*2 : bd.w+bp.w+G*3;
  const TIT=66+factRows(screenFacts(s).length,W-G*2)*FACT_ROW+22;
  const H=TIT+(stack ? bd.h+CAP+G+bp.h+CAP+G : Math.max(bp.h,bd.h)+CAP+G);
  if(measureOnly){ o.showPower=keep.p; o.showData=keep.d; return {w:W,h:H}; }

  ctx.fillStyle=C.bg; ctx.fillRect(0,0,W,H);
  const t=totals(s), pr=procOf(s), p=panelById(s.panelId);
  const headW=W-G*2;
  txt(ctx,clipText(ctx,`${titleShow()} — ${s.name}`,headW,`600 23px ${FD}`),G,28,`600 23px ${FD}`,C.head);
  if(titleVenue()) txt(ctx,clipText(ctx,titleVenue(),headW,`500 10.5px ${FS}`),G,46,`500 10.5px ${FS}`,C.sub);
  drawFacts(ctx,G,titleVenue()?72:58,headW,screenFacts(s));
  drawStamp(ctx,G,W-G,TIT-16);
  ctx.strokeStyle=C.line; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(G,TIT-12); ctx.lineTo(W-G,TIT-12); ctx.stroke();

  /* data reads first — left to right, or top to bottom when stacked */
  const dx0=G, dy0=TIT;
  const px0=stack?G:G*2+bd.w, py0=stack?TIT+CAP+bd.h+G:TIT;
  capTxt(ctx,'Data',dx0,dy0+10,9,C.dataAcc);
  o.showPower=false; o.showData=true;
  ctx.save(); ctx.translate(dx0,dy0+CAP); drawScreen(ctx,s,bd,false,true,false); ctx.restore();
  capTxt(ctx,'Power',px0,py0+10,9,C.warn);
  o.showPower=true; o.showData=false;
  ctx.save(); ctx.translate(px0,py0+CAP); drawScreen(ctx,s,bp,true,false,false); ctx.restore();

  o.showPower=keep.p; o.showData=keep.d;
  return {w:W,h:H};
}
function pairCanvas(s){
  return renderToCanvas(ctx=>drawPair(ctx,s,true),ctx=>drawPair(ctx,s,false));
}
function setCanvas(layer){
  const B=setBounds(), d={w:B.w+SETGAP*2,h:B.h+titleH()+SETGAP};
  return renderToCanvas(()=>d,ctx=>drawSet(ctx,{layer}));
}
function summaryCanvas(){ return renderToCanvas(p=>drawSummary(p),ctx=>drawSummary(ctx)); }
function b64ToBytes(b64){const b=atob(b64),a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a;}
function download(blob,name){
  const url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url; a.download=name; a.style.display='none';
  document.body.appendChild(a); a.click();
  setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},2500);
}
const fileBase=()=>((((S.exp&&S.exp.show)||S.name||'wall-map').replace(/[^a-z0-9\-_ ]/gi,'_')).trim())||'wall-map';
function exportPDF(){ if(needScreen()) return; openExport(); }
function openExport(){
  expDraft=Object.assign(defExp(),JSON.parse(JSON.stringify(expOf())));
  const g=id=>document.getElementById(id);
  g('exShow').value=expDraft.show||'';
  g('exVenue').value=expDraft.venue||'';
  g('exAuthor').value=expDraft.author||'';
  g('exDate').value=expDraft.date||'';
  g('exRev').value=expDraft.rev||'';
  [['exPSet','pSet'],['exPScreens','pScreens'],['exPSummary','pSummary'],['exPCable','pCable'],['exPPix','pPix'],
   ['exNums','nums'],['exRefs','refs'],['exLegend','legend'],['exHops','hops'],
   ['exBackup','backup'],['exWeight','weight'],['exLoad','load'],['exCover','cover'],['exSplit','split'],['exBW','bw']]
    .forEach(([id,k])=>{ g(id).checked=!!expDraft[k]; g(id).onchange=()=>{expDraft[k]=g(id).checked; exNote();}; });
  [['exPaper','paper'],['exOrient','orient']].forEach(([id,k])=>{ g(id).value=expDraft[k]; g(id).onchange=()=>{expDraft[k]=g(id).value; exNote();}; });
  g('exShow').placeholder=S.name||'Untitled Project';
  g('exVenue').placeholder=S.venue||'—';
  g('exDate').placeholder=new Date().toLocaleDateString();
  exNote();
  g('exModal').classList.remove('hide');
  setTimeout(()=>g('exAuthor').focus(),40);
}
function exNote(){
  let n=0, sp=0;
  const wasFocus=focusIdx, kx=XO;
  try{ focusIdx=null; withPrint(()=>{ XO=Object.assign({},expDraft,{sheet:true}); const L=pdfSheets(XO);
    n=L.length; sp=new Set(L.filter(x=>x.page).map(x=>x.t.split(' — ')[0])).size; }); }
  catch(e){ console.error(e); }
  finally{ XO=kx; focusIdx=wasFocus; }
  const el=document.getElementById('exNote');
  el.textContent=n?`${n} sheet${n===1?'':'s'} on ${PAPERS[expDraft.paper][2]}${sp?`, ${sp} large screen${sp===1?'':'s'} split across sheets`:''}.`
    :'Nothing selected — turn on at least one page group.';
  document.getElementById('exGo').disabled=!n;
}
function runExport(){
  const g=id=>document.getElementById(id).value.trim();
  expDraft.show=g('exShow'); expDraft.venue=g('exVenue');
  expDraft.author=g('exAuthor'); expDraft.date=g('exDate'); expDraft.rev=g('exRev');
  if(expDraft.rev){ const revs=S.revs=S.revs||[], last=revs[revs.length-1];   /* revision history for the cover sheet */
    const r={rev:expDraft.rev,date:expDraft.date||new Date().toLocaleDateString(),by:expDraft.author||''};
    if(last&&last.rev===r.rev) Object.assign(last,r); else revs.push(r);
    if(revs.length>12) revs.splice(0,revs.length-12); }
  S.exp=Object.assign({},expDraft); save();
  closeMask('exModal');
  doExportPDF();
}
async function doExportPDF(){
  const b=document.getElementById('pdfBtn'); b.disabled=true; b.textContent='Building…';
  const wasFocus=focusIdx, opts=Object.assign({},expOf(),{sheet:true});
  try{
    const r=withPrint(()=>{ XO=opts; focusIdx=null; return buildSheetsPDF(opts); });
    if(!r.n){ setStatus('Nothing to export'); return; }
    download(await r.blob,fileBase()+'.pdf');
    setStatus('PDF downloaded — '+r.n+' sheets');
  }catch(e){ console.error(e); setStatus('PDF failed: '+e.message); }
  finally{ XO=null; focusIdx=wasFocus; b.disabled=false; b.textContent='PDF drawing set…'; redraw(); }
}
function exportPNG(){
  if(needScreen()) return;
  try{
    const c=withPrint(()=>{ XO=Object.assign({},expOf());
      try{ return focusIdx!=null?pairCanvas(S.screens[focusIdx]):setCanvas(null); } finally { XO=null; } });
    c.toBlob(bl=>{ download(bl,fileBase()+(focusIdx!=null?'-'+S.screens[focusIdx].name.replace(/[^a-z0-9]/gi,'_'):'')+'.png');
      setStatus('PNG downloaded — white background'); },'image/png');
  }catch(e){ console.error(e); setStatus('PNG failed: '+e.message); }
}

