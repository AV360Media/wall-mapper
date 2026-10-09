/* ========================= VECTOR PDF ========================= */
/* A canvas-shaped recorder. The same draw functions that paint the screen paint PDF operators here,
   so lines and type stay sharp at any print size and the text can be searched and copied.
   Geometry is transformed in JS and written in page space; text is set in embedded Outfit. */
const PAPERS={letter:[612,792,'Letter'],tabloid:[792,1224,'Tabloid 11×17'],a4:[595.28,841.89,'A4'],a3:[841.89,1190.55,'A3']};
const pdfN=v=>{ const r=Math.round(v*100)/100; return Object.is(r,-0)?'0':String(r); };
const mMul=(m,n)=>[m[0]*n[0]+m[2]*n[1],m[1]*n[0]+m[3]*n[1],m[0]*n[2]+m[2]*n[3],m[1]*n[2]+m[3]*n[3],m[0]*n[4]+m[2]*n[5]+m[4],m[1]*n[4]+m[3]*n[5]+m[5]];
function pdfColor(c){
  if(!c||typeof c!=='string') return [0,0,0,1];
  c=c.trim().toLowerCase();
  if(c==='transparent') return [0,0,0,0];
  if(c==='white') return [1,1,1,1];
  if(c==='black') return [0,0,0,1];
  if(c[0]==='#'){
    let h=c.slice(1); if(h.length<=4) h=h.split('').map(x=>x+x).join('');
    const n=k=>parseInt(h.slice(k,k+2),16)/255;
    return [n(0),n(2),n(4),h.length>=8?n(6):1];
  }
  const m=c.match(/[\d.]+%?/g);
  if(m&&/^rgb/.test(c)) return [+m[0]/255,+m[1]/255,+m[2]/255,m[3]!=null?(m[3].endsWith('%')?parseFloat(m[3])/100:+m[3]):1];
  return [0,0,0,1];
}
/* ---- the document: fonts, alpha states and images are shared by every page ---- */
class PdfDoc{
  constructor(){ this.objs=[]; this.pages=[]; this.fonts={}; this.gs={}; this.imgs=[]; }
  obj(body){ this.objs.push(body); return this.objs.length+2; }   /* 1 = catalog, 2 = page tree */
  font(w){
    if(this.fonts[w]) return this.fonts[w];
    const F=PDF_FONTS[w], k=1000/F.upm, name=`WM${'ABCD'[[400,500,600,700].indexOf(w)]}AAA+Outfit-${w}`;
    const ttf=b64ToBytes(F.ttf);
    const file=this.obj({dict:`/Length ${ttf.length} /Length1 ${F.len} /Filter /FlateDecode`,data:ttf});
    const desc=this.obj(`<< /Type /FontDescriptor /FontName /${name} /Flags 32 /FontBBox [${F.bbox.map(v=>Math.round(v*k)).join(' ')}] /ItalicAngle 0 /Ascent ${Math.round(F.asc*k)} /Descent ${Math.round(F.desc*k)} /CapHeight ${Math.round(F.cap*k)} /StemV 80 /FontFile2 ${file} 0 R >>`);
    const W=F.w.map(v=>Math.round(v*k)).join(' ');
    const cid=this.obj(`<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${name} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${desc} 0 R /CIDToGIDMap /Identity /W [0 [${W}]] >>`);
    const pairs=Object.entries(F.u2g).map(([u,g])=>`<${(+g).toString(16).padStart(4,'0')}> <${(+u).toString(16).padStart(4,'0')}>`);
    let cm='/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n';
    for(let i=0;i<pairs.length;i+=100){ const p=pairs.slice(i,i+100); cm+=`${p.length} beginbfchar\n${p.join('\n')}\nendbfchar\n`; }
    cm+='endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend\n';
    const tu=this.obj({dict:'',data:cm});
    const t0=this.obj(`<< /Type /Font /Subtype /Type0 /BaseFont /${name} /Encoding /Identity-H /DescendantFonts [${cid} 0 R] /ToUnicode ${tu} 0 R >>`);
    return this.fonts[w]={ref:t0,name:'F'+w};
  }
  alpha(a){ const k='A'+Math.round(a*100); if(!this.gs[k]) this.gs[k]=this.obj(`<< /Type /ExtGState /ca ${pdfN(a)} /CA ${pdfN(a)} >>`); return k; }
  image(src){
    const z=Math.min(1,2400/src.width), c=document.createElement('canvas');   /* ~220 dpi on a Letter sheet */
    c.width=Math.round(src.width*z); c.height=Math.round(src.height*z);
    const x=c.getContext('2d'); x.fillStyle='#fff'; x.fillRect(0,0,c.width,c.height); x.drawImage(src,0,0,c.width,c.height);
    const jpg=b64ToBytes(c.toDataURL('image/jpeg',0.88).split(',')[1]);
    const ref=this.obj({dict:`/Type /XObject /Subtype /Image /Width ${c.width} /Height ${c.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length}`,data:jpg,raw:1});
    this.imgs.push(ref); return 'Im'+ref;
  }
  page(W,H,ctx){ this.pages.push({W,H,ctx}); }
  async blob(){
    const enc=new TextEncoder(), parts=[]; let len=0; const off=[];
    const push=x=>{ const b=typeof x==='string'?enc.encode(x):x; parts.push(b); len+=b.length; };
    const pageRefs=[];
    for(const p of this.pages){
      const raw=enc.encode(p.ctx.ops.join('\n')+'\n'), cs=await deflate(raw);
      const content=this.obj({dict:`/Length ${(cs||raw).length}${cs?' /Filter /FlateDecode':''}`,data:cs||raw});
      const fonts=Object.values(this.fonts).filter(f=>p.ctx.used.has(f.name)).map(f=>`/${f.name} ${f.ref} 0 R`).join(' ');
      const gs=Object.entries(this.gs).filter(([k])=>p.ctx.used.has(k)).map(([k,r])=>`/${k} ${r} 0 R`).join(' ');
      const im=this.imgs.filter(r=>p.ctx.used.has('Im'+r)).map(r=>`/Im${r} ${r} 0 R`).join(' ');
      pageRefs.push(this.obj(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pdfN(p.W)} ${pdfN(p.H)}] /Resources << /Font << ${fonts} >> /ExtGState << ${gs} >> /XObject << ${im} >> >> /Contents ${content} 0 R >>`));
    }
    push('%PDF-1.6\n'); push(new Uint8Array([0x25,0xE2,0xE3,0xCF,0xD3,0x0A]));
    const info=`<< /Title (${pdfEsc(titleShow())}) /Creator (Wall Mapper) /Producer (Wall Mapper) >>`;
    off[1]=len; push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R /ViewerPreferences << /DisplayDocTitle true >> >>\nendobj\n`);
    off[2]=len; push(`2 0 obj\n<< /Type /Pages /Kids [${pageRefs.map(r=>r+' 0 R').join(' ')}] /Count ${pageRefs.length} >>\nendobj\n`);
    const infoRef=this.obj(info);
    this.objs.forEach((o,i)=>{
      const n=i+3; off[n]=len;
      if(typeof o==='string'){ push(`${n} 0 obj\n${o}\nendobj\n`); return; }
      const data=typeof o.data==='string'?enc.encode(o.data):o.data;
      push(`${n} 0 obj\n<< ${o.dict.includes('/Length')?o.dict:o.dict+' /Length '+data.length} >>\nstream\n`); push(data); push('\nendstream\nendobj\n');
    });
    const total=this.objs.length+2, xref=len;
    let x='xref\n0 '+(total+1)+'\n0000000000 65535 f \n';
    for(let i=1;i<=total;i++) x+=String(off[i]).padStart(10,'0')+' 00000 n \n';
    push(x); push(`trailer\n<< /Size ${total+1} /Root 1 0 R /Info ${infoRef} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    const out=new Uint8Array(len); let o=0; parts.forEach(b=>{ out.set(b,o); o+=b.length; });
    return new Blob([out],{type:'application/pdf'});
  }
}
/* zlib stream for /FlateDecode; page content shrinks about tenfold */
async function deflate(u8){
  if(typeof CompressionStream==='undefined') return null;
  return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
}
const pdfEsc=s=>String(s).replace(/[\\()]/g,m=>'\\'+m).replace(/[^\x20-\x7e]/g,'');

/* ---- one page's drawing surface, shaped like CanvasRenderingContext2D ---- */
class PdfCtx{
  constructor(doc,W,H){
    this.doc=doc; this.ops=[]; this.used=new Set(); this.canvas={width:W,height:H};
    this.st={M:[1,0,0,-1,0,H],fill:'#000',stroke:'#000',lw:1,cap:'butt',join:'miter',dash:[],dashOff:0,alpha:1,
      font:'10px sans-serif',align:'start',base:'alphabetic',ls:'0px'};
    this.stack=[]; this.path=[]; this.cur=null; this.start=null;
    this.shadowColor=''; this.shadowBlur=0; this.shadowOffsetX=0; this.shadowOffsetY=0;
    this.imageSmoothingEnabled=true; this.miterLimit=10; this.globalCompositeOperation='source-over';
  }
  get fillStyle(){ return this.st.fill; } set fillStyle(v){ this.st.fill=v; }
  get strokeStyle(){ return this.st.stroke; } set strokeStyle(v){ this.st.stroke=v; }
  get lineWidth(){ return this.st.lw; } set lineWidth(v){ if(v>0) this.st.lw=+v; }
  get lineCap(){ return this.st.cap; } set lineCap(v){ this.st.cap=v; }
  get lineJoin(){ return this.st.join; } set lineJoin(v){ this.st.join=v; }
  get globalAlpha(){ return this.st.alpha; } set globalAlpha(v){ this.st.alpha=Math.max(0,Math.min(1,+v)); }
  get font(){ return this.st.font; } set font(v){ this.st.font=v; }
  get textAlign(){ return this.st.align; } set textAlign(v){ this.st.align=v; }
  get textBaseline(){ return this.st.base; } set textBaseline(v){ this.st.base=v; }
  get letterSpacing(){ return this.st.ls; } set letterSpacing(v){ this.st.ls=v; }
  get lineDashOffset(){ return this.st.dashOff; } set lineDashOffset(v){ this.st.dashOff=+v; }
  setLineDash(a){ this.st.dash=(a||[]).slice(); } getLineDash(){ return this.st.dash.slice(); }
  save(){ this.stack.push(JSON.parse(JSON.stringify(this.st))); this.ops.push('q'); }
  restore(){ if(!this.stack.length) return; this.st=this.stack.pop(); this.ops.push('Q'); }
  setTransform(a,b,c,d,e,f){ if(typeof a==='object'){ ({a,b,c,d,e,f}=a); } this.st.M=mMul(this.base||[1,0,0,1,0,0],[a,b,c,d,e,f]); }
  resetTransform(){ this.setTransform(1,0,0,1,0,0); }
  transform(a,b,c,d,e,f){ this.st.M=mMul(this.st.M,[a,b,c,d,e,f]); }
  translate(x,y){ this.transform(1,0,0,1,x,y); }
  scale(x,y){ this.transform(x,0,0,y==null?x:y,0,0); }
  rotate(t){ const c=Math.cos(t), s=Math.sin(t); this.transform(c,s,-s,c,0,0); }
  P(x,y){ const m=this.st.M; return [m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]]; }
  get k(){ const m=this.st.M; return Math.sqrt(Math.abs(m[0]*m[3]-m[1]*m[2])); }
  beginPath(){ this.path=[]; this.cur=null; this.start=null; }
  moveTo(x,y){ const p=this.P(x,y); this.path.push(`${pdfN(p[0])} ${pdfN(p[1])} m`); this.cur=p; this.start=p; this.uc=[x,y]; }
  lineTo(x,y){ if(!this.cur) return this.moveTo(x,y); const p=this.P(x,y); this.path.push(`${pdfN(p[0])} ${pdfN(p[1])} l`); this.cur=p; this.uc=[x,y]; }
  bezierCurveTo(a,b,c,d,x,y){ if(!this.cur) this.moveTo(a,b); const p1=this.P(a,b),p2=this.P(c,d),p=this.P(x,y);
    this.path.push(`${pdfN(p1[0])} ${pdfN(p1[1])} ${pdfN(p2[0])} ${pdfN(p2[1])} ${pdfN(p[0])} ${pdfN(p[1])} c`); this.cur=p; this.uc=[x,y]; }
  quadraticCurveTo(cx,cy,x,y){ if(!this.cur) this.moveTo(cx,cy); const [x0,y0]=this.uc;
    this.bezierCurveTo(x0+2/3*(cx-x0),y0+2/3*(cy-y0),x+2/3*(cx-x),y+2/3*(cy-y),x,y); }
  arc(x,y,r,a0,a1,ccw){
    let d=a1-a0;
    if(!ccw&&d<0) d=d%(2*Math.PI)+2*Math.PI; if(ccw&&d>0) d=d%(2*Math.PI)-2*Math.PI;
    if(Math.abs(a1-a0)>=2*Math.PI) d=ccw?-2*Math.PI:2*Math.PI;
    const sx=x+r*Math.cos(a0), sy=y+r*Math.sin(a0);
    this.cur?this.lineTo(sx,sy):this.moveTo(sx,sy);
    const n=Math.max(1,Math.ceil(Math.abs(d)/(Math.PI/2))), s=d/n, kk=4/3*Math.tan(s/4);
    for(let i=0;i<n;i++){ const t0=a0+i*s, t1=t0+s;
      this.bezierCurveTo(x+r*(Math.cos(t0)-kk*Math.sin(t0)),y+r*(Math.sin(t0)+kk*Math.cos(t0)),
        x+r*(Math.cos(t1)+kk*Math.sin(t1)),y+r*(Math.sin(t1)-kk*Math.cos(t1)),x+r*Math.cos(t1),y+r*Math.sin(t1)); }
  }
  ellipse(x,y,rx,ry,rot,a0,a1,ccw){ this.save(); this.translate(x,y); this.rotate(rot||0); this.scale(rx,ry);
    const keep=this.ops.length; this.arc(0,0,1,a0,a1,ccw); this.ops.length=keep; this.st=this.stack.pop(); this.ops.pop(); }
  rect(x,y,w,h){ this.moveTo(x,y); this.lineTo(x+w,y); this.lineTo(x+w,y+h); this.lineTo(x,y+h); this.closePath(); }
  roundRect(x,y,w,h,r){ roundRectPath(this,x,y,w,h,typeof r==='number'?r:(r&&r[0])||0); }
  closePath(){ if(this.cur){ this.path.push('h'); this.cur=this.start; } }
  col(c,stroke){
    const [r,g,b,a]=pdfColor(typeof c==='string'?c:(c&&c.c0)||'#000');
    this.ops.push(`${pdfN(r)} ${pdfN(g)} ${pdfN(b)} ${stroke?'RG':'rg'}`);
    return a;
  }
  setAlpha(a){ a=Math.round(a*this.st.alpha*100)/100; const k=this.doc.alpha(a); this.used.add(k); this.ops.push(`/${k} gs`); }
  strokeState(){
    const k=this.k;
    this.ops.push(`${pdfN(this.st.lw*k)} w ${{butt:0,round:1,square:2}[this.st.cap]||0} J ${{miter:0,round:1,bevel:2}[this.st.join]||0} j`);
    const d=this.st.dash.filter(v=>v>=0);
    this.ops.push(d.length&&d.some(v=>v>0)?`[${(d.length%2?d.concat(d):d).map(v=>pdfN(v*k)).join(' ')}] ${pdfN(this.st.dashOff*k)} d`:'[] 0 d');
  }
  fill(rule){ if(!this.path.length) return; const a=this.col(this.st.fill); if(!a) return; this.setAlpha(a);
    this.ops.push(this.path.join(' ')+(rule==='evenodd'?' f*':' f')); }
  stroke(){ if(!this.path.length) return; const a=this.col(this.st.stroke,1); if(!a) return; this.setAlpha(a); this.strokeState();
    this.ops.push(this.path.join(' ')+' S'); }
  clip(rule){ if(!this.path.length) return; this.ops.push(this.path.join(' ')+(rule==='evenodd'?' W* n':' W n')); }
  fillRect(x,y,w,h){ const keep=[this.path,this.cur,this.start]; this.beginPath(); this.rect(x,y,w,h); this.fill(); [this.path,this.cur,this.start]=keep; }
  strokeRect(x,y,w,h){ const keep=[this.path,this.cur,this.start]; this.beginPath(); this.rect(x,y,w,h); this.stroke(); [this.path,this.cur,this.start]=keep; }
  clearRect(){}
  /* ---- type ---- */
  fontSpec(){
    const f=this.st.font, m=f.match(/([\d.]+)px/), size=m?+m[1]:10;
    let w=400; const wm=f.match(/\b([1-9]00|[1-9]50)\b/); if(wm) w=+wm[1]; else if(/\bbold\b/.test(f)) w=700;
    w=[400,500,600,700].reduce((a,b)=>Math.abs(b-w)<Math.abs(a-w)?b:a,400);
    if(w===700&&wm&&+wm[1]===650) w=600;
    return {w,size,F:PDF_FONTS[w]};
  }
  glyphs(t,F){ const g=[]; for(const ch of String(t)){ const u=ch.codePointAt(0); let id=F.u2g[u];
      if(id==null) id=F.u2g[{0x2192:0x3e,0x25b6:0x3e,0x26a1:0x2a}[u]]||F.u2g[0x3f]; g.push(id); } return g; }
  ls(size){ const v=parseFloat(this.st.ls)||0; return /em$/.test(this.st.ls)?v*size:v; }
  measureText(t){ const {size,F}=this.fontSpec(), g=this.glyphs(t,F), ls=this.ls(size);
    const width=g.reduce((a,id)=>a+F.w[id],0)*size/F.upm+ls*g.length;
    return {width,actualBoundingBoxAscent:F.asc*size/F.upm,actualBoundingBoxDescent:-F.desc*size/F.upm,
      fontBoundingBoxAscent:F.asc*size/F.upm,fontBoundingBoxDescent:-F.desc*size/F.upm}; }
  text(t,x,y,stroke,maxW){
    t=String(t); if(!t) return;
    const {w,size,F}=this.fontSpec(), font=this.doc.font(w); this.used.add(font.name);
    let width=this.measureText(t).width, sx=1;
    if(maxW!=null&&width>maxW&&width>0){ sx=maxW/width; width=maxW; }
    const al=this.st.align; if(al==='center') x-=width/2; else if(al==='right'||al==='end') x-=width;
    const u=size/F.upm, b=this.st.base;
    if(b==='middle') y+=(F.asc+F.desc)/2*u; else if(b==='top'||b==='hanging') y+=F.asc*u; else if(b==='bottom'||b==='ideographic') y+=F.desc*u;
    const T=mMul(this.st.M,[sx,0,0,-1,x,y]);
    const a=this.col(stroke?this.st.stroke:this.st.fill,stroke); if(!a) return; this.setAlpha(a);
    if(stroke) this.strokeState();
    const hex=this.glyphs(t,F).map(id=>id.toString(16).padStart(4,'0')).join('');
    this.ops.push(`BT /${font.name} ${pdfN(size)} Tf ${pdfN(this.ls(size))} Tc ${stroke?'1':'0'} Tr ${T.map(v=>pdfN(v)).join(' ')} Tm <${hex}> Tj ET`);
  }
  fillText(t,x,y,m){ this.text(t,x,y,false,m); }
  strokeText(t,x,y,m){ this.text(t,x,y,true,m); }
  drawImage(img,...a){
    let sx=0,sy=0,sw=img.width,sh=img.height,dx,dy,dw,dh;
    if(a.length===2){ [dx,dy]=a; dw=sw; dh=sh; } else if(a.length===4){ [dx,dy,dw,dh]=a; } else { [sx,sy,sw,sh,dx,dy,dw,dh]=a; }
    let src=img;
    if(sx||sy||sw!==img.width||sh!==img.height){ src=document.createElement('canvas'); src.width=Math.max(1,Math.round(sw)); src.height=Math.max(1,Math.round(sh));
      src.getContext('2d').drawImage(img,sx,sy,sw,sh,0,0,sw,sh); }
    const name=this.doc.image(src); this.used.add(name);
    const T=mMul(this.st.M,[dw,0,0,-dh,dx,dy+dh]);
    this.ops.push('q'); this.setAlpha(1); this.ops.push(`${T.map(v=>pdfN(v)).join(' ')} cm /${name} Do`,'Q');
  }
  createLinearGradient(){ return {c0:null,addColorStop(o,c){ if(this.c0==null) this.c0=c; }}; }
  createRadialGradient(){ return this.createLinearGradient(); }
  createPattern(){ return '#888'; }
  getImageData(){ return {data:new Uint8ClampedArray(4)}; }
  isPointInPath(){ return false; }
}
function roundRectPath(ctx,x,y,w,h,r){
  r=Math.max(0,Math.min(r,w/2,h/2));
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
}
