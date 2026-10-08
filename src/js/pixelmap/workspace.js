/* ---- Pixel Map workspace ---- */
let pmOpen=false, pmSel=null, pmDrag=null, pmHits=[], pmLast=null;
function openPM(){
  if(needScreen()) return;
  if(!S.screens.some(s=>panelById(s.panelId))){ setStatus('Choose an LED panel for a screen first'); return; }
  pmOpen=true; document.getElementById('pmModal').classList.remove('hide'); pmSync();
}
function closePM(){ pmOpen=false; pmDrag=null; document.getElementById('pmModal').classList.add('hide'); }
function pmSet(f,v){
  const pm=pmOf();
  if(f==='preset'){ pm.preset=v; const P=PM_PRESETS[v]; if(P&&P.w){ pm.outW=P.w; pm.outH=P.h; } }
  else pm[f]=v;
  pmSync(); save();
}
function pmAuto(){ pushUndo('pixel map auto layout'); pmOf().pos={}; pmSync(); save(); setStatus('Composition laid out from the set'); }
function pmFlip(){
  pushUndo('pixel map flip'); const pm=pmOf(), M=pmBuild();
  M.L.forEach(o=>{ if(pm.pos[o.id]) pm.pos[o.id].x=M.compW-pm.pos[o.id].x-o.W; });
  pm.flip=!pm.flip; pmSync(); save();
}
function pmAssign(key,v){
  pushUndo('pixel map output'); const pm=pmOf();
  if(v==='auto') delete pm.assign[key]; else pm.assign[key]=v==='own'?'own':+v;
  pmSync(); save();
}
function pmSetPos(id,f,v){
  const M=pmLast||pmBuild(), o=M.L.find(q=>q.id===id); if(!o) return;
  pushUndo('move in pixel map');
  const pm=pmOf(); pm.pos[id]=pm.pos[id]||{x:o.x,y:o.y}; pm.pos[id][f]=Math.max(0,r8((+v||0)/(M.k||1))); pmSync(); save();
}
function pmResetOne(id){ pushUndo('pixel map reset'); delete pmOf().pos[id]; pmSync(); save(); }
function pmSync(){ if(!pmOpen) return; pmLast=pmBuild(); pmRender(); pmSide(); }

function pmRender(){
  const M=pmLast, c=document.getElementById('pmcv'), dpr=window.devicePixelRatio||1;
  const W=c.clientWidth, H=c.clientHeight; c.width=Math.round(W*dpr); c.height=Math.round(H*dpr);
  const x=c.getContext('2d'); x.setTransform(dpr,0,0,dpr,0,0);
  x.fillStyle=C.bg; x.fillRect(0,0,W,H); pmHits=[];
  x.fillStyle=C.dot||C.rule; for(let yy=11;yy<H;yy+=22) for(let xx=11;xx<W;xx+=22) x.fillRect(xx-.75,yy-.75,1.5,1.5);
  if(!M.L.length) return;
  const pad=28, outsH=M.outs.length?Math.min(H*0.34,270):0;
  const areaW=W-pad*2, areaH=H-pad*2-outsH-(outsH?54:0)-26;
  const sc=Math.min(areaW/M.compW,areaH/M.compH);
  const cx0=pad+(areaW-M.compW*sc)/2, cy0=pad+26;
  x.font=`600 12px ${FS}`; x.fillStyle=C.sub; x.textBaseline='top';
  x.fillText(`COMPOSITION  ${M.compW} × ${M.compH}`,cx0,pad);
  x.save(); x.translate(cx0,cy0); x.scale(sc,sc);
  pmDead(x,M.compW,M.compH);
  M.L.forEach(o=>{ pmDrawIn(x,o,false);
    pmHits.push({id:o.id,x:cx0+o.ix*sc,y:cy0+o.iy*sc,w:o.iw*sc,h:o.ih*sc,sc:sc*M.k}); });
  const sel=M.L.find(o=>o.id===pmSel);
  if(sel){ x.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--ac')||'#6f7cff';
    x.lineWidth=4/sc; x.setLineDash([12/sc,8/sc]); x.strokeRect(sel.ix-6/sc,sel.iy-6/sc,sel.iw+12/sc,sel.ih+12/sc); x.setLineDash([]); }
  x.restore();
  x.strokeStyle=C.edge; x.lineWidth=1; x.strokeRect(cx0,cy0,M.compW*sc,M.compH*sc);
  if(!outsH) return;
  const oy=cy0+M.compH*sc+44, gap=24;
  const sumW=M.outs.reduce((a,o)=>a+o.W,0), os=Math.min((W-pad*2-gap*(M.outs.length-1))/sumW,(outsH-40)/Math.max(...M.outs.map(o=>o.H)));
  let ox=pad+(W-pad*2-(sumW*os+gap*(M.outs.length-1)))/2;
  M.outs.forEach(o=>{
    const over=o.W>pmOf().outW||o.H>pmOf().outH||o.W*o.H>pmOf().outPx;
    const room=o.W*os+gap-6;                   /* name over size, so narrow outputs never collide */
    x.font=`700 12px ${FS}`; x.fillStyle=over?C.bad:C.head; x.fillText(clipText(x,`OUTPUT ${o.n}`,room,`700 12px ${FS}`),ox,oy);
    x.font=`10.5px ${FM}`; x.fillStyle=C.faint; x.fillText(clipText(x,`${o.W} × ${o.H}`,room,`10.5px ${FM}`),ox,oy+15);
    x.save(); x.translate(ox,oy+31); x.scale(os,os); pmDead(x,o.W,o.H);
    M.L.filter(q=>q.out===o.n).forEach(q=>pmDrawSurface(x,q,q.ox,q.oy,pmWhereOut(q),false)); x.restore();
    x.strokeStyle=over?'#ff6b6b':'#39435599'; x.strokeRect(ox,oy+31,o.W*os,o.H*os);
    ox+=o.W*os+gap;
  });
}
function pmSide(){
  const M=pmLast, pm=pmOf(), g=id=>document.getElementById(id);
  g('pmSize').textContent=M.L.length?`${M.compW} × ${M.compH}`:'—';
  g('pmPx').textContent=M.L.length?`composition · ${(M.lit/1e6).toFixed(2)} M LED pixels`:'';
  const sw=g('pmMode'); if(sw) sw.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.v===(M.gpu?'gpu':'input')));
  const eff=M.compW?Math.round(M.lit/(M.compW*M.compH)*100):0;
  g('pmOrient').innerHTML=M.gpu
    ?`<b>${(M.compW*M.compH/1e6).toFixed(2)} M px</b> to render, ${eff}% of it lit.`
      +(M.stagePx>M.compW*M.compH?` Matching the stage would be ${(M.stagePx/1e6).toFixed(2)} M px, so this saves ${Math.round((1-M.compW*M.compH/M.stagePx)*100)}% of the GPU work.`:'')
      +` Each output is one solid block of the composition.`
    :`<b>${(M.compW*M.compH/1e6).toFixed(2)} M px</b> to render, ${eff}% of it lit. Laid out like the stage (${opt().rear?'rear':'front'} view${pm.flip?', flipped':''}) with the gaps closed up. Every composition pixel is one LED pixel.`;
  document.querySelectorAll('.pm-stageonly').forEach(el=>el.style.display=M.gpu?'none':'');
  g('pmWarn').innerHTML=M.warn.map(w=>`<div class="pmw">${escp(w)}</div>`).join('');
  const sel=M.L.find(o=>o.id===pmSel);
  g('pmSelBox').innerHTML=sel?`
    <div class="pmselhd"><span class="pmsw" style="background:${sel.col}"></span><b>${escp(sel.name)}</b><span>${sel.W} × ${sel.H}</span></div>
    <div class="g2">
      <div class="f"><label>Composition X</label><input type="number" step="8" value="${sel.ix}" ${M.gpu?'readonly':''} onchange="pmSetPos('${sel.id}','x',this.value)" /></div>
      <div class="f"><label>Composition Y</label><input type="number" step="8" value="${sel.iy}" ${M.gpu?'readonly':''} onchange="pmSetPos('${sel.id}','y',this.value)" /></div>
    </div>
    <div class="hint">Panel ${sel.cw} × ${sel.ch} px · ${sel.s.cols} × ${sel.s.rows} panels. Input ${sel.iw} × ${sel.ih} in the composition. Lands on Output ${sel.out} at X ${sel.ox}, Y ${sel.oy} as ${sel.W} × ${sel.H}.${sel.manual?' Placed by hand.':''}</div>
    ${sel.manual?`<button class="btn sm ghost" onclick="pmResetOne('${sel.id}')">Back to automatic position</button>`:''}`
    :(M.gpu?'<div class="hint">Click a screen to see where it sits. In Packed 1:1 mode every position is worked out for you.</div>'
      :'<div class="hint">Click a screen to select it. Drag to move it, or nudge with the arrow keys (Shift for bigger steps).</div>');
  g('pmPreset').value=pm.preset; g('pmW').value=pm.outW; g('pmH').value=pm.outH; g('pmMax').value=pm.outPx;
  pmSwatches();
  if(g('pmMoSecs')) g('pmMoSecs').value=String(pm.mSecs||10);
  if(g('pmMoFps')) g('pmMoFps').value=String(pm.mFps||30);
  if(g('pmMoV')) g('pmMoV').value=String(pm.mV??10);
  if(g('pmMoH')) g('pmMoH').value=String(pm.mH??5);
  if(g('pmMoLen')){ const L=pmMotionLen(pm), want=+pm.mSecs||10;
    g('pmMoLen').textContent=L!==want?`Clips will run ${L} s so every line finishes whole passes and loops cleanly.`:`Clips run ${L} s and loop cleanly.`; }
  g('pmShare').checked=!!pm.share; g('pmCount').value=pm.outCount||4;
  const iss=pmAudit();
  const fx=pmFixLive()?`<div class="pmfix"><span>Fixed: ${escp(pmLastFix.text)}.</span><button class="btn sm" onclick="pmUndoFix()">Undo fix</button></div>`:'';
  g('pmIssues').innerHTML=fx+(iss.length?`<div class="pmiss">
      <div class="pmiss-h"><b>${iss.length} thing${iss.length===1?'':'s'} to sort out</b>
        ${iss.some(i=>i.kind!=='note')?`<button class="btn sm pri" onclick="pmFix('all')">Fix all</button>`:''}</div>
      ${iss.map(i=>`<div class="pmiss-i"><div class="pmiss-t">${escp(i.title)}</div><div class="pmiss-d">${escp(i.detail)}</div>
        ${i.kind==='split'?`<button class="btn sm" onclick="pmFix('split','${i.id}')">Split screen</button>`:''}
        ${i.kind==='rebalance'?`<button class="btn sm" onclick="pmFix('rebalance','${i.id}')">Add processors and rebalance</button>`:''}</div>`).join('')}
    </div>`:(M.outs.length>(pm.outCount||4)?'':`<div class="pmok">Every processor is within its limits, using ${M.outs.length} of your ${pm.outCount||4} output${(pm.outCount||4)===1?'':'s'}.</div>`));
  g('pmOuts').innerHTML=M.outs.map(o=>{
    const px=o.W*o.H, over=o.W>pm.outW||o.H>pm.outH||px>pm.outPx;
    return `<div class="pmout ${over?'bad':''}">
      <div class="pmouthd"><b>Output ${o.n}</b><span>${o.W} × ${o.H} · ${(px/1e6).toFixed(2)} M</span></div>
      ${o.groups.map(gr=>`<div class="pmgrp"><span>${escp(gr.name)}<i>${gr.items.map(q=>escp(q.name)).join(', ')}</i></span>
        <select onchange="pmAssign('${gr.key}',this.value)">
          <option value="auto" ${pm.assign[gr.key]==null?'selected':''}>Auto</option>
          ${M.outs.map((_,i)=>`<option value="${i}" ${pm.assign[gr.key]===i?'selected':''}>Output ${i+1}</option>`).join('')}
          <option value="own" ${pm.assign[gr.key]==='own'?'selected':''}>Own output</option>
        </select></div>`).join('')}
    </div>`; }).join('');
  g('pmSlices').innerHTML=`<table class="pmtab"><tr><th>Slice</th><th>Comp X, Y</th><th>Output · X, Y</th></tr>`
    +M.slices.map(o=>`<tr onclick="pmSel='${o.id}';pmSync()" class="${o.id===pmSel?'on':''}" title="${o.W} × ${o.H}">
      <td class="nm"><span class="pmsw" style="background:${o.col}"></span>${escp(o.name)}<i>${o.W} × ${o.H}</i></td>
      <td>${o.ix}, ${o.iy}</td><td>${o.out} · ${o.ox}, ${o.oy}</td></tr>`).join('')+'</table>';
}
/* dragging in the composition */
function pmHit(e){ const r=document.getElementById('pmcv').getBoundingClientRect(), mx=e.clientX-r.left, my=e.clientY-r.top;
  for(let i=pmHits.length-1;i>=0;i--){ const h=pmHits[i]; if(mx>=h.x&&mx<=h.x+h.w&&my>=h.y&&my<=h.y+h.h) return {h,mx,my}; } return null; }
function pmDown(e){
  const hit=pmHit(e); if(!hit){ pmSel=null; pmSync(); return; }
  pmSel=hit.h.id; const o=pmLast.L.find(q=>q.id===pmSel);
  if(pmLast.gpu){ pmSync(); return; }
  pmDrag={id:o.id,sx:e.clientX,sy:e.clientY,x0:o.x,y0:o.y,sc:hit.h.sc,moved:false};
  pmSync();
}
function pmMove(e){
  if(!pmDrag) return;
  const d=pmDrag, dx=(e.clientX-d.sx)/d.sc, dy=(e.clientY-d.sy)/d.sc;
  if(!d.moved){ if(Math.hypot(e.clientX-d.sx,e.clientY-d.sy)<3) return; d.moved=true; pushUndo('move in pixel map'); }
  const o=pmLast.L.find(q=>q.id===d.id); let nx=d.x0+dx, ny=d.y0+dy;
  const snap=10/d.sc;                                      /* snap to other screens' edges and centres */
  pmLast.L.forEach(q=>{ if(q.id===d.id) return;
    [[q.x,0],[q.x+q.W,0],[q.x-o.W,0],[q.x+q.W-o.W,0],[q.x+q.W/2-o.W/2,0]].forEach(([v])=>{ if(Math.abs(nx-v)<snap) nx=v; });
    [[q.y],[q.y+q.H],[q.y-o.H],[q.y+q.H-o.H]].forEach(([v])=>{ if(Math.abs(ny-v)<snap) ny=v; }); });
  pmOf().pos[d.id]={x:Math.max(0,r8(nx)),y:Math.max(0,r8(ny))};
  pmLast=pmBuild(); pmRender(); pmSide();
}
function pmUp(){ if(pmDrag){ if(pmDrag.moved) save(); pmDrag=null; } }
function pmNudge(dx,dy){
  if(!pmSel||(pmLast&&pmLast.gpu)) return; const o=pmLast.L.find(q=>q.id===pmSel); if(!o) return;
  pushUndo('nudge in pixel map');
  pmOf().pos[o.id]={x:Math.max(0,o.x+dx),y:Math.max(0,o.y+dy)}; pmSync(); save();
}
