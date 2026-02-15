import { initializeApp, cert, getApps, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";
import { getAuth, type Auth } from "firebase-admin/auth";

let app: App;
let firestoreDb: Firestore;
let storageBucket: Storage;
let adminAuth: Auth;

function getServiceAccountCredentials() {
  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!key) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY environment variable is required");
  }
  try {
    return JSON.parse(key);
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY must be valid JSON");
  }
}

function initFirebaseAdmin() {
  if (getApps().length > 0) {
    app = getApps()[0];
  } else {
    const serviceAccount = getServiceAccountCredentials();
    app = initializeApp({
      credential: cert(serviceAccount),
      storageBucket: `${serviceAccount.project_id}.firebasestorage.app`,
    });
  }

  firestoreDb = getFirestore(app);
  storageBucket = getStorage(app);
  adminAuth = getAuth(app);

  return { app, firestoreDb, storageBucket, adminAuth };
}

const initialized = initFirebaseAdmin();

export const firestore = initialized.firestoreDb;
export const firebaseStorage = initialized.storageBucket;
export const firebaseAuth = initialized.adminAuth;
export const firebaseApp = initialized.app;
