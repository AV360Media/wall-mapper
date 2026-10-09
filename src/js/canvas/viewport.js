/* ========================= VIEWPORT ========================= */
const stage=document.getElementById('stage'), cv=document.getElementById('cv');
function redraw(){
  const w=stage.clientWidth, h=stage.clientHeight, dpr=window.devicePixelRatio||1;
  cv.width=Math.round(w*dpr); cv.height=Math.round(h*dpr);
  cv.style.width=w+'px'; cv.style.height=h+'px';
  const ctx=cv.getContext('2d');
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle=C.bg; ctx.fillRect(0,0,w,h);
  { const step=22, ox=((view.x%step)+step)%step, oy=((view.y%step)+step)%step;   /* dot grid that pans with the view */
    ctx.fillStyle=C.dot||C.rule;
    for(let y=oy;y<h;y+=step) for(let x=ox;x<w;x+=step) ctx.fillRect(x-0.75,y-0.75,1.5,1.5); }
  ctx.translate(view.x,view.y); ctx.scale(view.k,view.k);
  const B=setBounds();
  if((mode==='arrange'||moving)&&focusIdx==null&&opt().snap) drawArrangeGrid(ctx,w,h);
  if(S.screens.length){
    ctx.save();
    ctx.translate(-(SETGAP-B.x1),-(titleH()-B.y1));
    drawSet(ctx,{interactive:true});
    ctx.restore();
  }
  if(dragGuides.length) drawGuides(ctx,B,w,h);
  document.getElementById('zoomPct').textContent=Math.round(view.k*100)+'%';
}
function drawArrangeGrid(ctx,w,h){
  const step=SNAP*4;
  const x0=Math.floor((-view.x/view.k)/step)*step, y0=Math.floor((-view.y/view.k)/step)*step;
  const x1=x0+w/view.k+step, y1=y0+h/view.k+step;
  ctx.save(); ctx.strokeStyle=C.rule; ctx.lineWidth=1/view.k;
  ctx.beginPath();
  for(let x=x0;x<x1;x+=step){ ctx.moveTo(x,y0); ctx.lineTo(x,y1); }
  for(let y=y0;y<y1;y+=step){ ctx.moveTo(x0,y); ctx.lineTo(x1,y); }
  ctx.stroke(); ctx.restore();
}
function drawGuides(ctx,B,w,h){
  ctx.save();
  const x0=-view.x/view.k, y0=-view.y/view.k, x1=x0+w/view.k, y1=y0+h/view.k;
  const K=view.k, mx=v=>opt().rear?B.x1+B.x2-v:v;
  const dim=(a,z,fixed,horiz,val)=>{
    ctx.strokeStyle='#c084fc'; ctx.fillStyle='#c084fc'; ctx.lineWidth=1.4/K;
    ctx.setLineDash([]); ctx.beginPath();
    if(horiz){ ctx.moveTo(a,fixed); ctx.lineTo(z,fixed);
      ctx.moveTo(a,fixed-6/K); ctx.lineTo(a,fixed+6/K);
      ctx.moveTo(z,fixed-6/K); ctx.lineTo(z,fixed+6/K); }
    else { ctx.moveTo(fixed,a); ctx.lineTo(fixed,z);
      ctx.moveTo(fixed-6/K,a); ctx.lineTo(fixed+6/K,a);
      ctx.moveTo(fixed-6/K,z); ctx.lineTo(fixed+6/K,z); }
    ctx.stroke();
    const label=ftIn(Math.abs(val)/MM);
    ctx.font='500 '+(9/K)+'px '+FS; ctx.textAlign='center'; ctx.textBaseline='middle';
    const tw=ctx.measureText(label).width+8/K, thh=13/K;
    const cx=horiz?(a+z)/2:fixed, cy=horiz?fixed-11/K:(a+z)/2;
    ctx.fillStyle='#0b0e14'; ctx.fillRect(cx-tw/2,cy-thh/2,tw,thh);
    ctx.strokeStyle='#c084fc'; ctx.lineWidth=1/K; ctx.strokeRect(cx-tw/2,cy-thh/2,tw,thh);
    ctx.fillStyle='#c084fc'; ctx.fillText(label,cx,cy);
  };
  dragGuides.forEach(g=>{
    if(g.t==='v'||g.t==='h'){
      ctx.strokeStyle=ACCENT; ctx.lineWidth=1.6/K; ctx.setLineDash([7/K,5/K]);
      ctx.beginPath();
      if(g.t==='v'){ const a=mx(g.at); ctx.moveTo(a,y0); ctx.lineTo(a,y1); }
      else { ctx.moveTo(x0,g.at); ctx.lineTo(x1,g.at); }
      ctx.stroke(); ctx.setLineDash([]);
    } else if(g.t==='gx'){
      let a=mx(g.x1), z=mx(g.x2); if(a>z){const t=a;a=z;z=t;}
      dim(a,z,g.y,true,g.v);
    } else if(g.t==='gy'){
      dim(g.y1,g.y2,opt().rear?B.x1+B.x2-g.x:g.x,false,g.v);
    }
  });
  ctx.restore();
}
function fitView(){
  const B=setBounds(), w=stage.clientWidth, h=stage.clientHeight;
  const T=titleH(), W=B.w+SETGAP*2, H=B.h+T+SETGAP;
  view.k=Math.max(0.03,Math.min(Math.min(w/W,h/H)*0.94,6));
  view.x=(w-W*view.k)/2+(SETGAP-B.x1)*view.k;
  view.y=(h-H*view.k)/2+(T-B.y1)*view.k;
  redraw();
}
function setZoom(k){ zoomAt(k,stage.clientWidth/2,stage.clientHeight/2); }
function zoomBy(f){ zoomAt(view.k*f,stage.clientWidth/2,stage.clientHeight/2); }
function zoomAt(k,sx,sy){
  k=Math.max(0.03,Math.min(8,k));
  const wx=(sx-view.x)/view.k, wy=(sy-view.y)/view.k;
  view.k=k; view.x=sx-wx*k; view.y=sy-wy*k; redraw();
}
cv.addEventListener('wheel',e=>{
  e.preventDefault();
  const r=cv.getBoundingClientRect();
  if(e.ctrlKey||e.metaKey) zoomAt(view.k*Math.pow(1.0022,-e.deltaY),e.clientX-r.left,e.clientY-r.top);
  else { view.x-=e.deltaX; view.y-=e.deltaY; redraw(); }
},{passive:false});

