/* ========================= SCHEDULES ========================= */
/* run length estimate: tile-to-tile centre distance in real mm, plus drop and slack */
function runLenFt(s,ch){
  const p=panelById(s.panelId), TL=LT(s,ch); if(!p||TL.length<2) return dropFt(s);
  let mm=0;
  for(let i=0;i<TL.length-1;i++){
    const a=TL[i].split(':').map(Number), b=TL[i+1].split(':').map(Number);
    mm+=Math.abs(b[1]-a[1])*p.wmm+Math.abs(b[0]-a[0])*p.hmm;
  }
  return mm/304.8+dropFt(s);
}
function dropFt(s){
  const p=panelById(s.panelId);
  return p?(s.rows*p.hmm)/304.8*0.6+10:10;   /* drop to deck plus 10 ft of slack */
}
const stdLen=ft=>[5,10,15,25,50,75,100].find(x=>x>=ft)||Math.ceil(ft/25)*25;
function cableRows(){
  const out=[];
  S.screens.forEach(s=>{
    used(s,'power').forEach(ch=>{
      const k=circuitCalc(s,ch), L=runLenFt(s,ch);
      out.push({screen:s.name,kind:'Power',id:ch.name,color:ch.color,
        from:`Distro · ${k.breaker}A ${k.volts}V`,to:`${s.name} ${tileRef(LT(s,ch)[0])}`,
        tiles:LT(s,ch).length,load:`${k.w} W / ${k.amps.toFixed(1)} A`,
        est:Math.round(L),spec:stdLen(L)});
    });
    used(s,'data').forEach(ch=>{
      if(isBackupRun(s,ch)) return;
      const k=runCalc(s,ch), L=runLenFt(s,ch), pr=procOf(s);
      out.push({screen:s.name,kind:'Data',id:ch.name,color:ch.color,
        from:portLabel(s,ch),to:`${s.name} ${tileRef(LT(s,ch)[0])}`,
        tiles:LT(s,ch).length,load:`${(k.px/1000).toFixed(0)}k px · ${pr.pt||'—'}`,
        est:Math.round(L),spec:stdLen(L)});
      const br=backupFor(s,ch);
      if(br) out.push({screen:s.name,kind:'Backup',id:br.name,color:br.color,
        from:portLabel(s,br)||bkDeviceName(s),to:`${s.name} ${tileRef(LT(s,ch)[LT(s,ch).length-1])}`,
        tiles:LT(s,ch).length,load:`backs up ${ch.name}`,est:Math.round(L),spec:stdLen(L)});
    });
    if(bkMode(s)==='device') used(s,'data').forEach(ch=>{
      if(isBackupRun(s,ch)||backupFor(s,ch)) return;
      const L=runLenFt(s,ch);
      out.push({screen:s.name,kind:'Backup',id:ch.name+' bk',color:'#c084fc',
        from:bkDeviceName(s),to:`${s.name} ${tileRef(LT(s,ch)[LT(s,ch).length-1])}`,
        tiles:LT(s,ch).length,load:`mirrors ${ch.name}`,est:Math.round(L),spec:stdLen(L)});
    });
  });
  return out;
}
const tileRef=t=>{const[r,c]=t.split(':').map(Number);return `R${r+1}C${c+1}`;};
function pullRows(){
  const C0=cabOf(), out={panels:[],procs:[],data:[],power:[],notes:[]};
  const panels={},procs={};
  let pJump=0,dJump=0,circuits=0,runs=0,backups=0,dataPorts=0;
  const homeP={},homeD={};

  S.screens.forEach(s=>{
    const p=panelById(s.panelId); if(!p) return;
    panels[p.brand+' '+p.model]=(panels[p.brand+' '+p.model]||0)+tileCount(s);

    used(s,'power').forEach(ch=>{
      const n=LT(s,ch).length; circuits++; pJump+=Math.max(0,n-1);
      const L=stdLen(runLenFt(s,ch)); homeP[L]=(homeP[L]||0)+1;
    });
    used(s,'data').forEach(ch=>{
      if(isBackupRun(s,ch)) return;
      const n=LT(s,ch).length; runs++; dataPorts++; dJump+=Math.max(0,n-1);
      const L=stdLen(runLenFt(s,ch)); homeD[L]=(homeD[L]||0)+1;
      if(backupFor(s,ch)){ backups++; const L2=stdLen(runLenFt(s,ch)); homeD[L2]=(homeD[L2]||0)+1; }
    });
    if(bkMode(s)==='device') used(s,'data').forEach(ch=>{
      if(isBackupRun(s,ch)||backupFor(s,ch)) return;
      backups++; const L=stdLen(runLenFt(s,ch)); homeD[L]=(homeD[L]||0)+1;
    });
  });
  units().forEach(u=>{
    const pr=unitProc(u); if(pr.id==='none') return;
    const n=pr.brand+' '+pr.model;
    procs[n]=(procs[n]||0)+1;
  });
  Object.entries(panels).forEach(([k,v])=>out.panels.push([k,v,Math.ceil(v*0.1)]));
  Object.entries(procs).forEach(([k,v])=>out.procs.push([k,v]));

  /* ---- power ---- */
  const brk=BRK[C0.breakout]||'Edison';
  if(C0.trunk==='soca'){
    const per=C0.soca||6, soca=Math.ceil(circuits/per);
    Object.entries(homeP).forEach(([L,n])=>{
      const sn=Math.ceil(n/per);
      out.power.push([`Socapex 19-pin — ${L} ft`,sn,`carries ${per} circuits`]);
    });
    out.power.push([`Soca breakout — ${per}× ${brk}`,soca,'one per soca run']);
    out.power.push([`${brk} tail — ${C0.pTail} ft`,circuits,'breakout to first panel']);
  } else {
    Object.entries(homeP).forEach(([L,n])=>
      out.power.push([`${brk} home run — ${L} ft`,n,'distro to first panel']));
  }
  if(pJump) out.power.push([`${BRK[C0.pJumpType]||brk} jumper — ${C0.pJump} ft`,pJump,'panel to panel']);
  const circT={};
  S.screens.forEach(s=>used(s,'power').forEach(ch=>{
    const k=circuitCalc(s,ch), key=`${k.breaker}A ${k.volts}V`;
    circT[key]=(circT[key]||0)+1;
  }));
  Object.entries(circT).forEach(([k,v])=>out.power.push([`Circuit — ${k}`,v,'from distro']));

  /* ---- data ---- */
  const totalD=runs+backups;
  if(C0.feed==='fiber'){
    const cv=cvtSpec();
    const auto=Math.max(1,Math.ceil(totalD/Math.max(1,cv.ports)));
    const units=C0.cvtQty>0?C0.cvtQty:auto;
    let senders=0;
    if(C0.cvtSender==='pair') senders=units;
    else if(C0.cvtSender==='auto'){
      const copperProc=S.screens.some(s=>procOf(s).id!=='none'&&!procHasFiber(procOf(s)));
      senders=copperProc?units:0;
    }
    const perUnit=C0.fiberBackup?2:1;
    const fibre=C0.fiberQty>0?C0.fiberQty:units*perUnit;
    out.data.push([`${cv.name} — at the wall`,units,
      (C0.cvtQty>0?'set manually · ':'')+`${cv.ports} port${cv.ports===1?'':'s'} each`]);
    if(senders) out.data.push([`${cv.name} — at the processor`,senders,
      C0.cvtSender==='pair'?'matched pair per link':'processor has no fibre output']);
    out.data.push([`Fibre ${cv.mode?cv.mode+" ":""}LC duplex — ${C0.fiberLen} ft`,fibre,
      (C0.fiberQty>0?'set manually':C0.fiberBackup?'main + backup per converter':'main only')]);
    out.data.push([`Cat6 shielded tail — ${C0.dTail} ft`,totalD,'converter to first panel']);
  } else {
    Object.entries(homeD).forEach(([L,n])=>
      out.data.push([`Cat6 shielded home run — ${L} ft`,n,'processor to first panel']));
  }
  if(dJump) out.data.push([`Cat6 jumper — ${C0.dJump} ft`,dJump,'panel to panel']);
  out.data.push([`Data ports in use`,totalD,`${runs} main + ${backups} backup · ${bitDepth()}-bit`]);

  out.notes.push(`Power: ${C0.trunk==='soca'?`Socapex ${C0.soca}-circuit trunk with ${brk} breakouts`:`individual ${brk} runs`}, ${BRK[C0.pJumpType]||brk} jumpers between panels.`);
  out.notes.push(`Data: ${C0.feed==='fiber'?`fibre to ${cvtSpec().name} at the wall, Cat6 from the converter onward`:'Cat6 direct from the processor'}.`);
  out.notes.push('Jumper counts are one per panel-to-panel hop. Backup runs reuse the same panel jumpers and add only a home run.');
  return out;
}

