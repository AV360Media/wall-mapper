/* ========================= EDITS ========================= */
const MAXGRID=200;                            /* cabinets a side: plenty for any wall, and the canvas stays quick */
function setScreen(f,v){
  const s=sc(); if(!s) return;
  if(f==='rows'||f==='cols'){
    if(!(v>=1)) return;                       /* ignore blank / mid-typing values */
    v=Math.min(MAXGRID,Math.floor(v));
    if(v===s[f]) return;
    pushUndo('grid size');
    s[f]=v;                                   /* chains keep their tiles — see LT() */
    const parked=[...s.circuits,...s.runs].reduce((n,ch)=>n+ch.tiles.filter(t=>!isLive(s,t)).length,0);
    setStatus(parked?`Grid ${s.cols}×${s.rows} — ${parked} mapped tile${parked===1?'':'s'} parked outside the grid`
                    :`Grid ${s.cols}×${s.rows}`);
    syncForm(); redraw(); renderSide(); renderSlots(); save();
    return;
  }
  if(f==='yaw'||f==='depth'){              /* plan geometry: blank means 0, one undo per burst of typing */
    v=+v||0; const lim={yaw:180}[f];
    if(lim) v=Math.max(-lim,Math.min(lim,v));
    if(f==='depth') v=Math.round(v*304.8);
    if(v===(+s[f]||0)) return;
    if(Date.now()-geoAt>800||geoKey!==s.id+f) pushUndo('screen geometry'); geoAt=Date.now(); geoKey=s.id+f;
    s[f]=v; renderSide(); syncGeo(); save(); return;
  }
  s[f]=v;
  if(f==='name'){ renderTabs(); if(focusIdx!=null) document.getElementById('focusName').textContent=v; }
  syncForm(); redraw(); renderSide(); renderSlots(); save();
}
let geoAt=0, geoKey='';
function syncGeo(){
  const s=sc(), el=document.getElementById('scGeo'); if(!el) return;
  el.textContent=s&&panelById(s.panelId)&&bent(s)?`${ftR(geo(s).chord)} wide in plan · ${curveText(s)}`:'';
}
function setOpt(f,v){
  if((f==='volts'||f==='breaker')&&!(v>0)) return;   /* blank or zero while typing: keep the last good value */
  S.opt[f]=v; syncForm(); redraw(); renderSide(); save();
}
function setScreenUnit(id){ pushUndo('processor assignment'); sc().procRef=id; syncForm(); renderSlots(); renderSide(); redraw(); save(); }
function newUnit(){
  pushUndo('add processor');
  const cur0=unitOf(sc()), u=addUnit(cur0?cur0.procId:'none');
  sc().procRef=u.id;
  syncForm(); renderSlots(); renderSide(); redraw(); save();
  setStatus('Added '+unitLabel(u)+' — this screen now feeds from it');
}
function delUnit(id){
  const U=units();
  if(U.length<2){ setStatus('Keep at least one processor'); return; }
  const u=U.find(x=>x.id===id); if(!u) return;
  const users=S.screens.filter(x=>unitOf(x)===u);
  if(users.length&&!confirm(`${unitLabel(u)} feeds ${users.length} screen${users.length===1?'':'s'}.\n\nDelete it and move them to ${unitLabel(U.find(x=>x!==u))}?`)) return;
  pushUndo('delete processor');
  const fallback=U.find(x=>x!==u);
  S.screens.forEach(x=>{ if(x.procRef===id) x.procRef=fallback.id; });
  S.procs=U.filter(x=>x.id!==id);
  syncForm(); renderSlots(); renderSide(); redraw(); save();
}
function renameUnit(id,v){
  const u=units().find(x=>x.id===id); if(!u) return;
  u.name=v.trim(); u.custom=u.name?1:0;      /* keeps the name when the model changes */
  const sel=document.getElementById('scUnit');
  if(sel) Array.from(sel.options).forEach(o=>{ if(o.value===id) o.textContent=unitLabel(u); });
  renderSide(); redraw(); save();
}
function renderUnits(){
  const el=document.getElementById('unitList'); if(!el) return;
  const U=units(), curU=sc()&&unitOf(sc()), many=U.length>1;
  document.getElementById('unitCount').textContent=many?U.length:'';
  el.innerHTML=U.map(u=>{
    const L=unitLoad(u), pr=unitProc(u), none=pr.id==='none';
    const bad=L.over||L.capOver;
    const mine=S.screens.filter(x=>unitOf(x)===u).map(x=>x.name);
    const pct=L.ports?Math.min(100,L.used/L.ports*100):0;
    const notes=[];
    if(u.bkUnit) notes.push('mirrored on '+escp(unitLabel(units().find(x=>x.id===u.bkUnit))));
    if(isBkUnit(u)) notes.push('backup for '+escp(unitLabel(bkFor(u))));
    return `<div class="unit ${many&&u===curU?'on':''}" ${many?`onclick="setScreenUnit('${u.id}')"`:''}>
      <div class="u-top">
        <input class="u-nm" value="${escp(u.name||'')}" placeholder="${escp(none?'Processor':pr.model)}"
          title="Rename this processor" onclick="event.stopPropagation()"
          onkeydown="if(event.key==='Enter')this.blur()" oninput="renameUnit('${u.id}',this.value)" />
        ${L.ports?`<span class="u-ct ${bad?'bad':''}">${L.used}/${L.ports}</span>`:''}
        ${many?`<button class="u-x" onclick="event.stopPropagation();delUnit('${u.id}')" title="Remove">×</button>`:''}
      </div>
      <button class="u-model ${none?'need':''}" onclick="event.stopPropagation();pickUnitModel('${u.id}')">
        ${none?'Choose a model…':escp(pr.brand+' '+pr.model)+' · '+pr.ports+' ports'}
        <span>change</span></button>
      ${L.ports?`<div class="u-trk"><div class="u-fil" style="width:${pct}%;background:${bad?'var(--bad)':'var(--ac)'}"></div></div>`:''}
      ${many?`<div class="u-sub">${escp(mine.length?'feeds '+mine.join(', '):'no screens yet')}</div>`:''}
      ${notes.length?`<div class="u-bk">${notes.join(' · ')}</div>`:''}
      ${L.over?'<div class="u-bad">More runs than this processor has ports</div>':''}
      ${L.capOver?`<div class="u-bad">${(L.px/1e6).toFixed(2)} M px is over this processor's ${(L.cap/1e6).toFixed(2)} M limit</div>`:''}
    </div>`;
  }).join('');
}
let libUnit=null;
function pickUnitModel(id){ libUnit=id; openLib('proc'); }
function setCab(f,v){
  if(typeof v==='number'&&!(v>0)&&f!=='cvtQty'&&f!=='fiberQty') return;   /* those two use blank for automatic */
  cabOf()[f]=v; syncForm(); renderSide(); save();
}
function setTheme(k){ S.opt.ui=k; applyTheme(k); syncForm(); redraw(); save(); }
function setBasis(v){ S.opt.useAvg=v.startsWith('avg'); S.opt.derate=v.endsWith('80'); redraw(); renderSide(); renderSlots(); save(); }

/* ---- header menus ---- */
function toggleMenu(id,e){
  if(e) e.stopPropagation();
  const m=document.getElementById(id), was=m.classList.contains('open');
  closeMenus(); if(!was) m.classList.add('open');
}
function closeMenus(){ document.querySelectorAll('.menu.open').forEach(m=>m.classList.remove('open')); }
document.addEventListener('click',e=>{ if(e.isTrusted&&!e.target.closest('.menu')) closeMenus(); });   /* a finished download's click must not shut a menu */
/* ---- settings ---- */
function openSettings(t){
  syncForm();
  document.getElementById('stModal').classList.remove('hide');
  stTab(t||'power');
}
function stTab(t){
  document.querySelectorAll('#stModal .stabs button').forEach(b=>b.classList.toggle('on',b.dataset.t===t));
  document.querySelectorAll('#stModal .stpane').forEach(p=>p.style.display=p.dataset.p===t?'':'none');
}
/* ---- right panel follows the layer you are looking at ---- */
function syncRight(){
  const pw=opt().showPower!==false&&!opt().showData;
  const a=document.getElementById('rsPower'), b=document.getElementById('rsData');
  if(a) a.style.display=pw?'':'none';
  if(b) b.style.display=pw?'none':'';
}
function setLayers(which){
  const o=opt();
  o.showPower=which==='power'; o.showData=which==='data';
  syncForm(); renderSlots(); syncRight(); redraw(); save();
}
function setMode(m){
  mode=m; document.body.dataset.mode=m;
  document.querySelectorAll('#modeSeg button').forEach(b=>b.classList.toggle('on',b.dataset.m===m));
  if(m==='power') setLayers('power');
  if(m==='data') setLayers('data');
  document.getElementById('chainBlock').style.display=(m==='power'||m==='data')?'block':'none';
  document.getElementById('curveBlock').style.display=m==='layout'?'block':'none';
  document.getElementById('chainTitle').textContent=m==='power'?'Pick a circuit':'Pick a port';
  const hints={
    arrange:'Drag screens to position them. Hold Alt to place freely.',
    layout:'Click tiles to switch them off for cutouts.',
    power:'Pick a circuit, then drag across tiles in order. Right-drag to erase. Keys 1–9 and 0 pick C1–C10; hold Shift for C11–C20.',
    data:'Pick a port, then drag across tiles in order. Right-drag to erase. Keys 1–9 and 0 pick P1–P10; hold Shift for P11–P20.'};
  document.getElementById('modeHint').textContent=hints[m];
  if(m==='layout') setTileTool(tileTool);
  document.getElementById('helper').textContent='⌘/Ctrl + scroll to zoom · double-click a screen to focus';
  syncForm(); renderSlots(); syncRight(); redraw();
}
/* keyboard selection, with a brief on-canvas confirmation */
function keyPick(i){
  if(!sc()) return;
  const before=active[mode];
  pickSlot(i);
  const s=sc(), ch=chains(s,mode)[i];
  const ok=active[mode]===i;
  let t=document.getElementById('keyToast');
  if(!t){ t=document.createElement('div'); t.id='keyToast'; cv.parentElement.appendChild(t); }
  if(ok){
    const n=LT(s,ch).length;
    t.innerHTML=`<span class="kt-bar" style="background:${ch.color}"></span><b>${escp(ch.name)}</b>`
      +`<span class="kt-sub">${n?n+' tile'+(n===1?'':'s'):'empty'}</span>`;
    t.className='on';
  } else {
    t.innerHTML=`<b>${escp((mode==='data'?'P':'C')+(i+1))}</b><span class="kt-sub">${escp(document.getElementById('status').textContent||'not available')}</span>`;
    t.className='on bad';
  }
  clearTimeout(keyPick._t); keyPick._t=setTimeout(()=>t.className='',1100);
}
function pickSlot(i){
  const s=sc();
  if(mode==='data'){
    const owner=portOwner(unitOf(s),i,s);
    if(owner){ setStatus(`Port ${i+1} is in use on ${owner.name} — pick a free port, or move this screen to another processor`); return; }
  }
  if(mode==='data'&&isBackupRun(s,s.runs[i])){
    setStatus(s.runs[i].name+' is a backup port — it mirrors its primary automatically'); return;
  }
  active[mode]=i; renderSlots(); redraw();
}
function applyTile(t,remove){
  const s=sc();
  if(!panelById(s.panelId)) return;
  if(mode==='layout'){
    const i=s.off.indexOf(t);
    if(i>=0) s.off.splice(i,1); else s.off.push(t);
    redraw(); renderSide(); renderSlots(); save(); return;
  }
  if(mode==='arrange') return;
  const ch=chains(s,mode)[active[mode]]; if(!ch) return;
  if(remove){
    let hit=false;
    chains(s,mode).forEach(o=>{ const i=o.tiles.indexOf(t); if(i>=0){ o.tiles.splice(i,1); hit=true; } });
    if(hit){ redraw(); renderSide(); renderSlots(); save(); }
    return;
  }
  const[r,c]=t.split(':').map(Number);
  if(isOff(s,r,c)) return;
  chains(s,mode).forEach(o=>{ if(o!==ch){ const i=o.tiles.indexOf(t); if(i>=0) o.tiles.splice(i,1); } });
  if(!ch.tiles.includes(t)){ ch.tiles.push(t); redraw(); renderSide(); renderSlots(); save(); }
}
function autoChain(){
  if(mode!=='power'&&mode!=='data') return;
  if(!panelById(sc().panelId)){ setStatus('Pick an LED panel first'); return; }
  pushUndo(mode==='power'?'auto-build circuits':'auto-build data runs');
  const s=sc();
  const dir=document.getElementById('aoDir').value;
  const len=Math.max(1,+document.getElementById('aoLen').value||8);
  if(mode==='data') return autoData(s);
  const rows=[...Array(s.rows).keys()], cols=[...Array(s.cols).keys()], rb=[...rows].reverse();
  const seq=[];
  if(dir==='col') cols.forEach((c,i)=>{ (i%2?rows:rb).forEach(r=>{ if(!isOff(s,r,c)) seq.push(key(r,c)); }); });
  else rb.forEach((r,i)=>{ (i%2?[...cols].reverse():cols).forEach(c=>{ if(!isOff(s,r,c)) seq.push(key(r,c)); }); });
  const list=chains(s,mode);
  list.forEach(ch=>ch.tiles=[]);
  const u=unitOf(s);
  const avail=list.map((ch,i)=>({ch,i}))
    .filter(x=>!(mode==='data'&&(isBackupRun(s,x.ch)||portOwner(u,x.i,s))));
  let n=0;
  for(let i=0;i<seq.length&&n<avail.length;i+=len,n++) avail[n].ch.tiles=seq.slice(i,i+len);
  if(seq.length>len*avail.length) setStatus(`Needs ${Math.ceil(seq.length/len)} circuits but there are only ${avail.length} — raise tiles per chain`);
  else setStatus(`${n} circuit${n===1?'':'s'}, up to ${len} tiles each`);
  active[mode]=avail.length?avail[0].i:0;
  syncForm(); renderSlots(); redraw(); renderSide(); save();
}
/* Data runs are mapped the way an LED tech would: every run is a block of whole lines
   (columns for a top or bottom feed, rows for a side feed) snaking out from the feed edge, so
   every home run starts on that one edge. Lines per run are as many as a port carries, then
   balanced so the runs come out as even as possible (3,3,2,2 columns, never 3,3,3,1).
   Side feeds number from the bottom row up; top and bottom feeds from left to right.
   A line longer than a port splits the wall into bands; each band's runs start along its
   edge nearest the feed. */
function dataLayout(s,feed,cap,nb){
  const vert=feed==='top'||feed==='bottom', D=vert?s.rows:s.cols, A=vert?s.cols:s.rows;
  const flip=feed==='bottom'||feed==='right';
  const at=(d,a)=>{ const dd=flip?D-1-d:d; return vert?[dd,a]:[A-1-a,dd]; };
  const live=(d,a)=>{ const[r,c]=at(d,a); return !isOff(s,r,c); };
  const line=(a,ds,back)=>(back?[...ds].reverse():ds).filter(d=>live(d,a)).map(d=>key(...at(d,a)));
  const runs=[];
  for(let b=0,d0=0;b<nb;b++){
    const h=Math.floor(D/nb)+(b<D%nb?1:0), ds=[...Array(h).keys()].map(i=>d0+i); d0+=h;
    const ls=[...Array(A).keys()].map(a=>({a,n:ds.filter(d=>live(d,a)).length})).filter(x=>x.n);
    splitEven(ls.map(x=>x.n),cap).forEach(g=>runs.push(g.flatMap((i,j)=>line(ls[i].a,ds,j%2))));
  }
  const n=runs.map(r=>r.length);
  return {feed,nb,runs,lo:Math.min(...n),hi:Math.max(...n)};
}
/* Cut a row of line sizes into the fewest consecutive groups that fit cap, then pick the cut
   with the most even group sizes (least sum of squares), bigger groups first on a tie */
function splitEven(w,cap){
  const m=w.length, P=[0]; w.forEach(x=>P.push(P[P.length-1]+x));
  let g=0; for(let i=0,t=0;i<m;i++){ if(!g||t+w[i]>cap){ g++; t=0; } t+=w[i]; }
  const f=[[0,...Array(m).fill(Infinity)]], pick=[[]];
  for(let k=1;k<=g;k++){
    f[k]=Array(m+1).fill(Infinity); pick[k]=[];
    for(let i=1;i<=m;i++) for(let j=i-1;j>=0&&P[i]-P[j]<=cap;j--){
      const v=f[k-1][j]+(P[i]-P[j])**2;
      if(v<f[k][i]){ f[k][i]=v; pick[k][i]=j; }
    }
  }
  const out=[];
  for(let k=g,i=m;k>0;k--){ const j=pick[k][i]; out.unshift([...Array(i-j).keys()].map(x=>j+x)); i=j; }
  return out;
}
/* Auto tries each edge, bottom first, and keeps the fewest ports, then the most even runs.
   Bands only win when they save real ports (over 10%, at least 2), since one clean feed edge
   is worth a spare port */
const FEEDS=['bottom','left','right','top'];
/* tiles per port come from the processor, or from a standard 1 Gb port (650k px at 8-bit)
   until a processor model is picked */
const STD_PORT=650000;
const portPx=s=>portCap(procOf(s))||Math.round(STD_PORT*bitFactor());
const tilesPerPort=s=>{ const p=panelById(s.panelId); return p?Math.floor(portPx(s)/(p.pw*p.ph)):0; };
function bestData(s,cap){
  const want=s.feed||'auto';
  let best=null;
  (want==='auto'?FEEDS:[want]).forEach(f=>{
    const D=(f==='top'||f==='bottom')?s.rows:s.cols, nb0=Math.ceil(D/cap);
    for(let nb=nb0;nb<=Math.min(D,nb0+2);nb++){
      const L=dataLayout(s,f,cap,nb);
      L.cost=L.runs.length+(nb-1)*Math.max(2,Math.ceil(L.runs.length/10));
      if(!best||L.cost<best.cost||(L.cost===best.cost&&
        (L.nb<best.nb||(L.nb===best.nb&&L.hi-L.lo<best.hi-best.lo)))) best=L;
    }
  });
  return best;
}
function autoData(s){
  const p=panelById(s.panelId), cap=tilesPerPort(s);
  if(!cap){ setStatus('One '+p.model+' is more than a port can carry at '+bitDepth()+'-bit'); return; }
  const L=bestData(s,cap), runs=L.runs, list=s.runs, u=unitOf(s);
  list.forEach(ch=>ch.tiles=[]);
  if(!runs.length){ setStatus('No tiles to map'); return; }
  const avail=list.map((ch,i)=>({ch,i})).filter(x=>!(isBackupRun(s,x.ch)||portOwner(u,x.i,s)));
  runs.forEach((t,n)=>{ if(avail[n]) avail[n].ch.tiles=t; });
  const side={left:'down the left side',right:'down the right side',top:'along the top',bottom:'along the bottom'}[L.feed];
  const size=L.lo===L.hi?`${L.hi} tiles each`:`${L.lo}–${L.hi} tiles each`;
  const extra=runs.length-Math.ceil(tileCount(s)/cap);
  if(runs.length>avail.length) setStatus(`Needs ${runs.length} ports, only ${avail.length} free — add a processor and move this screen to it`);
  else setStatus(`${runs.length} data run${runs.length===1?'':'s'}, ${size} (port holds ${cap}), home runs ${side}`
    +(L.nb>1?` in ${L.nb} bands`:'')
    +(extra>0?` · ${extra} port${extra===1?'':'s'} over the bare minimum so every run starts on the edge`:'')
    +(portCap(procOf(s))?'':' — standard 650k port assumed, pick a processor for its exact capacity'));
  active.data=avail.length?avail[0].i:0;
  syncForm(); renderSlots(); redraw(); renderSide(); save();
}
function tidyChains(){ S.screens.forEach(hardPrune); }
function clearAllMapping(){
  if(needScreen()) return;
  const s=sc();
  if(!confirm(`Clear every power circuit, data run and backup pair on ${s.name||'this screen'}?\n\nIts tile layout, panel and processor are kept. This can be undone.`)) return;
  pushUndo('clear mapping');
  s.circuits.forEach(ch=>ch.tiles=[]);
  s.runs.forEach(ch=>ch.tiles=[]);
  s.backup={mode:'none',pairs:{},procId:''};
  active={power:0,data:0};
  syncForm(); renderSlots(); renderSide(); redraw(); save();
  setStatus('Mapping cleared on '+(s.name||'this screen'));
}
function clearChains(){ pushUndo('clear '+(mode==='power'?'circuits':'data runs')); chains(sc(),mode).forEach(ch=>ch.tiles=[]); renderSlots(); redraw(); renderSide(); save(); }

