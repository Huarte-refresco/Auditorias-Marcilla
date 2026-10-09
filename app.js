
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
 loaded:{},persona:null,tab:'inicio',linea:null,perF:'Todas',inPer:'Todas',inOff:0,resPer:'mes',resMes:todayISO().slice(0,7),resOrig:'Todos',soloPend:true,off:0,
 fEstado:'Abierto',fResp:null,fOrigen:'Todos',fDpto:'Todos',fMes:'',focus:null,
 repTab:'hoja',repLinea:null,repMes:todayISO().slice(0,7),repAll:false,repOpen:false,rep:{key:'',revs:[],loading:false},
 ajLinea:'Todas',nombreSugerido:'',actor:null};
const photos={};
const meReal=()=>S.personas.find(p=>S.emails.includes(String(p.email||'').toLowerCase())||p.id===S.persona)||null;
const me=()=>{const r=meReal();return (r&&r.admin&&S.viewAs)?(personaById(S.viewAs)||r):r};
const esCalP=p=>!!p&&(p.rol==='Calidad'||p.departamento==='Calidad'||/nuria|asun\S*\s+garde/i.test(p.nombre||''));
const isCal=()=>esCalP(me());
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
const mailOf=p=>String(p&&p.email||'').toLowerCase();
const esSuper=()=>{const p=me();return !!p&&(/nuria|asun\S*\s+garde/i.test(p.nombre||'')||(S.config.cierraTodo||[]).includes(p.id))};
const esResp=x=>{const p=me();if(!p)return false;if(x.resp===p.id)return true;if(p.rol==='Coordinador'&&p.departamento&&p.departamento===deptOf(x))return true;const d=deptByName(deptOf(x));
  if(d&&(d.para||[]).length)return d.para.some(e=>e===p.id||String(e).toLowerCase()===mailOf(p));
  return !!deptOf(x)&&p.departamento===deptOf(x)};
const canResolve=x=>esResp(x)||esSuper();
function dest(nombre,extraPersonaId){
  const d=deptByName(nombre);let para=[],cc=[];
  if(d){para=(d.para||[]).map(emailOfId);cc=(d.cc||[]).map(emailOfId)}
  if(extraPersonaId)para.push(emailOfId(extraPersonaId));
  if(!para.length&&nombre)para=S.personas.filter(p=>p.departamento===nombre&&p.email).map(p=>p.email);
  if(nombre&&d)cc=cc.concat(S.personas.filter(p=>p.departamento===nombre&&p.email).map(p=>p.email));
  para=uniq(para);cc=uniq(cc).filter(m=>!para.includes(m));return{para:para,cc:cc}
}
const destParte=x=>dest(deptOf(x),x.resp);
function destCalidad(){if(deptByName('Calidad'))return dest('Calidad');return{para:uniq(S.personas.filter(p=>p.rol==='Calidad'&&p.email).map(p=>p.email)),cc:[]}}
const esLinea=l=>/^L\d+$/i.test(l);
const lineasList=()=>[...new Set(S.puntos.map(p=>p.linea))].sort((a,b)=>(esLinea(a)!==esLinea(b))?(esLinea(a)?-1:1):a.localeCompare(b,undefined,{numeric:true}));
const statOf=(pt,off)=>{const per=periodFor(pt.per||'Mensual',new Date(),off);const id=pt.id+'_'+per.inicio;return{per:per,id:id,rev:S.revs[id]||null}};
const activos=l=>S.puntos.filter(p=>p.activo!==false&&(!l||p.linea===l));
const isOverdue=x=>x.estado==='Abierto'&&x.fechaPrevista&&x.fechaPrevista<todayISO();
function progress(l){const a=activos(l);let d=0;a.forEach(p=>{if(statOf(p,0).rev)d++});return{done:d,total:a.length}}
const PERS=['Semanal','Quincenal','Mensual'];
function pendPer(l,per,off){off=off||0;const a=activos(l).filter(p=>(per==='Todas'||(p.per||'Mensual')===per));let d=0,lim='',tt=0;a.forEach(p=>{const st=statOf(p,off);if(off&&st.per.limite<S.config.desde)return;tt++;if(st.rev)d++;else if(!lim||st.per.limite<lim)lim=st.per.limite});return{total:tt,done:d,pend:tt-d,lim:lim}}
const diasHasta=iso=>Math.round((new Date(iso+'T00:00:00')-new Date(todayISO()+'T00:00:00'))/864e5);
const limTxt=iso=>{if(!iso)return '';const n=diasHasta(iso);return n<0?'vencido':n===0?'vence hoy':n===1?'vence mañana':'vence en '+n+' días (hasta '+fmtS(iso)+')'};
function vencidasPrev(l){let n=0;activos(l).forEach(p=>{const s=statOf(p,-1);if(!s.rev&&s.per.limite>=S.config.desde)n++});return n}
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
    sub.run=async()=>{if(sub.busy)return;sub.busy=true;sub.last=Date.now();try{await load(sub);sub.failed=false}catch(e){if(!sub.failed&&sub.err)sub.err(e);sub.failed=true}finally{sub.busy=false}};
    sub.run();return()=>{const i=subs.indexOf(sub);if(i>=0)subs.splice(i,1)}
  }
  /* Tiempo real: cuando alguien guarda, se recarga lo que cambió. Respaldo: recarga cada minuto. */
  const timers={};
  const kick=coll=>{clearTimeout(timers[coll]);timers[coll]=setTimeout(()=>subs.forEach(s=>{if(s.coll===coll)s.run()}),400)};
  try{Object.keys(SCHEMA).forEach(coll=>{sb.channel('rt-'+coll).on('postgres_changes',{event:'*',schema:'public',table:SCHEMA[coll].table},()=>kick(coll)).subscribe()})}catch(e){}
  const SLOW={personas:1,departamentos:1,puntos:1,config:1};
  const tick=()=>{if(document.hidden)return;const now=Date.now();subs.forEach(s=>{if(!s.run)return;if(SLOW[s.coll]&&now-(s.last||0)<600000)return;s.run()})};
  setInterval(tick,(CFG.pollSeconds||60)*1000);
  document.addEventListener('visibilitychange',tick);
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
const PHOTO_CACHE='aud-fotos-v1';
let photoActive=0;const photoQ=[];
function photoSlot(prio){return new Promise(res=>{const go=()=>{photoActive++;res()};if(photoActive<5)go();else if(prio)photoQ.unshift(go);else photoQ.push(go)})}
function photoDone(){photoActive--;const n=photoQ.shift();if(n)n()}
async function cacheGet(p){try{if(!window.caches)return null;const c=await caches.open(PHOTO_CACHE);const r=await c.match('/__fotos/'+encodeURI(p));return r?await r.blob():null}catch(e){return null}}
async function cachePut(p,b){try{if(!window.caches)return;const c=await caches.open(PHOTO_CACHE);await c.put('/__fotos/'+encodeURI(p),new Response(b,{headers:{'Content-Type':b.type||'image/jpeg'}}))}catch(e){}}
async function cacheDel(p){try{if(!window.caches)return;const c=await caches.open(PHOTO_CACHE);await c.delete('/__fotos/'+encodeURI(p))}catch(e){}}
function loadPhoto(path,prio){
  if(!photoP[path]){
    photoP[path]=(async()=>{
      let b=await cacheGet(path);
      if(!b){await photoSlot(prio);try{const r=await sb.storage.from(BUCKET).download(path);if(r.error)throw dbErr(r.error);b=r.data;cachePut(path,b)}finally{photoDone()}}
      photoURL[path]=URL.createObjectURL(b);return photoURL[path]
    })().catch(e=>{delete photoP[path];photoFail[path]=Date.now();throw e})
  }
  return photoP[path]
}
let photoIO=null;
function fetchImg(img){
  const p=img.dataset.ph;
  if(photoURL[p]){img.src=photoURL[p];return}
  if(photoFail[p]&&Date.now()-photoFail[p]<30000)return;
  loadPhoto(p).then(u=>{document.querySelectorAll('img[data-ph]').forEach(i=>{if(i.dataset.ph===p&&i.getAttribute('src')!==u)i.src=u})}).catch(()=>{})
}
function hydrate(){
  if(!photoIO&&'IntersectionObserver' in window)photoIO=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){photoIO.unobserve(e.target);fetchImg(e.target)}}),{rootMargin:'300px'});
  if(photoIO)photoIO.disconnect();
  document.querySelectorAll('img[data-ph]').forEach(img=>{
    const p=img.dataset.ph;
    if(photoURL[p]){if(img.getAttribute('src')!==photoURL[p])img.src=photoURL[p];return}
    if(photoIO)photoIO.observe(img);else fetchImg(img)
  })
}
async function preloadPhotos(sel){
  const ps=[...new Set([...document.querySelectorAll(sel+' img[data-ph]')].map(i=>i.dataset.ph))];
  await Promise.all(ps.map(p=>loadPhoto(p).catch(()=>null)));hydrate()
}
function dataURItoBlob(u){const a=u.split(','),m=/:(.*?);/.exec(a[0])[1],b=atob(a[1]),u8=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u8[i]=b.charCodeAt(i);return new Blob([u8],{type:m})}
async function putPhoto(path,dataUri){const r=await sb.storage.from(BUCKET).upload(path,dataURItoBlob(dataUri),{contentType:'image/jpeg',upsert:true});if(r.error)throw dbErr(r.error);delete photoP[path];delete photoURL[path];cacheDel(path)}
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
function applyHash(){const m=/^#parte=(.+)$/.exec(location.hash||'');if(m){S.focus=decodeURIComponent(m[1]);S.tab='partes'}}
function clearHash(){try{if(location.hash)history.replaceState(null,'',location.pathname+location.search)}catch(e){}}
window.addEventListener('hashchange',()=>{applyHash();render()});
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
  try{S.actor=sessionStorage.getItem('aud_actor')||null}catch(e){}
  applyHash();
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
  const p=meReal();S.realAdmin=!!(p&&p.admin);if(!S.realAdmin)S.viewAs=null;S.isAdmin=S.realAdmin&&!S.viewAs;
  if(!p){app.innerHTML=vNoAccess();return}
  const ms=miembrosDe(p);if(ms.length&&!ms.includes(S.actor)){app.innerHTML=vQuienEres(p,ms);return}
  if(S.tab==='ajustes'&&!S.isAdmin)S.tab='inicio';
  if(S.tab==='partes'&&!canAudit()&&!S.focus)S.tab='inicio';
  if(S.tab==='informe')ensureRep();
  const V={inicio:vInicio,revision:vRevision,hk:vHK,partes:vPartes,informe:vInforme,ajustes:vAjustes};
  app.innerHTML=hdr()+'<main>'+V[S.tab]()+'</main>'+nav();
  hydrate()
}
/* Cuentas compartidas (p. ej. laboratorio): varias personas entran con el mismo correo y eligen su nombre */
const planosDe=l=>(S.config.planos&&S.config.planos[l])||[];
async function processPlano(file){const c=await readImage(file,1800);const t=await readImage(file,220);return{full:c.toDataURL('image/jpeg',.82),thumb:t.toDataURL('image/jpeg',.7)}}
const miembrosDe=p=>(p&&S.config.miembros&&S.config.miembros[p.id])||[];
const actorName=()=>{if(S.viewAs){const r=meReal();if(r&&r.admin)return r.nombre}const p=me();if(!p)return '';return miembrosDe(p).length?(S.actor||''):p.nombre};
function vQuienEres(p,ms){
  let last='';try{last=localStorage.getItem('aud_actor_last')||''}catch(e){}
  return '<div class="login"><div class="card"><h2>¿Quién eres?</h2><p class="muted">Has entrado con la cuenta compartida <b>'+esc(p.nombre)+'</b>. Elige tu nombre para que quede registrado en tus revisiones.</p><label>Mi nombre</label><select id="actorSel"><option value="">—</option>'+ms.map(n=>'<option '+(n===last?'selected':'')+'>'+esc(n)+'</option>').join('')+'</select><p style="margin-top:14px"><button class="b pri" style="width:100%" data-act="setActor">Continuar</button></p><p><button class="lnk small" data-act="logout">Cerrar sesión</button></p></div></div>'
}
async function doLogout(){
  if(!confirm('¿Cerrar sesión de '+(S.account?S.account.username:'')+'?'))return;
  try{await caches.delete(PHOTO_CACHE)}catch(e){}
  try{sessionStorage.removeItem('aud_actor')}catch(e){}
  S.actor=null;await sb.auth.signOut()
}
function openUserMenu(){
  const p=meReal();if(!p){doLogout();return}
  const shared=miembrosDe(p).length>0;
  openSheet('Sesión','<p class="kv">Cuenta: <b>'+esc(p.nombre)+'</b><br><span class="muted">'+esc(S.account?S.account.username:'')+'</span></p>'+(shared?'<p class="kv">Estás registrando como: <b>'+esc(S.actor||'—')+'</b></p><p><button class="b pri" id="m_chg">Cambiar de persona</button></p>':'')+(S.realAdmin?'<label>Ver la app como… (solo administrador)</label><select id="m_as"><option value="">— Yo (Administrador) —</option>'+S.personas.filter(x=>x.id!==p.id).sort((a,b)=>String(a.nombre).localeCompare(b.nombre)).map(x=>'<option value="'+esc(x.id)+'" '+(S.viewAs===x.id?'selected':'')+'>'+esc(x.nombre)+' · '+esc(x.rol)+(x.departamento?' · '+esc(x.departamento):'')+'</option>').join('')+'</select><p class="muted small">Ves la app exactamente como la vería esa persona (pestañas, botones e incidencias). Solo cambia lo que ves en pantalla.</p>':'')+'<p><button class="b ghost" id="m_out">Cerrar sesión</button></p>',{noSave:true,wire:()=>{
    const as=$('#m_as');if(as)as.onchange=()=>{S.viewAs=as.value||null;S.tab='inicio';S.focus=null;S.fResp=null;closeSheet();render();window.scrollTo(0,0)};
    const c=$('#m_chg');if(c)c.onclick=()=>{S.actor=null;try{sessionStorage.removeItem('aud_actor')}catch(e){}closeSheet();render()};
    $('#m_out').onclick=()=>{closeSheet();doLogout()}
  }})
}
function hdr(){const p=meReal();return (S.viewAs&&me()?'<div style="background:#6b2fb3;color:#fff;padding:8px 14px;font-size:13px;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span class="grow" style="flex:1">👁 Estás viendo la app como <b>'+esc(me().nombre)+'</b> ('+esc(me().rol)+(me().departamento?' · '+esc(me().departamento):'')+'). Lo que hagas se guarda a tu nombre.</span><button class="b sm" data-act="verComoSalir">Volver a mi vista</button></div>':'')+'<header class="top"><div><b>Auditorías de planta</b><small>Refresco Iberia · Marcilla</small></div><button class="who" data-act="userMenu">'+(p?esc(actorName()||p.nombre)+' ▾':'Entrar ▾')+'</button></header>'}
function nav(){
  const sup=canAudit(),p=me();
  const cnt=o=>S.partes.filter(x=>origenOf(x)===o&&x.estado==='Abierto'&&(esMio(x)||canResolve(x))).length;
  const bV=sup?0:cnt('Vidrios'),bH=sup?0:cnt('Housekeeping');
  const tabs=[['inicio','🏠','Inicio','',0],['revision','🔍','Vidrios',bV],['hk','📝','Housekeeping',bH]];
  if(sup)tabs.push(['partes','🛠️','Incidencias',S.partes.filter(x=>x.estado==='Realizado').length]);
  tabs.push(['informe','🖨️','Informe',0]);if(S.isAdmin)tabs.push(['ajustes','⚙️','Ajustes',0]);
  return '<nav class="nav">'+tabs.map(t=>'<button class="'+(S.tab===t[0]?'on':'')+'" data-act="tab" data-tab="'+t[0]+'"><span class="ic">'+t[1]+'</span>'+t[2]+(t[3]?'<span class="bd">'+t[3]+'</span>':'')+'</button>').join('')+'</nav>'
}



const empty=t=>'<div class="empty">'+t+'</div>';

/* ---------- Inicio ---------- */
function resumenInc(){
  const per=S.resPer,hoy=new Date();let r=null,tit='';
  if(per==='sem'){r=periodFor('Semanal',hoy,0);tit='esta semana'}
  else if(per==='quin'){r=periodFor('Quincenal',hoy,0);tit='esta quincena'}
  else if(per==='mes'){r=periodFor('Mensual',hoy,0);tit='este mes'}
  else if(per==='mesAnt'){r=periodFor('Mensual',hoy,-1);tit='el mes anterior'}
  else if(per==='otro'){const a=String(S.resMes||todayISO().slice(0,7)).split('-');r=periodFor('Mensual',new Date(Number(a[0]),Number(a[1])-1,1),0);tit='el mes '+a[1]+'/'+a[0]}
  else tit='todo el histórico';
  let l=S.partes.filter(x=>(S.resOrig==='Todos'||origenOf(x)===S.resOrig)&&(!r||(String(x.fecha).slice(0,10)>=r.inicio&&String(x.fecha).slice(0,10)<=r.limite)));
  const ab=l.filter(x=>x.estado==='Abierto'),fp=ab.filter(isOverdue),pv=l.filter(x=>x.estado==='Realizado'),ce=l.filter(x=>x.estado==='Cerrado');
  let h='<h3>Resumen de incidencias</h3><p class="muted small">Este periodo solo afecta a este resumen de incidencias. Para las revisiones pendientes de vidrios, usa «Periodo anterior» más abajo.</p><div class="row"><div class="grow"><select data-set="resPer">'+[['sem','Esta semana'],['quin','Esta quincena'],['mes','Este mes'],['mesAnt','Mes anterior'],['otro','Elegir mes…'],['todo','Todo el histórico']].map(o=>'<option value="'+o[0]+'" '+(S.resPer===o[0]?'selected':'')+'>'+o[1]+'</option>').join('')+'</select></div>'+(per==='otro'?'<div class="grow"><input type="month" data-set="resMes" value="'+esc(S.resMes)+'"></div>':'')+'</div>';
  h+='<div class="chips">'+['Todos','Vidrios','Housekeeping'].map(x=>'<button class="'+(S.resOrig===x?'on':'')+'" data-act="setResOrig" data-o="'+x+'">'+(x==='Todos'?'Vidrios + Housekeeping':x)+'</button>').join('')+'</div>';
  if(r)h+='<p class="muted small">Incidencias abiertas (creadas) '+tit+': '+fmtD(r.inicio)+' – '+fmtD(r.limite)+'</p>';else h+='<p class="muted small">Incidencias de '+tit+'</p>';
  h+='<div class="kpis"><div class="kpi"><b>'+l.length+'</b><span>Total</span></div><div class="kpi warn"><b>'+ab.length+'</b><span>Abiertas</span></div><div class="kpi bad"><b>'+fp.length+'</b><span>Fuera de plazo</span></div><div class="kpi"><b>'+pv.length+'</b><span>Por validar</span></div><div class="kpi ok"><b>'+ce.length+'</b><span>Cerradas</span></div></div>';
  const ds=[...new Set(l.map(x=>deptOf(x)||'Sin departamento'))].sort();
  if(ds.length)h+='<table class="rep" style="width:100%;margin:6px 0 12px"><thead><tr><th>Departamento</th><th>Abiertas</th><th>Fuera plazo</th><th>Por validar</th><th>Cerradas</th></tr></thead><tbody>'+ds.map(d=>{const q=l.filter(x=>(deptOf(x)||'Sin departamento')===d);return '<tr><td>'+esc(d)+'</td><td class="c">'+q.filter(x=>x.estado==='Abierto').length+'</td><td class="c">'+q.filter(isOverdue).length+'</td><td class="c">'+q.filter(x=>x.estado==='Realizado').length+'</td><td class="c">'+q.filter(x=>x.estado==='Cerrado').length+'</td></tr>'}).join('')+'</tbody></table>';
  else h+='<div class="empty">No hay incidencias en este periodo.</div>';
  return h
}
function vInicio(){
  const p=me(),cal=isCal();
  const abiertos=S.partes.filter(x=>x.estado==='Abierto'),venc=abiertos.filter(isOverdue),porVal=S.partes.filter(x=>x.estado==='Realizado');
  const mis=abiertos.filter(esMio);
  let pend=0,vp=0;lineasList().forEach(l=>{const g=progress(l);pend+=g.total-g.done;vp+=vencidasPrev(l)});
  let h='<h2>Hola, '+esc(first(actorName()||p.nombre))+'</h2><p class="muted">'+esc(p.rol)+(p.departamento?' · '+esc(p.departamento):'')+'</p>';
  h+='<div class="kpis"><div class="kpi warn"><b>'+abiertos.length+'</b><span>Incidencias abiertas</span></div><div class="kpi bad"><b>'+venc.length+'</b><span>Fuera de plazo</span></div><div class="kpi"><b>'+porVal.length+'</b><span>Por validar (calidad)</span></div>'+(cal||S.isAdmin?'<div class="kpi warn"><b>'+pend+'</b><span>Revisiones de vidrios pendientes</span></div><div class="kpi bad"><b>'+vp+'</b><span>Sin hacer del periodo anterior</span></div>':'')+'</div>';
  if(cal||S.isAdmin){
    h+=resumenInc();
    h+='<h3>Revisión de vidrios ('+(S.inOff?'periodo anterior':'periodo actual')+')</h3>';
    const off=S.inOff;
    h+='<p class="muted small">'+(off?'Lo que quedó sin hacer del periodo anterior.':'Lo que toca auditar ahora, por periodicidad.')+' Pulsa «Revisar» para ir a esa zona solo con lo pendiente.</p>';
    h+='<div class="chips"><button class="'+(!off?'on':'')+'" data-act="setInOff" data-o="0">Periodo actual</button><button class="'+(off?'on':'')+'" data-act="setInOff" data-o="-1">Periodo anterior</button></div>';
    h+='<div class="chips">'+['Todas'].concat(PERS).map(x=>'<button class="'+(x===S.inPer?'on':'')+'" data-act="setInPer" data-p="'+x+'">'+(x==='Todas'?'Todas':x==='Mensual'?'Mensuales':x==='Semanal'?'Semanales':'Quincenales')+'</button>').join('')+'</div>';
    let hayAlgo=false;
    PERS.filter(per=>S.inPer==='Todas'||S.inPer===per).forEach(per=>{
      const pr=periodFor(per,new Date(),off),zs=lineasList().map(l=>Object.assign({l:l},pendPer(l,per,off))).filter(z=>z.total);
      if(!zs.length)return;
      const pend=zs.reduce((n,z)=>n+z.pend,0),tt=zs.reduce((n,z)=>n+z.total,0);
      if(off&&!pend)return;
      hayAlgo=true;
      h+='<div class="card" style="border-left:5px solid '+(pend?((off||diasHasta(pr.limite)<=2)?'#c0301c':'#d98a00'):'#0a7a46')+'"><div class="row"><b class="grow" style="font-size:16px">'+({Semanal:'SEMANAL',Quincenal:'QUINCENAL',Mensual:'MENSUAL'}[per])+'</b><span class="chip '+(pend?(off?'bad':'pend'):'ok')+'">'+(pend?pend+' pendientes':'✔ al día')+'</span></div><div class="muted small">Periodo: '+fmtD(pr.inicio)+' – '+fmtD(pr.limite)+(off?' · terminó':' · '+limTxt(pr.limite))+' · '+(tt-pend)+' de '+tt+' hechas</div>';
      zs.filter(z=>z.pend).sort((x,y)=>y.pend-x.pend).forEach(z=>{
        h+='<div class="row" style="margin-top:8px;padding-top:8px;border-top:1px solid #e3e6ee"><span class="grow">'+esc(lineaLabel(z.l))+'</span><span class="muted small">'+z.pend+' pendientes · '+z.done+'/'+z.total+'</span><button class="b sm pri" data-act="irLinea" data-l="'+esc(z.l)+'" data-p="'+per+'">Revisar</button></div>'});
      if(!pend)h+='<div class="muted small" style="margin-top:6px">Todas las zonas al día ✔</div>';
      h+='</div>'});
    if(!hayAlgo)h+='<div class="empty">'+(off?'No quedó nada pendiente del periodo anterior ✔':'Aún no hay puntos con ese filtro.')+'</div>';
    {const vp2=lineasList().filter(l=>vencidasPrev(l));if(vp2.length)h+='<div class="warnbox">Sin hacer del periodo anterior: '+vp2.map(l=>esc(lineaLabel(l))+' ('+vencidasPrev(l)+')').join(' · ')+'</div>'}
    if(porVal.length)h+='<h3>Por validar (Apto calidad)</h3>'+porVal.map(x=>parteCard(x)).join('');
    if(venc.length)h+='<h3>Fuera de plazo</h3>'+venc.map(x=>parteCard(x)).join('');
  }else{
    h+='<h3>Lo que tienes pendiente</h3>';
    [['Vidrios','revision','🔍'],['Housekeeping','hk','📝']].forEach(o=>{
      const l=abiertos.filter(x=>origenOf(x)===o[0]&&(esMio(x)||canResolve(x))),v=l.filter(isOverdue).length,prox=l.map(x=>x.fechaPrevista).filter(Boolean).sort()[0];
      h+='<div class="card" style="border-left:5px solid '+(v?'#c0301c':l.length?'#d98a00':'#0a7a46')+'"><div class="row"><b class="grow" style="font-size:16px">'+o[2]+' '+o[0]+'</b><span class="chip '+(l.length?(v?'bad':'pend'):'ok')+'">'+(l.length?l.length+' pendiente'+(l.length>1?'s':''):'✔ al día')+'</span></div>'+(l.length?'<div class="muted small">'+(v?v+' fuera de plazo · ':'')+(prox?'la más próxima vence el '+fmtD(prox):'')+'</div><p style="margin-top:8px"><button class="b pri sm" data-act="tab" data-tab="'+o[1]+'">Ver y cerrar</button></p>':'<div class="muted small">No tienes incidencias pendientes.</div>')+'</div>'});
  }
  return h
}

/* ---------- Revisión de vidrios ---------- */
function misIncs(origen){
  const ls=S.partes.filter(x=>origenOf(x)===origen);
  const mine=ls.filter(x=>x.estado==='Abierto'&&(esMio(x)||canResolve(x))).sort((a,b)=>String(a.fechaPrevista||'').localeCompare(String(b.fechaPrevista||'')));
  const val=(canAudit())?ls.filter(x=>x.estado==='Realizado'):[];
  let h='<h3>'+(origen==='Vidrios'?'Incidencias de vidrios':'Incidencias de Housekeeping')+' pendientes'+(mine.length?' ('+mine.length+')':'')+'</h3>';
  h+=mine.length?mine.map(x=>parteCard(x)).join(''):'<div class="empty">No tienes incidencias pendientes de '+(origen==='Vidrios'?'vidrios':'Housekeeping')+' ✔</div>';
  if(val.length)h+='<h3>Por validar (Apto calidad) — '+(origen==='Vidrios'?'vidrios':'Housekeeping')+' ('+val.length+')</h3>'+val.map(x=>parteCard(x)).join('');
  return h
}
function vRevision(){
  const ls=lineasList();if(!ls.length)return empty('No hay puntos en el catálogo.');
  if(!S.linea||!ls.includes(S.linea))S.linea=ls[0];
  const ca=canAudit();
  const pts=activos(S.linea).filter(x=>S.perF==='Todas'||x.per===S.perF).sort(byId);
  const rows=pts.map(pt=>({pt:pt,st:statOf(pt,S.off)}));
  const done=rows.filter(r=>r.st.rev).length,pc=rows.length?Math.round(100*done/rows.length):0;
  const list=S.soloPend?rows.filter(r=>!r.st.rev):rows;
  let h='<h2>Revisión de vidrios y acrílicos</h2>'+misIncs('Vidrios')+'<h3>Revisión de puntos</h3>';
  h+=ls.length>8?'<label>Zona</label><select data-set="linea">'+ls.map(l=>'<option '+(l===S.linea?'selected':'')+'>'+esc(l)+'</option>').join('')+'</select>':'<div class="chips">'+ls.map(l=>'<button class="'+(l===S.linea?'on':'')+'" data-act="setLinea" data-l="'+esc(l)+'">'+esc(l)+'</button>').join('')+'</div>';
  h+='<div class="row"><div class="grow"><select data-set="perF">'+['Todas','Semanal','Quincenal','Mensual'].map(x=>'<option '+(x===S.perF?'selected':'')+'>'+x+'</option>').join('')+'</select></div><div class="grow"><select data-set="off"><option value="0" '+(S.off===0?'selected':'')+'>Periodo actual</option><option value="-1" '+(S.off===-1?'selected':'')+'>Periodo anterior</option></select></div></div>';
  h+='<p class="muted small">Periodo actual → '+PERS.map(per=>{const q=periodFor(per,new Date(),0);return '<b>'+per+'</b> '+fmtS(q.inicio)+'–'+fmtS(q.limite)}).join(' · ')+'</p>';
  h+='<label class="inl"><input type="checkbox" data-set="soloPend" '+(S.soloPend?'checked':'')+'> Mostrar solo pendientes</label>';
  {const pl=planosDe(S.linea);if(pl.length)h+='<div class="card"><div class="row"><b class="grow">🗺️ Plano · '+esc(S.linea)+'</b><button class="b sm" data-act="verPlano" data-l="'+esc(S.linea)+'">Ver en grande'+(pl.length>1?' ('+pl.length+')':'')+'</button></div><img data-ph="'+esc(thumbName(pl[0]))+'" data-act="verPlano" data-l="'+esc(S.linea)+'" alt="Plano" style="width:100%;max-height:150px;object-fit:cover;border-radius:8px;margin-top:8px;cursor:zoom-in"></div>'}
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
  if(!r){res=ca?'<div class="btns"><button class="b ok" data-act="ok" data-pid="'+esc(pt.id)+'">OK</button><button class="b bad" data-act="nook" data-pid="'+esc(pt.id)+'">NO OK</button></div>'+(esSuper()?'<button class="lnk small" data-act="posteriori" data-pid="'+esc(pt.id)+'">Registrar a posteriori</button>':''):'<span class="chip pend">Pendiente</span>'}
  else if(r.resultado==='OK'){cls='s-ok';res='<span class="chip ok">✔ OK</span> <span class="muted small">'+fmtD(r.fecha)+' · '+esc(r.por)+'</span>'+(r.aPosteriori?' <span class="chip pend">registrada a posteriori</span>':'')+(ca?' <button class="lnk small" data-act="undo" data-rid="'+esc(st.id)+'">Deshacer</button>':'')}
  else{cls='s-bad';res='<span class="chip bad">✖ NO OK</span> <span class="muted small">'+fmtD(r.fecha)+' · '+esc(r.por)+' · ACP:</span> <button class="lnk small" data-act="verparte" data-id="'+esc(r.parteId||'')+'">'+esc(r.parteId||'—')+'</button>'+(ca?' <button class="lnk small" data-act="undo" data-rid="'+esc(st.id)+'">Deshacer</button>':'')}
  return '<div class="pt '+cls+'"><div class="ph">'+ph+'</div><div class="pb"><div class="rev">'+esc(pt.rev)+'</div><div class="meta">'+(pt.mat?'<span>Material: '+esc(pt.mat)+'</span>':'')+(pt.cant?'<span>Cantidad: '+esc(pt.cant)+'</span>':'')+'<span class="chip">'+esc(pt.per)+' · '+fmtS(st.per.inicio)+'–'+fmtS(st.per.limite)+'</span></div>'+res+'</div></div>'
}

/* ---------- Housekeeping ---------- */
function vHK(){
  const hk=S.partes.filter(x=>origenOf(x)==='Housekeeping');
  let h='<h2>Housekeeping</h2><p class="muted">Auditoría de orden y limpieza. Cada no conformidad avisa por correo al departamento que la resuelve.</p>';
  h+=misIncs('Housekeeping');
  if(canAudit())h+='<p style="margin:14px 0"><button class="b pri big" data-act="newHK">+ Nueva no conformidad</button></p>';
  h+='<h3>Todas las no conformidades (últimas '+Math.min(15,hk.length)+' de '+hk.length+')</h3>';
  return h+(hk.length?hk.slice(0,15).map(parteCard).join(''):empty('Todavía no hay no conformidades de Housekeeping.'))
}
function openHK(){
  const secc=secciones(),prev=iso(addDays(new Date(),Number(S.config.plazoDias)||14));
  openSheet('Housekeeping · nueva no conformidad','<label>Fecha apertura</label><input type="date" id="h_fecha" value="'+todayISO()+'"><label>NCm/NCM *</label><input id="h_ncm" placeholder="Ej.: A.O.03"><label>Sección detección *</label><select id="h_det"><option value="">—</option>'+secc.map(s=>'<option>'+esc(s)+'</option>').join('')+'</select><label>Sección resolución (departamento que recibe el aviso) *</label><select id="h_dpto">'+optsDeptos('')+'</select><label>Responsable concreto (opcional)</label><select id="h_resp">'+'<option value="">—</option>'+S.personas.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.nombre)+'</option>').join('')+'</select><label>Resumen no conformidades *</label><textarea id="h_resumen" rows="2"></textarea><label>Análisis de causas *</label><textarea id="h_causas" rows="2"></textarea><label>Acciones correctivas/preventivas a implantar *</label><textarea id="h_acc" rows="2"></textarea><label>Fecha prevista *</label><input type="date" id="h_prev" value="'+prev+'">'+photoField('f_foto','Foto de calidad',true),{label:'Crear no conformidad',cls:'bad',wire:()=>wirePhoto('f_foto'),onSave:async()=>{
    const v={fecha:val('h_fecha'),ncm:val('h_ncm').trim(),det:val('h_det'),dpto:val('h_dpto'),resp:val('h_resp'),resumen:val('h_resumen').trim(),causas:val('h_causas').trim(),acc:val('h_acc').trim(),prev:val('h_prev')},ph=photos.f_foto,p=me();
    if(!v.fecha||!v.ncm||!v.det||!v.dpto||!v.resumen||!v.causas||!v.acc||!v.prev||!ph){toast('Rellena todos los campos obligatorios y añade la foto');return false}
    const fid=uid(),id='HK'+v.fecha.slice(2).replace(/-/g,'')+'-'+Math.random().toString(36).slice(2,5).toUpperCase();
    await savePhotoPair('inc',fid,ph);
    const parte={origen:'Housekeeping',fecha:v.fecha,linea:'HK',zona:v.det,elemento:v.ncm,ncm:v.ncm,seccionDeteccion:v.det,dpto:v.dpto,resp:v.resp||'',resumen:v.resumen,causas:v.causas,accion:v.acc,creadoPor:actorName(),fotoIni:fid,fechaPrevista:v.prev,estado:'Abierto',avisoEnviado:false};
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
  const p=me();if(S.fResp===null)S.fResp=(p&&(esCalP(p)||S.isAdmin))?'todos':'mios';
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
  if(S.focus)h+='<p><button class="b sm" data-act="clearFocus">'+(canAudit()?'← Ver todas las incidencias':'← Volver al inicio')+'</button></p>';
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
/* Huecos de revisión de un mes: semanal = un hueco por cada lunes del mes, quincenal = 2 (1-15 y 16-fin), mensual = 1 */
function slotsDelMes(per,mes){
  const y=Number(mes.slice(0,4)),m=Number(mes.slice(5,7)),fin=new Date(y,m,0).getDate(),out=[];
  if(per==='Semanal'){for(let d=1;d<=fin;d++){const dt=new Date(y,m-1,d);if(dt.getDay()===1)out.push(periodFor('Semanal',dt,0))}}
  else if(per==='Quincenal'){out.push(periodFor('Quincenal',new Date(y,m-1,1),0),periodFor('Quincenal',new Date(y,m-1,16),0))}
  else out.push(periodFor('Mensual',new Date(y,m-1,1),0));
  return out
}
function hojaHTML(linea,mes,revs){
  const pts=activos(linea).sort(byId),byK={};revs.filter(r=>r.linea===linea).forEach(r=>{byK[r.pid+'_'+r.inicio]=r});
  const a=mes.split('-');
  let h='<table class="rep head"><tr class="head"><td rowspan="2" class="logo">REFRESCO<br>IBERIA</td><td>'+(esLinea(linea)?'CONTROL VIDRIOS, ACRÍLICOS EN '+esc(lineaLabel(linea))+' (PRODUCCIÓN)':'REVISIÓN DE VIDRIOS Y ELEMENTOS QUEBRADIZOS EN PLANTA')+'</td><td>'+esc(S.config.edicion)+'</td></tr><tr class="head"><td>'+(esLinea(linea)?esc(lineaLabel(linea)):'ÁREA: '+esc(String(linea).toUpperCase()))+' &nbsp;&nbsp; FECHA: '+a[1]+'/'+a[0]+'</td><td>FIRMA APROBADO:<br><span style="font-weight:400">Responsable de Calidad</span><br><br></td></tr></table><br>';
  h+='<table class="rep"><thead><tr><th>FOTO</th><th>REVISIÓN</th><th>MATERIAL</th><th>CANTIDAD</th><th>PERIODO REVISIÓN</th><th>FECHA</th><th>OK</th><th>NO OK</th><th>ACP</th><th>FIRMA</th></tr></thead><tbody>';
  let cur=null;
  pts.forEach(pt=>{
    if(pt.equipo!==cur){cur=pt.equipo;h+='<tr class="gr"><td colspan="10">'+esc(cur)+'</td></tr>'}
    const th=(pt.fotos&&pt.fotos[0])?'ref/'+thumbName(pt.fotos[0]):'';
    const sl=slotsDelMes(pt.per||'Mensual',mes),n=sl.length;
    sl.forEach((sp,i)=>{
      const r=byK[pt.id+'_'+sp.inicio],ok=r&&r.resultado==='OK',no=r&&r.resultado==='NO OK';
      const cab=i===0?'<td rowspan="'+n+'">'+(th?'<img data-ph="'+esc(th)+'" alt="">':'')+'</td><td rowspan="'+n+'">'+esc(pt.rev)+'</td><td rowspan="'+n+'">'+esc(pt.mat)+'</td><td rowspan="'+n+'">'+esc(pt.cant)+'</td><td class="c" rowspan="'+n+'">'+esc(String(pt.per).toUpperCase())+'</td>':'';
      const per=pt.per==='Mensual'?'':'<br><span style="color:#777;font-size:9.5px">('+(pt.per==='Semanal'?'sem. ':'')+fmtS(sp.inicio)+'–'+fmtS(sp.limite)+')</span>';
      h+='<tr>'+cab+'<td class="c">'+(r?fmtS(String(r.fecha).slice(0,10)):'')+(r&&r.aPosteriori?'<br><span style="color:#B8400C;font-size:9.5px">(a posteriori)</span>':'')+per+'</td><td class="c okc">'+(ok?'✔':'')+'</td><td class="c nokc">'+(no?'✖':'')+'</td><td class="c">'+(no?esc(r.parteId||''):'')+'</td><td class="c">'+(r?esc(first(r.por)):'')+'</td></tr>'
    })
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
  let h=hkResumenHTML()+'<div class="rep-title">HOUSEKEEPING — '+(S.repAll?'TODOS LOS MESES':S.repMes.split('-').reverse().join('/'))+'</div><table class="rep"><thead><tr><th>ID</th><th>FECHA APERT</th><th>MES</th><th>NCm/NCM</th><th>SECCIÓN DETECCIÓN</th><th>SECCIÓN RESOLUCIÓN</th><th>RESUMEN NO CONFORMIDADES</th><th>ANÁLISIS DE CAUSAS</th><th>ACCIONES CORRECTIVAS/PREVENTIVAS</th><th>RESPONSABLE</th><th>FECHA PREVISTA</th><th>FECHA REAL</th><th>ESTADO</th></tr></thead><tbody>';
  if(!l.length)h+='<tr><td colspan="13" class="c">Sin no conformidades</td></tr>';
  l.forEach(x=>{h+='<tr><td>'+esc(x.id)+'</td><td>'+fmtD(x.fecha)+'</td><td class="c">'+Number(String(x.fecha).slice(5,7))+'</td><td>'+esc(x.ncm||x.elemento)+'</td><td>'+esc(x.seccionDeteccion||x.zona)+'</td><td>'+esc(deptOf(x))+'</td><td>'+esc(x.resumen)+'</td><td>'+esc(x.causas)+'</td><td>'+esc(x.accion)+'</td><td>'+esc(respName(x))+'</td><td class="c">'+fmtD(x.fechaPrevista)+'</td><td class="c">'+fmtD(x.fechaReal)+'</td><td class="c">'+(x.estado==='Cerrado'?'C':'A')+'</td></tr>'});
  return h+'</tbody></table>'
}

/* ---- Exportación Housekeeping en el formato del Excel del holding (23 columnas) ---- */
const HK_HEAD=['Nombre','Fecha apert','NCm/NCM','Sección detección','Seccion Resolucion','Resumen no conformidades','1. Resumen no conformidades','2.Resumen no conformidades','3.Resumen no conformidades','Analisis de causas','1.Analisis de causas','2.Analisis de causas','3.Analisis de causas','Acciones correctivas/Preventivas a implantar','1.Acciones correctivas/Preventivas a implantar','2.Acciones correctivas/Preventivas a implantar','3.Acciones correctivas/Preventivas a implantar','Responsable','Fecha prevista','Fecha Real','Estado','Imagen Calidad','Comentarios'];
const HK_DATECOLS=[1,18,19];
const HK_WIDTHS=[18,12,10,18,18,36,10,10,10,30,10,10,10,36,10,10,10,20,13,12,8,14,36];
function hkStats(l){const ce=l.filter(x=>x.estado==='Cerrado').length,ab=l.length-ce,fp=l.filter(isOverdue).length;return{total:l.length,ab:ab,ce:ce,fp:fp,pc:l.length?Math.round(100*ce/l.length):0}}
function hkResumenData(){
  const all=S.partes.filter(x=>origenOf(x)==='Housekeeping'),sel=hkList();
  const meses=[...new Set(all.map(x=>String(x.fecha).slice(0,7)))].sort();
  const porMes=meses.map(m=>Object.assign({mes:m},hkStats(all.filter(x=>String(x.fecha).slice(0,7)===m))));
  const ds=[...new Set(sel.map(x=>deptOf(x)||'Sin departamento'))].sort();
  const porDep=ds.map(d=>Object.assign({dep:d},hkStats(sel.filter(x=>(deptOf(x)||'Sin departamento')===d))));
  return{sel:hkStats(sel),all:hkStats(all),porMes:porMes,porDep:porDep}
}
function hkResumenHTML(){
  const r=hkResumenData(),mm=m=>m.split('-').reverse().join('/');
  let h='<div class="rep-title">RESUMEN HOUSEKEEPING — '+(S.repAll?'TODOS LOS MESES':mm(S.repMes))+'</div><table class="rep" style="width:auto;margin-bottom:10px"><thead><tr><th>Total</th><th>Abiertas</th><th>Fuera de plazo</th><th>Cerradas</th><th>% cierre</th></tr></thead><tbody><tr><td class="c">'+r.sel.total+'</td><td class="c">'+r.sel.ab+'</td><td class="c">'+r.sel.fp+'</td><td class="c">'+r.sel.ce+'</td><td class="c">'+r.sel.pc+'%</td></tr></tbody></table>';
  h+='<table class="rep" style="width:auto;margin-bottom:10px"><thead><tr><th>Mes (fecha apertura)</th><th>Abiertas en el mes</th><th>Siguen abiertas</th><th>Fuera de plazo</th><th>Cerradas</th><th>% cierre</th></tr></thead><tbody>'+(r.porMes.length?r.porMes.map(x=>'<tr><td>'+mm(x.mes)+'</td><td class="c">'+x.total+'</td><td class="c">'+x.ab+'</td><td class="c">'+x.fp+'</td><td class="c">'+x.ce+'</td><td class="c">'+x.pc+'%</td></tr>').join('')+'<tr style="font-weight:700"><td>Acumulado</td><td class="c">'+r.all.total+'</td><td class="c">'+r.all.ab+'</td><td class="c">'+r.all.fp+'</td><td class="c">'+r.all.ce+'</td><td class="c">'+r.all.pc+'%</td></tr>':'<tr><td colspan="6" class="c">Sin datos</td></tr>')+'</tbody></table>';
  if(r.porDep.length)h+='<table class="rep" style="width:auto;margin-bottom:14px"><thead><tr><th>Sección resolución</th><th>Total</th><th>Abiertas</th><th>Fuera de plazo</th><th>Cerradas</th></tr></thead><tbody>'+r.porDep.map(x=>'<tr><td>'+esc(x.dep)+'</td><td class="c">'+x.total+'</td><td class="c">'+x.ab+'</td><td class="c">'+x.fp+'</td><td class="c">'+x.ce+'</td></tr>').join('')+'</tbody></table>';
  return h+'<br>'
}
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
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Housekeeping');
  const r=hkResumenData(),mm=m=>m.split('-').reverse().join('/');
  const A=[['RESUMEN HOUSEKEEPING — '+(S.repAll?'TODOS LOS MESES':mm(S.repMes))],['Total','Abiertas','Fuera de plazo','Cerradas','% cierre'],[r.sel.total,r.sel.ab,r.sel.fp,r.sel.ce,r.sel.pc/100],[],['Mes (fecha apertura)','Abiertas en el mes','Siguen abiertas','Fuera de plazo','Cerradas','% cierre']].concat(r.porMes.map(x=>[mm(x.mes),x.total,x.ab,x.fp,x.ce,x.pc/100]),[['Acumulado',r.all.total,r.all.ab,r.all.fp,r.all.ce,r.all.pc/100],[],['Sección resolución','Total','Abiertas','Fuera de plazo','Cerradas']],r.porDep.map(x=>[x.dep,x.total,x.ab,x.fp,x.ce]));
  const w2=XLSX.utils.aoa_to_sheet(A);w2['!cols']=[{wch:26},{wch:18},{wch:16},{wch:15},{wch:12},{wch:10}];XLSX.utils.book_append_sheet(wb,w2,'Resumen');return wb
}
async function hkCopy(){
  const n=hkExportRows().length;if(!n){toast('No hay filas en ese periodo');return}
  const tsv=hkTSV();
  try{await navigator.clipboard.writeText(tsv);toast('Copiadas '+n+' filas (sin cabecera). Pega en el Excel del holding con Ctrl+V')}
  catch(e){openSheet('Copiar para el Excel del holding','<p class="muted small">Selecciona todo el texto, cópialo (Ctrl+C) y pégalo en la primera celda libre del Excel del holding. Son '+n+' filas, sin cabecera.</p><textarea id="tsvbox" rows="10" readonly style="font:12px monospace;white-space:pre;overflow:auto">'+esc(tsv)+'</textarea>',{noSave:true,wire:()=>{const t=$('#tsvbox');t.focus();t.select()}})}
}
let xlsxP=null;
function needXLSX(){if(window.XLSX)return Promise.resolve();if(!xlsxP)xlsxP=new Promise((res,rej)=>{const sc=document.createElement('script');sc.src='xlsx.full.min.js';sc.onload=res;sc.onerror=()=>{xlsxP=null;rej(new Error('xlsx'))};document.head.appendChild(sc)});return xlsxP}
async function hkXlsx(){
  if(!hkExportRows().length){toast('No hay filas en ese periodo');return}
  try{await needXLSX()}catch(e){toast('No se pudo cargar el generador de Excel. Usa «Copiar» o el CSV.');return}
  try{const data=XLSX.write(hkWorkbook(),{type:'array',bookType:'xlsx'});saveFile('housekeeping_'+(S.repAll?'todos':S.repMes)+'.xlsx',data,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
  catch(er){toast('No se pudo generar el Excel. Usa «Copiar» o el CSV.')}
}
const hojaTodas=()=>lineasList().map(l=>'<div style="page-break-after:always;break-after:page;margin-bottom:28px">'+hojaHTML(l,S.repMes,S.rep.revs)+'</div>').join('');
const repBody=()=>S.repTab==='hoja'?hojaTodas():S.repTab==='parte'?parteHTML(S.repMes):hkHTML();
function vInforme(){
  const ls=lineasList();if(!S.repLinea||!ls.includes(S.repLinea))S.repLinea=ls[0];
  if(!S.repMes)S.repMes=todayISO().slice(0,7);
  let h='<h2 class="noprint">Informes</h2><div class="noprint"><div class="chips"><button class="'+(S.repTab==='hoja'?'on':'')+'" data-act="repTab" data-t="hoja">Hoja de revisión (vidrios)</button><button class="'+(S.repTab==='parte'?'on':'')+'" data-act="repTab" data-t="parte">Parte de mantenimiento</button><button class="'+(S.repTab==='hk'?'on':'')+'" data-act="repTab" data-t="hk">Housekeeping</button></div>';
  h+='<div class="row">'+'<div class="grow"><input type="month" data-set="repMes" value="'+esc(S.repMes)+'"></div>'+(S.repTab==='hk'?'<label class="inl"><input type="checkbox" data-set="repAll" '+(S.repAll?'checked':'')+'> Todos los meses</label><label class="inl"><input type="checkbox" data-set="repOpen" '+(S.repOpen?'checked':'')+'> Incluir abiertas de meses anteriores</label>':'')+'</div>';
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
    S.rep.revs.slice().sort((a,b)=>a.linea.localeCompare(b.linea,undefined,{numeric:true})||a.pid.localeCompare(b.pid,undefined,{numeric:true})||a.inicio.localeCompare(b.inicio)).forEach(r=>{const pt=S.puntos.find(p=>p.id===r.pid);rows.push([r.linea,r.equipo,pt?pt.rev:'',r.per,fmtD(r.inicio),r.resultado,fmtD(r.fecha),r.por,r.parteId||'',r.obs||''])})
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
  h+=S.personas.length?S.personas.map(p=>'<div class="row" style="margin:6px 0"><div class="grow"><b>'+esc(p.nombre)+'</b> <span class="chip">'+esc(p.rol)+'</span><br><span class="muted small">'+esc(p.email||'sin correo') +(p.departamento?' · '+esc(p.departamento):'')+(miembrosDe(p).length?' · cuenta compartida ('+miembrosDe(p).length+')':'')+'</span></div><button class="b sm" data-act="editPersona" data-id="'+esc(p.id)+'">Editar</button></div>').join(''):'<p class="muted">Aún no hay personas.</p>';
  h+='<p><button class="b pri sm" data-act="editPersona" data-id="">+ Añadir persona</button></p></div>';
  h+='<h3>Parámetros</h3><div class="card"><div class="kv">Departamento por defecto de un NO OK de vidrios: <b>'+esc(dptoDefault()||'—')+'</b><br>Plazo por defecto: <b>'+S.config.plazoDias+' días</b><br>Texto de edición en la hoja: <b>'+esc(S.config.edicion)+'</b><br>Control vigente desde: <b>'+fmtD(S.config.desde)+'</b><br>Secciones de detección (Housekeeping): <b>'+esc(secciones().join(', '))+'</b><br>Housekeeping requiere Apto de calidad: <b>'+(S.config.validarHK?'Sí':'No (se cierra al pulsar Hecho)')+'</b></div><p><button class="b sm" data-act="editConfig">Cambiar</button></p></div>';
  h+='<h3>Copia de seguridad</h3><div class="card"><p class="muted small">Descarga todos los datos (menos las fotos) en un archivo. Conviene hacerlo cada semana o cada mes y guardarlo en SharePoint.</p><button class="b sm" data-act="backup">Descargar copia</button></div>';
  const ls=['Todas'].concat(lineasList());
  const pts=S.puntos.filter(x=>S.ajLinea==='Todas'||x.linea===S.ajLinea).sort(byId);
  h+='<h3>Catálogo de puntos de vidrios ('+S.puntos.length+')</h3><div class="row"><div class="grow"><select data-set="ajLinea">'+ls.map(l=>'<option '+(l===S.ajLinea?'selected':'')+'>'+esc(l)+'</option>').join('')+'</select></div><button class="b sm" data-act="editPlanos">🗺️ Planos</button><button class="b pri sm" data-act="editPunto" data-id="">+ Nuevo punto</button></div>';
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
function mailHtml(t){const e=x=>String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return '<div style="font-family:Calibri,Arial,sans-serif;font-size:11pt">'+e(t).replace(/(Pulsa aquí para (?:ver la incidencia|abrir la app)): (https?:\/\/\S+)/g,(m0,l,u)=>'<a href="'+u.replace(/&amp;/g,'&')+'" style="background:#0b5ed7;color:#fff;padding:6px 12px;border-radius:4px;text-decoration:none;font-weight:bold">'+l+'</a>').replace(/\n/g,'<br>')+'</div>'}
function openMail(m){
  const to=m.to||[],cc=m.cc||[];
  if(!to.length){openSheet('Aviso por correo','<div class="warnbox">No hay ningún correo configurado para este departamento. Añádelo en Ajustes → Departamentos y correos.</div>',{noSave:true});return}
  const url='mailto:'+to.join(',')+'?'+(cc.length?'cc='+cc.map(encodeURIComponent).join(',')+'&':'')+'subject='+encodeURIComponent(m.subject)+'&body='+encodeURIComponent(m.body);
  const canSend=CFG.avisosPorCorreo!==false&&!!m.srv;
  openSheet('Aviso por correo','<label>Para</label><div class="mailbox">'+esc(to.join('; '))+'</div>'+(cc.length?'<label>CC (en copia)</label><div class="mailbox">'+esc(cc.join('; '))+'</div>':'')+'<label>Asunto</label><div class="mailbox">'+esc(m.subject)+'</div><label>Mensaje</label><div class="mailbox">'+esc(m.body)+'</div><p class="row" style="margin-top:12px">'+(canSend?'<button class="b pri" id="mailsend">✉ Enviar ahora</button>':'')+'<a class="b'+(canSend?'':' pri')+'" style="text-decoration:none;display:inline-block" id="mailgo" href="'+esc(url)+'" target="_blank" rel="noopener">Abrir en mi correo</a><button class="b" id="mailcopy">Copiar mensaje</button><button class="b" id="mailhtml">Copiar con botón (Outlook)</button></p><p class="muted small">'+(canSend?'«Enviar ahora» lo manda la app a todo el departamento (las respuestas te llegarán a ti).':'Se abrirá tu correo con el aviso ya redactado.')+'</p>',{noSave:true,wire:()=>{
    const sb=$('#mailsend');
    if(sb)sb.onclick=async()=>{sb.disabled=true;try{await sendServerMail(m);closeSheet();toast('✉ Aviso enviado')}catch(e){sb.disabled=false;toast('No se pudo enviar: usa «Abrir en mi correo»')}};
    $('#mailgo').onclick=()=>{if(m.onSent)m.onSent()};
    $('#mailcopy').onclick=async()=>{try{await navigator.clipboard.writeText(m.body);toast('Mensaje copiado')}catch(e){toast('No se pudo copiar')}};
    $('#mailhtml').onclick=async()=>{try{const h=mailHtml(m.body);await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([h],{type:'text/html'}),'text/plain':new Blob([m.body],{type:'text/plain'})})]);toast('Copiado: pégalo en el cuerpo del correo (Ctrl+V)')}catch(e){try{await navigator.clipboard.writeText(m.body);toast('Copiado como texto')}catch(_){toast('No se pudo copiar')}}};
  }})
}
const appLink=id=>{const base=String(CFG.appUrl||(location.origin+location.pathname)).split('#')[0];return base+(id?'#parte='+encodeURIComponent(id):'')};
const linkTxt=id=>'\n\n'+(id?'Pulsa aquí para ver la incidencia: ':'Pulsa aquí para abrir la app: ')+appLink(id);
const miNombre=()=>actorName();
function mailNuevoParte(x){
  const d=destParte(x),hk=origenOf(x)==='Housekeeping';
  const cuerpo=hk
   ?'Calidad ha abierto una no conformidad de Housekeeping que debe resolver '+deptOf(x)+':\n\nNº: '+x.id+'\nNCm/NCM: '+(x.ncm||x.elemento)+'\nSección de detección: '+x.zona+'\nResumen: '+x.resumen+'\nAnálisis de causas: '+x.causas+'\nAcciones correctivas/preventivas: '+x.accion+'\nFecha prevista: '+fmtD(x.fechaPrevista)
   :'Calidad ha detectado una no conformidad en la revisión de vidrios y acrílicos que debe resolver '+deptOf(x)+':\n\nParte: '+x.id+'\nZona: '+x.zona+'\nElemento: '+x.elemento+'\nAcción a realizar: '+x.accion+'\nFecha prevista: '+fmtD(x.fechaPrevista);
  return{srv:{tipo:'nueva',id:x.id},to:d.para,cc:d.cc,subject:'['+origenOf(x)+'] Nueva incidencia '+x.id+' · '+x.zona,body:'Hola,\n\n'+cuerpo+'\n\nPor favor, entra en la app de Auditorías de planta, realiza la acción y márcala como "Hecho" con una foto.'+linkTxt(x.id)+'\n\nGracias,\n'+miNombre(),
    onSent:()=>S.db.doc('partes/'+x.id).update({avisoEnviado:true}).catch(()=>{})}
}
function mailRealizado(x){
  const d=destCalidad();
  return{srv:{tipo:'realizada',id:x.id},to:d.para,cc:d.cc,subject:'['+origenOf(x)+'] Incidencia '+x.id+' realizada · pendiente de validar',body:'Hola,\n\n'+deptOf(x)+' ha realizado la incidencia '+x.id+' ('+x.zona+' — '+x.elemento+').\n\nAcción realizada: '+(x.accionRealizada||'—')+'\nHecho por: '+x.operario+'\n\nPor favor, comprueba la foto y da el "Apto calidad" en la app de Auditorías de planta.'+linkTxt(x.id)+'\n\nGracias,\n'+miNombre()}
}
function mailDigest(nombre){
  const d=dest(nombre);const l=S.partes.filter(x=>x.estado==='Abierto'&&deptOf(x)===nombre);
  const lines=l.slice(0,12).map(x=>'· '+x.id+' ['+origenOf(x)+'] '+x.zona+' / '+x.elemento+': '+x.accion+' (prevista '+fmtD(x.fechaPrevista)+(isOverdue(x)?' · FUERA DE PLAZO':'')+')').join('\n');
  return{srv:{tipo:'resumen',dpto:nombre},to:d.para,cc:d.cc,subject:'['+nombre+'] Tenéis '+l.length+' incidencia(s) abierta(s)',body:'Hola,\n\nEstas son las incidencias abiertas de '+nombre+' en las auditorías de planta:\n\n'+lines+(l.length>12?'\n… y '+(l.length-12)+' más.':'')+'\n\nPor favor, entrad en la app de Auditorías de planta y marcadlas como "Hecho" con foto cuando estén resueltas.'+linkTxt()+'\n\nGracias,\n'+miNombre()}
}

/* ---- acciones de negocio ---- */
async function doOK(pt,st){
  const p=me();
  await S.db.doc('revisiones/'+st.id).set({pid:pt.id,linea:pt.linea,equipo:pt.equipo,per:pt.per,inicio:st.per.inicio,limite:st.per.limite,resultado:'OK',fecha:nowISO(),por:actorName(),porId:p.id})
}
function openPosteriori(pt,st){
  if(!esSuper())return;
  openSheet('Registrar a posteriori','<div class="kv"><b>'+esc(pt.linea+' · '+pt.equipo)+'</b><br>'+esc(pt.rev)+'<br><span class="muted small">Periodo '+fmtD(st.per.inicio)+' – '+fmtD(st.per.limite)+'</span></div><div class="warnbox">Queda registrada como «a posteriori», con tu nombre, el día en que la registras y el motivo. Aparece marcada en el informe.</div><label>Fecha en la que se hizo la revisión *</label><input type="date" id="f_fp" min="'+st.per.inicio+'" max="'+todayISO()+'" value="'+(st.per.limite<todayISO()?st.per.limite:todayISO())+'"><label>Resultado</label><select id="f_rs"><option>OK</option></select><label>Motivo del registro tardío *</label><textarea id="f_mt" rows="2" placeholder="Ej.: se hizo en papel y no se apuntó / parada de línea"></textarea><p class="muted small">Si hubo un problema (NO OK), usa el botón NO OK normal para abrir el parte.</p>',{label:'Registrar',onSave:async()=>{
    const f=val('f_fp'),mt=val('f_mt').trim(),p=me();
    if(!f||!mt){toast('Indica la fecha y el motivo');return false}
    if(f>todayISO()){toast('La fecha no puede ser futura');return false}
    await S.db.doc('revisiones/'+st.id).set({pid:pt.id,linea:pt.linea,equipo:pt.equipo,per:pt.per,inicio:st.per.inicio,limite:st.per.limite,resultado:'OK',fecha:f+'T12:00:00.000Z',por:actorName(),porId:p?p.id:'',aPosteriori:true,registradoEn:nowISO(),obs:'Registrada a posteriori el '+fmtD(todayISO())+' por '+actorName()+'. Motivo: '+mt});
    return{after:()=>toast('Revisión registrada a posteriori')}
  }})
}
function openNoOk(pt,st){
  const prev=iso(addDays(new Date(),Number(S.config.plazoDias)||14));
  openSheet('NO OK · crear parte (ACP)','<div class="kv"><b>'+esc(pt.linea+' · '+pt.equipo)+'</b><br>'+esc(pt.rev)+'</div><label>Elemento *</label><input id="f_elem" value="'+esc(pt.equipo)+'"><label>Acción a realizar *</label><textarea id="f_accion" rows="3" placeholder="Ej.: sustituir metacrilato roto de la puerta"></textarea><label>Departamento que lo resuelve *</label><select id="f_dpto">'+optsDeptos(dptoDefault())+'</select><label>Responsable concreto (opcional)</label><select id="f_resp"><option value="">—</option>'+S.personas.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.nombre)+'</option>').join('')+'</select><label>Fecha prevista *</label><input type="date" id="f_prev" value="'+prev+'">'+photoField('f_foto','Foto de la no conformidad',true),{label:'Crear parte',cls:'bad',wire:()=>wirePhoto('f_foto'),onSave:async()=>{
    const accion=val('f_accion').trim(),elem=val('f_elem').trim(),dpto=val('f_dpto'),resp=val('f_resp'),pv=val('f_prev'),ph=photos.f_foto,p=me();
    if(!accion||!elem||!dpto||!pv||!ph){toast('Rellena todos los campos y añade la foto');return false}
    const fid=uid(),id='V'+todayISO().slice(2).replace(/-/g,'')+'-'+Math.random().toString(36).slice(2,5).toUpperCase();
    await savePhotoPair('inc',fid,ph);
    const parte={origen:'Vidrios',fecha:todayISO(),linea:pt.linea,zona:pt.linea+' · '+pt.equipo,elemento:elem,accion:accion,pid:pt.id,rid:st.id,dpto:dpto,resp:resp||'',creadoPor:actorName(),fotoIni:fid,fechaPrevista:pv,estado:'Abierto',avisoEnviado:false};
    await S.db.doc('partes/'+id).set(parte);
    await S.db.doc('revisiones/'+st.id).set({pid:pt.id,linea:pt.linea,equipo:pt.equipo,per:pt.per,inicio:st.per.inicio,limite:st.per.limite,resultado:'NO OK',fecha:nowISO(),por:actorName(),porId:p?p.id:'',parteId:id,obs:accion});
    return{after:()=>{toast('Parte '+id+' creado');notify(mailNuevoParte(Object.assign({id:id},parte)))}}
  }})
}
function openHecho(x){
  const p=me(),hk=origenOf(x)==='Housekeeping';
  const body=hk
   ?'<div class="kv"><b>'+esc(x.zona+' — NCm/NCM '+(x.ncm||x.elemento))+'</b><br>'+esc(x.accion)+'</div><label>Acción realizada</label><textarea id="f_real" rows="2"></textarea><label>Comentarios</label><input id="f_com">'+photoField('f_foto','Foto de evidencia',true)
   :'<div class="kv"><b>'+esc(x.zona+' — '+x.elemento)+'</b><br>'+esc(x.accion)+'</div><label>Acción realizada *</label><textarea id="f_real" rows="3"></textarea><label>Operario *</label><input id="f_oper" value="'+esc(actorName())+'"><label>Limpieza de zona *</label><select id="f_limp"><option value="">—</option><option value="1">Sí</option><option value="0">No</option></select><label>Ausencia de materiales / herramientas *</label><select id="f_mat"><option value="">—</option><option value="1">Sí, no queda nada</option><option value="0">No</option></select><label>Comentarios</label><input id="f_com">'+photoField('f_foto','Foto del trabajo terminado',true);
  openSheet('Incidencia '+x.id+' · Hecho',body,{label:'Marcar como hecho',wire:()=>wirePhoto('f_foto'),onSave:async()=>{
    const real=val('f_real').trim(),ph=photos.f_foto;
    let upd;
    if(hk){
      if(!ph){toast('Añade la foto de evidencia');return false}
      upd={accionRealizada:real,operario:actorName(),comentarios:val('f_com').trim()};
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
    return{after:()=>{if(!ok){const d=destParte(x);notify({srv:{tipo:'devuelta',id:x.id},to:d.para,cc:d.cc,subject:'['+origenOf(x)+'] Incidencia '+x.id+' devuelta por calidad',body:'Hola,\n\nCalidad ha devuelto la incidencia '+x.id+' ('+x.zona+' — '+x.elemento+').\nMotivo: '+c+'\n\nPor favor, revisadla y marcadla de nuevo como "Hecho" con foto.'+linkTxt(x.id)+'\n\nGracias,\n'+miNombre()})}else toast('Incidencia cerrada ✔')}}
  }})
}
async function undoRev(rid){
  const r=S.revs[rid];if(!r||!confirm('¿Deshacer esta revisión?'+(r.parteId?'\nTambién se eliminará el parte '+r.parteId+' si sigue abierto.':'')))return;
  try{
    if(r.parteId){const x=S.partes.find(q=>q.id===r.parteId);if(x&&x.estado!=='Abierto'){toast('El parte ya está realizado: no se puede deshacer');return}if(x)await S.db.doc('partes/'+x.id).delete()}
    await S.db.doc('revisiones/'+rid).delete()
  }catch(e){toast(errMsg(e))}
}
async function showPaths(ps){try{const us=await Promise.all(ps.map(p=>loadPhoto(p,true)));showImgs(us)}catch(e){toast('No se pudo cargar la foto')}}
let lbList=[],lbI=0;
function showImgs(l){lbList=l;lbI=0;lbShow()}
function lbShow(){$('#lbimg').src=lbList[lbI];const lo=$('#lbopen');if(lo)lo.href=lbList[lbI];$('#lb').classList.add('on');$('#lbprev').style.visibility=$('#lbnext').style.visibility=lbList.length>1?'visible':'hidden'}
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
  openSheet(id?'Editar persona':'Nueva persona','<label>Nombre *</label><input id="f_nom" value="'+esc(p.nombre)+'"><label>Correo de la empresa (con el que inicia sesión) *</label><input id="f_mail" type="email" value="'+esc(p.email)+'" '+(id?'readonly':'')+'><label>Rol *</label><select id="f_rol">'+['Responsable','Coordinador','Calidad'].concat(['Mantenimiento'].filter(r=>r===p.rol)).map(r=>'<option '+(r===p.rol?'selected':'')+'>'+r+'</option>').join('')+'</select><p class="muted small">Calidad: audita y valida. Responsable: cierra las incidencias si está en PARA de su departamento. Coordinador: ayudante del departamento, recibe y cierra las incidencias de su departamento.</p><label>Departamento</label><input id="f_dep" list="dl_dep" value="'+esc(p.departamento)+'"><datalist id="dl_dep">'+S.deptos.map(d=>'<option value="'+esc(d.nombre)+'">').join('')+'</datalist><label class="inl"><input type="checkbox" id="f_adm" '+(p.admin?'checked':'')+'> Administrador de la app (Ajustes)</label><label>Cuenta compartida: personas que la usan (una por línea)</label><textarea id="f_mie" rows="4" placeholder="Déjalo vacío si esta cuenta es de una sola persona">'+esc(miembrosDe(p).join('\n'))+'</textarea><p class="muted small">Si pones nombres, al entrar con este correo saldrá un desplegable para elegir quién eres, y la revisión quedará a su nombre.</p>'+(id?'<p><button class="b ghost sm" id="f_del">Eliminar persona</button></p>':''),{wire:()=>{const d=$('#f_del');if(d)d.onclick=async()=>{if(confirm('¿Eliminar a '+p.nombre+'?')){try{await S.db.doc('personas/'+id).delete();closeSheet()}catch(e){toast(errMsg(e))}}}},onSave:async()=>{
    const n=val('f_nom').trim(),m=val('f_mail').trim().toLowerCase(),dep=val('f_dep').trim();if(!n||!/@/.test(m)){toast('Nombre y correo válido son obligatorios');return false}
    const pid=id||m;
    await S.db.doc('personas/'+pid).set({nombre:n,email:m,rol:val('f_rol'),departamento:dep,admin:$('#f_adm').checked});
    if(dep&&!deptByName(dep))await S.db.doc('departamentos/'+slug(dep)).set({nombre:dep,para:[m],cc:[]});
    const mie=val('f_mie').split('\n').map(x=>x.trim()).filter(Boolean),antes=miembrosDe(p).join('|');
    if(mie.join('|')!==antes){const cur=Object.assign({},S.config.miembros||{});if(mie.length)cur[pid]=mie;else delete cur[pid];await S.db.doc('config/general').set(Object.assign({},S.config,{miembros:cur}))}
  }})
}
function openPlanos(){
  const ls=lineasList();
  const row=l=>'<div class="row" style="margin:8px 0"><span class="grow"><b>'+esc(l)+'</b> · '+planosDe(l).length+' plano(s)</span><label class="b sm" style="margin:0;cursor:pointer;color:var(--ink)">+ Añadir<input type="file" accept="image/*" data-plano="'+esc(l)+'" style="display:none"></label>'+(planosDe(l).length?'<button class="b ghost sm" data-act="delPlano" data-l="'+esc(l)+'">Quitar</button>':'')+'</div>';
  openSheet('Planos de las zonas',(ls.map(row).join('')||'<p class="muted">Primero crea los puntos de una zona.</p>')+'<p class="muted small">El plano se ve en la pestaña Vidrios de esa zona y se amplía al pulsarlo. Sube una imagen (JPG o PNG); si tienes el plano en PDF o Word, haz una captura.</p>',{noSave:true,wire:()=>{
    document.querySelectorAll('input[data-plano]').forEach(inp=>inp.onchange=async()=>{
      const f=inp.files&&inp.files[0];if(!f)return;const l=inp.dataset.plano;toast('Subiendo plano…');
      try{const ph=await processPlano(f);const name='ref/plano_'+slug(l)+'_'+Date.now().toString(36)+'.jpg';
        await putPhoto(name,ph.full);await putPhoto(thumbName(name),ph.thumb);
        const cur=Object.assign({},S.config.planos||{});cur[l]=planosDe(l).concat([name]);
        await S.db.doc('config/general').set(Object.assign({},S.config,{planos:cur}));closeSheet();toast('Plano añadido a '+l)
      }catch(e){toast(errMsg(e))}
    })
  }})
}
async function quitarPlanos(l){
  if(!confirm('¿Quitar los planos de '+l+'?'))return;
  try{const cur=Object.assign({},S.config.planos||{});delete cur[l];await S.db.doc('config/general').set(Object.assign({},S.config,{planos:cur}));closeSheet();toast('Planos quitados')}catch(e){toast(errMsg(e))}
}
function openConfig(){
  const c=S.config;
  openSheet('Parámetros','<label>Departamento por defecto de un NO OK (vidrios)</label><select id="f_dd">'+optsDeptos(dptoDefault())+'</select><label>Plazo por defecto (días)</label><input id="f_pl" type="number" min="1" value="'+c.plazoDias+'"><label>Texto de edición en la hoja</label><input id="f_ed" value="'+esc(c.edicion)+'"><label>Control vigente desde</label><input id="f_ds" type="date" value="'+esc(c.desde)+'"><p class="muted small">Las revisiones anteriores a esta fecha no se marcan como sin hacer.</p><label>Secciones de detección de Housekeeping (una por línea)</label><textarea id="f_sec" rows="5">'+esc(secciones().join('\n'))+'</textarea><label class="inl"><input type="checkbox" id="f_vhk" '+(c.validarHK?'checked':'')+'> Housekeeping requiere Apto de calidad (si no, se cierra al pulsar Hecho)</label>',{onSave:async()=>{
    const sec=val('f_sec').split('\n').map(s=>s.trim()).filter(Boolean);
    await S.db.doc('config/general').set(Object.assign({},S.config,{respDefault:c.respDefault||'',dptoDefault:val('f_dd'),plazoDias:Number(val('f_pl'))||14,edicion:val('f_ed').trim()||'Edición 1',desde:val('f_ds')||todayISO(),seccionesDeteccion:sec.length?sec:DEFAULT_SECC,validarHK:$('#f_vhk').checked}))
  }})
}
function openPunto(id){
  const x=S.puntos.find(p=>p.id===id)||{linea:S.ajLinea!=='Todas'?S.ajLinea:(lineasList()[0]||'L8'),equipo:'',rev:'',mat:'',cant:'',per:'Mensual',activo:true,fotos:[]};
  openSheet(id?'Editar punto '+id:'Nuevo punto','<label>Línea / zona *</label><input id="f_lin" list="dl_lin" value="'+esc(x.linea)+'"><datalist id="dl_lin">'+lineasList().map(l=>'<option value="'+esc(l)+'">').join('')+'</datalist><label>Equipo / zona *</label><input id="f_eq" value="'+esc(x.equipo)+'"><label>Qué revisar *</label><textarea id="f_rev" rows="3">'+esc(x.rev)+'</textarea><label>Material</label><input id="f_mat" value="'+esc(x.mat)+'"><label>Cantidad / elementos</label><input id="f_cant" value="'+esc(x.cant)+'"><label>Periodicidad *</label><select id="f_per">'+['Semanal','Quincenal','Mensual'].map(r=>'<option '+(r===x.per?'selected':'')+'>'+r+'</option>').join('')+'</select><label class="inl"><input type="checkbox" id="f_act" '+(x.activo!==false?'checked':'')+'> Punto activo</label>'+photoField('f_foto','Añadir foto de referencia ('+(x.fotos||[]).length+' actuales)',false),{wire:()=>wirePhoto('f_foto',true),onSave:async()=>{
    const lin=val('f_lin').trim(),eq=val('f_eq').trim(),rev=val('f_rev').trim();if(!lin||!eq||!rev){toast('Línea, equipo y qué revisar son obligatorios');return false}
    let pid=id;if(!pid){const nums=S.puntos.filter(p=>p.linea===lin).map(p=>Number(String(p.id).split('-').pop())||0);const ex=S.puntos.find(p=>p.linea===lin);const pre=ex?String(ex.id).replace(/-\d+$/,''):'V-'+slug(lin).toUpperCase();pid=pre+'-'+String((nums.length?Math.max.apply(null,nums):0)+1).padStart(3,'0')}
    const fotos=(x.fotos||[]).slice();if(photos.f_foto){const nmf=pid+'_'+(fotos.length+1)+'.jpg';await putPhoto('ref/'+nmf,photos.f_foto.full);await putPhoto('ref/'+thumbName(nmf),photos.f_foto.thumb);fotos.push(nmf)}
    await S.db.doc('puntos/'+pid).set({linea:lin,equipo:eq,rev:rev,mat:val('f_mat').trim(),cant:val('f_cant').trim(),per:val('f_per'),activo:$('#f_act').checked,fotos:fotos,nota:x.nota||''})
  }})
}

/* ====================== eventos ====================== */
document.addEventListener('click',async e=>{
  const t=e.target.closest('[data-act]');if(!t)return;const a=t.dataset.act,d=t.dataset;
  if(a==='sheetClose'){closeSheet();return}
  if(a==='tab'){clearHash();S.tab=d.tab;S.focus=null;render();window.scrollTo(0,0);return}
  if(a==='sendcode'){const em=val('a_email').trim().toLowerCase();if(!/@/.test(em)){toast('Escribe tu correo');return}t.disabled=true;const r=await sb.auth.signInWithOtp({email:em,options:{shouldCreateUser:true}});t.disabled=false;if(r.error){toast('No se pudo enviar el código: '+r.error.message);return}S.auth={step:'code',email:em};render();return}
  if(a==='verifycode'){const code=val('a_code').trim();if(!code){toast('Escribe el código');return}t.disabled=true;const r=await sb.auth.verifyOtp({email:S.auth.email,token:code,type:'email'});t.disabled=false;if(r.error)toast('Código incorrecto o caducado');return}
  if(a==='usepass'){S.auth={step:'pass',email:val('a_email').trim()};render();return}
  if(a==='passlogin'){t.disabled=true;const r=await sb.auth.signInWithPassword({email:val('a_email').trim().toLowerCase(),password:val('a_pass')});t.disabled=false;if(r.error)toast('Correo o contraseña incorrectos');return}
  if(a==='backlogin'){S.auth={step:'email',email:''};render();return}
  if(a==='logout'){doLogout();return}
  if(a==='userMenu'){openUserMenu();return}
  if(a==='verComoSalir'){S.viewAs=null;S.tab='inicio';S.fResp=null;render();window.scrollTo(0,0);return}
  if(a==='setActor'){const v=val('actorSel');if(!v){toast('Elige tu nombre');return}S.actor=v;try{sessionStorage.setItem('aud_actor',v);localStorage.setItem('aud_actor_last',v)}catch(e){}render();return}
  if(a==='backup'){try{saveFile('copia_auditorias_'+todayISO()+'.json',JSON.stringify(await exportAll(),null,1),'application/json')}catch(er){toast('No se pudo generar la copia')}return}
  if(a==='setResOrig'){S.resOrig=d.o;render();return}
  if(a==='setInOff'){S.inOff=Number(d.o)||0;render();return}
  if(a==='setInPer'){S.inPer=(S.inPer===d.p&&d.p!=='Todas')?'Todas':d.p;render();return}
  if(a==='irLinea'){S.linea=d.l;S.perF=d.p||S.inPer;S.off=S.inOff;S.soloPend=true;S.tab='revision';render();window.scrollTo(0,0);return}
  if(a==='setLinea'){S.linea=d.l;render();return}
  if(a==='imgs'){const pt=S.puntos.find(p=>p.id===d.pid);if(pt&&pt.fotos&&pt.fotos.length)showPaths(pt.fotos.map(f=>'ref/'+f));return}
  if(a==='foto'){showPaths([d.f]);return}
  if(a==='newHK'){if(!canAudit())return;openHK();return}
  if(a==='posteriori'){const pt=S.puntos.find(p=>p.id===d.pid);if(pt)openPosteriori(pt,statOf(pt,S.off));return}
  if(a==='ok'||a==='nook'){const pt=S.puntos.find(p=>p.id===d.pid);if(!pt)return;const st=statOf(pt,S.off);
    if(a==='ok'){t.disabled=true;try{await doOK(pt,st)}catch(x){toast(errMsg(x));t.disabled=false}}else openNoOk(pt,st);return}
  if(a==='undo'){undoRev(d.rid);return}
  if(a==='verparte'){if(!d.id)return;S.focus=d.id;S.tab='partes';render();window.scrollTo(0,0);return}
  if(a==='clearFocus'){clearHash();S.focus=null;if(!canAudit())S.tab='inicio';render();return}
  const x=S.partes.find(q=>q.id===d.id);
  if(a==='hecho'&&x){if(!canResolve(x)){toast('Solo puede cerrarla el responsable asignado (o Nuria)');return}openHecho(x);return}
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
    try{const nm=S.repTab==='hoja'?'hoja_revision_todas_las_zonas_'+S.repMes:S.repTab==='parte'?'parte_mantenimiento_'+S.repMes:'housekeeping_'+(S.repAll?'todos':S.repMes);
      if(a==='dlHtml')saveFile(nm+'.html',await inlinePhotos(reportDocHTML()),'text/html');
      else saveFile(nm+'.csv','\ufeff'+reportCSV(),'text/csv');
    }catch(er){toast('No se pudo descargar')}return}
  if(a==='editDepto'){openDepto(d.id);return}
  if(a==='editPersona'){openPersona(d.id);return}
  if(a==='editConfig'){openConfig();return}
  if(a==='editPlanos'){openPlanos();return}
  if(a==='delPlano'){quitarPlanos(d.l);return}
  if(a==='verPlano'){const pl=planosDe(d.l);if(pl.length)showPaths(pl);return}
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
