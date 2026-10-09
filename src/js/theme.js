const SLOTS=20;
/* 20 colours spread across the full hue circle, ordered so no two chains
   within three positions look alike. Min ΔE 29.5 on screen, 25.7 in print. */
const PW_PAL=['#fc7200','#108cfe','#03cd80','#f84f3f','#9374fe','#49ba12','#e79a58','#f15def','#09aeef','#eaa700',
              '#fe3f74','#09acb4','#a5b401','#fd2fac','#b9b4f7','#63a344','#f49b9e','#d671b3','#8bddb4','#918e47'];
const DT_PAL=['#09aeef','#fc7200','#49ba12','#108cfe','#f84f3f','#63a344','#9374fe','#fe3f74','#03cd80','#eaa700',
              '#f15def','#09acb4','#a5b401','#fd2fac','#b9b4f7','#918e47','#8bddb4','#d671b3','#e79a58','#f49b9e'];
const DARK={bg:'#0a0b0d',head:'#f2f2f4',sub:'#a3a4ad',faint:'#686973',tile:'#1a1b20',line:'#2a2b32',chip:'#0d0e11',
  frame:'#121317',bar:'#15161b',edge:'#23242a',edgeOn:'#55565f',grip:'#34353c',gripOn:'#686973',
  dead:'#0f1013',deadEdge:'#2a2b32',bezel:'#0c0d10',big:'#ffffff',bigA:.8,bigDual:.38,
  rule:'#1e1f24',band:'#16171b',bandRule:'#1d1e23',cell:'#d6d6db',bad:'#ff6b6b',warn:'#f5a524',
  violet:'#c084fc',dataAcc:'#4fd1e0',ghost:'#34353c',dot:'#1b1c21',shadow:'rgba(0,0,0,.55)'};
const LIGHTUI={bg:'#f3f3f0',head:'#17181a',sub:'#5b5c61',faint:'#9c9da3',tile:'#f2f2ef',line:'#d9d9d4',chip:'#ffffff',
  frame:'#ffffff',bar:'#fafaf8',edge:'#e3e3de',edgeOn:'#9c9da3',grip:'#cfcfca',gripOn:'#9c9da3',
  dead:'#f8f8f6',deadEdge:'#d9d9d4',bezel:'#e7e7e2',big:'#17181a',bigA:.10,bigDual:.08,
  rule:'#e7e7e2',band:'#f4f4f1',bandRule:'#e9e9e5',cell:'#2a2b2e',bad:'#d93a3f',warn:'#b46f00',
  violet:'#7c3aed',dataAcc:'#0b8a9c',ghost:'#d4d4cf',dot:'#dededa',shadow:'rgba(20,20,30,.10)'};
const LIGHT={bg:'#ffffff',head:'#0d1117',sub:'#475161',faint:'#7b8493',tile:'#f5f6f8',line:'#cdd2da',chip:'#ffffff',
  frame:'#ffffff',bar:'#f6f7f9',edge:'#d7dce3',edgeOn:'#7b8493',grip:'#aab4c0',gripOn:'#7b8493',
  dead:'#fafbfc',deadEdge:'#cdd2da',bezel:'#dde3ea',big:'#0d1117',bigA:.13,bigDual:.10,
  rule:'#e1e5eb',band:'#f3f5f8',bandRule:'#e6e9ee',cell:'#232b37',bad:'#c62828',warn:'#a85a00',
  violet:'#6d28d9',dataAcc:'#0b7c8c',ghost:'#c3ccd7',dot:'#e6e9ee',shadow:'rgba(0,0,0,0)'};
let C=Object.assign({},DARK), PRINT=false, UITHEME='dark';
/* light or dark interface; the drawing palette follows it */
function applyUITheme(t,persist){
  UITHEME=t==='light'?'light':'dark';
  document.documentElement.dataset.theme=UITHEME;
  if(!PRINT) C=Object.assign({},UITHEME==='light'?LIGHTUI:DARK);
  if(persist) sSet('wm:theme',UITHEME);
  if(typeof S!=='undefined'&&S) redraw();
  if(typeof pmOpen!=='undefined'&&pmOpen) pmRender();
}
function toggleUITheme(){ applyUITheme(UITHEME==='light'?'dark':'light',true); }
const THEMES={
  indigo:{label:'Indigo',   ac:'#6b7cff', ink:'#080c1c'},
  teal:  {label:'Teal',     ac:'#17b8a6', ink:'#032420'},
  sky:   {label:'Sky',      ac:'#45b6f5', ink:'#04202b'},
  violet:{label:'Violet',   ac:'#a878f5', ink:'#170a2b'},
  lime:  {label:'Lime',     ac:'#9fd339', ink:'#111a05'},
  slate: {label:'Slate',    ac:'#93a6c0', ink:'#0b111b'},
  rose:  {label:'Rose',     ac:'#f2679a', ink:'#25060f'},
  amber: {label:'Amber',    ac:'#ff9f2e', ink:'#180f02'}
};
let ACCENT=THEMES.indigo.ac;
function applyTheme(k){
  const t=THEMES[k]||THEMES.indigo;
  const r=document.documentElement.style;
  r.setProperty('--ac',t.ac); r.setProperty('--ac-ink',t.ink);
  r.setProperty('--ac-soft',t.ac+'26');
  ACCENT=t.ac;
}
/* darken bright chain colours so they survive on white paper */
function rgbOf(col){
  if(col[0]==='#'){ const n=parseInt(col.slice(1),16); return [(n>>16)&255,(n>>8)&255,n&255]; }
  const m=col.match(/\d+/g); return m?m.slice(0,3).map(Number):[128,128,128];
}
function ink(hex){
  if(!(PRINT||UITHEME==='light')||typeof hex!=='string') return hex;
  const [r,g,b]=rgbOf(hex);
  const L=(0.299*r+0.587*g+0.114*b)/255;
  if(L<=0.38) return hex;
  const k=(0.38/L)*0.9, c=v=>Math.max(0,Math.min(255,Math.round(v*k)));
  return `rgb(${c(r)},${c(g)},${c(b)})`;
}
/* pick black or white text for whatever the chip ended up being */
function onColor(col){
  const [r,g,b]=rgbOf(col);
  const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};
  const L=0.2126*f(r)+0.7152*f(g)+0.0722*f(b);
  return (L+0.05)/0.05 > (1.05)/(L+0.05) ? '#0b0e14' : '#ffffff';
}
function withPrint(fn){
  const pc=C, pp=PRINT;
  C=Object.assign({},LIGHT); PRINT=true;
  try{ return fn(); } finally { C=pc; PRINT=pp; }
}
const FD='Outfit, Helvetica, Arial, sans-serif';
const FS='Outfit, Helvetica, Arial, sans-serif', FM='"DM Mono", Menlo, Consolas, monospace';

