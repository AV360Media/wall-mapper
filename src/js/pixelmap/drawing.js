/* ---- festival-style drawing: checkerboarded cabinets, numbers, circle and diagonals, fitted labels ---- */
function pmShade(hex,k){ const n=parseInt(hex.slice(1),16);
  const c=v=>Math.max(0,Math.min(255,Math.round(v*k))); return `rgb(${c((n>>16)&255)},${c((n>>8)&255)},${c(n&255)})`; }
function pmDead(ctx,W,H){
  ctx.save(); ctx.beginPath(); ctx.rect(0,0,W,H); ctx.clip();   /* keep the hatching inside the canvas */
  ctx.fillStyle='#0c0c0e'; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='#17171c'; ctx.lineWidth=2; ctx.beginPath();
  for(let k=-H;k<W;k+=120){ ctx.moveTo(k,H); ctx.lineTo(k+H,0); } ctx.stroke();
  ctx.restore();
}
/* ---- test patterns: every pixel map image is drawn with these ---- */
const PM_PALETTES={
  vivid:['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16','#06b6d4','#a855f7','#eab308'],
  neon:['#00e5ff','#ff2bd6','#c6ff00','#ff9100','#7c4dff','#00ff95','#ff1744','#ffea00','#2979ff','#f50057','#76ff03','#d500f9'],
  pastel:['#93c5fd','#86efac','#fcd34d','#fca5a5','#c4b5fd','#f9a8d4','#5eead4','#fdba74','#bef264','#67e8f9','#d8b4fe','#fde68a'],
  mono:['#f4f4f5','#d4d4d8','#a1a1aa','#e4e4e7','#c4c4cc','#b4b4bc']
};
const PM_PATTERNS=[['cabinets','Panel IDs'],['grid','Alignment'],['pixel','Pixel check'],['bars','Colour bars'],['grey','Greyscale'],['fields','RGBW fields']];
const PM_OLD={classic:'cabinets',spectrum:'bars',outline:'grid'};   /* patterns from older projects */
const pmPat=k=>{ k=PM_OLD[k]||k; return PM_PATTERNS.some(p=>p[0]===k)?k:'cabinets'; };
const pmCol=i=>{ const P=PM_PALETTES[pmOf().palette]||PM_PALETTES.vivid; return P[i%P.length]; };
function pmRGBA(hex,a){ const n=parseInt(hex.slice(1),16); return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`; }

/* tiny repeat tiles for the pixel check: 1 px verticals, 1 px horizontals, 1 px and 2 px checkers */
const PM_TILES={};
function pmTile(m){
  if(PM_TILES[m]) return PM_TILES[m];
  const n=m===3?4:2, c=document.createElement('canvas'); c.width=c.height=n; const x=c.getContext('2d');
  x.fillStyle='#000'; x.fillRect(0,0,n,n); x.fillStyle='#fff';
  if(m===0) x.fillRect(0,0,1,2); else if(m===1) x.fillRect(0,0,2,1);
  else if(m===2){ x.fillRect(0,0,1,1); x.fillRect(1,1,1,1); } else { x.fillRect(0,0,2,2); x.fillRect(2,2,2,2); }
  return PM_TILES[m]=c;
}
/* the pattern itself, inside x,y,W,H, with cabinets cw × ch; lines land on whole LED pixels */
function pmPaint(ctx,o,x,y,style){
  style=pmPat(style);
  const s=o.s, W=o.W, H=o.H, cw=o.cw, ch=o.ch, col=o.col, cols=s.cols, rows=s.rows;
  const u=Math.max(1,Math.min(cw,ch)/64);                  /* line weight that scales with the cabinet */
  const px=Math.max(1,Math.round(u*.6));                   /* thin lines: 1 LED pixel on most panels */
  const vl=(xx,c,w)=>{ ctx.fillStyle=c; ctx.fillRect(Math.round(xx),y,w,H); };
  const hl=(yy,c,w)=>{ ctx.fillStyle=c; ctx.fillRect(x,Math.round(yy),W,w); };
  const ring=(r,stroke,lw)=>{ ctx.strokeStyle=stroke; ctx.lineWidth=lw; ctx.beginPath(); ctx.arc(x+W/2,y+H/2,r,0,Math.PI*2); ctx.stroke(); };
  const seams=(c,w)=>{ for(let i=1;i<cols;i++) vl(x+i*cw-w,c,w*2); for(let j=1;j<rows;j++) hl(y+j*ch-w,c,w*2); };
  const fs=Math.max(8,Math.min(cw,ch)*.13);
  const txt=(t,tx,ty,sz,c,al)=>{ ctx.font=`700 ${sz}px ${FS}`; ctx.fillStyle=c; ctx.textAlign=al||'center'; ctx.textBaseline='middle'; ctx.fillText(t,tx,ty); };
  ctx.save(); ctx.beginPath(); ctx.rect(x,y,W,H); ctx.clip();
  if(style==='grid'){                                       /* alignment: every panel edge lit, centre lines, circles, diagonals */
    ctx.fillStyle='#000'; ctx.fillRect(x,y,W,H);
    for(let i=0;i<cols;i++) for(let j=0;j<rows;j++){ const cx=x+i*cw, cy=y+j*ch;
      ctx.fillStyle='rgba(255,255,255,.08)'; if((i+j)%2) ctx.fillRect(cx,cy,cw,ch);
      ctx.strokeStyle='#fff'; ctx.lineWidth=px; ctx.strokeRect(cx+px/2,cy+px/2,cw-px,ch-px);   /* each panel's own outer pixels */
      const k=Math.min(cw,ch)*.12; ctx.fillStyle=pmRGBA(col,.9);
      ctx.fillRect(Math.round(cx+cw/2-k),Math.round(cy+ch/2),Math.round(k*2),px); ctx.fillRect(Math.round(cx+cw/2),Math.round(cy+ch/2-k),px,Math.round(k*2)); }
    vl(x+W/2-px/2,col,px*2); hl(y+H/2-px/2,col,px*2);
    ctx.strokeStyle=pmRGBA(col,.75); ctx.lineWidth=px*1.5; ctx.beginPath();
    ctx.moveTo(x,y); ctx.lineTo(x+W,y+H); ctx.moveTo(x,y+H); ctx.lineTo(x+W,y); ctx.stroke();
    const R=Math.min(W,H)/2; [.98,.66,.33].forEach((k,i)=>ring(R*k,i?pmRGBA('#ffffff',.7):'#fff',px*(i?2:3)));
  } else if(style==='pixel'){                               /* 1:1 check: fine lines and checkers shimmer if anything scales */
    ctx.fillStyle='#000'; ctx.fillRect(x,y,W,H); ctx.fillStyle='#fff';
    for(let i=0;i<cols;i++) for(let j=0;j<rows;j++){
      const cx=x+i*cw, cy=y+j*ch, hw=Math.floor(cw/2), hh=Math.floor(ch/2), q=(i+j)%2;
      const A=[[cx,cy,hw,hh],[cx+hw,cy,cw-hw,hh],[cx,cy+hh,hw,ch-hh],[cx+hw,cy+hh,cw-hw,ch-hh]];
      A.forEach(([ax,ay,aw,ah],k)=>{ const pt=ctx.createPattern(pmTile((k+q*2)%4),'repeat');
        pt.setTransform(new DOMMatrix([1,0,0,1,ax,ay])); ctx.fillStyle=pt; ctx.fillRect(ax,ay,aw,ah); });
    }
    seams(col,px);
  } else if(style==='bars'){                                /* 100% bars, reverse strip, black level steps */
    const bars=['#ffffff','#ffff00','#00ffff','#00ff00','#ff00ff','#ff0000','#0000ff'], bw=W/7, bh=Math.round(H*.62);
    bars.forEach((c,i)=>{ ctx.fillStyle=c; ctx.fillRect(Math.round(x+i*bw),y,Math.ceil(bw),bh); });
    const mid=['#0000ff','#000000','#ff00ff','#000000','#00ffff','#000000','#ffffff'], mh=Math.round(H*.1);
    mid.forEach((c,i)=>{ ctx.fillStyle=c; ctx.fillRect(Math.round(x+i*bw),y+bh,Math.ceil(bw),mh); });
    const lo=['#000000','#050505','#0a0a0a','#141414','#1e1e1e','#282828','#000000'], ly=y+bh+mh;   /* black level: 0, 2, 4, 8, 12, 16% */
    lo.forEach((c,i)=>{ ctx.fillStyle=c; ctx.fillRect(Math.round(x+i*bw),ly,Math.ceil(bw),y+H-ly); });
    ['0','2','4','8','12','16'].forEach((t,i)=>txt(t+'%',x+(i+.5)*bw,ly+(y+H-ly)/2,Math.min(fs,(y+H-ly)*.3),'rgba(255,255,255,.35)'));
  } else if(style==='grey'){                                /* 11 steps on top, smooth ramps below to show banding */
    const sh=Math.round(H*.5), sw=W/11;
    for(let i=0;i<11;i++){ const v=Math.round(i*25.5); ctx.fillStyle=`rgb(${v},${v},${v})`; ctx.fillRect(Math.round(x+i*sw),y,Math.ceil(sw),sh);
      txt(i*10+'%',x+(i+.5)*sw,y+sh-Math.min(fs,sh*.12)*1.2,Math.min(fs,sw*.3,sh*.12),i>5?'#000':'#fff'); }
    const rh=(H-sh)/4;
    ['#ffffff','#ff0000','#00ff00','#0000ff'].forEach((c,i)=>{ const g=ctx.createLinearGradient(x,0,x+W,0);
      g.addColorStop(0,'#000'); g.addColorStop(1,c); ctx.fillStyle=g; ctx.fillRect(x,Math.round(y+sh+i*rh),W,Math.ceil(rh)); });
  } else if(style==='fields'){                              /* every panel a full field, so a wrong or dim panel stands out */
    const F=['#ff0000','#00ff00','#0000ff','#ffffff'];
    for(let i=0;i<cols;i++) for(let j=0;j<rows;j++){ ctx.fillStyle=F[(i+j)%4]; ctx.fillRect(x+i*cw,y+j*ch,cw,ch); }
    seams('#000',px);
  } else {                                                  /* panel IDs: checkered panels, each with its column.row */
    for(let i=0;i<cols;i++) for(let j=0;j<rows;j++){
      ctx.fillStyle=(i+j)%2?pmRGBA(col,.62):pmRGBA(col,.4); ctx.fillRect(x+i*cw,y+j*ch,cw,ch);
      ctx.fillStyle='#07080b'; ctx.globalAlpha=.55; ctx.fillRect(x+i*cw,y+j*ch,cw,ch); ctx.globalAlpha=1;
    }
    seams(pmRGBA(col,.95),Math.max(1,Math.round(u)));
    const f2=Math.min(cw*.3,ch*.3);
    for(let i=0;i<cols;i++) for(let j=0;j<rows;j++) txt(`${i+1}.${j+1}`,x+(i+.5)*cw,y+(j+.5)*ch,f2,'#fff');
  }
  /* cabinets switched off in Wall Mapper are not lit */
  (s.off||[]).forEach(t=>{ const [r,c]=t.split(':').map(Number); if(r>=rows||c>=cols) return;
    ctx.fillStyle='#050608'; ctx.fillRect(x+c*cw,y+r*ch,cw,ch);
    ctx.strokeStyle='#2a2d36'; ctx.lineWidth=u; ctx.beginPath(); ctx.moveTo(x+c*cw,y+r*ch); ctx.lineTo(x+(c+1)*cw,y+(r+1)*ch);
    ctx.moveTo(x+(c+1)*cw,y+r*ch); ctx.lineTo(x+c*cw,y+(r+1)*ch); ctx.stroke(); });
  /* top-left marker: shows straight away if a slice is flipped or rotated */
  const t=Math.min(cw,ch,W*.2,H*.2)*.55;
  ctx.fillStyle=style==='bars'||style==='grey'||style==='fields'?'#ffffff':col;
  ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+t,y); ctx.lineTo(x,y+t); ctx.closePath(); ctx.fill();
  ctx.restore();
  /* border: colour with a fine white line inside; test patterns keep the edge pixels clear, so only a thin outline */
  if(pmPat(style)==='cabinets'){
    const bw=Math.max(2,u*5);
    ctx.strokeStyle=col; ctx.lineWidth=bw; ctx.strokeRect(x+bw/2,y+bw/2,W-bw,H-bw);
    ctx.strokeStyle='rgba(255,255,255,.85)'; ctx.lineWidth=Math.max(1,u*1.2); ctx.strokeRect(x+bw+u,y+bw+u,W-2*(bw+u),H-2*(bw+u));
  } else { const bw=Math.max(1,Math.round(u)); ctx.strokeStyle=col; ctx.lineWidth=bw; ctx.strokeRect(x+bw/2,y+bw/2,W-bw,H-bw); }
}
/* labels on a rounded card */
function pmLabels(ctx,o,x,y,where,withSize){
  const size=pmOf().labels||'large'; if(size==='off') return;
  const f=({large:1,medium:.72,small:.48}[size]||1)*(o._boost||1), s=o.s, W=o.W, H=o.H, maxw=W*0.86;
  const lines=[{t:o.name.toUpperCase(),sz:Math.min(150,H*0.13)*f,w:700,fam:FS,c:'#fff'},
    {t:`${W} × ${H}`,sz:Math.min(60,H*0.058)*f,w:500,fam:FM,c:'#fff'},
    {t:`${s.cols} panel${s.cols===1?'':'s'} wide × ${s.rows} tall`,sz:Math.min(46,H*0.045)*f,w:400,fam:FS,c:'rgba(255,255,255,.75)'}];
  if(withSize) lines.push({t:`${ftIn(s.cols*o.p.wmm)} W × ${ftIn(s.rows*o.p.hmm)} H`,sz:Math.min(46,H*0.045)*f,w:500,fam:FS,c:'#9fe3ff'});
  (where||[]).forEach(t=>lines.push({t,sz:Math.min(56,H*0.054)*f,w:500,fam:FM,c:'#ffd166'}));
  lines.forEach(l=>{ for(let k=0;k<40;k++){ ctx.font=`${l.w} ${l.sz}px ${l.fam}`; if(ctx.measureText(l.t).width<=maxw||l.sz<5) break; l.sz*=.93; } });
  const gap=f*Math.min(10,H*.01), pad=Math.max(8,Math.min(40,H*.035))*f;
  let tw=0, th=0;
  lines.forEach(l=>{ ctx.font=`${l.w} ${l.sz}px ${l.fam}`; tw=Math.max(tw,ctx.measureText(l.t).width); th+=l.sz*1.22+gap; }); th-=gap;
  if(th+pad*1.8>H*.94){ const r=(H*.94-pad*1.8)/th; lines.forEach(l=>l.sz*=Math.max(.3,r)); th=lines.reduce((a,l)=>a+l.sz*1.22+gap,0)-gap;
    tw=0; lines.forEach(l=>{ ctx.font=`${l.w} ${l.sz}px ${l.fam}`; tw=Math.max(tw,ctx.measureText(l.t).width); }); }
  const cw=Math.min(W*.94,tw+pad*2.4), chh=Math.min(H*.94,th+pad*1.8);
  const cx=x+W/2-cw/2, cy=y+H/2-chh/2;
  roundRect(ctx,cx,cy,cw,chh,Math.min(chh*.22,pad*1.6)); ctx.fillStyle=pmPat(pmOf().pattern)==='cabinets'?'#06070a':'rgba(6,7,10,.82)'; ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.14)'; ctx.lineWidth=Math.max(1,pad*.06); ctx.stroke();
  let yy=cy+pad*.9; ctx.textAlign='center'; ctx.textBaseline='top';
  lines.forEach(l=>{ ctx.font=`${l.w} ${l.sz}px ${l.fam}`; ctx.fillStyle=l.c; ctx.fillText(l.t,x+W/2,yy); yy+=l.sz*1.22+gap; });
}
function pmDrawSurface(ctx,o,x,y,where,detail,withSize){
  ctx.save(); pmPaint(ctx,o,x,y,pmOf().pattern); pmLabels(ctx,o,x,y,where,withSize); ctx.restore();
}
/* small live previews for the pattern picker */
function pmSwatches(){
  const host=document.getElementById('pmPats'); if(!host) return;
  const pm=pmOf(), demo={s:{cols:4,rows:2,off:[]},W:384,H:216,cw:96,ch:108,col:pmCol(0),name:'A',p:{wmm:500,hmm:500}};
  host.innerHTML=PM_PATTERNS.map(([k,l])=>`<button class="pmpat ${pmPat(pm.pattern)===k?'on':''}" onclick="pmSet('pattern','${k}')"><canvas width="384" height="216" data-p="${k}"></canvas><span>${l}</span></button>`).join('');
  host.querySelectorAll('canvas').forEach(c=>pmPaint(c.getContext('2d'),demo,0,0,c.dataset.p));
  document.querySelectorAll('#pmPal button').forEach(b=>b.classList.toggle('on',b.dataset.v===(pm.palette||'vivid')));
  const ls=document.getElementById('pmLab'); if(ls) ls.value=pm.labels||'large';
}

const pmWhereComp=o=>[(o.iw!==o.W||o.ih!==o.H)?`Input ${o.iw} × ${o.ih}  at  X ${o.ix}   Y ${o.iy}`:`X ${o.ix}   Y ${o.iy}`];
function pmDrawIn(ctx,o,detail,withSize){
  ctx.save(); ctx.translate(o.ix,o.iy); ctx.scale(o.iw/o.W,o.ih/o.H);
  pmDrawSurface(ctx,o,0,0,pmWhereComp(o),detail,withSize);
  ctx.restore();
}
const pmWhereOut=o=>[`X ${o.ox}   Y ${o.oy}`];
function pmCompCanvas(M){
  const c=document.createElement('canvas'); c.width=M.compW; c.height=M.compH;
  const x=c.getContext('2d'); pmDead(x,M.compW,M.compH);
  M.L.forEach(o=>pmDrawIn(x,o,true));
  return c;
}
function pmOutCanvas(M,out){
  const c=document.createElement('canvas'); c.width=out.W; c.height=out.H;
  const x=c.getContext('2d'); pmDead(x,out.W,out.H);
  M.L.filter(o=>o.out===out.n).forEach(o=>pmDrawSurface(x,o,o.ox,o.oy,pmWhereOut(o),true));
  return c;
}
/* one screen on its own, at its exact size — a test pattern for a single slice */
function pmSliceCanvas(M,o){
  const c=document.createElement('canvas'); c.width=o.W; c.height=o.H;
  pmDrawSurface(c.getContext('2d'),o,0,0,pmWhereOut(o),true);
  return c;
}
/* one sheet for the crew */
/* overview outputs: each up to 560 px tall and never wider than the page, wrapping onto new rows */
function pmOutLayout(M,W){
  const maxW=W-160, TH=560, gap=70, lab=66, items=[]; let cx=0, cy=0, rowH=0;
  M.outs.forEach(o=>{
    const sc=Math.min(1,maxW/o.W,TH/o.H), w=o.W*sc, h=o.H*sc;
    if(cx>0&&cx+w>maxW){ cy+=rowH+lab+gap; cx=0; rowH=0; }
    items.push({o,x:cx,y:cy,sc}); cx+=w+gap; rowH=Math.max(rowH,h);
  });
  return {items,h:items.length?cy+rowH+lab:0};
}
function pmOverviewCanvas(M){
  const W=3400, lay=pmOutLayout(M,W);
  const compH0=M.compH*((W-160)/Math.max(1,M.compW));
  const H0=Math.ceil(700+compH0+lay.h+M.slices.length*62+M.outs.reduce((a,o)=>a+o.groups.length,0)*50+M.warn.length*48+400);
  const c=document.createElement('canvas'); c.width=W; c.height=H0;
  const x=c.getContext('2d'); x.fillStyle='#12141a'; x.fillRect(0,0,W,H0);
  const t=(s,px,py,sz,col,bold,mono)=>{ x.font=`${bold?700:400} ${sz}px ${mono?FM:FS}`; x.fillStyle=col; x.textBaseline='top'; x.fillText(s,px,py); };
  const sec=(y,s)=>{ t(s,80,y,40,'#ffd65a',1); x.fillStyle='#3c4250'; x.fillRect(80,y+60,W-160,2); };
  const pr=[...new Set(M.L.map(o=>o.unit&&unitProc(o.unit).model).filter(Boolean))];
  t(`${(S.name||'Untitled Project').toUpperCase()} — PIXEL MAP`,80,60,76,'#fff',1);
  t([S.venue,`composition ${M.compW} × ${M.compH}`,`${M.outs.length} output${M.outs.length===1?'':'s'}`,
     `${units().length} × ${pr.join(', ')||'processor'}`,`${bitDepth()}-bit`].filter(Boolean).join('  ·  '),80,160,34,'#a0aab9',0);
  let y=250; sec(y,`RESOLUME COMPOSITION  ·  ${M.compW} × ${M.compH}`);
  const cw=W-160, sc=cw/M.compW, ch=M.compH*sc;
  x.save(); x.translate(80,y+80); x.scale(sc,sc); pmDead(x,M.compW,M.compH);
  M.L.forEach(o=>{ const eff=sc*(o.iw/o.W), nat=Math.min(150,o.H*0.13);   /* readable on the sheet: names at least 34 px */
    o._boost=Math.max(1,34/Math.max(1,nat*eff)); pmDrawIn(x,o,false,true); delete o._boost; }); x.restore();
  x.strokeStyle='#5a606e'; x.lineWidth=2; x.strokeRect(80,y+80,cw,ch);
  y+=80+ch+70; sec(y,'OUTPUTS');
  y+=90;
  lay.items.forEach(({o,x:lx,y:ly,sc})=>{
    const ox=80+lx, oy=y+ly;
    t(`OUTPUT ${o.n}`,ox,oy,40,'#fff',1);
    t(`${o.W} × ${o.H}`,ox+230,oy+6,30,'#a0aab9',0,1);
    x.save(); x.translate(ox,oy+66); x.scale(sc,sc); pmDead(x,o.W,o.H);
    M.L.filter(q=>q.out===o.n).forEach(q=>pmDrawSurface(x,q,q.ox,q.oy,pmWhereOut(q),false,true)); x.restore();
    x.strokeStyle='#5a606e'; x.lineWidth=2; x.strokeRect(ox,oy+66,o.W*sc,o.H*sc);
  });
  y+=lay.h+40; sec(y,'SLICES  ·  Resolume Advanced Output');
  y+=90;
  const cols=[80,470,780,1090,1400,1830,1990,2300,2680], hd=['SLICE','INPUT  X, Y','INPUT  W × H','LED PIXELS','SIZE  W × H','OUTPUT','OUTPUT  X, Y','PROCESSOR','PANEL'];
  hd.forEach((h,i)=>t(h,cols[i],y,26,'#8c96a5',1)); y+=50;
  M.slices.forEach(o=>{
    x.fillStyle='#1a1d25'; x.fillRect(80,y-6,W-160,56); x.fillStyle=o.col; x.fillRect(80,y-6,12,56);
    const v=[o.name,`${o.ix}, ${o.iy}`,`${o.iw} × ${o.ih}`,`${o.W} × ${o.H}`,`${ftIn(o.s.cols*o.p.wmm)} × ${ftIn(o.s.rows*o.p.hmm)}`,
      String(o.out),`${o.ox}, ${o.oy}`,o.unit?unitLabel(o.unit):'—',`${o.p.model} · ${o.s.cols} × ${o.s.rows}`];
    v.forEach((s,i)=>t(s,cols[i]+(i?0:24),y,32,'#ebeef4',i===0,i>0)); y+=62;
  });
  y+=50; sec(y,'PROCESSOR INPUTS'); y+=90;
  M.outs.forEach(o=>{ o.groups.forEach((g,gi)=>{
    const where=g.items.map(q=>`${q.name} at X ${q.ox}`).join(' · ');
    t(`${g.name.padEnd(16)} ${gi===0?`input ← Output ${o.n}`:`loop from ${o.groups[0].name}`}   EDID ${o.W} × ${o.H}   ${where}`,80,y,30,'#d7dce6',0,1); y+=50; }); });
  y+=10;
  if(M.warn.length){ y+=20; M.warn.forEach(w=>{ t('!  '+w,80,y,30,'#ff8a8a',0); y+=48; }); }
  const out=document.createElement('canvas'); out.width=W; out.height=y+60;
  out.getContext('2d').drawImage(c,0,0); return out;
}

