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
/* Data runs laid out the way a crew patches them: every run starts on the edge the home runs
   come from, takes whole columns (or rows) and snakes away from that edge and back, so all the
   home runs land side by side in port order. A wall too deep for one run per column is cut into
   bands; each band's runs start on its own edge nearest the feed. Runs are balanced so they
   carry similar tile counts, and never exceed tiles-per-chain or the port's pixel capacity. */
function dataLayout(s,feed,cap){
  const vert=feed!=='left'&&feed!=='right', D=vert?s.rows:s.cols, A=vert?s.cols:s.rows;
  const flip=feed==='bottom'||feed==='right';
  const at=(d,a)=>{ const dd=flip?D-1-d:d; return vert?[dd,a]:[a,dd]; };
  const live=(d,a)=>{ const[r,c]=at(d,a); return !isOff(s,r,c); };
  const nb=Math.ceil(D/cap), out=[];
  for(let b=0,d0=0;b<nb;b++){
    const h=Math.floor(D/nb)+(b<D%nb?1:0), ds=[...Array(h).keys()].map(i=>d0+i); d0+=h;
    const lines=[...Array(A).keys()].map(a=>({a,n:ds.filter(d=>live(d,a)).length})).filter(l=>l.n);
    if(!lines.length) continue;
    const pack=lim=>{ const g=[[]]; let t=0;
      lines.forEach(l=>{ if(t+l.n>lim&&g[g.length-1].length){ g.push([]); t=0; } g[g.length-1].push(l); t+=l.n; });
      return g; };
    const n=pack(cap).length, tot=lines.reduce((t,l)=>t+l.n,0);
    /* spread the lines evenly over those n runs; keep the greedy packing if that would overfill one */
    let g=[...Array(n)].map(()=>[]), t=0;
    lines.forEach(l=>{ g[Math.min(n-1,Math.floor((t+l.n/2)*n/tot))].push(l); t+=l.n; });
    if(g.some(x=>!x.length||x.reduce((u,l)=>u+l.n,0)>cap)) g=pack(cap);
    g.forEach(x=>out.push(x.flatMap((l,i)=>(i%2?[...ds].reverse():ds)
      .filter(d=>live(d,l.a)).map(d=>key(...at(d,l.a))))));
  }
  return out;
}
function autoData(s,len){
  const p=panelById(s.panelId), pc=portCap(procOf(s));
  const fit=pc?Math.floor(pc/(p.pw*p.ph)):0;
  if(pc&&!fit){ setStatus('One '+p.model+' is more than a port can carry at '+bitDepth()+'-bit'); return; }
  const cap=fit?Math.min(len,fit):len, feed=s.feed||'top';
  const runs=dataLayout(s,feed,cap), list=s.runs, u=unitOf(s);
  list.forEach(ch=>ch.tiles=[]);
  const avail=list.map((ch,i)=>({ch,i})).filter(x=>!(isBackupRun(s,x.ch)||portOwner(u,x.i,s)));
  runs.forEach((t,n)=>{ if(avail[n]) avail[n].ch.tiles=t; });
  if(runs.length>avail.length) setStatus(`Needs ${runs.length} ports, only ${avail.length} free — raise tiles per chain or add a processor`);
  else setStatus(`${runs.length} data run${runs.length===1?'':'s'}, up to ${cap} tiles each${fit&&fit<len?' (port capacity)':''}, home runs from the ${feed}`);
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

