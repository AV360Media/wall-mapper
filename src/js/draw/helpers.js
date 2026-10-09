/* ========================= DRAW HELPERS ========================= */
function roundRect(ctx,x,y,w,h,r){
  r=Math.max(0,Math.min(r,w/2,h/2));
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
}
function txt(ctx,s,x,y,font,color,align,alpha){
  ctx.save(); ctx.font=font; ctx.fillStyle=color;
  ctx.textAlign=align||'left'; ctx.textBaseline='alphabetic';
  if(alpha!=null) ctx.globalAlpha=alpha;
  ctx.fillText(s,x,y); ctx.restore();
}
function clipText(ctx,t,maxW,font){
  ctx.save(); ctx.font=font;
  if(ctx.measureText(t).width<=maxW){ ctx.restore(); return t; }
  let lo=0,hi=t.length;
  while(lo<hi){ const m=(lo+hi+1)>>1;
    if(ctx.measureText(t.slice(0,m)+'\u2026').width<=maxW) lo=m; else hi=m-1; }
  ctx.restore(); return t.slice(0,lo)+'\u2026';
}
/* shrink, then drop trailing detail, so the header line always fits its bar */
function fitMeta(ctx,segs,maxW){
  for(let fs=8.5;fs>=6.25;fs-=0.25){
    const f='500 '+fs.toFixed(2)+'px '+FS;
    ctx.save(); ctx.font=f;
    for(let n=segs.length;n>=2;n--){
      const t=segs.slice(0,n).join(' \u00b7 ');
      if(ctx.measureText(t).width<=maxW){ ctx.restore(); return {t,f}; }
    }
    ctx.restore();
  }
  const f='500 6.25px '+FS;
  return {t:clipText(ctx,segs.join(' \u00b7 '),maxW,f),f};
}
function chipDraw(ctx,x,y,label,color,corner,fs){
  fs=fs||7.5;
  ctx.save(); ctx.font=`600 ${fs}px ${FS}`;
  const w=Math.max(12,ctx.measureText(label).width+7), h=fs+4.5;
  const bx=corner[1]==='r'?x-w:x, by=corner[0]==='b'?y-h:y;
  const fillc=ink(color);
  roundRect(ctx,bx,by,w,h,h/2); ctx.fillStyle=fillc; ctx.fill();
  ctx.fillStyle=onColor(fillc); ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(label,bx+w/2,by+h/2+0.5); ctx.restore();
}

