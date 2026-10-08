/* ========================= NEW PROJECT SETUP ========================= */
/* Every new project starts here: voltage, panel and processor have to be picked before it
   exists. The library dialog fills the draft while this is open (see libDraft). */
let libDraft=null, nwReplace=null;
function openSetup(forced,visit){
  libDraft={panelId:'',procId:'',custom:null};
  nwReplace=forced?projId:null;                 /* first run: the placeholder project is swapped out */
  ['nwName','nwVenue'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('nwVolts').value='';
  document.getElementById('nwAmps').value=20;
  document.getElementById('nwBasis').value='max80';
  document.getElementById('nwBits').value='8'; document.getElementById('nwFeed').value='auto';
  const cb=document.getElementById('nwCancel');
  cb.style.display=forced?'none':'';
  const nm=S&&S.name||'', short=nm.length>28?nm.slice(0,26).trim()+'…':nm;
  cb.textContent=visit&&nm?'Open “'+short+'”':'Cancel';
  cb.title=visit&&nm?'Open '+nm:'';   /* on a visit, skip back to the last project */
  document.getElementById('nwProjects').style.display=visit&&projIndex.length>1?'':'none';
  closeMask('pjModal');
  document.getElementById('nwModal').classList.remove('hide');
  nwCheck(); setTimeout(()=>document.getElementById('nwName').focus(),30);
}
const nwCancelable=()=>document.getElementById('nwCancel').style.display!=='none';
function nwDismiss(){ libDraft=null; nwReplace=null; closeMask('nwModal'); }
const nwPanel=()=>libDraft&&(libDraft.custom&&libDraft.custom.id===libDraft.panelId?libDraft.custom:panelById(libDraft.panelId));
function nwCheck(){
  const p=nwPanel(), pr=libDraft&&procById(libDraft.procId);
  document.getElementById('nwPanel').innerHTML=p
    ? `<span class="t">${escp(p.brand+' '+p.model)}</span><span class="s">${p.pitch} mm · ${p.pw}×${p.ph} px · ${p.wmax}W max</span>`
    : '<span class="t" style="color:var(--ac)">Choose an LED panel…</span>';
  document.getElementById('nwProc').innerHTML=pr
    ? `<span class="t">${escp((pr.brand?pr.brand+' ':'')+pr.model)}</span><span class="s">${pr.total?pr.ports+' ports · '+(pr.pp/1000).toFixed(0)+'k px each at 8-bit':'no capacity check'}</span>`
    : '<span class="t" style="color:var(--ac)">Choose a processor…</span>';
  const miss=[];
  if(!document.getElementById('nwName').value.trim()) miss.push('a project name');
  if(!document.getElementById('nwVolts').value) miss.push('a voltage');
  if(!(+document.getElementById('nwAmps').value>0)) miss.push('a breaker size');
  if(!p) miss.push('an LED panel');
  if(!pr) miss.push('a processor');
  document.getElementById('nwMsg').textContent=miss.length?'Still needed: '+miss.join(', ')+'.':'Ready to go.';
  document.getElementById('nwGo').disabled=!!miss.length;
  return !miss.length;
}
async function nwCreate(){
  if(!nwCheck()) return;
  const g=id=>document.getElementById(id).value, basis=g('nwBasis'), old=nwReplace, d=libDraft;
  closeMask('nwModal'); libDraft=null; nwReplace=null;
  await newProject(g('nwName').trim(),{
    venue:g('nwVenue').trim(), volts:+g('nwVolts'), breaker:+g('nwAmps'),
    useAvg:basis.startsWith('avg'), derate:basis.endsWith('80'), bits:+g('nwBits'),
    panelId:d.panelId, procId:d.procId, custom:d.custom, feed:g('nwFeed')});
  if(old&&old!==projId){
    projIndex=projIndex.filter(e=>e.id!==old);
    await sDel(PKEY(old)); await sSet(IDX,projIndex);
  }
}
