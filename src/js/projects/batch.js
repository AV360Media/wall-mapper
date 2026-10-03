/* ---- batch screen creation ---- */
let batch=[];
const screenUnmapped=q=>!(q.off||[]).length
  && !q.circuits.some(c=>c.tiles.length) && !q.runs.some(c=>c.tiles.length);
const screenBlank=q=>!q.panelId && screenUnmapped(q) && /^Screen \d+$/.test(q.name||'');
/* the lone starting screen — bring it into the batch list so it can be edited */
const starterScreen=()=>
  (S.screens.length===1 && screenUnmapped(S.screens[0]) && /^Screen \d+$/.test(S.screens[0].name||''))
    ? S.screens[0] : null;
function openBatch(){
  const g=id=>document.getElementById(id);
  const cur0=sc();
  g('btPanel').innerHTML=PANELS.concat(S.customPanels||[]).map(p=>
    `<option value="${p.id}" ${p.id===cur0.panelId?'selected':''}>${escp(p.brand+' '+p.model)} · ${p.pitch}mm</option>`).join('');
  const cu=unitOf(cur0);
  if(!batch.length){
    const st=starterScreen();
    batch=st
      ? [{ref:st.id,name:st.name,cols:st.cols,rows:st.rows,unit:(unitOf(st)||{}).id||''}]
      : [{name:'',cols:8,rows:4,unit:cu?cu.id:''}];
  }
  renderBatch();
  g('btModal').classList.remove('hide');
}
const unitOpts=sel=>units().map(u=>
  `<option value="${u.id}" ${sel===u.id?'selected':''}>${escp(unitLabel(u))}</option>`).join('')
  +`<option value="__new">+ New processor…</option>`;
function batchAddRow(){
  const last=batch[batch.length-1]||{cols:8,rows:4,unit:''};
  batch.push({name:'',cols:last.cols,rows:last.rows,unit:last.unit});
  renderBatch();
}
function batchDel(i){
  batch.splice(i,1);
  if(!batch.length){ const cu=unitOf(sc()); batch=[{name:'',cols:8,rows:4,unit:cu?cu.id:''}]; }
  renderBatch();
}
function batchSet(i,f,v){ if(batch[i]) batch[i][f]=(f==='name')?v:Math.max(1,+v||1); renderBatch(1); }
function batchUnit(i,v){
  if(v==='__new'){
    const base=unitOf(sc());
    const u=addUnit(base?base.procId:'none');
    batch[i].unit=u.id;
    setStatus('Added '+unitLabel(u));
  } else batch[i].unit=v;
  renderBatch();
}
function batchBulkUnit(v){
  if(!v) return;
  if(v==='__new'){ const base=unitOf(sc()); const u=addUnit(base?base.procId:'none'); batch.forEach(b=>b.unit=u.id); }
  else batch.forEach(b=>b.unit=v);
  document.getElementById('btBulk').value='';
  renderBatch();
}
function batchClear(){ const cu=unitOf(sc()); batch=[{name:'',cols:8,rows:4,unit:cu?cu.id:''}]; renderBatch(); }
function closeBatch(){ batch=[]; closeMask('btModal'); }
function batchName(i){
  const b=batch[i];
  if(b.name.trim()) return b.name.trim();
  if(b.ref){ const q=S.screens.find(x=>x.id===b.ref); if(q) return q.name; }
  const existing=S.screens.filter(q=>!screenBlank(q)&&!batch.some(z=>z.ref===q.id)).length;
  const newBefore=batch.slice(0,i).filter(z=>!z.ref).length;
  return 'Screen '+(existing+newBefore+1);
}
function renderBatch(light){
  const el=document.getElementById('btList');
  document.getElementById('btCount').textContent=batch.length?batch.length+(batch.length===1?' screen':' screens'):'';
  document.getElementById('btGo').disabled=!batch.length;
  const p=panelById(document.getElementById('btPanel').value);
  let tiles=0; batch.forEach(b=>tiles+=b.cols*b.rows);
  /* how the ports land on each processor once these are added */
  const per={};
  batch.forEach(b=>{ per[b.unit]=(per[b.unit]||0)+1; });
  const bits=Object.entries(per).map(([id,n])=>{
    const u=units().find(x=>x.id===id);
    return `${n} on ${u?unitLabel(u):'no processor'}`;
  });
  const noModel=Object.keys(per).map(id=>units().find(x=>x.id===id))
    .filter(u=>u&&unitProc(u).id==='none').map(u=>unitLabel(u));
  document.getElementById('btNote').innerHTML=
    (p?`${tiles} tiles · ${lbFmt(tiles*(p.lb||0))} · ${(tiles*p.wmax/1000).toFixed(1)} kW max`:`${tiles} tiles`)
    +(bits.length?`<br>${bits.join(' · ')}`:'')
    +(noModel.length?`<br><span style="color:var(--warn)">${noModel.join(' and ')} ${noModel.length===1?'has':'have'} no model yet — set one in the sidebar to get port limits</span>`:'');
  const bulk=document.getElementById('btBulk');
  if(bulk) bulk.innerHTML='<option value="">Set every row to…</option>'+unitOpts('');
  if(light) return;
  el.innerHTML=batch.map((b,i)=>`
    <div class="bt-row"${b.ref?' title="This is the screen already in the project"':''}>
      <input value="${escp(b.name)}" placeholder="${escp(batchName(i))}"
        style="${b.ref?'border-color:var(--ac)':''}" oninput="batchSet(${i},'name',this.value)" />
      <input class="num" type="number" min="1" value="${b.cols}" oninput="batchSet(${i},'cols',this.value)" />
      <span class="times">×</span>
      <input class="num" type="number" min="1" value="${b.rows}" oninput="batchSet(${i},'rows',this.value)" />
      <select onchange="batchUnit(${i},this.value)">${unitOpts(b.unit)}</select>
      <button class="x" onclick="batchDel(${i})" title="Remove">×</button>
    </div>`).join('');
}
function batchCreate(){
  if(!batch.length) return;
  const g=id=>document.getElementById(id);
  const panelId=g('btPanel').value, place=g('btPlace').value;
  const gapFt=Math.max(0,+g('btGap').value||0);
  pushUndo('add '+batch.length+' screen'+(batch.length===1?'':'s'));
  const gapW=gapFt*304.8*MM;
  const made=[];
  batch.forEach((b,i)=>{
    const uu=units().find(u=>u.id===b.unit)||units()[0];
    let q=b.ref?S.screens.find(x=>x.id===b.ref):null;
    if(!q){ q=blankScreen(1); S.screens.push(q); }
    q.name=b.name.trim()||batchName(i);
    q.cols=b.cols; q.rows=b.rows; q.panelId=panelId;
    q.procRef=uu?uu.id:''; q.procId=uu?uu.procId:'none';
    made.push(q);
  });
  S.screens=S.screens.filter(q=>made.includes(q)||!screenBlank(q));
  if(!S.screens.length) S.screens=made.slice();
  /* start to the right of whatever is staying put — never count the ones being placed */
  let x=0;
  S.screens.forEach(q=>{ if(made.includes(q)) return; const b=sbox(q); x=Math.max(x,q.x+b.w+SETGAP); });
  if(place!=='none'){
    const boxes=made.map(q=>sbox(q));
    const maxH=Math.max(...boxes.map(b=>b.h));
    let cx=x, cy=0;
    made.forEach((q,i)=>{
      const b=boxes[i];
      if(place==='stack'){ q.x=x; q.y=cy; cy+=b.h+gapW; }
      else { q.x=cx; q.y=(place==='row')?(maxH-b.h):0; cx+=b.w+gapW; }
    });
  } else made.forEach(q=>{ q.x=x; q.y=0; });
  closeMask('btModal');
  cur=Math.max(0,S.screens.indexOf(made[0]));
  renderTabs(); syncForm(); renderSlots(); renderSide(); fitView(); save();
  setStatus(`Added ${made.length} screen${made.length===1?'':'s'}`);
  batch=[];
}
function openProjects(){
  document.getElementById('pjModal').classList.remove('hide');
  renderCloud(); renderProjects();
  if(cloudOn()&&signedIn()&&Date.now()-lastSync>20000) sbSyncAll(true);
}
