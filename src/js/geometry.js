/* ========================= GEOMETRY: CURVES, ANGLES, VIEWING ========================= */
/* Curved panels lock at numbered positions (1, 2, 3…) on their sides. s.joints[k] is the lock at
   the joint between column k and k+1: + wraps toward the audience, − bows away. s.locks holds the
   degrees each lock number gives. s.yaw turns the whole screen in plan (+ is clockwise from above). */
const rad=d=>d*Math.PI/180;
const DEF_LOCKS=[2.5,5,7.5];
const locksOf=s=>{ if(Array.isArray(s.locks)&&s.locks.length) return s.locks;   /* screen's own, else the panel's, else defaults */
  const p=panelById(s.panelId); return p&&Array.isArray(p.locks)&&p.locks.length?p.locks:DEF_LOCKS; };
const jointOf=(s,k)=>(s.joints&&s.joints[k])|0;
const jointDeg=(s,k)=>{ const v=jointOf(s,k), L=locksOf(s); return v?Math.sign(v)*(L[Math.min(L.length,Math.abs(v))-1]||0):0; };
const curved=s=>!!(s.joints&&s.joints.some((v,k)=>v&&k<s.cols-1));
const yawOf=s=>+s.yaw||0;
const bent=s=>curved(s)||!!yawOf(s);
const ftR=mm=>ftIn(Math.round(mm/25.4)*25.4);   /* to the nearest inch */
const lockFmt=v=>`${Math.abs(v)}${v<0?'−':''}`;
/* plan polyline of the panel edges in mm, chord level and centred, before any yaw */
function geo(s){
  const p=panelById(s.panelId), w=p?p.wmm:500, n=Math.max(1,s.cols);
  let th=0, x=0, y=0, sum=0; const pts=[{x,y}];
  for(let k=0;k<n;k++){ x+=w*Math.cos(th); y+=w*Math.sin(th); pts.push({x,y}); if(k<n-1){ const d=rad(jointDeg(s,k)); th+=d; sum+=jointDeg(s,k); } }
  const A=pts[0], Z=pts[n], r=-Math.atan2(Z.y-A.y,Z.x-A.x), c=Math.cos(r), sn=Math.sin(r);
  pts.forEach(q=>{ const qx=q.x, qy=q.y; q.x=qx*c-qy*sn; q.y=qx*sn+qy*c; });
  const mx=(pts[0].x+pts[n].x)/2, my=(pts[0].y+pts[n].y)/2;
  pts.forEach(q=>{ q.x-=mx; q.y-=my; });
  const chord=Math.hypot(pts[n].x-pts[0].x,pts[n].y-pts[0].y);
  let depth=0; pts.forEach(q=>{ depth=Math.max(depth,Math.abs(q.y)); });
  const used=[]; for(let k=0;k<n-1;k++) used.push(jointDeg(s,k));
  const even=n>1&&used.every(v=>v&&v===used[0]);
  return {pts,chord,depth,arc:n*w,total:sum,radius:even?w/(2*Math.sin(Math.abs(rad(used[0]))/2)):0};
}
/* rule of thumb: closest comfortable distance ≈ 1 m per mm of pitch, best from about 3× that */
function viewDist(s){
  const p=panelById(s.panelId); if(!p||!p.pitch) return null;
  return {min:p.pitch*1000,best:p.pitch*3000};
}
function curveText(s){
  const g=geo(s), bits=[];
  if(curved(s)){ const t=Math.abs(+g.total.toFixed(1));
    bits.push(t?`${t}° ${g.total>0?'concave':'convex'}`:'S-curve'); if(g.radius) bits.push(`R ${ftR(g.radius)}`); }
  if(yawOf(s)) bits.push(`turned ${yawOf(s)>0?'+':'−'}${Math.abs(yawOf(s))}°`);
  return bits.join(' · ');
}
/* ---- curve lock editing ---- */
let tileTool='cut';
function setTileTool(v){
  tileTool=v;
  document.querySelectorAll('#tlTool button').forEach(b=>b.classList.toggle('on',b.dataset.v===v));
  document.getElementById('curveOpts').style.display=v==='curve'?'':'none';
  document.getElementById('modeHint').textContent=v==='curve'
    ?'Click the left or right side of a panel to set the curve lock on that joint. Each click steps 1, 2, 3, then the convex side (−); Shift-click steps back.'
    :'Click tiles to switch them off for cutouts.';
  segSync(); redraw();
}
function stepJoint(s,k,back){
  const N=locksOf(s).length, order=[0];
  for(let i=1;i<=N;i++) order.push(i); for(let i=1;i<=N;i++) order.push(-i);
  const at=Math.max(0,order.indexOf(jointOf(s,k))), v=order[(at+(back?order.length-1:1))%order.length];
  s.joints=s.joints||[]; while(s.joints.length<s.cols-1) s.joints.push(0);
  s.joints[k]=v;
  setStatus(v?`Joint ${k+1}|${k+2}: lock ${lockFmt(v)} (${jointDeg(s,k)>0?'+':''}${jointDeg(s,k)}°)`:`Joint ${k+1}|${k+2}: flat`);
}
/* which joint a click on tile c lands on: the side of the tile nearest the pointer */
function jointAt(s,b,t,lx){
  const c=+t.split(':')[1], r=+t.split(':')[0], q=tileXY(s,b,r,c), right=lx>q.x+b.tw/2;
  const nb=right!==!!opt().rear?c+1:c-1;   /* rear view mirrors the columns */
  const k=Math.min(c,nb);
  return k>=0&&k<s.cols-1?k:null;
}
function setLocks(v){
  const s=sc(); if(!s) return;
  const L=String(v).split(/[,\s]+/).map(Number).filter(x=>x>0&&x<=45);
  pushUndo('curve lock angles'); if(L.length) s.locks=L; else delete s.locks;
  syncCurveForm(); renderSide(); syncGeo(); redraw(); save();
}
function setAllJoints(v){
  const s=sc(); if(!s) return; v=+v||0;
  pushUndo(v?'curve every joint':'clear curves');
  s.joints=Array(Math.max(0,s.cols-1)).fill(v);
  syncCurveForm(); renderSide(); syncGeo(); redraw(); save();
  setStatus(v?`Every joint on lock ${lockFmt(v)}`:'Curves cleared');
}
function syncCurveForm(){
  const s=sc(), el=document.getElementById('scLocks'); if(!s||!el) return;
  if(document.activeElement!==el) el.value=locksOf(s).join(', ');
  const L=locksOf(s), sel=document.getElementById('lkAll');
  sel.innerHTML='<option value="">Set every joint to…</option>'+L.map((d,i)=>`<option value="${i+1}">Lock ${i+1} · ${d}° toward audience</option>`).join('')
    +L.map((d,i)=>`<option value="${-(i+1)}">Lock ${i+1}− · ${d}° away</option>`).join('');
  const n=(s.joints||[]).filter((v,k)=>v&&k<s.cols-1).length;
  document.getElementById('lkNote').textContent=n?`${n} of ${s.cols-1} joints curved · ${curveText(s)}`:'All joints flat.';
}
/* ---- plan view: every screen from above, audience at the bottom ---- */
/* the edge of everything closer than m to the wall, on the audience side. Offsets each panel and
   rounds each outside corner, then drops points that sit closer than m to some other panel
   (a tight concave wrap pinches the band down to a point instead of folding over itself) */
function band(P,m){
  const n=[], out=[], segD=(q,a,z)=>{ const dx=z.x-a.x, dy=z.y-a.y, l2=dx*dx+dy*dy||1, t=Math.max(0,Math.min(1,((q.x-a.x)*dx+(q.y-a.y)*dy)/l2));
    return Math.hypot(q.x-a.x-t*dx,q.y-a.y-t*dy); };
  for(let i=0;i<P.length-1;i++){ const dx=P[i+1].x-P[i].x, dy=P[i+1].y-P[i].y, l=Math.hypot(dx,dy)||1; n.push(Math.atan2(dx/l,-dy/l)); }
  const at=(q,a)=>({x:q.x+Math.cos(a)*m,y:q.y+Math.sin(a)*m});
  n.forEach((a,i)=>{
    if(i){ let d=a-n[i-1]; d=Math.atan2(Math.sin(d),Math.cos(d)); const st=Math.ceil(Math.abs(d)/.08);
      for(let j=1;j<st;j++) out.push(at(P[i],n[i-1]+d*j/st)); }
    for(let j=0;j<=8;j++){ const q={x:P[i].x+(P[i+1].x-P[i].x)*j/8,y:P[i].y+(P[i+1].y-P[i].y)*j/8}; out.push(at(q,a)); }
  });
  const A=P[0], Z=P[P.length-1], ux=Z.x-A.x, uy=Z.y-A.y;   /* survivors run left to right along the chord */
  return out.filter(q=>P.every((a,i)=>i===P.length-1||segD(q,a,P[i+1])>=m-1))
    .map(q=>[(q.x-A.x)*ux+(q.y-A.y)*uy,q]).sort((a,z)=>a[0]-z[0]).map(x=>x[1]);
}
function planLayout(){
  const L=S.screens.filter(s=>panelById(s.panelId)).map((s,i)=>{
    const g=geo(s), b=sbox(s), cx=(s.x+b.w/2)/MM, cy=-(+s.depth||0), t=rad(yawOf(s)), c=Math.cos(t), sn=Math.sin(t);
    const P=g.pts.map(q=>({x:cx+q.x*c-q.y*sn,y:cy+q.x*sn+q.y*c}));
    const v=viewDist(s), off=v?band(P,v.min):[];
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
