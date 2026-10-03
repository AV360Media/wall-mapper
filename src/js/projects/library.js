/* ========================= PROJECT LIBRARY ========================= */
const IDX='wm:index', PKEY=id=>'wm:p:'+id, CURKEY='wm:current', LEGACY='wallmap';
let projId=null, projIndex=[];
const QUIET=/^(Saving…|Saved|Ready|Loading…|Saving\.\.\.)$/;
function setStatus(t){
  const el=document.getElementById('status'); if(!el) return;
  el.textContent=t; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  if(QUIET.test(String(t))||performance.now()<2500) return;    /* stay quiet while the app is starting */
  let x=document.getElementById('toast');
  if(!x){ x=document.createElement('div'); x.id='toast'; document.body.appendChild(x); }
  const bad=/fail|error|not |cannot|can't|couldn|over |blocked|refused|in use|nothing|no printer|stopped/i.test(t);
  x.className=bad?'bad':''; x.innerHTML=`<i>${bad?'!':'✓'}</i><span>${escp(String(t))}</span>`;
  requestAnimationFrame(()=>x.classList.add('on'));
  clearTimeout(setStatus._t); setStatus._t=setTimeout(()=>x.classList.remove('on'),bad?4200:2600);
}

function rawTiles(d){
  try{
    return d.screens.reduce((n,sn)=>{
      if(!sn.panelId) return n;
      const off=new Set(sn.off||[]);
      return n+sn.rows*sn.cols-[...off].filter(t=>{
        const[r,c]=t.split(':').map(Number);
        return r<sn.rows&&c<sn.cols;
      }).length;
    },0);
  }catch(e){ return 0; }
}
function projMeta(){
  const st=setTotalsCalc();
  return {id:projId,name:S.name||'Untitled Project',venue:S.venue||'',
    updated:Date.now(),screens:S.screens.length,tiles:st.tiles};
}
function touchIndex(){
  const m=projMeta(), i=projIndex.findIndex(x=>x.id===projId);
  if(i>=0) projIndex[i]=m; else projIndex.unshift(m);
  projIndex.sort((a,b)=>b.updated-a.updated);
}
let tmr=null, pushTmr=null;
function save(){
  if(!projId) return;
  setStatus('Saving…'); clearTimeout(tmr);
  tmr=setTimeout(async()=>{
    try{
      await sSet(PKEY(projId),S);
      touchIndex();
      await sSet(IDX,projIndex);
      await sSet(CURKEY,projId);
      setStatus(cloudOn()&&signedIn()?'Saved · syncing':'Saved');
      if(!document.getElementById('pjModal').classList.contains('hide')) renderProjects();
      if(cloudOn()&&signedIn()){ clearTimeout(pushTmr); pushTmr=setTimeout(()=>sbSyncAll(true),2500); }
    }catch(e){ setStatus('Autosave unavailable — export a file'); }
  },420);
}
async function openProject(id){
  const d=await sGet(PKEY(id));
  if(!d||!d.screens||!d.screens.length){ setStatus('That project could not be loaded'); return; }
  projId=id; S=d; normalize(); cur=0; focusIdx=null; active={power:0,data:0};
  undoStack.length=0; redoStack.length=0; updateUndoUI();
  document.getElementById('focusBar').classList.add('hide');
  closeMask('pjModal');
  renderTabs(); setMode('layout'); renderSide(); fitView();
  setStatus('Opened '+(S.name||'project'));
  await sSet(CURKEY,id);
}
async function newProject(name){
  S=blankProject();
  if(name) S.name=name;
  projId=uid('p'); normalize(); cur=0; focusIdx=null; active={power:0,data:0};
  undoStack.length=0; redoStack.length=0; updateUndoUI();
  document.getElementById('focusBar').classList.add('hide');
  touchIndex();
  closeMask('pjModal');
  renderTabs(); setMode('layout'); renderSide(); fitView(); renderProjects();
  setStatus('New project — choose an LED panel in the sidebar');
  await sSet(PKEY(projId),S); await sSet(IDX,projIndex); await sSet(CURKEY,projId);
}
async function dupProject(id){
  const d=await sGet(PKEY(id)); if(!d) return;
  d.name=(d.name||'Untitled Project')+' copy';
  const nid=uid('p');
  await sSet(PKEY(nid),d);
  projIndex.unshift({id:nid,name:d.name,venue:d.venue||'',updated:Date.now(),
    screens:d.screens.length,tiles:rawTiles(d)});
  await sSet(IDX,projIndex);
  renderProjects(); setStatus('Duplicated');
}
async function renameProject(id){
  const e=projIndex.find(x=>x.id===id); if(!e) return;
  const n=prompt('Project name',e.name); if(n===null) return;
  const d=await sGet(PKEY(id)); if(!d) return;
  d.name=n.trim()||e.name; await sSet(PKEY(id),d);
  e.name=d.name; await sSet(IDX,projIndex);
  if(id===projId){ S.name=d.name; document.getElementById('projName').value=d.name; redraw(); }
  renderProjects();
}
async function deleteProject(id){
  const e=projIndex.find(x=>x.id===id); if(!e) return;
  if(!confirm(`Delete “${e.name}”?\n\nThis removes it from this browser for good. Export a file first if you want a copy.`)) return;
  await sDel(PKEY(id));
  await sbDelete(id);
  projIndex=projIndex.filter(x=>x.id!==id);
  await sSet(IDX,projIndex);
  if(id===projId){
    if(projIndex.length) await openProject(projIndex[0].id); else await newProject();
  }
  renderProjects(); setStatus('Deleted');
}
/* the app can hand you a clean copy of itself, ready to host or archive */
const DYNAMIC=['tabs','pjList','libList','bkBody','slots','pwSum','dtSum','totals','setTotals',
  'printSheet','lbPrev','cloudBar','cbNote','sbMsg','siMsg','exNote',
  'panelPick','procPick','panelWarn','procWarn','modeHint','libCount','lbCount','pmWarn','pmOuts','pmSlices','pmSelBox','pmOrient','pmSize','pmPx'];
function downloadApp(){
  try{
    const clone=document.documentElement.cloneNode(true);
    DYNAMIC.forEach(id=>{ const n=clone.querySelector('#'+id); if(n) n.innerHTML=''; });
    clone.querySelectorAll('.mask').forEach(n=>n.classList.add('hide'));
    const pmm=clone.querySelector('#pmModal'); if(pmm) pmm.classList.add('hide');
    const cv=clone.querySelector('#cv'); if(cv){ cv.removeAttribute('width'); cv.removeAttribute('height'); }
    clone.querySelectorAll('select').forEach(n=>n.innerHTML='');
    clone.querySelectorAll('input').forEach(n=>{
      if(n.type==='checkbox') n.removeAttribute('checked'); else n.removeAttribute('value');
    });
    const html='<!DOCTYPE html>\n'+clone.outerHTML;
    download(new Blob([html],{type:'text/html'}),'wall-mapper.html');
    setStatus('App file saved — drop it on a host, or keep it as a backup');
  }catch(e){ setStatus('Could not save the app file: '+e.message); }
}
