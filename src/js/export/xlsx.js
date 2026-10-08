/* ========================= XLSX EXPORT ========================= */
const XFILL=['C0504D','4F81BD','9BBB59','8064A2','E36C0A','4BACC6','7F7F7F','943634'];
function xlsxExport(){
  if(needScreen()) return;
  const btn=document.getElementById('xlsBtn'); btn.disabled=true; btn.textContent='Building…';
  try{
    const P=pullRows(), rows=[], BLANK=3;
    const sect=(title,fi,heads)=>{
      rows.push({c:[]});
      rows.push({c:heads.map(()=>({v:'',s:HDR(fi)})).map((c,i)=>i?c:{v:title,s:HDR(fi)}),h:20});
      rows.push({c:heads.map(h=>({v:h,s:S_BOLD}))});
    };
    const blanks=n=>{for(let i=0;i<n;i++) rows.push({c:['','','','','','']});};

    rows.push({c:[{v:`${titleShow()} — Equipment Pull List`,s:S_TITLE}],h:24});
    rows.push({c:[[titleVenue(),titleDate(),(S.exp&&S.exp.author)?'Drawn by '+S.exp.author:''].filter(Boolean).join('   ·   ')]});

    sect('LED PANELS',0,['Item','Qty needed','Qty pulled','Notes','Location','✓']);
    P.panels.forEach(([n,q,sp])=>rows.push({c:[n,{v:q},'','','','']}));
    P.panels.forEach(([n,q,sp])=>rows.push({c:[n+' — spares (10%)',{v:sp},'','','','']}));
    blanks(BLANK);

    sect('PROCESSING',1,['Item','Qty needed','Qty pulled','Notes','Location','✓']);
    P.procs.forEach(([n,q])=>rows.push({c:[n,{v:q},'','','','']}));
    rows.push({c:[`Colour depth in use: ${bitDepth()}-bit`,'','','','','']});
    blanks(BLANK);

    sect('POWER',2,['Item','Qty needed','Qty pulled','Notes','Location','✓']);
    P.power.forEach(([n,q,note])=>rows.push({c:[n,{v:q},'',note||'','','']}));
    blanks(BLANK);

    sect('DATA',3,['Item','Qty needed','Qty pulled','Notes','Location','✓']);
    P.data.forEach(([n,q,note])=>rows.push({c:[n,{v:q},'',note||'','','']}));
    blanks(BLANK);

    sect('SCREENS',4,['Screen','Panel','Resolution','Dimensions','Tiles','Weight']);
    S.screens.forEach(sc0=>{
      const t=totals(sc0), pp=panelById(sc0.panelId);
      rows.push({c:[sc0.name,pp?pp.brand+' '+pp.model:'—',`${t.resW} × ${t.resH}`,
        t.wmm?`${ftIn(t.wmm)} × ${ftIn(t.hmm)}`:'—',{v:t.tiles},lbFmt(t.lb)]});
    });
    const st=setTotalsCalc();
    rows.push({c:[{v:'SET TOTAL',s:S_BOLD},'','','',{v:st.tiles,s:S_BOLD},{v:lbFmt(st.lb),s:S_BOLD}]});
    blanks(2);
    sect('SPEC NOTES',5,['Note','','','','','']);
    P.notes.forEach(n=>rows.push({c:[{v:n,s:S_WRAP},'','','','','']}));

    /* --- cable schedule sheet --- */
    const cr=[], CH=['Screen','Type','ID','From','To','Tiles','Load','Est. run','Spec length','✓'];
    cr.push({c:[{v:`${titleShow()} — Cable Schedule`,s:S_TITLE}],h:24});
    cr.push({c:[]});
    cr.push({c:CH.map(h=>({v:h,s:HDR(5)})),h:20});
    let cur='';
    cableRows().forEach(r=>{
      if(r.sid!==cur){ cur=r.sid; cr.push({c:[{v:r.screen,s:S_BOLD}]}); }
      cr.push({c:[r.screen,r.kind,r.id,r.from,r.to,{v:r.tiles},r.load,`${r.est} ft`,`${r.spec} ft`,'']});
    });

    /* --- circuit schedule sheet --- */
    const pr2=[], PH=['Screen','Circuit','Tiles','Watts','Amps','Breaker','Usable','% of circuit','✓'];
    pr2.push({c:[{v:`${titleShow()} — Circuit Schedule`,s:S_TITLE}],h:24});
    pr2.push({c:[]});
    pr2.push({c:PH.map(h=>({v:h,s:HDR(7)})),h:20});
    S.screens.forEach(sc0=>used(sc0,'power').forEach(ch=>{
      const k=circuitCalc(sc0,ch);
      pr2.push({c:[sc0.name,ch.name,{v:LT(sc0,ch).length},{v:k.w},{v:+k.amps.toFixed(1)},
        `${k.breaker}A ${k.volts}V`,{v:+k.cap.toFixed(1)},{v:+k.pct.toFixed(0)},'']});
    }));

    const book=buildXlsx([
      {name:'Pull List',rows,cols:[38,12,12,26,18,6],freeze:3},
      {name:'Cable Schedule',rows:cr,cols:[16,10,10,30,20,8,24,10,12,6],freeze:3},
      {name:'Circuit Schedule',rows:pr2,cols:[16,12,8,10,10,14,10,14,6],freeze:3}
    ],XFILL);
    download(new Blob([book],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),
      fileBase()+' pull list.xlsx');
    setStatus('Pull list exported');
  }catch(e){ console.error(e); setStatus('XLSX failed: '+e.message); }
  finally{ btn.disabled=false; btn.textContent='Pull list (Excel)'; }
}

