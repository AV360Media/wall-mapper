/* ========================= INTERACTION ========================= */
function toWorld(e){
  const r=cv.getBoundingClientRect();
  return {x:(e.clientX-r.left-view.x)/view.k,y:(e.clientY-r.top-view.y)/view.k};
}
cv.addEventListener('dblclick',e=>{
  e.preventDefault();
  const w=toWorld(e), h=pickScreen(w.x,w.y);
  if(h) enterFocus(h.i); else exitFocus();
});
cv.addEventListener('contextmenu',e=>e.preventDefault());
let ctxPress=null;
cv.addEventListener('mousedown',e=>{
  if(e.button===0&&document.querySelector('.menu.open')){ closeMenus(); return; }   /* first click just dismisses an open menu */
  ctxPress=e.button===2&&!spaceDown?{x:e.clientX,y:e.clientY}:null;
  if(e.button===2&&!spaceDown&&(mode==='power'||mode==='data')){
    const w=toWorld(e), h=pickScreen(w.x,w.y);
    const t=h&&!h.onHeader?hitTileLocal(h.s,h.b,h.lx,h.ly):null;
    if(t){
      e.preventDefault();
      if(h.i!==cur) selectScreen(h.i);
      pushUndo(mode==='power'?'erase circuit tiles':'erase data tiles');
      paint={rm:true,seen:new Set([t])}; applyTile(t,true);
      cv.classList.add('erasing'); ctxPress=null;
      return;
    }
  }
  if(e.button===1||e.button===2||spaceDown){ e.preventDefault(); panning={x:e.clientX,y:e.clientY}; cv.classList.add('panning'); return; }
  if(e.button!==0) return;
  const w=toWorld(e), h=pickScreen(w.x,w.y);
  if(!h){ panning={x:e.clientX,y:e.clientY}; cv.classList.add('panning'); return; }
  if(h.i!==cur) selectScreen(h.i);
  if(focusIdx==null&&(mode==='arrange'||h.onHeader)){
    moving={sx:e.clientX,sy:e.clientY,ox:h.s.x,oy:h.s.y,moved:false}; cv.classList.add('move'); return;
  }
  const t=hitTileLocal(h.s,h.b,h.lx,h.ly);
  if(!t){ panning={x:e.clientX,y:e.clientY}; cv.classList.add('panning'); return; }
  if(mode==='layout'&&tileTool==='curve'){                /* curve locks: a click sets the joint on that side */
    const k=jointAt(h.s,h.b,t,h.lx); if(k==null){ setStatus('The outside edges of a screen have no joint'); return; }
    pushUndo('curve lock'); stepJoint(h.s,k,e.shiftKey||e.altKey);
    syncCurveForm(); renderSide(); syncGeo(); redraw(); save(); return;
  }
  const rm=e.shiftKey||e.altKey;
  pushUndo(mode==='power'?'power run':mode==='data'?'data run':'tile change');
  paint={rm,seen:new Set([t])}; applyTile(t,rm);
});
window.addEventListener('mousemove',e=>{
  if(panning){ view.x+=e.clientX-panning.x; view.y+=e.clientY-panning.y; panning={x:e.clientX,y:e.clientY}; redraw(); return; }
  if(moving){
    const s=sc();
    let dx=(e.clientX-moving.sx)/view.k, dy=(e.clientY-moving.sy)/view.k;
    if(opt().rear) dx=-dx;
    if(!moving.moved){ if(Math.hypot(e.clientX-moving.sx,e.clientY-moving.sy)<3) return; moving.moved=true; pushUndo('screen move'); }
    const np=snapPos(s,moving.ox+dx,moving.oy+dy,e.altKey);
    s.x=np.x; s.y=np.y; redraw(); return;
  }
  if(!paint) return;
  const w=toWorld(e), h=pickScreen(w.x,w.y);
  if(!h||h.i!==cur) return;
  const t=hitTileLocal(h.s,h.b,h.lx,h.ly);
  if(!t||paint.seen.has(t)) return;
  paint.seen.add(t); applyTile(t,paint.rm);
});
window.addEventListener('mouseup',e=>{
  /* a right click that didn't move opens the screen menu */
  if(e.button===2&&ctxPress&&Math.hypot(e.clientX-ctxPress.x,e.clientY-ctxPress.y)<5){
    const w=toWorld(e), h=pickScreen(w.x,w.y);
    if(h){ panning=null; cv.classList.remove('panning'); openScreenMenu(h.i,e.clientX,e.clientY); }
  }
  ctxPress=null;
  if(moving){ dragGuides=[]; if(moving.moved) save(); redraw(); }
  paint=null; panning=null; moving=null;
  cv.classList.remove('panning'); cv.classList.remove('move'); cv.classList.remove('erasing');
});
window.addEventListener('keydown',e=>{
  const inField=/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
  const dlgOpen=MASKS.some(id=>!document.getElementById(id).classList.contains('hide'));
  if((e.metaKey||e.ctrlKey)&&!inField&&!dlgOpen){   /* undo stays out of an open dialog's way */
    const k=e.key.toLowerCase();
    if(k==='z'){ e.preventDefault(); e.shiftKey?redo():undo(); return; }
    if(k==='y'){ e.preventDefault(); redo(); return; }
  }
  if(pmOpen&&!dlgOpen){
    if(e.key==='Escape'){ closePM(); return; }
    if(!inField&&e.key.startsWith('Arrow')&&pmSel){
      e.preventDefault(); const st=e.shiftKey?64:8;
      const d={ArrowLeft:[-st,0],ArrowRight:[st,0],ArrowUp:[0,-st],ArrowDown:[0,st]}[e.key]; if(d) pmNudge(d[0],d[1]);
    }
    return;
  }
  const dlg=MASKS.filter(id=>!document.getElementById(id).classList.contains('hide'));
  if(dlg.length){
    if(e.key==='Escape'){                          /* close the dialog on top only */
      const id=dlg[dlg.length-1];
      if(id==='btModal') closeBatch();
      else if(id==='bkModal') closeBackup();
      else if(id==='nwModal'){ if(nwCancelable()) nwDismiss(); }
      else closeMask(id);
    }
    return;
  }
  if(e.code==='Space'&&!inField){ spaceDown=true; cv.classList.add('pan'); e.preventDefault(); }
  if(inField) return;
  /* number keys pick a port or circuit: 1-9, 0 = 10, Shift + 1-9 = 11-19, Shift + 0 = 20 */
  const dm=/^(Digit|Numpad)(\d)$/.exec(e.code);
  if(dm&&!e.metaKey&&!e.ctrlKey&&!e.altKey&&(mode==='power'||mode==='data')){
    const d=+dm[2], n=(d===0?10:d)+(e.shiftKey?10:0);
    e.preventDefault();
    if(n<=SLOTS) keyPick(n-1);
    return;
  }
  if(!e.metaKey&&!e.ctrlKey&&!e.altKey&&!e.shiftKey){
    const k=e.key.toLowerCase();
    if(k==='a') setMode('arrange');
    if(k==='t') setMode('layout');
    if(k==='p') setMode('power');
    if(k==='d') setMode('data');
    if(k==='f') fitView();
  }
  if(e.key==='Escape'){
    if(document.querySelector('.menu.open')) closeMenus(); else exitFocus();
  }
  if(e.key.startsWith('Arrow')&&focusIdx==null){
    const s=sc(), step=e.shiftKey?SNAP*4:SNAP;
    const d={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]}[e.key];
    if(d&&s){
      e.preventDefault();
      if(Date.now()-nudgeAt>800) pushUndo('nudge screen');   /* one undo step per burst of nudges */
      nudgeAt=Date.now();
      s.x+=opt().rear?-d[0]:d[0]; s.y+=d[1]; redraw(); save();
    }
  }
});
let nudgeAt=0;
const MASKS=['nwModal','libModal','sbModal','siModal','stModal','btModal','lbModal','pjModal','exModal','bkModal','cpModal','shModal','planModal'];   /* page order: later ones sit on top */
window.addEventListener('keyup',e=>{ if(e.code==='Space'){ spaceDown=false; cv.classList.remove('pan'); } });
window.addEventListener('resize',redraw);

