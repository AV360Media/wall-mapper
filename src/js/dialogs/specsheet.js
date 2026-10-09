/* ========================= SPEC SHEET READER ========================= */
/* Paste a panel's spec sheet text (or drop its PDF) into the custom panel dialog and the
   fields fill themselves. Plain pattern matching, nothing leaves the browser. Sheets that list
   several models side by side get a picker, one button per column. */
let specCols=null, specCol=0, specT=0;
const SPEC_BRANDS=['ROE Visual','ROE','Absen','INFiLED','Unilumin','Leyard','Planar','Aoto','Liantronics','Yaham','Desay','Brompton',
  'Samsung','LG','Sony','Barco','Daktronics','Chauvet','Glux','Gloshine','Megapixel','Roe','Infiled','Unitled','Qiangli','Lighthouse','Elation','Vanish','Voyager','PixelFLEX','Mosaic'];
/* one line of text: unicode tidy, × and * between numbers become x, m² becomes sqm so its 2 isn't read as a value */
const specNorm=t=>t.replace(/\r/g,'').replace(/[   ]/g,' ').replace(/[×✕✖*]/g,'x').replace(/[～〜~]/g,'~')
  .replace(/m\s*[²2](?![a-z0-9])|sqm|sq\.?\s*m\b|square met(er|re)s?/gi,'sqm').replace(/[–—]/g,'-').replace(/：/g,':');
/* numbers in a string; "1,000" is a thousand, "2,6" is European 2.6 */
const specNums=t=>(t.match(/-?\d+(?:[.,]\d+)?/g)||[]).map(x=>/,\d{3}$/.test(x)?+x.replace(',',''):+x.replace(',','.'));
const specPairs=t=>{ const out=[], u=String.raw`\s*(?:mm|px|dots|pixels?|in(?:ch(?:es)?)?\b|["″”]|'')?\s*`, n=String.raw`(\d+(?:[.,]\d+)?)`, re=new RegExp(n+u+'x'+u+n+'(?:'+u+'x'+u+n+')?','gi'); let m;
  while((m=re.exec(t))) out.push([+m[1].replace(',','.'),+m[2].replace(',','.')]); return out; };
/* best line for a field: must match want, must not match no; cabinet/panel wording beats module wording */
function specLines(L,want,no){
  return L.filter(l=>want.test(l)&&!(no&&no.test(l)))
    .map(l=>({l,sc:(/cabinet|panel|tile|unit\b|product/i.test(l)?2:0)-(/module|receiv|card|driver|lamp|led\b(?! panel)/i.test(l)?3:0)}))
    .sort((a,z)=>z.sc-a.sc).map(x=>x.l);
}
/* the label is the text before the first digit; values are what follows it */
const specVal=l=>{ const i=l.search(/\d/); return i<0?'':l.slice(i); };
function parseSpec(raw){
  const L=raw.split(/\n/).map(specNorm).map(l=>l.trim()).filter(Boolean), f={}, cols=[], C=a=>a[Math.min(specCol,a.length-1)];
  /* models side by side: a Model line with several names, or a pitch line with several values */
  const ml=L.find(l=>/^(model|product|type|item)\b[^:]*:?\s/i.test(l)&&!/\d+\s*(mm|kg|w)\b/i.test(l));
  let models=ml?ml.replace(/^(model|product|type|item)[^:\s]*\s*(name|no\.?|number)?\s*:?\s*/i,'').split(/\s{2,}|\t|\s*\|\s*|,\s*/).filter(Boolean):[];
  const pl=specLines(L,/pitch/i)[0], pv=pl?specNums(specVal(pl)).filter(v=>v>=.4&&v<=40):[];
  if(models.length<2&&pv.length>1) models=pv.map(v=>`${v} mm`);
  if(pv.length) f.pitch=C(pv);
  /* brand: a known name anywhere near the top */
  const head=L.slice(0,40).join(' ');
  const br=SPEC_BRANDS.find(b=>new RegExp('\\b'+b.replace(/\s/g,'\\s*')+'\\b','i').test(head));
  if(br) f.brand=br.replace(/^roe$/i,'ROE Visual').replace(/^infiled$/i,'INFiLED');
  if(models.length>1&&!/ mm$/.test(models[0])) f.model=C(models);
  else if(models.length===1) f.model=models[0];
  else { const m=head.match(/\b([A-Z][A-Za-z]{0,6}[ -]?\d+(?:\.\d+)?[A-Za-z]*(?:\s(?:Pro|Lite|Plus|Ultra|Max|Mini|II|III|V\d))?)\b/); if(m) f.model=m[1]; }
  if(f.model&&f.brand) f.model=f.model.replace(new RegExp('^'+f.brand.replace(/\s/g,'\\s*')+'\\s*','i'),'');
  /* cabinet size, mm (inches converted) */
  for(const l of specLines(L,/size|dimension|w\s*x\s*h/i,/screen|display|package|case|flight|pixel|resolution|module/i)){
    const P=specPairs(l).map(p=>/inch|\bin\b|["″”]/i.test(l)&&!/mm/i.test(l)?p.map(v=>v*25.4):p).filter(p=>p[0]>=150&&p[0]<=2600&&p[1]>=150&&p[1]<=2600);
    if(P.length){ f.wmm=Math.round(C(P)[0]); f.hmm=Math.round(C(P)[1]); break; }
  }
  /* cabinet resolution */
  for(const l of specLines(L,/resolution|pixels|dots/i,/screen|display|refresh|grey|gray|bit|density|per\s*sqm|\/sqm|module/i)){
    const P=specPairs(l).filter(p=>p[0]>=8&&p[0]<=2400&&p[1]>=8&&p[1]<=2400);
    if(P.length){ [f.pw,f.ph]=C(P); break; }
  }
  /* a module resolution or a missing line: work it out from size and pitch instead */
  if(f.pitch&&f.wmm&&f.hmm){
    const ok=f.pw&&Math.abs(f.wmm/f.pw-f.pitch)/f.pitch<.12;
    if(!ok){ f.pw=Math.round(f.wmm/f.pitch); f.ph=Math.round(f.hmm/f.pitch); f.est='resolution'; }
  }
  if(!f.pitch&&f.wmm&&f.pw) f.pitch=+(f.wmm/f.pw).toFixed(2);
  /* weight: kg unless it says lb */
  for(const l of specLines(L,/weight/i,/package|gross|case|flight|sqm|\/m\b/i)){
    const v=specNums(specVal(l)).filter(x=>x>0); if(!v.length) continue;
    const lb=/lb|pound/i.test(l)&&!/kg/i.test(l), w=C(v)*(lb?1:2.2046);
    if(w>=2&&w<=200){ f.lb=+w.toFixed(1); break; }
  }
  /* power: per panel, or per square metre times the panel's area */
  const area=f.wmm&&f.hmm?f.wmm*f.hmm/1e6:0;
  const pw=(re,no)=>{ for(const l of specLines(L,re,no)){
      let v=specNums(specVal(l)).filter(x=>x>0); if(!v.length) continue;
      const both=/max/i.test(l)&&/(avg|average|typ)/i.test(l);
      const per=/sqm/i.test(l)?area:1; if(!per) continue;
      return {v:v.map(x=>Math.round(x*per)),both};
    } return null; };
  const mx=pw(/(max|peak)[^a-z]*(power|consumption)|(power|consumption)[^0-9]*(max|peak)/i,/supply|input volt|frequency/i);
  const av=pw(/(average|avg|typical|typ\.?)[^a-z]*(power|consumption)|(power|consumption)[^0-9]*(average|avg|typical|typ)/i,/supply|input volt|frequency/i);
  if(mx){ if(mx.both&&mx.v.length>=2&&(!av||av.both)){ const n=mx.v.length; f.wmax=n>2?C(mx.v.filter((x,i)=>i%2===0)):mx.v[0]; f.wavg=n>2?C(mx.v.filter((x,i)=>i%2===1)):mx.v[1]; } else f.wmax=C(mx.v); }
  if(av&&f.wavg==null) f.wavg=C(av.v);
  /* curve locks: every listed angle, positive, small to large */
  const cl=specLines(L,/curv|arc\b|angle|lock/i,/view|beam|led\b/i)[0];
  if(cl){ const d=[...new Set(specNums(specVal(cl).replace(/±|\+\/-/g,'')).map(Math.abs).filter(x=>x>0&&x<=30))].sort((a,z)=>a-z);
    if(d.length&&d.length<=8) f.locks=d; }
  return {f,models:models.length>1?models:null};
}
function specFill(raw){
  const g=id=>document.getElementById(id), {f,models}=parseSpec(raw||g('cpSpec').value);
  specCols=models;
  g('cpCols').innerHTML=models?`<span>This sheet lists ${models.length} models:</span>`+models.map((m,i)=>`<button class="${i===Math.min(specCol,models.length-1)?'on':''}" onclick="specPick(${i})">${escp(m)}</button>`).join(''):'';
  const map={cpBrand:f.brand,cpModel:f.model,cpWmm:f.wmm,cpHmm:f.hmm,cpPw:f.pw,cpPh:f.ph,cpPitch:f.pitch,cpWmax:f.wmax,cpWavg:f.wavg,cpLb:f.lb,cpLocks:f.locks&&f.locks.join(', ')};
  const got=[]; ['cpLb','cpLocks'].forEach(id=>{ if(map[id]==null) g(id).value=''; });   /* optional ones don't carry over from an earlier sheet */
  Object.entries(map).forEach(([id,v])=>{ const el=g(id); if(v==null||v==='') return; el.value=v; el.classList.remove('got'); void el.offsetWidth; el.classList.add('got'); got.push(id); });
  const names={cpPitch:'pitch',cpWmm:'size',cpPw:'resolution',cpLb:'weight',cpWmax:'max power',cpWavg:'average power',cpLocks:'curve locks'};
  const said=Object.keys(names).filter(k=>got.includes(k)).map(k=>names[k]);
  const miss=Object.keys(names).filter(k=>!got.includes(k)&&k!=='cpLocks').map(k=>names[k]);
  g('cpFound').textContent=!raw&&!g('cpSpec').value.trim()?'':said.length
    ?`Filled ${said.join(', ')}${f.est?' (resolution worked out from size ÷ pitch)':''}.${miss.length?` Not found: ${miss.join(', ')}.`:''} Check the numbers before saving.`
    :'Couldn’t find panel specs in that text. Try copying the whole spec table.';
  derive();
}
function specPick(i){ specCol=i; specFill(document.getElementById('cpSpec').value); }
function specInput(){ clearTimeout(specT); specCol=0; specT=setTimeout(()=>specFill(),250); }
/* PDFs: read the text with PDF.js, fetched the first time a PDF is dropped */
let pdfLib=null;
function loadPdfLib(){
  if(pdfLib) return pdfLib;
  const v='3.11.174', base=`https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${v}/`;
  return pdfLib=new Promise((ok,no)=>{ const s=document.createElement('script'); s.src=base+'pdf.min.js';
    s.onload=()=>{ window.pdfjsLib.GlobalWorkerOptions.workerSrc=base+'pdf.worker.min.js'; ok(window.pdfjsLib); };
    s.onerror=()=>{ pdfLib=null; no(new Error('offline')); }; document.head.appendChild(s); });
}
async function pdfText(buf){
  const lib=await loadPdfLib(), doc=await lib.getDocument({data:buf}).promise, out=[];
  for(let n=1;n<=Math.min(doc.numPages,6);n++){
    const c=await (await doc.getPage(n)).getTextContent(), rows={};
    c.items.forEach(it=>{ if(!it.str.trim()) return; const y=Math.round(it.transform[5]/3); (rows[y]=rows[y]||[]).push(it); });
    Object.keys(rows).map(Number).sort((a,z)=>z-a).forEach(y=>{
      const r=rows[y].sort((a,z)=>a.transform[4]-z.transform[4]); let line='', end=null;
      r.forEach(it=>{ const x=it.transform[4]; line+=(end==null?'':x-end>8?'   ':' ')+it.str.trim(); end=x+it.width; });
      out.push(line); });
  }
  return out.join('\n');
}
async function specFile(file){
  if(!file) return;
  const g=id=>document.getElementById(id); g('cpFound').textContent='Reading '+file.name+'…';
  try{
    const t=/pdf$/i.test(file.type)||/\.pdf$/i.test(file.name)?await pdfText(await file.arrayBuffer()):await file.text();
    g('cpSpec').value=t.slice(0,20000); specCol=0; specFill();
  }catch(e){
    g('cpFound').textContent=e.message==='offline'
      ?'Couldn’t load the PDF reader (no internet?). Open the PDF, copy the spec table, and paste it here instead.'
      :'Couldn’t read that file. Open it, copy the spec table, and paste it here instead.';
  }
}
function specDrop(e){ e.preventDefault(); e.currentTarget.classList.remove('over'); specFile(e.dataTransfer.files[0]); }
