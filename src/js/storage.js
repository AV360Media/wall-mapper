/* ========================= STORAGE ========================= */
/* Inside a claude.ai artifact, window.storage keeps the projects. Opened anywhere else (a local
   file, a web host) the same keys go to IndexedDB, or to localStorage if IndexedDB is blocked.
   Every backend stores the same JSON strings under the same keys. */
/* index.test.html shares an origin with index.html once published, so it keeps its projects
   in its own store; a test build can never touch production projects */
const TESTBUILD=/\.test\.html$/.test(location.pathname);
const KV=(()=>{
  if(window.storage) return {
    get:async k=>{ const r=await window.storage.get(k,false); return r&&r.value; },
    set:(k,v)=>window.storage.set(k,v,false), del:k=>window.storage.delete(k,false) };
  const open=new Promise((ok,no)=>{
    const r=indexedDB.open(TESTBUILD?'wall-mapper-test':'wall-mapper',1);
    r.onupgradeneeded=()=>r.result.createObjectStore('kv');
    r.onsuccess=()=>ok(r.result); r.onerror=()=>no(r.error);
  });
  const req=(db,mode,fn)=>new Promise((ok,no)=>{
    const q=fn(db.transaction('kv',mode).objectStore('kv')); q.onsuccess=()=>ok(q.result); q.onerror=()=>no(q.error);
  });
  const pick=open.then(db=>({
    get:k=>req(db,'readonly',s=>s.get(k)), set:(k,v)=>req(db,'readwrite',s=>s.put(v,k)), del:k=>req(db,'readwrite',s=>s.delete(k)) }),
    ()=>{ const P=TESTBUILD?'test:':''; return { get:async k=>localStorage.getItem(P+k), set:async(k,v)=>localStorage.setItem(P+k,v), del:async k=>localStorage.removeItem(P+k) }; });
  return { get:k=>pick.then(b=>b.get(k)), set:(k,v)=>pick.then(b=>b.set(k,v)), del:k=>pick.then(b=>b.del(k)) };
})();

let storeOK=true;
async function sGet(k){
  try{ const v=await KV.get(k); return v?JSON.parse(v):null; }
  catch(e){ return null; }
}
async function sSet(k,v){
  try{ await KV.set(k,JSON.stringify(v)); return true; }
  catch(e){
    if(storeOK){ storeOK=false; setStatus('Saving to this browser is unavailable — use Export current'); }
    return false;
  }
}
async function sDel(k){ try{ await KV.del(k); }catch(e){} }
