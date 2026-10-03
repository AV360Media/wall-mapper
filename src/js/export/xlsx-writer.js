/* ===================== minimal xlsx writer (stored zip, no deps) ===================== */
const CRCT=(()=>{const t=new Uint32Array(256);
  for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function crc32(u8){let c=0xFFFFFFFF;for(let i=0;i<u8.length;i++)c=CRCT[(c^u8[i])&0xFF]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}
const U8=s=>new TextEncoder().encode(s);
function zipStore(files){
  const parts=[],dir=[];let off=0;
  const dosTime=()=>{const d=new Date();
    return {t:((d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1))&0xFFFF,
            d:(((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate())&0xFFFF};};
  const {t,d}=dosTime();
  files.forEach(f=>{
    const name=U8(f.name), data=(f.data instanceof Uint8Array)?f.data:U8(f.data), crc=crc32(data);
    const lh=new Uint8Array(30+name.length), v=new DataView(lh.buffer);
    v.setUint32(0,0x04034b50,true); v.setUint16(4,20,true); v.setUint16(6,0,true);
    v.setUint16(8,0,true); v.setUint16(10,t,true); v.setUint16(12,d,true);
    v.setUint32(14,crc,true); v.setUint32(18,data.length,true); v.setUint32(22,data.length,true);
    v.setUint16(26,name.length,true); v.setUint16(28,0,true);
    lh.set(name,30);
    parts.push(lh,data);
    const ch=new Uint8Array(46+name.length), cv=new DataView(ch.buffer);
    cv.setUint32(0,0x02014b50,true); cv.setUint16(4,20,true); cv.setUint16(6,20,true);
    cv.setUint16(8,0,true); cv.setUint16(10,0,true); cv.setUint16(12,t,true); cv.setUint16(14,d,true);
    cv.setUint32(16,crc,true); cv.setUint32(20,data.length,true); cv.setUint32(24,data.length,true);
    cv.setUint16(28,name.length,true); cv.setUint32(42,off,true);
    ch.set(name,46);
    dir.push(ch);
    off+=lh.length+data.length;
  });
  let dl=0; dir.forEach(x=>dl+=x.length);
  const end=new Uint8Array(22), ev=new DataView(end.buffer);
  ev.setUint32(0,0x06054b50,true); ev.setUint16(8,dir.length,true); ev.setUint16(10,dir.length,true);
  ev.setUint32(12,dl,true); ev.setUint32(16,off,true);
  const all=parts.concat(dir,[end]);
  let n=0; all.forEach(x=>n+=x.length);
  const out=new Uint8Array(n); let p=0; all.forEach(x=>{out.set(x,p);p+=x.length;});
  return out;
}
const xe=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const colName=i=>{let s='';i++;while(i>0){const m=(i-1)%26;s=String.fromCharCode(65+m)+s;i=(i-m-1)/26;}return s;};
/* styles: 0 default, 1 bold, 2 title, 3 header-white-on-colour(per fill), fills start at index 2 */
function buildStyles(fills){
  const f=['<fill><patternFill patternType="none"/></fill>','<fill><patternFill patternType="gray125"/></fill>']
    .concat(fills.map(c=>`<fill><patternFill patternType="solid"><fgColor rgb="FF${c}"/><bgColor indexed="64"/></patternFill></fill>`));
  const xfs=['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>',
    '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>',
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>'];
  fills.forEach((c,i)=>{
    xfs.push(`<xf numFmtId="0" fontId="3" fillId="${i+2}" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>`);
    xfs.push(`<xf numFmtId="0" fontId="0" fillId="${i+2}" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>`);
  });
  xfs.push('<xf numFmtId="0" fontId="1" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1"/>');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="4">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="16"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
</fonts>
<fills count="${f.length}">${f.join('')}</fills>
<borders count="3"><border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FFBFBFBF"/></left><right style="thin"><color rgb="FFBFBFBF"/></right><top style="thin"><color rgb="FFBFBFBF"/></top><bottom style="thin"><color rgb="FFBFBFBF"/></bottom></border>
<border><bottom style="medium"><color rgb="FF404040"/></bottom></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs>
</styleSheet>`;
}
const HDR=i=>4+i*2, CELL=i=>5+i*2;    /* style ids for a given fill index */
const S_BOLD=1, S_TITLE=2, S_WRAP=3, S_RULE=null;
function sheetXml(rows,cols,freeze){
  let x=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"`;
  x+=freeze?`><pane ySplit="${freeze}" topLeftCell="A${freeze+1}" activePane="bottomLeft" state="frozen"/></sheetView>`:'/>';
  x+=`</sheetViews>`;
  if(cols&&cols.length) x+='<cols>'+cols.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')+'</cols>';
  x+='<sheetData>';
  rows.forEach((r,ri)=>{
    const cells=(r.c||[]).map((c,ci)=>{
      if(c==null||c==='') return '';
      const ref=colName(ci)+(ri+1), st=c.s!=null?` s="${c.s}"`:'';
      const val=(typeof c==='object')?c.v:c;
      if(typeof val==='number') return `<c r="${ref}"${st}><v>${val}</v></c>`;
      return `<c r="${ref}"${st} t="inlineStr"><is><t xml:space="preserve">${xe(val)}</t></is></c>`;
    }).join('');
    x+=`<row r="${ri+1}"${r.h?` ht="${r.h}" customHeight="1"`:''}>${cells}</row>`;
  });
  return x+'</sheetData></worksheet>';
}
function buildXlsx(sheets,fills){
  const files=[
    {name:'[Content_Types].xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${sheets.map((s,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`},
    {name:'_rels/.rels',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`},
    {name:'xl/workbook.xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${sheets.map((s,i)=>`<sheet name="${xe(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`},
    {name:'xl/_rels/workbook.xml.rels',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets.map((s,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}
<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`},
    {name:'xl/styles.xml',data:buildStyles(fills)}
  ];
  sheets.forEach((s,i)=>files.push({name:`xl/worksheets/sheet${i+1}.xml`,data:sheetXml(s.rows,s.cols,s.freeze)}));
  return zipStore(files);
}

