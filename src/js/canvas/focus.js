/* ========================= FOCUS ========================= */
function enterFocus(i){
  focusIdx=i; cur=i;
  if(!prevView) prevView={...view};
  document.getElementById('focusBar').classList.remove('hide');
  document.getElementById('focusName').textContent=S.screens[i].name;
  document.getElementById('focusBtn').classList.add('on');
  renderTabs(); syncForm(); renderSlots(); renderSide(); fitView();
  setStatus('Focused on '+S.screens[i].name);
}
function exitFocus(){
  if(focusIdx==null) return;
  focusIdx=null;
  document.getElementById('focusBar').classList.add('hide');
  document.getElementById('focusBtn').classList.remove('on');
  renderTabs(); renderSide();
  if(prevView){ view={...prevView}; prevView=null; redraw(); } else fitView();
  setStatus('Set view');
}
function toggleFocus(){ if(focusIdx!=null) exitFocus(); else enterFocus(cur); }

