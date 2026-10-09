/* ========================= DRAW SET ========================= */
function drawSet(ctx,o2){
  o2=o2||{};
  const o=opt();
  const sp=o2.layer?o2.layer==='power':o.showPower;
  const sd=o2.layer?o2.layer==='data':o.showData;
  const B=setBounds();
  const T=titleH(o2.layer), TW=setW(B), W=TW+SETGAP*2, H=B.h+T+SETGAP;
  ctx.save();
  ctx.fillStyle=C.bg; ctx.fillRect(0,0,W,H);
  ctx.translate(SETGAP-B.x1,T-B.y1);

  const tl=wrapLines(setTitle(o2.layer),TW,SET_TF()), ex=(tl.length-1)*28;
  tl.forEach((l,i)=>fitTxt(ctx,l,B.x1,B.y1-T+22+i*28,TW,SET_TF(),C.head));
  drawFacts(ctx,B.x1,B.y1-T+48+ex,TW,setFacts());
  drawStamp(ctx,B.x1,B.x1+TW,B.y1-13);
  ctx.strokeStyle=C.line; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(B.x1,B.y1-7); ctx.lineTo(B.x1+TW,B.y1-7); ctx.stroke();

  visible().forEach(s=>{
    const b=sbox(s), p=posOf(s,B);
    ctx.save(); ctx.translate(p.x,p.y);
    drawScreen(ctx,s,b,sp,sd,o2.interactive&&s===S.screens[cur]);
    ctx.restore();
  });
  ctx.restore();
  return {w:W,h:H,B};
}
/* ---- labelled fact grid used by every title block ---- */
const FACT_COL=150;
const factCols=w=>Math.max(2,Math.min(6,Math.floor(w/FACT_COL)));
const factRows=(n,w)=>Math.ceil(n/factCols(w));
const FACT_ROW=27;
/* small spaced capitals over the value, like a drawing title block */
function capTxt(ctx,t,x,y,size,color,align){
  ctx.save(); ctx.font=`600 ${size}px ${FS}`; ctx.fillStyle=color; ctx.textAlign=align||'left'; ctx.textBaseline='alphabetic';
  if('letterSpacing' in ctx) ctx.letterSpacing=(size*.12).toFixed(2)+'px';
  ctx.fillText(String(t).toUpperCase(),x,y); ctx.restore();
}
function drawFacts(ctx,x,y,maxW,facts){
  const cols=factCols(maxW), colW=Math.min(FACT_COL,maxW/cols);
  facts.forEach((f,i)=>{
    const fx=x+(i%cols)*colW, fy=y+Math.floor(i/cols)*FACT_ROW-6;
    capTxt(ctx,f[0],fx,fy,7,C.faint);
    fitTxt(ctx,String(f[1]),fx,fy+13,colW-14,`500 10.5px ${FS}`,C.head);
  });
  return factRows(facts.length,maxW)*FACT_ROW;
}
function screenFacts(s){
  const t=totals(s), p=panelById(s.panelId), pr=procOf(s), o=opt(), f=[];
  f.push(['View',o.rear?'Rear':'Front']);
  f.push(['Panel',p?`${p.brand} ${p.model}`:'not selected']);
  if(p) f.push(['Pitch',`${p.pitch} mm`]);
  if(p&&bent(s)) f.push(['Curve',curveText(s)]);
  if(viewDist(s)) f.push(['Closest view',ftR(viewDist(s).min)]);
  f.push(['Resolution',`${t.resW} × ${t.resH} px`]);
  if(t.wmm) f.push(['Dimensions',`${ftIn(t.wmm)} × ${ftIn(t.hmm)}`]);
  f.push(['Tiles',String(t.tiles)]);
  if(wantWeight()) f.push(['Weight',lbFmt(t.lb)]);
  if(wantLoad()) f.push(['Load',`${(t.wMax/1000).toFixed(1)} kW max`]);
  f.push(['Processor',pr.id==='none'?'none':`${unitLabel(unitOf(s))} · ${pr.model}`]);
  if(pr.id!=='none') f.push(['Colour depth',`${bitDepth()}-bit`]);
  return f;
}
function setFacts(){
  const st=setTotalsCalc(), o=opt(), f=[];
  if(titleVenue()) f.push(['Venue',titleVenue()]);
  f.push(['View',o.rear?'Rear':'Front']);
  f.push(['Screens',`${visible().length} of ${S.screens.length}`]);
  f.push(['Tiles',String(st.tiles)]);
  if(wantWeight()) f.push(['Weight',lbFmt(st.lb)]);
  if(wantLoad()) f.push(['Load',`${(st.wMax/1000).toFixed(1)} kW max`]);
  f.push(['Colour depth',`${bitDepth()}-bit`]);
  return f;
}
function setTitle(layer){
  const o=opt(), sp=layer?layer==='power':o.showPower, sd=layer?layer==='data':o.showData;
  const lname=sp&&sd?'Power + Data Map':sp?'Power Map':sd?'Data Map':'Tile Layout';
  const scope=focusIdx!=null?S.screens[focusIdx].name+' — ':'';
  return `${titleShow()} — ${scope}${lname}`;
}
function titleH(layer){
  const B=setBounds(), TW=setW(B);
  return 40+(wrapLines(setTitle(layer),TW,SET_TF()).length-1)*28+factRows(setFacts().length,TW)*FACT_ROW+22;
}

/* author / date / revision strip shared by every sheet */
function drawStamp(ctx,x1,x2,y){
  if(XO&&XO.sheet) return;            /* the PDF title strip carries these */
  const bits=[];
  if(XO&&XO.author) bits.push('Drawn by '+XO.author);
  bits.push(titleDate());
  if(XO&&XO.rev) bits.push('Dwg '+XO.rev);
  fitTxt(ctx,bits.join('   \u00b7   '),x1,y,(x2-x1)*0.7,`500 9px ${FS}`,C.faint);
  const right=`${S.screens.length} screen${S.screens.length===1?'':'s'}`;
  txt(ctx,right,x2,y,`500 9px ${FS}`,C.faint,'right');
}
let LABELLED=null;   /* tiles that already carry a run-label pill */
function drawScreen(ctx,s,b,sp,sd,isActive){
  const o=opt(), p=b.p, det=o.detail, dual=sp&&sd;
  const showNums=XO?XO.nums:det!=='clean';
  const showHops=XO?XO.hops:det==='full';
  const showLeg =XO?XO.legend:det!=='clean';
  const showRefs=XO?XO.refs:true;

  const FR=PRINT?6:10;                                   /* rounded screen cards */
  roundRect(ctx,0,0,b.w,b.h,FR);
  if(!PRINT){ ctx.save(); ctx.shadowColor=C.shadow; ctx.shadowBlur=30; ctx.shadowOffsetY=12;
    ctx.fillStyle=C.frame; ctx.fill(); ctx.restore(); }
  else { ctx.fillStyle=C.frame; ctx.fill(); }
  const hot=isActive&&!PRINT;
  ctx.strokeStyle=hot?ACCENT:C.edge; ctx.lineWidth=hot?1.5:1; ctx.stroke();
  if(hot){ roundRect(ctx,-4,-4,b.w+8,b.h+8,FR+4); ctx.save(); ctx.globalAlpha=.16; ctx.strokeStyle=ACCENT; ctx.lineWidth=4; ctx.stroke(); ctx.restore(); }

  ctx.save(); roundRect(ctx,0,0,b.w,b.h,FR); ctx.clip();
  ctx.fillStyle=C.bar; ctx.fillRect(0,0,b.w,HEADH);
  ctx.fillStyle=C.edge; ctx.fillRect(0,HEADH,b.w,1); ctx.restore();
  const barW=b.w-PAD*2-16;              /* leave room for the grip dots */
  fitTxt(ctx,s.name,PAD,14.5,barW,`600 12px ${FS}`,isActive?C.head:C.sub);
  if(p){
    const t=totals(s);
    const segs=[`${p.brand} ${p.model}`,`${p.pitch}mm`,`${s.cols*p.pw}\u00d7${s.rows*p.ph} px`,
      `${ftIn(t.wmm)} \u00d7 ${ftIn(t.hmm)}`,`${t.tiles} tiles`];
    if(wantWeight()) segs.push(lbFmt(t.lb));
    if(opt().showData&&units().length>1) segs.splice(1,0,unitLabel(unitOf(s)));
    const fit=fitMeta(ctx,segs,barW);
    fitTxt(ctx,fit.t,PAD,25,barW,fit.f,C.faint);
  } else {
    txt(ctx,'No panel selected',PAD,25,`500 8.5px ${FS}`,C.warn);
  }
  if(!PRINT){ ctx.save(); ctx.fillStyle=isActive?C.gripOn:C.grip;
    for(let i=0;i<3;i++) for(let j=0;j<2;j++){ ctx.beginPath(); ctx.arc(b.w-PAD-7+j*4,10+i*4,1.1,0,Math.PI*2); ctx.fill(); }
    ctx.restore(); }

  if(!p){
    ctx.save(); ctx.setLineDash([5,4]); ctx.strokeStyle=C.ghost; ctx.lineWidth=1;
    ctx.strokeRect(PAD,HEADH+PAD,b.w-PAD*2,b.h-HEADH-PAD*2); ctx.restore();
    txt(ctx,'Pick an LED panel',b.w/2,HEADH+48,`600 13px ${FS}`,C.warn,'center');
    txt(ctx,'Use the panel button in the sidebar',b.w/2,HEADH+66,`9.5px ${FS}`,C.faint,'center');
    return;
  }

  /* tiles: a quiet neutral panel, tinted with its run's colour */
  const rr=Math.min(3.5,b.tw*.09,b.th*.09), tint=PRINT?(dual?.09:.13):(dual?.12:.17);
  for(let r=0;r<s.rows;r++) for(let c=0;c<s.cols;c++){
    const t=key(r,c), q=tileXY(s,b,r,c), dead=isOff(s,r,c);
    const pc=sp?chainOf(s,'power',t):null, dc=sd?chainOf(s,'data',t):null;
    const acc=pc?pc.color:(dc?dc.color:null), ix=pc?runIdx(s,pc,true):dc?runIdx(s,dc,false):-1;
    roundRect(ctx,q.x,q.y,b.tw,b.th,rr);
    if(dead){ ctx.fillStyle=C.dead; ctx.fill(); ctx.save(); ctx.setLineDash([2,3]); ctx.strokeStyle=C.deadEdge; ctx.lineWidth=1; ctx.stroke(); ctx.restore();
      if(b.tw>=20){ ctx.save(); ctx.strokeStyle=C.deadEdge; ctx.lineWidth=1; ctx.beginPath();   /* a soft cross marks a cutout */
        const m=Math.min(b.tw,b.th)*.22; ctx.moveTo(q.x+b.tw/2-m,q.y+b.th/2-m); ctx.lineTo(q.x+b.tw/2+m,q.y+b.th/2+m);
        ctx.moveTo(q.x+b.tw/2+m,q.y+b.th/2-m); ctx.lineTo(q.x+b.tw/2-m,q.y+b.th/2+m); ctx.stroke(); ctx.restore(); }
      continue; }
    ctx.fillStyle=C.tile; ctx.fill();
    if(acc){ const ia=ink(acc); ctx.save(); ctx.globalAlpha=isBW()?BW_TINT[ix%BW_TINT.length]:tint; ctx.fillStyle=ia; ctx.fill();
      ctx.globalAlpha=PRINT?.55:.5; ctx.strokeStyle=ia; ctx.lineWidth=1; ctx.stroke(); ctx.restore(); }
    else { ctx.strokeStyle=C.line; ctx.lineWidth=1; ctx.stroke(); }

    /* data marker: left edge strip in clean mode */
    if(dual&&dc&&!showNums&&b.tw>16){ ctx.fillStyle=ink(dc.color); roundRect(ctx,q.x+2,q.y+4,2,b.th-8,1); ctx.fill(); }

    if(isActive&&(mode==='power'||mode==='data')){
      const a=chains(s,mode)[active[mode]];
      if(a&&a.tiles.includes(t)){
        roundRect(ctx,q.x+1.5,q.y+1.5,b.tw-3,b.th-3,Math.max(1,rr-1));
        ctx.save(); ctx.globalAlpha=UITHEME==='light'?.55:.45; ctx.strokeStyle=UITHEME==='light'?C.head:'#fff'; ctx.lineWidth=1; ctx.stroke(); ctx.restore();
      }
    }
  }

  LABELLED=new Set();
  if(sp) used(s,'power').forEach(ch=>flow(ctx,s,b,ch,true,dual,showHops,ch.name));
  if(sd){
    used(s,'data').forEach(ch=>{ if(!isBackupRun(s,ch)) flow(ctx,s,b,ch,false,dual,showHops,ch.name); });
    if(!XO||XO.backup) drawBackups(ctx,s,b);
  }

  /* numbers go on last so a cable never hides them: a numbered stop on the run, or a corner chip
     when power and data share the wall */
  const rN=Math.max(5.5,Math.min(8.5,Math.min(b.tw,b.th)*.165));
  for(let r=0;r<s.rows;r++) for(let c=0;c<s.cols;c++){
    if(isOff(s,r,c)) continue;
    const t=key(r,c), q=tileXY(s,b,r,c);
    const pc=sp?chainOf(s,'power',t):null, dc=sd?chainOf(s,'data',t):null;
    const ch2=pc||dc;
    /* grid reference, bottom-left */
    if(showRefs&&b.tw>=34){   /* kept left of centre so the run line never crosses it */
      const lbl=`R${r+1}C${c+1}`, room=b.tw/2-9.5-(dual?Math.max(3,Math.min(b.tw,b.th)*0.17):0), fs=Math.min(7.5,room/(lbl.length*0.56));
      if(fs>=5) txt(ctx,lbl,q.x+4,q.y+b.th-4,`500 ${fs.toFixed(2)}px ${FS}`,ch2?ink(ch2.color):C.faint,'left',PRINT?.85:.7);
    }
    if(LABELLED&&LABELLED.has(t)) continue;   /* the run's label already names this tile */
    if(!showNums||!ch2) continue;
    const n=String(chainPos(ch2,t,s));
    if(dual){ if(b.tw>26) chipDraw(ctx,q.x+b.tw-3,q.y+3,n,ch2.color,'tr'); continue; }
    if(b.tw<18) continue;
    const a=ctr(s,b,t), co=ink(ch2.color), rad=n.length>2?rN*1.15:rN;
    ctx.save(); ctx.beginPath(); ctx.arc(a.x,a.y,rad,0,Math.PI*2);
    ctx.fillStyle=co; ctx.fill(); ctx.lineWidth=1.6; ctx.strokeStyle=C.frame; ctx.stroke();
    ctx.font=`600 ${(n.length>2?rN*1.0:rN*1.18).toFixed(2)}px ${FS}`; ctx.fillStyle=onColor(co); ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(n,a.x,a.y+.5); ctx.restore();
  }

  if(curved(s)) drawLocks(ctx,s,b);
  if(showLeg&&b.leg) drawLegend(ctx,s,b,sp,sd);
}
/* curve locks: a numbered badge on the joint between two panels, on every row.
   Round = wraps toward the audience, square = bows away */
const lockCol=v=>v>0?C.warn:C.dataAcc;
function lockBadge(ctx,x,y,v,r){
  ctx.save();
  if(v>0){ ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); } else roundRect(ctx,x-r,y-r,r*2,r*2,r*.35);
  ctx.fillStyle=ink(lockCol(v)); ctx.fill(); ctx.lineWidth=1.4; ctx.strokeStyle=C.bg; ctx.stroke();
  ctx.font=`700 ${r*1.3}px ${FS}`; ctx.fillStyle=onColor(ink(lockCol(v))); ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(String(Math.abs(v)),x,y+r*.06); ctx.restore();
}
function drawLocks(ctx,s,b){
  const r0=Math.max(4.5,Math.min(8,Math.min(b.tw,b.th)*.2));
  for(let k=0;k<s.cols-1;k++){
    const v=jointOf(s,k); if(!v) continue;
    for(let r=0;r<s.rows;r++){
      if(isOff(s,r,k)&&isOff(s,r,k+1)) continue;
      const a=tileXY(s,b,r,k), z=tileXY(s,b,r,k+1), x=(Math.min(a.x,z.x)+b.tw+Math.max(a.x,z.x))/2;
      lockBadge(ctx,x,a.y+b.th/2,v,r0);
    }
  }
}
function drawBackups(ctx,s,b){
  const bk=bkOf(s), md=bkMode(s); if(md==='none') return;
  const d=Math.max(4,Math.min(b.tw,b.th)*0.24);
  const labelOf=ch=>{
    if(md==='device') return 'BK '+ch.name;
    const br=backupFor(s,ch); return br?'B '+br.name:null;
  };
  const labels=used(s,'data').filter(ch=>!isBackupRun(s,ch)).map(labelOf).filter(Boolean);
  ctx.save(); ctx.font=`700 10px ${FS}`;
  const wMax=Math.max(1,...labels.map(t=>ctx.measureText(t).width));    /* width at 10px */
  ctx.restore();
  const room=b.tw-4, padX=7;
  let fs=Math.min(8,(room-padX)/wMax*10);                                 /* same size for every pill */
  const compact=fs<5.5;                                                    /* tiny tiles: drop the words */
  if(compact) fs=Math.min(8,Math.max(5.5,(room-6)/Math.max(1,wMax*0.55)*10));
  used(s,'data').forEach(ch=>{
    if(isBackupRun(s,ch)) return;
    let col,label;
    if(md==='device'){ col=C.violet; label='BK '+ch.name; }
    else { const br=backupFor(s,ch); if(!br) return; col=br.color; label=br.name; }
    col=ink(col);
    /* backup feeds the same tiles from the opposite end */
    /* primary rides the centre, backup rides up-right — the number chip sits bottom-left */
    const TLb=LT(s,ch); if(!TLb.length) return;
    const pts=TLb.slice().reverse().map(t=>{const c=ctr(s,b,t);return {x:c.x+d,y:c.y-d};});
    const hc=ctr(s,b,TLb[TLb.length-1]);
    ctx.save();
    ctx.strokeStyle=col; ctx.lineWidth=1.5; ctx.globalAlpha=.9;
    ctx.setLineDash([2,3]); ctx.lineCap='round';
    ctx.beginPath(); pts.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y)); ctx.stroke();
    ctx.setLineDash([]);
    for(let i=0;i<pts.length-1;i++){
      const a=pts[i],z=pts[i+1], mx=(a.x+z.x)/2, my=(a.y+z.y)/2;
      ctx.save(); ctx.translate(mx,my); ctx.rotate(Math.atan2(z.y-a.y,z.x-a.x));
      ctx.beginPath(); ctx.moveTo(4,0); ctx.lineTo(-3,3); ctx.lineTo(-3,-3); ctx.closePath();
      ctx.fillStyle=col; ctx.fill(); ctx.restore();
    }
    const h=pts[0];
    const full=labelOf(ch)||label;
    const t2=compact?full.replace(/^BK |^B /,'').replace(/^P/,'B'):full;   /* "B10" on very small tiles */
    ctx.font=`700 ${fs.toFixed(2)}px ${FS}`;
    const ph=Math.max(9,fs+5), pw2=Math.min(room,ctx.measureText(t2).width+padX);
    /* pill centred on the tile so it can never spill onto the next panel */
    roundRect(ctx,hc.x-pw2/2,h.y-ph/2,pw2,ph,ph/2);
    ctx.fillStyle=C.chip; ctx.fill();
    ctx.strokeStyle=col; ctx.lineWidth=1.3; ctx.setLineDash([2,2]); ctx.stroke(); ctx.setLineDash([]);
    txt(ctx,t2,hc.x,h.y+fs*0.34,`700 ${fs.toFixed(2)}px ${FS}`,col,'center');
    if(LABELLED) LABELLED.add(TLb[TLb.length-1]);        /* keep the chain number off it */
    ctx.restore();
  });
}
function bbox(s,b,ch){
  const TL=LT(s,ch);
  if(!TL.length) return null;
  let x1=1e9,y1=1e9,x2=-1e9,y2=-1e9;
  TL.forEach(t=>{const[r,c]=t.split(':').map(Number),q=tileXY(s,b,r,c);
    x1=Math.min(x1,q.x);y1=Math.min(y1,q.y);x2=Math.max(x2,q.x+b.tw);y2=Math.max(y2,q.y+b.th);});
  return {x1,y1,x2,y2};
}
/* small drawn glyphs for run heads: a play triangle for data, a bolt for power */
function runGlyph(ctx,x,y,sz,isPower,col){
  ctx.save(); ctx.fillStyle=col; ctx.beginPath();
  if(isPower){ const u=sz/10; ctx.moveTo(x+1*u,y-5*u); ctx.lineTo(x-3.5*u,y+.8*u); ctx.lineTo(x-.2*u,y+.8*u); ctx.lineTo(x-1*u,y+5*u);
    ctx.lineTo(x+3.5*u,y-.8*u); ctx.lineTo(x+.2*u,y-.8*u); ctx.closePath(); }
  else { const u=sz/10; ctx.moveTo(x-2.6*u,y-3.6*u); ctx.lineTo(x+3.4*u,y); ctx.lineTo(x-2.6*u,y+3.6*u); ctx.closePath(); }
  ctx.fill(); ctx.restore();
}
/* one continuous run: a haloed line through every tile, small arrowheads between stops */
function flow(ctx,s,b,ch,isPower,dual,hops,label){
  const CO=ink(ch.color), TL=LT(s,ch);
  if(!TL.length) return;
  const P=TL.map(t=>anchor(s,b,t,isPower,dual));
  const lw=isPower?(dual?2:2.4):(dual?1.5:2);
  ctx.save(); ctx.lineCap='round'; ctx.lineJoin='round';
  const path=()=>{ ctx.beginPath(); P.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y)); };
  if(P.length>1){
    path(); ctx.strokeStyle=C.frame; ctx.globalAlpha=PRINT?.9:.65; ctx.lineWidth=lw+3; ctx.stroke(); ctx.globalAlpha=1;
    path(); ctx.strokeStyle=CO; ctx.lineWidth=lw; ctx.setLineDash(isBW()?bwDash(runIdx(s,ch,isPower)):!isPower&&dual?[5,4]:[]); ctx.stroke(); ctx.setLineDash([]);
  }
  const z=Math.max(2.8,Math.min(4.2,Math.min(b.tw,b.th)*.085))*(dual?.85:1);
  for(let i=0;i<P.length-1;i++){
    const a=P[i], e=P[i+1], mx=(a.x+e.x)/2, my=(a.y+e.y)/2;
    ctx.save(); ctx.translate(mx,my); ctx.rotate(Math.atan2(e.y-a.y,e.x-a.x));
    ctx.beginPath(); ctx.moveTo(z*1.25,0); ctx.lineTo(-z*.85,z); ctx.lineTo(-z*.35,0); ctx.lineTo(-z*.85,-z); ctx.closePath();
    ctx.lineJoin='round'; ctx.lineWidth=1.4; ctx.strokeStyle=C.frame; ctx.stroke(); ctx.fillStyle=CO; ctx.fill();
    ctx.restore();
    if(hops&&b.tw>46){
      const hl=`${i+1}\u2192${i+2}`, yo=isPower?-10:10;
      ctx.font=`500 7.5px ${FS}`;
      const w=ctx.measureText(hl).width+9;
      roundRect(ctx,mx-w/2,my+yo-6,w,12,6); ctx.fillStyle=C.chip; ctx.fill();
      ctx.strokeStyle=CO; ctx.lineWidth=.8; ctx.stroke();
      txt(ctx,hl,mx,my+yo+2.6,`500 7.5px ${FS}`,CO,'center');
    }
  }
  /* the head of the run: a solid label in the run's colour */
  const h=P[0], on=onColor(CO);
  if(label&&b.tw>=30){
    ctx.font=`700 8.5px ${FS}`;
    const tw=ctx.measureText(label).width, w=tw+21, hh=15;
    roundRect(ctx,h.x-w/2,h.y-hh/2,w,hh,hh/2);
    ctx.lineWidth=2; ctx.strokeStyle=C.frame; ctx.stroke(); ctx.fillStyle=CO; ctx.fill();
    runGlyph(ctx,h.x-w/2+8.5,h.y,isPower?9:7.5,isPower,on);
    txt(ctx,label,h.x-w/2+15,h.y+3,`700 8.5px ${FS}`,on);
    if(LABELLED) LABELLED.add(TL[0]);
  } else {
    const rad=isPower?(dual?6.5:7.5):(dual?5.5:6.5);
    ctx.beginPath(); ctx.arc(h.x,h.y,rad,0,Math.PI*2);
    ctx.lineWidth=2; ctx.strokeStyle=C.frame; ctx.stroke(); ctx.fillStyle=CO; ctx.fill();
    runGlyph(ctx,h.x+(isPower?0:.6),h.y,isPower?9:7,isPower,on);
    if(LABELLED) LABELLED.add(TL[0]);
  }
  ctx.restore();
}
function drawLegend(ctx,s,b,sp,sd){
  const groups=legendGroups(s,sp,sd);
  if(!groups.length) return;
  const x0=PAD, maxW=b.w-PAD*2;
  let y=HEADH+PAD+b.gh+PAD;
  ctx.strokeStyle=C.line; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(x0,y-7); ctx.lineTo(b.w-PAD,y-7); ctx.stroke();
  y+=2;
  groups.forEach((grp,gi)=>{
    ctx.save(); ctx.font=`600 7px ${FS}`; if('letterSpacing' in ctx) ctx.letterSpacing='.84px';
    let head=grp.title;
    if(ctx.measureText(head.toUpperCase()).width>maxW-40&&grp.short) head=grp.short;
    const tw2=ctx.measureText(head.toUpperCase()).width;
    ctx.restore();
    capTxt(ctx,head,x0,y+4,7,C.faint);
    ctx.save(); ctx.strokeStyle=C.rule; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(x0+tw2+10,y+1.5); ctx.lineTo(b.w-PAD,y+1.5); ctx.stroke(); ctx.restore();
    y+=14;
    const per=grp.items.length===1?1:b.perRow;
    const cw=maxW/per;
    grp.items.forEach((it,i)=>{
      const x=x0+(i%per)*cw, ly=y+Math.floor(i/per)*13+2;
      if(it.lock) lockBadge(ctx,x+6,ly,it.lock,5);
      else { ctx.save(); ctx.strokeStyle=ink(it.c); ctx.lineWidth=2.4; ctx.lineCap='round';
        ctx.setLineDash(it.dash===2?[.5,3.5]:isBW()&&it.bw!=null?bwDash(it.bw):it.dash?[4,3]:[]);
        ctx.beginPath(); ctx.moveTo(x+1,ly); ctx.lineTo(x+12,ly); ctx.stroke(); ctx.restore(); }
      let label=it.t+(it.over?'   OVER':'');
      ctx.save(); ctx.font=`500 8.5px ${FS}`;
      if(it.short&&ctx.measureText(label).width>cw-22) label=it.short+(it.over?'  OVER':'');
      ctx.restore();
      fitTxt(ctx,label,x+18,ly+3,cw-22,`500 8.5px ${FS}`,it.over?C.bad:C.sub);
    });
    y+=Math.ceil(grp.items.length/per)*13;
    if(gi<groups.length-1) y+=9;
  });
}
/* ---- summary sheet ---- */
function drawSummary(ctx){
  const W=1340, rows=[], o=opt();
  S.screens.forEach(s=>{
    const t=totals(s), p=panelById(s.panelId), pr=procOf(s);
    rows.push({h:1,a:s.name,b:p?`${p.brand} ${p.model} · ${p.pitch}mm`:'no panel selected',
      c:`${t.resW}×${t.resH} px`,d:t.wmm?`${ftIn(t.wmm)} × ${ftIn(t.hmm)}`:'—',
      e:`${t.tiles} tiles · ${lbFmt(t.lb)} · ${(t.wMax/1000).toFixed(2)} kW max`,
      f:pr.id==='none'?'—':(units().length>1?`${unitLabel(unitOf(s))} · ${pr.model}`:`${pr.brand} ${pr.model}`)});
    used(s,'power').forEach(ch=>{const k=circuitCalc(s,ch);
      rows.push({col:ch.color,a:'  '+ch.name,b:`${LT(s,ch).length} tiles`,c:`${k.w} W`,d:`${k.amps.toFixed(1)} A draw`,
        e:`${k.breaker}A ${k.volts}V · usable ${k.cap.toFixed(1)}A`,f:k.pct>=100?'OVER CAPACITY':`${k.pct.toFixed(0)}% of circuit`,over:k.pct>=100});});
    used(s,'data').forEach(ch=>{ if(isBackupRun(s,ch)) return; const k=runCalc(s,ch), br=backupFor(s,ch);
      rows.push({col:ch.color,a:'  '+ch.name,b:`${LT(s,ch).length} tiles`,c:`${(k.px/1000).toFixed(0)}k px`,
        d:k.cap?`${(k.cap/1000).toFixed(0)}k cap`:'—',
        e:bkMode(s)==='device'?`backup: ${bkDeviceName(s)}`:(br?`backup: ${br.name}`:(pr.pt?`${pr.pt} port · ${bitDepth()}-bit`:'no processor')),
        f:k.cap?`${k.pct.toFixed(0)}%`:'',over:k.pct>=100});});
  });
  const st=setTotalsCalc();
  rows.push({h:1,a:'SET TOTAL',b:`${S.screens.length} screen${S.screens.length===1?'':'s'}`,c:`${(st.px/1e6).toFixed(2)} M px`,d:lbFmt(st.lb),
    e:`${st.tiles} tiles · ${(st.wMax/1000).toFixed(2)} kW max / ${(st.wAvg/1000).toFixed(2)} kW avg`,
    f:`${st.circ} circuits · ${st.runs} runs`});
  const H=Math.max(520,120+rows.length*20+60);
  ctx.fillStyle=C.bg; ctx.fillRect(0,0,W,H);
  fitTxt(ctx,`${titleShow()} — System Summary`,36,42,W-72,`600 27px ${FD}`,C.head);
  const hb=[titleVenue(),titleDate()];
  if(XO&&XO.author) hb.push('Drawn by '+XO.author);
  if(XO&&XO.rev) hb.push('Dwg '+XO.rev);
  fitTxt(ctx,hb.filter(Boolean).join('   ·   '),36,60,W-72,`500 10px ${FS}`,C.sub);
  ctx.strokeStyle=C.line; ctx.beginPath(); ctx.moveTo(36,74); ctx.lineTo(W-36,74); ctx.stroke();
  const cols=[56,240,430,570,760,1090], hd=['Item','Detail','Resolution','Size','Rating','Device'];
  const wid=cols.map((c,i)=>(i<cols.length-1?cols[i+1]:W-36)-c-12);
  hd.forEach((t,i)=>capTxt(ctx,t,cols[i],94,7.5,C.faint));
  let y=114, zi=0;
  rows.forEach(r=>{
    if(r.h){ zi=0; roundRect(ctx,36,y-14,W-72,22,7); ctx.fillStyle=C.band; ctx.fill();
      fitTxt(ctx,r.a,44,y,wid[0],`700 11px ${FS}`,C.head); }
    else { if(zi++%2){ roundRect(ctx,36,y-13,W-72,20,6); ctx.save(); ctx.globalAlpha=.5; ctx.fillStyle=C.band; ctx.fill(); ctx.restore(); }
      if(r.col){ ctx.beginPath(); ctx.arc(45,y-3,3.5,0,Math.PI*2); ctx.fillStyle=ink(r.col); ctx.fill(); }
      fitTxt(ctx,r.a,cols[0],y,wid[0],`500 10px ${FS}`,C.sub); }
    [r.b,r.c,r.d,r.e,r.f].forEach((v,i)=>{ if(v==null) return;
      fitTxt(ctx,String(v),cols[i+1],y,wid[i+1],`500 10px ${FS}`,
        r.h?C.sub:(r.over&&i===4?C.bad:C.cell)); });
    y+=20;
  });
  txt(ctx,`Circuit amps sized on ${o.useAvg?'average':'maximum'} panel draw${o.derate?' with 80% continuous derate':' at full breaker rating'}. Port capacity shown at ${bitDepth()}-bit${bitDepth()!==8?` (${Math.round(bitFactor()*100)}% of the published 8-bit figure)`:''}. Confirm against panel spec sheets and local code before energizing.`,
      36,H-24,`500 9px ${FS}`,C.faint);
  return {w:W,h:H};
}

function drawSchedule(ctx){
  const rows=cableRows(), W=1340;
  const H=Math.max(520,120+(rows.length+S.screens.length)*22+70);
  ctx.fillStyle=C.bg; ctx.fillRect(0,0,W,H);
  fitTxt(ctx,`${titleShow()} — Cable Schedule`,36,42,W-72,`600 27px ${FD}`,C.head);
  const hb=[titleVenue(),titleDate()];
  if(XO&&XO.author) hb.push('Drawn by '+XO.author);
  if(XO&&XO.rev) hb.push('Dwg '+XO.rev);
  fitTxt(ctx,hb.filter(Boolean).join('   ·   '),36,60,W-72,`500 10px ${FS}`,C.sub);
  ctx.strokeStyle=C.line; ctx.beginPath(); ctx.moveTo(36,74); ctx.lineTo(W-36,74); ctx.stroke();
  const cols=[56,116,200,470,720,830,960,1120], wid=cols.map((c,i)=>(i<cols.length-1?cols[i+1]:W-36)-c-10);
  ['Type','ID','From','To','Tiles','Load','Est. run','Spec'].forEach((t,i)=>capTxt(ctx,t,cols[i],94,7.5,C.faint));
  let y=114, cur='', zi=0;
  rows.forEach(r=>{
    if(r.sid!==cur){
      cur=r.sid; zi=0;
      roundRect(ctx,36,y-14,W-72,22,7); ctx.fillStyle=C.band; ctx.fill();
      fitTxt(ctx,r.screen,44,y,W-90,`700 11px ${FS}`,C.head);
      y+=22;
    }
    if(zi++%2){ roundRect(ctx,36,y-13,W-72,20,6); ctx.save(); ctx.globalAlpha=.5; ctx.fillStyle=C.band; ctx.fill(); ctx.restore(); }
    ctx.beginPath(); ctx.arc(45,y-3,3.5,0,Math.PI*2); ctx.fillStyle=ink(r.color); ctx.fill();
    const vals=[r.kind,r.id,r.from,r.to,String(r.tiles),r.load,r.est+' ft',r.spec+' ft'];
    vals.forEach((v,i)=>fitTxt(ctx,v,cols[i],y,wid[i],`500 10px ${FS}`,i<2?C.sub:C.cell));
    y+=20;
  });
  txt(ctx,'Run lengths are estimated from tile-to-tile geometry plus a drop to deck and 10 ft of slack. Verify on site before cutting or ordering.',
      36,H-24,`500 9px ${FS}`,C.faint);
  return {w:W,h:H};
}
function scheduleCanvas(){ return renderToCanvas(p=>drawSchedule(p),ctx=>drawSchedule(ctx)); }

