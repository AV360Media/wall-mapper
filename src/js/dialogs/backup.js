/* ========================= BACKUP DIALOG ========================= */
let bkDraft=null;
function openBackup(){
  if(!panelById(sc().panelId)){ setStatus('Pick an LED panel first'); return; }
  bkDraft=JSON.parse(JSON.stringify(bkOf(sc())));
  const me=unitOf(sc());
  bkDraft.bkUnit=(me&&me.bkUnit)||'';
  if(bkDraft.bkUnit) bkDraft.mode='device';
  document.getElementById('bkModal').classList.remove('hide');
  renderBackup();
}
function setBkMode(m){ bkDraft.mode=m; renderBackup(); }
function clearBackup(){ bkDraft.pairs={}; bkDraft.procId=''; renderBackup(); }
function setBkPair(primaryId,backupId){
  if(backupId) bkDraft.pairs[primaryId]=backupId; else delete bkDraft.pairs[primaryId];
  renderBackup();
}
function setBkUnit(v){
  if(v==='__new'){
    const me=unitOf(sc());
    const u=addUnit(me?me.procId:'none',(unitLabel(me)||'Processor')+' backup');
    bkDraft.bkUnit=u.id;
  } else bkDraft.bkUnit=v;
  renderBackup();
}
function renderBackup(){
  const s=sc(), body=document.getElementById('bkBody');
  ['none','port','device'].forEach(m=>
    document.getElementById(m==='none'?'bkNone':m==='port'?'bkPort':'bkDev').classList.toggle('on',bkDraft.mode===m));
  const primaries=used(s,'data');
  if(bkDraft.mode==='none'){
    body.innerHTML='<div class="empty" style="padding:16px">No redundancy. Only the primary data runs are drawn.</div>';
    return;
  }
  if(bkDraft.mode==='device'){
    const me=unitOf(s), U=units().filter(u=>u!==me);
    const opts=U.map(u=>{
      const claimed=bkFor(u);
      const dis=claimed&&claimed!==me;
      return `<option value="${u.id}" ${bkDraft.bkUnit===u.id?'selected':''} ${dis?'disabled':''}>`
        +`${escp(unitLabel(u))}${dis?' — already backs up '+escp(unitLabel(claimed)):''}</option>`;
    }).join('');
    body.innerHTML=`<div style="padding:12px">
      <div class="hint" style="margin:0 0 10px;line-height:1.6">
        A second processor mirrors <b>${escp(unitLabel(me))}</b> port for port. Every screen fed by it
        is backed up, not just this one.</div>
      <div class="f"><label>Mirrored on</label>
        <select onchange="setBkUnit(this.value)">
          <option value="" ${!bkDraft.bkUnit?'selected':''}>— choose a processor —</option>
          ${opts}
          <option value="__new">+ Add a new processor as the backup</option>
        </select></div>
      <div class="hint">${U.length?`${S.screens.filter(x=>unitOf(x)===me).length} screen${S.screens.filter(x=>unitOf(x)===me).length===1?'':'s'} on ${escp(unitLabel(me))} will show backup runs.`
        :'You only have one processor. Add a second one to mirror onto.'}</div>
    </div>`;
    return;
  }
  if(!primaries.length){
    body.innerHTML='<div class="empty" style="padding:16px">Assign some data runs first, then come back to pair them with backup ports.</div>';
    return;
  }
  const taken=Object.values(bkDraft.pairs);
  body.innerHTML=`<div class="hint" style="padding:10px 12px 4px;margin:0">Pick which port carries the backup for each primary run.
    A port used as a backup can’t also carry its own tiles.</div>`+
    primaries.map(ch=>{
      const cn=bkDraft.pairs[ch.id]||'';
      const opts=s.runs.map(r=>{
        if(r.id===ch.id) return '';
        if(LT(s,r).length&&r.id!==cn) return '';
        if(taken.includes(r.id)&&r.id!==cn) return '';
        if(bkDraft.pairs[r.id]) return '';
        return `<option value="${r.id}" ${cn===r.id?'selected':''}>${escp(r.name)}</option>`;
      }).join('');
      return `<div class="item" style="cursor:default">
        <div class="main"><div class="n" style="color:${ch.color}">${escp(ch.name)}</div>
          <div class="d">${LT(s,ch).length} tiles · ${(runCalc(s,ch).px/1000).toFixed(0)}k px</div></div>
        <select style="width:150px;background:var(--elev);border:1px solid var(--line2);color:var(--tx);padding:5px 6px;border-radius:4px;font-family:'DM Mono',monospace;font-size:11.5px"
          onchange="setBkPair('${ch.id}',this.value)">
          <option value="">— no backup —</option>${opts}
        </select></div>`;
    }).join('');
}
function applyBackup(){
  pushUndo('backup setup');
  const s=sc(), me=unitOf(s);
  if(bkDraft.mode==='device'){
    if(!bkDraft.bkUnit){ setStatus('Choose which processor mirrors this one'); return; }
    if(me) me.bkUnit=bkDraft.bkUnit;
    bkDraft.pairs={};
  } else {
    if(me) me.bkUnit='';
    if(bkDraft.mode!=='port') bkDraft.pairs={};
  }
  s.backup={mode:bkDraft.mode,pairs:bkDraft.pairs,procId:'',unitRef:'',_i:1};
  /* a port acting as a backup carries no tiles of its own */
  Object.values(s.backup.pairs).forEach(id=>{ const r=s.runs.find(x=>x.id===id); if(r) r.tiles=[]; });
  closeMask('bkModal'); setLayers('data');
  syncForm(); renderSlots(); renderSide(); redraw(); save();
  setStatus(s.backup.mode==='none'?'Backup cleared':'Backup saved');
}

