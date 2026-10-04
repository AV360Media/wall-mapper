/* ========================= INIT ========================= */
(async function(){
  try{ applyUITheme(await sGet('wm:theme')||'dark',false); }catch(e){ applyUITheme('dark',false); }
  document.body.dataset.mode=mode;
  if(TESTBUILD){ document.title='TEST · '+document.title;
    document.querySelector('.eyebrow b').insertAdjacentHTML('afterend','<span class="testtag">TEST BUILD</span>'); }
  if(document.fonts) document.fonts.ready.then(()=>{ try{ redraw(); segSync(); }catch(e){} });
  setTimeout(segSync,60); setTimeout(segSync,700);
  /* nothing in here may stop the interface from rendering */
  try{
    await loadCloud();
    projIndex=(await sGet(IDX))||[];
    const want=await sGet(CURKEY);
    if(!projIndex.length){
      const legacy=await sGet(LEGACY);
      if(legacy&&legacy.screens&&legacy.screens.length){ S=legacy; projId=uid('p'); }
    }
    if(!S&&want&&projIndex.some(e=>e.id===want)){
      const d=await sGet(PKEY(want));
      if(d&&d.screens&&d.screens.length){ projId=want; S=d; }
    }
    if(!S&&projIndex.length){
      const d=await sGet(PKEY(projIndex[0].id));
      if(d&&d.screens&&d.screens.length){ projId=projIndex[0].id; S=d; }
    }
  }catch(e){ console.error('project load failed',e); }

  if(!S) S=blankProject();
  if(!projId) projId=uid('p');
  normalize();

  renderTabs(); setMode('layout'); renderSide(); fitView(); updateUndoUI();
  setStatus(sc().panelId?'Ready':'Choose an LED panel in the sidebar to start');

  /* persist afterwards, and never let it break anything */
  try{
    if(!projIndex.some(e=>e.id===projId)){
      touchIndex(); await sSet(PKEY(projId),S); await sSet(IDX,projIndex);
    }
    await sSet(CURKEY,projId);
  }catch(e){ console.error('project save failed',e); }

  if(cloudOn()&&signedIn()){
    setStatus('Syncing your projects…');
    await sbSyncAll(true);
    if(!syncErr) setStatus('Synced · '+(sc().panelId?'ready':'choose an LED panel'));
  }
})();
