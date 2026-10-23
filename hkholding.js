/* Rellena el Excel mensual del holding (HK-MARCILLA .xlsm) con las no conformidades de la app.
   Edita solo el XML de: AUDIT HK (columna del mes), NCm_NCM (filas nuevas) e INFORME AUDIT INTERNA (mes).
   El resto (INFORME AUDIT INTERNA, Analisis_Tendencias, KPIs, gráficos, macros) se recalcula al abrir en Excel. */
(function(root){
'use strict';
const MESES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const unesc=s=>String(s).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
const colN=l=>{let n=0;for(const ch of l)n=n*26+ch.charCodeAt(0)-64;return n};
const colL=n=>{let s='';while(n>0){const m=(n-1)%26;s=String.fromCharCode(65+m)+s;n=Math.floor((n-1)/26)}return s};
const serial=iso=>{const a=String(iso).slice(0,10).split('-').map(Number);return Math.round(Date.UTC(a[0],a[1]-1,a[2])/86400000+25569)};
const normCode=c=>String(c||'').trim().toUpperCase().replace(/\s+/g,'').replace(/^D\.O\./,'D.0.');

const CELL_RE=/<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
function parseSST(xml){const out=[];const re=/<si>([\s\S]*?)<\/si>/g;let m;while((m=re.exec(xml))){let t='';const r2=/<t[^>]*>([\s\S]*?)<\/t>/g;let k;while((k=r2.exec(m[1])))t+=unesc(k[1]);out.push(t)}return out}
function readCells(xml,sst){const map={};let m;CELL_RE.lastIndex=0;while((m=CELL_RE.exec(xml))){const attrs=m[3]||'',inner=m[4]||'';let v=null;const t=(attrs.match(/\bt="(\w+)"/)||[])[1];
  if(t==='s'){const k=inner.match(/<v>(\d+)<\/v>/);if(k)v=sst[+k[1]]}
  else if(t==='inlineStr'){let s='';const r2=/<t[^>]*>([\s\S]*?)<\/t>/g;let k;while((k=r2.exec(inner)))s+=unesc(k[1]);v=s}
  else{const k=inner.match(/<v>([\s\S]*?)<\/v>/);if(k)v=unesc(k[1])}
  if(v!==null&&v!=='')map[m[1]+m[2]]={v:v,t:t,f:/<f[ >]/.test(inner)}}
  return map}

function buildCell(ref,s,spec){
  const sa=s!=null?' s="'+s+'"':'';
  if(spec==null||spec.v===''||spec.v==null&&!spec.f)return '<c r="'+ref+'"'+sa+'/>';
  if(spec.f)return '<c r="'+ref+'"'+sa+'><f>'+esc(spec.f)+'</f></c>';
  if(typeof spec.v==='number')return '<c r="'+ref+'"'+sa+'><v>'+spec.v+'</v></c>';
  return '<c r="'+ref+'"'+sa+' t="inlineStr"><is><t xml:space="preserve">'+esc(spec.v)+'</t></is></c>'}

/* Edita el XML de una hoja: setCell(ref, spec, styleFrom) */
function Sheet(xml){this.xml=xml}
Sheet.prototype.rowRange=function(r){
  const re=new RegExp('<row r="'+r+'"(?:\\s[^>]*)?(?:/>|>[\\s\\S]*?</row>)');const m=re.exec(this.xml);return m?{i:m.index,len:m[0].length,s:m[0]}:null};
Sheet.prototype.setCell=function(ref,spec,styleFrom){
  const cm=/^([A-Z]+)(\d+)$/.exec(ref),cn=colN(cm[1]),r=+cm[2];
  let rr=this.rowRange(r);
  if(!rr){ // crear fila en orden
    const re=/<row r="(\d+)"/g;let m,at=-1;while((m=re.exec(this.xml))){if(+m[1]>r){at=m.index;break}}
    const nr='<row r="'+r+'"></row>';
    if(at<0){const e=this.xml.indexOf('</sheetData>');this.xml=this.xml.slice(0,e)+nr+this.xml.slice(e)}else this.xml=this.xml.slice(0,at)+nr+this.xml.slice(at);
    rr=this.rowRange(r)}
  let row=rr.s;
  if(/^<row[^>]*\/>$/.test(row))row=row.replace(/\/>$/,'></row>');
  const open=row.slice(0,row.indexOf('>')+1),body=row.slice(open.length,row.length-6);
  const cells=[];let m;const re2=/<c r="([A-Z]+)\d+"([^>]*?)(\/>|>[\s\S]*?<\/c>)/g;
  while((m=re2.exec(body)))cells.push({c:colN(m[1]),x:m[0],s:(m[2].match(/\bs="(\d+)"/)||[])[1]});
  let idx=cells.findIndex(c=>c.c===cn);
  const s=idx>=0?cells[idx].s:(styleFrom!=null?styleFrom:undefined);
  const nx=buildCell(ref,s,spec);
  if(idx>=0)cells[idx].x=nx;else{const p=cells.findIndex(c=>c.c>cn);cells.splice(p<0?cells.length:p,0,{c:cn,x:nx})}
  const nrow=open.replace(/\sspans="[^"]*"/,'')+cells.map(c=>c.x).join('')+'</row>';
  this.xml=this.xml.slice(0,rr.i)+nrow+this.xml.slice(rr.i+rr.len)};

async function hkFill(buf,opts){
  const JSZip=opts.JSZip||root.JSZip;
  const zip=await JSZip.loadAsync(buf);
  const rd=async p=>{const f=zip.file(p);return f?await f.async('string'):null};
  const wbx=await rd('xl/workbook.xml'),rels=await rd('xl/_rels/workbook.xml.rels');
  if(!wbx||!rels)throw new Error('No es un Excel válido');
  const sheetPath={};
  const rid={};(rels.match(/<Relationship [^>]*>/g)||[]).forEach(t=>{const i=(t.match(/Id="([^"]+)"/)||[])[1],tg=(t.match(/Target="([^"]+)"/)||[])[1];if(i&&tg)rid[i]=tg});
  (wbx.match(/<sheet [^>]*>/g)||[]).forEach(t=>{const n=unesc((t.match(/name="([^"]+)"/)||[])[1]||''),r=(t.match(/r:id="([^"]+)"/)||[])[1];if(rid[r])sheetPath[n]='xl/'+rid[r].replace(/^\/?(xl\/)?/,'')});
  for(const n of ['AUDIT HK','NCm_NCM','INFORME AUDIT INTERNA'])if(!sheetPath[n])throw new Error('Falta la hoja «'+n+'». ¿Es el Excel del holding?');
  const sst=parseSST(await rd('xl/sharedStrings.xml')||'');
  const mes=opts.mes,y=+mes.slice(0,4),mi=+mes.slice(5,7)-1;
  const meses=[...new Set((opts.meses||[]).concat([mes]))].sort();
  const warnings=[];

  /* ---- AUDIT HK ---- */
  const hkXml=await rd(sheetPath['AUDIT HK']);const hk=new Sheet(hkXml);const cells=readCells(hkXml,sst);
  const txt=ref=>cells[ref]?cells[ref].v:'';
  let maxRow=0;Object.keys(cells).forEach(k=>{const r=+k.replace(/\D/g,'');if(r>maxRow)maxRow=r});
  const rowOf={},areas=[];let sec=null,cur=null,inFD=false,fdN={};
  for(let r=8;r<=maxRow;r++){
    const b=txt('B'+r).trim(),c=txt('C'+r).trim(),d=txt('D'+r).trim();
    if(b&&/^[A-G]\./.test(b)&&!/^[A-G]\.[A-Z0]\.\d\d$/.test(b)){sec=b[0];inFD=false;cur=null;continue}
    if(c&&sec){inFD=/^FOOD DEFENSE/i.test(c);cur={sec:sec,start:r,end:r,fd:inFD};areas.push(cur)}
    if(b&&/^[A-G]\.[A-Z0]\.\d\d$/.test(b)&&cur){rowOf[b]=r;cur.end=r}
    else if(inFD&&d&&cur){fdN[sec]=(fdN[sec]||0)+1;rowOf[sec+'.FD.'+String(fdN[sec]).padStart(2,'0')]=r;cur.end=r}
  }
  if(!Object.keys(rowOf).length)throw new Error('No se reconoce la hoja AUDIT HK');
  const ptsD={'No conformidad menor':1,'No conformidad mayor':2,'Observación':0};
  let sinTipo=0;const sinCodigo=[];let puntos=0,totNC=0;
  const allNcs=(opts.ncs||[]).filter(x=>meses.includes(String(x.fecha).slice(0,7)));
  for(const m of meses){
    const c0=7+6*(+m.slice(5,7)-1);
    const COL={p:colL(c0),sub:colL(c0+1),com:colL(c0+2),men:colL(c0+3),may:colL(c0+4),om:colL(c0+5)};
    const ncs=allNcs.filter(x=>String(x.fecha).slice(0,7)===m);totNC+=ncs.length;
    const ded={},txts={};
    ncs.forEach(n=>{
      const code=normCode(n.ncm),row=rowOf[code];
      if(!(n.tipo in ptsD)){sinTipo++;return}
      if(!row){sinCodigo.push((n.id||'')+' ('+(n.ncm||'sin código')+')');return}
      ded[code]=(ded[code]||0)+ptsD[n.tipo];
      const col=n.tipo==='No conformidad mayor'?'may':n.tipo==='No conformidad menor'?'men':'om';
      (txts[code]=txts[code]||{men:[],may:[],om:[]})[col].push(String(n.resumen||'').trim()+(n.id?' ('+n.id+')':''));
    });
    puntos+=Object.values(ded).reduce((a,b)=>a+Math.min(2,b),0);
    const secTocada={};ncs.forEach(n=>{const c=normCode(n.ncm);if(rowOf[c]&&n.tipo in ptsD)secTocada[c[0]]=true});
    for(const code in rowOf){const r=rowOf[code];
      if(!secTocada[code[0]]&&/^NA$/i.test(txt(COL.p+r).trim())){/* no auditada este mes: se respeta NA */}else hk.setCell(COL.p+r,{v:Math.max(0,2-(ded[code]||0))});
      for(const k of ['com','men','may','om']){const t=txts[code]&&txts[code][k]?txts[code][k].join(' · '):'';hk.setCell(COL[k]+r,t?{v:t}:null)}}
    areas.forEach(a=>hk.setCell(COL.sub+a.start,{f:'SUM('+COL.p+a.start+':'+COL.p+a.end+')'}));
    const names=[...new Set(ncs.map(n=>n.creadoPor).filter(Boolean))].join(', ');
    const lastF=ncs.map(n=>String(n.fecha).slice(0,10)).sort().pop()||(opts.hoy||new Date().toISOString().slice(0,10));
    hk.setCell(colL(c0+2)+'1',{v:serial(lastF)});
    hk.setCell(colL(c0+4)+'1',names?{v:names}:null);
  }
  // corrige subtotales de otros meses que se incluyan a sí mismos (referencia circular, p. ej. mayo en Envasado)
  let corr=0;
  for(let k=0;k<12;k++){const p=colL(7+6*k),sb=colL(8+6*k);
    areas.forEach(a=>{const ref=sb+a.start;if(!cells[ref]||!cells[ref].f)return;
      const m=new RegExp('<c r="'+ref+'"[^>]*><f[^>]*>([^<]*)</f>').exec(hk.xml);const exp='SUM('+p+a.start+':'+p+a.end+')';
      if(m&&m[1]!==exp&&/^SUM\(/.test(m[1])&&m[1].indexOf(sb)>=0){hk.setCell(ref,{f:exp});corr++}})}
  zip.file(sheetPath['AUDIT HK'],hk.xml);

  /* ---- NCm_NCM: filas nuevas / actualizadas ---- */
  const nx=await rd(sheetPath['NCm_NCM']);const nm=new Sheet(nx);const nc=readCells(nx,sst);
  function norm(s){return String(s||'').toLowerCase().replace(/\s+/g,' ').trim().slice(0,40)}
  function serial0(c){return c&&c.v!=null?Math.round(+c.v):''}
  let last=8,maxA=0;const have={};
  Object.keys(nc).forEach(k=>{const m=/^C(\d+)$/.exec(k);if(m&&+m[1]>=9){if(+m[1]>last)last=+m[1];const r=+m[1];
    have[serial0(nc['B'+r])+'|'+normCode(nc[k].v)+'|'+norm(nc['F'+r]&&nc['F'+r].v)]=r}});
  Object.keys(nc).forEach(k=>{const m=/^A(\d+)$/.exec(k);if(m&&+m[1]>=9){const n=+nc[k].v;if(n>maxA)maxA=n}});
  const styleRow={};const rr0=nm.rowRange(last);if(rr0){let m;const re=/<c r="([A-Z]+)\d+"([^>]*?)(\/>|>)/g;while((m=re.exec(rr0.s)))styleRow[m[1]]=(m[2].match(/\bs="(\d+)"/)||[])[1]}
  let nxt=last,added=0,dup=0;
  allNcs.slice().sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha))).forEach(n=>{
    const key=serial(n.fecha)+'|'+normCode(n.ncm)+'|'+norm(n.resumen);
    let r=have[key],nuevo=!r;
    if(nuevo){nxt++;added++;maxA++;r=nxt}else dup++;
    const put=(c,spec)=>nm.setCell(c+r,spec,styleRow[c]);
    if(nuevo){put('A',{v:maxA});put('B',{v:serial(n.fecha)});put('C',{v:String(n.ncm||'')});put('D',{v:n.seccionDeteccion||''});put('F',{v:n.resumen||''});put('J',{v:n.causas||''});put('M',{v:n.accion||''})}
    put('E',{v:n.dpto||''});put('Q',{v:n.respNombre||''});
    put('R',n.fechaPrevista?{v:serial(n.fechaPrevista)}:null);put('S',n.fechaReal?{v:serial(n.fechaReal)}:null);put('T',{v:n.estado==='Cerrado'?'C':'A'});
  });
  zip.file(sheetPath['NCm_NCM'],nm.xml);

  /* ---- INFORME AUDIT INTERNA: mes y año ---- */
  const ix=await rd(sheetPath['INFORME AUDIT INTERNA']);const inf=new Sheet(ix);
  inf.setCell('H3',{v:MESES[mi]});inf.setCell('F3',{v:y});
  /* corrección: Envasado apuntaba siempre a la columna de mayo de ListasDatos */
  [29,30,31,32].forEach((r,i)=>{const f=(inf.rowRange(r)||{s:''}).s;if(/<f[^>]*>ListasDatos!I\d+<\/f>/.test(f))inf.setCell('E'+r,{f:'HLOOKUP($H$3,ListasDatos!$E$2:$R$44,'+(27+i)+',)'})});
  zip.file(sheetPath['INFORME AUDIT INTERNA'],inf.xml);

  /* ---- recálculo al abrir (y sin calcChain) ---- */
  let w2=wbx.replace(/<calcPr[^>]*\/>/,'<calcPr calcId="191028" fullCalcOnLoad="1"/>');
  zip.file('xl/workbook.xml',w2);
  if(zip.file('xl/calcChain.xml')){
    zip.remove('xl/calcChain.xml');
    zip.file('xl/_rels/workbook.xml.rels',rels.replace(/<Relationship [^>]*calcChain[^>]*\/>/,''));
    const ct=await rd('[Content_Types].xml');zip.file('[Content_Types].xml',ct.replace(/<Override [^>]*calcChain[^>]*\/>/,''))}

  if(corr)warnings.push('Corregida(s) '+corr+' fórmula(s) circular(es) del Excel (subtotales que se incluían a sí mismos).');
  if(sinTipo)warnings.push(sinTipo+' no conformidad(es) del mes sin tipo (antiguas): no puntúan en AUDIT HK.');
  if(sinCodigo.length)warnings.push('Sin código reconocido (no puntúan): '+sinCodigo.join(', '));
  const data=await zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
  return{data:data,warnings:warnings,resumen:{mes:mes,meses:meses,ncs:totNC,nuevasNCm:added,yaExistian:dup,puntosDescontados:puntos}}
}
root.hkFill=hkFill;
if(typeof module!=='undefined')module.exports={hkFill};
})(typeof window!=='undefined'?window:globalThis);
