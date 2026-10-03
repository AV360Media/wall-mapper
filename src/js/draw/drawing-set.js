/* ========================= DRAW SET ========================= */
function drawSet(ctx,o2){
  o2=o2||{};
  const o=opt();
  const sp=o2.layer?o2.layer==='power':o.showPower;
  const sd=o2.layer?o2.layer==='data':o.showData;
  const B=setBounds();
  const T=titleH(), W=B.w+SETGAP*2, H=B.h+T+SETGAP;
  ctx.save();
  ctx.fillStyle=C.bg; ctx.fillRect(0,0,W,H);
  ctx.translate(SETGAP-B.x1,T-B.y1);

  const lname=sp&&sd?'Power + Data Map':sp?'Power Map':sd?'Data Map':'Tile Layout';
  const scope=focusIdx!=null?S.screens[focusIdx].name+' — ':'';
  const title=`${titleShow()} — ${scope}${lname}`;
  const st=setTotalsCalc();
  txt(ctx,clipText(ctx,title,B.w,`600 23px ${FD}`),B.x1,B.y1-T+22,`600 23px ${FD}`,C.head);
  drawFacts(ctx,B.x1,B.y1-T+38,B.w,setFacts());
  drawStamp(ctx,B.x1,B.x2,B.y1-13);
  ctx.strokeStyle=C.line; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(B.x1,B.y1-7); ctx.lineTo(B.x2,B.y1-7); ctx.stroke();

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
const FACT_COL=225;
const factCols=w=>Math.max(2,Math.min(4,Math.floor(w/FACT_COL)));
const factRows=(n,w)=>Math.ceil(n/factCols(w));
const FACT_ROW=15;
function drawFacts(ctx,x,y,maxW,facts){
  const cols=factCols(maxW), colW=Math.min(FACT_COL,maxW/cols);
  facts.forEach((f,i)=>{
    const fx=x+(i%cols)*colW, fy=y+Math.floor(i/cols)*FACT_ROW;
    ctx.save(); ctx.font=`500 8.5px ${FS}`;
    const lw=ctx.measureText(f[0]).width;
    ctx.restore();
    txt(ctx,f[0],fx,fy,`500 8.5px ${FS}`,C.faint);
    txt(ctx,clipText(ctx,String(f[1]),colW-lw-14,`9.5px ${FM}`),fx+lw+7,fy,`9.5px ${FM}`,C.sub);
  });
  return factRows(facts.length,maxW)*FACT_ROW;
}
function screenFacts(s){
  const t=totals(s), p=panelById(s.panelId), pr=procOf(s), o=opt(), f=[];
  f.push(['View',o.rear?'Rear':'Front']);
  f.push(['Panel',p?`${p.brand} ${p.model}`:'not selected']);
  if(p) f.push(['Pitch',`${p.pitch} mm`]);
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
function titleH(){
  const B=setBounds();
  return 34+factRows(setFacts().length,B.w)*FACT_ROW+26;
}

/* author / date / revision strip shared by every sheet */
function drawStamp(ctx,x1,x2,y){
  const bits=[];
  if(XO&&XO.author) bits.push('Drawn by '+XO.author);
  bits.push(titleDate());
  if(XO&&XO.rev) bits.push('Dwg '+XO.rev);
  txt(ctx,clipText(ctx,bits.join('   \u00b7   '),(x2-x1)*0.7,`9px ${FM}`),x1,y,`9px ${FM}`,C.faint);
  const right=`${S.screens.length} screen${S.screens.length===1?'':'s'}`;
  txt(ctx,right,x2,y,`9px ${FM}`,C.faint,'right');
}
let LABELLED=null;   /* tiles that already carry a run-label pill */
function drawScreen(ctx,s,b,sp,sd,isActive){
  const o=opt(), p=b.p, det=o.detail, dual=sp&&sd;
  const showNums=XO?XO.nums:det!=='clean';
  const showHops=XO?XO.hops:det==='full';
  const showLeg =XO?XO.legend:det!=='clean';
  const showRefs=XO?XO.refs:true;

  const FR=PRINT?6:12;                                   /* softer, rounded screen cards */
  roundRect(ctx,0,0,b.w,b.h,FR);
  if(!PRINT){ ctx.save(); ctx.shadowColor=C.shadow; ctx.shadowBlur=26; ctx.shadowOffsetY=10;
    ctx.fillStyle=C.frame; ctx.fill(); ctx.restore(); }
  else { ctx.fillStyle=C.frame; ctx.fill(); }
  const hot=isActive&&!PRINT;
  ctx.strokeStyle=hot?ACCENT:C.edge; ctx.lineWidth=hot?1.6:1; ctx.stroke();
  if(hot){ roundRect(ctx,-3,-3,b.w+6,b.h+6,FR+3); ctx.save(); ctx.globalAlpha=.22; ctx.strokeStyle=ACCENT; ctx.lineWidth=3; ctx.stroke(); ctx.restore(); }

  ctx.save(); roundRect(ctx,0,0,b.w,b.h,FR); ctx.clip();
  ctx.fillStyle=C.bar; ctx.globalAlpha=isActive?1:.75; ctx.fillRect(0,0,b.w,HEADH);
  ctx.globalAlpha=1; ctx.fillStyle=C.edge; ctx.fillRect(0,HEADH,b.w,1); ctx.restore();
  const barW=b.w-PAD*2-16;              /* leave room for the grip dots */
  txt(ctx,clipText(ctx,s.name,barW,`700 12px ${FS}`),PAD,15,`700 12px ${FS}`,isActive?C.head:C.sub);
  if(p){
    const t=totals(s);
    const segs=[`${p.brand} ${p.model}`,`${p.pitch}mm`,`${s.cols*p.pw}\u00d7${s.rows*p.ph} px`,
      `${ftIn(t.wmm)} \u00d7 ${ftIn(t.hmm)}`,`${t.tiles} tiles`];
    if(wantWeight()) segs.push(lbFmt(t.lb));
    if(opt().showData&&units().length>1) segs.splice(1,0,unitLabel(unitOf(s)));
    const fit=fitMeta(ctx,segs,barW);
    txt(ctx,fit.t,PAD,26,fit.f,C.faint);
  } else {
    txt(ctx,'No panel selected',PAD,26,`8.5px ${FM}`,C.warn);
  }
  if(!PRINT){ ctx.save(); ctx.fillStyle=isActive?C.gripOn:C.grip;
    for(let i=0;i<3;i++) for(let j=0;j<2;j++){ ctx.beginPath(); ctx.arc(b.w-PAD-7+j*4,10+i*4,1.1,0,Math.PI*2); ctx.fill(); }
    ctx.restore(); }

  if(!p){
    ctx.save(); ctx.setLineDash([5,4]); ctx.strokeStyle=C.ghost; ctx.lineWidth=1;
    ctx.strokeRect(PAD,HEADH+PAD,b.w-PAD*2,b.h-HEADH-PAD*2); ctx.restore();
    txt(ctx,'Pick an LED panel',b.w/2,HEADH+48,`600 13px ${FS}`,C.warn,'center');
    txt(ctx,'Use the panel button in the sidebar',b.w/2,HEADH+66,`9px ${FM}`,C.faint,'center');
    return;
  }

  /* circuit regions — lighter when both layers share the wall */
  if(sp) used(s,'power').forEach(ch=>{
    const bb=bbox(s,b,ch); if(!bb) return;
    roundRect(ctx,bb.x1-3,bb.y1-3,bb.x2-bb.x1+6,bb.y2-bb.y1+6,5);
    if(!dual){ ctx.save(); ctx.globalAlpha=.06; ctx.fillStyle=ink(ch.color); ctx.fill(); ctx.restore(); }
    ctx.save(); ctx.globalAlpha=dual?.4:.7; ctx.strokeStyle=ink(ch.color); ctx.lineWidth=dual?1:1.3; ctx.stroke(); ctx.restore();
  });

  /* tiles */
  for(let r=0;r<s.rows;r++) for(let c=0;c<s.cols;c++){
    const t=key(r,c), q=tileXY(s,b,r,c), dead=isOff(s,r,c);
    const pc=sp?chainOf(s,'power',t):null, dc=sd?chainOf(s,'data',t):null;
    const acc=pc?pc.color:(dc?dc.color:null);
    roundRect(ctx,q.x,q.y,b.tw,b.th,Math.min(4,b.tw*.1,b.th*.1));
    if(dead){ ctx.fillStyle=C.dead; ctx.fill(); ctx.setLineDash([3,3]); ctx.strokeStyle=C.deadEdge; }
    else if(acc){ const ia=ink(acc); ctx.save(); ctx.globalAlpha=dual?.11:.16; ctx.fillStyle=ia; ctx.fill(); ctx.restore(); ctx.strokeStyle=ia; }
    else { ctx.fillStyle=C.tile; ctx.fill(); ctx.strokeStyle=C.line; }
    ctx.save(); ctx.globalAlpha=dead?1:(dual?.8:1);
    ctx.lineWidth=dead?1:1.4; ctx.stroke(); ctx.restore(); ctx.setLineDash([]);
    if(dead) continue;
    if(b.tw>=24){ ctx.save(); ctx.globalAlpha=.55; ctx.strokeStyle=C.bezel; ctx.lineWidth=1;
      roundRect(ctx,q.x+2.5,q.y+2.5,b.tw-5,b.th-5,Math.min(2.5,b.tw*.07)); ctx.stroke(); ctx.restore(); }

    /* data marker: left edge strip in clean mode, corner number otherwise */
    if(dual&&dc&&!showNums&&b.tw>16){ ctx.fillStyle=dc.color; ctx.fillRect(q.x+1,q.y+3,2.2,b.th-6); }

    if(isActive&&(mode==='power'||mode==='data')){
      const a=chains(s,mode)[active[mode]];
      if(a&&a.tiles.includes(t)){
        roundRect(ctx,q.x+1.5,q.y+1.5,b.tw-3,b.th-3,Math.min(3,b.tw*.08));
        ctx.save(); ctx.globalAlpha=UITHEME==='light'?.7:.5; ctx.strokeStyle=UITHEME==='light'?C.head:'#fff'; ctx.lineWidth=1; ctx.stroke(); ctx.restore();
      }
    }
    /* power number top-right, data number bottom-left — opposite corners */
  }

  LABELLED=new Set();
  if(sp) used(s,'power').forEach(ch=>flow(ctx,s,b,ch,true,dual,showHops,ch.name));
  if(sd){
    used(s,'data').forEach(ch=>{ if(!isBackupRun(s,ch)) flow(ctx,s,b,ch,false,dual,showHops,ch.name); });
    if(!XO||XO.backup) drawBackups(ctx,s,b);
  }

  /* chain numbers go on last so a cable never hides them */
  for(let r=0;r<s.rows;r++) for(let c=0;c<s.cols;c++){
    if(isOff(s,r,c)) continue;
    const t=key(r,c), q=tileXY(s,b,r,c);
    if(LABELLED&&LABELLED.has(t)) continue;   /* the pill already names this tile */
    const pc=sp?chainOf(s,'power',t):null, dc=sd?chainOf(s,'data',t):null;
    const ch2=pc||dc;
    /* grid reference: bottom-left, haloed so a cable can never bury it */
    if(showRefs&&b.tw>=32){
      const lbl=`R${r+1}C${c+1}`;
      let fs=Math.max(6,Math.min(8.5,(b.tw-7)/(lbl.length*0.62)));
      ctx.save();
      ctx.font=`${fs}px ${FM}`; ctx.textAlign='left'; ctx.textBaseline='alphabetic';
      ctx.lineWidth=2.8; ctx.lineJoin='round'; ctx.strokeStyle=C.bg;
      ctx.strokeText(lbl,q.x+3,q.y+b.th-3.5);
      ctx.globalAlpha=PRINT?.9:.75;
      ctx.fillStyle=ch2?ink(ch2.color):C.faint;
      ctx.fillText(lbl,q.x+3,q.y+b.th-3.5);
      ctx.restore();
    }
    /* chain order: top-right in both layers */
    if(showNums&&b.tw>26&&ch2) chipDraw(ctx,q.x+b.tw-3,q.y+3,String(chainPos(ch2,t,s)),ch2.color,'tr');
  }

  if(showLeg&&b.leg) drawLegend(ctx,s,b,sp,sd);
}
function drawBackups(ctx,s,b){
  const bk=bkOf(s), md=bkMode(s); if(md==='none') return;
  const d=Math.max(4,Math.min(b.tw,b.th)*0.24);
  const labelOf=ch=>{
    if(md==='device') return 'BK '+ch.name;
    const br=backupFor(s,ch); return br?'B '+br.name:null;
  };
  const labels=used(s,'data').filter(ch=>!isBackupRun(s,ch)).map(labelOf).filter(Boolean);
  ctx.save(); ctx.font=`700 10px ${FM}`;
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
    ctx.font=`700 ${fs.toFixed(2)}px ${FM}`;
    const ph=Math.max(9,fs+5), pw2=Math.min(room,ctx.measureText(t2).width+padX);
    /* pill centred on the tile so it can never spill onto the next panel */
    roundRect(ctx,hc.x-pw2/2,h.y-ph/2,pw2,ph,ph/2);
    ctx.fillStyle=C.chip; ctx.fill();
    ctx.strokeStyle=col; ctx.lineWidth=1.3; ctx.setLineDash([2,2]); ctx.stroke(); ctx.setLineDash([]);
    txt(ctx,t2,hc.x,h.y+fs*0.34,`700 ${fs.toFixed(2)}px ${FM}`,col,'center');
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
function flow(ctx,s,b,ch,isPower,dual,hops,label){
  ctx.save();
  const CO=ink(ch.color), TL=LT(s,ch);
  if(!TL.length){ ctx.restore(); return; }
  const lw=isPower?(dual?2.2:2.4):(dual?1.6:1.9);
  for(let i=0;i<TL.length-1;i++){
    const a=anchor(s,b,TL[i],isPower,dual), z2=anchor(s,b,TL[i+1],isPower,dual);
    ctx.strokeStyle=CO; ctx.lineWidth=lw; ctx.lineCap='round';
    ctx.setLineDash(isPower?[]:[7,5]);
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(z2.x,z2.y); ctx.stroke();
    ctx.setLineDash([]);
    const mx=(a.x+z2.x)/2, my=(a.y+z2.y)/2;
    const ang=Math.atan2(z2.y-a.y,z2.x-a.x), z=isPower?(dual?5:6):(dual?4.4:5.5);
    ctx.save();
    if(isPower){
      /* same glyph as the C1 head marker, sitting upright on the run */
      const gs=Math.max(9,Math.min(13.5,Math.min(b.tw,b.th)*0.28));
      ctx.font=`700 ${gs}px ${FM}`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.lineWidth=3.2; ctx.lineJoin='round'; ctx.strokeStyle=C.bg;
      ctx.strokeText('\u26A1',mx,my+0.5);
      ctx.fillStyle=CO; ctx.fillText('\u26A1',mx,my+0.5);
    } else {
      ctx.translate(mx,my); ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(z,0); ctx.lineTo(-z*.7,z*.78); ctx.lineTo(-z*.7,-z*.78); ctx.closePath();
      ctx.fillStyle=CO; ctx.fill();
    }
    ctx.restore();
    if(hops&&b.tw>46){
      const label=`${i+1}\u2192${i+2}`, yo=isPower?-10:10;
      ctx.font=`7.5px ${FM}`;
      const w=ctx.measureText(label).width+9;
      roundRect(ctx,mx-w/2,my+yo-6,w,12,6); ctx.fillStyle=C.chip; ctx.fill();
      ctx.strokeStyle=CO; ctx.lineWidth=.9; ctx.stroke();
      txt(ctx,label,mx,my+yo+2,`7.5px ${FM}`,CO,'center');
    }
  }
  const h=anchor(s,b,TL[0],isPower,dual), rad=isPower?(dual?7:8):(dual?6:6.5);
  const glyph=isPower?'\u26A1':'\u25B6';
  if(label&&b.tw>=30){
    const t=glyph+' '+label;
    ctx.font=`700 8.5px ${FM}`;
    const w=ctx.measureText(t).width+11, hh=14;
    roundRect(ctx,h.x-w/2,h.y-hh/2,w,hh,7);
    ctx.fillStyle=C.chip; ctx.fill();
    ctx.strokeStyle=CO; ctx.lineWidth=1.6; ctx.stroke();
    txt(ctx,t,h.x,h.y+3,`700 8.5px ${FM}`,CO,'center');
    if(LABELLED) LABELLED.add(TL[0]);
  } else {
    ctx.beginPath(); ctx.arc(h.x,h.y,rad,0,Math.PI*2);
    ctx.fillStyle=C.chip; ctx.fill(); ctx.strokeStyle=CO; ctx.lineWidth=1.6; ctx.stroke();
    txt(ctx,glyph,h.x,h.y+3,`700 ${isPower?9:8}px ${FM}`,CO,'center');
  }
  ctx.restore();
}
function drawLegend(ctx,s,b,sp,sd){
  const groups=legendGroups(s,sp,sd);
  if(!groups.length) return;
  const x0=PAD, maxW=b.w-PAD*2, colW=maxW/b.perRow;
  let y=HEADH+PAD+b.gh+PAD;
  ctx.strokeStyle=C.line; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(x0,y-7); ctx.lineTo(b.w-PAD,y-7); ctx.stroke();
  y+=2;
  groups.forEach((grp,gi)=>{
    ctx.save(); ctx.font=`8px ${FM}`;
    let head=grp.title;
    if(ctx.measureText(head).width>maxW-40&&grp.short) head=grp.short;
    ctx.restore();
    txt(ctx,head,x0,y+4,`8px ${FM}`,C.faint);
    ctx.save();
    ctx.font=`8px ${FM}`;
    const tw2=ctx.measureText(head).width;
    ctx.strokeStyle=C.rule; ctx.lineWidth=1; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(x0+tw2+10,y+1); ctx.lineTo(b.w-PAD,y+1); ctx.stroke();
    ctx.restore();
    y+=13;
    const per=grp.items.length===1?1:b.perRow;
    const cw=maxW/per;
    grp.items.forEach((it,i)=>{
      const x=x0+(i%per)*cw, ly=y+Math.floor(i/per)*13+2;
      ctx.save(); ctx.strokeStyle=ink(it.c); ctx.lineWidth=2.2; ctx.lineCap='round';
      ctx.setLineDash(it.dash===2?[2,2]:it.dash?[4,3]:[]);
      ctx.beginPath(); ctx.moveTo(x,ly); ctx.lineTo(x+12,ly); ctx.stroke(); ctx.restore();
      let label=it.t+(it.over?'   OVER':'');
      ctx.save(); ctx.font=`8px ${FM}`;
      if(it.short&&ctx.measureText(label).width>cw-22) label=it.short+(it.over?'  OVER':'');
      ctx.restore();
      label=clipText(ctx,label,cw-22,`8px ${FM}`);
      txt(ctx,label,x+17,ly+3,`8px ${FM}`,it.over?C.bad:C.sub);
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
  rows.push({h:1,a:'SET TOTAL',b:`${S.screens.length} screens`,c:`${(st.px/1e6).toFixed(2)} M px`,d:lbFmt(st.lb),
    e:`${st.tiles} tiles · ${(st.wMax/1000).toFixed(2)} kW max / ${(st.wAvg/1000).toFixed(2)} kW avg`,
    f:`${st.circ} circuits · ${st.runs} runs`});
  const H=Math.max(520,120+rows.length*20+60);
  ctx.fillStyle=C.bg; ctx.fillRect(0,0,W,H);
  txt(ctx,clipText(ctx,`${titleShow()} — System Summary`,W-72,`600 27px ${FD}`),36,42,`600 27px ${FD}`,C.head);
  const hb=[titleVenue(),titleDate()];
  if(XO&&XO.author) hb.push('Drawn by '+XO.author);
  if(XO&&XO.rev) hb.push('Dwg '+XO.rev);
  txt(ctx,clipText(ctx,hb.filter(Boolean).join('   ·   '),W-72,`10px ${FM}`),36,60,`10px ${FM}`,C.sub);
  ctx.strokeStyle=C.line; ctx.beginPath(); ctx.moveTo(36,74); ctx.lineTo(W-36,74); ctx.stroke();
  const cols=[56,240,430,570,760,1090], hd=['Item','Detail','Resolution','Size','Rating','Device'];
  const wid=cols.map((c,i)=>(i<cols.length-1?cols[i+1]:W-36)-c-12);
  hd.forEach((t,i)=>txt(ctx,t,cols[i],94,`600 9.5px ${FS}`,C.faint));
  let y=114, zi=0;
  rows.forEach(r=>{
    if(r.h){ zi=0; roundRect(ctx,36,y-14,W-72,22,7); ctx.fillStyle=C.band; ctx.fill();
      txt(ctx,clipText(ctx,r.a,wid[0],`700 11px ${FS}`),44,y,`700 11px ${FS}`,C.head); }
    else { if(zi++%2){ roundRect(ctx,36,y-13,W-72,20,6); ctx.save(); ctx.globalAlpha=.5; ctx.fillStyle=C.band; ctx.fill(); ctx.restore(); }
      if(r.col){ ctx.beginPath(); ctx.arc(45,y-3,3.5,0,Math.PI*2); ctx.fillStyle=ink(r.col); ctx.fill(); }
      txt(ctx,clipText(ctx,r.a,wid[0],`9.5px ${FM}`),cols[0],y,`9.5px ${FM}`,C.sub); }
    [r.b,r.c,r.d,r.e,r.f].forEach((v,i)=>{ if(v==null) return;
      txt(ctx,clipText(ctx,String(v),wid[i+1],`9.5px ${FM}`),cols[i+1],y,`9.5px ${FM}`,
        r.h?C.sub:(r.over&&i===4?C.bad:C.cell)); });
    y+=20;
  });
  txt(ctx,`Circuit amps sized on ${o.useAvg?'average':'maximum'} panel draw${o.derate?' with 80% continuous derate':' at full breaker rating'}. Port capacity shown at ${bitDepth()}-bit${bitDepth()!==8?` (${Math.round(bitFactor()*100)}% of the published 8-bit figure)`:''}. Confirm against panel spec sheets and local code before energizing.`,
      36,H-24,`8.5px ${FM}`,C.faint);
  return {w:W,h:H};
}

function drawSchedule(ctx){
  const rows=cableRows(), W=1340;
  const H=Math.max(520,120+(rows.length+S.screens.length)*22+70);
  ctx.fillStyle=C.bg; ctx.fillRect(0,0,W,H);
  txt(ctx,clipText(ctx,`${titleShow()} — Cable Schedule`,W-72,`600 27px ${FD}`),36,42,`600 27px ${FD}`,C.head);
  const hb=[titleVenue(),titleDate()];
  if(XO&&XO.author) hb.push('Drawn by '+XO.author);
  if(XO&&XO.rev) hb.push('Dwg '+XO.rev);
  txt(ctx,clipText(ctx,hb.filter(Boolean).join('   ·   '),W-72,`10px ${FM}`),36,60,`10px ${FM}`,C.sub);
  ctx.strokeStyle=C.line; ctx.beginPath(); ctx.moveTo(36,74); ctx.lineTo(W-36,74); ctx.stroke();
  const cols=[56,116,200,470,720,830,960,1120], wid=cols.map((c,i)=>(i<cols.length-1?cols[i+1]:W-36)-c-10);
  ['Type','ID','From','To','Tiles','Load','Est. run','Spec'].forEach((t,i)=>txt(ctx,t,cols[i],94,`600 9.5px ${FS}`,C.faint));
  let y=114, cur='', zi=0;
  rows.forEach(r=>{
    if(r.screen!==cur){
      cur=r.screen; zi=0;
      roundRect(ctx,36,y-14,W-72,22,7); ctx.fillStyle=C.band; ctx.fill();
      txt(ctx,clipText(ctx,cur,W-90,`700 11px ${FS}`),44,y,`700 11px ${FS}`,C.head);
      y+=22;
    }
    if(zi++%2){ roundRect(ctx,36,y-13,W-72,20,6); ctx.save(); ctx.globalAlpha=.5; ctx.fillStyle=C.band; ctx.fill(); ctx.restore(); }
    ctx.beginPath(); ctx.arc(45,y-3,3.5,0,Math.PI*2); ctx.fillStyle=ink(r.color); ctx.fill();
    const vals=[r.kind,r.id,r.from,r.to,String(r.tiles),r.load,r.est+' ft',r.spec+' ft'];
    vals.forEach((v,i)=>txt(ctx,clipText(ctx,v,wid[i],`9.5px ${FM}`),cols[i],y,`9.5px ${FM}`,i<2?C.sub:C.cell));
    y+=20;
  });
  txt(ctx,'Run lengths are estimated from tile-to-tile geometry plus a drop to deck and 10 ft of slack. Verify on site before cutting or ordering.',
      36,H-24,`8.5px ${FM}`,C.faint);
  return {w:W,h:H};
}
function scheduleCanvas(){ return renderToCanvas(p=>drawSchedule(p),ctx=>drawSchedule(ctx)); }

