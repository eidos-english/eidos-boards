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
    setLive(d){return F.setDoc(liveRef,{...d,at:Date.now()},{merge:true})}
  };
}
