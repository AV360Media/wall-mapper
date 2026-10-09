/* ========================= GEOMETRY: CURVES, ANGLES, VIEWING ========================= */
/* s.curve is the angle at every column joint (+ wraps toward the audience, - bows away);
   s.yaw turns the whole screen in plan (+ is clockwise seen from above) */
const rad=d=>d*Math.PI/180;
const curveOf=s=>+s.curve||0, yawOf=s=>+s.yaw||0;
const bent=s=>!!(curveOf(s)||yawOf(s));
const ftR=mm=>ftIn(Math.round(mm/25.4)*25.4);   /* to the nearest inch */
/* plan polyline of the panel edges in mm, centred on the chord, before any yaw */
function geo(s){
  const p=panelById(s.panelId), w=p?p.wmm:500, n=Math.max(1,s.cols), a=rad(curveOf(s));
  let th=-a*(n-1)/2, x=0, y=0; const pts=[{x,y}];
  for(let k=0;k<n;k++){ x+=w*Math.cos(th); y+=w*Math.sin(th); pts.push({x,y}); th+=a; }
  const A=pts[0], Z=pts[n], mx=(A.x+Z.x)/2, my=(A.y+Z.y)/2;
  pts.forEach(q=>{ q.x-=mx; q.y-=my; });
  const chord=Math.hypot(Z.x-A.x,Z.y-A.y);
  let depth=0; pts.forEach(q=>{ depth=Math.max(depth,Math.abs(q.y)); });
  return {pts,chord,depth,arc:n*w,total:Math.abs(curveOf(s))*(n-1),radius:a?w/(2*Math.sin(Math.abs(a)/2)):0};
}
/* rule of thumb: closest comfortable distance ≈ 1 m per mm of pitch, best from about 3× that */
function viewDist(s){
  const p=panelById(s.panelId); if(!p||!p.pitch) return null;
  return {min:p.pitch*1000,best:p.pitch*3000};
}
function curveText(s){
  const g=geo(s), bits=[];
  if(curveOf(s)) bits.push(`${(+g.total.toFixed(1))}° ${curveOf(s)>0?'concave':'convex'}`,`R ${ftR(g.radius)}`);
  if(yawOf(s)) bits.push(`turned ${yawOf(s)>0?'+':'−'}${Math.abs(yawOf(s))}°`);
  return bits.join(' · ');
}
/* ---- plan view: every screen from above, audience at the bottom ---- */
function planLayout(){
  const L=S.screens.filter(s=>panelById(s.panelId)).map((s,i)=>{
    const g=geo(s), b=sbox(s), cx=(s.x+b.w/2)/MM, cy=-(+s.depth||0), t=rad(yawOf(s)), c=Math.cos(t), sn=Math.sin(t);
    const P=g.pts.map(q=>({x:cx+q.x*c-q.y*sn,y:cy+q.x*sn+q.y*c}));
    const v=viewDist(s), off=[];
    if(v) for(let k=0;k<P.length;k++){   /* each panel edge pushed out toward the audience by the closest viewing distance */
      const a=P[Math.max(0,k-1)], z=P[Math.min(P.length-1,k+1)], dx=z.x-a.x, dy=z.y-a.y, l=Math.hypot(dx,dy)||1;
      off.push({x:P[k].x-dy/l*v.min,y:P[k].y+dx/l*v.min}); }
    return {s,g,P,off,v,col:pmCol(i)};
  });
  let x1=1e9,y1=1e9,x2=-1e9,y2=-1e9;
  L.forEach(o=>o.P.concat(o.off).forEach(q=>{ x1=Math.min(x1,q.x); y1=Math.min(y1,q.y); x2=Math.max(x2,q.x); y2=Math.max(y2,q.y); }));
  if(x1>x2){ x1=y1=0; x2=y2=1000; }
  const m=Math.max(600,(x2-x1)*.06); x1-=m; x2+=m; y1-=m*1.6; y2+=m*1.2;
  return {L,x1,y1,x2,y2};
}
function drawPlan(ctx,measureOnly,Wd){
  const D=planLayout(), W=Wd||1200, G=30, inner=W-G*2, k=inner/(D.x2-D.x1);
  const T=84, H=Math.round(T+(D.y2-D.y1)*k+G+28);
  if(measureOnly) return {w:W,h:H};
  const X=v=>G+(v-D.x1)*k, Y=v=>T+(v-D.y1)*k;
  ctx.fillStyle=C.bg; ctx.fillRect(0,0,W,H);
  txt(ctx,clipText(ctx,`${titleShow()} — Plan View`,inner,`600 23px ${FD}`),G,30,`600 23px ${FD}`,C.head);
  txt(ctx,'Seen from above, audience at the bottom. Shaded band: closer than the comfortable viewing distance for the pitch.',G,50,`9.5px ${FS}`,C.faint);
  drawStamp(ctx,G,W-G,68);
  ctx.strokeStyle=C.line; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(G,T-8); ctx.lineTo(W-G,T-8); ctx.stroke();
  /* 5 ft grid, or 10 ft on big sets */
  const step=(D.x2-D.x1)>30000?3048:1524; ctx.strokeStyle=C.dot||C.line; ctx.lineWidth=1;
  for(let v=Math.ceil(D.x1/step)*step;v<D.x2;v+=step){ ctx.beginPath(); ctx.moveTo(X(v),T); ctx.lineTo(X(v),H-G-20); ctx.stroke(); }
  for(let v=Math.ceil(D.y1/step)*step;v<D.y2;v+=step){ ctx.beginPath(); ctx.moveTo(G,Y(v)); ctx.lineTo(W-G,Y(v)); ctx.stroke(); }
  txt(ctx,'UPSTAGE',W/2,T+14,`700 9px ${FM}`,C.faint,'center');
  txt(ctx,'AUDIENCE',W/2,H-G-6,`700 9px ${FM}`,C.faint,'center');
  D.L.forEach(o=>{
    if(o.off.length){   /* too-close band */
      ctx.beginPath(); o.P.forEach((q,i)=>i?ctx.lineTo(X(q.x),Y(q.y)):ctx.moveTo(X(q.x),Y(q.y)));
      for(let i=o.off.length-1;i>=0;i--) ctx.lineTo(X(o.off[i].x),Y(o.off[i].y));
      ctx.closePath(); ctx.fillStyle=pmRGBA(o.col,.12); ctx.fill();
      ctx.setLineDash([5,4]); ctx.strokeStyle=pmRGBA(o.col,.8); ctx.lineWidth=1.2; ctx.beginPath();
      o.off.forEach((q,i)=>i?ctx.lineTo(X(q.x),Y(q.y)):ctx.moveTo(X(q.x),Y(q.y))); ctx.stroke(); ctx.setLineDash([]);
      const e=o.off[o.off.length-1]; txt(ctx,ftR(o.v.min),X(e.x)+4,Y(e.y)+3,`9px ${FM}`,o.col);
    }
    ctx.strokeStyle=o.col; ctx.lineWidth=5; ctx.lineCap='round'; ctx.lineJoin='round';
    ctx.beginPath(); o.P.forEach((q,i)=>i?ctx.lineTo(X(q.x),Y(q.y)):ctx.moveTo(X(q.x),Y(q.y))); ctx.stroke(); ctx.lineCap='butt';
    ctx.fillStyle=C.bg; o.P.forEach(q=>{ ctx.beginPath(); ctx.arc(X(q.x),Y(q.y),1.6,0,Math.PI*2); ctx.fill(); });   /* panel joints */
    const ux=(o.P[0].x+o.P[o.P.length-1].x)/2;
    const top=Math.min(...o.P.map(q=>Y(q.y)));
    txt(ctx,o.s.name,X(ux),top-20,`600 11px ${FS}`,C.head,'center');
    const info=[`${ftR(o.g.chord)} wide`].concat(o.g.depth>1?[`${ftR(o.g.depth)} deep`]:[]).concat(curveText(o.s)?[curveText(o.s)]:[]);
    txt(ctx,info.join(' · '),X(ux),top-8,`9px ${FM}`,C.sub,'center');
  });
  /* scale bar */
  const sb=step*2, sx=W-G-sb*k, sy=H-G-6;
  ctx.fillStyle=C.sub; ctx.fillRect(sx,sy-3,sb*k,2);
  txt(ctx,ftIn(sb),sx-6,sy,`9px ${FM}`,C.sub,'right');
  return {w:W,h:H};
}
function planCanvas(){ return renderToCanvas(()=>drawPlan(null,true),ctx=>drawPlan(ctx,false)); }
function openPlan(){
  if(needScreen()) return;
  const host=document.getElementById('planBody'), c=withPrint(()=>planCanvas());
  host.innerHTML=''; c.style.width='100%'; c.style.height='auto'; c.style.borderRadius='10px'; host.appendChild(c);
  document.getElementById('planModal').classList.remove('hide');
}
function planPDF(){
  closeMask('planModal');
  const c=withPrint(()=>planCanvas());
  download(buildPDF([{jpg:b64ToBytes(c.toDataURL('image/jpeg',0.95).split(',')[1]),pw:c.width,ph:c.height,w:c.width,h:c.height}]),fileBase()+' plan.pdf');
  setStatus('Plan view downloaded');
}
