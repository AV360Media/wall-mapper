/* ========================= INIT ========================= */
(async function(){
  try{ applyUITheme(await sGet('wm:theme')||'dark',false); }catch(e){ applyUITheme('dark',false); }
  document.body.dataset.mode=mode;
  if(TESTBUILD){ document.title='TEST · '+document.title;
    document.querySelector('.eyebrow b').insertAdjacentHTML('afterend','<span class="testtag">TEST BUILD</span>'); }
  if(document.fonts) document.fonts.ready.then(()=>{ try{ redraw(); segSync(); }catch(e){} });
  setTimeout(segSync,60); setTimeout(segSync,700);
  if(await crewBoot()) return;                   /* a crew link opens the view-only page instead */
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
      if(d&&Array.isArray(d.screens)){ projId=want; S=d; }
    }
    if(!S&&projIndex.length){
      const d=await sGet(PKEY(projIndex[0].id));
      if(d&&Array.isArray(d.screens)){ projId=projIndex[0].id; S=d; }
    }
  }catch(e){ console.error('project load failed',e); }

  const fresh=!S;                               /* nothing saved yet: ask for the setup first */
  if(!S) S=blankProject();
  if(!projId) projId=uid('p');
  normalize();

  renderTabs(); setMode('layout'); renderSide(); fitView(); updateUndoUI();
  setStatus(!sc()||sc().panelId?'Ready':'Choose an LED panel in the sidebar to start');
  const cloud=cloudOn()&&signedIn();             /* a signed-in browser pulls its projects first */
  if(!cloud) openSetup(fresh,!fresh);            /* the setup opens on every visit; saved work can be reopened */

  /* persist afterwards, and never let it break anything */
  try{
    if(!projIndex.some(e=>e.id===projId)){
      touchIndex(); await sSet(PKEY(projId),S); await sSet(IDX,projIndex);
    }
    await sSet(CURKEY,projId);
  }catch(e){ console.error('project save failed',e); }

  if(cloud){
    setStatus('Syncing your projects…');
    await sbSyncAll(true);
    if(!syncErr) setStatus('Synced · '+(!sc()||sc().panelId?'ready':'choose an LED panel'));
    openSetup(false,true);
  }
})();
