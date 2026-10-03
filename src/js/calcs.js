/* ========================= CALCS ========================= */
function circuitCalc(s,ch){
  const p=panelById(s.panelId), o=opt();
  const w=p?(o.useAvg?p.wavg:p.wmax)*LT(s,ch).length:0;
  const volts=o.volts||120, cap=(o.breaker||20)*(o.derate?0.8:1);
  return {w,volts,cap,amps:w/volts,breaker:o.breaker||20,pct:cap?(w/volts)/cap*100:0};
}
function runCalc(s,ch){
  const p=panelById(s.panelId), pr=procOf(s);
  const px=p?p.pw*p.ph*LT(s,ch).length:0;
  const cap=portCap(pr);
  return {px,cap,pct:cap?px/cap*100:0};
}
function totals(s){
  const p=panelById(s.panelId), n=p?tileCount(s):0, ap=new Set(), ad=new Set();
  if(!p) return {tiles:0,px:0,resW:0,resH:0,wMax:0,wAvg:0,lb:0,wmm:0,hmm:0,noPwr:0,noDat:0};
  s.circuits.forEach(c=>LT(s,c).forEach(t=>ap.add(t)));
  s.runs.forEach(c=>LT(s,c).forEach(t=>ad.add(t)));
  return {tiles:n,px:n*p.pw*p.ph,resW:s.cols*p.pw,resH:s.rows*p.ph,
    wMax:n*p.wmax,wAvg:n*p.wavg,lb:n*(p.lb||0),
    wmm:s.cols*p.wmm,hmm:s.rows*p.hmm,noPwr:n-ap.size,noDat:n-ad.size};
}
function setTotalsCalc(){
  let tiles=0,wMax=0,wAvg=0,px=0,circ=0,runs=0,lb=0;
  S.screens.forEach(s=>{const t=totals(s);tiles+=t.tiles;wMax+=t.wMax;wAvg+=t.wAvg;px+=t.px;lb+=t.lb;
    circ+=used(s,'power').length;runs+=used(s,'data').length;});
  return {tiles,wMax,wAvg,px,circ,runs,lb};
}

