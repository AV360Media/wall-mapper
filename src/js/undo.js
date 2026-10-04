/* ========================= UNDO ========================= */
function pushUndo(label){
  undoStack.push({snap:JSON.stringify(S),cur,mode,act:{power:active.power,data:active.data},label:label||'change'});
  if(undoStack.length>60) undoStack.shift();
  redoStack.length=0; updateUndoUI();
}
function restore(entry){
  S=JSON.parse(entry.snap);
  cur=Math.max(0,Math.min(entry.cur||0,S.screens.length-1));
  if(focusIdx!=null&&focusIdx>=S.screens.length) exitFocus();
  const a=entry.act||active;
  active={power:Math.min(Math.max(a.power|0,0),SLOTS-1),data:Math.min(Math.max(a.data|0,0),SLOTS-1)};
  renderTabs();
  if(entry.mode&&entry.mode!==mode) setMode(entry.mode);   /* show the layer the change belongs to */
  else { syncForm(); renderSlots(); redraw(); }
  renderSide(); updateUndoUI(); save();
  if(typeof pmOpen!=='undefined'&&pmOpen) pmSync();
}
function undo(){
  if(!undoStack.length){ setStatus('Nothing to undo'); return; }
  const now={snap:JSON.stringify(S),cur,mode,act:{power:active.power,data:active.data},
    label:undoStack[undoStack.length-1].label};
  const e=undoStack.pop(); redoStack.push(now);
  restore(e); setStatus('Undid '+now.label);
}
function redo(){
  if(!redoStack.length){ setStatus('Nothing to redo'); return; }
  const now={snap:JSON.stringify(S),cur,mode,act:{power:active.power,data:active.data},label:'change'};
  const e=redoStack.pop(); undoStack.push(now);
  restore(e); setStatus('Redone');
}
function updateUndoUI(){
  ['undoBtn','pmUndo'].forEach(id=>{ const u=document.getElementById(id); if(u) u.disabled=!undoStack.length; });
  ['redoBtn','pmRedo'].forEach(id=>{ const r=document.getElementById(id); if(r) r.disabled=!redoStack.length; });
}

