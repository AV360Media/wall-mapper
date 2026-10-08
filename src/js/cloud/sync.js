/* ========================= CLOUD SYNC (Supabase REST) ========================= */
const CFGKEY='wm:cloud', SESKEY='wm:session';
let SB=null, SES=null, syncing=false, lastSync=0, syncErr=null;

const SB_SQL=`create table if not exists public.projects (
  id         text        not null,
  user_id    uuid        not null references auth.users on delete cascade,
  name       text,
  venue      text,
  data       jsonb       not null,
  updated    bigint      not null,
  primary key (user_id, id)
);

alter table public.projects enable row level security;

drop policy if exists "own projects" on public.projects;
create policy "own projects" on public.projects
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);`;

async function loadCloud(){
  SB=await sGet(CFGKEY); SES=await sGet(SESKEY);
  if(SB&&!SB.url) SB=null;
}
const cloudOn=()=>!!(SB&&SB.url&&SB.anon);
const signedIn=()=>!!(SES&&SES.access_token);

async function sbCall(path,opt){
  opt=opt||{};
  const h=Object.assign({'apikey':SB.anon,'Content-Type':'application/json'},opt.headers||{});
  if(SES&&SES.access_token&&!opt.noAuth) h['Authorization']='Bearer '+SES.access_token;
  let r=await fetch(SB.url.replace(/\/$/,'')+path,{method:opt.method||'GET',headers:h,body:opt.body});
  if(r.status===401&&SES&&SES.refresh_token&&!opt.noAuth&&!opt.retried){
    if(await sbRefresh()) return sbCall(path,Object.assign({},opt,{retried:1}));
  }
  return r;
}
async function sbRefresh(){
  try{
    const r=await fetch(SB.url.replace(/\/$/,'')+'/auth/v1/token?grant_type=refresh_token',
      {method:'POST',headers:{'apikey':SB.anon,'Content-Type':'application/json'},
       body:JSON.stringify({refresh_token:SES.refresh_token})});
    if(!r.ok) return false;
    const d=await r.json();
    SES={access_token:d.access_token,refresh_token:d.refresh_token,
         email:(d.user&&d.user.email)||SES.email};
    await sSet(SESKEY,SES); return true;
  }catch(e){ return false; }
}
function netHint(){
  const p=(location&&location.protocol)||'';
  if(p==='file:') return 'The app is open as a local file, so the browser blocks outside connections before they are sent. Put the file at a web address (Netlify Drop, Cloudflare Pages or GitHub Pages are all free) and cloud sync will work.';
  if(window.top!==window.self) return 'The page is running inside a sandboxed frame that blocks outside connections. Open the file directly in a browser tab instead.';
  return 'Could not reach Supabase. Check the Project URL, and that you are online.';
}
async function sbAuth(mode,email,password){
  if(!cloudOn()) throw new Error('Add your Supabase URL and key first');
  const path=mode==='signup'?'/auth/v1/signup':'/auth/v1/token?grant_type=password';
  let r;
  try{
    r=await fetch(SB.url.replace(/\/$/,'')+path,
      {method:'POST',headers:{'apikey':SB.anon,'Content-Type':'application/json'},
       body:JSON.stringify({email,password})});
  }catch(e){ throw new Error(netHint()); }
  const d=await r.json().catch(()=>({}));
  if(!r.ok){
    const raw=(d.msg||d.error_description||d.message||d.error||'Sign in failed');
    const code=(d.error_code||d.code||'')+'';
    if(/email_not_confirmed/i.test(code)||/not confirmed/i.test(raw))
      throw new Error('That account exists but the email is not confirmed yet. Click the link Supabase emailed you, or turn off Authentication → Sign In / Providers → Email → Confirm email.');
    if(/invalid login credentials/i.test(raw))
      throw new Error('Supabase rejected that. Most often the account is created but the email is not confirmed yet — check your inbox, or add yourself under Authentication → Users with Auto Confirm ticked. If you have never signed up on this project, use Create an account first.');
    if(/user already registered/i.test(raw))
      throw new Error('That email is already registered — switch to Sign in.');
    throw new Error(raw);
  }
  if(!d.access_token) throw new Error(mode==='signup'
    ? 'Account created. Supabase has emailed you a confirmation link — click it, then sign in. To skip this, turn off Confirm email under Authentication → Sign In / Providers → Email.'
    : 'No session returned');
  SES={access_token:d.access_token,refresh_token:d.refresh_token,email:(d.user&&d.user.email)||email};
  await sSet(SESKEY,SES);
  return SES;
}
async function sbSignOut(){ SES=null; await sSet(SESKEY,null); renderCloud(); renderProjects(); }

function isUntouched(d){
  try{
    if(!d.screens||d.screens.length!==1) return false;
    const s0=d.screens[0];
    if(s0.panelId) return false;
    if((d.name||'Untitled Project')!=='Untitled Project') return false;
    if(d.venue) return false;
    const any=[...(s0.circuits||[]),...(s0.runs||[])].some(c=>c.tiles&&c.tiles.length);
    return !any;
  }catch(e){ return false; }
}
async function sbSyncAll(quiet){
  if(!cloudOn()||!signedIn()||syncing) return;
  syncing=true; renderCloud();
  try{
    const r=await sbCall('/rest/v1/projects?select=id,name,venue,updated');
    if(!r.ok) throw new Error('Could not reach your table (HTTP '+r.status+')');
    const remote=await r.json();
    const rMap={}; remote.forEach(x=>rMap[x.id]=x);
    let pulled=0, pushed=0;

    /* pull anything newer or missing locally */
    for(const x of remote){
      const loc=projIndex.find(e=>e.id===x.id);
      if(loc&&loc.updated>=x.updated) continue;
      const rr=await sbCall('/rest/v1/projects?select=data&id=eq.'+encodeURIComponent(x.id));
      if(!rr.ok) continue;
      const rows=await rr.json();
      if(!rows.length||!rows[0].data) continue;
      const d=rows[0].data;
      await sSet(PKEY(x.id),d);
      const meta={id:x.id,name:x.name||d.name||'Untitled Project',venue:x.venue||d.venue||'',
        updated:x.updated,screens:(d.screens||[]).length,tiles:rawTiles(d)};
      const i=projIndex.findIndex(e=>e.id===x.id);
      if(i>=0) projIndex[i]=meta; else projIndex.push(meta);
      pulled++;
      if(x.id===projId){ S=d; normalize(); cur=Math.max(0,Math.min(cur,S.screens.length-1)); exitFocus();
        renderTabs(); setMode('layout'); renderSide(); redraw(); }
    }
    /* push anything newer or missing remotely */
    for(const e of projIndex.slice()){
      const rem=rMap[e.id];
      if(rem&&rem.updated>=e.updated) continue;
      const d=(e.id===projId)?S:await sGet(PKEY(e.id));
      if(!d) continue;
      const uid2=await sbUserId(); if(!uid2) break;
      const pr=await sbCall('/rest/v1/projects',{method:'POST',
        headers:{'Prefer':'resolution=merge-duplicates,return=minimal'},
        body:JSON.stringify({id:e.id,user_id:uid2,name:e.name,venue:e.venue,data:d,updated:e.updated})});
      if(pr.ok) pushed++;
    }
    /* a brand-new browser makes a blank starter project — drop it once real ones arrive */
    if(pulled&&projIndex.length>1){
      for(const e of projIndex.slice()){
        if(e.id===projId&&projIndex.length<2) continue;
        const d=(e.id===projId)?S:await sGet(PKEY(e.id));
        if(!d||!isUntouched(d)) continue;
        if(projIndex.filter(x=>x.id!==e.id).length===0) continue;
        await sDel(PKEY(e.id));
        projIndex=projIndex.filter(x=>x.id!==e.id);
        if(e.id===projId){
          const nxt=projIndex[0];
          if(nxt){ const nd=await sGet(PKEY(nxt.id));
            if(nd){ projId=nxt.id; S=nd; normalize(); cur=0;
              renderTabs(); setMode('layout'); renderSide(); fitView(); } }
        }
      }
    }
    projIndex.sort((a,b)=>b.updated-a.updated);
    await sSet(IDX,projIndex);
    lastSync=Date.now();
    syncErr=null;
    if(!quiet) setStatus(`Synced — ${pulled} down, ${pushed} up`);
  }catch(e){
    syncErr=/fetch/i.test(e.message)?netHint():e.message;
    setStatus('Working offline — '+syncErr);
  }finally{ syncing=false; renderCloud(); renderProjects(); }
}
let _uid=null;
async function sbUserId(){
  if(_uid) return _uid;
  try{
    const r=await sbCall('/auth/v1/user');
    if(!r.ok) return null;
    const d=await r.json(); _uid=d.id; return _uid;
  }catch(e){ return null; }
}
async function sbDelete(id){
  if(!cloudOn()||!signedIn()) return;
  try{ await sbCall('/rest/v1/projects?id=eq.'+encodeURIComponent(id),{method:'DELETE'}); }catch(e){}
}

