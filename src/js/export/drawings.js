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
function buildPDF(pages){
  const enc=new TextEncoder(), parts=[]; let len=0;
  const push=x=>{const b=(typeof x==='string')?enc.encode(x):x;parts.push(b);len+=b.length;};
  const off=[];
  push('%PDF-1.4\n'); push(new Uint8Array([0x25,0xE2,0xE3,0xCF,0xD3,0x0A]));
  const N=pages.length,pg=i=>3+i*3,im=i=>4+i*3,cn=i=>5+i*3,total=2+N*3;
  off[1]=len; push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
  off[2]=len; push(`2 0 obj\n<< /Type /Pages /Kids [${pages.map((_,i)=>pg(i)+' 0 R').join(' ')}] /Count ${N} >>\nendobj\n`);
  pages.forEach((p,i)=>{
    const PW=792,PH=612,M=16;
    const k=Math.min((PW-M*2)/p.w,(PH-M*2)/p.h), dw=p.w*k, dh=p.h*k;
    off[pg(i)]=len;
    push(`${pg(i)} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im0 ${im(i)} 0 R >> >> /Contents ${cn(i)} 0 R >>\nendobj\n`);
    off[im(i)]=len;
    push(`${im(i)} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.pw} /Height ${p.ph} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpg.length} >>\nstream\n`);
    push(p.jpg); push('\nendstream\nendobj\n');
    const cs=`q\n1 1 1 rg\n0 0 ${PW} ${PH} re f\n${dw.toFixed(2)} 0 0 ${dh.toFixed(2)} ${((PW-dw)/2).toFixed(2)} ${((PH-dh)/2).toFixed(2)} cm\n/Im0 Do\nQ\n`;
    off[cn(i)]=len;
    push(`${cn(i)} 0 obj\n<< /Length ${enc.encode(cs).length} >>\nstream\n${cs}endstream\nendobj\n`);
  });
  const xref=len;
  let x='xref\n0 '+(total+1)+'\n0000000000 65535 f \n';
  for(let i=1;i<=total;i++) x+=String(off[i]).padStart(10,'0')+' 00000 n \n';
  push(x); push(`trailer\n<< /Size ${total+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out=new Uint8Array(len); let o=0; parts.forEach(b=>{out.set(b,o);o+=b.length;});
  return new Blob([out],{type:'application/pdf'});
}
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
   ['exBackup','backup'],['exWeight','weight'],['exLoad','load']]
    .forEach(([id,k])=>{ g(id).checked=!!expDraft[k]; g(id).onchange=()=>{expDraft[k]=g(id).checked; exNote();}; });
  g('exShow').placeholder=S.name||'Untitled Project';
  g('exVenue').placeholder=S.venue||'—';
  g('exDate').placeholder=new Date().toLocaleDateString();
  exNote();
  g('exModal').classList.remove('hide');
  setTimeout(()=>g('exAuthor').focus(),40);
}
function exNote(){
  let n=0;
  if(expDraft.pSet&&S.screens.length>1) n+=2;
  if(expDraft.pSet&&S.screens.some(bent)) n+=1;
  if(expDraft.pScreens) n+=S.screens.length;
  if(expDraft.pSummary) n+=1;
  if(expDraft.pCable) n+=1;
  if(expDraft.pPix&&S.screens.some(x=>panelById(x.panelId))) n+=1;
  const el=document.getElementById('exNote');
  el.textContent=n?`${n} page${n===1?'':'s'} will be produced, white background.`
    :'Nothing selected — turn on at least one page group.';
  document.getElementById('exGo').disabled=!n;
}
function runExport(){
  const g=id=>document.getElementById(id).value.trim();
  expDraft.show=g('exShow'); expDraft.venue=g('exVenue');
  expDraft.author=g('exAuthor'); expDraft.date=g('exDate'); expDraft.rev=g('exRev');
  S.exp=Object.assign({},expDraft); save();
  closeMask('exModal');
  doExportPDF();
}
function doExportPDF(){
  const b=document.getElementById('pdfBtn'); b.disabled=true; b.textContent='Building…';
  const wasFocus=focusIdx, opts=Object.assign({},expOf());
  try{
    const cvs=withPrint(()=>{
      XO=opts;
      const out=[];
      focusIdx=null;
      if(opts.pSet&&S.screens.length>1){ out.push(setCanvas('data')); out.push(setCanvas('power')); }
      if(opts.pSet&&S.screens.some(bent)) out.push(planCanvas());
      if(opts.pScreens) S.screens.forEach(sn=>out.push(pairCanvas(sn)));
      if(opts.pSummary) out.push(summaryCanvas());
      if(opts.pCable) out.push(scheduleCanvas());
      if(opts.pPix&&S.screens.some(x=>panelById(x.panelId))) out.push(pmOverviewCanvas(pmBuild()));
      return out;
    });
    if(!cvs.length){ setStatus('Nothing to export'); return; }
    const pages=cvs.map(c=>({jpg:b64ToBytes(c.toDataURL('image/jpeg',0.95).split(',')[1]),
      pw:c.width,ph:c.height,w:c.width,h:c.height}));
    download(buildPDF(pages),fileBase()+'.pdf');
    setStatus('PDF downloaded — '+pages.length+' pages');
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

