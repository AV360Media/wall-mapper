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
const PM_PATTERNS=[['classic','Classic'],['cabinets','Panel IDs'],['grid','Alignment'],['bars','Colour bars'],['spectrum','Spectrum'],['sunburst','Sunburst'],['quad','Quadrants'],['outline','Edges'],['hex','Honeycomb']];
const PM_OLD={grey:'classic',fields:'classic',pixel:'grid'};   /* patterns from older builds */
const pmPat=k=>{ k=PM_OLD[k]||k; return PM_PATTERNS.some(p=>p[0]===k)?k:'classic'; };
const pmCol=i=>{ const P=PM_PALETTES[pmOf().palette]||PM_PALETTES.vivid; return P[i%P.length]; };
function pmRGBA(hex,a){ const n=parseInt(hex.slice(1),16); return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`; }

/* the pattern itself, inside x,y,W,H, with cabinets cw × ch; lines land on whole LED pixels */
function pmPaint(ctx,o,x,y,style){
  style=pmPat(style);
  const s=o.s, W=o.W, H=o.H, cw=o.cw, ch=o.ch, col=o.col, cols=s.cols, rows=s.rows;
  const u=Math.max(1,Math.min(cw,ch)/64);                  /* line weight that scales with the cabinet */
  const px=Math.max(1,Math.round(u*.6));                   /* thin lines: 1 LED pixel on most panels */
  const R=v=>Math.round(v);
  const vl=(xx,c,w)=>{ ctx.fillStyle=c; ctx.fillRect(R(xx),y,w,H); };
  const hl=(yy,c,w)=>{ ctx.fillStyle=c; ctx.fillRect(x,R(yy),W,w); };
  const seams=(c,w)=>{ for(let i=1;i<cols;i++) vl(x+i*cw-w,c,w*2); for(let j=1;j<rows;j++) hl(y+j*ch-w,c,w*2); };
  const ring=(cx,cy,r,stroke,lw)=>{ if(r<=0) return; ctx.strokeStyle=stroke; ctx.lineWidth=lw; ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke(); };
  const diag=(stroke,lw)=>{ ctx.strokeStyle=stroke; ctx.lineWidth=lw; ctx.beginPath();
    ctx.moveTo(x,y); ctx.lineTo(x+W,y+H); ctx.moveTo(x,y+H); ctx.lineTo(x+W,y); ctx.stroke(); };
  const txt=(t,tx,ty,sz,c,w,fam)=>{ ctx.font=`${w||700} ${sz}px ${fam||FS}`; ctx.fillStyle=c; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(t,tx,ty); };
  const mx=x+W/2, my=y+H/2, rad=Math.min(W,H)/2;
  ctx.save(); ctx.beginPath(); ctx.rect(x,y,W,H); ctx.clip();
  if(style==='cabinets'){                                   /* panel IDs: checkered panels, each with its column.row and pixel origin */
    for(let i=0;i<cols;i++) for(let j=0;j<rows;j++){ const cx=x+i*cw, cy=y+j*ch;
      ctx.fillStyle='#07080b'; ctx.fillRect(cx,cy,cw,ch);
      const g=ctx.createLinearGradient(cx,cy,cx,cy+ch); g.addColorStop(0,pmRGBA(col,(i+j)%2?.42:.26)); g.addColorStop(1,pmRGBA(col,(i+j)%2?.3:.17));
      ctx.fillStyle=g; ctx.fillRect(cx,cy,cw,ch);
      ctx.strokeStyle='rgba(255,255,255,.07)'; ctx.lineWidth=px; ctx.strokeRect(cx+px*1.5+u,cy+px*1.5+u,cw-px*3-u*2,ch-px*3-u*2);   /* soft inner edge */
    }
    seams(pmRGBA(col,.95),Math.max(1,R(u)));
    const f2=Math.min(cw*.3,ch*.3), f3=f2*.3, sub=ch>=48&&cw>=48;
    for(let i=0;i<cols;i++) for(let j=0;j<rows;j++){ const cx=x+(i+.5)*cw, cy=y+(j+.5)*ch;
      txt(`${i+1}.${j+1}`,cx,cy-(sub?f3*.7:0),f2,'#fff');
      if(sub) txt(`${i*cw}, ${j*ch}`,cx,cy+f2*.55+f3*.2,f3,'rgba(255,255,255,.55)',500,FM); }
  } else if(style==='grid'){                                /* alignment: every panel edge lit, centre lines with ticks, circles, diagonals */
    ctx.fillStyle='#000'; ctx.fillRect(x,y,W,H);
    for(let i=0;i<cols;i++) for(let j=0;j<rows;j++){ const cx=x+i*cw, cy=y+j*ch;
      if((i+j)%2){ ctx.fillStyle='#0d0e12'; ctx.fillRect(cx,cy,cw,ch); }
      ctx.strokeStyle='rgba(255,255,255,.9)'; ctx.lineWidth=px; ctx.strokeRect(cx+px/2,cy+px/2,cw-px,ch-px);   /* each panel's own outer pixels */
      const k=R(Math.min(cw,ch)*.07); ctx.fillStyle=pmRGBA(col,.85);
      ctx.fillRect(R(cx+cw/2-k),R(cy+ch/2),k*2,px); ctx.fillRect(R(cx+cw/2),R(cy+ch/2-k),px,k*2); }
    diag(pmRGBA(col,.5),px*1.5);
    ring(mx,my,rad*.97,'#fff',px*3); ring(mx,my,rad*.66,'rgba(255,255,255,.75)',px*2); ring(mx,my,rad*.33,'rgba(255,255,255,.6)',px*2);
    const cr=Math.min(W,H)*.12, ci=cr+Math.min(cw,ch)*.25;   /* corner circles show geometry and overscan */
    [[x+ci,y+ci],[x+W-ci,y+ci],[x+ci,y+H-ci],[x+W-ci,y+H-ci]].forEach(([cx,cy])=>{ ring(cx,cy,cr,'rgba(255,255,255,.7)',px*2);
      ctx.fillStyle='#fff'; ctx.fillRect(R(cx-cr*.25),R(cy),R(cr*.5),px); ctx.fillRect(R(cx),R(cy-cr*.25),px,R(cr*.5)); });
    vl(mx-px,col,px*2); hl(my-px,col,px*2);                  /* centre lines, with a tick every quarter panel */
    const tk=Math.max(4,Math.min(cw,ch)*.08); ctx.fillStyle=col;
    for(let t=0;t<=W;t+=cw/4) ctx.fillRect(R(x+t),R(my-tk/(t%cw<1?1:2)),px,R(tk*2/(t%cw<1?1:2)));
    for(let t=0;t<=H;t+=ch/4) ctx.fillRect(R(mx-tk/(t%ch<1?1:2)),R(y+t),R(tk*2/(t%ch<1?1:2)),px);
    ring(mx,my,Math.max(3,Math.min(cw,ch)*.12),col,px*2); ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(mx,my,Math.max(1.5,px*2),0,Math.PI*2); ctx.fill();
  } else if(style==='spectrum'){                            /* full hue sweep, lighter at the top and deeper at the bottom */
    const g=ctx.createLinearGradient(x,0,x+W,0);
    ['#ff1a1a','#ffb000','#f5ff00','#19e04a','#00d5ff','#2a5bff','#b026ff','#ff1a8c'].forEach((c,i,a)=>g.addColorStop(i/(a.length-1),c));
    ctx.fillStyle=g; ctx.fillRect(x,y,W,H);
    const v=ctx.createLinearGradient(0,y,0,y+H); v.addColorStop(0,'rgba(255,255,255,.38)'); v.addColorStop(.45,'rgba(255,255,255,0)'); v.addColorStop(.55,'rgba(0,0,0,0)'); v.addColorStop(1,'rgba(0,0,0,.62)');
    ctx.fillStyle=v; ctx.fillRect(x,y,W,H);
    seams('rgba(0,0,0,.28)',Math.max(1,R(u*.75)));
    diag('rgba(255,255,255,.45)',u*1.5); ring(mx,my,rad*.92,'rgba(255,255,255,.95)',u*3.5); ring(mx,my,rad*.46,'rgba(255,255,255,.5)',u*1.5);
  } else if(style==='sunburst'){                            /* rays from the centre in the screen colour, with rings */
    ctx.fillStyle='#06070a'; ctx.fillRect(x,y,W,H);
    const far=Math.hypot(W,H)/2, n=48;
    for(let k=0;k<n;k+=2){ const a0=k/n*Math.PI*2-Math.PI/2, a1=(k+1)/n*Math.PI*2-Math.PI/2;
      ctx.fillStyle=pmRGBA(col,.78); ctx.beginPath(); ctx.moveTo(mx,my); ctx.arc(mx,my,far,a0,a1); ctx.closePath(); ctx.fill(); }
    const fade=ctx.createRadialGradient(mx,my,rad*.1,mx,my,far); fade.addColorStop(0,'rgba(6,7,10,0)'); fade.addColorStop(1,'rgba(6,7,10,.7)');
    ctx.fillStyle=fade; ctx.fillRect(x,y,W,H);
    [.25,.5,.75].forEach(k=>ring(mx,my,rad*k,'rgba(255,255,255,.28)',u*1.5)); ring(mx,my,rad*.97,'#fff',u*3);
    seams('rgba(0,0,0,.35)',Math.max(1,R(u*.75)));
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(mx,my,Math.max(3,rad*.04),0,Math.PI*2); ctx.fill();
  } else if(style==='quad'){                                /* four coloured quarters, named, so a swapped or flipped feed shows at once */
    const Q=[['TOP LEFT','#3b82f6'],['TOP RIGHT','#10b981'],['BOTTOM LEFT','#f59e0b'],['BOTTOM RIGHT','#ef4444']], hw=R(W/2), hh=R(H/2);
    Q.forEach(([t,c],k)=>{ const qx=x+(k%2?hw:0), qy=y+(k>1?hh:0), qw=k%2?W-hw:hw, qh=k>1?H-hh:hh;
      ctx.fillStyle='#07080b'; ctx.fillRect(qx,qy,qw,qh);
      const g=ctx.createLinearGradient(qx,qy,qx+qw,qy+qh); g.addColorStop(0,pmRGBA(c,k%3?.42:.62)); g.addColorStop(1,pmRGBA(c,k%3?.62:.42));
      ctx.fillStyle=g; ctx.fillRect(qx,qy,qw,qh);
      const fs=Math.min(qh*.12,qw*.09), tx=qx+(k%2?qw-fs*1.1:fs*1.1), ty=qy+(k>1?qh-fs*1.1:fs*1.1);
      ctx.font=`700 ${fs}px ${FS}`; ctx.fillStyle='rgba(255,255,255,.92)'; ctx.textAlign=k%2?'right':'left'; ctx.textBaseline=k>1?'bottom':'top';
      ctx.fillText(t,tx,ty); });
    seams('rgba(255,255,255,.14)',Math.max(1,R(u*.6)));
    vl(mx-px,'#fff',px*2); hl(my-px,'#fff',px*2);
  } else if(style==='outline'){                             /* edges: every border pixel lit, arrows and names on each side */
    ctx.fillStyle='#06070a'; ctx.fillRect(x,y,W,H);
    for(let i=0;i<cols;i++) for(let j=0;j<rows;j++) if((i+j)%2){ ctx.fillStyle=pmRGBA(col,.08); ctx.fillRect(x+i*cw,y+j*ch,cw,ch); }
    seams(pmRGBA(col,.35),px);
    const e=Math.max(1,R(u*.75)); ctx.fillStyle='#fff';
    ctx.fillRect(x,y,W,e); ctx.fillRect(x,y+H-e,W,e); ctx.fillRect(x,y,e,H); ctx.fillRect(x+W-e,y,e,H);
    const m=Math.min(cw,ch), ah=m*.42, fs=Math.max(8,Math.min(m*.32,W*.05,H*.08));
    ctx.fillStyle=col;
    [[mx,y+e*2,0,1],[mx,y+H-e*2,0,-1],[x+e*2,my,1,0],[x+W-e*2,my,-1,0]].forEach(([ax,ay,dx,dy])=>{   /* arrows point out at each edge */
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(ax+dx*ah-dy*ah*.8,ay+dy*ah+dx*ah*.8); ctx.lineTo(ax+dx*ah+dy*ah*.8,ay+dy*ah-dx*ah*.8); ctx.closePath(); ctx.fill(); });
    txt('TOP',mx,y+e*2+ah+fs*.9,fs,'#fff'); txt('BOTTOM',mx,y+H-e*2-ah-fs*.9,fs,'#fff');
    ctx.save(); ctx.translate(x+e*2+ah+fs*.9,my); ctx.rotate(-Math.PI/2); txt('LEFT',0,0,fs,'#fff'); ctx.restore();
    ctx.save(); ctx.translate(x+W-e*2-ah-fs*.9,my); ctx.rotate(Math.PI/2); txt('RIGHT',0,0,fs,'#fff'); ctx.restore();
    const b=m*.7, ins=e+m*.18; ctx.strokeStyle=col; ctx.lineWidth=Math.max(2,u*3);   /* corner brackets */
    [[x,y,1,1],[x+W,y,-1,1],[x,y+H,1,-1],[x+W,y+H,-1,-1]].forEach(([qx,qy,sx,sy])=>{
      ctx.beginPath(); ctx.moveTo(qx+sx*(ins+b),qy+sy*ins); ctx.lineTo(qx+sx*ins,qy+sy*ins); ctx.lineTo(qx+sx*ins,qy+sy*(ins+b)); ctx.stroke(); });
    ring(mx,my,Math.max(4,m*.25),pmRGBA(col,.9),Math.max(1,u*2));
  } else if(style==='hex'){                                 /* honeycomb in the screen colour, glowing from the centre */
    ctx.fillStyle='#06070a'; ctx.fillRect(x,y,W,H);
    const r=Math.max(6,Math.min(cw,ch)*.3), hx=r*Math.sqrt(3), far=Math.hypot(W,H)/2;
    for(let j=0,yy=y-r;yy<y+H+r;j++,yy+=r*1.5) for(let xx=x-hx+(j%2?hx/2:0);xx<x+W+hx;xx+=hx){
      const d=Math.hypot(xx-mx,yy-my)/far, a=.14+.74*Math.pow(1-Math.min(1,d),1.8);
      ctx.beginPath(); for(let k=0;k<6;k++){ const t=Math.PI/3*k+Math.PI/6, qx=xx+r*.92*Math.cos(t), qy=yy+r*.92*Math.sin(t); k?ctx.lineTo(qx,qy):ctx.moveTo(qx,qy); }
      ctx.closePath(); ctx.fillStyle=pmRGBA(col,a); ctx.fill(); }
    seams('rgba(255,255,255,.16)',Math.max(1,R(u*.6)));
    ring(mx,my,rad*.92,'rgba(255,255,255,.9)',u*3);
  } else if(style==='bars'){                                /* SMPTE-style bars with reverse strip and PLUGE */
    const bw=W/7, bh=R(H*.67), mh=R(H*.08), ly=y+bh+mh;
    const bar=(c,bx,by,w,h)=>{ ctx.fillStyle=c; ctx.fillRect(R(bx),by,R(bx+w)-R(bx),h); };
    ['#bfbfbf','#bfbf00','#00bfbf','#00bf00','#bf00bf','#bf0000','#0000bf'].forEach((c,i)=>bar(c,x+i*bw,y,bw,bh));
    ['#0000bf','#131313','#bf00bf','#131313','#00bfbf','#131313','#bfbfbf'].forEach((c,i)=>bar(c,x+i*bw,y+bh,bw,mh));
    const lh=y+H-ly, w5=bw*5/4; let bx=x;
    ['#00214c','#ffffff','#32006a','#131313'].forEach(c=>{ bar(c,bx,ly,w5,lh); bx+=w5; });
    ['#090909','#131313','#1d1d1d'].forEach(c=>{ bar(c,bx,ly,bw/3,lh); bx+=bw/3; });   /* PLUGE: below, at and above black */
    bar('#131313',bx,ly,x+W-bx,lh);
  } else {                                                  /* classic */
    const g=ctx.createLinearGradient(x,y,x+W,y+H); g.addColorStop(0,pmRGBA(col,.58)); g.addColorStop(1,pmRGBA(col,.32));
    ctx.fillStyle='#07080b'; ctx.fillRect(x,y,W,H); ctx.fillStyle=g; ctx.fillRect(x,y,W,H);
    ctx.fillStyle='rgba(255,255,255,.07)';
    for(let i=0;i<cols;i++) for(let j=0;j<rows;j++) if((i+j)%2) ctx.fillRect(x+i*cw,y+j*ch,cw,ch);
    seams(pmRGBA(col,.85),Math.max(1,R(u*.75)));
    diag('rgba(255,255,255,.7)',u*2); ring(mx,my,rad*.92,'#ffffff',u*3.5);
  }
  /* cabinets switched off in Wall Mapper are not lit */
  (s.off||[]).forEach(t=>{ const [r,c]=t.split(':').map(Number); if(r>=rows||c>=cols) return;
    ctx.fillStyle='#050608'; ctx.fillRect(x+c*cw,y+r*ch,cw,ch);
    ctx.strokeStyle='#2a2d36'; ctx.lineWidth=u; ctx.beginPath(); ctx.moveTo(x+c*cw,y+r*ch); ctx.lineTo(x+(c+1)*cw,y+(r+1)*ch);
    ctx.moveTo(x+(c+1)*cw,y+r*ch); ctx.lineTo(x+c*cw,y+(r+1)*ch); ctx.stroke(); });
  /* top-left marker: shows straight away if a slice is flipped or rotated */
  const t=Math.min(cw,ch,W*.2,H*.2)*.55;
  ctx.fillStyle=style==='bars'||style==='spectrum'||style==='quad'?'#ffffff':col;
  ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+t,y); ctx.lineTo(x,y+t); ctx.closePath(); ctx.fill();
  ctx.restore();
  /* border: colour with a fine white line inside; pixel-exact patterns keep the edge pixels clear with a thin outline */
  if(!['grid','bars','outline'].includes(style)){
    const bw=Math.max(2,u*5);
    ctx.strokeStyle=col; ctx.lineWidth=bw; ctx.strokeRect(x+bw/2,y+bw/2,W-bw,H-bw);
    ctx.strokeStyle='rgba(255,255,255,.85)'; ctx.lineWidth=Math.max(1,u*1.2); ctx.strokeRect(x+bw+u,y+bw+u,W-2*(bw+u),H-2*(bw+u));
  } else { const bw=Math.max(1,R(u)); ctx.strokeStyle=col; ctx.lineWidth=bw; ctx.strokeRect(x+bw/2,y+bw/2,W-bw,H-bw); }
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

