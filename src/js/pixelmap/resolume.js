/* ---- Resolume Arena Advanced Output preset: one screen per output, one slice per LED screen ---- */
function pmResolumeXML(M,presetName){
  const e=v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const quad=(x,y,w,h)=>`<v x="${x}" y="${y}"/><v x="${x+w}" y="${y}"/><v x="${x+w}" y="${y+h}"/><v x="${x}" y="${y+h}"/>`;
  const grid=(x,y,w,h)=>{ let s=''; for(let j=0;j<4;j++) for(let i=0;i<4;i++) s+=`<v x="${+(x+w*i/3).toFixed(3)}" y="${+(y+h*j/3).toFixed(3)}"/>`; return s; };
  let id=Date.now()%100000000;
  const screens=M.outs.map(o=>{
    const procs=[...new Set(o.groups.map(g=>g.name))].join(' + ');
    const sname=`Output ${o.n}${procs?' · '+procs:''}`;
    const slices=M.L.filter(q=>q.out===o.n).sort((a,b)=>a.oy-b.oy||a.ox-b.ox).map(q=>`
				<Slice uniqueId="${++id}">
					<Params name="Common">
						<Param name="Name" T="STRING" default="Layer" value="${e(q.name)}"/>
						<Param name="Enabled" T="BOOL" default="1" value="1"/>
					</Params>
					<Params name="Input">
						<Param name="Input Opacity" T="BOOL" default="1" value="1"/>
						<Param name="Input Bypass/Solo" T="BOOL" default="1" value="1"/>
						<Param name="SoftEdgeEnable" T="BOOL" default="0" value="0"/>
					</Params>
					<Params name="Output">
						<Param name="Flip" T="UINT8" default="0" value="0"/>
						<Param name="Is Key" T="BOOL" default="0" value="0"/>
						<Param name="Black BG" T="BOOL" default="0" value="0"/>
					</Params>
					<InputRect orientation="0">${quad(q.ix,q.iy,q.iw,q.ih)}</InputRect>
					<OutputRect orientation="0">${quad(q.ox,q.oy,q.W,q.H)}</OutputRect>
					<Warper>
						<Params name="Warper">
							<ParamChoice name="Point Mode" default="PM_LINEAR" value="PM_LINEAR" storeChoices="0"/>
							<Param name="Flip" T="UINT8" default="0" value="0"/>
						</Params>
						<BezierWarper controlWidth="4" controlHeight="4"><vertices>${grid(q.ox,q.oy,q.W,q.H)}</vertices></BezierWarper>
						<Homography><src>${quad(q.ox,q.oy,q.W,q.H)}</src><dst>${quad(q.ox,q.oy,q.W,q.H)}</dst></Homography>
					</Warper>
				</Slice>`).join('');
    return `
		<Screen name="${e(sname)}" uniqueId="${++id}">
			<Params name="Params">
				<Param name="Name" T="STRING" default="" value="${e(sname)}"/>
				<Param name="Enabled" T="BOOL" default="1" value="1"/>
				<Param name="Hidden" T="BOOL" default="0" value="0"/>
			</Params>
			<layers>${slices}
			</layers>
			<OutputDevice>
				<OutputDeviceVirtual name="${e(sname)}" deviceId="Virtual${e(sname)}" idHash="${o.n}" width="${o.W}" height="${o.H}"/>
			</OutputDevice>
		</Screen>`;
  }).join('');
  return `<?xml version="1.0" encoding="utf-8"?>
<XmlState name="${e(presetName)}">
	<versionInfo name="Resolume Arena" majorVersion="7" minorVersion="27" microVersion="1" revision="15990"/>
	<ScreenSetup name="ScreenSetup">
		<Params name="ScreenSetupParams"/>
		<CurrentCompositionTextureSize width="${M.compW}" height="${M.compH}"/>
		<screens>${screens}
		</screens>
	</ScreenSetup>
</XmlState>
`;
}
function pmDownloadResolume(){
  const M=pmBuild(); if(!M.L.length){ setStatus('Choose an LED panel for a screen first'); return; }
  const name=`${fileBase()} pixel map`;
  download(new Blob([pmResolumeXML(M,name)],{type:'application/xml'}),`${name}.xml`);
  setStatus(`Resolume preset saved · set the composition to ${M.compW} × ${M.compH} before loading it`);
}

