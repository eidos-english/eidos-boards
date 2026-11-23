/* Admin page: the owner signs in with Google, creates lessons and copies their teacher / student links. */
import {FIREBASE_CONFIG,SDK} from './config.js';
const $=s=>document.querySelector(s);
const BUILTIN={b1u1:'Up · B1 Unit 1'};let UNITS={...BUILTIN};
const rnd=n=>{const a=new Uint8Array(n);crypto.getRandomValues(a);return [...a].map(b=>'abcdefghijkmnpqrstuvwxyz23456789'[b%32]).join('')};
const base=location.href.replace(/[?#].*$/,'').replace(/admin\.html$/,'');
const fail=(el,t)=>{el.textContent=t;el.hidden=false};

(async()=>{
  if(!FIREBASE_CONFIG||!FIREBASE_CONFIG.projectId){fail($('#fatal'),'Сайт ще не підключено до Firebase.');return}
  const [{initializeApp},A,F]=await Promise.all([import(SDK+'firebase-app.js'),import(SDK+'firebase-auth.js'),import(SDK+'firebase-firestore.js')]);
  const app=initializeApp(FIREBASE_CONFIG),auth=A.getAuth(app),db=F.getFirestore(app);
  if(window.EIDOS_EMULATOR){A.connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});F.connectFirestoreEmulator(db,'127.0.0.1',8080);
    window.__testLogin=em=>A.signInWithCredential(auth,A.GoogleAuthProvider.credential(JSON.stringify({sub:'u-'+em,email:em,email_verified:true})))}
  $('#googleBtn').onclick=async()=>{$('#signinErr').hidden=true;try{await A.signInWithPopup(auth,new A.GoogleAuthProvider())}catch(e){fail($('#signinErr'),'Не вдалося увійти'+(e&&e.code?' ('+e.code+')':'')+'.')}};
  $('#outBtn').onclick=e=>{e.preventDefault();A.signOut(auth)};
  let unsub=null;
  A.onAuthStateChanged(auth,u=>{
    if(unsub){unsub();unsub=null}
    const admin=u&&!u.isAnonymous;
    $('#signin').hidden=!!admin;$('#panel').hidden=!admin;
    if(!admin)return;
    $('#who').textContent=u.email||'';
    const q=F.query(F.collection(db,'lessons'),F.where('owner','==',u.uid));
    watchBoards();
    unsub=F.onSnapshot(q,s=>render(s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.created||0)-(a.created||0))),
      e=>{$('#list').innerHTML='';fail($('#list').appendChild(document.createElement('p')),e&&e.code==='permission-denied'?'Цей акаунт не має доступу до адмінки.':'Не вдалося завантажити уроки.');$('#list').firstChild.className='err'});
  });
  /* ---- boards imported from the Claude boards ---- */
  let bunsub=null;
  function watchBoards(){if(bunsub)bunsub();
    bunsub=F.onSnapshot(F.collection(db,'boards'),s=>{
      const bs=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(a.title).localeCompare(String(b.title)));
      UNITS={...BUILTIN};bs.forEach(b=>UNITS[b.id]=b.title||b.id);
      const sel=$('#unit'),was=sel.value;sel.innerHTML='';
      for(const id in UNITS){const o=document.createElement('option');o.value=id;o.textContent=UNITS[id];sel.append(o)}
      if(UNITS[was])sel.value=was;
      const box=$('#boards');box.innerHTML='';
      if(!bs.length){const p=document.createElement('p');p.className='msg';p.textContent='Імпортованих дошок ще немає. Дошка Up уже вбудована в сайт.';box.append(p)}
      for(const b of bs){const r=document.createElement('div');r.className='brow';
        const t=document.createElement('div');const h=document.createElement('b');h.textContent=b.title||b.id;const m=document.createElement('div');m.className='meta';m.style.margin='0';
        m.textContent='оновлено '+new Date(b.v||0).toLocaleString('uk-UA')+' · файлів: '+(b.files||0);t.append(h,m);
        const del=document.createElement('button');del.type='button';del.className='btn warn';del.textContent='Видалити';
        del.onclick=async()=>{if(!confirm('Видалити дошку «'+(b.title||b.id)+'»? Уроки на ній перестануть відкриватися'+(BUILTIN[b.id]?' (для Up повернеться вбудована версія)':'')+'.'))return;del.disabled=true;
          try{const fs=await F.getDocs(F.collection(db,'boards',b.id,'files'));for(const d of fs.docs)await F.deleteDoc(d.ref);await F.deleteDoc(F.doc(db,'boards',b.id))}
          catch(e){del.disabled=false;alert('Не вдалося видалити'+(e&&e.code?' ('+e.code+')':'')+'.')}};
        r.append(t,del);box.append(r)}
    },()=>{});
  }
  const NAME=/^(pics\/)?[A-Za-z0-9_.-]{1,80}$/,DATA=/^data:(image\/(?:png|jpeg|webp|gif)|audio\/mpeg);base64,([A-Za-z0-9+/=]+)$/,CH=700000;
  const say=(t,err)=>{const m=$('#importMsg');m.hidden=false;m.className=err?'err':'msg';m.textContent=t};
  $('#importLbl').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('#importFile').click()}};
  $('#importFile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;const u=auth.currentUser;if(!u)return;
    say('Читаю файл…');let j;
    try{j=JSON.parse(await f.text())}catch(x){say('Це не файл дошки. Потрібен файл .json, збережений кнопкою «⬇ Export for site».',1);return}
    const id=String(j&&j.id||''),unit=j&&j.unit;
    if(!j||j.format!=='eidos-board'||j.version!==1||!/^[a-z0-9_-]{1,40}$/.test(id)||!unit||!Array.isArray(unit.L)||!unit.meta||typeof unit.meta.title!=='string'||!unit.ASSETS||typeof unit.ASSETS!=='object'){say('Файл пошкоджений або не є дошкою Eidos.',1);return}
    const files=[];let total=0;
    for(const [n,d] of Object.entries(j.files||{})){const m=typeof d==='string'&&d.match(DATA);if(!NAME.test(n)||!m){say('У файлі є недозволений вміст ('+String(n).slice(0,40)+'). Імпорт скасовано.',1);return}files.push({name:n,type:m[1],b64:m[2]});total+=m[2].length}
    const us=JSON.stringify(unit),ss=JSON.stringify(j.state||{});
    if(us.length+ss.length>900000){say('Текст дошки завеликий для бази.',1);return}
    if(total>45e6){say('Файл завеликий ('+Math.round(total/1e6)+' МБ). Максимум близько 30 МБ.',1);return}
    const ex=await F.getDoc(F.doc(db,'boards',id));
    if(ex.exists()&&!confirm('Дошка «'+(ex.data().title||id)+'» вже є. Замінити її новою версією? Уроки на ній лишаться, записи теж.')){say('Імпорт скасовано.');return}
    $('#importLbl').style.pointerEvents='none';
    try{
      if(ex.exists()){say('Прибираю стару версію…');const old=await F.getDocs(F.collection(db,'boards',id,'files'));for(const d of old.docs)await F.deleteDoc(d.ref)}
      const jobs=[];for(const x of files)for(let i=0;i*CH<x.b64.length;i++)jobs.push({name:x.name,type:x.type,i,d:x.b64.slice(i*CH,(i+1)*CH)});
      let k=0;for(const q of jobs){say('Завантажую файли: '+(++k)+' з '+jobs.length+'…');await F.setDoc(F.doc(db,'boards',id,'files',q.name.replace(/\//g,'__')+'~'+q.i),q)}
      await F.setDoc(F.doc(db,'boards',id),{title:unit.meta.title.slice(0,120),unit:us,state:ss,v:Date.now(),files:files.length,owner:u.uid});
      say('Готово: дошку «'+unit.meta.title+'» імпортовано. Її можна обрати для нового уроку.')}
    catch(x){say('Не вдалося імпортувати'+(x&&x.code?' ('+x.code+')':'')+'. Перевірте, що правила Firebase оновлено, і спробуйте ще раз.',1)}
    $('#importLbl').style.pointerEvents=''};
  const keys={};
  async function keyOf(id){if(keys[id])return keys[id];const s=await F.getDoc(F.doc(db,'lessons',id,'private','key'));return keys[id]=s.exists()?s.data().k:''}
  async function render(ls){
    const list=$('#list');list.innerHTML='';
    if(!ls.length){const p=document.createElement('p');p.className='msg';p.textContent='Уроків ще немає. Створіть перший угорі.';list.append(p);return}
    for(const l of ls){
      const box=document.createElement('div');box.className='box lesson';
      const h=document.createElement('h2');h.textContent=l.name||'Без назви';
      const m=document.createElement('p');m.className='meta';m.textContent=(UNITS[l.unit]||l.unit)+' · створено '+new Date(l.created||0).toLocaleDateString('uk-UA');
      box.append(h,m);
      const k=await keyOf(l.id);
      for(const [lab,url] of [['👩‍🏫 Викладач',base+'?l='+l.id+'&t='+k],['🎓 Учень',base+'?l='+l.id]]){
        const r=document.createElement('div');r.className='link';
        const b=document.createElement('b');b.textContent=lab;const c=document.createElement('code');c.textContent=url;
        const cp=document.createElement('button');cp.type='button';cp.className='btn';cp.textContent='Копіювати';
        cp.onclick=async()=>{try{await navigator.clipboard.writeText(url);cp.textContent='Скопійовано ✓';setTimeout(()=>cp.textContent='Копіювати',1600)}catch(e){prompt('Скопіюйте посилання:',url)}};
        const op=document.createElement('a');op.className='btn ghost';op.href=url;op.target='_blank';op.rel='noopener';op.textContent='Відкрити';
        r.append(b,c,cp,op);box.append(r)}
      const del=document.createElement('button');del.type='button';del.className='btn warn';del.textContent='Видалити урок';
      del.onclick=async()=>{if(!confirm('Видалити урок «'+(l.name||'')+'» разом з усіма записами? Посилання перестануть працювати.'))return;del.disabled=true;
        try{const ink=await F.getDocs(F.collection(db,'lessons',l.id,'ink'));for(const d of ink.docs)await F.deleteDoc(d.ref);
          await F.deleteDoc(F.doc(db,'lessons',l.id,'live','state')).catch(()=>{});
          await F.deleteDoc(F.doc(db,'lessons',l.id,'private','key'));await F.deleteDoc(F.doc(db,'lessons',l.id))}
        catch(e){del.disabled=false;alert('Не вдалося видалити'+(e&&e.code?' ('+e.code+')':'')+'.')}};
      box.append(del);list.append(box)}
  }
  $('#newBtn').onclick=async()=>{const u=auth.currentUser;if(!u)return;$('#newErr').hidden=true;const btn=$('#newBtn');btn.disabled=true;
    const id=rnd(16),k=rnd(20),unit=$('#unit').value;
    try{const b=F.writeBatch(db);
      b.set(F.doc(db,'lessons',id),{name:$('#name').value.trim().slice(0,80),unit,title:UNITS[unit],owner:u.uid,created:Date.now()});
      b.set(F.doc(db,'lessons',id,'private','key'),{k});await b.commit();keys[id]=k;$('#name').value=''}
    catch(e){fail($('#newErr'),e&&e.code==='permission-denied'?'Цей акаунт не має права створювати уроки.':'Не вдалося створити урок.')}
    btn.disabled=false};
})().catch(e=>fail($('#fatal'),'Не вдалося завантажити сторінку. Перевірте інтернет і оновіть.'));
