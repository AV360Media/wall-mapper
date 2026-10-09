/* ========================= LIBRARY DIALOG ========================= */
function openLib(kind,setup){
  libKind=kind; if(!setup) libDraft=null;
  document.getElementById('libTitle').textContent=kind==='panel'?'Choose LED panel':'Choose processor';
  document.getElementById('libCustom').style.display=kind==='panel'?'':'none';
  document.getElementById('libSearch').value='';
  document.getElementById('libModal').classList.remove('hide');
  renderLib(); setTimeout(()=>document.getElementById('libSearch').focus(),30);
}
function closeMask(id){ document.getElementById(id).classList.add('hide'); }
function libRows(){
  const sc0=libDraft||sc()||{panelId:S.defPanel,procId:unitProc(units()[0]).id}, cust=libDraft?(libDraft.custom?[libDraft.custom]:[]):(S.customPanels||[]);
  return libKind==='panel'
    ? PANELS.concat(cust).map(p=>({id:p.id,sel:p.id===sc0.panelId,v:p.v,d:p.d,pop:p.pop,
        n:`${p.brand} ${p.model}`,
        sub:`${p.pitch}mm · ${p.pw}×${p.ph} px · ${IN(p.wmm).toFixed(1)}×${IN(p.hmm).toFixed(1)} in · ${p.lb||'?'} lb · ${p.wmax}W max`,
        hay:`${p.brand} ${p.series||''} ${p.model} ${p.pitch} ${p.pw}x${p.ph} ${p.pw} ${p.ph}`.toLowerCase()}))
    : PROCS.map(p=>({id:p.id,sel:p.id===sc0.procId,v:p.v,pop:p.pop,
        n:p.brand?`${p.brand} ${p.model}`:p.model,
        sub:p.total?`${(procCap(p)/1e6).toFixed(1)}M px · ${p.ports}× ${p.pt} · ${pxN(portCap(p))} px per port @ ${bitDepth()}-bit`:'skip capacity checking',
        hay:`${p.brand} ${p.model} ${p.pt}`.toLowerCase()}));
}
function libItem(r){
  const flags=(r.v===0?`<div class="flag">${r.d==='avg'?'avg derived':r.d==='nf'?'not on spec sheets':'verify'}</div>`:'')
    +(r.sel?'<div class="flag" style="color:var(--ok)">current</div>':'');
  return `<div class="item ${r.sel?'sel':''}" onclick="chooseLib('${r.id}')">
    <div class="main"><div class="n">${escp(r.n)}</div><div class="d">${escp(r.sub)}</div></div>${flags}</div>`;
}
function renderLib(){
  const q=document.getElementById('libSearch').value.trim().toLowerCase();
  const rows=libRows(), list=document.getElementById('libList');
  document.getElementById('libCount').textContent=
    `${rows.length} ${libKind==='panel'?'panels':'processors'} in the library`;
  if(!q){
    const shown=rows.filter(r=>r.pop||r.sel);
    list.innerHTML=`<div class="secthead">Common choices — start typing to search all ${rows.length}</div>`
      +shown.map(libItem).join('');
    return;
  }
  const terms=q.split(/\s+/).filter(Boolean);
  const hits=rows.filter(r=>terms.every(t=>r.hay.includes(t)));
  list.innerHTML=hits.length
    ? `<div class="secthead">${hits.length} match${hits.length===1?'':'es'}</div>`+hits.slice(0,80).map(libItem).join('')
      +(hits.length>80?'<div class="secthead">…refine your search to see the rest</div>':'')
    : '<div class="empty" style="padding:16px">Nothing matches that. Try a brand, a model, or a pitch like “2.6”.</div>';
}
function chooseLib(id){
  if(libDraft){ libDraft[libKind==='panel'?'panelId':'procId']=id; closeMask('libModal'); nwCheck(); return; }
  pushUndo(libKind==='panel'?'panel change':'processor change');
  const wasPanel=libKind==='panel';
  if(wasPanel){ if(sc()) sc().panelId=id; else S.defPanel=id; }
  else {
    const u=(libUnit&&units().find(x=>x.id===libUnit))||unitOf(sc());
    libUnit=null;
    if(u){ u.procId=id; if(!u.custom) u.name=''; }   /* auto names follow the model, typed names stay */
    S.screens.forEach(x=>{ if(unitOf(x)===u) x.procId=id; });
  }
  closeMask('libModal'); syncForm(); renderSide(); redraw(); fitView(); save();
  setStatus(wasPanel?'Panel set — choose a processor when you are ready':'Processor set');
}
function openCustom(){
  closeMask('libModal'); ['cpSpec','cpLb','cpLocks'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('cpFound').textContent=''; document.getElementById('cpCols').innerHTML=''; specCol=0;
  document.getElementById('cpModal').classList.remove('hide'); derive();
  setTimeout(()=>document.getElementById('cpSpec').focus(),40);
}
function derive(){
  const g=id=>+document.getElementById(id).value||0;
  const wmm=g('cpWmm'),hmm=g('cpHmm'),pw=g('cpPw'),ph=g('cpPh');
  document.getElementById('cpDerived').textContent=
    `Pitch from size ÷ pixels: ${wmm&&pw?(wmm/pw).toFixed(2):'—'} mm · ${(pw*ph).toLocaleString()} px per panel · ${((wmm*hmm)/1e6).toFixed(2)} m²`;
}
document.addEventListener('input',e=>{ if(['cpWmm','cpHmm','cpPw','cpPh'].includes(e.target.id)) derive(); });
function saveCustomPanel(){
  const g=id=>document.getElementById(id).value;
  const wmm=+g('cpWmm'),hmm=+g('cpHmm'),pw=+g('cpPw'),ph=+g('cpPh');
  if(!wmm||!hmm||!pw||!ph){ alert('Panel size and pixel count are required.'); return; }
  const p={id:uid('cp'),brand:g('cpBrand')||'Custom',
    model:(g('cpModel')||'Panel')+(g('cpLabel')?' ('+g('cpLabel')+')':''),
    pitch:+g('cpPitch')||+(wmm/pw).toFixed(2),wmm,hmm,pw,ph,
    wmax:+g('cpWmax')||0,wavg:+g('cpWavg')||0,v:1};
  if(+g('cpLb')>0) p.lb=+g('cpLb');
  const lk=String(g('cpLocks')).split(/[,\s]+/).map(Number).filter(x=>x>0&&x<=45); if(lk.length) p.locks=lk;
  if(libDraft){ libDraft.custom=p; libDraft.panelId=p.id; closeMask('cpModal'); nwCheck(); return; }
  S.customPanels=S.customPanels||[]; S.customPanels.push(p);
  if(sc()) sc().panelId=p.id; else S.defPanel=p.id;
  closeMask('cpModal'); syncForm(); renderSide(); redraw(); save();
}

