/* ========================= SNAPPING ========================= */
const ovY=(a,ab,b,bb)=>a.y<b.y+bb.h&&b.y<a.y+ab.h;
const ovX=(a,ab,b,bb)=>a.x<b.x+bb.w&&b.x<a.x+ab.w;
function snapPos(s,nx,ny,free){
  dragGuides=[];
  if(free||!opt().snap) return {x:nx,y:ny};
  const b=sbox(s), th=9/view.k;
  const others=S.screens.filter(o=>o!==s).map(o=>({o,ob:sbox(o)}));
  const vC=[], hC=[];

  /* edge and centre alignment */
  others.forEach(({o,ob})=>{
    [[0,o.x],[0,o.x+ob.w],[b.w,o.x],[b.w,o.x+ob.w],[b.w/2,o.x+ob.w/2]]
      .forEach(([m,t])=>vC.push({pos:t-m,g:[{t:'v',at:t}]}));
    [[0,o.y],[0,o.y+ob.h],[b.h,o.y],[b.h,o.y+ob.h],[b.h/2,o.y+ob.h/2]]
      .forEach(([m,t])=>hC.push({pos:t-m,g:[{t:'h',at:t}]}));
  });

  /* gaps that already exist between the other screens */
  const gapsX=new Map(), gapsY=new Map();
  for(let i=0;i<others.length;i++) for(let j=0;j<others.length;j++){
    if(i===j) continue;
    const A=others[i], B=others[j];
    const gx=Math.round(B.o.x-(A.o.x+A.ob.w));
    if(gx>0&&ovY(A.o,A.ob,B.o,B.ob)&&!gapsX.has(gx))
      gapsX.set(gx,{x1:A.o.x+A.ob.w,x2:B.o.x,y:Math.max(A.o.y,B.o.y)+Math.min(A.ob.h,B.ob.h)/2});
    const gy=Math.round(B.o.y-(A.o.y+A.ob.h));
    if(gy>0&&ovX(A.o,A.ob,B.o,B.ob)&&!gapsY.has(gy))
      gapsY.set(gy,{y1:A.o.y+A.ob.h,y2:B.o.y,x:Math.max(A.o.x,B.o.x)+Math.min(A.ob.w,B.ob.w)/2});
  }
  /* match an existing gap on either side of any screen */
  others.forEach(({o,ob})=>{
    const ym=o.y+ob.h/2, xm=o.x+ob.w/2;
    gapsX.forEach((src,g)=>{
      vC.push({pos:o.x-g-b.w,g:[{t:'gx',x1:o.x-g,x2:o.x,y:ym,v:g},{t:'gx',x1:src.x1,x2:src.x2,y:src.y,v:g}]});
      vC.push({pos:o.x+ob.w+g,g:[{t:'gx',x1:o.x+ob.w,x2:o.x+ob.w+g,y:ym,v:g},{t:'gx',x1:src.x1,x2:src.x2,y:src.y,v:g}]});
    });
    gapsY.forEach((src,g)=>{
      hC.push({pos:o.y-g-b.h,g:[{t:'gy',y1:o.y-g,y2:o.y,x:xm,v:g},{t:'gy',y1:src.y1,y2:src.y2,x:src.x,v:g}]});
      hC.push({pos:o.y+ob.h+g,g:[{t:'gy',y1:o.y+ob.h,y2:o.y+ob.h+g,x:xm,v:g},{t:'gy',y1:src.y1,y2:src.y2,x:src.x,v:g}]});
    });
  });

  let bv=null,bh=null;
  vC.forEach(c=>{const d=Math.abs(nx-c.pos); if(d<th&&(!bv||d<bv.d)) bv=Object.assign({d},c);});
  hC.forEach(c=>{const d=Math.abs(ny-c.pos); if(d<th&&(!bh||d<bh.d)) bh=Object.assign({d},c);});
  let x,y;
  if(bv){ x=bv.pos; dragGuides.push.apply(dragGuides,bv.g); } else x=Math.round(nx/SNAP)*SNAP;
  if(bh){ y=bh.pos; dragGuides.push.apply(dragGuides,bh.g); } else y=Math.round(ny/SNAP)*SNAP;
  return {x,y};
}

