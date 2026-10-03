/* ========================= CABLING ========================= */
const CVTS={
  'cvt10pro':{name:'NovaStar CVT10 Pro',ports:10,fibers:2,mode:'single-mode',note:'10 ports with MX40 Pro, 8 with others'},
  'cvt4ks':  {name:'NovaStar CVT4K-S',  ports:16,fibers:2,mode:'single-mode',note:'OPT1 feeds ports 1–8, OPT2 feeds 9–16'},
  'cvt320':  {name:'NovaStar CVT320',   ports:1, fibers:1,mode:'single-mode',note:'single port, up to 15 km'},
  'cvt310':  {name:'NovaStar CVT310',   ports:1, fibers:1,mode:'multi-mode', note:'single port, up to 300 m'}
};
const BRK={edison:'Edison',true1:'TRUE1',powercon:'powerCON'};
const defCable=()=>({
  trunk:'soca', soca:6, breakout:'edison',
  pJump:3, pJumpType:'true1', pTail:10,
  feed:'copper', cvt:'cvt10pro', cvtName:'', cvtPorts:8,
  cvtQty:0, cvtSender:'auto', fiberQty:0, fiberLen:250, fiberBackup:true,
  dJump:3, dTail:25
});
function cabOf(){ if(!S.cable||!S.cable._i){ S.cable=Object.assign(defCable(),S.cable||{},{_i:1}); } return S.cable; }
const procHasFiber=pr=>/fiber|10G|100G|SFP/i.test(pr.pt||'');
function cvtSpec(){
  const C0=cabOf();
  if(C0.cvt==='custom') return {name:C0.cvtName||'House fibre converter',
    ports:Math.max(1,C0.cvtPorts|0),mode:'',note:'custom entry'};
  return CVTS[C0.cvt]||CVTS.cvt10pro;
}

