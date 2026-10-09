/* ========================= LAYOUT ========================= */
const MM=0.075, GAP=2, PAD=14, HEADH=30, SETGAP=40, SNAP=5;
function legendGroups(s,sp,sd){
  const g=[];
  if(sp){
    const it=used(s,'power').map(ch=>{ const k=circuitCalc(s,ch);
      return {c:ch.color,dash:0,over:k.pct>=100,
        short:`${ch.name}  ${LT(s,ch).length}t`+(wantLoad()?`  ${k.amps.toFixed(1)}A`:''),
        t:`${ch.name}   ${LT(s,ch).length} tiles`+(wantLoad()?`   ${k.w}W   ${k.amps.toFixed(1)}A`:'')}; });
    if(it.length) g.push({title:'POWER CIRCUITS',short:'POWER',items:it});
  }
  if(sd){
    const it=used(s,'data').filter(ch=>!isBackupRun(s,ch)).map(ch=>{ const k=runCalc(s,ch);
      return {c:ch.color,dash:1,over:k.pct>=100,
        short:`${ch.name}  ${LT(s,ch).length}t  ${(k.px/1000).toFixed(0)}k`,
        t:`${ch.name}   ${portShort(s,ch)}   ${LT(s,ch).length} tiles   ${(k.px/1000).toFixed(0)}k px`}; });
    if(it.length) g.push({title:units().length>1
      ?`DATA \u2014 ${unitLabel(unitOf(s)).toUpperCase()} \u00b7 ${bitDepth()}-BIT`
      :`DATA RUNS \u2014 MAIN \u00b7 ${bitDepth()}-BIT`,short:'DATA RUNS',items:it});
    const bk=bkOf(s), bit=[];
    if(bkMode(s)==='device') bit.push({c:C.violet,dash:2,
      t:`Every port mirrored on ${bkDeviceName(s)}`,
      short:`Mirrored on ${bkDeviceName(s)}`});
    else if(bkMode(s)==='port'){
      used(s,'data').forEach(ch=>{ const br=backupFor(s,ch);
        if(br) bit.push({c:br.color,dash:2,t:`${br.name}   ${portShort(s,br)}   backs up ${ch.name}`,sort:br.name}); });
      bit.sort((a,z)=>a.sort.localeCompare(z.sort,undefined,{numeric:true}));
    }
    if(bit.length) g.push({title:'BACKUP PORTS',short:'BACKUP',items:bit});
  }
  if(curved(s)){
    const n={}; for(let k=0;k<s.cols-1;k++){ const v=jointOf(s,k); if(v) n[v]=(n[v]||0)+1; }
    const it=Object.keys(n).map(Number).sort((a,z)=>(z>0)-(a>0)||Math.abs(a)-Math.abs(z)).map(v=>{ const d=Math.abs(locksOf(s)[Math.min(locksOf(s).length,Math.abs(v))-1]);
      return {lock:v,c:'#000',t:`Lock ${Math.abs(v)}   ${d}° ${v>0?'toward audience':'away from audience'}   ${n[v]} joint${n[v]===1?'':'s'}`,short:`Lock ${Math.abs(v)} ${d}°${v<0?' away':''}`}; });
    g.push({title:`CURVE LOCKS — ${curveText(s).toUpperCase()}`,short:'CURVE LOCKS',items:it});
  }
  return g;
}
function legendSize(groups,perRow){
  if(!groups.length) return 0;
  let h=8;
  groups.forEach((grp,i)=>{ h+=13+Math.ceil(grp.items.length/perRow)*13; if(i<groups.length-1) h+=9; });
  return h+8;
}
function sbox(s){
  const p=panelById(s.panelId);
  if(!p) return {p:null,tw:0,th:0,gw:0,gh:0,leg:0,perRow:1,w:340,h:HEADH+110};
  const tw=Math.max(14,Math.round(p.wmm*MM)), th=Math.max(10,Math.round(p.hmm*MM));
  const gw=s.cols*tw+(s.cols-1)*GAP, gh=s.rows*th+(s.rows-1)*GAP;
  const o=opt();
  const w=Math.max(gw+PAD*2,132);
  const perRow=Math.max(1,Math.floor((w-PAD*2)/168));
  const wantLeg=XO?XO.legend:o.detail!=='clean';
  const groups=wantLeg?legendGroups(s,o.showPower,o.showData):[];
  const leg=legendSize(groups,perRow);
  return {p,tw,th,gw,gh,leg,perRow,w,h:HEADH+PAD+gh+PAD+leg};
}
function setBounds(){
  let x1=1e9,y1=1e9,x2=-1e9,y2=-1e9;
  visible().forEach(s=>{ const b=sbox(s);
    x1=Math.min(x1,s.x); y1=Math.min(y1,s.y); x2=Math.max(x2,s.x+b.w); y2=Math.max(y2,s.y+b.h); });
  if(x1>x2){x1=y1=0;x2=400;y2=300;}
  return {x1,y1,x2,y2,w:x2-x1,h:y2-y1};
}
function posOf(s,B){
  const b=sbox(s);
  return opt().rear?{x:B.x1+B.x2-(s.x+b.w),y:s.y}:{x:s.x,y:s.y};
}
function gridX(b){ return PAD+Math.max(0,(b.w-PAD*2-b.gw)/2); }
function tileXY(s,b,r,c){
  const cc=opt().rear?(s.cols-1-c):c;
  return {x:gridX(b)+cc*(b.tw+GAP),y:HEADH+PAD+r*(b.th+GAP)};
}
function ctr(s,b,t){const[r,c]=t.split(':').map(Number),q=tileXY(s,b,r,c);return{x:q.x+b.tw/2,y:q.y+b.th/2};}
/* separated routing tracks: power rides up-right of centre, data rides down-left */
function anchor(s,b,t,isPower,dual){
  const c=ctr(s,b,t);
  if(!dual) return c;
  const d=Math.max(3,Math.min(b.tw,b.th)*0.17);
  return isPower?{x:c.x+d,y:c.y-d}:{x:c.x-d,y:c.y+d};
}
function hitTileLocal(s,b,lx,ly){
  if(!b.p) return null;
  const gx=lx-gridX(b), gy=ly-HEADH-PAD;
  if(gx<0||gy<0) return null;
  const cc=Math.floor(gx/(b.tw+GAP)), r=Math.floor(gy/(b.th+GAP));
  if(cc<0||cc>=s.cols||r<0||r>=s.rows) return null;
  if(gx-cc*(b.tw+GAP)>b.tw||gy-r*(b.th+GAP)>b.th) return null;
  return key(r,opt().rear?(s.cols-1-cc):cc);
}
function pickScreen(wx,wy){
  const B=setBounds(), list=visible();
  for(let i=list.length-1;i>=0;i--){
    const s=list[i], b=sbox(s), p=posOf(s,B);
    if(wx>=p.x&&wx<=p.x+b.w&&wy>=p.y&&wy<=p.y+b.h)
      return {i:S.screens.indexOf(s),s,b,lx:wx-p.x,ly:wy-p.y,onHeader:(wy-p.y)<HEADH};
  }
  return null;
}

