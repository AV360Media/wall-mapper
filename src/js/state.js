/* ========================= STATE ========================= */
let S=null, cur=0, mode='layout', active={power:0,data:0};
let paint=null, panning=null, moving=null;
let view={k:1,x:0,y:0}, libKind='panel', spaceDown=false;
let focusIdx=null, prevView=null, dragGuides=[];
let XO=null, expDraft=null;      /* XO = export overrides, only set while rendering a PDF */
const defExp=()=>({show:'',venue:'',author:'',date:'',rev:'',
  pSet:true,pScreens:true,pSummary:true,pCable:true,
  nums:true,refs:true,legend:true,hops:false,backup:true,weight:true,load:true,
  paper:'letter',orient:'auto',cover:true,split:true,bw:false});
const expOf=()=>(S.exp=Object.assign(defExp(),S.exp||{}));
/* published port figures are 8-bit; higher depths cost bandwidth proportionally */
const BITF={8:1,10:0.8,12:2/3};
const bitDepth=()=>((S.opt&&S.opt.bits)||8);
const bitFactor=()=>BITF[bitDepth()]||1;
const portCap=pr=>Math.round((pr.pp||0)*bitFactor());
const pxN=n=>Math.round(n).toLocaleString('en-US');   /* exact pixel counts, as the spec sheets print them */
const procCap=pr=>Math.round((pr.total||0)*bitFactor());
const wantWeight=()=>!XO||XO.weight;
const wantLoad=()=>!XO||XO.load;
const titleShow=()=>(XO&&XO.show)||S.name||'Untitled Project';
const titleVenue=()=>(XO&&XO.venue)||S.venue||'';
const titleDate=()=>(XO&&XO.date)||new Date().toLocaleDateString();
let undoStack=[], redoStack=[];

const uid=p=>p+Math.random().toString(36).slice(2,8);
const sc=()=>S.screens[cur];
const opt=()=>S.opt;
const panelById=id=>id?(PANELS.concat(S.customPanels||[]).find(p=>p.id===id)||null):null;
const procById=id=>id?(PROCS.find(p=>p.id===id)||null):null;
const NOPROC={id:'none',brand:'',model:'No processor',total:0,ports:0,pp:0,pt:'',v:1};
const procOf=s=>unitProc(unitOf(s));
const key=(r,c)=>r+':'+c;
const isOff=(s,r,c)=>s.off.includes(key(r,c));
const chains=(s,k)=>k==='power'?s.circuits:s.runs;
const chainOf=(s,k,t)=>chains(s,k).find(ch=>ch.tiles.includes(t)&&isLive(s,t));
const chainPos=(ch,t,s)=>(s?LT(s,ch):ch.tiles).indexOf(t)+1;
const used=(s,kind)=>chains(s,kind).filter(ch=>LT(s,ch).length);
/* how many processor units this screen needs, and which unit/port each run lands on */
/* ---- Processor units live at the project level. Each screen feeds from one,
   and ports count straight through every screen on that unit. ---- */
function units(){ return (S.procs=S.procs||[]); }
function unitOf(sn){
  const U=units();
  return U.find(u=>sn&&u.id===sn.procRef) || U[0] || null;
}
function unitProc(u){ return (u&&procById(u.procId))||NOPROC; }
const procOfUnit=unitProc;
function unitLabel(u){
  if(!u) return 'No processor';
  const pr=unitProc(u);
  return u.name || (pr.id==='none'?'No processor':pr.model);
}
function addUnit(procId,name){
  const U=units(), pr=procById(procId)||NOPROC;
  const n=U.filter(x=>x.procId===procId).length+1;
  const u={id:uid('u'),procId:procId||'none',name:name||((pr.id==='none'?'Processor':pr.model)+' #'+n)};
  U.push(u); return u;
}
/* every used run gets the next free port on its screen's unit */
/* A slot IS a port on the unit. Screens sharing a processor share its ports,
   so a port claimed by one screen is unavailable to the others. */
const runInUse=(sn,r)=>!!(LT(sn,r).length||isBackupRun(sn,r));
function portOwner(u,i,except){
  if(!u) return null;
  for(const sn of S.screens){
    if(unitOf(sn)!==u||sn===except) continue;
    const r=sn.runs[i];
    if(r&&runInUse(sn,r)) return sn;
  }
  return null;
}
function portAlloc(){
  const map={};
  S.screens.forEach(sn=>{
    const u=unitOf(sn); if(!u) return;
    sn.runs.forEach((r,i)=>{ if(runInUse(sn,r)) map[sn.id+'|'+r.id]={u,port:i+1}; });
  });
  return map;
}
function unitLoad(u){
  const seen=new Set(); let used=0, px=0;
  S.screens.forEach(sn=>{
    if(unitOf(sn)!==u) return;
    sn.runs.forEach((r,i)=>{
      if(!runInUse(sn,r)||seen.has(i)) return;
      seen.add(i); used++; px+=runCalc(sn,r).px;
    });
  });
  const pr=unitProc(u);
  return {used,px,ports:pr.ports||0,over:used>(pr.ports||0),
    cap:procCap(pr),capOver:pr.total?px>procCap(pr):false};
}
function procUnits(s){ return 1; }
function portOf(s,ch){
  const man=(s.portMap||{})[ch.id];
  if(man) return {port:man.p,u:unitOf(s),manual:true};
  return portAlloc()[s.id+'|'+ch.id]||null;
}
/* a run is named for the port it actually lands on */
function runName(s,ch){ return ch.name; }
function portLabel(s,ch){
  const q=portOf(s,ch); if(!q) return '';
  return `${unitLabel(q.u)} · Port ${q.port}`;
}
function portShort(s,ch){
  const q=portOf(s,ch); if(!q) return '';
  return units().length>1?`${unitLabel(q.u)} P${q.port}`:`Port ${q.port}`;
}
const bkOf=s=>(s.backup||(s.backup={mode:'none',pairs:{},procId:''}));
const backupFor=(s,ch)=>{const id=bkOf(s).pairs[ch.id];return id?s.runs.find(r=>r.id===id):null;};
const isBackupRun=(s,ch)=>bkOf(s).mode==='port'&&!devBkUnit(s)&&Object.keys(bkOf(s).pairs).some(k=>bkOf(s).pairs[k]===ch.id);
/* Device backup belongs to the processor, so every screen on it is mirrored. */
function devBkUnit(s){
  const u=unitOf(s);
  return (u&&u.bkUnit)?(units().find(x=>x.id===u.bkUnit)||null):null;
}
const isBkUnit=u=>units().some(x=>x.bkUnit===u.id);
const bkFor=u=>units().find(x=>x.bkUnit===u.id)||null;
function bkMode(s){
  if(devBkUnit(s)) return 'device';
  return bkOf(s).mode==='port'?'port':'none';
}
function bkDeviceName(s){
  const u=devBkUnit(s);
  return u?unitLabel(u):'backup processor';
}
function backupCount(s){
  const bk=bkOf(s);
  if(bkMode(s)==='device') return 1;
  if(bkMode(s)==='port') return used(s,'data').filter(ch=>backupFor(s,ch)).length;
  return 0;
}
const IN=mm=>mm/25.4;
function ftIn(mm){
  let t=Math.round((mm/25.4)*10)/10, f=Math.floor(t/12), r=t-f*12;
  if(r>=11.95){f++;r=0;}
  return f?`${f}'-${(Math.round(r*10)/10).toFixed(1).replace(/\.0$/,'')}"`:`${t.toFixed(1)}"`;
}
const lbFmt=v=>v>=1000?Math.round(v).toLocaleString()+' lb':v.toFixed(0)+' lb';
const escp=t=>String(t==null?'':t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const visible=()=>focusIdx!=null?[S.screens[focusIdx]]:S.screens;

function makeSlots(kind){
  const pal=kind==='power'?PW_PAL:DT_PAL, pre=kind==='power'?'C':'P';
  return Array.from({length:SLOTS},(_,i)=>({id:kind+(i+1),name:pre+(i+1),color:pal[i],port:i+1,tiles:[]}));
}
function blankScreen(n,x,y){
  return {id:uid('s'),name:'Screen '+n,panelId:'',procId:'',
    rows:4,cols:8,off:[],circuits:makeSlots('power'),runs:makeSlots('data'),
    backup:{mode:'none',pairs:{},procId:''},units:0,portMap:{},x:x||0,y:y||0};
}
const blankProject=()=>({name:'Untitled Project',venue:'',customPanels:[],
  opt:{volts:120,breaker:20,derate:true,useAvg:false,rear:false,showPower:true,showData:false,detail:'standard',snap:true,ui:'indigo',bits:8,procShared:true},
  screens:[blankScreen(1,0,0)]});

function normalize(){
  S.opt=Object.assign({volts:120,breaker:20,derate:true,useAvg:false,rear:false,
    showPower:true,showData:false,detail:'standard',snap:true,ui:'indigo',bits:8,procShared:true},S.opt||{});
  if(!BITF[S.opt.bits]) S.opt.bits=8;
  S.exp=Object.assign(defExp(),S.exp||{});
  if(!THEMES[S.opt.ui]) S.opt.ui='indigo';
  applyTheme(S.opt.ui);
  if(S.opt.showPower&&S.opt.showData) S.opt.showData=false;
  if(!S.opt.showPower&&!S.opt.showData) S.opt.showPower=true;
  let nx=0;
  S.screens.forEach(s=>{
    s.off=s.off||[];
    ['volts','breaker','derate','useAvg','rear','showPower','showData','detail'].forEach(f=>{ if(s[f]!==undefined) delete s[f]; });
    ['circuits','runs'].forEach(f=>{
      const kind=f==='circuits'?'power':'data', fresh=makeSlots(kind), old=s[f]||[];
      old.forEach((ch,j)=>{ if(j<SLOTS&&ch&&ch.tiles){ fresh[j].tiles=ch.tiles.slice(); if(ch.name) fresh[j].name=ch.name; } });
      s[f]=fresh;
    });
    s.backup=Object.assign({mode:'none',pairs:{},procId:'',unitRef:''},s.backup||{});
    s.units=s.units|0; s.portMap=s.portMap||{};
    if(!s.procRef){
      const U=units();
      let u=U.find(x=>x.procId===(s.procId||'none'));
      if(!u) u=addUnit(s.procId||'none');
      s.procRef=u.id;
    }
    cabOf();
    const ids=new Set(s.runs.map(r=>r.id));
    Object.keys(s.backup.pairs).forEach(k=>{ if(!ids.has(k)||!ids.has(s.backup.pairs[k])) delete s.backup.pairs[k]; });
    if(typeof s.x!=='number'||typeof s.y!=='number'){ s.x=nx; s.y=0; }
    if(s.curve&&!s.joints){ s.locks=[Math.abs(+s.curve)]; s.joints=Array(Math.max(0,s.cols-1)).fill(Math.sign(+s.curve)); }   /* one even curve, from an earlier build */
    delete s.curve;
    pruneChains(s);
    nx=Math.max(nx,s.x+sbox(s).w+SETGAP);
  });
}
function allTiles(s){const o=[];for(let r=0;r<s.rows;r++)for(let c=0;c<s.cols;c++)if(!isOff(s,r,c))o.push(key(r,c));return o;}
const tileCount=s=>allTiles(s).length;
/* Resizing and switching tiles off is NON-DESTRUCTIVE: a chain keeps its full
   tile list and everything downstream reads the live subset, so shrinking a
   grid and growing it back restores the mapping exactly. */
function inGrid(s,t){const[r,c]=t.split(':').map(Number);return r>=0&&r<s.rows&&c>=0&&c<s.cols;}
const isLive=(s,t)=>inGrid(s,t)&&!s.off.includes(t);
function LT(s,ch){ return (ch&&ch.tiles?ch.tiles:[]).filter(t=>isLive(s,t)); }
function pruneChains(s){ /* kept for compatibility — no longer destructive */ }
function hardPrune(s){
  const live=new Set(allTiles(s));
  [...s.circuits,...s.runs].forEach(ch=>ch.tiles=ch.tiles.filter(t=>live.has(t)));
}

