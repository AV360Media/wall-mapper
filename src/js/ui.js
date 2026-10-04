/* ========================= UI ========================= */
function openScreenMenu(i,x,y){
  closeScreenMenu(); closeMenus();
  const s=S.screens[i]; if(!s) return;
  selectScreen(i);
  const only=S.screens.length<2, m=document.createElement('div');
  m.id='ctxMenu'; m.className='ctxmenu';
  const I=d=>`<svg viewBox="0 0 24 24">${d}</svg>`;
  m.innerHTML=`<div class="ctx-t">${escp((s.name||'Screen').trim())}</div>
    <button onclick="closeScreenMenu();enterFocus(${i})">${I('<path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"/>')}Focus</button>
    <button onclick="closeScreenMenu();dupScreen()">${I('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>')}Duplicate</button>
    <button onclick="closeScreenMenu();clearAllMapping()">${I('<path d="M4 4l16 16M20 4L4 20"/>')}Clear mapping</button>
    <div class="ctx-sep"></div>
    <button class="dgr" ${only?'disabled title="A project needs at least one screen"':''} onclick="closeScreenMenu();ctxDelete(${i})">${I('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>')}Delete screen</button>`;
  document.body.appendChild(m);
  const r=m.getBoundingClientRect();
  m.style.left=Math.min(x,innerWidth-r.width-10)+'px';
  m.style.top=Math.min(y,innerHeight-r.height-10)+'px';
  requestAnimationFrame(()=>m.classList.add('on'));
}
function closeScreenMenu(){ const m=document.getElementById('ctxMenu'); if(m) m.remove(); }
function ctxDelete(i){
  if(S.screens.length<2) return;
  const name=(S.screens[i].name||'Screen').trim();
  selectScreen(i); delScreen();
  setStatus(`Deleted ${name} · ⌘Z to undo`);
}
document.addEventListener('mousedown',e=>{ if(!e.target.closest('#ctxMenu')) closeScreenMenu(); },true);
document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeScreenMenu(); });
window.addEventListener('blur',closeScreenMenu);
function renderTabs(){
  document.getElementById('tabs').innerHTML=
    S.screens.map((s,i)=>`<div class="tab ${i===cur?'on':''}" onclick="selectScreen(${i})" ondblclick="enterFocus(${i})"
      oncontextmenu="event.preventDefault();openScreenMenu(${i},event.clientX,event.clientY)">${escp(s.name)}</div>`).join('')+
    `<div class="tab" style="color:var(--tx3)" onclick="addScreen()">+</div>`;
  renderEmpty();
}
/* ---- a project with no screens yet: show its settings and the way to add one ---- */
function renderEmpty(){
  const none=!S.screens.length, el=document.getElementById('emptySet');
  if(document.body.classList.contains('noscreens')!==none){
    document.body.classList.toggle('noscreens',none); requestAnimationFrame(segSync);   /* the mode switch was hidden */
  }
  if(!el||!none) return;
  const p=panelById(S.defPanel), u=units()[0], pr=unitProc(u), o=opt();
  const row=(k,v,fn)=>`<div class="es-row"><span class="k">${k}</span><span class="v">${v}</span><button class="btn sm ghost" onclick="${fn}">Change</button></div>`;
  const basis=(o.useAvg?'average':'max')+' watts, '+(o.derate?'80% derate':'full breaker');
  el.innerHTML=`<div class="es-k">${escp(S.name||'Untitled Project')}</div>
    <h3>Blank canvas</h3>
    <div class="hint">Every screen you add starts with these settings.</div>
    ${row('LED panel',p?`${escp(p.brand+' '+p.model)}<small>${p.pitch} mm · ${p.pw}×${p.ph} px</small>`:'<em>None chosen</em>',"openLib('panel')")}
    ${row('Processor',pr.id!=='none'?`${escp((pr.brand?pr.brand+' ':'')+pr.model)}<small>${pr.total?pr.ports+' ports · '+(portCap(pr)/1000).toFixed(0)+'k px each at '+bitDepth()+'-bit':'no capacity check'}</small>`:'<em>None chosen</em>',"openLib('proc')")}
    ${row('Power',`${o.volts} V · ${o.breaker} A breaker<small>${basis}</small>`,"openSettings('power')")}
    <div class="es-row"><span class="k">Data home runs</span><span class="v"><select onchange="S.defFeed=this.value;save()">
      ${['auto','top','bottom','left','right'].map(f=>`<option value="${f}" ${(S.defFeed||'auto')===f?'selected':''}>${f[0].toUpperCase()+f.slice(1)}</option>`).join('')}</select></span></div>
    <button class="btn pri" style="width:100%;margin-top:14px" onclick="openBatch()">+ Add screens</button>`;
}
function renderSlots(){
  if(!sc()) return;
  const bb=document.getElementById('bkBtn'), bn=document.getElementById('bkNote');
  if(bb){
    bb.style.display=mode==='data'?'':'none';
    const bk=bkOf(sc());
    bn.textContent=mode!=='data'?'':(bkMode(sc())==='device'?('Mirrored on '+bkDeviceName(sc()))
      :bkMode(sc())==='port'?(Object.keys(bk.pairs).length+' port pair'+(Object.keys(bk.pairs).length===1?'':'s')+' configured'):'No backup configured');
  }
  if(mode!=='power'&&mode!=='data') return;
  const s=sc(), list=chains(s,mode);
  document.getElementById('slots').innerHTML=list.map((ch,i)=>{
    const n=LT(s,ch).length, hidden=ch.tiles.length-n, bk=mode==='data'&&isBackupRun(s,ch);
    const owner=mode==='data'?portOwner(unitOf(s),i,s):null;
    if(owner) return `<div class="slot taken" title="Port ${i+1} is already used on ${escp(owner.name)}">
      ${escp(ch.name)}<span class="n">${escp(owner.name.slice(0,4))}</span>
      <span class="bar" style="background:#3d4859"></span></div>`;
    const cap=mode==='data'?(unitProc(unitOf(s)).ports||0):0;
    const beyond=cap&&i>=cap;
    return `<div class="slot ${n?'used':''} ${active[mode]===i?'on':''} ${beyond?'beyond':''}" style="${bk?'opacity:.6;border-style:dashed':''}"
      onclick="pickSlot(${i})" title="${escp(ch.name)}${beyond?' — beyond this processor\u2019s port count':''}${bk?' — backup port':n?' — '+n+' tiles'+(hidden?' ('+hidden+' parked outside the grid)':''):' — free'}">
      ${escp(ch.name)}${bk?'<span class="n">bk</span>':(n?`<span class="n">${n}</span>`:'')}
      <span class="bar" style="background:${bk?'#c084fc':(n?ch.color:'transparent')}"></span></div>`;
  }).join('');
}
function renderSide(){
  renderEmpty(); if(!sc()) return;
  const s=sc(), t=totals(s), pr=procOf(s);
  { const pn=panelById(s.panelId), n=document.getElementById('inspName'), sub=document.getElementById('inspSub');
    if(n) n.textContent=(s.name||'Screen').trim();
    if(sub) sub.textContent=pn?`${pn.brand} ${pn.model} · ${s.cols} × ${s.rows} · ${pn.pw} × ${pn.ph} px per panel`:'No panel chosen yet'; }
  const uc=used(s,'power'), ur=used(s,'data');
  document.getElementById('pwSum').innerHTML=uc.length?uc.map(ch=>{
    const k=circuitCalc(s,ch), over=k.pct>=100;
    const col=over?'var(--bad)':k.pct>=80?'var(--warn)':'var(--ok)';
    return `<div class="card ${over?'over':''}"><div class="hd"><span class="n" style="color:${ch.color}">${escp(ch.name)}</span>
      <span class="v">${k.amps.toFixed(1)}A / ${k.cap.toFixed(1)}A</span></div>
      <div class="trk"><div class="fil" style="width:${Math.min(100,k.pct)}%;background:${col}"></div></div>
      <div class="ft"><span>${LT(s,ch).length} tiles · ${k.w}W</span><span>${k.breaker}A ${k.volts}V${over?' · OVER':''}</span></div></div>`;
  }).join(''):'<div class="empty">No circuits assigned yet.</div>';
  document.getElementById('dtSum').innerHTML=ur.length?ur.map(ch=>{
    const k=runCalc(s,ch), over=k.pct>=100;
    const col=over?'var(--bad)':k.pct>=80?'var(--warn)':'var(--ok)';
    return `<div class="card ${over?'over':''}"><div class="hd"><span class="n" style="color:${ch.color}">${escp(ch.name)}</span>
      <span class="v">${(k.px/1000).toFixed(0)}k / ${k.cap?(k.cap/1000).toFixed(0)+'k':'—'}</span></div>
      <div class="trk"><div class="fil" style="width:${Math.min(100,k.pct)}%;background:${col}"></div></div>
      <div class="ft"><span>${LT(s,ch).length} tiles · ${escp(portShort(s,ch))}</span><span>${over?'OVER':escp(pr.pt||'')}</span></div></div>`;
  }).join(''):'<div class="empty">No data runs assigned yet.</div>';
  const ptot=procCap(pr), cap=ptot?t.px/ptot*100:0;
  document.getElementById('totals').innerHTML=`
    <div class="row"><span>Resolution</span><span class="v">${t.resW} × ${t.resH}</span></div>
    <div class="row"><span>Per panel</span><span class="v">${(()=>{ const pn=panelById(s.panelId); return pn?`${pn.pw} × ${pn.ph} px`:'—'; })()}</span></div>
    <div class="row"><span>Size</span><span class="v">${t.wmm?ftIn(t.wmm)+' × '+ftIn(t.hmm):'—'}</span></div>
    <div class="row"><span>Tiles</span><span class="v">${t.tiles}</span></div>
    <div class="row"><span>Weight</span><span class="v">${t.lb?lbFmt(t.lb):'—'}</span></div>
    <div class="row"><span>Processor use</span><span class="v ${cap>100?'w':''}">${ptot?cap.toFixed(0)+'%':'—'}</span></div>
    <div class="row"><span>Processor</span><span class="v">${escp(unitLabel(unitOf(s)))}</span></div>
    <div class="row"><span>Ports used</span><span class="v ${unitLoad(unitOf(s)).over?'w':''}">${unitLoad(unitOf(s)).used} / ${unitLoad(unitOf(s)).ports||'—'}</span></div>
    <div class="row"><span>Port capacity</span><span class="v">${pr.pp?(portCap(pr)/1000).toFixed(0)+'k @ '+bitDepth()+'-bit':'—'}</span></div>
    <div class="row"><span>Load max / avg</span><span class="v">${(t.wMax/1000).toFixed(2)} / ${(t.wAvg/1000).toFixed(2)} kW</span></div>
    <div class="row"><span>No power</span><span class="v ${t.noPwr?'w':''}">${t.noPwr} tiles</span></div>
    <div class="row"><span>No data</span><span class="v ${t.noDat?'w':''}">${t.noDat} tiles</span></div>`;
  const st=setTotalsCalc();
  document.getElementById('setTotals').innerHTML=`
    <div class="row"><span>Screens</span><span class="v">${S.screens.length}</span></div>
    <div class="row"><span>Tiles</span><span class="v">${st.tiles}</span></div>
    <div class="row"><span>Pixels</span><span class="v">${(st.px/1e6).toFixed(2)} M</span></div>
    <div class="row"><span>Weight</span><span class="v">${st.lb?lbFmt(st.lb):'—'}</span></div>
    <div class="row"><span>Circuits / runs</span><span class="v">${st.circ} / ${st.runs}</span></div>
    <div class="row"><span>Load max / avg</span><span class="v">${(st.wMax/1000).toFixed(1)} / ${(st.wAvg/1000).toFixed(1)} kW</span></div>`;
}
function syncForm(){
  const s=sc()||startScreen(blankScreen(1)), p=panelById(s.panelId), o=opt();   /* no screens: show what the next one gets */
  const prU=procOf(s), pr=prU.id==='none'?null:prU;
  const canMap=!!p;
  document.getElementById('modeSeg').style.opacity=canMap?'1':'.45';
  document.getElementById('modeSeg').style.pointerEvents=canMap?'':'none';
  document.getElementById('projName').value=S.name;
  document.getElementById('projVenue').value=S.venue||'';
  document.getElementById('scName').value=s.name;
  document.getElementById('scRows').value=s.rows;
  document.getElementById('scCols').value=s.cols;
  document.getElementById('aoFeed').value=s.feed||'auto';
  document.getElementById('aoFeedWrap').style.display=mode==='data'?'':'none';
  document.getElementById('aoDirWrap').style.display=mode==='data'?'none':'';
  /* data runs always fill their port, so the length box is for power only */
  document.getElementById('aoLenWrap').style.display=mode==='data'?'none':'';
  const an=document.getElementById('aoNote'), tp=p?tilesPerPort(s):0;
  an.style.display=mode==='data'&&tp?'':'none';
  an.textContent=tp?`Fills each port: up to ${tp} tiles (${Math.round(portPx(s)/1000)}k px at ${bitDepth()}-bit${pr&&portCap(pr)?'':', standard port until a processor is picked'})`:'';
  const pk=document.getElementById('panelPick');
  pk.innerHTML=p
    ? `<span class="t">${escp(p.brand+' '+p.model)}</span><span class="s">${p.pitch} mm · ${p.pw}×${p.ph} px · ${p.lb||'?'} lb</span>`
    : `<span class="t" style="color:var(--ac)">Choose LED panel…</span><span class="s">required before you can map tiles</span>`;
  pk.style.borderColor=p?'':'var(--ac)';
  document.getElementById('panelWarn').textContent=!p?'':
    (p.d==='avg'?'⚠ Average watts derived at 45% of max — confirm before sizing off it.'
      :p.d==='half'?'⚠ Half-panel figures scaled from the full cabinet — confirm on the spec sheet.'
      :p.v===0?'⚠ Some figures are estimates — confirm on the spec sheet.':'');
  const us=document.getElementById('scUnit');
  if(us){
    us.innerHTML=units().map(u=>`<option value="${u.id}">${escp(unitLabel(u))}</option>`).join('');
    const cu=unitOf(s); if(cu) us.value=cu.id;
  }
  renderUnits();
  const uw=document.getElementById('scUnitWrap'); if(uw) uw.style.display=units().length>1?'':'none';
  const rk=document.getElementById('procPick');
  rk.innerHTML=pr
    ? `<span class="t">${escp((pr.brand?pr.brand+' ':'')+pr.model)}</span><span class="s">${pr.total?(pr.ports+' ports · '+(portCap(pr)/1000).toFixed(0)+'k px each · '+bitDepth()+'-bit'):'no capacity check'}</span>`
    : `<span class="t" style="color:var(--ac)">Choose a processor model…</span><span class="s">enables port capacity checks</span>`;
  rk.style.borderColor=pr?'':'var(--ac)';
  document.getElementById('procWarn').textContent=(pr&&pr.v===0)?'⚠ Port count or capacity unconfirmed.':'';
  document.getElementById('pwVolts').value=o.volts;
  document.getElementById('pwAmps').value=o.breaker;
  document.getElementById('pwBasis').value=(o.useAvg?'avg':'max')+(o.derate?'80':'100');
  const ui=document.getElementById('vUi');
  if(ui&&!ui.options.length) ui.innerHTML=Object.keys(THEMES).map(k=>`<option value="${k}">${THEMES[k].label}</option>`).join('');
  if(ui) ui.value=o.ui||'indigo';
  const C0=cabOf(), g=id=>document.getElementById(id);
  const cvSel=g('cbCvt');
  if(cvSel&&!cvSel.options.length)
    cvSel.innerHTML=Object.entries(CVTS).map(([k,v])=>
      `<option value="${k}">${escp(v.name)} — ${v.ports} port${v.ports===1?'':'s'}</option>`).join('')
      +'<option value="custom">Custom / house converter…</option>';
  g('cbTrunk').value=C0.trunk; g('cbBreak').value=C0.breakout; g('cbSoca').value=C0.soca;
  g('cbPJT').value=C0.pJumpType; g('cbPJ').value=C0.pJump; g('cbPTail').value=C0.pTail;
  g('cbFeed').value=C0.feed; if(cvSel) cvSel.value=C0.cvt;
  g('cbCvtName').value=C0.cvtName||''; g('cbCvtPorts').value=C0.cvtPorts;
  g('cbCvtQty').value=C0.cvtQty||''; g('cbSender').value=C0.cvtSender;
  g('cbFibQty').value=C0.fiberQty||''; g('cbFibLen').value=C0.fiberLen;
  g('cbTail').value=C0.dTail; g('cbDJ').value=C0.dJump; g('cbFbk').checked=!!C0.fiberBackup;
  const fib=C0.feed==='fiber';
  g('cbFiberOpts').style.display=fib?'':'none';
  g('cbSocaWrap').style.display=C0.trunk==='soca'?'':'none';
  g('cbTailWrap').style.display=C0.trunk==='soca'?'':'none';
  g('cbCustomWrap').style.display=fib&&C0.cvt==='custom'?'':'none';
  g('cbCvtQty').placeholder='auto';
  g('cbFibQty').placeholder='auto';
  if(fib){
    const cv=cvtSpec(), P0=pullRows();
    const wall=(P0.data.find(r=>/at the wall/.test(r[0]))||[])[1]||0;
    const sendRow=P0.data.find(r=>/at the processor/.test(r[0]));
    const fibRow=P0.data.find(r=>/^Fibre/.test(r[0]));
    g('cbNote').textContent=`${wall} × ${cv.name} at the wall`
      +(sendRow?`, ${sendRow[1]} at the processor`:', none at the processor')
      +`, ${fibRow?fibRow[1]:0} fibre run${(fibRow&&fibRow[1])===1?'':'s'}.`
      +` Leave a quantity blank for automatic.`;
  } else {
    g('cbNote').textContent='Every data run gets its own Cat6 home run from the processor.';
  }
  document.getElementById('vBits').value=String(o.bits||8);
  document.getElementById('vDetail').value=o.detail;
  document.getElementById('vSnap').checked=o.snap!==false;
  document.getElementById('vFront').classList.toggle('on',!o.rear);
  document.getElementById('vRear').classList.toggle('on',!!o.rear);
  document.getElementById('lPower').classList.toggle('on',!!o.showPower);
  document.getElementById('lData').classList.toggle('on',!!o.showData);
}

