/* ========================= PIXEL MAP ========================= */
/* Turns the set into a Resolume-style pixel map: a composition laid out like the stage,
   and outputs packed so every processor gets exactly one input. Units are pixels. */
const PM_PRESETS={
  tb6k:{w:6144,h:3456,label:'Mac Thunderbolt (6K)'},
  hdmi8k:{w:7680,h:4320,label:'HDMI 8K'},
  uhd:{w:3840,h:2160,label:'4K output'},
  custom:{w:0,h:0,label:'Custom'}
};
const PM_COLS=['#226ec8','#009678','#d27800','#aa32a0','#c83c3c','#4a8f2f','#7a5bd6','#b89600','#1f93a8','#c0507a','#5f7d1e','#8c5a2b'];
const PM_MAXTEX=16384;
const defPM=()=>({mV:10,mH:5,mFps:30,mSecs:10,pattern:'classic',palette:'vivid',labels:'large',outCount:4,compMode:'input',flip:false,pos:{},preset:'tb6k',outW:6144,outH:3456,outPx:8847360,share:true,assign:{}});
function pmOf(){ S.pm=S.pm||{}; const d=defPM(); for(const k in d) if(!(k in S.pm)) S.pm[k]=d[k]; return S.pm; }
const r8=v=>Math.round(v/8)*8, up8=v=>Math.ceil(v/8)*8;
const median=a=>{ const b=a.slice().sort((x,y)=>x-y); return b.length?b[Math.floor(b.length/2)]:1; };

function pmSurfaces(){
  return S.screens.filter(s=>panelById(s.panelId)).map((s,i)=>{
    const p=panelById(s.panelId), b=sbox(s);
    return {s,id:s.id,name:(s.name||'').trim()||'Screen',p,idx:i,
      W:s.cols*p.pw,H:s.rows*p.ph,cw:p.pw,ch:p.ph,
      gx:s.x+gridX(b),gy:s.y+HEADH+PAD,gw:b.gw,gh:b.gh,bx:s.x,by:s.y,bw:b.w,bh:b.h,
      unit:unitOf(s),col:pmCol(i)};
  });
}
/* world x -> composition x, piecewise along the first row of screens */
function pmMapX(map,k,wx){
  for(const m of map) if(wx>=m.w0&&wx<=m.w1) return m.p0+(wx-m.w0)/Math.max(1,m.w1-m.w0)*(m.p1-m.p0);
  let best=null;
  for(const m of map){ const d=wx<m.w0?m.w0-wx:wx-m.w1; if(!best||d<best.d) best={d,m}; }
  const m=best.m; return wx<m.w0?m.p0-(m.w0-wx)*k:m.p1+(wx-m.w1)*k;
}
/* the stage arrangement at 1:1, with the gaps between screens and rows closed up so nothing is wasted */
function pmAutoLayout(L){
  if(!L.length) return;
  const k=median(L.map(o=>o.W/Math.max(1,o.gw)));
  const rows=[];
  L.slice().sort((a,b)=>a.gy-b.gy).forEach(o=>{
    const r=rows.find(r=>r.some(q=>o.gy<q.gy+q.gh*0.9&&o.gy+o.gh>q.gy+q.gh*0.1));
    r?r.push(o):rows.push([o]);
  });
  const map=[];
  rows.forEach((row,ri)=>{
    row.sort((a,b)=>a.gx-b.gx);
    if(ri===0){
      let prev=null;
      row.forEach(o=>{
        o.x=prev?prev.x+prev.W:0;
        map.push({w0:o.gx,w1:o.gx+o.gw,p0:o.x,p1:o.x+o.W}); prev=o;
      });
      map.sort((a,b)=>a.w0-b.w0);
      const top=Math.min(...row.map(o=>o.gy));
      row.forEach(o=>o.y=r8((o.gy-top)*k));
    } else {
      const above=rows.slice(0,ri).flat();
      const yBase=Math.max(...above.map(o=>o.y+o.H));
      const gtop=Math.min(...row.map(o=>o.gy));
      /* snap to a centre, seam or edge of the screens above when within a cabinet of it */
      const cands=[];
      above.forEach(a=>{ cands.push({v:a.x+a.W/2,t:'c'},{v:a.x,t:'l'},{v:a.x+a.W,t:'r'}); });
      if(above.length) cands.push({v:(Math.min(...above.map(a=>a.x))+Math.max(...above.map(a=>a.x+a.W)))/2,t:'c'});
      row.forEach(o=>{
        let x=pmMapX(map,k,o.gx+o.gw/2)-o.W/2, best=null;
        cands.forEach(c=>{
          const at=c.t==='c'?x+o.W/2:c.t==='l'?x:x+o.W, d=Math.abs(at-c.v);
          if(d<=o.cw&&(!best||d<best.d)) best={d,x:c.t==='c'?c.v-o.W/2:c.t==='l'?c.v:c.v-o.W};
        });
        o.x=r8(best?best.x:x); o.y=yBase+r8((o.gy-gtop)*k);
      });
      for(let i=1;i<row.length;i++){ const a=row[i-1],b=row[i]; if(b.x<a.x+a.W) b.x=a.x+a.W; }
    }
  });
  const mx=Math.min(...L.map(o=>o.x)), my=Math.min(...L.map(o=>o.y));
  L.forEach(o=>{ o.x-=mx; o.y-=my; });
}
/* the full map: composition positions, outputs, slices, warnings */
