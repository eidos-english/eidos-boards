/* Eidos boards: the link between a lesson board and Firebase.
   A lesson link is ?l=<lesson>; a teacher link also carries &t=<teacher key>.
   index.html hands start() to app.js as window.EIDOS_FB. */
import {FIREBASE_CONFIG,SDK} from './config.js';

const P=new URLSearchParams(location.search);
const LESSON=(P.get('l')||'').replace(/[^\w-]/g,'');
const TKEY=(P.get('t')||'').replace(/[^\w-]/g,'');

export async function start(){
  if(!LESSON)return null;
  if(!FIREBASE_CONFIG||!FIREBASE_CONFIG.projectId)throw new Error('not_configured');
  const [{initializeApp},A,F]=await Promise.all([import(SDK+'firebase-app.js'),import(SDK+'firebase-auth.js'),import(SDK+'firebase-firestore.js')]);
  const app=initializeApp(FIREBASE_CONFIG);
  const auth=A.getAuth(app);
  const db=F.getFirestore(app);
  if(window.EIDOS_EMULATOR){A.connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});F.connectFirestoreEmulator(db,'127.0.0.1',8080)}
  await auth.authStateReady();                       // same browser = same person, lesson after lesson
  const user=auth.currentUser||(await A.signInAnonymously(auth)).user;
  const uid=user.uid;
  const lref=F.doc(db,'lessons',LESSON);
  const ls=await F.getDoc(lref);
  if(!ls.exists())throw new Error('no_lesson');
  const lesson=ls.data();
  let role='student';
  if(TKEY){
    const tref=F.doc(db,'lessons',LESSON,'teachers',uid);
    try{const t=await F.getDoc(tref);if(!t.exists())await F.setDoc(tref,{k:TKEY,at:Date.now()});role='teacher'}
    catch(e){throw new Error('bad_teacher_link')}
  }
  const ink=F.collection(db,'lessons',LESSON,'ink');
  const liveRef=F.doc(db,'lessons',LESSON,'live','state');
  return {
    uid,role,lesson,lessonId:LESSON,
    watchInk(cb,err){return F.onSnapshot(ink,s=>cb(s.docChanges().map(c=>({type:c.type,id:c.doc.id,...c.doc.data()}))),err)},
    putInk(id,d){return F.setDoc(F.doc(ink,id),{...d,by:uid})},
    delInk(id){return F.deleteDoc(F.doc(ink,id))},
    watchLive(cb,err){return F.onSnapshot(liveRef,s=>cb(s.exists()?s.data():{on:false}),err)},
    setLive(d){return F.setDoc(liveRef,{...d,at:Date.now()},{merge:true})},
    /* a board imported in the admin page: its content, saved layout and files (as blob URLs) */
    async getBoard(id){
      if(!/^[a-z0-9_-]{1,40}$/.test(id))return null;
      const s=await F.getDoc(F.doc(db,'boards',id));if(!s.exists())return null;
      const b=s.data();let files=await cacheGet('board:'+id,b.v);
      if(!files){files={};const parts={};
        const fs=await F.getDocs(F.collection(db,'boards',id,'files'));
        fs.forEach(d=>{const x=d.data();if(typeof x.name!=='string'||typeof x.d!=='string')return;(parts[x.name]=parts[x.name]||{type:x.type,p:[]}).p[x.i|0]=x.d});
        for(const n in parts)files[n]={type:parts[n].type,b64:parts[n].p.join('')};
        cacheSet('board:'+id,b.v,files)}
      const urls={};for(const n in files){try{urls[n]=URL.createObjectURL(toBlob(files[n].b64,files[n].type))}catch(e){}}
      return {unit:JSON.parse(b.unit),state:JSON.parse(b.state||'{}'),files:urls,title:b.title}
    }
  };
}

/* files of imported boards are kept in this browser until the board is imported again */
const OK_TYPES=/^(image\/(png|jpeg|webp|gif)|audio\/mpeg)$/;
function toBlob(b64,type){if(!OK_TYPES.test(type))throw new Error('type');const bin=atob(b64),a=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);return new Blob([a],{type})}
function idb(){return new Promise((res,rej)=>{const r=indexedDB.open('eidos-boards',1);r.onupgradeneeded=()=>r.result.createObjectStore('c');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function cacheGet(k,v){try{const db=await idb();return await new Promise(res=>{const q=db.transaction('c').objectStore('c').get(k);q.onsuccess=()=>{const x=q.result;res(x&&x.v===v?x.files:null)};q.onerror=()=>res(null)})}catch(e){return null}}
async function cacheSet(k,v,files){try{const db=await idb();db.transaction('c','readwrite').objectStore('c').put({v,files},k)}catch(e){}}
