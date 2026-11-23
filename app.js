/* Eidos lesson boards (stand-alone site). A lesson link opens the board for a teacher or a student;
   notes are shared through Firebase (fb.js), the teacher leads, students follow. */
(()=>{
'use strict';
const RESET=':root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#000}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}';
const SKEL='<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>'+RESET+'</style></head><body>';
const VERSION='17';
/* The page as published: everything is in app.js / app.css; the state block is the only part that changes. */
function pageContent(state){
  const json=JSON.stringify(state).replace(/</g,'\\u003c');
  return '<title>Up · B1 Unit 1</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@500;700;800;900&display=swap">\n<link rel="stylesheet" href="font.css">\n<link rel="stylesheet" href="base.css?v='+VERSION+'">\n<div id="app"><p style="padding:24px;font:16px system-ui">Loading lesson boards…</p></div>\n<script id="state" type="application/json">'+json+'</script>\n<script src="app.js?v='+VERSION+'"></script>\n';
}
window.EIDOS_PAGE={pageContent,SKEL};
if(typeof document==='undefined'||!document.getElementById('app'))return;

const UNITS=[{lvl:"B1",n:1,t:"Identity, Relationships & Habits",s:"Up",g:"Present Simple vs Continuous · state verbs · verb patterns · narrative tenses",e:"🎈",id:"b1u1",cover:"bg_sky"}];
const TABS=[{id:'keys',label:'🔑 Teacher keys',sec:0},{id:'l1',label:'Lesson 1',sec:1},{id:'l2',label:'Lesson 2',sec:2},{id:'l3',label:'Lesson 3',sec:3},{id:'l4',label:'Lesson 4',sec:4}];
const BW=1600,BH=900,PAD=22,GAP=14;
const COLORS=['#e63946','#1d4ed8','#15803d','#111111','#f59e0b','#9333ea'];
const NS='http://www.w3.org/2000/svg';

let SAVED=window.EIDOS_STATE||{};
SAVED.units=SAVED.units||{};
let S=JSON.parse(JSON.stringify(SAVED));            // working copy (edits land here until saved)
let dirty=false,canEdit=false,editing=false,artifactNs=null,assetsNs=null,readOnlySeen=false;
let unitId=null,U=null,cur='l1',scale=1,zoomList=[],zoomIdx=0,selected=null;
let tool='view',color=COLORS[0];
const app=document.getElementById('app');
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const $=s=>document.querySelector(s);
const unitState=()=>{const u=S.units[unitId]=S.units[unitId]||{};for(const k of ['pos','cc','chars','bg','text','logo'])u[k]=u[k]||{};return u};
function toast(msg){const t=document.createElement('div');t.className='toast';t.setAttribute('role','status');t.textContent=msg;document.body.append(t);setTimeout(()=>t.remove(),3200)}
function ask(msg,ok){return new Promise(res=>{const o=document.createElement('div');o.className='askOv';o.setAttribute('role','dialog');o.setAttribute('aria-modal','true');
  const b=document.createElement('div');b.className='askBox';const p=document.createElement('p');p.textContent=msg;const r=document.createElement('div');r.className='askRow';
  const no=document.createElement('button');no.type='button';no.className='tool';no.textContent='Cancel';const yes=document.createElement('button');yes.type='button';yes.className='tool askYes';yes.textContent=ok||'OK';
  const end=v=>{o.remove();document.removeEventListener('keydown',kd,true);res(v)};const kd=e=>{if(e.key==='Escape'){e.stopPropagation();end(false)}};
  no.onclick=()=>end(false);yes.onclick=()=>end(true);o.onclick=e=>{if(e.target===o)end(false)};document.addEventListener('keydown',kd,true);
  r.append(no,yes);b.append(p,r);o.append(b);(document.fullscreenElement||document.body).append(o);yes.focus()})}
function lsGet(k){try{return localStorage.getItem(k)}catch(e){return null}}
function lsSet(k,v){try{localStorage.setItem(k,v)}catch(e){}}
/* the editor's own notes live only in this tab (her board stays clean); everyone else keeps theirs in their browser */
let roleKnown=false;
function inkGet(k){try{return (canEdit?sessionStorage:localStorage).getItem(k)}catch(e){return null}}
function inkPut(k,v){try{(canEdit?sessionStorage:localStorage).setItem(k,v)}catch(e){}}

let FB=null,ROLE='solo';
function refreshRole(){
  const r=$('#role');if(r)r.hidden=!canEdit,r.textContent='✏️ You can edit these boards. Teachers you share the link with can only draw and write on top.';
  const eb=$('#editBtn');if(eb)eb.hidden=!canEdit;const wb=$('#wipeBtn');if(wb)wb.hidden=!canEdit;
  const ab=$('#addCharBtn'),bb=$('#bgBtn');if(ab)ab.disabled=!assetsNs;if(bb)bb.disabled=!assetsNs;
}
function markDirty(){dirty=true;const s=$('#saveBtn');if(s){s.disabled=false;s.textContent='💾 Save for everyone'}const d=$('#discardBtn');if(d)d.disabled=false;const st=$('#editStatus');if(st)st.textContent='Unsaved changes'}
addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});

async function save(){
  if(!artifactNs){toast('Saving is not available in this view.');return}
  const btn=$('#saveBtn');btn.disabled=true;btn.textContent='Saving…';
  try{
    await artifactNs.publish(SKEL+pageContent(S)+'</body></html>');
    dirty=false;$('#editStatus').textContent='Saved. Everyone now sees this version.';
  }catch(e){
    const c=e&&e.code;
    if(c==='conflict'){dirty=false;toast('A newer version was saved meanwhile. The page reloads to it.')}
    else if(c==='not_writer'||c==='not_granted'){canEdit=false;readOnlySeen=true;setEditing(false);refreshRole();toast('This view is read-only, so changes cannot be saved.')}
    else if(c==='rate_limited'){btn.disabled=false;btn.textContent='💾 Save for everyone';toast('Saved too often. Wait a moment and try again.')}
    else{btn.disabled=false;btn.textContent='💾 Save for everyone';toast('Could not save'+(c?' ('+c+')':'')+'. Your changes are still here.')}
  }
}

/* ---------- routing ---------- */
function route(){
  const [u,t]=location.hash.slice(1).split('/');
  openUnit(FB&&FB.lesson.unit||'b1u1',TABS.some(x=>x.id===t)&&(t!=='keys'||ROLE==='teacher')?t:'l1')
}
addEventListener('hashchange',route);

/* ---------- hub ---------- */
function renderHub(){
  document.body.classList.remove('fs');
  app.innerHTML='<div class="hub"><h1>Eidos English · lesson boards</h1><p class="lead">Choose a unit. Every board is locked for teachers: draw, circle, highlight and write on top, and click an exercise to zoom in on it. Notes stay in each teacher’s browser.</p><div class="role" id="role" hidden></div><div id="blocks"></div><p class="tip">New units appear here as soon as they are ready. The link stays the same.</p></div>';
  const root=$('#blocks');let grid;
  for(const u of UNITS){
    if(u.lvl){const h=document.createElement('h2');h.className='lvl';h.textContent=u.lvl;root.append(h)}
    if(u.b){const h=document.createElement('h2');h.textContent=u.b;root.append(h);grid=document.createElement('div');grid.className='grid';root.append(grid)}
    const el=document.createElement(u.id?'a':'div');el.className='u'+(u.id?'':' soon');if(u.id)el.href='#'+u.id;
    const c=document.createElement('div');c.className='cover';
    if(u.id&&u.cover)c.style.backgroundImage='url("units/'+u.id+'/assets/'+u.cover+(u.cover.startsWith('bg_')?'.jpg':'.jpg')+'")';else{c.textContent=u.e;c.classList.add('emo')}
    const n=document.createElement('span');n.className='num';n.textContent='Unit '+u.n;
    const ch=document.createElement('span');ch.className='chip'+(u.id?' ready':'');ch.textContent=u.id?'Open board':'Coming soon';c.append(n,ch);
    const b=document.createElement('div');b.className='ubody';
    for(const [k,v] of [['ut',u.t],['us',u.s],['ug',u.g]]){const d=document.createElement('div');d.className=k;d.textContent=v;b.append(d)}
    el.append(c,b);grid.append(el)}
  refreshRole();
}

/* ---------- unit loading ---------- */
async function loadUnit(id){
  window.EIDOS_UNITS=window.EIDOS_UNITS||{};
  if(FB){const b=await FB.getBoard(id);if(b){window.EIDOS_UNITS[id]=b.unit;FILES=b.files;SAVED.units[id]=b.state||{};S.units[id]=JSON.parse(JSON.stringify(SAVED.units[id]));return b.unit}}
  if(window.EIDOS_UNITS[id])return Promise.resolve(window.EIDOS_UNITS[id]);
  return new Promise((res,rej)=>{const s=document.createElement('script');s.charset='utf-8';s.src='units/'+id+'/unit.js?v='+VERSION;s.onload=()=>res(window.EIDOS_UNITS[id]);s.onerror=rej;document.head.append(s)});
}
async function openUnit(id,tab){
  if(unitId!==id){
    app.innerHTML='<p style="padding:24px">Loading…</p>';
    try{U=await loadUnit(id)}catch(e){app.innerHTML='<p style="padding:24px">This unit could not be loaded. <a href="#">Back to all units</a></p>';return}
    unitId=id;buildBoardShell();
  }
  cur=tab;render();
}
let FILES=null;               // name -> blob URL for boards imported through the admin page
const FILE=n=>FILES?(FILES[n]||''):'units/'+unitId+'/assets/'+n;
const A=k=>FILE(U.ASSETS[k].f);

/* ---------- board shell ---------- */
function buildBoardShell(){
  const m=U.meta;
  app.innerHTML=`<div class="wrap">
  
  <header><div><h1></h1><div class="sub"></div></div><nav id="tabs" role="tablist"></nav><button id="startBtn" type="button" class="startBtn">▶ Start lesson</button></header>
  <div class="tools">
    <div class="seg" role="toolbar" aria-label="Annotation tools">
      <button class="tool an" data-t="view" title="Click an exercise to zoom in">👆 View</button>
      <button class="tool an" data-t="pen">✏️ Pen</button>
      <button class="tool an" data-t="hl">🖍 Marker</button>
      <button class="tool an" data-t="ell">⭕ Circle</button>
      <button class="tool an" data-t="arrow">➜ Arrow</button>
      <button class="tool an" data-t="text">🔤 Text</button>
      <button class="tool an" data-t="erase">🧽 Eraser</button>
    </div>
    <div class="seg" id="colors" aria-label="Colour"></div>
    <button class="tool" id="undoBtn" type="button">↶ Undo</button>
    <button class="tool" id="clearBtn" type="button">🗑 Clear page</button>
    <button class="tool" id="wipeBtn" type="button" hidden>🧹 Clear everyone’s notes</button>
    <div class="seg" aria-label="Zoom"><button class="tool" id="zOut" type="button" aria-label="Zoom out">🔍−</button><button class="tool" id="zIn" type="button" aria-label="Zoom in">🔍+</button><button class="tool" id="zAll" type="button">⤢ Whole board</button></div>
    <button class="tool" id="fsBtn" type="button">⛶ Full screen</button>
    <button class="tool" id="freeReset" type="button" hidden>🧸 Put characters back</button>
    <button class="tool edit" id="editBtn" type="button" aria-pressed="false" hidden>✏️ Edit lesson</button>
  </div>
  <div class="tools editbar" id="editBar" hidden>
    <span class="lbl">EDIT MODE</span>
    <button class="tool" id="bgBtn" type="button">🖼 Background</button>
    <button class="tool" id="addKnownBtn" type="button">🧌 Add character</button>
    <button class="tool" id="addCharBtn" type="button">📤 Upload picture</button>
    <button class="tool" id="resetBtn" type="button">↺ Reset this lesson</button>
    <button class="tool save" id="saveBtn" type="button" disabled>💾 Save for everyone</button>
    <button class="tool" id="discardBtn" type="button" disabled>✖ Discard changes</button>
    <span class="status" id="editStatus">Paste a picture with Ctrl+V. Double-click a card to type in it where you click. Drag cards and characters anywhere. Click a card to edit its text, click a character to resize, swap or remove it.</span>
    <input type="file" id="bgFile" accept="image/*" hidden><input type="file" id="chFile" accept="image/*" multiple hidden>
    <div class="pick" id="pick" hidden></div>
  </div>
  <span class="hint" id="hint">Click an exercise to zoom in on it, then draw and write on top. Pinch or Ctrl + scroll to zoom, drag in 👆 View to move. Everything is saved for this lesson.</span>
  <div id="stage"><div id="cam"><div id="board"></div><svg id="ink" viewBox="0 0 1600 900" preserveAspectRatio="none" aria-label="Annotations"></svg></div><textarea id="txt" hidden rows="1" placeholder="Type…"></textarea></div>
</div>
<div id="zoom" hidden><div id="zoomInner"></div><div class="zbar"><button type="button" id="zPrev">← Previous</button><button type="button" id="zClose">Close (Esc)</button><button type="button" id="zNext">Next →</button></div></div>`;
  app.querySelector('h1').textContent=m.title;
  app.querySelector('.sub').textContent=(FB&&FB.lesson.name?FB.lesson.name+' · ':'')+(ROLE==='teacher'?'👩‍🏫 Teacher':'🎓 Student')+' · '+m.sub;
  const st=app.style;st.setProperty('--accent',m.accent);st.setProperty('--accent2',m.accent2);
  for(const k in m.card)st.setProperty('--'+k,m.card[k]);
  $('#stage').style.background=m.stage;
  const tabsEl=$('#tabs');
  TABS.forEach(t=>{if(t.id==='keys'&&ROLE!=='teacher')return;const b=document.createElement('button');b.type='button';b.setAttribute('role','tab');b.dataset.id=t.id;b.textContent=t.label;b.onclick=()=>{if(location.hash!=='#'+unitId+'/'+t.id)location.hash=unitId+'/'+t.id;else{cur=t.id;render()}};tabsEl.append(b)});
  initInk();initCamera();initEdit();refreshRole();$('#freeReset').onclick=freeReset;$('#startBtn').onclick=startLesson;$('#wipeBtn').onclick=wipeAll;initLive();
  new ResizeObserver(fit).observe($('#stage'));
}
function fit(){const st=$('#stage');if(!st)return;scale=st.clientWidth/BW;$('#board').style.transform='scale('+scale+')';camApply()}

/* ---------- cards ---------- */
const tb=(h,r,pl)=>'<table'+(pl?' class="pl"':'')+'>'+(h?'<tr>'+h.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr>':'')+r.map(q=>'<tr>'+q.map(x=>'<td>'+esc(x)+'</td>').join('')+'</tr>').join('')+'</table>';
function line(s){const m=s.match(/(youtube\.com\/watch\?v=[\w-]+)/);if(m)return '<p><a class="yt" href="https://www.'+m[1]+'" target="_blank" rel="noopener">▶ Open the video on YouTube</a></p>';return '<p>'+esc(s)+'</p>'}
function build(body){let h='';for(const i of body){
  if(typeof i==='string'){if(!i)h+='<p>&nbsp;</p>';else if(i[0]==='!')h+='<p><b>'+esc(i.slice(1))+'</b></p>';else h+=line(i)}
  else if(i[0]==='c'){const a=i[1];if(a.length>8){const k=Math.ceil(a.length/2);h+=tb(null,a.slice(0,k).map((x,j)=>[x,a[k+j]||'']),1)}else a.forEach(x=>h+=line(x))}
  else if(i[0]==='t')h+=tb(i[1],i[2]);
  else if(i[0]==='m')h+=tb(null,i[1].map((x,j)=>[x,i[2][j]]));
  else if(i[0]==='s')h+='<div class="pic">'+i[1]+'</div>';
  else if(i[0]==='w'){for(let j=0;j<i[1];j++)h+='<p>______________________________________</p>'}}
  return h}
/* owner-edited text: keep only simple formatting */
const OK_TAGS=new Set(['P','B','STRONG','I','EM','U','BR','TABLE','TBODY','THEAD','TR','TD','TH','SPAN','DIV','A','UL','OL','LI']);
function clean(html){const d=new DOMParser().parseFromString('<div>'+html+'</div>','text/html').body.firstChild;
  (function walk(n){for(const c of [...n.childNodes]){if(c.nodeType===1){if(!OK_TAGS.has(c.tagName)){c.replaceWith(...c.childNodes);continue}
    for(const a of [...c.attributes]){const ok=(a.name==='class'&&/^(pl|yt)$/.test(a.value))||(c.tagName==='A'&&a.name==='href'&&/^https?:\/\//.test(a.value));if(!ok)c.removeAttribute(a.name)}
    if(c.tagName==='A'){c.setAttribute('target','_blank');c.setAttribute('rel','noopener')}walk(c)}else if(c.nodeType!==3)c.remove()}})(d);
  return d.innerHTML}
function cardEl(c,sec,i){const [kd,ti,body]=c;const el=document.createElement('div');el.className='card '+kd;
  const ov=(unitState().text[cur]||{})[i];
  /* listening scripts: only the title and the recording are shown, never the text */
  const au=U.AUDIO[sec+'.'+i]||(/^Listening: Teacher Script/.test(ti)?U.AUDIO[sec]:null),auSrc=au&&(/^data:/.test(au)?au:FILE(au));
  const audioOnly=!!au,auTitle=ti.replace(/\s*\((Teacher Reads|Voice Message)\)/g,'').replace(/:\s*Teacher Script/,'');
  el.innerHTML='<div class="hd"><span class="a"></span>'+(c.ex?'<span class="m">ex '+c.ex+'</span>':'')+'</div><div class="bd">'+(ov&&ov.bd!=null?clean(ov.bd):(audioOnly?'':build(body)))+'</div>';
  el.querySelector('.a').textContent=ov&&ov.a!=null?ov.a:(audioOnly?auTitle:ti);
  if(au){const bd=el.querySelector('.bd');const n=document.createElement('span');n.className='badge';n.textContent=U.AUDIO_NOTE[sec+'.'+i]||U.AUDIO_NOTE[sec]||'🔊 Audio';const a=document.createElement('audio');a.controls=true;a.preload='none';a.src=auSrc;a.dataset.keep='1';bd.append(n,a);n.dataset.keep='1'}
  return el}

/* ---------- render ---------- */
function defaultLayout(cards,dims){
  const hs=dims.map(d=>d.h);let best=null;
  for(let k=1;k<cards.length;k++){const a=hs.slice(0,k).reduce((s,x)=>s+x,0),b=hs.slice(k).reduce((s,x)=>s+x,0);const v=Math.max(a+GAP*(k-1),b);if(!best||v<best[0])best=[v,k]}
  const k=best?best[1]:cards.length;const colH=c=>{const g=c?dims.slice(k):dims.slice(0,k);return g.reduce((s,d)=>s+d.h,0)};
  const sc=Math.min(0.62,(BH-2*PAD-GAP*Math.max(k,cards.length-k))/Math.max(colH(0),colH(1)));
  const pos=[];let y0=PAD,y1=PAD;dims.forEach((d,i)=>{const left=i<k;const w=d.w*sc,h=d.h*sc;pos.push({x:left?PAD:BW-PAD-w,y:left?y0:y1,s:sc});if(left)y0+=h+GAP;else y1+=h+GAP});return pos}
/* many cards: fill several columns in lesson order, as big as the board allows */
function gridLayout(dims,side){side=side||0;const avail=BH-2*PAD,maxW=Math.max(...dims.map(d=>d.w));let best=null;
  const fits=(s,k)=>{let col=0,y=0;for(const d of dims){const h=d.h*s;if(y>0&&y+h>avail){col++;y=0}if(h>avail)return false;y+=h+GAP}return col<k};
  for(let k=2;k<=8;k++){const colW=(BW-side-2*PAD-GAP*(k-1))/k;let lo=0,hi=Math.min(0.62,colW/maxW);if(fits(hi,k))lo=hi;else for(let n=0;n<30;n++){const m=(lo+hi)/2;if(fits(m,k))lo=m;else hi=m}
    if(lo>0&&(!best||lo>best.s+1e-4))best={s:lo,k,colW}}
  const {s,k,colW}=best,pos=[];let col=0,y=0;const used=[];
  dims.forEach(d=>{const h=d.h*s;if(y>0&&y+h>avail){col++;y=0}pos.push({x:PAD+col*(colW+GAP)+(colW-d.w*s)/2,y:PAD+y,s});y+=h+GAP});
  const cols=col+1,shift=(BW-side-2*PAD-(cols*colW+(cols-1)*GAP))/2;pos.forEach(p=>p.x+=shift);return pos}
function charFor(tab,les,i){if(U.meta.grid){const sk=((U.meta.side||{}).chars||{})[tab.id],pool=U.POOL.filter(k=>k!==sk);if(!pool.length)return null;
    const n=les.length,m=Math.min(pool.length,n);for(let j=0;j<m;j++)if(Math.round(j*(n-1)/Math.max(1,m-1))===i)return pool[(j+tab.sec)%pool.length];return null}
  if(tab.id==='keys'||les[i][0]==='t'||!U.POOL.length)return null;let n=0;for(let j=0;j<i;j++)if(les[j][0]!=='t')n++;return U.POOL[(n+tab.sec*3)%U.POOL.length]}
const LESSONS=()=>U.L.map(([t,rs])=>{let k=0;rs.forEach(c=>{if(c[0]==='x')c.ex=++k});return {title:t,cards:rs}});

function render(){
  if(!U)return;
  const us=unitState();inkLoad();camReset(false);
  const board=$('#board');board.innerHTML='';select(null);const frb=$('#freeReset');if(frb)frb.hidden=true;
  const tab=TABS.find(t=>t.id===cur),les=LESSONS()[tab.sec];
  document.querySelectorAll('#tabs button').forEach(b=>b.setAttribute('aria-selected',b.dataset.id===cur));
  const scene=document.createElement('div');scene.className='scene';board.append(scene);
  const bgUrl=us.bg[cur]?FILE('pics/'+us.bg[cur]+'.png'):(U.BGS[cur]?A(U.BGS[cur]):null);
  if(bgUrl){const im=document.createElement('img');im.className='bg';im.alt='';im.src=bgUrl;if(cur==='keys'&&!us.bg[cur])im.style.filter=U.meta.keysFilter;scene.append(im);
    if(U.ASSETS.logo&&!U.meta.grid)pendingLogo=true}
  else if(U.meta.scene&&(!U.meta.grid||cur==="keys")){const d=document.createElement('div');d.className='sceneLabel';d.innerHTML='<span class="e"></span><span class="t"></span><span class="s"></span>';
    const tl=U.meta.scene[tab.sec]||U.meta.scene[1];d.querySelector('.e').textContent=U.meta.emoji||'';d.querySelector('.t').textContent=U.meta.film;d.querySelector('.s').textContent=tl;scene.append(d)}
  const els=les.cards.map((c,i)=>cardEl(c,tab.sec,i));const meas=document.createElement('div');meas.style.cssText='position:absolute;left:0;top:0;width:3000px;visibility:hidden';
  meas.style.cssText+=';'+app.style.cssText;document.body.append(meas);els.forEach(e=>meas.append(e));
  const dims=els.map(e=>({w:e.offsetWidth,h:e.offsetHeight}));els.forEach((e,i)=>e.style.width=dims[i].w+'px');meas.remove();
  let pos;if(tab.id==='keys'){const sw=U.meta.grid&&U.meta.side?U.meta.side.w:0,s=Math.min(1,(BH-2*PAD)/dims[0].h,(BW-sw-2*PAD)/dims[0].w);pos=[{x:(BW-sw-dims[0].w*s)/2,y:PAD,s}]}
  else{const inn=U.INNER[cur];if(inn){const rest=dims.filter((d,j)=>j!==inn.i);const pr=defaultLayout(rest,rest);const s=pr[0].s;pos=[];let k=0;dims.forEach((d,j)=>{if(j===inn.i)pos.push({x:inn.x,y:inn.y,s});else pos.push(pr[k++])})}else pos=U.meta.grid?gridLayout(dims,U.meta.side?U.meta.side.w:0):defaultLayout(les.cards,dims)}
  const saved=us.pos[cur]||{};zoomList=[];
  els.forEach((e,i)=>{const p=Object.assign({},pos[i],saved[i]||{});const it=document.createElement('div');it.className='item cardItem';it.dataset.i=i;
    it.style.left=p.x+'px';it.style.top=p.y+'px';
    const sl=document.createElement('div');sl.className='slot';sl.style.transform='scale('+p.s+')';sl.append(e);it.append(sl);
    const iw=dims[i].w*p.s,ih=dims[i].h*p.s;it.style.width=iw+'px';it.style.height=ih+'px';
    const cc=(us.cc[cur]||{})[i];const ck=cc&&'k' in cc?cc.k:charFor(tab,les.cards,i);
    if(ck&&U.ASSETS[ck]){const a=U.ASSETS[ck];const G=U.meta.grid,ch=cc&&cc.h?cc.h:(G?Math.min(120,Math.max(80,ih*0.5)):Math.max(90,Math.min(170,ih*0.8))),cw=ch*a.w/a.h,leftCol=p.x+iw/2<BW/2;
      const ci=document.createElement('img');ci.className='cardChar';ci.alt='';ci.src=A(ck);ci.style.height=ch+'px';
      ci.style.left=(cc&&cc.l!=null?cc.l:(G?iw-cw*0.6:(leftCol?iw-cw*0.15:-cw*0.93)))+'px';ci.style.top=(cc&&cc.t!=null?cc.t:(G?ih-ch*0.8:ih-ch*0.92))+'px';ci.dataset.k=ck;it.append(ci);bindCardChar(ci,it,i,ck)}
    board.append(it);zoomList.push(i);bindCard(it,i,p,e)});
  if(U.meta.grid&&U.meta.side){const sd=U.meta.side,w=sd.w,box=document.createElement('div');box.className='sideStrip';box.style.cssText='position:absolute;right:0;top:0;bottom:0;width:'+w+'px';
    if(U.ASSETS.logo){const lg=document.createElement('img');lg.className='sideLogo';lg.alt=U.meta.film||'';lg.src=A('logo');box.append(lg)}
    const ck=(sd.chars||{})[cur];if(ck&&U.ASSETS[ck]){const ci=document.createElement('img');ci.className='sideChar';ci.alt='';ci.src=A(ck);ci.dataset.k=ck;box.append(ci)}
    scene.append(box)}
  (us.chars[cur]||[]).forEach((ch,j)=>addCharEl(ch,j));
  if(pendingLogo){pendingLogo=false;addLogo(us)}
}
const FKEY=()=>'eidos-free-'+unitId+'-'+cur;
function freeChars(){const board=$('#board');let saved={};try{saved=JSON.parse(lsGet(FKEY())||'{}')}catch(e){}
  [...board.querySelectorAll('.cardChar,.sideChar')].forEach((im,j)=>{const a=U.ASSETS[im.dataset.k];if(!a)return;const id='c'+j;let x,y,w;
    if(im.classList.contains('cardChar')){const it=im.closest('.item'),h=parseFloat(im.style.height);w=h*a.w/a.h;x=parseFloat(it.style.left)+parseFloat(im.style.left);y=parseFloat(it.style.top)+parseFloat(im.style.top)}
    else{const W=U.meta.side.w;w=Math.min(W-36,BH*0.6*a.w/a.h);const h=w*a.h/a.w;x=BW-W+(W-w)/2;y=BH-10-h}
    const d=document.createElement('div');d.className='item freeChar';d.title='Drag me';d.dataset.fid=id;
    const p=saved[id]||{x,y};d.style.cssText='left:'+p.x+'px;top:'+p.y+'px;width:'+w+'px;z-index:45';
    const ni=document.createElement('img');ni.src=im.src;ni.alt='';d.append(ni);im.remove();board.append(d);drag(d,id)});
  /* pictures placed in edit mode move too */
  [...board.querySelectorAll('.item.char')].forEach((d,j)=>{const id='s'+j;d.classList.add('freeChar');d.dataset.fid=id;d.title='Drag me';d.style.zIndex=45;if(saved[id]){d.style.left=saved[id].x+'px';d.style.top=saved[id].y+'px'}drag(d,id)});
  function drag(d,id){
    let id0=null,sx,sy,o;
    d.addEventListener('pointerdown',e=>{if(tool!=='view'||editing||e.button>0)return;e.stopPropagation();e.preventDefault();id0=e.pointerId;d.setPointerCapture(id0);sx=e.clientX;sy=e.clientY;o={x:parseFloat(d.style.left),y:parseFloat(d.style.top)};d.classList.add('dragging')});
    d.addEventListener('pointermove',e=>{if(e.pointerId!==id0)return;const kk=eff();d.style.left=o.x+(e.clientX-sx)/kk+'px';d.style.top=o.y+(e.clientY-sy)/kk+'px';d.dispatchEvent(new CustomEvent('fmove',{bubbles:true,detail:{id,x:Math.round(parseFloat(d.style.left)),y:Math.round(parseFloat(d.style.top))}}))});
    const end=e=>{if(e.pointerId!==id0)return;id0=null;d.classList.remove('dragging');saved[id]={x:Math.round(parseFloat(d.style.left)),y:Math.round(parseFloat(d.style.top))};d.dispatchEvent(new CustomEvent('fend',{bubbles:true,detail:{id,x:saved[id].x,y:saved[id].y}}));lsSet(FKEY(),JSON.stringify(saved))};
    d.addEventListener('pointerup',end);d.addEventListener('pointercancel',end);d.addEventListener('click',e=>e.stopPropagation())}
  const rb=$('#freeReset');if(rb)rb.hidden=false}
function freeReset(){try{localStorage.removeItem(FKEY())}catch(e){}render()}
/* the film title (logo): movable and resizable in edit mode */
let pendingLogo=false;
function addLogo(us){const a=U.ASSETS.logo,o=us.logo[cur]||{};if(o.hidden)return;
  const w=o.w||300,it=document.createElement('div');it.className='item logoItem';it.style.width=w+'px';
  it.style.left=(o.x!=null?o.x:(BW-w)/2)+'px';it.style.top=(o.y!=null?o.y:10)+'px';
  const im=document.createElement('img');im.alt=U.meta.title.split(' · ')[0];im.src=A('logo');it.append(im);$('#board').append(it);
  const save=()=>{us.logo[cur]={x:Math.round(parseFloat(it.style.left)),y:Math.round(parseFloat(it.style.top)),w:Math.round(parseFloat(it.style.width))}};
  const size=f=>{const nw=Math.max(80,Math.min(1200,parseFloat(it.style.width)*f));const c=parseFloat(it.style.left)+parseFloat(it.style.width)/2;it.style.width=nw+'px';it.style.left=(c-nw/2)+'px';save();markDirty()};
  dragger(it,{start:()=>({x:parseFloat(it.style.left),y:parseFloat(it.style.top)}),move:(o2,dx,dy)=>{it.style.left=o2.x+dx+'px';it.style.top=o2.y+dy+'px'},end:save,
    click:()=>select(it,[['−',()=>size(0.85)],['+',()=>size(1.18)],['✕',()=>{us.logo[cur]={hidden:true};markDirty();render()}]])})}

/* ---------- editing: pointer helpers ---------- */
const eff=()=>$('#board').getBoundingClientRect().width/BW;
function dragger(el,{start,move,end,click}){let sx,sy,id=null,moved=false,o;
  el.addEventListener('pointerdown',e=>{if(e.button>0)return;if(!editing){return}if(e.target.closest('[contenteditable="true"],.ctl,audio,a'))return;e.stopPropagation();e.preventDefault();id=e.pointerId;el.setPointerCapture(id);sx=e.clientX;sy=e.clientY;moved=false;o=start()});
  el.addEventListener('pointermove',e=>{if(e.pointerId!==id)return;const k=eff(),dx=(e.clientX-sx)/k,dy=(e.clientY-sy)/k;if(!moved&&Math.hypot(e.clientX-sx,e.clientY-sy)<5)return;moved=true;el.classList.add('dragging');move(o,dx,dy)});
  el.addEventListener('pointerup',e=>{if(e.pointerId!==id)return;id=null;el.classList.remove('dragging');if(moved){end();markDirty()}else click&&click()});
  el.addEventListener('pointercancel',()=>{id=null;el.classList.remove('dragging')})}
function bindCard(it,i,p,card){
  it.addEventListener('click',e=>{if(editing||e.target.closest('audio,a'))return;focusEl(it)});
  it.addEventListener('pointerdown',e=>{if(!e.target.closest('.ctl'))lastPt={card,x:e.clientX,y:e.clientY}},true);
  it.addEventListener('dblclick',e=>{if(!editing||card.querySelector('[contenteditable="true"]'))return;e.preventDefault();editText(card,i,{x:e.clientX,y:e.clientY})});
  dragger(it,{start:()=>({x:parseFloat(it.style.left),y:parseFloat(it.style.top)}),
    move:(o,dx,dy)=>{it.style.left=o.x+dx+'px';it.style.top=o.y+dy+'px'},
    end:()=>{const us=unitState();(us.pos[cur]=us.pos[cur]||{})[i]={x:Math.round(parseFloat(it.style.left)),y:Math.round(parseFloat(it.style.top)),s:p.s}},
    click:()=>select(it,[['✍️ Edit text',()=>editText(card,i)],['🔍−',()=>resizeCard(it,i,p,1/1.1)],['🔍+',()=>resizeCard(it,i,p,1.1)]])});
}
function resizeCard(it,i,p,f){p.s=Math.max(.2,Math.min(1.4,p.s*f));const us=unitState();(us.pos[cur]=us.pos[cur]||{})[i]={x:Math.round(parseFloat(it.style.left)),y:Math.round(parseFloat(it.style.top)),s:+p.s.toFixed(3)};markDirty();render()}
let lastPt=null;
/* put the cursor where the teacher clicked (or double-clicked) on the card */
function caretAt(card,pt){if(!pt)return false;let r=null;
  if(document.caretRangeFromPoint)r=document.caretRangeFromPoint(pt.x,pt.y);
  else if(document.caretPositionFromPoint){const c=document.caretPositionFromPoint(pt.x,pt.y);if(c){r=document.createRange();r.setStart(c.offsetNode,c.offset)}}
  if(!r||!card.contains(r.startContainer))return false;const host=(r.startContainer.nodeType===1?r.startContainer:r.startContainer.parentNode).closest('[contenteditable="true"]');if(!host)return false;
  host.focus();const sel=getSelection();sel.removeAllRanges();r.collapse(true);sel.addRange(r);return true}
function editText(card,i,pt){select(null);const a=card.querySelector('.a'),bd=card.querySelector('.bd');
  bd.querySelectorAll('[data-keep]').forEach(x=>x.remove());
  for(const n of [a,bd]){n.contentEditable='true'}
  if(!caretAt(card,pt||(lastPt&&lastPt.card===card?lastPt:null)))a.focus();
  $('#editStatus').textContent='Editing text. Click outside the card when you are done.';
  const done=e=>{if(e&&card.contains(e.target))return;document.removeEventListener('pointerdown',done,true);
    a.contentEditable='false';bd.contentEditable='false';const us=unitState();(us.text[cur]=us.text[cur]||{})[i]={a:a.textContent,bd:clean(bd.innerHTML)};markDirty();render()};
  setTimeout(()=>document.addEventListener('pointerdown',done,true),0)}
function bindCardChar(ci,it,i,ck){
  dragger(ci,{start:()=>({l:parseFloat(ci.style.left),t:parseFloat(ci.style.top)}),
    move:(o,dx,dy)=>{ci.style.left=o.l+dx+'px';ci.style.top=o.t+dy+'px'},
    end:()=>{const us=unitState();const a=us.chars[cur]=us.chars[cur]||[];
      a.push({k:ck,x:Math.round(parseFloat(it.style.left)+parseFloat(ci.style.left)),y:Math.round(parseFloat(it.style.top)+parseFloat(ci.style.top)),w:Math.round(ci.getBoundingClientRect().width/eff())});
      (us.cc[cur]=us.cc[cur]||{})[i]={k:null};setTimeout(render,0)},
    click:()=>select(ci,[['−',()=>{ci.style.height=parseFloat(ci.style.height)*0.85+'px';saveCC(ci,i,ck);markDirty()}],['+',()=>{ci.style.height=parseFloat(ci.style.height)*1.18+'px';saveCC(ci,i,ck);markDirty()}],
      ['⇄',()=>{const pool=U.POOL;const n=pool[(pool.indexOf(ck)+1)%pool.length];const us=unitState();(us.cc[cur]=us.cc[cur]||{})[i]={k:n};markDirty();render()}],
      ['✕',()=>{const us=unitState();(us.cc[cur]=us.cc[cur]||{})[i]={k:null};markDirty();render()}]],it)});
}
function saveCC(ci,i,ck){const us=unitState();(us.cc[cur]=us.cc[cur]||{})[i]={k:ck,l:Math.round(parseFloat(ci.style.left)),t:Math.round(parseFloat(ci.style.top)),h:Math.round(parseFloat(ci.style.height))}}
function addCharEl(ch,j){const it=document.createElement('div');it.className='item char';it.style.left=ch.x+'px';it.style.top=ch.y+'px';it.style.width=ch.w+'px';
  const box=document.createElement('div');box.className='cropBox';const im=document.createElement('img');im.alt='';im.src=charSrc(ch);box.append(im);it.append(box);$('#board').append(it);
  const fitCrop=()=>{const c=ch.crop;if(!c||!im.naturalWidth){box.style.height='';im.style.cssText='';return}
    const fw=ch.w/(c.r-c.l),fh=fw*im.naturalHeight/im.naturalWidth;box.style.height=(fh*(c.b-c.t))+'px';im.style.cssText='position:absolute;max-width:none;width:'+fw+'px;left:'+(-c.l*fw)+'px;top:'+(-c.t*fh)+'px'};
  if(im.complete)fitCrop();else im.onload=fitCrop;
  const list=()=>unitState().chars[cur];
  dragger(it,{start:()=>({x:ch.x,y:ch.y}),move:(o,dx,dy)=>{it.style.left=o.x+dx+'px';it.style.top=o.y+dy+'px'},
    end:()=>{ch.x=Math.round(parseFloat(it.style.left));ch.y=Math.round(parseFloat(it.style.top))},
    click:()=>select(it,[['−',()=>{ch.w=Math.round(Math.max(40,ch.w*0.85));it.style.width=ch.w+'px';fitCrop();markDirty()}],['+',()=>{ch.w=Math.round(Math.min(1400,ch.w*1.18));it.style.width=ch.w+'px';fitCrop();markDirty()}],
      ['✂️',()=>openCrop(ch)],['⧉',()=>{dupChar(ch)}],
      ['⤒',()=>{const a=list();a.push(a.splice(a.indexOf(ch),1)[0]);markDirty();render()}],['✕',()=>{const a=list();a.splice(a.indexOf(ch),1);markDirty();render()}]])});
  if(lastAdded&&lastAdded===ch){lastAdded=null;setTimeout(()=>it.querySelector('.cropBox')&&select(it,[['−',()=>{ch.w=Math.round(Math.max(40,ch.w*0.85));it.style.width=ch.w+'px';fitCrop();markDirty()}],['+',()=>{ch.w=Math.round(Math.min(1400,ch.w*1.18));it.style.width=ch.w+'px';fitCrop();markDirty()}],['✂️',()=>openCrop(ch)],['⧉',()=>{dupChar(ch)}],['⤒',()=>{const a=list();a.push(a.splice(a.indexOf(ch),1)[0]);markDirty();render()}],['✕',()=>{const a=list();a.splice(a.indexOf(ch),1);markDirty();render()}]]),0)}
  it.addEventListener('pointerdown',()=>{if(editing)copied=ch})}
const charSrc=ch=>ch.k?(U.ASSETS[ch.k]?A(ch.k):''):FILE('pics/'+ch.id+'.png');
let copied=null,lastAdded=null;
function addPic(ch){const us=unitState();const a=us.chars[cur]=us.chars[cur]||[];a.push(ch);lastAdded=ch;markDirty();render()}
function dupChar(ch){const c=JSON.parse(JSON.stringify(ch));c.x+=40;c.y+=40;addPic(c);copied=c}
const PIC_MARK='[Eidos board picture]';
/* crop: drag the frame or its corners, then Apply */
function openCrop(ch){select(null);const ov=document.createElement('div');ov.className='cropOv';ov.innerHTML='<div class="cropStage"><img alt=""><div class="cropRect"><i data-h="nw"></i><i data-h="ne"></i><i data-h="sw"></i><i data-h="se"></i></div></div><div class="cropBar"><span>✂️ Drag the frame or its corners</span><button type="button" data-a="reset">Show whole picture</button><button type="button" data-a="cancel">Cancel</button><button type="button" data-a="ok" class="ok">Apply</button></div>';
  document.body.append(ov);const img=ov.querySelector('img'),rect=ov.querySelector('.cropRect'),stage=ov.querySelector('.cropStage');img.src=charSrc(ch);
  let c=Object.assign({l:0,t:0,r:1,b:1},ch.crop||{});
  const draw=()=>{rect.style.left=c.l*100+'%';rect.style.top=c.t*100+'%';rect.style.width=(c.r-c.l)*100+'%';rect.style.height=(c.b-c.t)*100+'%'};draw();
  let drag=null;
  stage.addEventListener('pointerdown',e=>{const h=e.target.dataset.h||(e.target===rect?'move':null);if(!h)return;e.preventDefault();stage.setPointerCapture(e.pointerId);drag={h,x:e.clientX,y:e.clientY,c:Object.assign({},c)}});
  stage.addEventListener('pointermove',e=>{if(!drag)return;const r=img.getBoundingClientRect(),dx=(e.clientX-drag.x)/r.width,dy=(e.clientY-drag.y)/r.height,o=drag.c,m=0.03,cl=(v,a,b)=>Math.max(a,Math.min(b,v));
    if(drag.h==='move'){const w=o.r-o.l,h=o.b-o.t;c.l=cl(o.l+dx,0,1-w);c.t=cl(o.t+dy,0,1-h);c.r=c.l+w;c.b=c.t+h}
    else{if(drag.h.includes('w'))c.l=cl(o.l+dx,0,o.r-m);if(drag.h.includes('e'))c.r=cl(o.r+dx,o.l+m,1);if(drag.h.includes('n'))c.t=cl(o.t+dy,0,o.b-m);if(drag.h.includes('s'))c.b=cl(o.b+dy,o.t+m,1)}draw()});
  stage.addEventListener('pointerup',()=>drag=null);
  ov.querySelector('.cropBar').onclick=e=>{const a=e.target.dataset.a;if(!a)return;
    if(a==='reset'){c={l:0,t:0,r:1,b:1};draw();return}
    if(a==='ok'){const old=ch.crop||{l:0,t:0,r:1,b:1},full=ch.w/(old.r-old.l);const whole=c.l<=0.001&&c.t<=0.001&&c.r>=0.999&&c.b>=0.999;
      ch.w=Math.round(full*(c.r-c.l));if(whole)delete ch.crop;else ch.crop={l:+c.l.toFixed(4),t:+c.t.toFixed(4),r:+c.r.toFixed(4),b:+c.b.toFixed(4)};copied=ch;markDirty();render()}
    ov.remove()};
  ov.addEventListener('keydown',e=>{if(e.key==='Escape')ov.remove()})}
function select(el,actions,host){
  document.querySelectorAll('.sel').forEach(x=>x.classList.remove('sel'));document.querySelectorAll('.ctl').forEach(x=>x.remove());
  if(!el||selected===el){selected=null;return}selected=el;el.classList.add('sel');
  const c=document.createElement('div');c.className='ctl';
  for(const [t,f] of actions){const b=document.createElement('button');b.type='button';b.textContent=t;b.addEventListener('pointerdown',e=>e.stopPropagation());b.onclick=e=>{e.stopPropagation();f()};c.append(b)}
  if(host){c.style.left=el.style.left;c.style.top=(parseFloat(el.style.top)-50)+'px';host.append(c)}else el.append(c)}

function setEditing(on){editing=on&&canEdit;const b=$('#editBtn');if(b)b.setAttribute('aria-pressed',editing);
  $('#editBar').hidden=!editing;$('#stage').classList.toggle('editing',editing);document.querySelector('.wrap').classList.toggle('editing',editing);
  if(editing){setTool('view');camReset(true)}select(null)}
function initEdit(){
  $('#editBtn').onclick=()=>setEditing(!editing);
  $('#saveBtn').onclick=save;
  $('#discardBtn').onclick=async()=>{if(!dirty)return;if(!await ask('Discard all unsaved changes?','Discard'))return;S=JSON.parse(JSON.stringify(SAVED));dirty=false;$('#saveBtn').disabled=true;$('#discardBtn').disabled=true;$('#editStatus').textContent='Changes discarded.';render()};
  $('#resetBtn').onclick=async()=>{if(!await ask('Put every card and picture of this lesson back to the original layout and text?','Reset'))return;const us=unitState();for(const k of ['pos','cc','chars','bg','text','logo'])delete us[k][cur];markDirty();render()};
  $('#addKnownBtn').onclick=()=>{const pk=$('#pick');if(!pk.hidden){pk.hidden=true;return}pk.innerHTML='';
    Object.keys(U.ASSETS).filter(k=>!/^(bg|logo)/.test(k)).forEach(k=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-label','Add '+k.replace(/_/g,' '));
      const im=document.createElement('img');im.src=A(k);im.alt='';b.append(im);
      b.onclick=()=>{const us=unitState();const a=us.chars[cur]=us.chars[cur]||[];const as=U.ASSETS[k];const w=Math.round(Math.min(320,260*as.w/as.h));
        a.push({k,x:Math.round((BW-w)/2)+a.length*30,y:300+a.length*20,w});pk.hidden=true;markDirty();render()};pk.append(b)});pk.hidden=false};
  $('#bgBtn').onclick=()=>$('#bgFile').click();$('#addCharBtn').onclick=()=>$('#chFile').click();
  const up=async f=>{if(!assetsNs)throw {code:'unavailable'};const r=await assetsNs.upload(f,f.type?undefined:{type:'image/png'});return r.id};
  $('#bgFile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;$('#editStatus').textContent='Uploading…';
    try{const id=await up(f);unitState().bg[cur]=id;markDirty();render()}catch(err){toast('Upload failed'+(err&&err.code?' ('+err.code+')':'')+'.')}};
  document.addEventListener('copy',e=>{if(!editing||!copied||!selected)return;const t=e.target;if(t&&(t.isContentEditable||/^(INPUT|TEXTAREA)$/.test(t.tagName)))return;e.preventDefault();e.clipboardData.setData('text/plain',PIC_MARK);$('#editStatus').textContent='Picture copied. Press Ctrl+V to paste it.'});
  document.addEventListener('paste',async e=>{if(!canEdit||!unitId)return;const t=e.target;if(t&&(t.isContentEditable||/^(INPUT|TEXTAREA)$/.test(t.tagName)))return;
    if(copied&&e.clipboardData&&e.clipboardData.getData('text/plain')===PIC_MARK){e.preventDefault();if(!editing)setEditing(true);dupChar(copied);return}
    const items=[...((e.clipboardData&&e.clipboardData.items)||[])],it=items.find(x=>x.kind==='file'&&/^image\//.test(x.type));
    if(it){e.preventDefault();const f=it.getAsFile();if(!editing)setEditing(true);$('#editStatus').textContent='Uploading the picture…';
      try{const id=await up(f);const w=Math.min(420,BW*0.3);addPic({id,x:Math.round((BW-w)/2),y:220,w:Math.round(w)});$('#editStatus').textContent='Picture added. Drag it, resize with − +, crop with ✂️, then 💾 Save.'}catch(err){toast('Could not add the picture'+(err&&err.code?' ('+err.code+')':'')+'.')}return}
    if(editing&&copied){e.preventDefault();dupChar(copied)}});
  $('#chFile').onchange=async e=>{const fs=[...e.target.files];e.target.value='';if(!fs.length)return;$('#editStatus').textContent='Uploading…';
    const us=unitState();const a=us.chars[cur]=us.chars[cur]||[];
    for(const [k,f] of fs.entries()){try{const id=await up(f);a.push({id,x:620+k*60,y:330+k*30,w:260})}catch(err){toast('Upload failed'+(err&&err.code?' ('+err.code+')':'')+'.')}}
    markDirty();render()};
  $('#board').addEventListener('pointerdown',e=>{if(editing&&!e.target.closest('.item,.ctl'))select(null)});
  refreshRole();
}

/* ---------- annotation layer ---------- */
let live=null,pts=[],startP=null,txtAt=null;
const KEY=()=>'eidos-ink-'+unitId+'-'+cur;
const INK=new Map();          // id -> {tab,h,by,t}: every note of this lesson
const ser=new XMLSerializer(),round=s=>s.replace(/(\d+\.\d)\d+/g,'$1').replace(/ xmlns="[^"]*"/,'');
let inkUid=0;const newId=()=>Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7)+(inkUid++);
const mine=n=>!FB||n.getAttribute('data-by')===FB.uid;
const canTouch=n=>!FB||ROLE==='teacher'||mine(n);
function inkSave(){
  if(!FB){inkPut(KEY(),$('#ink').innerHTML);return}
  const ink=$('#ink'),seen=new Set();
  for(const n of [...ink.children]){
    if(!n.getAttribute('data-i')){n.setAttribute('data-i',newId());n.setAttribute('data-by',FB.uid);n.setAttribute('data-t',Date.now())}
    const id=n.getAttribute('data-i');seen.add(id);if(!mine(n))continue;
    const h=round(ser.serializeToString(n)),old=INK.get(id);
    if(!old||old.h!==h){const d={tab:cur,h,t:+n.getAttribute('data-t')||Date.now()};INK.set(id,{...d,by:FB.uid});FB.putInk(id,d).catch(()=>toast('A note could not be saved. Check the internet connection.'))}
  }
  for(const [id,d] of INK){if(d.tab!==cur||seen.has(id))continue;
    if(d.by===FB.uid||ROLE==='teacher'){INK.delete(id);FB.delInk(id).catch(()=>{})}
  }
}
const OKT={path:1,ellipse:1,text:1,tspan:1},ALA=new Set(['d','cx','cy','rx','ry','x','y','dy','fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','opacity','style','data-i','data-by','data-t']);
function cleanInk(h){let doc;try{doc=new DOMParser().parseFromString('<svg xmlns="'+NS+'">'+h+'</svg>','image/svg+xml')}catch(e){return null}
  const root=doc.documentElement.firstElementChild;if(!root)return null;
  const ok=n=>{if(!OKT[n.localName])return false;for(const a of [...n.attributes]){if(!ALA.has(a.name)||/url\(|javascript|expression/i.test(a.value))n.removeAttribute(a.name)}for(const c of [...n.children])if(!ok(c))c.remove();return true};
  return ok(root)?document.importNode(root,true):null}
function inkPlace(id,d){const ink=$('#ink');if(!ink)return;const n=cleanInk(d.h);if(!n)return;n.setAttribute('data-i',id);n.setAttribute('data-by',d.by||'');n.setAttribute('data-t',d.t||0);
  const old=[...ink.children].find(x=>x.getAttribute('data-i')===id);if(old){if(round(ser.serializeToString(old))!==d.h)old.replaceWith(n);return}
  const t=+d.t||0,after=[...ink.children].find(x=>(+x.getAttribute('data-t')||0)>t&&x.getAttribute('data-i'));if(after)ink.insertBefore(n,after);else ink.append(n)}
function inkRemote(changes){for(const c of changes){if(typeof c.h!=='string'||typeof c.tab!=='string')continue;
  if(c.type==='removed'){INK.delete(c.id);if(c.tab===cur){const n=[...$('#ink').children].find(x=>x.getAttribute('data-i')===c.id);if(n)n.remove()}}
  else{INK.set(c.id,{tab:c.tab,h:c.h,by:c.by,t:c.t});if(c.tab===cur)inkPlace(c.id,c)}}}
/* notes from before the editor's last "clear everyone's notes" are wiped when the board opens */
const RKEY=()=>'eidos-inkreset-'+unitId;
function wipeLocal(stamp){for(const st of ['localStorage','sessionStorage'])try{const L=window[st];for(let k=L.length-1;k>=0;k--){const n=L.key(k);if(n&&n.startsWith('eidos-ink-'+unitId+'-'))L.removeItem(n)}}catch(e){}lsSet(RKEY(),String(stamp))}
function inkLoad(){if(FB){$('#ink').innerHTML='';[...INK].filter(([,d])=>d.tab===cur).sort((a,b)=>(a[1].t||0)-(b[1].t||0)).forEach(([id,d])=>inkPlace(id,d));closeText(false);return}
  $('#ink').innerHTML=inkGet(KEY())||'';closeText(false)}
async function wipeAll(){if(!canEdit)return;
  if(!await ask('Clear the drawings and notes of every teacher and student on every lesson of this board? Open boards reload now; the others are cleared the next time they open.'+(dirty?' Your unsaved lesson changes will be lost.':''),'Clear for everyone'))return;
  if(!artifactNs){toast('Clearing is not available in this view.');return}
  const stamp=Date.now(),base=JSON.parse(JSON.stringify(SAVED));base.inkReset=Object.assign({},base.inkReset,{[unitId]:stamp});
  wipeLocal(stamp);$('#ink').innerHTML='';const b=$('#wipeBtn');b.disabled=true;b.textContent='Clearing…';
  try{await artifactNs.publish(SKEL+pageContent(base)+'</body></html>');SAVED.inkReset=base.inkReset;S.inkReset=base.inkReset;dirty=false;toast('All notes are cleared for everyone.')}
  catch(e){const c=e&&e.code;toast(c==='conflict'?'The board was saved meanwhile. It reloads; press the button again.':'Could not clear'+(c?' ('+c+')':'')+'. Try again.')}
  b.disabled=false;b.textContent='🧹 Clear everyone’s notes'}
function el(n,a){const e=document.createElementNS(NS,n);for(const k in a)e.setAttribute(k,a[k]);return e}
function P(e){const r=$('#ink').getBoundingClientRect();return {x:(e.clientX-r.left)*BW/r.width,y:(e.clientY-r.top)*BH/r.height}}
function path(p){return p.map((q,i)=>(i?'L':'M')+q.x.toFixed(1)+' '+q.y.toFixed(1)).join('')}
function setTool(t){if(editing&&t!=='view')setEditing(false);tool=t;closeText(true);document.querySelectorAll('.an').forEach(b=>{b.type='button';b.setAttribute('aria-pressed',b.dataset.t===t)});
  const st=$('#stage');st.classList.toggle('drawing',t!=='view');st.classList.toggle('texting',t==='text');st.classList.toggle('erasing',t==='erase');st.classList.toggle('viewing',t==='view'&&!editing)}
function initInk(){
  const ink=$('#ink'),txt=$('#txt');
  document.querySelectorAll('.an').forEach(b=>b.onclick=()=>setTool(b.dataset.t));
  const colorsEl=$('#colors');
  COLORS.forEach((c,i)=>{const b=document.createElement('button');b.type='button';b.className='sw';b.style.background=c;b.setAttribute('aria-label','Colour '+(i+1));b.setAttribute('aria-pressed',c===color);
    b.onclick=()=>{color=c;colorsEl.querySelectorAll('.sw').forEach(x=>x.setAttribute('aria-pressed',x===b));if(tool==='view'||tool==='erase')setTool('pen')};colorsEl.append(b)});
  ink.addEventListener('pointerdown',e=>{if(tool==='view'||e.button>0)return;e.preventDefault();
    if(tool==='erase'){if(e.target!==ink){const n=e.target.closest('#ink>*');if(canTouch(n)){n.remove();inkSave()}}return}
    if(tool==='text'){openText(P(e));return}
    ink.setPointerCapture(e.pointerId);startP=P(e);pts=[startP];
    if(tool==='pen'||tool==='hl')live=el('path',{d:path(pts),fill:'none',stroke:color,'stroke-width':(tool==='hl'?26:5)/Z,'stroke-linecap':'round','stroke-linejoin':'round',opacity:tool==='hl'?.35:1});
    else if(tool==='ell')live=el('ellipse',{cx:startP.x,cy:startP.y,rx:1,ry:1,fill:'none',stroke:color,'stroke-width':5/Z});
    else live=el('path',{d:'',fill:'none',stroke:color,'stroke-width':5/Z,'stroke-linecap':'round','stroke-linejoin':'round'});
    ink.append(live)});
  ink.addEventListener('pointermove',e=>{if(tool==='erase'&&e.buttons===1&&e.target!==ink&&e.target.closest('#ink>*')){const n=e.target.closest('#ink>*');if(canTouch(n)){n.remove();inkSave()}return}
    if(!live)return;const p=P(e);
    if(tool==='pen'||tool==='hl'){pts.push(p);live.setAttribute('d',path(pts))}
    else if(tool==='ell'){live.setAttribute('cx',(startP.x+p.x)/2);live.setAttribute('cy',(startP.y+p.y)/2);live.setAttribute('rx',Math.abs(p.x-startP.x)/2);live.setAttribute('ry',Math.abs(p.y-startP.y)/2)}
    else if(tool==='arrow'){const a=Math.atan2(p.y-startP.y,p.x-startP.x),L=22/Z,f=x=>x.toFixed(1);
      live.setAttribute('d','M'+f(startP.x)+' '+f(startP.y)+'L'+f(p.x)+' '+f(p.y)+'M'+f(p.x-L*Math.cos(a-.45))+' '+f(p.y-L*Math.sin(a-.45))+'L'+f(p.x)+' '+f(p.y)+'L'+f(p.x-L*Math.cos(a+.45))+' '+f(p.y-L*Math.sin(a+.45)))}});
  const finish=()=>{if(!live)return;if((tool==='ell'&&+live.getAttribute('rx')<3)||(tool==='arrow'&&!live.getAttribute('d')))live.remove();live=null;inkSave()};
  ink.addEventListener('pointerup',finish);ink.addEventListener('pointercancel',finish);
  txt.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();closeText(true)}if(e.key==='Escape')closeText(false)});
  txt.addEventListener('blur',()=>closeText(true));
  txt.addEventListener('input',()=>{txt.style.height='auto';txt.style.height=txt.scrollHeight+'px'});
  $('#undoBtn').onclick=()=>{const l=[...ink.children].reverse().find(mine);if(l){l.remove();inkSave()}};
  $('#clearBtn').onclick=async()=>{const all=ROLE==='teacher';if(![...ink.children].some(n=>all||mine(n)))return;
    if(await ask(all?'Clear all notes on this page, the students’ too?':'Clear your notes on this page?','Clear')){[...ink.children].forEach(n=>{if(all||mine(n))n.remove()});inkSave()}};
  $('#fsBtn').onclick=()=>{const w=document.documentElement;const p=document.fullscreenElement?document.exitFullscreen():(w.requestFullscreen?w.requestFullscreen():null);if(p&&p.catch)p.catch(()=>{$('#hint').textContent='Full screen is not available here. Use the browser full screen instead.'})};
  setTool('view');
}
document.addEventListener('fullscreenchange',()=>{document.body.classList.toggle('fs',!!document.fullscreenElement);fit()});
function openText(p){closeText(true);txtAt=p;const ink=$('#ink'),txt=$('#txt'),stage=$('#stage');const r=ink.getBoundingClientRect(),s=r.width/BW,sr=stage.getBoundingClientRect();
  txt.hidden=false;txt.value='';txt.style.color=color;txt.style.left=(r.left-sr.left+p.x*s)+'px';txt.style.top=(r.top-sr.top+p.y*s-14)+'px';setTimeout(()=>txt.focus(),0)}
function closeText(keep){const txt=$('#txt');if(!txt||txt.hidden)return;const v=txt.value.trim();txt.hidden=true;
  if(keep&&v&&txtAt){const t=el('text',{x:txtAt.x,y:txtAt.y+14/Z,fill:txt.style.color||color,style:'font-size:'+(30/Z).toFixed(2)+'px;stroke-width:'+(5/Z).toFixed(2)+'px'});v.split('\n').forEach((ln,i)=>{const s=el('tspan',{x:txtAt.x,dy:i?36/Z:0});s.textContent=ln;t.append(s)});$('#ink').append(t);inkSave()}txtAt=null}

/* ---------- camera: zoom into one exercise ---------- */
let Z=1,TX=0,TY=0;
function camApply(anim){const cam=$('#cam'),stage=$('#stage');if(!cam)return;cam.classList.toggle('anim',!!anim);const sw=stage.clientWidth,sh=stage.clientHeight;
  Z=Math.max(1,Math.min(8,Z));TX=Math.min(0,Math.max(sw-sw*Z,TX));TY=Math.min(0,Math.max(sh-sh*Z,TY));
  cam.style.transform='translate('+TX+'px,'+TY+'px) scale('+Z+')';const za=$('#zAll');if(za)za.disabled=Z===1}
function zoomAt(f,px,py,anim){const nz=Math.max(1,Math.min(8,Z*f));TX=px-(px-TX)*nz/Z;TY=py-(py-TY)*nz/Z;Z=nz;camApply(anim)}
function camReset(anim){Z=1;TX=0;TY=0;camApply(anim)}
function focusEl(it){if(tool!=='view'||editing)return;const st=$('#stage'),sw=st.clientWidth,sh=st.clientHeight;
  const x=parseFloat(it.style.left)*scale,y=parseFloat(it.style.top)*scale,w=parseFloat(it.style.width)*scale,h=parseFloat(it.style.height)*scale;
  Z=Math.min(8,sw/(w*1.12),sh/(h*1.08));TX=sw/2-(x+w/2)*Z;TY=sh/2-(y+h/2)*Z;camApply(true)}
function initCamera(){
  const stage=$('#stage');const sp=e=>{const r=stage.getBoundingClientRect();return [e.clientX-r.left-4,e.clientY-r.top-4]};
  $('#zIn').onclick=()=>zoomAt(1.4,stage.clientWidth/2,stage.clientHeight/2,true);
  $('#zOut').onclick=()=>zoomAt(1/1.4,stage.clientWidth/2,stage.clientHeight/2,true);
  $('#zAll').onclick=()=>camReset(true);
  stage.addEventListener('wheel',e=>{if(editing)return;e.preventDefault();const [x,y]=sp(e);
    if(e.ctrlKey||e.metaKey)zoomAt(Math.exp(-e.deltaY*0.01),x,y);else if(Z>1){TX-=e.deltaX;TY-=e.deltaY;camApply()}else zoomAt(Math.exp(-e.deltaY*0.002),x,y)},{passive:false});
  const ptrs=new Map();let panned=false,last=null,pinch=null;
  stage.addEventListener('pointerdown',e=>{if(tool!=='view'||editing||e.target.closest('audio,a,#txt'))return;e.preventDefault();ptrs.set(e.pointerId,sp(e));panned=false;last=sp(e);
    if(ptrs.size===2){const [a,b]=[...ptrs.values()];pinch={d:Math.hypot(a[0]-b[0],a[1]-b[1])}}});
  stage.addEventListener('pointermove',e=>{if(!ptrs.has(e.pointerId))return;const p=sp(e);ptrs.set(e.pointerId,p);
    if(ptrs.size===2&&pinch){const [a,b]=[...ptrs.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]);zoomAt(d/pinch.d,(a[0]+b[0])/2,(a[1]+b[1])/2);pinch.d=d;panned=true;return}
    if(!panned&&Math.hypot(p[0]-last[0],p[1]-last[1])<6)return;if(!panned)try{stage.setPointerCapture(e.pointerId)}catch(_){}panned=true;TX+=p[0]-last[0];TY+=p[1]-last[1];last=p;camApply()});
  const up=e=>{ptrs.delete(e.pointerId);if(ptrs.size<2)pinch=null;if(ptrs.size===1)last=[...ptrs.values()][0]};
  stage.addEventListener('pointerup',up);stage.addEventListener('pointercancel',up);
  stage.addEventListener('click',e=>{if(panned){e.stopPropagation();e.preventDefault();panned=false}},true);
}
addEventListener('keydown',e=>{
  if(!unitId)return;const txt=$('#txt');
  if(e.target===txt||e.target.isContentEditable)return;
  if(e.key==='Escape'){if(selected)select(null);else camReset(true)}
  if((e.metaKey||e.ctrlKey)&&e.key==='z'&&!editing){e.preventDefault();$('#undoBtn').click()}});

/* ---------- start button + live lesson: the editor leads, viewers follow tab, zoom, notes and characters ---------- */
let liveStartHook=null;
function startLesson(){if(document.fullscreenElement){document.exitFullscreen();return}if(cur==='keys'){cur='l1';try{history.replaceState(null,'','#'+unitId+'/l1')}catch(e){}render()}
  const w=document.documentElement;const p=w.requestFullscreen?w.requestFullscreen():null;if(p&&p.catch)p.catch(()=>{document.body.classList.add('fs');fit();$('#hint').textContent='Use the browser full screen (F11) for a bigger board.'});camReset(true);$('#stage').scrollIntoView({block:'center'});if(liveStartHook)liveStartHook()}
document.addEventListener('fullscreenchange',()=>{const sb=$('#startBtn');if(sb)sb.textContent=document.fullscreenElement?'✖ Exit full screen':'▶ Start lesson'});
/* ---------- live lesson: the teacher leads, students press "Follow" ---------- */
let liveOn=false;
function initLive(){if(liveOn||!FB)return;liveOn=true;
  const tools=document.querySelector('.tools'),stage=$('#stage');
  const btn=document.createElement('button');btn.type='button';btn.className='tool live';btn.id='liveBtn';tools.prepend(btn);
  FB.watchInk(inkRemote,()=>toast('Lost the connection to the lesson. Reload the page.'));
  if(ROLE==='teacher'){
    let on=false,t=null,first=true;
    const state=()=>({on,tab:cur,z:+Z.toFixed(3),tx:+(TX/stage.clientWidth).toFixed(4),ty:+(TY/stage.clientHeight).toFixed(4)});
    const send=()=>{if(!on||t)return;t=setTimeout(()=>{t=null;if(on)FB.setLive(state()).catch(()=>{})},250)};
    const label=()=>{btn.textContent=on?'📡 Live · stop':'📡 Go live';btn.setAttribute('aria-pressed',on)};
    const set=v=>{on=v;label();FB.setLive(state()).catch(()=>toast('Could not reach the lesson. Check the internet connection.'));
      toast(v?'The lesson is live. Students who press “📡 Follow the teacher” see the page and zoom you show.':'The live lesson has stopped.')};
    btn.onclick=()=>set(!on);
    const ca=camApply;camApply=function(){const r=ca.apply(this,arguments);send();return r};
    const rd=render;render=function(){const r=rd.apply(this,arguments);send();return r};
    liveStartHook=()=>{if(!on)set(true)};
    FB.watchLive(d=>{if(first&&d&&d.on){on=true;label()}first=false},()=>{});
    label();
  }else{
    let follow=false,on=false,L={on:false};
    const label=()=>{btn.textContent=!on?'📡 Waiting for the teacher…':(follow?'📡 Following the teacher ✓':'📡 Follow the teacher');btn.setAttribute('aria-pressed',follow&&on);btn.classList.toggle('pulse',on&&!follow)};
    const apply=()=>{if(!follow||!on)return;
      if(typeof L.tab==='string'&&L.tab!==cur&&L.tab!=='keys'&&TABS.some(t=>t.id===L.tab)){cur=L.tab;try{history.replaceState(null,'','#'+unitId+'/'+cur)}catch(e){}render()}
      Z=Math.min(8,Math.max(1,+L.z||1));TX=(+L.tx||0)*stage.clientWidth;TY=(+L.ty||0)*stage.clientHeight;camApply(true)};
    btn.onclick=()=>{if(!on){toast('The lesson has not started yet. When the teacher starts it, press this button.');return}follow=!follow;label();apply()};
    FB.watchLive(d=>{const was=on;L=d||{on:false};on=!!L.on;
      if(on&&!was)toast('The teacher started the lesson. Press “📡 Follow the teacher”.');
      if(!on&&was){follow=false;toast('The live lesson has ended. Your board keeps everything.')}
      label();apply()},()=>{});
    label();
  }
}

/* ---------- start: open the lesson from the link ---------- */
async function boot(){
  app.innerHTML='<p style="padding:24px">Loading the lesson…</p>';
  const say=(t,m)=>{app.innerHTML='<div class="hub"><h1></h1><p class="lead"></p></div>';app.querySelector('h1').textContent=t;app.querySelector('.lead').textContent=m};
  try{FB=await window.EIDOS_FB}
  catch(e){const m={not_configured:'This site is not connected to its database yet.',no_lesson:'This lesson link does not work. Ask for a new link.',bad_teacher_link:'This teacher link does not work. Ask for a new link.'}[e&&e.message];
    say('Eidos English',m||'Could not open the lesson. Check the internet connection and reload the page.');return}
  if(!FB){say('Eidos English · lesson boards','Open the lesson link you were sent.');return}
  ROLE=FB.role;document.title=(FB.lesson.title||'Up · B1 Unit 1')+' · Eidos English';route();
}

boot();
})();
