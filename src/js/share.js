/* ========================= CREW LINK ========================= */
/* The whole project rides in the link itself (compressed, after #), so no server or sign-in is
   needed and nothing is uploaded anywhere. Opening it shows a phone-friendly, view-only page. */
let VIEWONLY=false;
const b64u=a=>{ let s=''; for(let i=0;i<a.length;i+=0x8000) s+=String.fromCharCode.apply(null,a.subarray(i,i+0x8000));
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); };
const unb64u=t=>{ const b=atob(t.replace(/-/g,'+').replace(/_/g,'/')), a=new Uint8Array(b.length); for(let i=0;i<b.length;i++) a[i]=b.charCodeAt(i); return a; };
async function zpipe(bytes,T){ return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new T('deflate-raw'))).arrayBuffer()); }
async function packProject(d){
  const raw=new TextEncoder().encode(JSON.stringify(d));
  if(window.CompressionStream) return 'z'+b64u(await zpipe(raw,CompressionStream));
  return 'j'+b64u(raw);
}
async function unpackProject(t){
  const raw=t[0]==='z'?await zpipe(unb64u(t.slice(1)),DecompressionStream):unb64u(t.slice(1));
  return JSON.parse(new TextDecoder().decode(raw));
}
async function openShare(){
  if(needScreen()) return;
  closeMenus();
  const d=JSON.parse(JSON.stringify(S)); d.shared=Date.now();
  const link=location.origin+location.pathname+'#v='+await packProject(d);
  const g=id=>document.getElementById(id);
  g('shLink').value=link;
  g('shOpen').href=link;
  g('shNote').textContent=`A snapshot of “${S.name||'this project'}” as it is now (${(link.length/1024).toFixed(0)} KB link). Send a new link after you make changes.`
    +(link.length>60000?' This is a long link: if a messaging app cuts it off, email it instead.':'');
  g('shModal').classList.remove('hide');
  setTimeout(()=>{ g('shLink').focus(); g('shLink').select(); },40);
}
async function copyShare(){
  const el=document.getElementById('shLink');
  try{ await navigator.clipboard.writeText(el.value); setStatus('Crew link copied'); }
  catch(e){ el.select(); document.execCommand('copy'); setStatus('Crew link copied'); }
}
/* ---- the crew page ---- */
let crewTab='overview', crewImgs={};
async function crewBoot(){
  const m=/^#v=(.+)$/.exec(location.hash); if(!m) return false;
  let d;
  try{ d=await unpackProject(m[1]); }catch(e){ console.error(e); }
  if(!d||!Array.isArray(d.screens)){
    document.body.innerHTML='<div style="font:15px Outfit,sans-serif;padding:40px 20px;color:#888;text-align:center">This crew link is damaged or incomplete. Ask for it to be sent again.</div>';
    return true;
  }
  VIEWONLY=true; S=d; projId=null; normalize(); cur=0; focusIdx=null;
  window.addEventListener('keydown',e=>e.stopImmediatePropagation(),true);   /* nothing in the editor reacts here */
  document.title=(S.name||'Project')+' · Crew view';
  const el=document.createElement('div'); el.id='crew'; document.body.appendChild(el);
  document.body.classList.add('crewmode');
  crewRender();
  return true;
}
function crewTabs(){
  const t=[['overview','Overview']];
  S.screens.forEach((s,i)=>t.push(['s'+i,s.name||'Screen '+(i+1)]));
  t.push(['cables','Cables']);
  if(S.screens.some(x=>panelById(x.panelId))) t.push(['pixels','Pixel map']);
  return t;
}
async function crewPics(k){
  if(crewImgs[k]) return crewImgs[k];
  const out=[];
  withPrint(()=>{ XO=Object.assign({},expOf());
    try{
      if(k==='overview'){
        if(S.screens.length>1){ out.push(['Data',setCanvas('data')]); out.push(['Power',setCanvas('power')]); }
        if(S.screens.some(bent)) out.push(['Plan view',planCanvas()]);
        out.push(['Summary',summaryCanvas()]);
      } else if(k==='cables') out.push(['Cable schedule',scheduleCanvas()]);
      else if(k==='pixels') out.push(['Pixel map',pmOverviewCanvas(pmBuild())]);
      else { const s=S.screens[+k.slice(1)]; if(s) out.push([s.name,pairCanvas(s)]); }
    } finally { XO=null; } });
  const urls=await Promise.all(out.map(([t,c])=>new Promise(ok=>c.toBlob(b=>ok([t,URL.createObjectURL(b)]),'image/png'))));
  return crewImgs[k]=urls;
}
function crewFacts(s){
  const t=totals(s), p=panelById(s.panelId), v=viewDist(s), rows=[];
  rows.push(['Panel',p?`${p.brand} ${p.model}`:'—'],['Grid',`${s.cols} × ${s.rows} · ${t.tiles} tiles`],
    ['Size',t.wmm?`${ftIn(t.wmm)} × ${ftIn(t.hmm)}`:'—'],['Resolution',`${t.resW} × ${t.resH}`],
    ['Processor',unitLabel(unitOf(s))],['Weight',t.lb?lbFmt(t.lb):'—']);
  if(bent(s)) rows.push(['Curve',curveText(s)]);
  if(v) rows.push(['Closest view',ftR(v.min)]);
  const pw=used(s,'power').map(ch=>`<li><i style="background:${ch.color}"></i><b>${escp(ch.name)}</b><span>${LT(s,ch).length} tiles · ${circuitCalc(s,ch).amps.toFixed(1)} A</span></li>`).join('');
  const dt=used(s,'data').map(ch=>`<li><i style="background:${ch.color}"></i><b>${escp(ch.name)}</b><span>${escp(portShort(s,ch))} · ${LT(s,ch).length} tiles</span></li>`).join('');
  return `<dl class="cw-facts">${rows.map(([a,b])=>`<dt>${a}</dt><dd>${escp(b)}</dd>`).join('')}</dl>`
    +(pw?`<h3>Power circuits</h3><ul class="cw-list">${pw}</ul>`:'')+(dt?`<h3>Data runs</h3><ul class="cw-list">${dt}</ul>`:'');
}
function crewRender(){
  const el=document.getElementById('crew'), tabs=crewTabs();
  if(!tabs.some(t=>t[0]===crewTab)) crewTab='overview';
  const when=S.shared?new Date(S.shared).toLocaleString([], {dateStyle:'medium',timeStyle:'short'}):'';
  el.innerHTML=`<header class="cw-h">
      <div class="cw-k">Wall Mapper · crew view</div>
      <h1>${escp(S.name||'Untitled Project')}</h1>
      <div class="cw-v">${escp([S.venue,when&&'shared '+when].filter(Boolean).join(' · '))}</div>
      <button class="btn sm" onclick="crewSave()">Save a copy to edit</button>
    </header>
    <nav class="cw-tabs">${tabs.map(([k,l])=>`<button class="${k===crewTab?'on':''}" onclick="crewGo('${k}')">${escp(l)}</button>`).join('')}</nav>
    <main id="cwBody"><div class="cw-wait">Drawing…</div></main>`;
  const on=el.querySelector('.cw-tabs .on'); if(on) on.scrollIntoView({block:'nearest',inline:'center'});
  setTimeout(async()=>{
    const body=document.getElementById('cwBody'), want=crewTab; if(!body) return;
    let html='';
    if(crewTab[0]==='s'){ const s=S.screens[+crewTab.slice(1)]; if(s) html+=crewFacts(s); }
    else if(crewTab==='overview'){ const st=setTotalsCalc();
      html+=`<dl class="cw-facts"><dt>Screens</dt><dd>${S.screens.length}</dd><dt>Tiles</dt><dd>${st.tiles}</dd>
        <dt>Weight</dt><dd>${st.lb?lbFmt(st.lb):'—'}</dd><dt>Load</dt><dd>${(st.wMax/1000).toFixed(1)} kW max</dd>
        <dt>Circuits / runs</dt><dd>${st.circ} / ${st.runs}</dd></dl>`; }
    const pics=await crewPics(want); if(want!==crewTab) return;
    pics.forEach(([t,u])=>{ html+=`<figure><figcaption>${escp(t)}<a href="${u}" target="_blank" rel="noopener">Full size</a></figcaption><img src="${u}" alt="${escp(t)}" /></figure>`; });
    body.innerHTML=html||'<div class="cw-wait">Nothing to show yet.</div>';
  },30);
}
function crewGo(k){ crewTab=k; crewRender(); window.scrollTo({top:0}); }
async function crewSave(){
  try{
    const nid=uid('p'), d=JSON.parse(JSON.stringify(S)); delete d.shared;
    const idx=(await sGet(IDX))||[];
    idx.unshift({id:nid,name:d.name||'Shared project',venue:d.venue||'',updated:Date.now(),screens:d.screens.length,tiles:rawTiles(d)});
    if(!await sSet(PKEY(nid),d)||!await sSet(IDX,idx)) throw new Error('storage unavailable');
    await sSet(CURKEY,nid);
    location.href=location.pathname;
  }catch(e){ alert('Could not save a copy in this browser: '+e.message); }
}
