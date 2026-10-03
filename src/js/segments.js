/* ---- the sliding pill behind the active segment ---- */
function segSync(){
  document.querySelectorAll('.seg').forEach(seg=>{
    const on=seg.querySelector('button.on');
    if(!on||!seg.offsetWidth){ seg.style.setProperty('--io','0'); return; }
    seg.style.setProperty('--ix',on.offsetLeft+'px'); seg.style.setProperty('--iw',on.offsetWidth+'px');
    seg.style.setProperty('--iy',on.offsetTop+'px'); seg.style.setProperty('--ih',on.offsetHeight+'px');
    seg.style.setProperty('--io','1'); seg.dataset.on=on.dataset.m||on.dataset.l||'';
  });
}
new MutationObserver(m=>{ if(m.some(r=>r.target.closest&&(r.target.closest('.seg')||r.target.classList.contains('mask')||r.target.id==='stModal')))
  requestAnimationFrame(segSync); })
  .observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});
window.addEventListener('resize',()=>requestAnimationFrame(segSync));

