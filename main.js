// Қабати пайвасткунӣ: Firebase (вуруд + пойгоҳи додаҳо) ва имкониятҳои Android.
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut,
  onAuthStateChanged, updatePassword, reauthenticateWithCredential, EmailAuthProvider
} from 'firebase/auth';
import {
  initializeFirestore, persistentLocalCache, persistentSingleTabManager,
  collection, doc, getDoc, setDoc, deleteDoc, onSnapshot, query, where
} from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { LocalNotifications } from '@capacitor/local-notifications';
import XLSX from 'xlsx/dist/xlsx.full.min.js';
import { firebaseConfig } from './firebase-config.js';

const configured = !String(firebaseConfig.apiKey || '').includes('PASTE') && !!firebaseConfig.projectId && !String(firebaseConfig.projectId).includes('PASTE');
const native = Capacitor.isNativePlatform();

let app = null, auth = null, fs = null;
if (configured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  fs = initializeFirestore(app, {
    ignoreUndefinedProperties: true,
    localCache: persistentLocalCache({ tabManager: persistentSingleTabManager() })
  });
}

// Навиштан дарҳол ба навбати маҳаллӣ меравад (бе интернет ҳам кор мекунад).
// Хатои иҷозат одатан дар 1.5 сония меояд; агар набошад, навбат боқӣ мемонад.
function fast(p, ms = 1500) {
  p.catch(() => {});
  return Promise.race([p, new Promise(res => setTimeout(res, ms))]);
}

const db = {
  collection: (c, w) => ({
    onSnapshot: (cb, eb) => onSnapshot(
      w ? query(collection(fs, c), where(w[0], w[1], w[2])) : collection(fs, c),
      snap => cb({ docs: snap.docs.map(d => ({ id: d.id, data: () => d.data() })) }),
      e => { if (eb) eb(e); }
    ),
    doc: id => ({
      set: d => fast(setDoc(doc(fs, c, id), d)),
      update: d => fast(setDoc(doc(fs, c, id), d, { merge: true })),
      delete: () => fast(deleteDoc(doc(fs, c, id)))
    })
  })
};

async function getD(c, id) {
  const s = await getDoc(doc(fs, c, id));
  return s.exists() ? s.data() : null;
}

async function signIn(key, pw) {
  let l;
  try { l = await getD('logins', key); } catch (e) { throw { code: 'network' }; }
  if (!l) throw { code: 'bad' };
  try { await signInWithEmailAndPassword(auth, l.email, pw); }
  catch (e) { throw { code: (e && e.code === 'auth/network-request-failed') ? 'network' : 'bad' }; }
}

async function signInEmail(email, pw) {
  const c = await signInWithEmailAndPassword(auth, email, pw);
  return c.user;
}

async function signUp(email, pw) {
  const c = await createUserWithEmailAndPassword(auth, email, pw);
  return c.user;
}

// Ҳисоби нав бидуни баромадани маъмур аз барнома (барномаи дуюм)
async function createAccount(email, pw) {
  const sec = initializeApp(firebaseConfig, 'sec' + Date.now());
  try {
    const a = getAuth(sec);
    const cred = await createUserWithEmailAndPassword(a, email, pw);
    const u = cred.user.uid;
    await signOut(a);
    return u;
  } finally {
    try { await deleteApp(sec); } catch (e) {}
  }
}

async function changePassword(cur, nw) {
  const u = auth.currentUser;
  await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, cur));
  await updatePassword(u, nw);
}

function toBase64(bytes) {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(s);
}

async function saveFile(name, data) {
  let bytes;
  if (typeof data === 'string') bytes = new TextEncoder().encode(data);
  else if (data instanceof Blob) bytes = new Uint8Array(await data.arrayBuffer());
  else if (data instanceof Uint8Array) bytes = data;
  else bytes = new Uint8Array(data);
  const res = await Filesystem.writeFile({ path: name, data: toBase64(bytes), directory: Directory.Cache });
  try {
    await Share.share({ title: name, dialogTitle: name, url: res.uri });
  } catch (e) { return false; } // корбар бекор кард
  return true;
}

async function scheduleNotifs(items) {
  try {
    const p = await LocalNotifications.requestPermissions();
    if (p.display !== 'granted') return;
    const pend = await LocalNotifications.getPending();
    if (pend.notifications && pend.notifications.length) await LocalNotifications.cancel({ notifications: pend.notifications });
    if (items.length) {
      await LocalNotifications.schedule({
        notifications: items.map(i => ({ id: i.id, title: i.title, body: i.body, schedule: { at: i.at, allowWhileIdle: true } }))
      });
    }
  } catch (e) { console.warn('notif', e); }
}

window.FSX = {
  configured, native, db, XLSX,
  getDoc: getD,
  signIn, signInEmail, signUp, createAccount, changePassword,
  signOut: () => signOut(auth),
  onAuth: cb => onAuthStateChanged(auth, cb),
  saveFile, scheduleNotifs,
  onBack: cb => { if (native) App.addListener('backButton', cb); },
  exitApp: () => { if (native) App.exitApp(); }
};
