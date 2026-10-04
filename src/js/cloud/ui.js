/* ---- cloud UI ---- */
let authMode='signin';
function renderCloud(){
  const el=document.getElementById('cloudBar'); if(!el) return;
  if(!cloudOn()){
    el.innerHTML=`<span class="dot"></span><span>Projects are saved in this browser only.</span>
      <span class="sp2"></span><button class="btn sm" onclick="openCloudSetup()">Set up cloud sync…</button>`;
    return;
  }
  if(!signedIn()){
    el.innerHTML=`<span class="dot"></span><span>Cloud connected — not signed in.</span>
      <span class="sp2"></span>
      <button class="btn sm" onclick="openCloudSetup()">Settings</button>
      <button class="btn sm pri" onclick="openSignIn()">Sign in</button>`;
    return;
  }
  const t=syncing?'Syncing…':syncErr?'Offline — local only':(lastSync?'Synced '+agoTxt(lastSync):'Not synced yet');
  el.innerHTML=`<span class="dot ${syncErr?'err':'on'}"></span><span>${escp(SES.email||'Signed in')} · ${t}</span>
    <span class="sp2"></span>
    <button class="btn sm" onclick="sbSyncAll()">Sync now</button>
    <button class="btn sm" onclick="openCloudSetup()">Settings</button>
    <button class="btn sm" onclick="sbSignOut()">Sign out</button>`;
}
function openCloudSetup(){
  document.getElementById('sbSql').value=SB_SQL;
  document.getElementById('sbUrl').value=(SB&&SB.url)||'';
  document.getElementById('sbAnon').value=(SB&&SB.anon)||'';
  document.getElementById('sbMsg').textContent='';
  document.getElementById('sbModal').classList.remove('hide');
}
function copySql(){
  const t=document.getElementById('sbSql'); t.select();
  try{ document.execCommand('copy'); document.getElementById('sbMsg').textContent='SQL copied.'; }
  catch(e){ document.getElementById('sbMsg').textContent='Select the box and copy manually.'; }
}
async function testCloud(){
  const url=document.getElementById('sbUrl').value.trim().replace(/\/$/,'');
  const anon=document.getElementById('sbAnon').value.trim();
  const msg=document.getElementById('sbMsg');
  if(!url||!anon){ msg.textContent='Fill in the URL and key first.'; return; }
  msg.textContent='Testing…';
  const proto=(location&&location.protocol)||'';
  const framed=window.top!==window.self;
  try{
    const r=await fetch(url+'/rest/v1/projects?select=id&limit=1',{headers:{'apikey':anon}});
    if(r.status===200||r.status===401||r.status===403){
      msg.textContent='Reached Supabase — the URL and key look right.'
        +(r.status===200?' The table is there too.':' Sign in next; the table only answers to a signed-in user.');
    } else if(r.status===404){
      msg.textContent='Reached Supabase, but there is no projects table yet — run the SQL above in the SQL Editor.';
    } else {
      msg.textContent='Reached Supabase but it answered HTTP '+r.status+'. Check the key.';
    }
  }catch(e){
    msg.textContent=(proto==='file:')
      ? 'Blocked: the app is running from a local file, so the browser will not let it reach Supabase. Host the file at a web address and this goes away. Everything else in the app still works offline.'
      : framed
        ? 'Blocked: this page is inside a sandboxed frame. Open the file directly in a browser tab.'
        : 'Could not reach that URL. Check for a typo — it should look like https://abcdefgh.supabase.co';
  }
}
async function saveCloud(){
  const url=document.getElementById('sbUrl').value.trim().replace(/\/$/,'');
  const anon=document.getElementById('sbAnon').value.trim();
  const msg=document.getElementById('sbMsg');
  if(!/^https:\/\/.+\.supabase\.co$/i.test(url)){ msg.textContent='That URL should look like https://xxxx.supabase.co'; return; }
  if(/^sb_secret_/i.test(anon)){
    msg.textContent='That is a secret key — it bypasses row-level security and must never go in client code. Use the publishable key instead.';
    return;
  }
  const okNew=/^sb_publishable_.{10,}$/i.test(anon);
  const okOld=/^eyJ[\w-]{20,}\./.test(anon);
  if(!okNew&&!okOld){
    msg.textContent='That does not look like a publishable key (sb_publishable_…) or a legacy anon key (eyJ…).';
    return;
  }
  SB={url,anon}; await sSet(CFGKEY,SB);
  msg.textContent='Saved.'; closeMask('sbModal'); renderCloud();
  if(!signedIn()) openSignIn();
}
async function forgetCloud(){
  if(!confirm('Disconnect cloud sync on this browser?\n\nYour local projects stay put.')) return;
  SB=null; SES=null; _uid=null;
  await sSet(CFGKEY,null); await sSet(SESKEY,null);
  closeMask('sbModal'); renderCloud(); renderProjects();
}
function openSignIn(){
  authMode='signin'; swapAuth(true);
  document.getElementById('siMsg').textContent='';
  document.getElementById('siModal').classList.remove('hide');
  setTimeout(()=>document.getElementById('siEmail').focus(),40);
}
function swapAuth(keep){
  if(!keep) authMode=authMode==='signin'?'signup':'signin';
  const up=authMode==='signup';
  document.getElementById('siTitle').textContent=up?'Create an account':'Sign in';
  document.getElementById('siGo').textContent=up?'Create account':'Sign in';
  document.getElementById('siSwap').textContent=up?'I already have an account':'Create an account';
}
async function doAuth(){
  const em=document.getElementById('siEmail').value.trim();
  const pw=document.getElementById('siPass').value;
  const msg=document.getElementById('siMsg');
  if(!em||!pw){ msg.textContent='Email and password are both needed.'; return; }
  msg.textContent='Working…';
  try{
    await sbAuth(authMode,em,pw);
    _uid=null;
    closeMask('siModal'); renderCloud();
    await sbSyncAll();
  }catch(e){ msg.textContent=e.message; }
}
const agoTxt=t=>{
  const m=(Date.now()-t)/60000;
  if(m<1) return 'just now';
  if(m<60) return Math.round(m)+' min ago';
  if(m<1440) return Math.round(m/60)+' hr ago';
  const d=Math.round(m/1440);
  return d===1?'yesterday':d+' days ago';
};
function renderProjects(){
  const el=document.getElementById('pjList');
  if(!projIndex.length){ el.innerHTML='<div class="empty" style="padding:16px">No saved projects yet.</div>'; return; }
  el.innerHTML=projIndex.map(e=>`
    <div class="item ${e.id===projId?'sel':''}">
      <div class="main" onclick="openProject('${e.id}')" style="cursor:pointer">
        <div class="n">${escp(e.name)}${e.id===projId?' <span style="color:var(--ok);font-size:9.5px">· open</span>':''}</div>
        <div class="d">${e.venue?escp(e.venue)+' · ':''}${e.screens} screen${e.screens===1?'':'s'} · ${e.tiles} tiles · ${agoTxt(e.updated)}</div>
      </div>
      <button class="btn sm" onclick="renameProject('${e.id}')">Rename</button>
      <button class="btn sm" onclick="dupProject('${e.id}')">Duplicate</button>
      <button class="btn sm dgr" onclick="deleteProject('${e.id}')">Delete</button>
    </div>`).join('');
}
function exportJSON(){ download(new Blob([JSON.stringify(S,null,2)],{type:'application/json'}),fileBase()+'.json'); }
function importJSON(f){
  const inp=document.getElementById('imp');
  if(!f){ if(inp) inp.value=''; return; }
  setStatus('Reading '+f.name+'…');
  const rd=new FileReader();
  rd.onerror=()=>{ setStatus('Could not read that file'); if(inp) inp.value=''; };
  rd.onload=async()=>{
    let d;
    try{
      let txt=String(rd.result||'').replace(/^\uFEFF/,'').trim();   /* strip a BOM */
      d=JSON.parse(txt);
    }catch(e){
      setStatus('That file is not valid JSON — '+e.message);
      if(inp) inp.value=''; return;
    }
    try{
      if(Array.isArray(d)) d={name:f.name.replace(/\.json$/i,''),screens:d};
      if(d&&d.project&&d.project.screens) d=d.project;              /* tolerate a wrapper */
      if(!d||typeof d!=='object'||!Array.isArray(d.screens)||(!d.screens.length&&!d.opt)){
        setStatus('No screens found in that file — is it a Wall Mapper project?');
        if(inp) inp.value=''; return;
      }
      /* load it straight in, so a storage hiccup cannot lose the import */
      pushUndo('import project');
      const nid=uid('p');
      S=d; projId=nid;
      normalize();
      cur=0; focusIdx=null; active={power:0,data:0};
      undoStack.length=0; redoStack.length=0; updateUndoUI();
      document.getElementById('focusBar').classList.add('hide');
      closeMask('pjModal');
      renderTabs(); setMode('layout'); renderSide(); fitView();
      const meta={id:nid,name:S.name||f.name.replace(/\.json$/i,'')||'Imported project',
        venue:S.venue||'',updated:Date.now(),screens:S.screens.length,tiles:rawTiles(S)};
      S.name=meta.name;
      projIndex.unshift(meta);
      const okA=await sSet(PKEY(nid),S);
      const okB=await sSet(IDX,projIndex);
      await sSet(CURKEY,nid);
      renderProjects();
      setStatus(okA&&okB
        ? `Imported “${meta.name}” — ${S.screens.length} screen${S.screens.length===1?'':'s'}`
        : `Imported “${meta.name}” but it could not be saved to this browser`);
      if(cloudOn()&&signedIn()) sbSyncAll(true);
    }catch(e){
      console.error('import failed',e);
      setStatus('Import failed: '+e.message);
    }
    if(inp) inp.value='';                                            /* allow the same file again */
  };
  rd.readAsText(f);
}
document.getElementById('projName').addEventListener('input',e=>{S.name=e.target.value;redraw();save();});
document.getElementById('projVenue').addEventListener('input',e=>{S.venue=e.target.value;redraw();save();});

