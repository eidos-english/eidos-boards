/* Admin page: the owner signs in with Google, creates lessons and copies their teacher / student links. */
import {FIREBASE_CONFIG,SDK} from './config.js';
const $=s=>document.querySelector(s);
const UNITS={b1u1:'Up · B1 Unit 1'};
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
    unsub=F.onSnapshot(q,s=>render(s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.created||0)-(a.created||0))),
      e=>{$('#list').innerHTML='';fail($('#list').appendChild(document.createElement('p')),e&&e.code==='permission-denied'?'Цей акаунт не має доступу до адмінки.':'Не вдалося завантажити уроки.');$('#list').firstChild.className='err'});
  });
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
