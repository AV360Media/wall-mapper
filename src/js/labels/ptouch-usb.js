/* ========================= DIRECT USB PRINTING · Brother PT-P710BT =========================
   Implements Brother's "Raster Command Reference PT-E550W/P750W/P710BT" v1.02.
   Chrome/Edge talk to the printer over WebUSB, so no Mac driver is needed. */
const PT={VID:0x04F9,PID:0x20AF,DPM:180/25.4,PINS:128};
/* print-head pins per tape width (spec 2.3.5): unused pins on the first side, pins that print */
const PT_TAPE={4:{m:52,p:24},6:{m:48,p:32},9:{m:39,p:50},12:{m:29,p:70},18:{m:8,p:112},24:{m:0,p:128}};
const PT_MARGIN_DOTS=14;                 /* 2 mm feed at each end, the minimum the printer allows */
let ptDev=null, ptEp={in:1,out:2}, ptPending=null, ptBusy=false, ptCancel=false, ptLast=null, ptLog=[];
const ptNote=t=>{ ptLog.push(new Date().toISOString().slice(11,23)+'  '+t); if(ptLog.length>400) ptLog.shift(); };

const ptSupported=()=>!!(navigator.usb);
/* A page shown inside another site's frame (like a preview pane) can have USB switched off. */
function ptBlocked(){
  try{
    const pp=document.permissionsPolicy||document.featurePolicy;
    if(pp&&typeof pp.allowsFeature==='function') return !pp.allowsFeature('usb');
  }catch(e){}
  return false;
}
const PT_BLOCKED_MSG='USB is switched off in this window because Wall Mapper is open inside another page, '
  +'like a preview pane. Open it in its own Chrome tab to print: click Open in its own tab, '
  +'or use Save app file and double-click the saved file.';
async function ptFind(){
  if(!ptSupported()) return null;
  const ds=await navigator.usb.getDevices();
  return ds.find(d=>d.vendorId===PT.VID&&d.productId===PT.PID)||null;
}
async function ptConnect(ask){
  if(!ptSupported()) throw new Error('Direct printing needs Chrome or Edge. Safari and Firefox cannot reach USB printers.');
  if(ptBlocked()) throw new Error(PT_BLOCKED_MSG);
  let d;
  try{ d=await ptFind(); }
  catch(e){ if(e&&(e.name==='SecurityError'||/permissions policy/i.test(e.message))) throw new Error(PT_BLOCKED_MSG); throw e; }
  if(!d&&ask) d=await navigator.usb.requestDevice({filters:[{vendorId:PT.VID,productId:PT.PID}]});
  if(!d) throw new Error('Printer not found. Plug in the CUBE Plus by USB, turn it on and try again.');
  if(!d.opened) await d.open();
  if(d.configuration===null) await d.selectConfiguration(1);
  const itf=d.configuration.interfaces[0];
  try{ await d.claimInterface(itf.interfaceNumber); }
  catch(e){ throw new Error('The printer is busy in another app. Quit P-touch Editor and try again.'); }
  const eps=itf.alternate.endpoints;
  const i=eps.find(e=>e.direction==='in'), o=eps.find(e=>e.direction==='out');
  ptEp={in:i?i.endpointNumber:1,out:o?o.endpointNumber:2};
  ptDev=d; ptPending=null; ptInbox=[];
  return d;
}
async function ptClose(){
  const d=ptDev; ptDev=null; ptPending=null; ptInbox=[];
  if(d&&d.opened){ try{ await d.releaseInterface(d.configuration.interfaces[0].interfaceNumber); }catch(e){}
    try{ await d.close(); }catch(e){} }
}
const ptSend=bytes=>ptDev.transferOut(ptEp.out,bytes instanceof Uint8Array?bytes:new Uint8Array(bytes));
/* WebUSB reads have no timeout. One read is kept armed; anything it receives goes into an
   inbox, so a reply that lands while nothing is waiting is kept rather than dropped. */
let ptInbox=[];
function ptArm(){
  if(ptPending||!ptDev) return;
  ptPending=ptDev.transferIn(ptEp.in,32).then(r=>{
    ptPending=null;
    if(r&&r.data&&r.data.byteLength>=32) ptInbox.push(new Uint8Array(r.data.buffer,r.data.byteOffset,r.data.byteLength));
  },()=>{ ptPending=null; });
}
async function ptRead(ms){
  const until=Date.now()+ms;
  for(;;){
    while(ptInbox.length){ const s=ptParse(ptInbox.shift()); if(s) return s; }
    if(!ptDev) return null;
    ptArm();
    const left=until-Date.now(); if(left<=0) return null;
    await Promise.race([ptPending,new Promise(r=>setTimeout(r,left))]);
  }
}
function ptParse(b){
  ptNote('in  '+Array.from(b).map(x=>x.toString(16).padStart(2,'0')).join(' '));
  if(b[0]!==0x80) return null;
  const e1=b[8], e2=b[9], errs=[];
  if(e1&0x01) errs.push('No tape cassette is loaded');
  if(e1&0x04) errs.push('The cutter is jammed');
  if(e1&0x08) errs.push('The battery is too low — plug in the charger');
  if(e1&0x40) errs.push('The wrong power adapter is connected');
  if(e2&0x01) errs.push('The loaded tape does not match this job');
  if(e2&0x10) errs.push('The tape cover is open');
  if(e2&0x20) errs.push('The printer has overheated — let it cool down');
  const types={0x00:'none',0x01:'laminated',0x03:'non-laminated',0x11:'heat-shrink',0x17:'heat-shrink',0xFF:'incompatible'};
  const colours={0x01:'white',0x02:'other',0x03:'clear',0x04:'red',0x05:'blue',0x06:'yellow',0x07:'green',0x08:'black',
    0x09:'clear (white text)',0x20:'matte white',0x90:'white Flexible ID',0x91:'yellow Flexible ID',0xFF:'incompatible'};
  return {width:b[10],mediaType:b[11],type:types[b[11]]||'unknown',tape:colours[b[24]]||'',flex:b[24]===0x90||b[24]===0x91,
    statusType:b[18],phase:b[19],errs};
}
/* Wait for "printing completed". The printer should announce it, but if it stays quiet,
   wait until the tag has had time to print and cut, then ask directly. */
async function ptWaitDone(lengthMm){
  const expect=4000+lengthMm/15*1000;              /* ~20 mm/s print speed, plus feed and cut */
  const until=Date.now()+expect;
  while(Date.now()<until){
    const s=await ptRead(Math.max(200,Math.min(1500,until-Date.now())));
    if(!s) continue;
    if(s.statusType===0x02||s.errs.length) throw new Error((s.errs.join('. ')||'The printer reported an error')+'.');
    if(s.statusType===0x01){ ptNote('done: printer reported printing completed'); return; }
  }
  for(let tries=0;tries<6;tries++){                 /* quiet printer: poll it */
    await ptSend([0x1B,0x69,0x53]);
    ptNote('out status request (poll)');
    const end=Date.now()+2500;
    while(Date.now()<end){
      const s=await ptRead(Math.max(200,end-Date.now()));
      if(!s) continue;
      if(s.statusType===0x02||s.errs.length) throw new Error((s.errs.join('. ')||'The printer reported an error')+'.');
      if(s.statusType===0x01){ ptNote('done: completed (late)'); return; }
      if(s.statusType===0x00&&s.phase===0x00){ ptNote('done: printer idle and ready'); return; }
    }
    await new Promise(r=>setTimeout(r,1500));
  }
  throw new Error('The printer stopped responding. Check the tape and cover, then try again. '
    +'If this keeps happening, open Printer options and click Copy printer log.');
}
async function ptStatus(){
  const inv=new Uint8Array(100);                  /* 100-byte invalidate, then initialise */
  await ptSend(inv); await ptSend([0x1B,0x40]);
  await ptSend([0x1B,0x69,0x53]);                 /* ESC i S: status request */
  for(let i=0;i<5;i++){ const s=await ptRead(2500); if(s&&s.statusType===0x00) return s; if(!s) break; }
  throw new Error('The printer did not answer. Check it is on and connected by USB.');
}

/* ---- draw one tag as a 1-bit bitmap at the printer's 180 dpi ---- */
function ptBitmap(o,pins){
  const L=labOf(), z=tagSize(), D=PT.DPM;
  const W=Math.round(z.w*D), H=pins;
  const c=document.createElement('canvas'); c.width=W; c.height=H;
  const x=c.getContext('2d');
  x.fillStyle='#fff'; x.fillRect(0,0,W,H); x.fillStyle='#000';
  const face=(x0)=>{
    const Lo=tagLayout(o);
    const px=pt=>pt*180/72;
    const bw=Lo.idW*D, bh=px(Lo.idPt)*1.15+0.6*D;
    const lh=Lo.lines.reduce((a,l)=>a+px(l.pt)*LINE_H,0);
    const cy=H/2, bx=x0+1.6*D;
    const r=0.8*D, by=cy-bh/2;
    x.beginPath(); x.moveTo(bx+r,by); x.arcTo(bx+bw,by,bx+bw,by+bh,r); x.arcTo(bx+bw,by+bh,bx,by+bh,r);
    x.arcTo(bx,by+bh,bx,by,r); x.arcTo(bx,by,bx+bw,by,r); x.closePath(); x.fillStyle='#000'; x.fill();
    x.fillStyle='#fff'; x.textBaseline='middle'; x.textAlign='center';
    x.font=`700 ${px(Lo.idPt).toFixed(1)}px Arial, Helvetica, sans-serif`;
    x.fillText(Lo.id,bx+bw/2,cy+px(Lo.idPt)*0.04);
    x.fillStyle='#000'; x.textAlign='left'; x.textBaseline='middle';
    let y=cy-lh/2; const tx=bx+bw+1.6*D;
    Lo.lines.forEach(l=>{ const h=px(l.pt)*LINE_H;
      x.font=`${l.b?700:400} ${px(l.pt).toFixed(1)}px Arial, Helvetica, sans-serif`;
      x.fillText(l.t,tx,y+h/2); y+=h; });
  };
  face(0);
  if(L.style==='flag'){
    face((z.face+z.wrap)*D);
    if(L.guides) [z.face*D,(z.face+z.wrap)*D].forEach(gx=>{
      for(let yy=0;yy<H;yy+=6) x.fillRect(Math.round(gx),yy,1,3); });
  }
  const img=x.getImageData(0,0,W,H).data, bits=new Uint8Array(W*H);
  for(let i=0;i<W*H;i++){ const p=i*4; bits[i]=(img[p]*0.3+img[p+1]*0.59+img[p+2]*0.11)<150?1:0; }
  return {w:W,h:H,bits,canvas:c};
}
/* bitmap -> raster lines: column x is one line across the tape, row y lands on pin (margin + y) */
function ptRaster(bm,tapeMm){
  const t=PT_TAPE[tapeMm], adj=labOf().ptRot180;
  const out=[];
  for(let col=0;col<bm.w;col++){
    const xs=adj?bm.w-1-col:col, line=new Uint8Array(16);
    let any=false;
    for(let y=0;y<bm.h;y++){
      const ys=adj?bm.h-1-y:y;
      if(bm.bits[ys*bm.w+xs]){ const pin=t.m+y; line[pin>>3]|=0x80>>(pin&7); any=true; }
    }
    out.push(line);
  }
  return out;
}
/* one page of print data: control codes, raster lines, print command */
function ptPage(lines,tapeMm,mediaType,first,last){
  const L=labOf(), n=lines.length, parts=[];
  parts.push([0x1B,0x69,0x61,0x01]);                                     /* raster mode */
  parts.push([0x1B,0x69,0x21,0x00]);                                     /* send status notifications (P710BT) */
  parts.push([0x1B,0x69,0x7A,0x84,mediaType||0x01,tapeMm,0x00,
    n&0xFF,(n>>8)&0xFF,(n>>16)&0xFF,(n>>24)&0xFF,first?0x00:0x01,0x00]); /* print information */
  parts.push([0x1B,0x69,0x4D,0x40|(L.ptMirror?0x80:0)]);                 /* auto cut (+ mirror) */
  parts.push([0x1B,0x69,0x4B,L.ptChain?0x00:0x08]);                      /* feed & cut the last tag unless chaining */
  parts.push([0x1B,0x69,0x64,PT_MARGIN_DOTS,0x00]);                      /* 2 mm margins */
  parts.push([0x4D,0x00]);                                              /* no compression */
  let len=parts.reduce((a,p)=>a+p.length,0)+n*19+1;
  const buf=new Uint8Array(len); let o=0;
  parts.forEach(p=>{ buf.set(p,o); o+=p.length; });
  lines.forEach(l=>{ buf[o++]=0x47; buf[o++]=16; buf[o++]=0; buf.set(l,o); o+=16; });
  buf[o++]=last?0x1A:0x0C;
  return buf;
}
async function ptPrint(testOnly){
  if(ptBusy) return;
  const g=id=>document.getElementById(id), msg=g('ptMsg');
  const say=(t,bad)=>{ msg.textContent=t; msg.style.color=bad?'var(--bad)':''; setStatus(t); };
  let rows=labelRows();
  if(!rows.length){ say('Nothing to print yet — map some circuits or data runs first.',1); return; }
  if(testOnly) rows=rows.slice(0,1);
  ptBusy=true; ptCancel=false; ptLog=[]; ptNote('job start, '+rows.length+' tag(s)'); ptUI();
  try{
    say('Connecting to the printer…');
    await ptConnect(true);
    const st=await ptStatus(); ptLast=st; ptUI();
    if(st.errs.length) throw new Error(st.errs.join('. ')+'.');
    if(!PT_TAPE[st.width]) throw new Error('No tape detected. Load a TZe cassette and close the cover.');
    if(![12,18,24].includes(st.width)) throw new Error(`${st.width} mm tape is loaded. Wall Mapper tags need 12, 18 or 24 mm tape.`);
    let note='';
    if(String(st.width)!==labOf().tape){ setLab('tape',String(st.width));
      note=` The printer has ${st.width} mm tape loaded, so tags are now laid out for ${st.width} mm.`; say(note.trim()); }
    const tape=st.width, pins=PT_TAPE[tape].p;
    for(let i=0;i<rows.length;i++){
      if(ptCancel) throw new Error('Printing cancelled.');
      say(`Printing tag ${i+1} of ${rows.length}…`);
      const bm=ptBitmap(rows[i],pins);
      const page=ptPage(ptRaster(bm,tape),tape,st.mediaType,i===0,i===rows.length-1);
      await ptSend(page);
      ptNote(`out page ${i+1}: ${page.length} bytes, ${bm.w} lines`);
      await ptWaitDone(tagSize().w+4+(i===0?25:0));
    }
    say((testOnly?'Test tag printed. If it looks right, print the rest.'
      :`Printed ${rows.length} tag${rows.length===1?'':'s'}.`+(labOf().ptChain?' The last one is still in the printer — press the power button twice to feed and cut it.':''))+note);
  }catch(e){
    if(e&&e.name==='NotFoundError') say('No printer was chosen. Click print again and select the CUBE Plus.',1);
    else say(e.message||String(e),1);
    try{ if(ptDev){ await ptSend(new Uint8Array(100)); await ptSend([0x1B,0x40]); } }catch(_){}
  }finally{
    await ptClose(); ptBusy=false; ptUI();
  }
}
function ptStop(){ ptCancel=true; }
function ptOpenTab(){
  const w=window.open(location.href,'_blank');
  if(!w) document.getElementById('ptMsg').textContent='Chrome blocked the new tab. Use Save app file instead, then double-click the saved file.';
}
function ptCopyLog(){
  const t=ptLog.length?ptLog.join('\n'):'No printer activity yet.';
  (navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(
    ()=>setStatus('Printer log copied — paste it into a message'),
    ()=>{ const w=window.open('','_blank'); if(w){ w.document.write('<pre>'+escp(t)+'</pre>'); } });
}
async function ptCheck(){
  const msg=document.getElementById('ptMsg');
  try{ await ptConnect(true); const st=await ptStatus(); ptLast=st; await ptClose(); ptUI();
    msg.style.color=st.errs.length?'var(--bad)':'';
    msg.textContent=st.errs.length?st.errs.join('. ')+'.':'Printer ready.';
  }catch(e){ await ptClose(); msg.style.color='var(--bad)';
    msg.textContent=e&&e.name==='NotFoundError'?'No printer was chosen.':(e.message||String(e)); }
}
function ptUI(){
  const g=id=>document.getElementById(id); if(!g('ptState')) return;
  const s=ptLast;
  const blocked=ptSupported()&&ptBlocked();
  g('ptState').textContent=!ptSupported()?'Needs Chrome or Edge'
    :blocked?'USB is switched off in this window'
    :s?`CUBE Plus · ${s.width} mm ${s.tape||s.type} tape`:'CUBE Plus · not checked yet';
  const fix=g('ptFix'); if(fix) fix.style.display=blocked?'':'none';
  const chk=g('ptChk'); if(chk) chk.style.display=blocked?'none':'';
  const dot=document.querySelector('.ptbar .ptdot'); if(dot) dot.style.background=(blocked||!ptSupported())?'var(--warn)':'';
  if(blocked&&!g('ptMsg').textContent) g('ptMsg').textContent=PT_BLOCKED_MSG;
  const busy=ptBusy;
  g('ptGo').disabled=busy||!ptSupported(); g('ptTest').disabled=busy||!ptSupported();
  g('ptStopBtn').style.display=busy?'':'none';
}

