/* ========================= CABLE LABELS ========================= */
/* Tuned for the Brother P-touch CUBE Plus (PT-P710BT): 180 dpi, full auto cutter,
   18 mm maximum print height. Each tape width prints in a narrower central band,
   so every element is kept inside that band. Sizes are real millimetres; each tag
   prints as its own page so the auto cutter separates them. */
const TAPES={
  '12':{h:12,band:9.9, label:'12 mm tape',lines:2,id:17,tx:9},
  '18':{h:18,band:15.8,label:'18 mm tape',lines:3,id:24,tx:10},
  '24':{h:24,band:18,  label:'24 mm tape',lines:4,id:26,tx:9.2},
  'sheet':{h:18,band:15.8,label:'Letter sheet (laser, cut out)',lines:3,id:22,tx:9,sheet:1}
};
const WRAPS={
  auto:{mm:0,label:'Auto · fits the cable'},
  cat6:{mm:25,label:'Cat6 · 25 mm'},
  power:{mm:40,label:'Power tail · 40 mm'},
  soca:{mm:75,label:'Socapex · 75 mm'},
  custom:{mm:0,label:'Custom'}
};
const CASSETTE_MM=8000, LEADER_MM=25;
const defLab=()=>({v:2,tape:'12',per:2,power:true,data:true,backup:true,
  showScreen:true,showFar:true,showLoad:false,showProject:false,
  style:'flag',face:38,wrap:'auto',wrapMm:40,guides:true,orient:'land',ptChain:false,ptRot180:false,ptMirror:false});
function labOf(){
  S.lab=S.lab||{};
  if(S.lab.v!==2){                          /* move older projects onto the P710BT defaults */
    const keep={}; ['per','power','data','backup','showScreen','showFar','showLoad','showProject']
      .forEach(k=>{ if(k in S.lab) keep[k]=S.lab[k]; });
    S.lab=Object.assign(defLab(),keep);
  }
  const d=defLab(); for(const k in d) if(!(k in S.lab)) S.lab[k]=d[k];
  if(!TAPES[S.lab.tape]) S.lab.tape='12';
  if(!WRAPS[S.lab.wrap]) S.lab.wrap='auto';
  return S.lab;
}
function wrapMm(){
  const L=labOf();
  if(L.wrap==='custom') return Math.max(5,+L.wrapMm||40);
  if(L.wrap==='auto') return L.power?WRAPS.power.mm:WRAPS.cat6.mm;   /* the thickest cable in the job */
  return WRAPS[L.wrap].mm;
}
function tagSize(){
  const L=labOf(), T=TAPES[L.tape], face=Math.max(20,+L.face||38);
  const wrap=L.style==='flag'?wrapMm():0;
  return {h:T.h, band:T.band, face, wrap, w:L.style==='flag'?face*2+wrap:face};
}

/* one entry per physical cable end */
function labelRows(){
  const L=labOf(), out=[];
  const proj=titleShow();
  cableRows().forEach(r=>{
    if(r.kind==='Power'&&!L.power) return;
    if(r.kind==='Data'&&!L.data) return;
    if(r.kind==='Backup'&&!L.backup) return;
    const trim=t=>String(t||'').replace(r.screen+' ','');
    /* short wording so the text can be large; the full detail stays in the CSV */
    let src=r.from;
    if(r.kind==='Power') src='DISTRO';
    else { const m=String(r.from).match(/^(.*?)\s*·\s*Port/); if(m) src=m[1]; }
    const mk=(end,far,full)=>({id:r.id,kind:r.kind,screen:r.screen,project:proj,
      end,far,farFull:full,load:r.load,colour:r.color,spec:r.spec});
    out.push(mk('SOURCE','TO '+trim(r.to),'TO '+r.to));   /* at the distro / processor end */
    out.push(mk('LOAD','FROM '+src,'FROM '+r.from));      /* at the panel end */
  });
  const dup=[];
  out.forEach(o=>{ for(let i=0;i<Math.max(1,Math.round((L.per||2)/2));i++) dup.push(o); });
  return dup;
}
function labelLines(o){
  const L=labOf(), lines=[];
  if(L.showScreen) lines.push(o.screen);
  if(L.showFar) lines.push(o.far);
  if(L.showLoad&&o.load) lines.push(o.load);
  if(L.showProject) lines.push(o.project);
  return lines;
}
const _mc=document.createElement('canvas').getContext('2d');
function textMm(t,pt,bold){ _mc.font=(bold?'700 ':'400 ')+'100px Arial, Helvetica, sans-serif';
  return _mc.measureText(t).width/100*pt*0.3528; }
function fitPt(t,pt,bold,availMm){ const w=textMm(t,pt,bold); return w<=availMm?pt:Math.max(pt*0.62,pt*availMm/w); }
/* Lay out a tag face: keep text as large as possible, let long lines continue onto the
   next line when the tape has room, and only then step the size down. Nothing is cut off. */
const LINE_H=1.18, TEXT_SAFE=0.8;
/* Split one line of words across the fewest lines that fit, keeping the pieces balanced
   (so "FROM Processor #1" becomes "FROM" / "Processor #1", never a stranded "#1").
   Returns null if a single word is wider than the space. */
function wrapBalanced(t,pt,bold,maxMm,maxLines){
  const w=String(t).split(/\s+/).filter(Boolean);
  if(!w.length) return [''];
  if(w.some(x=>textMm(x,pt,bold)>maxMm)) return null;
  const width=(i,j)=>textMm(w.slice(i,j).join(' '),pt,bold);
  for(let k=1;k<=Math.min(maxLines,w.length);k++){
    let best=null;
    const go=(start,left,acc,mx)=>{
      if(left===1){ const wd=width(start,w.length); const m=Math.max(mx,wd);
        if(wd<=maxMm&&(!best||m<best.m)) best={m,parts:[...acc,w.slice(start).join(' ')]}; return; }
      for(let e=start+1;e<=w.length-(left-1);e++){
        const wd=width(start,e); if(wd>maxMm) break;
        go(e,left-1,[...acc,w.slice(start,e).join(' ')],Math.max(mx,wd));
      }
    };
    go(0,k,[],0);
    if(best) return best.parts;
  }
  return null;
}
function breakChars(t,pt,bold,maxMm){               /* last resort only */
  const out=[]; let cur='';
  for(const ch of String(t)){ if(textMm(cur+ch,pt,bold)<=maxMm) cur+=ch; else { out.push(cur); cur=ch.trim()?ch:''; } }
  if(cur) out.push(cur); return out;
}
function tagLayout(o){
  const L=labOf(), T=TAPES[L.tape], z=tagSize();
  const id=o.id+(o.kind==='Backup'?' BK':'');
  const idPt=Math.max(T.id*0.5,Math.min(T.id,T.id*(z.face*0.34-2.6)/Math.max(0.1,textMm(id,T.id,true))));
  const idW=textMm(id,idPt,true)+2.6;
  const availW=z.face-3.2-idW-1.6-TEXT_SAFE;
  const availH=T.band-0.6;
  const src=labelLines(o).slice(0,T.lines);
  const lineMm=pt=>pt*0.3528*LINE_H;
  const maxRows=pt=>Math.max(1,Math.floor(availH/lineMm(pt)));
  /* largest size that works with each line kept whole, and with balanced wrapping */
  const attempt=(pt,allowWrap)=>{
    const rows=maxRows(pt); let used=0; const lines=[];
    for(let i=0;i<src.length;i++){
      const bold=i===0, room=rows-used-(src.length-1-i);
      if(room<1) return null;
      const parts=allowWrap?wrapBalanced(src[i],pt,bold,availW,room)
        :(textMm(src[i],pt,bold)<=availW?[src[i]]:null);
      if(!parts) return null;
      parts.forEach(t=>lines.push({t,b:bold,pt})); used+=parts.length;
    }
    return lines;
  };
  /* try every size; score = text size, minus a cost for each extra wrapped line and each stranded fragment */
  let best=null;
  for(let f=1;f>=0.42;f-=0.02){
    const pt=T.tx*f, lines=attempt(pt,true); if(!lines) continue;
    const extra=lines.length-src.length;
    let orphans=0;
    lines.forEach((l,k)=>{ const prev=lines[k-1];
      if(prev&&prev.b===l.b&&textMm(l.t,pt,l.b)<availW*0.3) orphans++; });
    const score=pt*(1-0.1*extra-0.14*orphans);
    if(!best||score>best.score) best={score,lines};
  }
  let lines;
  if(best) lines=best.lines;
  else {                                                            /* a word too long even at the smallest size */
    const pt=T.tx*0.42; lines=[];
    src.forEach((t,i)=>(wrapBalanced(t,pt,i===0,availW,9)||breakChars(t,pt,i===0,availW)).forEach(x=>lines.push({t:x,b:i===0,pt})));
  }
  return {id,idPt,idW,availW,lines};
}
function tagFace(o){
  const Lo=tagLayout(o);
  return `<div class="lf"><div class="lf-id" style="font-size:${Lo.idPt.toFixed(2)}pt">${escp(Lo.id)}</div>`
    +`<div class="lf-tx">${Lo.lines.map(l=>
        `<span class="${l.b?'a':''}" style="font-size:${l.pt.toFixed(2)}pt">${escp(l.t)}</span>`).join('')}</div></div>`;
}
function tagHTML(o){
  const L=labOf(), z=tagSize(), pad=((z.h-z.band)/2).toFixed(2);
  const face=`<div class="lt-face" style="width:${z.face}mm;padding-top:${pad}mm;padding-bottom:${pad}mm">${tagFace(o)}</div>`;
  const mid=L.style==='flag'
    ?`<div class="lt-wrap ${L.guides?'g':''}" style="width:${z.wrap}mm"></div>${face}`:'';
  return `<div class="lt" style="width:${z.w}mm;height:${z.h}mm">${face}${mid}</div>`;
}
function labelSheetHTML(onlyFirst){
  const L=labOf(); let rows=labelRows();
  if(!rows.length) return '<div class="lb-empty">Nothing to print — map some circuits or data runs first.</div>';
  if(onlyFirst) rows=rows.slice(0,1);
  if(TAPES[L.tape].sheet) return `<div class="lb-grid">${rows.map(tagHTML).join('')}</div>`;
  return rows.map(o=>`<div class="lb-page">${tagHTML(o)}</div>`).join('');
}
function labelCSS(){
  const L=labOf(), z=tagSize();
  if(TAPES[L.tape].sheet)
    return `@page{size:letter;margin:10mm}
      .lb-grid{display:flex;flex-wrap:wrap;gap:3mm}
      .lb-grid .lt{outline:0.2mm solid #bbb}`;
  if(L.orient==='rot')   /* page is tape-width wide and label-length tall; the tag is turned to match */
    return `@page{size:${z.h}mm ${z.w}mm;margin:0}
      .lb-page{width:${z.h}mm;height:${z.w}mm;position:relative;overflow:hidden;break-after:page;page-break-after:always}
      .lb-page:last-child{break-after:auto;page-break-after:auto}
      .lb-page .lt{position:absolute;top:0;left:0;transform-origin:top left;transform:translateY(${z.w}mm) rotate(-90deg)}`;
  return `@page{size:${z.w}mm ${z.h}mm;margin:0}
    .lb-page{width:${z.w}mm;height:${z.h}mm;overflow:hidden;break-after:page;page-break-after:always}
    .lb-page:last-child{break-after:auto;page-break-after:auto}`;
}
function printLabels(testOnly){
  const n=labelRows().length;
  if(!n){ setStatus('Nothing to print yet'); return; }
  document.getElementById('printSheet').innerHTML=labelSheetHTML(!!testOnly);
  document.getElementById('printCSS').textContent=labelCSS();
  document.body.classList.add('printing');
  const z=tagSize();
  setStatus(testOnly?`Test tag · ${z.w} × ${z.h} mm — check the print, then print the rest`
    :`${n} tags · ${z.w} × ${z.h} mm each — sent to the print dialog`);
  const done=()=>{ document.body.classList.remove('printing'); window.removeEventListener('afterprint',done); };
  window.addEventListener('afterprint',done);
  setTimeout(()=>{ window.print(); setTimeout(done,500); },60);
}
function labelsCSV(){
  const rows=labelRows();
  const head=['ID','Type','End','Screen','Goes to','Load','Cable','Project'];
  const esc2=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
  const body=rows.map(o=>[o.id,o.kind,o.end,o.screen,o.farFull||o.far,o.load,o.spec+' ft',o.project].map(esc2).join(','));
  download(new Blob([[head.map(esc2).join(','),...body].join('\r\n')],{type:'text/csv'}),
    fileBase()+' labels.csv');
  setStatus('Label CSV exported — merge it in P-touch Editor or DYMO Connect');
}
function openLabels(){ document.getElementById('lbModal').classList.remove('hide'); syncLabels(); }
function setLab(f,v){ labOf()[f]=v; syncLabels(); save(); }
function syncLabels(){
  const L=labOf(), g=id=>document.getElementById(id), z=tagSize();
  const t=g('lbTape');
  if(!t.options.length) t.innerHTML=Object.entries(TAPES).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('');
  t.value=L.tape;
  const w=g('lbWrap');
  if(!w.options.length) w.innerHTML=Object.entries(WRAPS).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('');
  w.value=L.wrap;
  g('lbStyle').value=L.style; g('lbPer').value=String(L.per>=4?4:2); g('lbOrient').value=L.orient;
  g('lbWrapMm').value=wrapMm(); g('lbWrapMm').disabled=L.wrap!=='custom';
  const wo=g('lbWrap').querySelector('option[value=auto]');
  if(wo) wo.textContent=`Auto (${wrapMm()} mm)`;
  g('lbFace').value=L.face;
  ['power','data','backup','showScreen','showFar','showLoad','showProject','guides'].forEach(k=>{
    const el=g('lb_'+k); if(el) el.checked=!!L[k]; });
  g('lbFlagOpts').style.opacity=L.style==='flag'?'':'.45';
  g('lbFlagOpts').style.pointerEvents=L.style==='flag'?'':'none';
  const rows=labelRows(), n=rows.length;
  g('lbCount').textContent=n?`${n} tag${n===1?'':'s'}`:'';
  g('lbGo').disabled=!n;
  g('ptGo').textContent=n?`Print ${n} tag${n===1?'':'s'} to CUBE Plus`:'Print to CUBE Plus';
  ['ptChain','ptRot180','ptMirror'].forEach(k=>{ const el=g('lb_'+k); if(el) el.checked=!!L[k]; });
  ptUI();
  if(!n||TAPES[L.tape].sheet){ g('ptGo').disabled=true; g('ptTest').disabled=true; }
  const fitPx=660, pxW=z.w*3.78;
  const scale=Math.min(1.6,fitPx/pxW);
  g('lbPrev').innerHTML=n
    ? `<div style="zoom:${scale.toFixed(3)}">${rows.map(o=>`<div class="lb-prevtag">${tagHTML(o)}</div>`).join('')}</div>`
    : '<div class="lb-empty">Nothing to print — map some circuits or data runs first.</div>';
  const sheet=TAPES[L.tape].sheet;
  const used=n*z.w+LEADER_MM, loose=n*(z.w+LEADER_MM);
  g('lbSize').textContent=sheet
    ? `${z.w} × ${z.h} mm per tag, laid out on letter paper for cutting.`
    : `Each tag is ${z.w} × ${z.h} mm and cuts off on its own. `
      +(L.style==='flag'?`The middle ${z.wrap} mm wraps the cable and the faces stick back to back. `:'')
      +`Printing ${n} uses about ${((n*(z.w+4)+LEADER_MM)/1000).toFixed(1)} m of tape — `
      +`roughly ${Math.floor((CASSETTE_MM-LEADER_MM)/(z.w+4))} tags per 8 m cassette.`;
}
