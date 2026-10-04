/* ========================= EDITS ========================= */
function setScreen(f,v){
  const s=sc();
  if(f==='rows'||f==='cols'){
    if(!(v>=1)) return;                       /* ignore blank / mid-typing values */
    if(v===s[f]) return;
    pushUndo('grid size');
    s[f]=v;                                   /* chains keep their tiles — see LT() */
    const parked=[...s.circuits,...s.runs].reduce((n,ch)=>n+ch.tiles.filter(t=>!isLive(s,t)).length,0);
    setStatus(parked?`Grid ${s.cols}×${s.rows} — ${parked} mapped tile${parked===1?'':'s'} parked outside the grid`
                    :`Grid ${s.cols}×${s.rows}`);
    syncForm(); redraw(); renderSide(); renderSlots(); save();
    return;
  }
  s[f]=v;
  if(f==='name'){ renderTabs(); if(focusIdx!=null) document.getElementById('focusName').textContent=v; }
  syncForm(); redraw(); renderSide(); renderSlots(); save();
}
function setOpt(f,v){ S.opt[f]=v; syncForm(); redraw(); renderSide(); save(); }
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
  document.querySelectorAll('.u-bk').forEach(()=>{});
  renderSide(); redraw(); save();
}
function renderUnits(){
  const el=document.getElementById('unitList'); if(!el) return;
  const U=units(), curU=unitOf(sc()), many=U.length>1;
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
      ${bad?'<div class="u-bad">More runs than this processor has ports</div>':''}
    </div>`;
  }).join('');
}
let libUnit=null;
function pickUnitModel(id){ libUnit=id; openLib('proc'); }
function setCab(f,v){ cabOf()[f]=v; syncForm(); renderSide(); save(); }
function setTheme(k){ S.opt.ui=k; applyTheme(k); syncForm(); redraw(); save(); }
function setBasis(v){ S.opt.useAvg=v.startsWith('avg'); S.opt.derate=v.endsWith('80'); redraw(); renderSide(); renderSlots(); save(); }

/* ---- header menus ---- */
function toggleMenu(id,e){
  if(e) e.stopPropagation();
  const m=document.getElementById(id), was=m.classList.contains('open');
  closeMenus(); if(!was) m.classList.add('open');
}
function closeMenus(){ document.querySelectorAll('.menu.open').forEach(m=>m.classList.remove('open')); }
document.addEventListener('click',e=>{ if(!e.target.closest('.menu')) closeMenus(); });
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
  document.getElementById('chainTitle').textContent=m==='power'?'Pick a circuit':'Pick a port';
  const hints={
    arrange:'Drag screens to position them. Hold Alt to place freely.',
    layout:'Click tiles to switch them off for cutouts.',
    power:'Pick a circuit, then drag across tiles in order. Right-drag to erase. Keys 1–9 and 0 pick C1–C10; hold Shift for C11–C20.',
    data:'Pick a port, then drag across tiles in order. Right-drag to erase. Keys 1–9 and 0 pick P1–P10; hold Shift for P11–P20.'};
  document.getElementById('modeHint').textContent=hints[m];
  document.getElementById('helper').textContent='⌘/Ctrl + scroll to zoom · double-click a screen to focus';
  syncForm(); renderSlots(); syncRight(); redraw();
}
/* keyboard selection, with a brief on-canvas confirmation */
function keyPick(i){
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
  if(mode==='data') return autoData(s,len);
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
  if(seq.length>len*avail.length) setStatus(`Only ${avail.length} free port${avail.length===1?'':'s'} — raise tiles per chain or add a processor`);
  active[mode]=avail.length?avail[0].i:0;
  syncForm(); renderSlots(); redraw(); renderSide(); save();
}
/* Data runs use as few ports as the wall allows: each port is filled to capacity, so the run
   count is always ceil(tiles / tiles-per-port). Within that minimum the cleanest layout wins:
   whole rows (or columns) starting on the feed edge, so every home run comes in along that one
   edge. Side feeds number from the bottom row up; top and bottom feeds from left to right.
   Only when whole lines would cost an extra port does it fall back to one continuous snake
   cut at capacity, where some runs start where the last one ended. */
function dataLayout(s,feed,cap){
  const vert=feed==='top'||feed==='bottom', D=vert?s.rows:s.cols, A=vert?s.cols:s.rows;
  const flip=feed==='bottom'||feed==='right';
  const at=(d,a)=>{ const dd=flip?D-1-d:d; return vert?[dd,a]:[A-1-a,dd]; };
  const live=(d,a)=>{ const[r,c]=at(d,a); return !isOff(s,r,c); };
  const line=(a,ds,back)=>(back?[...ds].reverse():ds).filter(d=>live(d,a)).map(d=>({d,t:key(...at(d,a))}));
  const all=[...Array(D).keys()], min=Math.ceil(tileCount(s)/cap);
  /* whole lines, greedily packed to capacity, in bands when one line is longer than a port */
  const nb=Math.ceil(D/cap), whole=[];
  for(let b=0,d0=0;b<nb;b++){
    const h=Math.floor(D/nb)+(b<D%nb?1:0), ds=all.slice(d0,d0+h); d0+=h;
    let g=null;
    for(let a=0;a<A;a++){
      const n=ds.filter(d=>live(d,a)).length; if(!n) continue;
      if(!g||g.n+n>cap){ g={n:0,ls:[],ds}; whole.push(g); }
      g.ls.push(a); g.n+=n;
    }
  }
  if(whole.length<=min) return {feed,clean:true,runs:whole.map(g=>g.ls.flatMap((a,i)=>line(a,g.ds,i%2)).map(x=>x.t))};
  /* one snake through the wall, cut every cap tiles */
  const seq=[...Array(A).keys()].flatMap((a,i)=>line(a,all,i%2)), runs=[];
  let edge=0;
  for(let i=0;i<seq.length;i+=cap){ runs.push(seq.slice(i,i+cap).map(x=>x.t)); if(!seq[i].d) edge++; }
  return {feed,clean:false,edge,runs};
}
/* Auto tries each edge and keeps the first that reaches the minimum with whole lines, else the
   snake with the most runs starting on its edge */
const FEEDS=['left','top','right','bottom'];
function autoData(s,len){
  const p=panelById(s.panelId), pc=portCap(procOf(s));
  const fit=pc?Math.floor(pc/(p.pw*p.ph)):0;
  if(pc&&!fit){ setStatus('One '+p.model+' is more than a port can carry at '+bitDepth()+'-bit'); return; }
  const cap=fit||len, want=s.feed||'auto';
  const L=want==='auto'
    ? FEEDS.map(f=>dataLayout(s,f,cap)).reduce((b,x)=>(b.clean||(!x.clean&&x.edge<=b.edge))?b:x)
    : dataLayout(s,want,cap);
  const runs=L.runs, list=s.runs, u=unitOf(s);
  list.forEach(ch=>ch.tiles=[]);
  const avail=list.map((ch,i)=>({ch,i})).filter(x=>!(isBackupRun(s,x.ch)||portOwner(u,x.i,s)));
  runs.forEach((t,n)=>{ if(avail[n]) avail[n].ch.tiles=t; });
  const side={left:'down the left side',right:'down the right side',top:'along the top',bottom:'along the bottom'}[L.feed];
  if(runs.length>avail.length) setStatus(`Needs ${runs.length} ports, only ${avail.length} free — raise tiles per chain or add a processor`);
  else setStatus(`${runs.length} data run${runs.length===1?'':'s'}, up to ${cap} tiles each, home runs ${side}${L.clean?'':' (some start mid-wall to save ports)'}`);
  active.data=avail.length?avail[0].i:0;
  syncForm(); renderSlots(); redraw(); renderSide(); save();
}
function tidyChains(){ S.screens.forEach(hardPrune); }
function clearAllMapping(){
  const n=S.screens.length;
  if(!confirm(`Clear every power circuit, data run and backup on ${n===1?'this screen':'all '+n+' screens'}?\n\nTile layout, panels and processors are kept. This can be undone.`)) return;
  pushUndo('clear all mapping');
  S.screens.forEach(s=>{
    s.circuits.forEach(ch=>ch.tiles=[]);
    s.runs.forEach(ch=>ch.tiles=[]);
    s.backup={mode:'none',pairs:{},procId:''};
  });
  active={power:0,data:0};
  syncForm(); renderSlots(); renderSide(); redraw(); save();
  setStatus('All mapping cleared');
}
function clearChains(){ pushUndo('clear '+(mode==='power'?'circuits':'data runs')); chains(sc(),mode).forEach(ch=>ch.tiles=[]); renderSlots(); redraw(); renderSide(); save(); }

