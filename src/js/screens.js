/* ========================= SCREENS ========================= */
/* A project from the setup dialog starts with no screens. Its starting panel, processor and
   data feed live on the project, and every new screen picks them up. */
function needScreen(){ if(S.screens.length) return false; setStatus('Nothing here yet — add a screen first'); return true; }
function startScreen(ns){
  const u=units()[0];
  ns.panelId=S.defPanel||''; ns.feed=S.defFeed||'auto';
  if(u){ ns.procRef=u.id; ns.procId=u.procId; }
  return ns;
}
function nextSpot(){
  let x=0,y=0;
  S.screens.forEach(s=>{ const b=sbox(s); if(s.x+b.w+SETGAP>x){ x=s.x+b.w+SETGAP; y=s.y; } });
  return {x,y};
}
function selectScreen(i){
  cur=i; active={power:0,data:0};
  if(focusIdx!=null){ focusIdx=i; document.getElementById('focusName').textContent=S.screens[i].name; }
  renderTabs(); syncForm(); renderSlots(); renderSide();
  if(focusIdx!=null) fitView(); else redraw();
}
function addScreen(){
  pushUndo('add screen');
  const p=nextSpot();
  const src=sc();
  const ns=blankScreen(S.screens.length+1,p.x,p.y);
  if(!src) startScreen(ns);
  else if(src.panelId){ ns.panelId=src.panelId; ns.procId=src.procId; ns.procRef=src.procRef; ns.feed=src.feed; }
  S.screens.push(ns);
  focusIdx=null; document.getElementById('focusBar').classList.add('hide');
  document.getElementById('focusBtn').classList.remove('on');
  selectScreen(S.screens.length-1); fitView(); save();
}
function dupScreen(){
  if(needScreen()) return;
  pushUndo('duplicate screen');
  const src=sc(), p=nextSpot();
  const copy=JSON.parse(JSON.stringify(src));
  copy.id=uid('s'); copy.name=src.name+' copy'; copy.x=p.x; copy.y=p.y;
  S.screens.push(copy);
  focusIdx=null; document.getElementById('focusBar').classList.add('hide');
  document.getElementById('focusBtn').classList.remove('on');
  selectScreen(S.screens.length-1); fitView(); save();
}
function delScreen(){
  if(needScreen()) return;
  pushUndo('delete screen');
  const gone=S.screens.splice(cur,1)[0]; cur=Math.max(0,Math.min(cur,S.screens.length-1));
  if(!S.screens.length){ S.defPanel=S.defPanel||gone.panelId; S.defFeed=S.defFeed||gone.feed; }   /* back to the blank canvas, keeping its panel */
  focusIdx=null; document.getElementById('focusBar').classList.add('hide');
  document.getElementById('focusBtn').classList.remove('on');
  selectScreen(cur); fitView(); save();
}
function tidySet(){
  if(needScreen()) return;
  pushUndo('tidy set');
  let x=0;
  const maxH=Math.max(...S.screens.map(s=>sbox(s).h));
  S.screens.forEach(s=>{ const b=sbox(s); s.x=x; s.y=maxH-b.h; x+=b.w+SETGAP; });
  redraw(); fitView(); save();
}

