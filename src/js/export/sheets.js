/* ========================= PRINT SHEETS ========================= */
/* every PDF page is a sheet: a frame, a title strip along the bottom, and one drawing fitted above it */
const SH={m:18,tb:44,in:12,minTile:22,tile:30};
let PM_SHEET=null;    /* pixel map raster, kept while the export dialog previews it */
/* black and white printers: every run gets its own line pattern instead of a colour */
const BW_INK='#262626';
const BW_DASH=[[],[7,3],[1.6,2.6],[9,3,1.6,3],[4,3.5],[12,3.5],[1.6,2.4,1.6,5.5],[6,2.5,1.6,2.5,1.6,2.5]];
const BW_TINT=[.04,.16,.09,.22];
const isBW=()=>PRINT&&!!(XO&&XO.bw);
const bwDash=i=>BW_DASH[Math.max(0,i)%BW_DASH.length];
const runIdx=(s,ch,isPower)=>chains(s,isPower?'power':'data').indexOf(ch);

function sheetArea(W,H){ const e=SH.m+SH.in; return {x:e,y:e,w:W-e*2,h:H-e*2-SH.tb+SH.in*.5}; }
/* landscape unless portrait gives the drawing clearly more room */
function pageFor(d,o){
  const [a,b]=PAPERS[o.paper]||PAPERS.letter;
  const opts=o.orient==='portrait'?[[a,b]]:o.orient==='landscape'?[[b,a]]:[[b,a],[a,b]];
  let best=null;
  opts.forEach(([W,H])=>{ const A=sheetArea(W,H), k=Math.min(A.w/d.w,A.h/d.h);
    if(!best||k>best.k*1.08) best={W,H,k,A}; });
  return best;
}
/* the drawing list, in sheet order. Nothing is painted here, so the export dialog can count it */
function pdfSheets(o){
  const L=[];
  if(o.pSet&&S.screens.length>1) ['data','power'].forEach(ly=>{
    const B=setBounds();
    L.push({t:`Set overview — ${ly==='data'?'Data':'Power'}`,d:{w:setW(B)+SETGAP*2,h:B.h+titleH(ly)+SETGAP},paint:ctx=>drawSet(ctx,{layer:ly})});
  });
  if(o.pSet&&S.screens.some(bent)) L.push({t:'Plan view',d:drawPlan(null,true),paint:ctx=>drawPlan(ctx,false)});
  if(o.pScreens) S.screens.forEach(s=>{
    const d=drawPair(null,s,true), pg=pageFor(d,o), b=sbox(s);
    if(o.split&&b.p&&s.cols*s.rows>1&&Math.min(pg.k,1.6)*b.tw<SH.minTile){ splitSheets(s,o,L); return; }
    L.push({t:`${s.name} — Data + Power`,d,pg,paint:ctx=>drawPair(ctx,s,false)});
  });
  if(o.pSummary) L.push({t:'System summary',d:drawSummary(document.createElement('canvas').getContext('2d')),top:1,paint:ctx=>drawSummary(ctx)});
  if(o.pCable) L.push({t:'Cable schedule',d:drawSchedule(document.createElement('canvas').getContext('2d')),top:1,paint:ctx=>drawSchedule(ctx)});
  if(o.pPix&&S.screens.some(x=>panelById(x.panelId))) L.push({t:'Pixel map',prep(){ const c=PM_SHEET||pmOverviewCanvas(pmBuild());
    this.d={w:c.width,h:c.height}; this.paint=ctx=>ctx.drawImage(c,0,0); }});
  if(!L.length) return L;
  if(o.cover) L.unshift({t:'Cover sheet',cover:1,d:{w:11,h:8.5}});
  return L;
}

/* ---- the frame and title strip ---- */
function drawTitleBlock(ctx,W,H,n,N,title){
  const m=SH.m, y0=H-m-SH.tb, x2=W-m;
  ctx.save();
  ctx.strokeStyle=C.head; ctx.lineWidth=.9; ctx.strokeRect(m,m,W-m*2,H-m*2);
  ctx.beginPath(); ctx.moveTo(m,y0); ctx.lineTo(x2,y0); ctx.stroke();
  const by=XO&&XO.author||'—', rev=XO&&XO.rev||'—';
  const cells=[{l:'Wall Mapper',v:titleShow(),w:3,f:700},{l:'Drawing',v:title,w:3.2,f:600},{l:'Venue',v:titleVenue()||'—',w:2.2},
    {l:'Drawn by',v:by,w:1.5},{l:'Date',v:titleDate(),w:1.3},{l:'Rev',v:rev,w:.7},{l:'Sheet',w:1.1,sheet:1}];
  if(W<700) cells.splice(2,1);                     /* portrait Letter / A4: venue lives on the cover */
  const tot=cells.reduce((a,c)=>a+c.w,0), uw=(W-m*2)/tot;
  let x=m;
  cells.forEach((c,i)=>{
    const w=c.w*uw;
    if(i){ ctx.strokeStyle=C.line; ctx.lineWidth=.6; ctx.beginPath(); ctx.moveTo(x,y0); ctx.lineTo(x,H-m); ctx.stroke(); }
    capTxt(ctx,c.l,x+8,y0+13,6.2,C.faint);
    if(c.sheet){
      ctx.font=`700 17px ${FS}`; const nw=ctx.measureText(String(n)).width;
      txt(ctx,String(n),x+8,y0+34,`700 17px ${FS}`,C.head);
      txt(ctx,`of ${N}`,x+12+nw,y0+34,`500 9px ${FS}`,C.sub);
    } else {
      const f=`${c.f||500} ${c.f?10.5:9.5}px ${FS}`, v=String(c.v);
      if(textW(v,f)<=w-14) fitTxt(ctx,v,x+8,y0+31,w-14,f,C.head);
      else { const f2=`${c.f||500} 8.5px ${FS}`;                 /* long names take two lines */
        wrapLines(v,w-14,f2,2).forEach((l,j)=>fitTxt(ctx,l,x+8,y0+25+j*10.5,w-14,f2,C.head)); }
    }
    x+=w;
  });
  ctx.restore();
}

/* ---- cover sheet: what the set is, what is in it, and how it has changed ---- */
function drawCover(ctx,A,L){
  const o=opt(), st=setTotalsCalc();
  let y=A.y;
  capTxt(ctx,'LED video wall  ·  drawing set',A.x,y+8,7.5,C.faint);
  fitTxt(ctx,titleShow(),A.x,y+38,A.w,`600 28px ${FD}`,C.head);
  if(titleVenue()) fitTxt(ctx,titleVenue(),A.x,y+57,A.w,`500 12px ${FS}`,C.sub);
  const facts=[['Date',titleDate()],['Drawn by',XO.author||'—'],['Revision',XO.rev||'—'],
    ['Screens',String(S.screens.length)],['Tiles',String(st.tiles)]];
  if(wantWeight()) facts.push(['Weight',lbFmt(st.lb)]);
  if(wantLoad()) facts.push(['Load',`${(st.wMax/1000).toFixed(1)} kW max`]);
  facts.push(['Sheets',String(L.length)]);
  y+=86; y+=drawFacts(ctx,A.x,y,A.w,facts);
  ctx.strokeStyle=C.line; ctx.lineWidth=.8; ctx.beginPath(); ctx.moveTo(A.x,y-6); ctx.lineTo(A.x+A.w,y-6); ctx.stroke();

  /* index and revisions share the bottom; the set overview takes what is left */
  const revs=(S.revs||[]).slice(-8);
  const nIdx=L.length, rowH=Math.max(10.5,Math.min(14,(A.h*.42-28)/Math.max(nIdx,revs.length||1)));
  const botH=28+Math.max(nIdx,revs.length||1)*rowH;
  const ovY=y+12, SB=setBounds(), ovH=Math.min(A.h-(ovY-A.y)-botH-22,14+SB.h*Math.min(A.w/SB.w,1.2));
  if(ovH>60){
    capTxt(ctx,'Set overview  ·  data',A.x,ovY+4,7,C.faint);
    coverOverview(ctx,{x:A.x,y:ovY+14,w:A.w,h:ovH-14});
  }
  const by=ovH>60?ovY+ovH+26:ovY, iw=A.w*.56, rx=A.x+iw+24, rw=A.w-iw-24;
  capTxt(ctx,'Drawing index',A.x,by+4,7,C.faint);
  capTxt(ctx,'Revisions',rx,by+4,7,C.faint);
  ctx.strokeStyle=C.line; ctx.lineWidth=.6;
  [[A.x,iw],[rx,rw]].forEach(([x,w])=>{ ctx.beginPath(); ctx.moveTo(x,by+10); ctx.lineTo(x+w,by+10); ctx.stroke(); });
  const fs=Math.min(9.5,rowH*.7), f=`500 ${fs.toFixed(2)}px ${FS}`;
  L.forEach((sh,i)=>{ const ry=by+24+i*rowH;
    txt(ctx,String(i+1).padStart(2,'0'),A.x,ry,`600 ${fs.toFixed(2)}px ${FS}`,C.faint);
    fitTxt(ctx,sh.t,A.x+26,ry,iw-34,f,C.head);
  });
  const rc=[0,.2,.52], rows=revs.length?revs:[{rev:XO.rev||'—',date:titleDate(),by:XO.author||''}];
  ['Rev','Date','Drawn by'].forEach((h,i)=>capTxt(ctx,h,rx+rw*rc[i],by+19,6,C.faint));
  rows.forEach((r,i)=>{ const ry=by+24+(i+1)*rowH-2;
    [r.rev,r.date,r.by||'—'].forEach((v,j)=>fitTxt(ctx,String(v),rx+rw*rc[j],ry,rw*((rc[j+1]||1)-rc[j])-8,f,j?C.sub:C.head)); });
}
function coverOverview(ctx,R){
  const B=setBounds(), list=visible(); if(!list.length) return;
  const k=Math.min(R.w/B.w,R.h/B.h,1.2), o=opt(), keep={p:o.showPower,d:o.showData}, kx=Object.assign({},XO);
  o.showPower=false; o.showData=true;
  Object.assign(XO,{legend:false,nums:false,refs:false,hops:false});
  ctx.save(); ctx.translate(R.x+(R.w-B.w*k)/2,R.y); ctx.scale(k,k); ctx.translate(-B.x1,-B.y1);
  list.forEach(s=>{ const b=sbox(s), p=posOf(s,B); ctx.save(); ctx.translate(p.x,p.y); drawScreen(ctx,s,b,false,true,false); ctx.restore(); });
  ctx.restore();
  Object.assign(XO,kx); o.showPower=keep.p; o.showData=keep.d;
}

/* ---- big walls: windows of whole tiles, one tile of overlap, match lines between sheets ---- */
function splitSheets(s,o,L){
  ['data','power'].forEach(ly=>{
    const op=opt(), keep={p:op.showPower,d:op.showData};
    op.showPower=ly==='power'; op.showData=ly==='data';
    const b=sbox(s), groups=XO.legend?legendGroups(s,ly==='power',ly==='data'):[];
    op.showPower=keep.p; op.showData=keep.d;
    const pg=pageFor({w:b.gw,h:b.gh+b.leg+60},o), A=pg.A, HB=66;
    let k=SH.tile/b.tw;
    const legH=kk=>{ const per=Math.max(1,Math.floor((A.w/kk-PAD*2)/168)); return groups.length?legendSize(groups,per)*kk+6:0; };
    const availH=()=>A.h-HB-legH(k)-4;
    const k2=availH()/b.gh;                                      /* every row on one sheet if the tiles stay readable */
    if(k2*b.tw>=SH.minTile) k=Math.min(k,k2);
    const fit=(av,t)=>Math.max(1,Math.floor((av/k+GAP)/(t+GAP)));
    const nc=Math.min(s.cols,Math.max(2,fit(A.w,b.tw))), nr=Math.min(s.rows,fit(availH(),b.th));
    const starts=(n,w)=>{ if(w>=n) return [{c:0,w:n}];                  /* even windows sharing one tile at each match line */
      const ov=w>2?1:0, m=Math.ceil((n-ov)/(w-ov)), ww=Math.ceil((n+ov*(m-1))/m);
      return [...new Set(Array.from({length:m},(_,i)=>Math.min(i*(ww-ov),n-ww)))].map(c=>({c,w:ww})); };
    const cs=starts(s.cols,nc), rs=starts(s.rows,nr), W=[];
    rs.forEach((r,ri)=>cs.forEach((c,ci)=>W.push({c0:c.c,c1:Math.min(s.cols,c.c+c.w)-1,r0:r.c,r1:Math.min(s.rows,r.c+r.w)-1,ci,ri})));
    W.forEach(w=>{
      const sh={t:`${s.name} — ${ly==='data'?'Data':'Power'} ${W.length>1?`part ${W.indexOf(w)+1} of ${W.length}`:''}`.trim(),pg,page:1};
      w.sh=sh; sh.paint=(ctx,A2,LL)=>paintWindow(ctx,A2,LL,s,b,ly,w,W,k,HB,groups);
      L.push(sh);
    });
  });
}
function paintWindow(ctx,A,L,s,b,ly,w,W,k,HB,groups){
  const op=opt(), keep={p:op.showPower,d:op.showData}, sp=ly==='power', sd=!sp;
  op.showPower=sp; op.showData=sd;
  const pitchX=b.tw+GAP, pitchY=b.th+GAP, x0=gridX(b), y0=HEADH+PAD;
  const gx=c=>x0+c*pitchX, gy=r=>y0+r*pitchY;
  const ww=(w.c1-w.c0+1)*pitchX-GAP, wh=(w.r1-w.r0+1)*pitchY-GAP;
  const ox=A.x+Math.max(0,(A.w-ww*k)/2), oy=A.y+HB;
  const P=(x,y)=>({x:ox+(x-gx(w.c0))*k,y:oy+(y-gy(w.r0))*k});
  const acc=sp?C.warn:C.dataAcc;
  /* header: what this is and where it sits */
  const cn=c=>op.rear?s.cols-c:c+1, ca=cn(w.c0), cb=cn(w.c1);
  capTxt(ctx,sp?'Power map':'Data map',A.x,A.y+8,7.5,ink(acc));
  fitTxt(ctx,s.name,A.x,A.y+28,A.w-180,`600 17px ${FD}`,C.head);
  const sub=[`Columns C${Math.min(ca,cb)}–C${Math.max(ca,cb)} of ${s.cols}`,`Rows R${w.r0+1}–R${w.r1+1} of ${s.rows}`,
    `Part ${W.indexOf(w)+1} of ${W.length}`,op.rear?'Rear view':'Front view'];
  fitTxt(ctx,sub.join('   ·   '),A.x,A.y+42,A.w-180,`500 9px ${FS}`,C.sub);
  /* key plan */
  const kw=Math.min(150,A.w*.25), kk=Math.min(kw/b.gw,36/b.gh), kx=A.x+A.w-b.gw*kk, ky=A.y+6;
  capTxt(ctx,'Key plan',kx-8,ky+8,6.2,C.faint,'right');
  ctx.save(); ctx.fillStyle=C.tile; ctx.strokeStyle=C.sub; ctx.lineWidth=.6;
  ctx.fillRect(kx,ky,b.gw*kk,b.gh*kk); ctx.strokeRect(kx,ky,b.gw*kk,b.gh*kk);
  W.forEach(v=>{ if(v===w) return; ctx.setLineDash([1.5,1.5]); ctx.strokeStyle=C.faint;
    ctx.strokeRect(kx+(gx(v.c0)-x0)*kk,ky+(gy(v.r0)-y0)*kk,((v.c1-v.c0+1)*pitchX-GAP)*kk,((v.r1-v.r0+1)*pitchY-GAP)*kk); });
  ctx.setLineDash([]); ctx.fillStyle=isBW()?BW_INK:ink(acc); ctx.globalAlpha=.85;
  ctx.fillRect(kx+(gx(w.c0)-x0)*kk,ky+(gy(w.r0)-y0)*kk,ww*kk,wh*kk); ctx.restore();

  /* the window itself */
  ctx.save(); ctx.translate(ox,oy); ctx.scale(k,k); ctx.translate(-gx(w.c0),-gy(w.r0));
  ctx.beginPath(); ctx.rect(gx(w.c0)-GAP/2,gy(w.r0)-GAP/2,ww+GAP,wh+GAP); ctx.clip();
  const kl=XO.legend; XO.legend=false;
  drawScreen(ctx,s,b,sp,sd,false);
  XO.legend=kl;
  ctx.restore();
  /* match lines through the shared tiles; the neighbour's half is washed back */
  const num=v=>L.indexOf(v.sh)+1;
  const nb=W.filter(v=>v!==w&&((v.ri===w.ri&&Math.abs(v.ci-w.ci)===1)||(v.ci===w.ci&&Math.abs(v.ri-w.ri)===1)));
  nb.forEach(v=>{
    const vert=v.ri===w.ri, lo=vert?Math.max(v.c0,w.c0):Math.max(v.r0,w.r0), hi=vert?Math.min(v.c1,w.c1):Math.min(v.r1,w.r1);
    if(hi<lo) return;
    const mid=vert?(gx(lo)+gx(hi)+b.tw)/2:(gy(lo)+gy(hi)+b.th)/2;
    const before=vert?v.c0<w.c0:v.r0<w.r0;
    const a=vert?P(mid,gy(w.r0)):P(gx(w.c0),mid);
    const e=vert?P(mid,gy(w.r0)+wh):P(gx(w.c0)+ww,mid);
    ctx.save(); ctx.fillStyle='#ffffff'; ctx.globalAlpha=.55;
    if(vert){ const xa=before?ox:a.x, xb=before?a.x:ox+ww*k; ctx.fillRect(xa,oy,xb-xa,wh*k); }
    else { const ya=before?oy:a.y, yb=before?a.y:oy+wh*k; ctx.fillRect(ox,ya,ww*k,yb-ya); }
    ctx.restore();
    ctx.save(); ctx.strokeStyle=C.head; ctx.lineWidth=1.1; ctx.setLineDash([9,3,2,3]);
    ctx.beginPath(); ctx.moveTo(a.x-(vert?0:6),a.y-(vert?6:0)); ctx.lineTo(e.x+(vert?0:6),e.y+(vert?6:0)); ctx.stroke(); ctx.restore();
    const lab=`Match line  ·  see sheet ${num(v)}`;
    if(vert) capTxt(ctx,lab,before?a.x+4:a.x-4,a.y-8,6.2,C.head,before?'left':'right');
    else { ctx.save(); ctx.translate(before?a.x-9:e.x+9,a.y); ctx.rotate(-Math.PI/2); capTxt(ctx,lab,0,before?0:6,6.2,C.head,'center'); ctx.restore(); }
  });
  ctx.save(); ctx.strokeStyle=C.sub; ctx.lineWidth=.6; ctx.strokeRect(ox-3,oy-3,ww*k+6,wh*k+6); ctx.restore();
  /* legend under the window */
  if(groups.length){
    const lw=A.w/k, per=Math.max(1,Math.floor((lw-PAD*2)/168));
    const b2=Object.assign({},b,{w:lw,gh:0,perRow:per});
    ctx.save(); ctx.translate(A.x,oy+wh*k+14); ctx.scale(k,k); ctx.translate(0,-(HEADH+PAD+PAD)+4);
    drawLegend(ctx,s,b2,sp,sd); ctx.restore();
  }
  op.showPower=keep.p; op.showData=keep.d;
}

/* ---- the whole set ---- */
function buildSheetsPDF(o){
  const L=pdfSheets(o), doc=new PdfDoc();
  L.forEach(sh=>{ if(sh.prep) sh.prep(); if(!sh.pg) sh.pg=pageFor(sh.d,o); });
  L.forEach((sh,i)=>{
    const {W,H}=sh.pg, ctx=new PdfCtx(doc,W,H);
    ctx.base=[1,0,0,-1,0,H];
    paintSheet(ctx,sh,i,L);
    doc.page(W,H,ctx);
  });
  return {blob:doc.blob(),n:L.length};
}
/* one sheet in page points, onto the PDF recorder or a preview canvas */
function paintSheet(ctx,sh,i,L){
  const {W,H,A}=sh.pg;
  ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,W,H);
  if(sh.cover) drawCover(ctx,A,L);
  else if(sh.page) sh.paint(ctx,A,L);
  else {
    const d=sh.d, k=Math.min(A.w/d.w,A.h/d.h,1.6);
    ctx.save(); ctx.translate(A.x+(A.w-d.w*k)/2,A.y+(sh.top?0:(A.h-d.h*k)/2)); ctx.scale(k,k);
    ctx.beginPath(); ctx.rect(0,0,d.w,d.h); ctx.clip();
    sh.paint(ctx); ctx.restore();
  }
  drawTitleBlock(ctx,W,H,i+1,L.length,sh.t);
}

/* ---- live preview in the export dialog ---- */
let exIdx=0, exTimer=null;
function exPreview(){ clearTimeout(exTimer); exTimer=setTimeout(exPaint,80); }
function exStep(d){ exIdx=Math.max(0,exIdx+d); exPaint(); }
function exPick(i){ exIdx=i; exPaint(); }
function sheetCanvas(c,sh,i,L,bw,bh){
  const {W,H}=sh.pg, z=Math.min(bw/W,bh/H), r=window.devicePixelRatio||1;
  c.width=Math.max(1,Math.round(W*z*r)); c.height=Math.max(1,Math.round(H*z*r));
  c.style.width=Math.round(W*z)+'px'; c.style.height=Math.round(H*z)+'px';
  const x=c.getContext('2d'); x.setTransform(z*r,0,0,z*r,0,0); paintSheet(x,sh,i,L);
}
function exPaint(){
  const g=id=>document.getElementById(id), stage=g('exStage');
  if(!stage||g('exModal').classList.contains('hide')) return;
  const wasFocus=focusIdx, kx=XO;
  try{ focusIdx=null; withPrint(()=>{
    XO=Object.assign({},expDraft,{sheet:true});
    const L=pdfSheets(XO), cv=g('exCv'), th=g('exThumbs');
    if(!L.length){ cv.style.display='none'; th.innerHTML=''; g('exCap').textContent='Nothing to print'; return; }
    cv.style.display='';
    L.forEach(sh=>{ if(sh.prep){ if(!PM_SHEET) PM_SHEET=pmOverviewCanvas(pmBuild()); sh.prep(); } if(!sh.pg) sh.pg=pageFor(sh.d,XO); });
    exIdx=Math.min(exIdx,L.length-1);
    const sh=L[exIdx], cs=getComputedStyle(stage);
    sheetCanvas(cv,sh,exIdx,L,stage.clientWidth-parseFloat(cs.paddingLeft)*2,stage.clientHeight-parseFloat(cs.paddingTop)*2);
    const pp=PAPERS[XO.paper]||PAPERS.letter;
    const cap=g('exCap'); cap.innerHTML='<b></b><span></span>';
    cap.firstChild.textContent=`Sheet ${exIdx+1} of ${L.length}`;
    cap.lastChild.textContent=`${sh.t}  ·  ${pp[2]} ${sh.pg.W>sh.pg.H?'landscape':'portrait'}`;
    g('exPrevB').disabled=exIdx===0; g('exNextB').disabled=exIdx===L.length-1;
    th.innerHTML='';
    L.forEach((s2,i)=>{ const c=document.createElement('canvas'); sheetCanvas(c,s2,i,L,96,62);
      c.title=`${i+1}. ${s2.t}`; if(i===exIdx) c.className='on'; c.onclick=()=>exPick(i); th.appendChild(c); });
    const on=th.children[exIdx]; if(on) on.scrollIntoView({block:'nearest',inline:'nearest'});
  }); }
  catch(e){ console.error(e); }
  finally{ XO=kx; focusIdx=wasFocus; }
}
