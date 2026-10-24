// MayerDistribution Firebase sync service.
// The UI loads this module after reading the bundled configuration and signing in.
// Firestore access is scoped to the currently authenticated Firebase user.
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

    // First authenticated load: merge by stable program ID. Local record wins on collision.
    // Existing local lists win only on a device with an established local list store.
    async bootstrapSnapshot(localSnapshot, hasLocalLists) {
      const user = requireUser();
      validateSnapshot(localSnapshot);
      const cloud = await this.readCloudSnapshot();
      const selectedLists = hasLocalLists || !cloud.exists ? localSnapshot.lists : cloud.lists;
      const cloudById = new Map(cloud.programs.map(program => [String(program.id), program]));
      const localById = new Map(localSnapshot.programs.map(program => [String(program.id), program]));
      const mergedPrograms = [...localSnapshot.programs];
      for (const program of cloud.programs) {
        if (!localById.has(String(program.id))) mergedPrograms.push(program);
      }

      if (!cloud.exists || JSON.stringify(cloud.lists) !== JSON.stringify(selectedLists)) {
        await this.upsertLists(selectedLists);
      }
      for (const program of localSnapshot.programs) {
        const cloudProgram = cloudById.get(String(program.id));
        if (!cloudProgram || JSON.stringify(cloudProgram) !== JSON.stringify(program)) {
          await this.upsertProgram(program);
        }
      }
      return {
        lists: selectedLists,
        programs: mergedPrograms,
        cloudPrograms: cloud.programs.length,
        localPrograms: localSnapshot.programs.length
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

    // Manual merge: local records win on matching IDs; cloud-only programs are returned for the UI to merge locally.
    // This deliberately does not propagate deletions. It is an explicit merge, not full bidirectional sync.
    async mergeSnapshot(snapshot) {
      const user = requireUser();
      validateSnapshot(snapshot);
      const cloud = await this.readCloudSnapshot();
      const localById = new Map(snapshot.programs.map(program => [String(program.id), program]));
      const cloudOnlyPrograms = cloud.programs.filter(program => !localById.has(String(program.id)));
      const mergedPrograms = [...snapshot.programs, ...cloudOnlyPrograms];
      const batchGroups = chunks(mergedPrograms.map(program => ({ id: String(program.id), program })), MAX_BATCH_WRITES);

      await setDoc(listsRef(user.uid), {
        values: snapshot.lists,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid
      });
      for (const group of batchGroups) {
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
        lastManualMergeAt: serverTimestamp(),
        localProgramCount: snapshot.programs.length,
        cloudProgramCountBeforeMerge: cloud.programs.length,
        mergedProgramCount: mergedPrograms.length,
        updatedBy: user.uid
      }, { merge: true });
      return {
        programs: mergedPrograms,
        importedCloudPrograms: cloudOnlyPrograms.length,
        uploadedLocalPrograms: snapshot.programs.length,
        mergedProgramCount: mergedPrograms.length
      };
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
        callback(
          snap.docs.map(item => item.data().program),
          snap.docChanges().map(change => ({
            type: change.type,
            id: change.doc.id,
            program: change.doc.data().program
          }))
        );
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
