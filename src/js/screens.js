/* ========================= SCREENS ========================= */
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
  if(src&&src.panelId){ ns.panelId=src.panelId; ns.procId=src.procId; }
  S.screens.push(ns);
  focusIdx=null; document.getElementById('focusBar').classList.add('hide');
  document.getElementById('focusBtn').classList.remove('on');
  selectScreen(S.screens.length-1); fitView(); save();
}
function dupScreen(){
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
  if(S.screens.length<2) return;
  pushUndo('delete screen');
  S.screens.splice(cur,1); cur=Math.max(0,cur-1);
  focusIdx=null; document.getElementById('focusBar').classList.add('hide');
  document.getElementById('focusBtn').classList.remove('on');
  selectScreen(cur); fitView(); save();
}
function tidySet(){
  pushUndo('tidy set');
  let x=0;
  const maxH=Math.max(...S.screens.map(s=>sbox(s).h));
  S.screens.forEach(s=>{ const b=sbox(s); s.x=x; s.y=maxH-b.h; x+=b.w+SETGAP; });
  redraw(); fitView(); save();
}

