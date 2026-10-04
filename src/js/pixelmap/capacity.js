/* ========================= PIXEL MAP · CAPACITY ========================= */
/* What one processor can take: its own pixel rating, its input's limit and its port count. */
const scrPx=s=>{ const p=panelById(s.panelId); return p?s.cols*p.pw*s.rows*p.ph:0; };
const scrW=s=>{ const p=panelById(s.panelId); return p?s.cols*p.pw:0; };
const scrH=s=>{ const p=panelById(s.panelId); return p?s.rows*p.ph:0; };
const scrRuns=s=>s.runs.filter(r=>runInUse(s,r)).length;
function pmCapPx(u){ const pr=unitProc(u); const c=(pr&&pr.total)?procCap(pr):Infinity; return Math.min(c,pmOf().outPx); }
function pmCapPorts(u){ const pr=unitProc(u); return (pr&&pr.ports)?Math.min(pr.ports,SLOTS):SLOTS; }
const fmtM=v=>(v/1e6).toFixed(2)+' M';
function pmFitsOne(list,u){
  const pm=pmOf(); if(!list.length) return true;
  if(list.reduce((a,x)=>a+scrPx(x),0)>pmCapPx(u)) return false;
  if(list.reduce((a,x)=>a+scrRuns(x),0)>pmCapPorts(u)) return false;
  const pk=pmPackBlocks(list.map((x,i)=>({w:scrW(x),h:scrH(x),i})),pm.outW,pm.outH);
  return !!pk&&pk.W*pk.H<=pm.outPx;
}
/* every problem, with what it would take to fix it */
function pmAudit(){
  const pm=pmOf(), out=[];
  S.screens.forEach(s=>{
    if(!panelById(s.panelId)) return;
    const u=unitOf(s), cap=pmCapPx(u), ports=pmCapPorts(u), why=[];
    const nW=Math.ceil(scrW(s)/pm.outW), nP=Math.ceil(scrPx(s)/cap), nR=Math.ceil(scrRuns(s)/ports);
    if(nW>1) why.push(`${scrW(s)} px wide, an output takes ${pm.outW}`);
    if(nP>1) why.push(`${fmtM(scrPx(s))} px, one ${unitProc(u).model||'processor'} takes ${fmtM(cap)}`);
    if(nR>1) why.push(`${scrRuns(s)} data runs, one processor has ${ports} ports`);
    const n=Math.min(Math.max(nW,nP,nR),s.cols);
    if(n>1) out.push({kind:'split',id:s.id,n,title:`${(s.name||'Screen').trim()} is too big for one processor`,
      detail:why.join(' · ')+`. Split it into ${n} sections, each on its own processor.`});
    else if(scrH(s)>pm.outH) out.push({kind:'note',title:`${(s.name||'Screen').trim()} is ${scrH(s)} px tall`,
      detail:`An output takes ${pm.outH}. Raise the output height limit.`});
  });
  const splitIds=new Set(out.filter(i=>i.kind==='split').map(i=>i.id));
  units().forEach(u=>{
    const ss=S.screens.filter(x=>unitOf(x)===u&&panelById(x.panelId));
    if(!ss.length||ss.some(x=>splitIds.has(x.id))||pmFitsOne(ss,u)) return;
    const px=ss.reduce((a,x)=>a+scrPx(x),0), runs=ss.reduce((a,x)=>a+scrRuns(x),0);
    const why=[];
    if(px>pmCapPx(u)) why.push(`${fmtM(px)} px against ${fmtM(pmCapPx(u))}`);
    if(runs>pmCapPorts(u)) why.push(`${runs} data runs against ${pmCapPorts(u)} ports`);
    if(!why.length) why.push(`its screens don't fit one ${pm.outW} × ${pm.outH} output`);
    const need=pmRebalancePlan(u).length;
    out.push({kind:'rebalance',id:u.id,title:`${unitLabel(u)} is overloaded`,
      detail:why.join(' · ')+`. Spread its screens across ${need} processors.`});
  });
  return out;
}
/* biggest screens first, each into the first processor with room */
function pmRebalancePlan(u){
  const ss=S.screens.filter(x=>unitOf(x)===u&&panelById(x.panelId)).sort((a,b)=>scrPx(b)-scrPx(a));
  const bins=[[]];
  ss.forEach(s=>{ let b=bins.find(b=>pmFitsOne(b.concat([s]),u)); if(!b){ b=[]; bins.push(b); } b.push(s); });
  return bins.filter(b=>b.length);
}
function pmRebalance(u){
  const plan=pmRebalancePlan(u); let added=0;
  const idle=units().filter(x=>x!==u&&x.procId===u.procId&&!S.screens.some(q=>unitOf(q)===x));
  plan.forEach((list,i)=>{
    let tgt=u;
    if(i>0){ tgt=idle.shift(); if(!tgt){ tgt=addUnit(u.procId); added++; } }   /* reuse an idle processor of the same model first */
    list.forEach(s=>{ s.procRef=tgt.id; s.procId=u.procId; });
  });
  return added;
}
/* move a data run to another slot, carrying its backup pairing and any manual port */
function pmMoveRun(s,i,j){
  const a=s.runs[i], b=s.runs[j]; b.tiles=a.tiles; a.tiles=[];
  const bk=bkOf(s), P={};
  Object.entries(bk.pairs||{}).forEach(([k,v])=>{ P[k===a.id?b.id:k]=v===a.id?b.id:v; }); bk.pairs=P;
  if(s.portMap&&s.portMap[a.id]){ s.portMap[b.id]=s.portMap[a.id]; delete s.portMap[a.id]; }
}
/* two screens on one processor can't share a port: move any clash to the next free slot */
function pmFixPorts(){
  let moved=0;
  units().forEach(u=>{
    const taken=new Set();
    S.screens.filter(x=>unitOf(x)===u).forEach(s=>{
      s.runs.forEach((r,i)=>{
        if(!runInUse(s,r)) return;
        if(!taken.has(i)){ taken.add(i); return; }
        const j=[...Array(SLOTS).keys()].find(k=>!taken.has(k)&&!runInUse(s,s.runs[k]));
        if(j==null) return;
        pmMoveRun(s,i,j); taken.add(j); moved++;
      });
    });
  });
  return moved;
}
/* cut a screen into side-by-side sections along cabinet columns, keeping every mapping */
function pmSplitScreen(s,n){
  const per=Math.ceil(s.cols/n), idx=S.screens.indexOf(s), base=(s.name||'Screen').trim(), parts=[];
  const L='ABCDEFGHIJ';
  for(let k=0;k*per<s.cols;k++){
    const c0=k*per, c1=Math.min(s.cols,c0+per);
    const q=JSON.parse(JSON.stringify(s));
    if(k>0) q.id=uid('s');
    q.cols=c1-c0; q.name=`${base} ${L[k]||k+1}`;
    const keep=t=>{ const c=+t.split(':')[1]; return c>=c0&&c<c1; };
    const rk=t=>{ const [r,c]=t.split(':'); return r+':'+(+c-c0); };
    q.off=(q.off||[]).filter(keep).map(rk);
    q.circuits.forEach(ch=>ch.tiles=ch.tiles.filter(keep).map(rk));
    q.runs.forEach(ch=>ch.tiles=ch.tiles.filter(keep).map(rk));
    parts.push(q);
  }
  for(let k=1;k<parts.length;k++){ parts[k].x=parts[k-1].x+sbox(parts[k-1]).w; parts[k].y=parts[k-1].y; }
  S.screens.splice(idx,1,...parts);
  const pm=pmOf(); delete pm.pos[s.id];
  return parts;
}
function pmApplyFixes(list){
  let split=0, added=0;
  list.filter(i=>i.kind==='split').forEach(i=>{
    const s=S.screens.find(x=>x.id===i.id); if(!s) return;
    const parts=pmSplitScreen(s,i.n); split++;
    const u=unitOf(parts[0]);                     /* each section on its own processor where needed */
    parts.forEach((p,k)=>{ if(k>0&&!pmFitsOne(S.screens.filter(x=>unitOf(x)===u&&panelById(x.panelId)),u)){
      let nu=units().find(x=>x!==u&&x.procId===u.procId&&!S.screens.some(q=>unitOf(q)===x));
      if(!nu){ nu=addUnit(u.procId); added++; } p.procRef=nu.id; } });
  });
  pmFixPorts();
  list.filter(i=>i.kind==='rebalance').forEach(i=>{ const u=units().find(x=>x.id===i.id); if(u) added+=pmRebalance(u); });
  /* a split can leave a processor still overloaded: settle everything */
  for(let pass=0;pass<4;pass++){
    const more=pmAudit().filter(i=>i.kind==='rebalance'); if(!more.length) break;
    more.forEach(i=>{ const u=units().find(x=>x.id===i.id); if(u) added+=pmRebalance(u); });
  }
  const moved=pmFixPorts();
  return {split,added,moved};
}
function pmFix(kind,id){
  const list=kind==='all'?pmAudit().filter(i=>i.kind!=='note'):pmAudit().filter(i=>i.kind===kind&&i.id===id);
  if(!list.length) return;
  pushUndo('pixel map fix');
  const r=pmApplyFixes(list);
  normalize(); cur=Math.min(cur,S.screens.length-1);
  renderTabs(); syncForm(); renderSlots(); renderSide(); redraw(); pmSync(); save();
  const bits=[];
  if(r.split) bits.push(`split ${r.split} screen${r.split===1?'':'s'}`);
  if(r.added) bits.push(`added ${r.added} processor${r.added===1?'':'s'}`);
  if(r.moved) bits.push(`moved ${r.moved} run${r.moved===1?'':'s'} to free ports`);
  setStatus(bits.length?'Fixed: '+bits.join(', ')+' · ⌘Z to undo':'Nothing needed changing');
}

/* skyline bin packing: place each block at the lowest, then leftmost, spot that fits */
function pmSkyline(blocks,W){
  let sky=[{x:0,y:0,w:W}]; const pos=[]; let H=0, R=0;
  for(const b of blocks){
    if(b.w>W) return null;
    let best=null;
    for(let i=0;i<sky.length;i++){
      const x=sky[i].x; if(x+b.w>W) break;
      let y=0; for(let j=i;j<sky.length&&sky[j].x<x+b.w;j++) y=Math.max(y,sky[j].y);
      if(!best||y<best.y||(y===best.y&&x<best.x)) best={x,y};
    }
    if(!best) return null;
    pos.push(best); H=Math.max(H,best.y+b.h); R=Math.max(R,best.x+b.w);
    const nx=best.x, ne=best.x+b.w, ns=[];
    for(const g of sky){ const ge=g.x+g.w;
      if(ge<=nx||g.x>=ne){ ns.push(g); continue; }
      if(g.x<nx) ns.push({x:g.x,y:g.y,w:nx-g.x});
      if(ge>ne) ns.push({x:ne,y:g.y,w:ge-ne}); }
    ns.push({x:nx,y:best.y+b.h,w:b.w}); ns.sort((a,c)=>a.x-c.x);
    sky=[]; ns.forEach(g=>{ const l=sky[sky.length-1]; if(l&&l.y===g.y&&l.x+l.w===g.x) l.w+=g.w; else sky.push({...g}); });
  }
  return {pos,W:R,H};
}
/* try every sensible width and a few orderings; keep the smallest area */
function pmPackBlocks(blocks,maxSide,maxH){
  maxH=maxH||maxSide;
  if(!blocks.length) return {pos:[],W:0,H:0};
  const maxW=Math.max(...blocks.map(b=>b.w)), sumW=blocks.reduce((a,b)=>a+b.w,0);
  let sums=[0];
  if(maxW>maxSide) return null;
  blocks.forEach(b=>{ sums=[...new Set(sums.concat(sums.map(v=>v+b.w)))].filter(v=>v<=Math.min(sumW,maxSide)); if(sums.length>3000) sums.length=3000; });
  const widths=[...new Set(sums.filter(v=>v>=maxW))];
  const orders=[blocks.slice(),
    blocks.slice().sort((a,b)=>b.h-a.h||b.w-a.w),
    blocks.slice().sort((a,b)=>b.w*b.h-a.w*a.h),
    blocks.slice().sort((a,b)=>b.w-a.w||b.h-a.h)];
  let best=null;
  for(const W of widths) orders.forEach((ord,oi)=>{
    const r=pmSkyline(ord,W); if(!r||r.H>maxH||r.W>maxSide) return;
    const area=r.W*r.H, side=r.H;                       /* on a tie, the wider and shorter layout wins */
    if(!best||area<best.area||(area===best.area&&(side<best.side||(side===best.side&&oi<best.oi)))){
      const pos=[]; ord.forEach((b,k)=>pos[b.i]=r.pos[k]);
      best={area,side,oi,pos,W:r.W,H:r.H};
    }
  });
  return best;
}
function pmVerify(M){
  const errs=[];
  M.L.forEach(o=>{
    const p=panelById(o.s.panelId);
    if(o.W!==o.s.cols*p.pw||o.H!==o.s.rows*p.ph) errs.push(o.name+': LED size does not match its panels');
    if(o.iw*(M.n||1)!==o.W||o.ih*(M.n||1)!==o.H) errs.push(o.name+': input size is not an exact step of the LED size');
    if(o.ix<0||o.iy<0||o.ix+o.iw>M.compW||o.iy+o.ih>M.compH) errs.push(o.name+': input is outside the composition');
    const out=M.outs[o.out-1]; if(!out||o.ox+o.W>out.W||o.oy+o.H>out.H) errs.push(o.name+': does not fit its output');
  });
  return errs;
}
function pmBuild(){
  const pm=pmOf(), L=pmSurfaces(), warn=[];
  if(!L.length) return {L,outs:[],compW:0,compH:0,warn:['Choose an LED panel for at least one screen first.']};
  pmAutoLayout(L);
  /* composition follows what the canvas shows; Flip mirrors it */
  const mirror=(!!opt().rear)!==(!!pm.flip);
  if(mirror){ const cw=Math.max(...L.map(o=>o.x+o.W)); L.forEach(o=>o.x=cw-o.x-o.W); }
  const gpu=pm.compMode==='gpu';
  if(!gpu) L.forEach(o=>{ const m=pm.pos[o.id]; if(m){ o.x=Math.max(0,r8(m.x)); o.y=Math.max(0,r8(m.y)); o.manual=true; } });
  const stageW=up8(Math.max(...L.map(o=>o.x+o.W))), stageH=up8(Math.max(...L.map(o=>o.y+o.H)));
  L.forEach(o=>{ o.sx=o.x; o.sy=o.y; });                       /* stage position, kept whatever the composition mode */
  let compW=stageW, compH=stageH;

  /* group by processor: one processor = one input = one output region */
  const G=new Map();
  L.forEach(o=>{ const key=o.unit?o.unit.id:'s:'+o.id;
    if(!G.has(key)) G.set(key,{key,unit:o.unit,items:[],name:o.unit?unitLabel(o.unit):o.name});
    G.get(key).items.push(o); });
  const groups=[...G.values()];
  groups.forEach(g=>{
    g.items.sort((a,b)=>a.y-b.y||a.x-b.x);
    const rowsY=[...new Set(g.items.map(o=>o.y))];
    g.items.sort((a,b)=>(rowsY.indexOf(a.y)-rowsY.indexOf(b.y))||a.x-b.x);
    const pk=pmPackBlocks(g.items.map((o,i)=>({w:o.W,h:o.H,i})),pm.outW,pm.outH);
    if(pk){ g.items.forEach((o,i)=>{ o.lx=pk.pos[i].x; o.ly=pk.pos[i].y; }); g.W=pk.W; g.H=pk.H; }   /* over the pixel limit still packs tight, and is flagged */
    else {                                                   /* wider or taller than one output: lay out in rows and flag it */
      let x=0,y=0,rh=0,W=0;
      g.items.forEach(o=>{ if(x>0&&x+o.W>pm.outW){ y+=rh; x=0; rh=0; } o.lx=x; o.ly=y; x+=o.W; rh=Math.max(rh,o.H); W=Math.max(W,x); });
      g.W=W; g.H=y+rh;
    }
    g.order=g.unit?units().indexOf(g.unit):900+L.indexOf(g.items[0]);
    g.over=g.W>pm.outW||g.H>pm.outH||g.W*g.H>pm.outPx;
  });
  /* place groups into outputs: manual choices first, then biggest first */
  const outs=[];
  const tryPlace=(out,g)=>{
    const all=out.groups.concat([g]);
    const pk=pmPackBlocks(all.map((q,i)=>({w:q.W,h:q.H,i})),pm.outW,pm.outH);
    if(!pk||pk.W*pk.H>pm.outPx) return null;
    return {pk,all};
  };
  const put=(out,g,p)=>{
    if(p&&p.pk){ p.all.forEach((q,i)=>{ q.ox=p.pk.pos[i].x; q.oy=p.pk.pos[i].y; }); out.groups=p.all; out.W=p.pk.W; out.H=p.pk.H; return; }
    /* forced in over its limits: stack below what is there */
    g.ox=0; g.oy=out.H; out.W=Math.max(out.W,g.W); out.H=out.H+g.H; out.groups.push(g);
  };
  const newOut=()=>{ const o={W:0,H:0,cx:0,sy:0,sh:0,groups:[],locked:false}; outs.push(o); return o; };
  /* choices made by hand: a numbered output, or a processor's own output */
  groups.forEach(g=>{ const a=pm.assign[g.key]; g.own=a==='own'; g.pin=(a!=null&&a!=='own')?Math.max(0,a|0):null; });
  const fixed=groups.filter(g=>g.pin!=null).sort((a,b)=>a.pin-b.pin||a.order-b.order);
  const owned=groups.filter(g=>g.own).sort((a,b)=>a.order-b.order);
  const free=groups.filter(g=>!g.own&&g.pin==null).sort((a,b)=>(b.W*b.H)-(a.W*a.H)||a.order-b.order);
  fixed.forEach(g=>{
    while(outs.length<=g.pin) newOut();
    const out=outs[g.pin]; out.locked=true;
    const p=tryPlace(out,g);
    if(!p&&out.groups.length) warn.push(`Output ${g.pin+1} is over its limits with ${g.name} added.`);
    put(out,g,p);
  });
  owned.forEach(g=>{ const out=newOut(); out.locked=true; put(out,g,tryPlace(out,g)); });
  free.forEach(g=>{
    let done=false;
    if(pm.share) for(const out of outs){ if(!out.groups.length||out.locked) continue; const p=tryPlace(out,g); if(p){ put(out,g,p); done=true; break; } }
    if(!done){ const out=outs.find(o=>!o.groups.length&&!o.locked)||newOut(); put(out,g,tryPlace(out,g)); }
  });
  for(let i=outs.length-1;i>=0;i--) if(!outs[i].groups.length) outs.splice(i,1);
  outs.sort((a,b)=>Math.min(...a.groups.map(g=>g.pin!=null?-1000+g.pin:g.order))-Math.min(...b.groups.map(g=>g.pin!=null?-1000+g.pin:g.order)));
  /* keep numbered choices pointing at the output they ended up on */
  outs.forEach((o,i)=>o.groups.forEach(g=>{ if(g.pin!=null&&g.pin!==i) pm.assign[g.key]=i; }));
  outs.forEach((o,i)=>{ o.n=i+1; o.W=up8(o.W); o.H=up8(o.H);
    o.groups.forEach(g=>g.items.forEach(it=>{ it.out=o.n; it.ox=g.ox+it.lx; it.oy=g.oy+it.ly; })); });
  /* GPU optimised: the composition is the outputs themselves, packed into the smallest rectangle */
  if(gpu&&outs.length){
    const pk=pmPackBlocks(outs.map((o,i)=>({w:o.W,h:o.H,i})),PM_MAXTEX);
    if(pk){
      outs.forEach((o,i)=>{ o.cx=pk.pos[i].x; o.cy=pk.pos[i].y; });
      L.forEach(it=>{ const o=outs[it.out-1]; it.x=o.cx+it.ox; it.y=o.cy+it.oy; });
      compW=up8(pk.W); compH=up8(pk.H);
    } else warn.push('The outputs are too large to pack into one composition. Raise the output limits or use fewer outputs.');
  }
  /* input rectangles are always 1:1 with the LED */
  const k=1, n=1, exact=true;
  L.forEach(o=>{ o.ix=o.x; o.iy=o.y; o.iw=o.W; o.ih=o.H; });

  if(!gpu){ compW=Math.max(...L.map(o=>o.ix+o.iw)); compH=Math.max(...L.map(o=>o.iy+o.ih)); compW+=compW%2; compH+=compH%2; }
  if(compW>PM_MAXTEX||compH>PM_MAXTEX) warn.push(`The composition is ${compW} × ${compH}. Resolume on Apple Silicon tops out at ${PM_MAXTEX} pixels a side — rearrange or stack screens.`);
  for(let i=0;i<L.length;i++) for(let j=i+1;j<L.length;j++){ const a=L[i],b=L[j];
    if(a.ix<b.ix+b.iw&&b.ix<a.ix+a.iw&&a.iy<b.iy+b.ih&&b.iy<a.iy+a.ih) warn.push(`${a.name} and ${b.name} overlap in the composition.`); }
  const lit=L.reduce((a,o)=>a+o.W*o.H,0), litIn=L.reduce((a,o)=>a+o.iw*o.ih,0);
  const avail=Math.max(1,pm.outCount|0||4);
  if(outs.length>avail) warn.push(`This needs ${outs.length} outputs and your media server has ${avail}. Raise the output size limit (HDMI 8K holds more per output), let processors share outputs, or add a second media server.`);
  const slices=L.slice().sort((a,b)=>a.iy-b.iy||a.ix-b.ix);
  return {L,slices,outs,groups,compW,compH,warn,mirror,gpu,lit,litIn,k,n,exact,stagePx:stageW*stageH,stageW,stageH};
}

