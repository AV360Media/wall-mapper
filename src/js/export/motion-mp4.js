/* ========================= MOTION TEST PATTERNS (MP4) ========================= */
/* Encoded in the browser with WebCodecs and packed into MP4 with mp4-muxer (MIT, Vanilagy). */
let pmMotionCancel=false, pmMotionBusy=false;
async function pmPickCodec(W,H,fps,bitrate){
  if(typeof VideoEncoder==='undefined') return null;
  const tries=[
    {codec:'avc1.640034',mux:'avc',label:'H.264'},          /* High, level 5.2 */
    {codec:'avc1.64003C',mux:'avc',label:'H.264'},          /* High, level 6.0 for very large frames */
    {codec:'hvc1.1.6.L156.B0',mux:'hevc',label:'HEVC'},     /* Main, level 5.2: up to 8K on Apple hardware */
    {codec:'hev1.1.6.L156.B0',mux:'hevc',label:'HEVC'},
    {codec:'vp09.00.51.08',mux:'vp9',label:'VP9'}            /* last resort; Alley converts it to DXV */
  ];
  for(const t of tries){
    const cfg={codec:t.codec,width:W,height:H,bitrate,framerate:fps,latencyMode:'quality'};
    if(t.mux==='avc') cfg.avc={format:'avc'};
    if(t.mux==='hevc') cfg.hevc={format:'hevc'};
    try{ const r=await VideoEncoder.isConfigSupported(cfg); if(r&&r.supported) return {...t,cfg}; }catch(e){}
  }
  return null;
}
const PM_TURN=5;                                              /* seconds per turn of the rotating hand */
function pmMotionLen(pm){
  const ms=v=>Math.round(v*1000), gcd=(a,b)=>b?gcd(b,a%b):a, lcm=(a,b)=>a/gcd(a,b)*b;
  const periods=[PM_TURN,+pm.mV||0,+pm.mH||0].filter(v=>v>0).map(ms);
  const L=periods.reduce(lcm,1), want=ms(Math.max(+pm.mSecs||10,...periods.map(v=>v/1000)));
  return Math.ceil(want/L)*L/1000;
}
/* one frame: the static pattern, then everything that moves */
function pmMotionFrame(ctx,base,o,M,i,n,fps){
  const W=o.W, H=o.H, t=i/n, k=o.W/o.iw;                      /* composition px -> slice px */
  ctx.drawImage(base,0,0);
  const u=Math.max(1,Math.min(o.cw,o.ch)/64);
  /* sweep lines travel across the whole composition, so they cross screens in stage order.
     Each is a crisp line with a greyscale fade trailing behind it, like Resolume's test card. */
  const SW=M.stageW, SH=M.stageH, pm=pmOf(), sec=i/fps;           /* follow the stage, not the composition */
  const vP=+pm.mV||0, hP=+pm.mH||0;
  const vx=vP?((sec%vP)/vP)*SW*1.15-SW*.05:-1e9, vTrail=SW*.14;    /* left to right across the set */
  const lx=vx-o.sx, trw=vTrail;
  if(vP&&lx>-u*4&&lx-trw<W){
    const g=ctx.createLinearGradient(lx-trw,0,lx,0);
    g.addColorStop(0,'rgba(255,255,255,0)'); g.addColorStop(.75,'rgba(255,255,255,.22)'); g.addColorStop(1,'rgba(255,255,255,.5)');
    ctx.fillStyle=g; ctx.fillRect(lx-trw,0,trw,H);
    ctx.fillStyle='#ffffff'; ctx.fillRect(lx-u*1.5,0,u*3,H);
  }
  const hy=hP?((sec%hP)/hP)*SH*1.3-SH*.15:-1e9, hTrail=SH*.28;     /* top to bottom across the set */
  const ly=hy-o.sy, th=hTrail;
  if(hP&&ly>-u*4&&ly-th<H){
    const g=ctx.createLinearGradient(0,ly-th,0,ly);
    g.addColorStop(0,'rgba(255,255,255,0)'); g.addColorStop(.75,'rgba(255,255,255,.14)'); g.addColorStop(1,'rgba(255,255,255,.32)');
    ctx.fillStyle=g; ctx.fillRect(0,ly-th,W,th);
    ctx.fillStyle='rgba(255,255,255,.85)'; ctx.fillRect(0,ly-u,W,u*2);
  }
  /* rotating hand with a greyscale fade trailing behind it */
  const r=Math.min(W,H)*.46, a=(sec/PM_TURN)*Math.PI*2-Math.PI/2, cx=W/2, cy=H/2, trail=.33;
  ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.clip();
  if(ctx.createConicGradient){
    const cg=ctx.createConicGradient(a-trail*Math.PI*2,cx,cy);
    cg.addColorStop(0,'rgba(255,255,255,0)'); cg.addColorStop(trail*.55,'rgba(255,255,255,.12)');
    cg.addColorStop(trail,'rgba(255,255,255,.58)'); cg.addColorStop(Math.min(1,trail+.0005),'rgba(255,255,255,0)'); cg.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=cg; ctx.fillRect(cx-r,cy-r,r*2,r*2);
  }
  ctx.restore();
  ctx.strokeStyle='#ffffff'; ctx.lineWidth=u*3.5; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r); ctx.stroke();
  ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.arc(cx,cy,u*7,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=o.col; ctx.beginPath(); ctx.arc(cx,cy,u*3.5,0,Math.PI*2); ctx.fill();
  ctx.save(); pmLabels(ctx,o,0,0,pmWhereOut(o),false); ctx.restore();
  /* timecode and frame counter */
  const whole=Math.floor(i/fps), fr=i%fps, pad=v=>String(v).padStart(2,'0');
  const txt=`${pad(Math.floor(whole/60))}:${pad(whole%60)}:${pad(fr)}   F ${String(i+1).padStart(4,'0')} / ${n}`;
  const fs=Math.max(12,Math.min(H*.055,W*.035)); ctx.font=`500 ${fs}px ${FM}`;
  const tw=ctx.measureText(txt).width, px=fs*.6, ph=fs*1.6, x0=W/2-tw/2-px, y0=Math.max(u*10,H*.04);
  roundRect(ctx,x0,y0,tw+px*2,ph,ph/2); ctx.fillStyle='rgba(6,7,10,.85)'; ctx.fill();
  ctx.fillStyle='#ffd166'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(txt,W/2,y0+ph/2);
}
async function pmEncodeSlice(M,o,fps,secs,onProg){
  const n=Math.round(fps*secs), W=o.W, H=o.H;
  const bitrate=Math.round(Math.min(80e6,Math.max(6e6,W*H*fps*.09)));
  const pick=await pmPickCodec(W,H,fps,bitrate);
  if(!pick) return {skip:`${o.name}: this computer can't encode ${W} × ${H} video`};
  const base=document.createElement('canvas'); base.width=W; base.height=H;
  { const bx=base.getContext('2d'); bx.save(); pmPaint(bx,o,0,0,pmOf().pattern||'classic'); bx.restore(); }   /* pattern only; labels go on top of the motion */
  const cv=document.createElement('canvas'); cv.width=W; cv.height=H; const cx=cv.getContext('2d');
  const muxer=new Mp4Muxer.Muxer({target:new Mp4Muxer.ArrayBufferTarget(),video:{codec:pick.mux,width:W,height:H,frameRate:fps},fastStart:'in-memory'});
  let err=null;
  const enc=new VideoEncoder({output:(chunk,meta)=>muxer.addVideoChunk(chunk,meta),error:e=>{ err=e; }});
  enc.configure(pick.cfg);
  for(let i=0;i<n;i++){
    if(pmMotionCancel) throw new Error('cancelled');
    if(err) throw err;
    pmMotionFrame(cx,base,o,M,i,n,fps);
    const f=new VideoFrame(cv,{timestamp:Math.round(i*1e6/fps),duration:Math.round(1e6/fps)});
    enc.encode(f,{keyFrame:i%(fps*2)===0}); f.close();
    while(enc.encodeQueueSize>3) await new Promise(r=>setTimeout(r,2));
    if(i%5===0){ onProg(i/n); await new Promise(r=>setTimeout(r,0)); }
  }
  await enc.flush(); enc.close(); if(err) throw err;
  muxer.finalize();
  return {data:new Uint8Array(muxer.target.buffer),codec:pick.label};
}
async function pmDownloadMotion(){
  if(pmMotionBusy) return;
  if(typeof VideoEncoder==='undefined'){ setStatus('Motion tests need Chrome or Edge, which can encode video'); return; }
  const M=pmBuild(); if(!M.L.length){ setStatus('Choose an LED panel for a screen first'); return; }
  const pm=pmOf(), fps=+pm.mFps||30, secs=pmMotionLen(pm), base=fileBase();
  const btn=document.getElementById('pmMo'), bar=document.getElementById('pmMoBar'), msg=document.getElementById('pmMoMsg');
  pmMotionBusy=true; pmMotionCancel=false; btn.textContent='Stop'; btn.onclick=()=>{ pmMotionCancel=true; };
  const files=[], skipped=[], codecs=new Set(), names=new Set();
  try{
    for(let k=0;k<M.slices.length;k++){
      const o=M.slices[k];
      msg.textContent=`Encoding ${o.name} (${k+1} of ${M.slices.length}) · ${o.W} × ${o.H}`;
      const r=await pmEncodeSlice(M,o,fps,secs,p=>{ bar.style.width=(((k+p)/M.slices.length)*100).toFixed(1)+'%'; });
      if(r.skip){ skipped.push(r.skip); continue; }
      codecs.add(r.codec);
      const nm0=`Motion test patterns/${String(o.name).replace(/[\\\\/:*?"<>|]+/g,'-').trim()||'Screen'}`;
      let nm=`${nm0} ${o.W}x${o.H}.mp4`, n2=2;
      while(names.has(nm)) nm=`${nm0} (${n2++}) ${o.W}x${o.H}.mp4`;
      names.add(nm); files.push({name:nm,data:r.data});
    }
    bar.style.width='100%';
    if(!files.length) throw new Error(skipped[0]||'nothing encoded');
    download(new Blob([zipStore(files)],{type:'application/zip'}),`${base} motion tests.zip`);
    msg.textContent=`${files.length} clip${files.length===1?'':'s'} · ${[...codecs].join(' + ')} · ${secs} s at ${fps} fps`+(skipped.length?` · skipped: ${skipped.join('; ')}`:'');
    setStatus(`Motion tests downloaded — ${files.length} MP4${files.length===1?'':'s'}`);
  }catch(e){
    msg.textContent=e.message==='cancelled'?'Stopped.':'Could not finish: '+e.message;
    if(e.message!=='cancelled') console.error(e);
  }finally{
    pmMotionBusy=false; btn.textContent='Download motion tests (.zip of MP4s)'; btn.onclick=pmDownloadMotion;
    setTimeout(()=>{ if(!pmMotionBusy) bar.style.width='0'; },2500);
  }
}

/* one zip: composition, every output, the overview sheet and a slice list */
async function pmDownload(){
  const btn=document.getElementById('pmDl'); btn.disabled=true; const was=btn.textContent; btn.textContent='Building…';
  try{
    const M=pmBuild(); if(!M.L.length) throw new Error('No screens with panels yet');
    const base=fileBase(), files=[];
    const png=async c=>new Uint8Array(await (await new Promise(r=>c.toBlob(r,'image/png'))).arrayBuffer());
    files.push({name:`${base} - Composition ${M.compW}x${M.compH}.png`,data:await png(pmCompCanvas(M))});
    for(const o of M.outs) files.push({name:`${base} - Output ${o.n} ${o.W}x${o.H}.png`,data:await png(pmOutCanvas(M,o))});
    files.push({name:`${base} - Pixel map overview.png`,data:await png(pmOverviewCanvas(M))});
    const safe=t=>String(t).replace(/[\\/:*?"<>|]+/g,'-').trim()||'Screen';
    const used=new Set();
    for(const o of M.slices){
      let nm=`Slice test patterns/${safe(o.name)} ${o.W}x${o.H}.png`, k=2;
      while(used.has(nm)) nm=`Slice test patterns/${safe(o.name)} (${k++}) ${o.W}x${o.H}.png`;
      used.add(nm); files.push({name:nm,data:await png(pmSliceCanvas(M,o))});
    }
    const q=v=>'"'+String(v).replace(/"/g,'""')+'"';
    const csv=[['Slice','Input X','Input Y','Input W','Input H','LED W','LED H','Output','Output X','Output Y','Output size','Processor','Panel','Cabinets']]
      .concat(M.slices.map(o=>[o.name,o.ix,o.iy,o.iw,o.ih,o.W,o.H,o.out,o.ox,o.oy,`${M.outs[o.out-1].W}x${M.outs[o.out-1].H}`,
        o.unit?unitLabel(o.unit):'',`${o.p.brand} ${o.p.model}`,`${o.s.cols}x${o.s.rows}`]))
      .map(r=>r.map(q).join(',')).join('\r\n');
    files.push({name:`${base} - Slices.csv`,data:csv});
    files.push({name:`${base} - Resolume Advanced Output.xml`,data:pmResolumeXML(M,`${base} pixel map`)});
    download(new Blob([zipStore(files)],{type:'application/zip'}),`${base} pixel map.zip`);
    setStatus(`Pixel map downloaded — ${files.length} files`);
  }catch(e){ console.error(e); setStatus('Pixel map failed: '+e.message); }
  finally{ btn.disabled=false; btn.textContent=was; }
}
(function(){
  const c=document.getElementById('pmcv'); if(!c) return;
  c.addEventListener('mousedown',pmDown);
  window.addEventListener('mousemove',pmMove);
  window.addEventListener('mouseup',pmUp);
  window.addEventListener('resize',()=>{ if(pmOpen) pmRender(); });
})();

