
/* ====================== utilidades ====================== */
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const parseD=s=>{const a=s.split('-').map(Number);return new Date(a[0],a[1]-1,a[2])};
const addDays=(d,n)=>{const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()+n);return x};
const todayISO=()=>iso(new Date());
const nowISO=()=>new Date().toISOString();
const fmtD=s=>s?String(s).slice(0,10).split('-').reverse().join('/'):'';
const fmtS=s=>s?String(s).slice(8,10)+'/'+String(s).slice(5,7):'';
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const first=n=>String(n||'').trim().split(/\s+/)[0];
const byId=(a,b)=>String(a.id).localeCompare(String(b.id),undefined,{numeric:true});
const val=id=>{const e=document.getElementById(id);return e?e.value:''};
const lineaLabel=l=>/^L\d+$/i.test(l)?'LÍNEA '+l.slice(1):String(l).toUpperCase();
const thumbName=n=>String(n).replace(/\.jpg$/i,'_t.jpg');
const slug=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||uid();
function toast(m){const t=$('#toast');t.textContent=m;t.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>t.style.display='none',3600)}
const errMsg=e=>{if(e&&e.code==='invalid_argument')return 'No tienes permiso para hacer esto con tu rol.';return 'No se pudo guardar'+(e&&e.message?': '+e.message:'')};

/* Periodos: Semanal (lun-dom), Quincenal (1-15 / 16-fin), Mensual */
function periodFor(per,ref,off){
  const d=new Date(ref.getFullYear(),ref.getMonth(),ref.getDate());
  if(per==='Semanal'){const wd=(d.getDay()+6)%7;const s=addDays(d,-wd+7*off);return{inicio:iso(s),limite:iso(addDays(s,6))}}
  if(per==='Quincenal'){const h=d.getDate()<=15?0:1;const idx=d.getFullYear()*24+d.getMonth()*2+h+off;const y=Math.floor(idx/24),rem=idx-y*24,m=Math.floor(rem/2),hh=rem%2;
    const s=new Date(y,m,hh?16:1),e=hh?new Date(y,m+1,0):new Date(y,m,15);return{inicio:iso(s),limite:iso(e)}}
  const s=new Date(d.getFullYear(),d.getMonth()+off,1),e=new Date(s.getFullYear(),s.getMonth()+1,0);return{inicio:iso(s),limite:iso(e)}
}

/* Fotos: se redimensionan en el móvil antes de guardarlas */
function readImage(file,max){return new Promise((res,rej)=>{const fr=new FileReader();fr.onerror=rej;fr.onload=()=>{const im=new Image();im.onerror=rej;im.onload=()=>{const k=Math.min(1,max/Math.max(im.width,im.height));const w=Math.max(1,Math.round(im.width*k)),h=Math.max(1,Math.round(im.height*k));const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(im,0,0,w,h);res(c)};im.src=fr.result};fr.readAsDataURL(file)})}
async function processPhoto(file){
  let c=await readImage(file,1000),q=.72,full=c.toDataURL('image/jpeg',q);
  while(full.length>170000&&q>.35){q-=.1;full=c.toDataURL('image/jpeg',q)}
  if(full.length>170000){c=await readImage(file,720);full=c.toDataURL('image/jpeg',.6)}
  const t=await readImage(file,110);return{full:full,thumb:t.toDataURL('image/jpeg',.6)}
}
async function processRef(file){const c=await readImage(file,420);const t=await readImage(file,130);return{full:c.toDataURL('image/jpeg',.78),thumb:t.toDataURL('image/jpeg',.7)}}

/* ====================== estado ====================== */
const DEFAULT_SECC=['Mezclas','Envasado','Almacén','Taller de mantenimiento'];
const S={db:null,auth:{step:'email',email:''},started:false,account:null,emails:[],siteId:null,driveId:null,fatal:null,isAdmin:false,personas:[],deptos:[],puntos:[],revs:{},partes:[],
 config:{plazoDias:14,edicion:'Edición 1',desde:'2026-10-01',respDefault:'',dptoDefault:'',seccionesDeteccion:DEFAULT_SECC,validarHK:false},
 loaded:{},persona:null,tab:'inicio',linea:null,perF:'Todas',soloPend:true,off:0,
 fEstado:'Abierto',fResp:null,fOrigen:'Todos',fDpto:'Todos',fMes:'',focus:null,
 repTab:'hoja',repLinea:null,repMes:todayISO().slice(0,7),repAll:false,repOpen:false,rep:{key:'',revs:[],loading:false},
 ajLinea:'Todas',nombreSugerido:''};
const photos={};
const me=()=>S.personas.find(p=>S.emails.includes(String(p.email||'').toLowerCase())||p.id===S.persona)||null;
const isCal=()=>{const p=me();return !!p&&p.rol==='Calidad'};
const canAudit=()=>isCal()||S.isAdmin;
const personaById=id=>S.personas.find(p=>p.id===id);
const deptByName=n=>S.deptos.find(d=>d.nombre===n)||null;
const origenOf=x=>x.origen||'Vidrios';
const deptOf=x=>x.dpto||(personaById(x.resp)||{}).departamento||'';
const emailOfId=id=>{const p=personaById(id);return p&&p.email?p.email:(/@/.test(id||'')?id:'')};
const splitMails=s=>String(s||'').split(/[;,\s]+/).filter(m=>/@/.test(m));
const uniq=a=>[...new Set(a.filter(Boolean).map(s=>s.trim()))];
const inDept=(p,nombre)=>{if(!p||!nombre)return false;if(p.departamento===nombre)return true;const d=deptByName(nombre);return !!d&&((d.para||[]).includes(p.id)||(d.cc||[]).includes(p.id))};
const esMio=x=>{const p=me();return !!p&&(x.resp===p.id||inDept(p,deptOf(x)))};
const canResolve=x=>{const p=me();return !!p&&(esMio(x)||p.rol==='Calidad'||S.isAdmin)};
function dest(nombre,extraPersonaId){
  const d=deptByName(nombre);let para=[],cc=[];
  if(d){para=(d.para||[]).map(emailOfId);cc=(d.cc||[]).map(emailOfId)}
  if(extraPersonaId)para.push(emailOfId(extraPersonaId));
  if(!para.length&&nombre)para=S.personas.filter(p=>p.departamento===nombre&&p.email).map(p=>p.email);
  para=uniq(para);cc=uniq(cc).filter(m=>!para.includes(m));return{para:para,cc:cc}
}
const destParte=x=>dest(deptOf(x),x.resp);
function destCalidad(){if(deptByName('Calidad'))return dest('Calidad');return{para:uniq(S.personas.filter(p=>p.rol==='Calidad'&&p.email).map(p=>p.email)),cc:[]}}
const lineasList=()=>[...new Set(S.puntos.map(p=>p.linea))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
const statOf=(pt,off)=>{const per=periodFor(pt.per||'Mensual',new Date(),off);const id=pt.id+'_'+per.inicio;return{per:per,id:id,rev:S.revs[id]||null}};
const activos=l=>S.puntos.filter(p=>p.activo!==false&&(!l||p.linea===l));
const isOverdue=x=>x.estado==='Abierto'&&x.fechaPrevista&&x.fechaPrevista<todayISO();
function progress(l){const a=activos(l);let d=0;a.forEach(p=>{if(statOf(p,0).rev)d++});return{done:d,total:a.length}}
function vencidasPrev(l){let n=0;activos(l).forEach(p=>{const s=statOf(p,-1);if(!s.rev&&s.per.inicio>=S.config.desde)n++});return n}
const secciones=()=>S.config.seccionesDeteccion&&S.config.seccionesDeteccion.length?S.config.seccionesDeteccion:DEFAULT_SECC;
const dptoDefault=()=>S.config.dptoDefault||(personaById(S.config.respDefault)||{}).departamento||(deptByName('Mantenimiento')?'Mantenimiento':(S.deptos[0]||{}).nombre)||'';
const optsDeptos=(sel)=>'<option value="">—</option>'+S.deptos.slice().sort((a,b)=>a.nombre.localeCompare(b.nombre)).map(d=>'<option '+(d.nombre===sel?'selected':'')+'>'+esc(d.nombre)+'</option>').join('');

/* ====================== Supabase (base de datos, fotos, acceso y avisos) ====================== */
const CFG=window.AUD_CONFIG||{};
let sb=null;
const BUCKET='fotos';
const dbErr=e=>{const x=new Error((e&&e.message)||'Error');const m=String((e&&e.message)||'')+' '+String((e&&e.statusCode)||''),c=e&&e.code;
  x.code=(c==='42501'||/row-level security|403|not authorized|unauthorized/i.test(m))?'invalid_argument':(c||'error');x.status=e&&(e.status||e.statusCode);return x};

/* Cada colección de la app es una tabla. [columna, tipo]  t texto · n texto largo · b sí/no · d fecha · a lista · j lista de nombres de archivo */
const SCHEMA={
 personas:{table:'personas',f:{nombre:['nombre'],email:['email'],rol:['rol'],departamento:['departamento'],admin:['admin','b']}},
 departamentos:{table:'departamentos',f:{nombre:['nombre'],para:['para','a'],cc:['cc','a']}},
 config:{table:'config',doc:'datos'},
 puntos:{table:'puntos',f:{linea:['linea'],equipo:['equipo'],rev:['revisar'],mat:['material'],cant:['cantidad'],per:['periodicidad'],activo:['activo','b'],fotos:['fotos','j'],nota:['nota']}},
 revisiones:{table:'revisiones',f:{pid:['punto_id'],linea:['linea'],equipo:['equipo'],per:['periodicidad'],inicio:['inicio','d'],limite:['limite','d'],resultado:['resultado'],fecha:['fecha_hora'],por:['por_nombre'],porId:['por_email'],parteId:['parte_id'],obs:['observacion']}},
 partes:{table:'incidencias',f:{origen:['origen'],fecha:['fecha','d'],linea:['linea'],zona:['zona'],elemento:['elemento'],accion:['accion'],pid:['punto_id'],rid:['revision_id'],dpto:['departamento'],resp:['responsable_email'],creadoPor:['creado_por'],fotoIni:['foto_ini'],fotoFin:['foto_fin'],fechaPrevista:['fecha_prevista','d'],estado:['estado'],avisoEnviado:['aviso_enviado','b'],ncm:['ncm'],seccionDeteccion:['seccion_deteccion'],resumen:['resumen'],causas:['causas'],accionRealizada:['accion_realizada'],operario:['operario'],limpiezaZona:['limpieza_zona','b'],sinMateriales:['sin_materiales','b'],comentarios:['comentarios'],fechaReal:['fecha_real','d'],aptoPor:['apto_por'],aptoFecha:['apto_fecha','d'],aptoComentario:['apto_comentario']}}
};
function toRow(coll,doc,full,id){
  const sc=SCHEMA[coll];
  if(sc.doc){const r={};r[sc.doc]=doc;if(full)r.id=id;return r}
  const o={};
  Object.keys(sc.f).forEach(k=>{
    const col=sc.f[k][0],t=sc.f[k][1]||'t';
    if(!(k in doc)&&!full)return;
    let v=doc[k];
    if(v===undefined||v===null||v==='')v=(t==='b'?false:(t==='a'||t==='j')?[]:null);
    else if(t==='b')v=!!v;
    o[col]=v;
  });
  if(full)o.id=id;
  return o
}
function fromRow(coll,row){
  const sc=SCHEMA[coll];let data={};
  if(sc.doc)data=row[sc.doc]||{};
  else Object.keys(sc.f).forEach(k=>{
    const col=sc.f[k][0],t=sc.f[k][1]||'t';let v=row[col];
    if(v===undefined||v===null)return;
    if(t==='b')v=!!v;else if(t==='a'||t==='j')v=Array.isArray(v)?v:[];else{v=String(v);if(v==='')return}
    data[k]=v;
  });
  return{id:row.id,data:data}
}
async function selectAll(table,build){
  const out=[];
  for(let from=0;;from+=1000){
    let q=sb.from(table).select('*');if(build)q=build(q);
    const r=await q.order('id').range(from,from+999);
    if(r.error)throw dbErr(r.error);
    out.push(...(r.data||[]));
    if(!r.data||r.data.length<1000)break
  }
  return out
}
async function loadColl(coll,where){
  const sc=SCHEMA[coll];
  const rows=await selectAll(sc.table,q=>{
    if(coll==='partes')q=q.or('fecha.gte.'+iso(addDays(new Date(),-200))+',estado.neq.Cerrado');
    else (where||[]).forEach(w=>{const c=sc.f&&sc.f[w[0]];if(!c)return;if(w[1]==='>=')q=q.gte(c[0],w[2]);else if(w[1]==='<=')q=q.lte(c[0],w[2]);else if(w[1]==='==')q=q.eq(c[0],w[2])});
    return q
  });
  return rows.map(r=>fromRow(coll,r))
}

/* Interfaz tipo "colección/documento" para que el resto de la app no cambie */
function makeDB(){
  const subs=[];
  const matches=(where,doc)=>where.every(w=>{const a=doc[w[0]];return w[1]==='>='?a>=w[2]:w[1]==='<='?a<=w[2]:w[1]==='=='?a===w[2]:true});
  const snapDoc=x=>({id:x.id,exists:true,data:()=>x.data,metadata:{}});
  function snapOf(sub){
    let l=[...sub.map.values()];
    if(sub.docId){const x=sub.map.get(sub.docId);return{id:sub.docId,exists:!!x,data:()=>x?x.data:undefined,metadata:{}}}
    if(sub.ord){const f=sub.ord[0],dir=sub.ord[1]==='desc'?-1:1;l.sort((a,b)=>String(a.data[f]||'').localeCompare(String(b.data[f]||''))*dir||a.id.localeCompare(b.id))}
    else l.sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true}));
    if(sub.lim)l=l.slice(0,sub.lim);
    return{docs:l.map(snapDoc),size:l.length,empty:!l.length,metadata:{}}
  }
  function emit(sub){try{sub.next(snapOf(sub))}catch(e){console.error(e)}}
  async function load(sub){
    const items=await loadColl(sub.coll,sub.where);
    const m=new Map();items.forEach(x=>{if(matches(sub.where,x.data)&&(!sub.docId||x.id===sub.docId))m.set(x.id,x)});
    const sig=JSON.stringify([...m.values()].map(x=>[x.id,x.data]));
    sub.map=m;if(sig!==sub.sig){sub.sig=sig;emit(sub)}
  }
  function subscribe(sub){
    sub.map=new Map();sub.sig=null;subs.push(sub);
    sub.run=async()=>{if(sub.busy)return;sub.busy=true;try{await load(sub);sub.failed=false}catch(e){if(!sub.failed&&sub.err)sub.err(e);sub.failed=true}finally{sub.busy=false}};
    sub.run();return()=>{const i=subs.indexOf(sub);if(i>=0)subs.splice(i,1)}
  }
  /* Tiempo real: cuando alguien guarda, se recarga lo que cambió. Respaldo: recarga cada minuto. */
  const timers={};
  const kick=coll=>{clearTimeout(timers[coll]);timers[coll]=setTimeout(()=>subs.forEach(s=>{if(s.coll===coll)s.run()}),400)};
  try{Object.keys(SCHEMA).forEach(coll=>{sb.channel('rt-'+coll).on('postgres_changes',{event:'*',schema:'public',table:SCHEMA[coll].table},()=>kick(coll)).subscribe()})}catch(e){}
  setInterval(()=>{if(!document.hidden)subs.forEach(s=>s.run&&s.run())},(CFG.pollSeconds||60)*1000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)subs.forEach(s=>s.run&&s.run())});
  const findCached=(coll,id)=>{for(const s of subs){if(s.coll===coll&&s.map.has(id))return s.map.get(id)}return null};
  function applyLocal(coll,id,data){
    subs.forEach(s=>{if(s.coll!==coll||(s.docId&&s.docId!==id))return;
      if(data&&matches(s.where,data))s.map.set(id,{id:id,data:data});else s.map.delete(id);
      s.sig=null;emit(s)})
  }
  async function fetchOne(coll,id){const r=await sb.from(SCHEMA[coll].table).select('*').eq('id',id).maybeSingle();if(r.error)throw dbErr(r.error);return r.data?fromRow(coll,r.data):null}
  async function write(coll,id,data,mode){
    const sc=SCHEMA[coll];let merged;
    if(mode==='set'){
      merged=Object.assign({},data);
      const r=await sb.from(sc.table).upsert(toRow(coll,merged,true,id));if(r.error)throw dbErr(r.error)
    }else{
      const cur=findCached(coll,id)||await fetchOne(coll,id);
      if(!cur){const e=new Error('El registro no existe');e.code='invalid_argument';throw e}
      merged=Object.assign({},cur.data,data);
      const r=await sb.from(sc.table).update(toRow(coll,data,false,id)).eq('id',id).select('id');
      if(r.error)throw dbErr(r.error);
      if(!r.data||!r.data.length){const e=new Error('Sin permiso para modificar este registro');e.code='invalid_argument';throw e}
    }
    applyLocal(coll,id,merged)
  }
  async function remove(coll,id){
    const r=await sb.from(SCHEMA[coll].table).delete().eq('id',id).select('id');if(r.error)throw dbErr(r.error);
    if(!r.data||!r.data.length){const e=new Error('Sin permiso para borrar este registro');e.code='invalid_argument';throw e}
    applyLocal(coll,id,null)
  }
  function mkQuery(coll,where,ord,lim){
    return{
      where:(f,op,v)=>mkQuery(coll,where.concat([[f,op,v]]),ord,lim),
      orderBy:(f,d)=>mkQuery(coll,where,[f,d||'asc'],lim),
      limit:n=>mkQuery(coll,where,ord,n),
      get:async()=>{const items=await loadColl(coll,where);const m=new Map();items.filter(x=>matches(where,x.data)).forEach(x=>m.set(x.id,x));return snapOf({map:m,ord:ord,lim:lim})},
      onSnapshot:(next,err)=>subscribe({coll:coll,where:where,ord:ord,lim:lim,next:next,err:err})
    }
  }
  return{
    collection:c=>mkQuery(c,[],null,null),
    doc:path=>{const i=path.indexOf('/'),coll=path.slice(0,i),id=path.slice(i+1);return{
      get:async()=>{const x=findCached(coll,id)||await fetchOne(coll,id);return{id:id,exists:!!x,data:()=>x?x.data:undefined}},
      set:d=>write(coll,id,d,'set'),update:d=>write(coll,id,d,'update'),delete:()=>remove(coll,id),
      onSnapshot:(next,err)=>subscribe({coll:coll,where:[],docId:id,next:next,err:err})}}
  }
}

/* ---- fotos en el almacenamiento privado "fotos" (carpetas ref/ e inc/) ---- */
const photoURL={},photoP={},photoFail={};
function loadPhoto(path){
  if(!photoP[path]){
    photoP[path]=sb.storage.from(BUCKET).download(path).then(r=>{if(r.error)throw dbErr(r.error);photoURL[path]=URL.createObjectURL(r.data);return photoURL[path]}).catch(e=>{delete photoP[path];photoFail[path]=Date.now();throw e})
  }
  return photoP[path]
}
function hydrate(){
  document.querySelectorAll('img[data-ph]').forEach(img=>{
    const p=img.dataset.ph;
    if(photoURL[p]){if(img.getAttribute('src')!==photoURL[p])img.src=photoURL[p];return}
    if(photoFail[p]&&Date.now()-photoFail[p]<30000)return;
    loadPhoto(p).then(()=>hydrate()).catch(()=>{})
  })
}
async function preloadPhotos(sel){
  const ps=[...new Set([...document.querySelectorAll(sel+' img[data-ph]')].map(i=>i.dataset.ph))];
  await Promise.all(ps.map(p=>loadPhoto(p).catch(()=>null)));hydrate()
}
function dataURItoBlob(u){const a=u.split(','),m=/:(.*?);/.exec(a[0])[1],b=atob(a[1]),u8=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u8[i]=b.charCodeAt(i);return new Blob([u8],{type:m})}
async function putPhoto(path,dataUri){const r=await sb.storage.from(BUCKET).upload(path,dataURItoBlob(dataUri),{contentType:'image/jpeg',upsert:true});if(r.error)throw dbErr(r.error)}
async function savePhotoPair(prefix,id,ph){await putPhoto(prefix+'/'+id+'.jpg',ph.full);await putPhoto(prefix+'/'+id+'_t.jpg',ph.thumb)}
async function inlinePhotos(html){
  const paths=[...new Set([...html.matchAll(/data-ph="([^"]+)"/g)].map(m=>m[1]))],map={};
  await Promise.all(paths.map(async p=>{try{const u=await loadPhoto(p),b=await(await fetch(u)).blob();map[p]=await new Promise(res=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.readAsDataURL(b)})}catch(e){}}));
  return html.replace(/data-ph="([^"]+)"/g,(m,p)=>map[p]?'src="'+map[p]+'"':'')
}
const saveFile=(name,data,type)=>{const u=URL.createObjectURL(new Blob([data],{type:type}));const a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000)};
async function exportAll(){
  const out={exportado:new Date().toISOString(),tablas:{}};
  for(const c of Object.keys(SCHEMA))out.tablas[SCHEMA[c].table]=await selectAll(SCHEMA[c].table);
  return out
}

/* ---- avisos por correo: los envía la función "aviso" del servidor ---- */
async function sendServerMail(m){
  if(!m.srv)throw new Error('Falta información del aviso');
  const r=await sb.functions.invoke('aviso',{body:m.srv});
  if(r.error)throw r.error;
  if(!r.data||!r.data.ok)throw new Error((r.data&&r.data.error)||'No se pudo enviar');
  return r.data
}
async function notify(m){
  if(CFG.avisosPorCorreo===false||!m.srv||!(m.to||[]).length){openMail(m);return}
  try{const r=await sendServerMail(m);toast('✉ Aviso enviado a '+r.to.length+' destinatario(s)'+((r.cc||[]).length?' y '+r.cc.length+' en copia':''))}
  catch(e){toast('No se pudo enviar desde la app. Envíalo a mano.');openMail(m)}
}

/* ====================== arranque y acceso ====================== */
let rq=0;function render(){cancelAnimationFrame(rq);rq=requestAnimationFrame(doRender)}
function begin(sess){
  if(S.started)return;S.started=true;
  const u=sess.user;
  S.account={username:u.email,name:(u.user_metadata&&u.user_metadata.name)||''};
  S.emails=[String(u.email).toLowerCase()];S.persona=S.emails[0];S.nombreSugerido=S.account.name;
  render();startData()
}
function startData(){
  S.db=makeDB();
  const err=n=>e=>{S.loaded[n]=true;toast('No se pudo leer '+n+(e&&e.message?' ('+e.message+')':''));render()};
  const arr=snap=>snap.docs.map(d=>Object.assign({id:d.id},d.data()));
  S.db.collection('personas').onSnapshot(s=>{S.personas=arr(s).sort((a,b)=>String(a.nombre).localeCompare(String(b.nombre)));S.loaded.personas=true;render()},err('personas'));
  S.db.collection('departamentos').onSnapshot(s=>{S.deptos=arr(s);S.loaded.deptos=true;render()},err('departamentos'));
  S.db.collection('puntos').onSnapshot(s=>{S.puntos=arr(s);S.loaded.puntos=true;render()},err('puntos'));
  S.db.doc('config/general').onSnapshot(s=>{if(s.exists)S.config=Object.assign({plazoDias:14,edicion:'Edición 1',desde:'2026-10-01',respDefault:'',dptoDefault:'',seccionesDeteccion:DEFAULT_SECC,validarHK:false},s.data());S.loaded.config=true;render()},err('config'));
  const d0=new Date();const cut=iso(new Date(d0.getFullYear(),d0.getMonth()-2,1));
  S.db.collection('revisiones').where('inicio','>=',cut).onSnapshot(s=>{const m={};s.docs.forEach(d=>m[d.id]=d.data());S.revs=m;S.loaded.revs=true;render()},err('revisiones'));
  S.db.collection('partes').orderBy('fecha','desc').limit(500).onSnapshot(s=>{S.partes=arr(s);S.loaded.partes=true;render()},err('partes'));
}
(async function init(){
  if(!window.supabase||!CFG.supabaseUrl||/REEMPLAZAR/i.test(CFG.supabaseUrl)||/REEMPLAZAR/i.test(CFG.supabaseKey||'')){S.fatal={msg:'Falta configurar config.js (dirección del proyecto y clave pública de Supabase).'};render();return}
  sb=supabase.createClient(CFG.supabaseUrl,CFG.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  sb.auth.onAuthStateChange((ev,sess)=>{
    if(ev==='SIGNED_OUT'){location.reload();return}
    if(sess&&sess.user)setTimeout(()=>begin(sess),0)
  });
  const r=await sb.auth.getSession();
  if(r.data&&r.data.session)begin(r.data.session);else render()
})();

/* ====================== render ====================== */
function doRender(){
  const app=$('#app');
  if(S.fatal){app.innerHTML=vFatal();return}
  if(!S.account){app.innerHTML=vSignIn();return}
  if(!S.db||!(S.loaded.personas&&S.loaded.deptos&&S.loaded.puntos&&S.loaded.revs&&S.loaded.partes&&S.loaded.config)){app.innerHTML='<div class="empty">Cargando…</div>';return}
  const p=me();S.isAdmin=!!(p&&p.admin);
  if(!p){app.innerHTML=vNoAccess();return}
  if(S.tab==='ajustes'&&!S.isAdmin)S.tab='inicio';
  if(S.tab==='hk'&&!canAudit())S.tab='inicio';
  if(S.tab==='informe')ensureRep();
  const V={inicio:vInicio,revision:vRevision,hk:vHK,partes:vPartes,informe:vInforme,ajustes:vAjustes};
  app.innerHTML=hdr()+'<main>'+V[S.tab]()+'</main>'+nav();
  hydrate()
}
function hdr(){const p=me();return '<header class="top"><div><b>Auditorías de planta</b><small>Refresco Iberia · Marcilla</small></div><button class="who" data-act="logout">'+(p?esc(p.nombre)+' ▾':'Entrar ▾')+'</button></header>'}
function nav(){
  const tabs=[['inicio','🏠','Inicio'],['revision','🪟','Vidrios']];
  if(canAudit())tabs.push(['hk','📝','Housekeeping']);
  tabs.push(['partes','🛠️','Incidencias'],['informe','🖨️','Informe']);if(S.isAdmin)tabs.push(['ajustes','⚙️','Ajustes']);
  const p=me();let badge=0;
  if(p){if(p.rol==='Calidad')badge=S.partes.filter(x=>x.estado==='Realizado').length;else badge=S.partes.filter(x=>x.estado==='Abierto'&&esMio(x)).length}
  return '<nav class="nav">'+tabs.map(t=>'<button class="'+(S.tab===t[0]?'on':'')+'" data-act="tab" data-tab="'+t[0]+'"><span class="ic">'+t[1]+'</span>'+t[2]+(t[0]==='partes'&&badge?'<span class="bd">'+badge+'</span>':'')+'</button>').join('')+'</nav>'
}



const empty=t=>'<div class="empty">'+t+'</div>';

/* ---------- Inicio ---------- */
function vInicio(){
  const p=me(),cal=p.rol==='Calidad';
  const abiertos=S.partes.filter(x=>x.estado==='Abierto'),venc=abiertos.filter(isOverdue),porVal=S.partes.filter(x=>x.estado==='Realizado');
  const mis=abiertos.filter(esMio);
  let pend=0,vp=0;lineasList().forEach(l=>{const g=progress(l);pend+=g.total-g.done;vp+=vencidasPrev(l)});
  let h='<h2>Hola, '+esc(first(p.nombre))+'</h2><p class="muted">'+esc(p.rol)+(p.departamento?' · '+esc(p.departamento):'')+'</p>';
  h+='<div class="kpis"><div class="kpi warn"><b>'+abiertos.length+'</b><span>Incidencias abiertas</span></div><div class="kpi bad"><b>'+venc.length+'</b><span>Fuera de plazo</span></div><div class="kpi"><b>'+porVal.length+'</b><span>Por validar (calidad)</span></div>'+(cal||S.isAdmin?'<div class="kpi warn"><b>'+pend+'</b><span>Revisiones de vidrios pendientes</span></div><div class="kpi bad"><b>'+vp+'</b><span>Sin hacer del periodo anterior</span></div>':'')+'</div>';
  if(cal||S.isAdmin){
    h+='<h3>Revisión de vidrios (periodo actual)</h3>';
    h+=lineasList().map(l=>{const g=progress(l),pc=g.total?Math.round(100*g.done/g.total):0,v=vencidasPrev(l);return '<div class="card"><div class="row"><b class="grow">'+esc(lineaLabel(l))+'</b><span class="muted small">'+g.done+' de '+g.total+'</span><button class="b sm" data-act="irLinea" data-l="'+esc(l)+'">Revisar</button></div><div class="bar"><i style="width:'+pc+'%"></i></div>'+(v?'<span class="chip bad">'+v+' del periodo anterior sin hacer</span>':'')+'</div>'}).join('')||empty('Aún no hay puntos en el catálogo.');
    if(porVal.length)h+='<h3>Por validar (Apto calidad)</h3>'+porVal.map(x=>parteCard(x)).join('');
    if(venc.length)h+='<h3>Fuera de plazo</h3>'+venc.map(x=>parteCard(x)).join('');
  }else{
    h+='<h3>Incidencias abiertas de mi departamento</h3>'+(mis.length?mis.map(x=>parteCard(x)).join(''):empty('No tienes incidencias pendientes ✔'));
  }
  return h
}

/* ---------- Revisión de vidrios ---------- */
function vRevision(){
  const ls=lineasList();if(!ls.length)return empty('No hay puntos en el catálogo.');
  if(!S.linea||!ls.includes(S.linea))S.linea=ls[0];
  const ca=canAudit();
  const pts=activos(S.linea).filter(x=>S.perF==='Todas'||x.per===S.perF).sort(byId);
  const rows=pts.map(pt=>({pt:pt,st:statOf(pt,S.off)}));
  const done=rows.filter(r=>r.st.rev).length,pc=rows.length?Math.round(100*done/rows.length):0;
  const list=S.soloPend?rows.filter(r=>!r.st.rev):rows;
  let h='<h2>Revisión de vidrios y acrílicos</h2>';
  h+='<div class="chips">'+ls.map(l=>'<button class="'+(l===S.linea?'on':'')+'" data-act="setLinea" data-l="'+esc(l)+'">'+esc(l)+'</button>').join('')+'</div>';
  h+='<div class="row"><div class="grow"><select data-set="perF">'+['Todas','Semanal','Quincenal','Mensual'].map(x=>'<option '+(x===S.perF?'selected':'')+'>'+x+'</option>').join('')+'</select></div><div class="grow"><select data-set="off"><option value="0" '+(S.off===0?'selected':'')+'>Periodo actual</option><option value="-1" '+(S.off===-1?'selected':'')+'>Periodo anterior</option></select></div></div>';
  h+='<label class="inl"><input type="checkbox" data-set="soloPend" '+(S.soloPend?'checked':'')+'> Mostrar solo pendientes</label>';
  h+='<div class="card"><div class="row"><b class="grow">'+esc(lineaLabel(S.linea))+'</b><span class="muted small">'+done+' de '+rows.length+' revisadas</span></div><div class="bar"><i style="width:'+pc+'%"></i></div></div>';
  if(!ca)h+='<div class="warnbox">Solo el personal de Calidad puede marcar las revisiones.</div>';
  if(!list.length)return h+empty(rows.length?'Todo revisado en este periodo ✔':'No hay puntos con esos filtros.');
  let cur=null;
  list.forEach(r=>{if(r.pt.equipo!==cur){cur=r.pt.equipo;h+='<div class="grp">'+esc(cur)+'</div>'}h+=ptRow(r.pt,r.st,ca)});
  return h
}
function ptRow(pt,st,ca){
  const r=st.rev,nf=(pt.fotos||[]).length,th=nf?'ref/'+thumbName(pt.fotos[0]):'';
  const ph=th?'<img data-ph="'+esc(th)+'" data-act="imgs" data-pid="'+esc(pt.id)+'" alt="">'+(nf>1?'<div class="n">'+nf+' fotos</div>':''):'<div class="nofoto">Sin foto</div>';
  let cls='s-pend',res;
  if(!r){res=ca?'<div class="btns"><button class="b ok" data-act="ok" data-pid="'+esc(pt.id)+'">OK</button><button class="b bad" data-act="nook" data-pid="'+esc(pt.id)+'">NO OK</button></div>':'<span class="chip pend">Pendiente</span>'}
  else if(r.resultado==='OK'){cls='s-ok';res='<span class="chip ok">✔ OK</span> <span class="muted small">'+fmtD(r.fecha)+' · '+esc(r.por)+'</span>'+(ca?' <button class="lnk small" data-act="undo" data-rid="'+esc(st.id)+'">Deshacer</button>':'')}
  else{cls='s-bad';res='<span class="chip bad">✖ NO OK</span> <span class="muted small">'+fmtD(r.fecha)+' · '+esc(r.por)+' · ACP:</span> <button class="lnk small" data-act="verparte" data-id="'+esc(r.parteId||'')+'">'+esc(r.parteId||'—')+'</button>'+(ca?' <button class="lnk small" data-act="undo" data-rid="'+esc(st.id)+'">Deshacer</button>':'')}
  return '<div class="pt '+cls+'"><div class="ph">'+ph+'</div><div class="pb"><div class="rev">'+esc(pt.rev)+'</div><div class="meta">'+(pt.mat?'<span>Material: '+esc(pt.mat)+'</span>':'')+(pt.cant?'<span>Cantidad: '+esc(pt.cant)+'</span>':'')+'<span class="chip">'+esc(pt.per)+' · '+fmtS(st.per.inicio)+'–'+fmtS(st.per.limite)+'</span></div>'+res+'</div></div>'
}

/* ---------- Housekeeping ---------- */
function vHK(){
  const hk=S.partes.filter(x=>origenOf(x)==='Housekeeping');
  let h='<h2>Housekeeping</h2><p class="muted">Auditoría de orden y limpieza. Cada no conformidad avisa por correo al departamento que la resuelve.</p>';
  h+='<p style="margin:14px 0"><button class="b pri big" data-act="newHK">+ Nueva no conformidad</button></p>';
  h+='<h3>Últimas ('+hk.length+')</h3>';
  return h+(hk.length?hk.slice(0,15).map(parteCard).join(''):empty('Todavía no hay no conformidades de Housekeeping.'))
}
function openHK(){
  const secc=secciones(),prev=iso(addDays(new Date(),Number(S.config.plazoDias)||14));
  openSheet('Housekeeping · nueva no conformidad','<label>Fecha apertura</label><input type="date" id="h_fecha" value="'+todayISO()+'"><label>NCm/NCM *</label><input id="h_ncm" placeholder="Ej.: A.O.03"><label>Sección detección *</label><select id="h_det"><option value="">—</option>'+secc.map(s=>'<option>'+esc(s)+'</option>').join('')+'</select><label>Sección resolución (departamento que recibe el aviso) *</label><select id="h_dpto">'+optsDeptos('')+'</select><label>Responsable concreto (opcional)</label><select id="h_resp">'+'<option value="">—</option>'+S.personas.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.nombre)+'</option>').join('')+'</select><label>Resumen no conformidades *</label><textarea id="h_resumen" rows="2"></textarea><label>Análisis de causas *</label><textarea id="h_causas" rows="2"></textarea><label>Acciones correctivas/preventivas a implantar *</label><textarea id="h_acc" rows="2"></textarea><label>Fecha prevista *</label><input type="date" id="h_prev" value="'+prev+'">'+photoField('f_foto','Foto de calidad',true),{label:'Crear no conformidad',cls:'bad',wire:()=>wirePhoto('f_foto'),onSave:async()=>{
    const v={fecha:val('h_fecha'),ncm:val('h_ncm').trim(),det:val('h_det'),dpto:val('h_dpto'),resp:val('h_resp'),resumen:val('h_resumen').trim(),causas:val('h_causas').trim(),acc:val('h_acc').trim(),prev:val('h_prev')},ph=photos.f_foto,p=me();
    if(!v.fecha||!v.ncm||!v.det||!v.dpto||!v.resumen||!v.causas||!v.acc||!v.prev||!ph){toast('Rellena todos los campos obligatorios y añade la foto');return false}
    const fid=uid(),id='HK'+v.fecha.slice(2).replace(/-/g,'')+'-'+Math.random().toString(36).slice(2,5).toUpperCase();
    await savePhotoPair('inc',fid,ph);
    const parte={origen:'Housekeeping',fecha:v.fecha,linea:'HK',zona:v.det,elemento:v.ncm,ncm:v.ncm,seccionDeteccion:v.det,dpto:v.dpto,resp:v.resp||'',resumen:v.resumen,causas:v.causas,accion:v.acc,creadoPor:p?p.nombre:'',fotoIni:fid,fechaPrevista:v.prev,estado:'Abierto',avisoEnviado:false};
    await S.db.doc('partes/'+id).set(parte);
    return{after:()=>{toast('No conformidad '+id+' creada');notify(mailNuevoParte(Object.assign({id:id},parte)))}}
  }})
}

/* ---------- Incidencias ---------- */
function parteCard(x){
  const pr=personaById(x.resp),ov=isOverdue(x),hk=origenOf(x)==='Housekeeping',dp=deptOf(x);
  let h='<article class="card parte e-'+esc(x.estado)+(ov?' venc':'')+'"><div class="row"><b class="grow">'+esc(x.id)+' <span class="chip">'+esc(origenOf(x))+'</span></b><span class="chip '+(x.estado==='Cerrado'?'ok':x.estado==='Realizado'?'':'warn')+'">'+esc(x.estado)+'</span></div>';
  if(hk){
    h+='<h4>'+esc(x.zona)+' — NCm/NCM '+esc(x.ncm||x.elemento)+'</h4><p><b>Resumen:</b> '+esc(x.resumen)+'</p><p><b>Análisis de causas:</b> '+esc(x.causas)+'</p><p><b>Acciones correctivas/preventivas:</b> '+esc(x.accion)+'</p>';
  }else{
    h+='<h4>'+esc(x.zona)+' — '+esc(x.elemento)+'</h4><p>'+esc(x.accion)+'</p>';
  }
  h+='<div class="meta"><span>Abierto: '+fmtD(x.fecha)+'</span><span>Resuelve: '+esc(dp||'(sin asignar)')+(pr?' · '+esc(pr.nombre):'')+'</span><span>Prevista: '+fmtD(x.fechaPrevista)+(ov?' <span class="chip bad">fuera de plazo</span>':'')+'</span></div>';
  h+='<div class="thumbs">'+(x.fotoIni?'<figure><img data-ph="inc/'+esc(x.fotoIni)+'_t.jpg" data-act="foto" data-f="inc/'+esc(x.fotoIni)+'.jpg" alt=""><figcaption>Detección</figcaption></figure>':'')+(x.fotoFin?'<figure><img data-ph="inc/'+esc(x.fotoFin)+'_t.jpg" data-act="foto" data-f="inc/'+esc(x.fotoFin)+'.jpg" alt=""><figcaption>Resuelto</figcaption></figure>':'')+'</div>';
  if(x.estado!=='Abierto'){
    if(hk)h+='<div class="kv">'+(x.accionRealizada?'<b>Acción realizada:</b> '+esc(x.accionRealizada)+'<br>':'')+'<b>Hecho por:</b> '+esc(x.operario)+' · <b>Fecha real:</b> '+fmtD(x.fechaReal)+(x.comentarios?'<br><b>Comentarios:</b> '+esc(x.comentarios):'')+'</div>';
    else h+='<div class="kv"><b>Acción realizada:</b> '+esc(x.accionRealizada)+'<br><b>Limpieza de zona:</b> '+(x.limpiezaZona?'Sí':'No')+' · <b>Sin materiales/herramientas olvidados:</b> '+(x.sinMateriales?'Sí':'No')+'<br><b>Operario:</b> '+esc(x.operario)+' · <b>Fecha real:</b> '+fmtD(x.fechaReal)+(x.comentarios?'<br><b>Comentarios:</b> '+esc(x.comentarios):'')+'</div>';
  }
  if(x.estado==='Cerrado'&&x.aptoPor)h+='<div class="kv"><b>Apto calidad:</b> '+esc(x.aptoPor)+' · '+fmtD(x.aptoFecha)+(x.aptoComentario?' · '+esc(x.aptoComentario):'')+'</div>';
  if(x.estado==='Abierto'&&x.aptoComentario)h+='<div class="warnbox">Devuelto por calidad: '+esc(x.aptoComentario)+'</div>';
  let b='';
  if(x.estado==='Abierto'){if(canResolve(x))b+='<button class="b pri sm" data-act="hecho" data-id="'+esc(x.id)+'">Hecho</button>';if(isCal()||S.isAdmin)b+='<button class="b sm" data-act="avisar" data-id="'+esc(x.id)+'">✉ Avisar'+(x.avisoEnviado?' de nuevo':'')+'</button>'}
  if(x.estado==='Realizado'){if(isCal()||S.isAdmin){b+='<button class="b ok sm" data-act="apto" data-id="'+esc(x.id)+'" data-v="1">Apto</button><button class="b bad sm" data-act="apto" data-id="'+esc(x.id)+'" data-v="0">No apto</button>'}else if(canResolve(x))b+='<button class="b sm" data-act="avisarCal" data-id="'+esc(x.id)+'">✉ Avisar a calidad</button>'}
  if(S.isAdmin)b+='<button class="b ghost sm" data-act="delParte" data-id="'+esc(x.id)+'">Eliminar</button>';
  return h+(b?'<div class="row" style="margin-top:8px">'+b+'</div>':'')+'</article>'
}
function vPartes(){
  const p=me();if(S.fResp===null)S.fResp=(p&&(p.rol==='Calidad'||S.isAdmin))?'todos':'mios';
  let l=S.partes.slice();
  if(S.focus){l=l.filter(x=>x.id===S.focus)}
  else{
    if(S.fEstado!=='Todos')l=l.filter(x=>x.estado===S.fEstado);
    if(S.fOrigen!=='Todos')l=l.filter(x=>origenOf(x)===S.fOrigen);
    if(S.fDpto!=='Todos')l=l.filter(x=>deptOf(x)===S.fDpto);
    if(S.fMes)l=l.filter(x=>String(x.fecha).startsWith(S.fMes));
    if(S.fResp==='mios'&&p)l=l.filter(esMio);
  }
  let h='<h2>Incidencias</h2>';
  if(S.focus)h+='<p><button class="b sm" data-act="clearFocus">← Ver todas las incidencias</button></p>';
  else{
    h+='<div class="row"><div class="grow"><select data-set="fEstado">'+['Abierto','Realizado','Cerrado','Todos'].map(x=>'<option '+(x===S.fEstado?'selected':'')+'>'+x+'</option>').join('')+'</select></div><div class="grow"><select data-set="fOrigen">'+['Todos','Vidrios','Housekeeping'].map(x=>'<option '+(x===S.fOrigen?'selected':'')+'>'+x+'</option>').join('')+'</select></div><div class="grow"><select data-set="fResp"><option value="mios" '+(S.fResp==='mios'?'selected':'')+'>Mi departamento</option><option value="todos" '+(S.fResp==='todos'?'selected':'')+'>Todas</option></select></div></div>';
    h+='<div class="row" style="margin-top:8px"><div class="grow"><select data-set="fDpto">'+['Todos'].concat(S.deptos.map(d=>d.nombre).sort()).map(x=>'<option '+(x===S.fDpto?'selected':'')+'>'+esc(x)+'</option>').join('')+'</select></div><div class="grow"><input type="month" data-set="fMes" value="'+esc(S.fMes)+'" title="Mes (vacío = todos)"></div></div>';
    if(isCal()||S.isAdmin){
      const por={};S.partes.filter(x=>x.estado==='Abierto'&&deptOf(x)).forEach(x=>{(por[deptOf(x)]=por[deptOf(x)]||[]).push(x)});
      const ds=Object.keys(por).sort();
      if(ds.length)h+='<h3>Resumen por correo a cada departamento</h3><div class="card">'+ds.map(n=>'<div class="row" style="margin:4px 0"><span class="grow">'+esc(n)+' · '+por[n].length+' abiertas</span><button class="b sm" data-act="digest" data-r="'+esc(n)+'">✉ Enviar resumen</button></div>').join('')+'</div>';
    }
  }
  return h+(l.length?l.map(parteCard).join(''):empty('No hay incidencias con estos filtros.'))
}

/* ---------- Informe (formato Word / listado) ---------- */
function monthRange(m){const a=m.split('-').map(Number);return[m+'-01',iso(new Date(a[0],a[1],0))]}
async function ensureRep(){
  const key=S.repMes||todayISO().slice(0,7);if(S.rep.key===key||S.rep.loading===key)return;
  S.rep.loading=key;
  try{const r=monthRange(key);const s=await S.db.collection('revisiones').where('inicio','>=',r[0]).where('inicio','<=',r[1]).get();S.rep={key:key,loading:false,revs:s.docs.map(d=>Object.assign({id:d.id},d.data()))}}
  catch(e){S.rep={key:key,loading:false,revs:[]};toast('No se pudo cargar el mes')}
  render()
}
function hojaHTML(linea,mes,revs){
  const pts=activos(linea).sort(byId),byP={};revs.filter(r=>r.linea===linea).forEach(r=>(byP[r.pid]=byP[r.pid]||[]).push(r));
  const a=mes.split('-');
  let h='<table class="rep head"><tr class="head"><td rowspan="2" class="logo">REFRESCO<br>IBERIA</td><td>CONTROL VIDRIOS, ACRÍLICOS EN '+esc(lineaLabel(linea))+' (PRODUCCIÓN)</td><td>'+esc(S.config.edicion)+'</td></tr><tr class="head"><td>'+esc(lineaLabel(linea))+' &nbsp;&nbsp; FECHA: '+a[1]+'/'+a[0]+'</td><td>FIRMA APROBADO:<br><span style="font-weight:400">Responsable de Calidad</span><br><br></td></tr></table><br>';
  h+='<table class="rep"><thead><tr><th>FOTO</th><th>REVISIÓN</th><th>MATERIAL</th><th>CANTIDAD</th><th>PERIODO REVISIÓN</th><th>FECHA</th><th>OK</th><th>NO OK</th><th>ACP</th><th>FIRMA</th></tr></thead><tbody>';
  let cur=null;
  pts.forEach(pt=>{
    if(pt.equipo!==cur){cur=pt.equipo;h+='<tr class="gr"><td colspan="10">'+esc(cur)+'</td></tr>'}
    const rs=(byP[pt.id]||[]).sort((x,y)=>x.inicio.localeCompare(y.inicio));
    const ok=rs.filter(r=>r.resultado==='OK').length,no=rs.filter(r=>r.resultado==='NO OK');
    const th=(pt.fotos&&pt.fotos[0])?'ref/'+thumbName(pt.fotos[0]):'';
    h+='<tr><td>'+(th?'<img data-ph="'+esc(th)+'" alt="">':'')+'</td><td>'+esc(pt.rev)+'</td><td>'+esc(pt.mat)+'</td><td>'+esc(pt.cant)+'</td><td class="c">'+esc(String(pt.per).toUpperCase())+'</td><td class="c">'+(rs.map(r=>fmtS(String(r.fecha).slice(0,10))).join('<br>')||'—')+'</td><td class="c okc">'+(ok?'✔ '+ok:'')+'</td><td class="c nokc">'+(no.length?'✖ '+no.length:'')+'</td><td class="c">'+no.map(r=>esc(r.parteId||'')).join('<br>')+'</td><td class="c">'+[...new Set(rs.map(r=>first(r.por)))].map(esc).join('<br>')+'</td></tr>'
  });
  return h+'</tbody></table>'
}
const vidriosPartes=mes=>S.partes.filter(x=>origenOf(x)==='Vidrios'&&(String(x.fecha).startsWith(mes)||x.estado!=='Cerrado')).sort((x,y)=>String(x.fecha).localeCompare(String(y.fecha)));
function parteHTML(mes){
  const a=mes.split('-'),l=vidriosPartes(mes);
  let h='<div class="rep-title">REVISIÓN VIDRIOS EN PLANTA — '+a[1]+'/'+a[0]+'</div><table class="rep"><thead><tr><th>FECHA</th><th>ZONA</th><th>ELEMENTO</th><th>ACCIÓN REALIZADA</th><th>LIMPIEZA ZONA</th><th>AUSENCIA MATERIALES/ HERRAMIENTAS</th><th>OPERARIO</th><th>APTO CALIDAD</th><th>FECHA PREVISTA</th></tr></thead><tbody>';
  if(!l.length)h+='<tr><td colspan="9" class="c">Sin partes</td></tr>';
  l.forEach(x=>{const done=x.estado!=='Abierto';h+='<tr><td>'+fmtD(x.fecha)+'<br><span style="color:#555">'+esc(x.id)+'</span></td><td>'+esc(x.zona)+'</td><td>'+esc(x.elemento)+'</td><td>'+(done?esc(x.accionRealizada)+'<br><span style="color:#555">'+fmtD(x.fechaReal)+'</span>':'<i style="color:#555">Pendiente: '+esc(x.accion)+'</i>')+'</td><td class="c">'+(done?(x.limpiezaZona?'✔':'✖'):'')+'</td><td class="c">'+(done?(x.sinMateriales?'✔':'✖'):'')+'</td><td>'+esc(done?x.operario:'')+'</td><td class="c">'+(x.estado==='Cerrado'?esc(first(x.aptoPor))+'<br>'+fmtD(x.aptoFecha):'')+'</td><td class="c">'+fmtD(x.fechaPrevista)+'</td></tr>'});
  return h+'</tbody></table>'
}
const hkList=()=>S.partes.filter(x=>origenOf(x)==='Housekeeping'&&(S.repAll||String(x.fecha).startsWith(S.repMes)||(S.repOpen&&x.estado!=='Cerrado'&&String(x.fecha)<S.repMes+'-01'))).sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha))||String(a.id).localeCompare(String(b.id)));
const respName=x=>{const pr=personaById(x.resp);return pr?pr.nombre:deptOf(x)};
function hkHTML(){
  const l=hkList();
  let h='<div class="rep-title">HOUSEKEEPING — '+(S.repAll?'TODOS LOS MESES':S.repMes.split('-').reverse().join('/'))+'</div><table class="rep"><thead><tr><th>ID</th><th>FECHA APERT</th><th>MES</th><th>NCm/NCM</th><th>SECCIÓN DETECCIÓN</th><th>SECCIÓN RESOLUCIÓN</th><th>RESUMEN NO CONFORMIDADES</th><th>ANÁLISIS DE CAUSAS</th><th>ACCIONES CORRECTIVAS/PREVENTIVAS</th><th>RESPONSABLE</th><th>FECHA PREVISTA</th><th>FECHA REAL</th><th>ESTADO</th></tr></thead><tbody>';
  if(!l.length)h+='<tr><td colspan="13" class="c">Sin no conformidades</td></tr>';
  l.forEach(x=>{h+='<tr><td>'+esc(x.id)+'</td><td>'+fmtD(x.fecha)+'</td><td class="c">'+Number(String(x.fecha).slice(5,7))+'</td><td>'+esc(x.ncm||x.elemento)+'</td><td>'+esc(x.seccionDeteccion||x.zona)+'</td><td>'+esc(deptOf(x))+'</td><td>'+esc(x.resumen)+'</td><td>'+esc(x.causas)+'</td><td>'+esc(x.accion)+'</td><td>'+esc(respName(x))+'</td><td class="c">'+fmtD(x.fechaPrevista)+'</td><td class="c">'+fmtD(x.fechaReal)+'</td><td class="c">'+(x.estado==='Cerrado'?'C':'A')+'</td></tr>'});
  return h+'</tbody></table>'
}

/* ---- Exportación Housekeeping en el formato del Excel del holding (23 columnas) ---- */
const HK_HEAD=['Nombre','Fecha apert','NCm/NCM','Sección detección','Seccion Resolucion','Resumen no conformidades','1. Resumen no conformidades','2.Resumen no conformidades','3.Resumen no conformidades','Analisis de causas','1.Analisis de causas','2.Analisis de causas','3.Analisis de causas','Acciones correctivas/Preventivas a implantar','1.Acciones correctivas/Preventivas a implantar','2.Acciones correctivas/Preventivas a implantar','3.Acciones correctivas/Preventivas a implantar','Responsable','Fecha prevista','Fecha Real','Estado','Imagen Calidad','Comentarios'];
const HK_DATECOLS=[1,18,19];
const HK_WIDTHS=[18,12,10,18,18,36,10,10,10,30,10,10,10,36,10,10,10,20,13,12,8,14,36];
function hkExportRows(){
  return hkList().map(x=>[x.creadoPor||'',x.fecha||'',x.ncm||x.elemento||'',x.seccionDeteccion||x.zona||'',deptOf(x),x.resumen||'','','','',x.causas||'','','','',x.accion||'','','','',respName(x),x.fechaPrevista||'',x.fechaReal||'',x.estado==='Cerrado'?'C':'A','',[x.accionRealizada,x.comentarios].filter(Boolean).join(' · ')])
}
const dmy=s=>s?String(s).slice(0,10).split('-').reverse().join('/'):'';
const xlSerial=s=>{const a=String(s).slice(0,10).split('-').map(Number);return Date.UTC(a[0],a[1]-1,a[2])/86400000+25569};
function hkTSV(){return hkExportRows().map(r=>r.map((v,i)=>HK_DATECOLS.includes(i)?dmy(v):String(v).replace(/[\t\r\n]+/g,' ')).join('\t')).join('\r\n')}
function hkWorkbook(){
  const rows=hkExportRows().map(r=>r.map((v,i)=>HK_DATECOLS.includes(i)?(v?xlSerial(v):null):String(v).replace(/\t+/g,' ')));
  const ws=XLSX.utils.aoa_to_sheet([HK_HEAD].concat(rows));
  const rg=XLSX.utils.decode_range(ws['!ref']);
  for(let R=1;R<=rg.e.r;R++)HK_DATECOLS.forEach(c=>{const a=XLSX.utils.encode_cell({r:R,c:c});if(ws[a]&&ws[a].t==='n')ws[a].z='dd/mm/yyyy'});
  ws['!cols']=HK_WIDTHS.map(w=>({wch:w}));
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Housekeeping');return wb
}
async function hkCopy(){
  const n=hkExportRows().length;if(!n){toast('No hay filas en ese periodo');return}
  const tsv=hkTSV();
  try{await navigator.clipboard.writeText(tsv);toast('Copiadas '+n+' filas (sin cabecera). Pega en el Excel del holding con Ctrl+V')}
  catch(e){openSheet('Copiar para el Excel del holding','<p class="muted small">Selecciona todo el texto, cópialo (Ctrl+C) y pégalo en la primera celda libre del Excel del holding. Son '+n+' filas, sin cabecera.</p><textarea id="tsvbox" rows="10" readonly style="font:12px monospace;white-space:pre;overflow:auto">'+esc(tsv)+'</textarea>',{noSave:true,wire:()=>{const t=$('#tsvbox');t.focus();t.select()}})}
}
function hkXlsx(){
  if(!hkExportRows().length){toast('No hay filas en ese periodo');return}
  if(!window.XLSX){toast('No se pudo cargar el generador de Excel. Usa «Copiar» o el CSV.');return}
  try{const data=XLSX.write(hkWorkbook(),{type:'array',bookType:'xlsx'});saveFile('housekeeping_'+(S.repAll?'todos':S.repMes)+'.xlsx',data,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
  catch(er){toast('No se pudo generar el Excel. Usa «Copiar» o el CSV.')}
}
const repBody=()=>S.repTab==='hoja'?hojaHTML(S.repLinea,S.repMes,S.rep.revs):S.repTab==='parte'?parteHTML(S.repMes):hkHTML();
function vInforme(){
  const ls=lineasList();if(!S.repLinea||!ls.includes(S.repLinea))S.repLinea=ls[0];
  if(!S.repMes)S.repMes=todayISO().slice(0,7);
  let h='<h2 class="noprint">Informes</h2><div class="noprint"><div class="chips"><button class="'+(S.repTab==='hoja'?'on':'')+'" data-act="repTab" data-t="hoja">Hoja de revisión (vidrios)</button><button class="'+(S.repTab==='parte'?'on':'')+'" data-act="repTab" data-t="parte">Parte de mantenimiento</button><button class="'+(S.repTab==='hk'?'on':'')+'" data-act="repTab" data-t="hk">Housekeeping</button></div>';
  h+='<div class="row">'+(S.repTab==='hoja'?'<div class="grow"><select data-set="repLinea">'+ls.map(l=>'<option '+(l===S.repLinea?'selected':'')+'>'+esc(l)+'</option>').join('')+'</select></div>':'')+'<div class="grow"><input type="month" data-set="repMes" value="'+esc(S.repMes)+'"></div>'+(S.repTab==='hk'?'<label class="inl"><input type="checkbox" data-set="repAll" '+(S.repAll?'checked':'')+'> Todos los meses</label><label class="inl"><input type="checkbox" data-set="repOpen" '+(S.repOpen?'checked':'')+'> Incluir abiertas de meses anteriores</label>':'')+'</div>';
  h+=(S.repTab==='hk'?'<div class="row" style="margin:10px 0"><button class="b pri sm" data-act="hkCopy">📋 Copiar para el Excel del holding</button><button class="b sm" data-act="hkXlsx">⬇ Excel (.xlsx)</button><button class="b sm" data-act="dlCsv">CSV</button><button class="b ghost sm" data-act="imprimir">🖨️ Imprimir</button></div><p class="muted small">Mismo orden de columnas que la vista «Exportación a excel» ('+hkExportRows().length+' filas). La copia no lleva cabecera.</p></div>':'<div class="row" style="margin:10px 0"><button class="b pri sm" data-act="imprimir">🖨️ Imprimir / PDF</button><button class="b sm" data-act="dlHtml">Descargar para imprimir</button><button class="b sm" data-act="dlCsv">Descargar CSV</button></div></div>');
  if(S.repTab==='hoja'&&S.rep.key!==S.repMes)return h+empty('Cargando mes…');
  return h+'<div class="rep-wrap">'+repBody()+'</div>'
}
function reportDocHTML(){
  const css='@page{size:A4 landscape;margin:9mm}body{font-family:Arial,sans-serif;margin:10px}.rep{border-collapse:collapse;width:100%;font:11px/1.3 Arial}.rep td,.rep th{border:1px solid #333;padding:4px 5px;vertical-align:top}.rep th{background:#dfe6f4}.rep .head td{font-weight:700}.rep .logo{font-style:italic;font-size:15px;text-align:center;width:150px}.rep .gr td{background:#1c377a;color:#fff;font-weight:700;text-transform:uppercase;-webkit-print-color-adjust:exact;print-color-adjust:exact}.rep img{width:62px;height:46px;object-fit:cover}.c{text-align:center}.okc{color:#0a7a46;font-weight:700}.nokc{color:#c0301c;font-weight:700}.rep-title{font:700 15px Arial;margin:6px 0}';
  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Auditorías de planta</title><style>'+css+'</style></head><body>'+repBody()+'</body></html>'
}
const csvCell=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
function reportCSV(){
  let rows;
  if(S.repTab==='hk'){
    rows=[HK_HEAD].concat(hkExportRows().map(r=>r.map((v,i)=>HK_DATECOLS.includes(i)?dmy(v):v)))
  }else if(S.repTab==='parte'){
    rows=[['Parte','Fecha','Línea','Zona','Elemento','Acción a realizar','Departamento','Responsable','Fecha prevista','Estado','Acción realizada','Limpieza zona','Sin materiales/herramientas','Operario','Fecha real','Apto por','Fecha apto','Comentarios']];
    vidriosPartes(S.repMes).forEach(x=>{const pr=personaById(x.resp);rows.push([x.id,fmtD(x.fecha),x.linea,x.zona,x.elemento,x.accion,deptOf(x),pr?pr.nombre:'',fmtD(x.fechaPrevista),x.estado,x.accionRealizada||'',x.estado==='Abierto'?'':(x.limpiezaZona?'Sí':'No'),x.estado==='Abierto'?'':(x.sinMateriales?'Sí':'No'),x.operario||'',fmtD(x.fechaReal),x.aptoPor||'',fmtD(x.aptoFecha),x.comentarios||''])})
  }else{
    rows=[['Línea','Equipo','Revisión','Periodicidad','Inicio periodo','Resultado','Fecha','Revisado por','Parte (ACP)','Observación']];
    S.rep.revs.filter(r=>r.linea===S.repLinea).sort((a,b)=>a.pid.localeCompare(b.pid,undefined,{numeric:true})||a.inicio.localeCompare(b.inicio)).forEach(r=>{const pt=S.puntos.find(p=>p.id===r.pid);rows.push([r.linea,r.equipo,pt?pt.rev:'',r.per,fmtD(r.inicio),r.resultado,fmtD(r.fecha),r.por,r.parteId||'',r.obs||''])})
  }
  return rows.map(r=>r.map(csvCell).join(';')).join('\r\n')
}

/* ---------- Ajustes ---------- */
function vAjustes(){
  const nm=ids=>(ids||[]).map(i=>(personaById(i)||{}).nombre||i);
  let h='<h2>Ajustes</h2><h3>Departamentos y correos</h3><div class="card">';
  h+=S.deptos.length?S.deptos.slice().sort((a,b)=>a.nombre.localeCompare(b.nombre)).map(d=>'<div class="row" style="margin:8px 0"><div class="grow"><b>'+esc(d.nombre)+'</b><br><span class="muted small">PARA: '+esc(nm(d.para).join(', ')||'—')+'<br>CC: '+esc(nm(d.cc).join(', ')||'—')+'</span></div><button class="b sm" data-act="editDepto" data-id="'+esc(d.id)+'">Editar</button></div>').join(''):'<p class="muted">Aún no hay departamentos.</p>';
  h+='<p><button class="b pri sm" data-act="editDepto" data-id="">+ Añadir departamento</button></p></div>';
  h+='<h3>Personas</h3><div class="card">';
  h+=S.personas.length?S.personas.map(p=>'<div class="row" style="margin:6px 0"><div class="grow"><b>'+esc(p.nombre)+'</b> <span class="chip">'+esc(p.rol)+'</span><br><span class="muted small">'+esc(p.email||'sin correo')+(p.departamento?' · '+esc(p.departamento):'')+'</span></div><button class="b sm" data-act="editPersona" data-id="'+esc(p.id)+'">Editar</button></div>').join(''):'<p class="muted">Aún no hay personas.</p>';
  h+='<p><button class="b pri sm" data-act="editPersona" data-id="">+ Añadir persona</button></p></div>';
  h+='<h3>Parámetros</h3><div class="card"><div class="kv">Departamento por defecto de un NO OK de vidrios: <b>'+esc(dptoDefault()||'—')+'</b><br>Plazo por defecto: <b>'+S.config.plazoDias+' días</b><br>Texto de edición en la hoja: <b>'+esc(S.config.edicion)+'</b><br>Control vigente desde: <b>'+fmtD(S.config.desde)+'</b><br>Secciones de detección (Housekeeping): <b>'+esc(secciones().join(', '))+'</b><br>Housekeeping requiere Apto de calidad: <b>'+(S.config.validarHK?'Sí':'No (se cierra al pulsar Hecho)')+'</b></div><p><button class="b sm" data-act="editConfig">Cambiar</button></p></div>';
  h+='<h3>Copia de seguridad</h3><div class="card"><p class="muted small">Descarga todos los datos (menos las fotos) en un archivo. Conviene hacerlo cada semana o cada mes y guardarlo en SharePoint.</p><button class="b sm" data-act="backup">Descargar copia</button></div>';
  const ls=['Todas'].concat(lineasList());
  const pts=S.puntos.filter(x=>S.ajLinea==='Todas'||x.linea===S.ajLinea).sort(byId);
  h+='<h3>Catálogo de puntos de vidrios ('+S.puntos.length+')</h3><div class="row"><div class="grow"><select data-set="ajLinea">'+ls.map(l=>'<option '+(l===S.ajLinea?'selected':'')+'>'+esc(l)+'</option>').join('')+'</select></div><button class="b pri sm" data-act="editPunto" data-id="">+ Nuevo punto</button></div>';
  h+=pts.map(x=>'<div class="card"><div class="row"><div class="grow"><span class="muted small">'+esc(x.id)+' · '+esc(x.equipo)+'</span><br>'+esc(x.rev)+'<br><span class="chip">'+esc(x.per)+'</span> '+(x.activo===false?'<span class="chip bad">Inactivo</span>':'')+' <span class="muted small">'+((x.fotos||[]).length)+' foto(s)</span></div><button class="b sm" data-act="editPunto" data-id="'+esc(x.id)+'">Editar</button></div></div>').join('');
  return h
}

/* ====================== hojas (modales) ====================== */
function openSheet(title,body,o){
  o=o||{};const el=$('#sheet');
  el.innerHTML='<div class="back" data-act="sheetClose"></div><div class="sheet" role="dialog"><div class="sh-h"><b>'+esc(title)+'</b><button class="x" data-act="sheetClose">✕</button></div><div class="sh-b">'+body+'</div><div class="sh-f"><button class="b ghost" data-act="sheetClose">'+(o.noSave?'Cerrar':'Cancelar')+'</button>'+(o.noSave?'':'<button class="b '+(o.cls||'pri')+'" id="sheetSave">'+(o.label||'Guardar')+'</button>')+'</div></div>';
  el.classList.add('on');
  if(!o.noSave)$('#sheetSave').onclick=async function(){const btn=this;btn.disabled=true;try{const r=await o.onSave();if(r===false){btn.disabled=false;return}closeSheet();if(r&&r.after)r.after()}catch(e){toast(errMsg(e));btn.disabled=false}};
  if(o.wire)o.wire()
}
function closeSheet(){$('#sheet').classList.remove('on');$('#sheet').innerHTML='';for(const k in photos)delete photos[k]}
function photoField(id,label,req){return '<label>'+label+(req?' *':'')+'</label><input type="file" accept="image/*" capture="environment" id="'+id+'"><div class="pv" id="'+id+'_p"></div>'}
function wirePhoto(id,ref){
  const inp=document.getElementById(id);if(!inp)return;
  inp.onchange=async()=>{const f=inp.files&&inp.files[0];if(!f)return;$('#'+id+'_p').textContent='Procesando…';try{if(ref){photos[id]=await processRef(f);$('#'+id+'_p').innerHTML='<img src="'+photos[id].thumb+'" alt="">'}else{const r=await processPhoto(f);photos[id]=r;$('#'+id+'_p').innerHTML='<img src="'+r.thumb+'" alt="">'}}catch(e){$('#'+id+'_p').textContent='No se pudo leer la imagen'}}
}

/* ---- avisos por correo (varios destinatarios y copia por departamento) ---- */
function openMail(m){
  const to=m.to||[],cc=m.cc||[];
  if(!to.length){openSheet('Aviso por correo','<div class="warnbox">No hay ningún correo configurado para este departamento. Añádelo en Ajustes → Departamentos y correos.</div>',{noSave:true});return}
  const url='mailto:'+to.join(',')+'?'+(cc.length?'cc='+cc.map(encodeURIComponent).join(',')+'&':'')+'subject='+encodeURIComponent(m.subject)+'&body='+encodeURIComponent(m.body);
  const canSend=CFG.avisosPorCorreo!==false&&!!m.srv;
  openSheet('Aviso por correo','<label>Para</label><div class="mailbox">'+esc(to.join('; '))+'</div>'+(cc.length?'<label>CC (en copia)</label><div class="mailbox">'+esc(cc.join('; '))+'</div>':'')+'<label>Asunto</label><div class="mailbox">'+esc(m.subject)+'</div><label>Mensaje</label><div class="mailbox">'+esc(m.body)+'</div><p class="row" style="margin-top:12px">'+(canSend?'<button class="b pri" id="mailsend">✉ Enviar ahora</button>':'')+'<a class="b'+(canSend?'':' pri')+'" style="text-decoration:none;display:inline-block" id="mailgo" href="'+esc(url)+'" target="_blank" rel="noopener">Abrir en mi correo</a><button class="b" id="mailcopy">Copiar mensaje</button></p><p class="muted small">'+(canSend?'«Enviar ahora» lo manda la app a todo el departamento (las respuestas te llegarán a ti).':'Se abrirá tu correo con el aviso ya redactado.')+'</p>',{noSave:true,wire:()=>{
    const sb=$('#mailsend');
    if(sb)sb.onclick=async()=>{sb.disabled=true;try{await sendServerMail(m);closeSheet();toast('✉ Aviso enviado')}catch(e){sb.disabled=false;toast('No se pudo enviar: usa «Abrir en mi correo»')}};
    $('#mailgo').onclick=()=>{if(m.onSent)m.onSent()};
    $('#mailcopy').onclick=async()=>{try{await navigator.clipboard.writeText(m.body);toast('Mensaje copiado')}catch(e){toast('No se pudo copiar')}};
  }})
}
const miNombre=()=>{const p=me();return p?p.nombre:''};
function mailNuevoParte(x){
  const d=destParte(x),hk=origenOf(x)==='Housekeeping';
  const cuerpo=hk
   ?'Calidad ha abierto una no conformidad de Housekeeping que debe resolver '+deptOf(x)+':\n\nNº: '+x.id+'\nNCm/NCM: '+(x.ncm||x.elemento)+'\nSección de detección: '+x.zona+'\nResumen: '+x.resumen+'\nAnálisis de causas: '+x.causas+'\nAcciones correctivas/preventivas: '+x.accion+'\nFecha prevista: '+fmtD(x.fechaPrevista)
   :'Calidad ha detectado una no conformidad en la revisión de vidrios y acrílicos que debe resolver '+deptOf(x)+':\n\nParte: '+x.id+'\nZona: '+x.zona+'\nElemento: '+x.elemento+'\nAcción a realizar: '+x.accion+'\nFecha prevista: '+fmtD(x.fechaPrevista);
  return{srv:{tipo:'nueva',id:x.id},to:d.para,cc:d.cc,subject:'['+origenOf(x)+'] Nueva incidencia '+x.id+' · '+x.zona,body:'Hola,\n\n'+cuerpo+'\n\nPor favor, entra en la app de Auditorías de planta, realiza la acción y márcala como "Hecho" con una foto.\n\nGracias,\n'+miNombre(),
    onSent:()=>S.db.doc('partes/'+x.id).update({avisoEnviado:true}).catch(()=>{})}
}
function mailRealizado(x){
  const d=destCalidad();
  return{srv:{tipo:'realizada',id:x.id},to:d.para,cc:d.cc,subject:'['+origenOf(x)+'] Incidencia '+x.id+' realizada · pendiente de validar',body:'Hola,\n\n'+deptOf(x)+' ha realizado la incidencia '+x.id+' ('+x.zona+' — '+x.elemento+').\n\nAcción realizada: '+(x.accionRealizada||'—')+'\nHecho por: '+x.operario+'\n\nPor favor, comprueba la foto y da el "Apto calidad" en la app de Auditorías de planta.\n\nGracias,\n'+miNombre()}
}
function mailDigest(nombre){
  const d=dest(nombre);const l=S.partes.filter(x=>x.estado==='Abierto'&&deptOf(x)===nombre);
  const lines=l.slice(0,12).map(x=>'· '+x.id+' ['+origenOf(x)+'] '+x.zona+' / '+x.elemento+': '+x.accion+' (prevista '+fmtD(x.fechaPrevista)+(isOverdue(x)?' · FUERA DE PLAZO':'')+')').join('\n');
  return{srv:{tipo:'resumen',dpto:nombre},to:d.para,cc:d.cc,subject:'['+nombre+'] Tenéis '+l.length+' incidencia(s) abierta(s)',body:'Hola,\n\nEstas son las incidencias abiertas de '+nombre+' en las auditorías de planta:\n\n'+lines+(l.length>12?'\n… y '+(l.length-12)+' más.':'')+'\n\nPor favor, entrad en la app de Auditorías de planta y marcadlas como "Hecho" con foto cuando estén resueltas.\n\nGracias,\n'+miNombre()}
}

/* ---- acciones de negocio ---- */
async function doOK(pt,st){
  const p=me();
  await S.db.doc('revisiones/'+st.id).set({pid:pt.id,linea:pt.linea,equipo:pt.equipo,per:pt.per,inicio:st.per.inicio,limite:st.per.limite,resultado:'OK',fecha:nowISO(),por:p.nombre,porId:p.id})
}
function openNoOk(pt,st){
  const prev=iso(addDays(new Date(),Number(S.config.plazoDias)||14));
  openSheet('NO OK · crear parte (ACP)','<div class="kv"><b>'+esc(pt.linea+' · '+pt.equipo)+'</b><br>'+esc(pt.rev)+'</div><label>Elemento *</label><input id="f_elem" value="'+esc(pt.equipo)+'"><label>Acción a realizar *</label><textarea id="f_accion" rows="3" placeholder="Ej.: sustituir metacrilato roto de la puerta"></textarea><label>Departamento que lo resuelve *</label><select id="f_dpto">'+optsDeptos(dptoDefault())+'</select><label>Responsable concreto (opcional)</label><select id="f_resp"><option value="">—</option>'+S.personas.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.nombre)+'</option>').join('')+'</select><label>Fecha prevista *</label><input type="date" id="f_prev" value="'+prev+'">'+photoField('f_foto','Foto de la no conformidad',true),{label:'Crear parte',cls:'bad',wire:()=>wirePhoto('f_foto'),onSave:async()=>{
    const accion=val('f_accion').trim(),elem=val('f_elem').trim(),dpto=val('f_dpto'),resp=val('f_resp'),pv=val('f_prev'),ph=photos.f_foto,p=me();
    if(!accion||!elem||!dpto||!pv||!ph){toast('Rellena todos los campos y añade la foto');return false}
    const fid=uid(),id='V'+todayISO().slice(2).replace(/-/g,'')+'-'+Math.random().toString(36).slice(2,5).toUpperCase();
    await savePhotoPair('inc',fid,ph);
    const parte={origen:'Vidrios',fecha:todayISO(),linea:pt.linea,zona:pt.linea+' · '+pt.equipo,elemento:elem,accion:accion,pid:pt.id,rid:st.id,dpto:dpto,resp:resp||'',creadoPor:p?p.nombre:'',fotoIni:fid,fechaPrevista:pv,estado:'Abierto',avisoEnviado:false};
    await S.db.doc('partes/'+id).set(parte);
    await S.db.doc('revisiones/'+st.id).set({pid:pt.id,linea:pt.linea,equipo:pt.equipo,per:pt.per,inicio:st.per.inicio,limite:st.per.limite,resultado:'NO OK',fecha:nowISO(),por:p?p.nombre:'',porId:p?p.id:'',parteId:id,obs:accion});
    return{after:()=>{toast('Parte '+id+' creado');notify(mailNuevoParte(Object.assign({id:id},parte)))}}
  }})
}
function openHecho(x){
  const p=me(),hk=origenOf(x)==='Housekeeping';
  const body=hk
   ?'<div class="kv"><b>'+esc(x.zona+' — NCm/NCM '+(x.ncm||x.elemento))+'</b><br>'+esc(x.accion)+'</div><label>Acción realizada</label><textarea id="f_real" rows="2"></textarea><label>Comentarios</label><input id="f_com">'+photoField('f_foto','Foto de evidencia',true)
   :'<div class="kv"><b>'+esc(x.zona+' — '+x.elemento)+'</b><br>'+esc(x.accion)+'</div><label>Acción realizada *</label><textarea id="f_real" rows="3"></textarea><label>Operario *</label><input id="f_oper" value="'+esc(p?p.nombre:'')+'"><label>Limpieza de zona *</label><select id="f_limp"><option value="">—</option><option value="1">Sí</option><option value="0">No</option></select><label>Ausencia de materiales / herramientas *</label><select id="f_mat"><option value="">—</option><option value="1">Sí, no queda nada</option><option value="0">No</option></select><label>Comentarios</label><input id="f_com">'+photoField('f_foto','Foto del trabajo terminado',true);
  openSheet('Incidencia '+x.id+' · Hecho',body,{label:'Marcar como hecho',wire:()=>wirePhoto('f_foto'),onSave:async()=>{
    const real=val('f_real').trim(),ph=photos.f_foto;
    let upd;
    if(hk){
      if(!ph){toast('Añade la foto de evidencia');return false}
      upd={accionRealizada:real,operario:p?p.nombre:'',comentarios:val('f_com').trim()};
    }else{
      const op=val('f_oper').trim(),l=val('f_limp'),m=val('f_mat');
      if(!real||!op||!l||!m||!ph){toast('Rellena todos los campos y añade la foto');return false}
      upd={accionRealizada:real,operario:op,limpiezaZona:l==='1',sinMateriales:m==='1',comentarios:val('f_com').trim()};
    }
    const cierraYa=hk&&!S.config.validarHK;
    const fid=uid();await savePhotoPair('inc',fid,ph);
    Object.assign(upd,{estado:cierraYa?'Cerrado':'Realizado',fechaReal:todayISO(),fotoFin:fid,aptoComentario:''});
    await S.db.doc('partes/'+x.id).update(upd);
    return{after:()=>{toast(cierraYa?'Incidencia cerrada ✔':'Marcada como hecha');if(!cierraYa)notify(mailRealizado(Object.assign({},x,upd)))}}
  }})
}
function openApto(x,ok){
  openSheet(ok?'Apto calidad':'No apto','<div class="kv"><b>'+esc(x.id+' · '+x.zona+' — '+x.elemento)+'</b><br>'+esc(x.accionRealizada)+'</div><label>Comentario'+(ok?'':' *')+'</label><textarea id="f_apto" rows="3"></textarea>',{label:ok?'Dar Apto':'Devolver al departamento',cls:ok?'ok':'bad',onSave:async()=>{
    const c=val('f_apto').trim();if(!ok&&!c){toast('Indica el motivo');return false}
    if(ok)await S.db.doc('partes/'+x.id).update({estado:'Cerrado',aptoPor:miNombre(),aptoFecha:todayISO(),aptoComentario:c});
    else await S.db.doc('partes/'+x.id).update({estado:'Abierto',aptoComentario:c});
    return{after:()=>{if(!ok){const d=destParte(x);notify({srv:{tipo:'devuelta',id:x.id},to:d.para,cc:d.cc,subject:'['+origenOf(x)+'] Incidencia '+x.id+' devuelta por calidad',body:'Hola,\n\nCalidad ha devuelto la incidencia '+x.id+' ('+x.zona+' — '+x.elemento+').\nMotivo: '+c+'\n\nPor favor, revisadla y marcadla de nuevo como "Hecho" con foto.\n\nGracias,\n'+miNombre()})}else toast('Incidencia cerrada ✔')}}
  }})
}
async function undoRev(rid){
  const r=S.revs[rid];if(!r||!confirm('¿Deshacer esta revisión?'+(r.parteId?'\nTambién se eliminará el parte '+r.parteId+' si sigue abierto.':'')))return;
  try{
    if(r.parteId){const x=S.partes.find(q=>q.id===r.parteId);if(x&&x.estado!=='Abierto'){toast('El parte ya está realizado: no se puede deshacer');return}if(x)await S.db.doc('partes/'+x.id).delete()}
    await S.db.doc('revisiones/'+rid).delete()
  }catch(e){toast(errMsg(e))}
}
async function showPaths(ps){try{const us=await Promise.all(ps.map(loadPhoto));showImgs(us)}catch(e){toast('No se pudo cargar la foto')}}
let lbList=[],lbI=0;
function showImgs(l){lbList=l;lbI=0;lbShow()}
function lbShow(){$('#lbimg').src=lbList[lbI];$('#lb').classList.add('on');$('#lbprev').style.visibility=$('#lbnext').style.visibility=lbList.length>1?'visible':'hidden'}
$('#lbclose').onclick=()=>$('#lb').classList.remove('on');
$('#lbprev').onclick=()=>{lbI=(lbI+lbList.length-1)%lbList.length;lbShow()};
$('#lbnext').onclick=()=>{lbI=(lbI+1)%lbList.length;lbShow()};

/* ---- ajustes ---- */
function openDepto(id){
  const d=S.deptos.find(x=>x.id===id)||{nombre:'',para:[],cc:[]};
  const ids=S.personas.map(p=>p.id);
  const chk=(name,sel)=>S.personas.map(p=>'<label class="inl" style="margin:5px 0;font-size:14px"><input type="checkbox" name="'+name+'" value="'+esc(p.id)+'" '+((sel||[]).includes(p.id)?'checked':'')+'> '+esc(p.nombre)+' <span class="muted small">'+esc(p.email||'sin correo')+(p.departamento?' · '+esc(p.departamento):'')+'</span></label>').join('');
  const extra=a=>(a||[]).filter(e=>!ids.includes(e)).join(', ');
  openSheet(id?'Departamento '+d.nombre:'Nuevo departamento','<label>Nombre *</label><input id="d_nom" value="'+esc(d.nombre)+'" '+(id?'readonly':'')+'><label>Correo PARA (reciben el aviso)</label>'+chk('d_para',d.para)+'<label>Correo EN COPIA (CC)</label>'+chk('d_cc',d.cc)+'<label>Otros correos PARA (separados por coma)</label><input id="d_pe" value="'+esc(extra(d.para))+'" placeholder="lista@empresa.com, otro@empresa.com"><label>Otros correos CC (separados por coma)</label><input id="d_ce" value="'+esc(extra(d.cc))+'">'+(id?'<p><button class="b ghost sm" id="d_del">Eliminar departamento</button></p>':''),{wire:()=>{const x=$('#d_del');if(x)x.onclick=async()=>{if(confirm('¿Eliminar el departamento '+d.nombre+'?')){try{await S.db.doc('departamentos/'+id).delete();closeSheet()}catch(e){toast(errMsg(e))}}}},onSave:async()=>{
    const n=val('d_nom').trim();if(!n){toast('Escribe el nombre');return false}
    const g=name=>[...document.querySelectorAll('input[name='+name+']:checked')].map(i=>i.value);
    const lc=a=>uniq(a.map(s=>String(s).toLowerCase()));
    await S.db.doc('departamentos/'+(id||slug(n))).set({nombre:n,para:lc(g('d_para').concat(splitMails(val('d_pe')))),cc:lc(g('d_cc').concat(splitMails(val('d_ce'))))})
  }})
}
function openPersona(id){
  const p=personaById(id)||{nombre:S.personas.length?'':S.nombreSugerido,email:'',rol:'Calidad',departamento:'',admin:false};
  openSheet(id?'Editar persona':'Nueva persona','<label>Nombre *</label><input id="f_nom" value="'+esc(p.nombre)+'"><label>Correo de la empresa (con el que inicia sesión) *</label><input id="f_mail" type="email" value="'+esc(p.email)+'" '+(id?'readonly':'')+'><label>Rol *</label><select id="f_rol">'+['Calidad','Mantenimiento','Responsable'].map(r=>'<option '+(r===p.rol?'selected':'')+'>'+r+'</option>').join('')+'</select><p class="muted small">Calidad: audita y valida. Mantenimiento y Responsable: reciben y cierran incidencias de su departamento.</p><label>Departamento</label><input id="f_dep" list="dl_dep" value="'+esc(p.departamento)+'"><datalist id="dl_dep">'+S.deptos.map(d=>'<option value="'+esc(d.nombre)+'">').join('')+'</datalist><label class="inl"><input type="checkbox" id="f_adm" '+(p.admin?'checked':'')+'> Administrador de la app (Ajustes)</label>'+(id?'<p><button class="b ghost sm" id="f_del">Eliminar persona</button></p>':''),{wire:()=>{const d=$('#f_del');if(d)d.onclick=async()=>{if(confirm('¿Eliminar a '+p.nombre+'?')){try{await S.db.doc('personas/'+id).delete();closeSheet()}catch(e){toast(errMsg(e))}}}},onSave:async()=>{
    const n=val('f_nom').trim(),m=val('f_mail').trim().toLowerCase(),dep=val('f_dep').trim();if(!n||!/@/.test(m)){toast('Nombre y correo válido son obligatorios');return false}
    const pid=id||m;
    await S.db.doc('personas/'+pid).set({nombre:n,email:m,rol:val('f_rol'),departamento:dep,admin:$('#f_adm').checked});
    if(dep&&!deptByName(dep))await S.db.doc('departamentos/'+slug(dep)).set({nombre:dep,para:[m],cc:[]})
  }})
}
function openConfig(){
  const c=S.config;
  openSheet('Parámetros','<label>Departamento por defecto de un NO OK (vidrios)</label><select id="f_dd">'+optsDeptos(dptoDefault())+'</select><label>Plazo por defecto (días)</label><input id="f_pl" type="number" min="1" value="'+c.plazoDias+'"><label>Texto de edición en la hoja</label><input id="f_ed" value="'+esc(c.edicion)+'"><label>Control vigente desde</label><input id="f_ds" type="date" value="'+esc(c.desde)+'"><p class="muted small">Las revisiones anteriores a esta fecha no se marcan como sin hacer.</p><label>Secciones de detección de Housekeeping (una por línea)</label><textarea id="f_sec" rows="5">'+esc(secciones().join('\n'))+'</textarea><label class="inl"><input type="checkbox" id="f_vhk" '+(c.validarHK?'checked':'')+'> Housekeeping requiere Apto de calidad (si no, se cierra al pulsar Hecho)</label>',{onSave:async()=>{
    const sec=val('f_sec').split('\n').map(s=>s.trim()).filter(Boolean);
    await S.db.doc('config/general').set({respDefault:c.respDefault||'',dptoDefault:val('f_dd'),plazoDias:Number(val('f_pl'))||14,edicion:val('f_ed').trim()||'Edición 1',desde:val('f_ds')||todayISO(),seccionesDeteccion:sec.length?sec:DEFAULT_SECC,validarHK:$('#f_vhk').checked})
  }})
}
function openPunto(id){
  const x=S.puntos.find(p=>p.id===id)||{linea:S.ajLinea!=='Todas'?S.ajLinea:(lineasList()[0]||'L8'),equipo:'',rev:'',mat:'',cant:'',per:'Mensual',activo:true,fotos:[]};
  openSheet(id?'Editar punto '+id:'Nuevo punto','<label>Línea / zona *</label><input id="f_lin" list="dl_lin" value="'+esc(x.linea)+'"><datalist id="dl_lin">'+lineasList().map(l=>'<option value="'+esc(l)+'">').join('')+'</datalist><label>Equipo / zona *</label><input id="f_eq" value="'+esc(x.equipo)+'"><label>Qué revisar *</label><textarea id="f_rev" rows="3">'+esc(x.rev)+'</textarea><label>Material</label><input id="f_mat" value="'+esc(x.mat)+'"><label>Cantidad / elementos</label><input id="f_cant" value="'+esc(x.cant)+'"><label>Periodicidad *</label><select id="f_per">'+['Semanal','Quincenal','Mensual'].map(r=>'<option '+(r===x.per?'selected':'')+'>'+r+'</option>').join('')+'</select><label class="inl"><input type="checkbox" id="f_act" '+(x.activo!==false?'checked':'')+'> Punto activo</label>'+photoField('f_foto','Añadir foto de referencia ('+(x.fotos||[]).length+' actuales)',false),{wire:()=>wirePhoto('f_foto',true),onSave:async()=>{
    const lin=val('f_lin').trim(),eq=val('f_eq').trim(),rev=val('f_rev').trim();if(!lin||!eq||!rev){toast('Línea, equipo y qué revisar son obligatorios');return false}
    let pid=id;if(!pid){const nums=S.puntos.filter(p=>p.linea===lin).map(p=>Number(String(p.id).split('-').pop())||0);pid='V-'+lin+'-'+String((nums.length?Math.max.apply(null,nums):0)+1).padStart(3,'0')}
    const fotos=(x.fotos||[]).slice();if(photos.f_foto){const nmf=pid+'_'+(fotos.length+1)+'.jpg';await putPhoto('ref/'+nmf,photos.f_foto.full);await putPhoto('ref/'+thumbName(nmf),photos.f_foto.thumb);fotos.push(nmf)}
    await S.db.doc('puntos/'+pid).set({linea:lin,equipo:eq,rev:rev,mat:val('f_mat').trim(),cant:val('f_cant').trim(),per:val('f_per'),activo:$('#f_act').checked,fotos:fotos,nota:x.nota||''})
  }})
}

/* ====================== eventos ====================== */
document.addEventListener('click',async e=>{
  const t=e.target.closest('[data-act]');if(!t)return;const a=t.dataset.act,d=t.dataset;
  if(a==='sheetClose'){closeSheet();return}
  if(a==='tab'){S.tab=d.tab;S.focus=null;render();window.scrollTo(0,0);return}
  if(a==='sendcode'){const em=val('a_email').trim().toLowerCase();if(!/@/.test(em)){toast('Escribe tu correo');return}t.disabled=true;const r=await sb.auth.signInWithOtp({email:em,options:{shouldCreateUser:true}});t.disabled=false;if(r.error){toast('No se pudo enviar el código: '+r.error.message);return}S.auth={step:'code',email:em};render();return}
  if(a==='verifycode'){const code=val('a_code').trim();if(!code){toast('Escribe el código');return}t.disabled=true;const r=await sb.auth.verifyOtp({email:S.auth.email,token:code,type:'email'});t.disabled=false;if(r.error)toast('Código incorrecto o caducado');return}
  if(a==='usepass'){S.auth={step:'pass',email:val('a_email').trim()};render();return}
  if(a==='passlogin'){t.disabled=true;const r=await sb.auth.signInWithPassword({email:val('a_email').trim().toLowerCase(),password:val('a_pass')});t.disabled=false;if(r.error)toast('Correo o contraseña incorrectos');return}
  if(a==='backlogin'){S.auth={step:'email',email:''};render();return}
  if(a==='logout'){if(confirm('¿Cerrar sesión de '+(S.account?S.account.username:'')+'?'))await sb.auth.signOut();return}
  if(a==='backup'){try{saveFile('copia_auditorias_'+todayISO()+'.json',JSON.stringify(await exportAll(),null,1),'application/json')}catch(er){toast('No se pudo generar la copia')}return}
  if(a==='irLinea'){S.linea=d.l;S.tab='revision';render();window.scrollTo(0,0);return}
  if(a==='setLinea'){S.linea=d.l;render();return}
  if(a==='imgs'){const pt=S.puntos.find(p=>p.id===d.pid);if(pt&&pt.fotos&&pt.fotos.length)showPaths(pt.fotos.map(f=>'ref/'+f));return}
  if(a==='foto'){showPaths([d.f]);return}
  if(a==='newHK'){openHK();return}
  if(a==='ok'||a==='nook'){const pt=S.puntos.find(p=>p.id===d.pid);if(!pt)return;const st=statOf(pt,S.off);
    if(a==='ok'){t.disabled=true;try{await doOK(pt,st)}catch(x){toast(errMsg(x));t.disabled=false}}else openNoOk(pt,st);return}
  if(a==='undo'){undoRev(d.rid);return}
  if(a==='verparte'){if(!d.id)return;S.focus=d.id;S.tab='partes';render();window.scrollTo(0,0);return}
  if(a==='clearFocus'){S.focus=null;render();return}
  const x=S.partes.find(q=>q.id===d.id);
  if(a==='hecho'&&x){openHecho(x);return}
  if(a==='apto'&&x){openApto(x,d.v==='1');return}
  if(a==='avisar'&&x){openMail(mailNuevoParte(x));return}
  if(a==='avisarCal'&&x){openMail(mailRealizado(x));return}
  if(a==='digest'){openMail(mailDigest(d.r));return}
  if(a==='delParte'&&x){if(confirm('¿Eliminar la incidencia '+x.id+'?')){try{await S.db.doc('partes/'+x.id).delete()}catch(er){toast(errMsg(er))}}return}
  if(a==='repTab'){S.repTab=d.t;render();return}
  if(a==='hkCopy'){hkCopy();return}
  if(a==='hkXlsx'){hkXlsx();return}
  if(a==='imprimir'){await preloadPhotos('.rep-wrap');try{window.print()}catch(er){toast('Usa "Descargar para imprimir"')}return}
  if(a==='dlHtml'||a==='dlCsv'){
    try{const nm=S.repTab==='hoja'?'hoja_revision_'+S.repLinea+'_'+S.repMes:S.repTab==='parte'?'parte_mantenimiento_'+S.repMes:'housekeeping_'+(S.repAll?'todos':S.repMes);
      if(a==='dlHtml')saveFile(nm+'.html',await inlinePhotos(reportDocHTML()),'text/html');
      else saveFile(nm+'.csv','\ufeff'+reportCSV(),'text/csv');
    }catch(er){toast('No se pudo descargar')}return}
  if(a==='editDepto'){openDepto(d.id);return}
  if(a==='editPersona'){openPersona(d.id);return}
  if(a==='editConfig'){openConfig();return}
  if(a==='editPunto'){openPunto(d.id);return}
});
document.addEventListener('change',e=>{
  const t=e.target.closest('[data-set]');if(!t)return;const k=t.dataset.set;
  if(k==='soloPend'||k==='repAll'||k==='repOpen')S[k]=t.checked;
  else if(k==='off')S.off=Number(t.value);
  else S[k]=t.value;
  render()
});

function vSignIn(){
  const st=S.auth||{step:'email',email:''};
  let h='<div class="login"><div class="card"><h2>Auditorías de planta</h2><p class="muted">Refresco Iberia · Marcilla</p>';
  if(st.step==='code')h+='<p>Te hemos enviado un código a <b>'+esc(st.email)+'</b>. Escríbelo aquí:</p><input id="a_code" inputmode="numeric" autocomplete="one-time-code" placeholder="Código del correo"><p style="margin-top:12px"><button class="b pri big" data-act="verifycode">Entrar</button></p><p class="muted small">Si no llega, mira en spam o pide otro código.</p><p><button class="lnk small" data-act="backlogin">Usar otro correo</button></p>';
  else if(st.step==='pass')h+='<label>Correo</label><input id="a_email" type="email" autocomplete="email" value="'+esc(st.email||'')+'"><label>Contraseña</label><input id="a_pass" type="password" autocomplete="current-password"><p style="margin-top:12px"><button class="b pri big" data-act="passlogin">Entrar</button></p><p><button class="lnk small" data-act="backlogin">Entrar con código por correo</button></p>';
  else h+='<label>Correo de la empresa</label><input id="a_email" type="email" autocomplete="email" placeholder="nombre.apellido@refresco.com"><p style="margin-top:12px"><button class="b pri big" data-act="sendcode">Enviarme un código</button></p><p><button class="lnk small" data-act="usepass">Entrar con contraseña</button></p>';
  return h+'</div></div>'
}
function vFatal(){return '<div class="login"><div class="card"><h2>No se puede iniciar</h2><p class="muted">'+esc(S.fatal.msg)+'</p>'+(S.account?'<p><button class="lnk small" data-act="logout">Cerrar sesión</button></p>':'')+'</div></div>'}
function vNoAccess(){
  const u=S.account?S.account.username:'';
  return '<div class="login"><div class="card"><h2>Sin acceso</h2><p class="muted">Tu correo <b>'+esc(u)+'</b> no está dado de alta en la app. Pide a un administrador que te añada en Ajustes → Personas y vuelve a entrar.</p><p><button class="lnk small" data-act="logout">Cerrar sesión</button></p></div></div>'
}
