// MayerDistribution Firebase sync service - staged implementation.
// This module is not loaded by index.html yet. It makes no network calls until
// createFirebaseSync() is called and the user explicitly signs in / uploads data.
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  getFirestore, doc, collection, getDoc, getDocs, setDoc, deleteDoc,
  onSnapshot, writeBatch, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const MAX_BATCH_WRITES = 400; // Keep below Firestore's 500-write batch limit.
const REQUIRED_LIST_KEYS = ["Driver", "Ridicare", "Transit", "Destination", "Auto", "Remorca", "Paleti"];

function validateSnapshot(snapshot) {
  if (!snapshot || !snapshot.lists || !Array.isArray(snapshot.programs)) {
    throw new Error("Snapshot invalid: sunt necesare liste si programe.");
  }
  for (const key of REQUIRED_LIST_KEYS) {
    if (!Array.isArray(snapshot.lists[key])) {
      throw new Error("Snapshot invalid: lipseste nomenclatorul " + key + ".");
    }
  }
  for (const program of snapshot.programs) {
    if (!program || typeof program.id !== "number" && typeof program.id !== "string" ||
        typeof program.date !== "string" || !Array.isArray(program.transports)) {
      throw new Error("Snapshot invalid: exista un program cu structura incorecta.");
    }
    for (const transport of program.transports) {
      if (!transport || !Array.isArray(transport.destinations)) {
        throw new Error("Snapshot invalid: exista un transport cu structura incorecta.");
      }
    }
  }
}

function chunks(items, size) {
  const result = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

export function createFirebaseSync(firebaseConfig) {
  if (!firebaseConfig || !firebaseConfig.apiKey ||
      String(firebaseConfig.apiKey).startsWith("REPLACE_") ||
      !firebaseConfig.projectId || String(firebaseConfig.projectId).startsWith("REPLACE_") ||
      !firebaseConfig.appId || String(firebaseConfig.appId).startsWith("REPLACE_")) {
    throw new Error("Completeaza firebase-config.js cu configuratia unui proiect Firebase dedicat.");
  }

  const appName = "MayerDistributionFirebaseSync";
  const existing = getApps().find(item => item.name === appName);
  const app = existing || initializeApp(firebaseConfig, appName);
  const auth = getAuth(app);
  const db = getFirestore(app);

  function requireUser() {
    const user = auth.currentUser;
    if (!user) throw new Error("Autentifica-te in Firebase inainte de a accesa datele cloud.");
    return user;
  }
  function userRoot(uid = requireUser().uid) {
    return "users/" + uid;
  }
  function listsRef(uid) {
    return doc(db, userRoot(uid), "appData", "lists");
  }
  function programsRef(uid) {
    return collection(db, userRoot(uid), "programs");
  }
  function metaRef(uid) {
    return doc(db, userRoot(uid), "syncMeta", "current");
  }

  return {
    auth,
    onAuthStateChanged(callback) { return onAuthStateChanged(auth, callback); },
    signIn(email, password) { return signInWithEmailAndPassword(auth, email, password); },
    signOut() { return signOut(auth); },

    async readCloudSnapshot() {
      const user = requireUser();
      const [listsSnap, programsSnap] = await Promise.all([
        getDoc(listsRef(user.uid)),
        getDocs(programsRef(user.uid))
      ]);
      return {
        exists: listsSnap.exists(),
        lists: listsSnap.exists() ? listsSnap.data().values : null,
        programs: programsSnap.docs.map(item => item.data().program)
      };
    },

    // Explicit initial upload only. This method does not run automatically.
    // It refuses to overwrite a cloud account that already has data.
    async uploadLocalSnapshot(snapshot) {
      const user = requireUser();
      validateSnapshot(snapshot);
      const [listsSnap, programsSnap] = await Promise.all([
        getDoc(listsRef(user.uid)),
        getDocs(programsRef(user.uid))
      ]);
      if (listsSnap.exists() || !programsSnap.empty) {
        throw new Error("Cloud-ul contine deja date. Importul initial a fost oprit pentru a evita suprascrierea.");
      }

      const listWrite = setDoc(listsRef(user.uid), {
        values: snapshot.lists,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid
      });
      const programDocs = snapshot.programs.map(program => ({
        id: String(program.id),
        program
      }));
      await listWrite;
      for (const group of chunks(programDocs, MAX_BATCH_WRITES)) {
        const batch = writeBatch(db);
        for (const item of group) {
          batch.set(doc(programsRef(user.uid), item.id), {
            program: item.program,
            updatedAt: serverTimestamp(),
            updatedBy: user.uid
          });
        }
        await batch.commit();
      }
      await setDoc(metaRef(user.uid), {
        schemaVersion: 1,
        importedAt: serverTimestamp(),
        importedLists: true,
        importedProgramCount: snapshot.programs.length,
        updatedBy: user.uid
      });
      return { importedPrograms: snapshot.programs.length };
    },

    // Real-time listeners only report cloud changes; they never mutate localStorage.
    // The UI layer must define a reviewed merge/conflict policy before applying them.
    subscribeLists(callback, onError = () => {}) {
      const user = requireUser();
      return onSnapshot(listsRef(user.uid), snap => {
        callback(snap.exists() ? snap.data().values : null);
      }, onError);
    },
    subscribePrograms(callback, onError = () => {}) {
      const user = requireUser();
      return onSnapshot(programsRef(user.uid), snap => {
        callback(snap.docs.map(item => item.data().program));
      }, onError);
    },

    async upsertProgram(program) {
      const user = requireUser();
      if (!program || (typeof program.id !== "number" && typeof program.id !== "string") ||
          typeof program.date !== "string" || !Array.isArray(program.transports)) {
        throw new Error("Program invalid.");
      }
      await setDoc(doc(programsRef(user.uid), String(program.id)), {
        program,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid
      });
    },
    async deleteProgram(programId) {
      const user = requireUser();
      await deleteDoc(doc(programsRef(user.uid), String(programId)));
    },
    async upsertLists(values) {
      const user = requireUser();
      for (const key of REQUIRED_LIST_KEYS) {
        if (!Array.isArray(values?.[key])) throw new Error("Nomenclator invalid: " + key);
      }
      await setDoc(listsRef(user.uid), {
        values,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid
      });
    },
    async getSyncMetadata() {
      const user = requireUser();
      const snap = await getDoc(metaRef(user.uid));
      return snap.exists() ? snap.data() : null;
    }
  };
}
