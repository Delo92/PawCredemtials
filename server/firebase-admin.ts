import { initializeApp, cert, getApps, type App } from "firebase-admin/app";
import { getFirestore, type Firestore, FieldValue } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";
import { getAuth, type Auth } from "firebase-admin/auth";

let _app: App | null = null;
let _db: Firestore | null = null;
let _storage: Storage | null = null;
let _auth: Auth | null = null;

function tryParseServiceAccountKey(raw: string): { projectId: string; clientEmail: string; privateKey: string } | null {
  const attempts = [
    () => JSON.parse(raw),
    () => JSON.parse(raw.trim()),
    () => JSON.parse(raw.replace(/\n/g, '\\n')),
    () => JSON.parse(Buffer.from(raw, 'base64').toString('utf-8')),
    () => JSON.parse(Buffer.from(raw.trim(), 'base64').toString('utf-8')),
  ];

  for (const attempt of attempts) {
    try {
      const parsed = attempt();
      if (parsed && parsed.project_id && parsed.client_email && parsed.private_key) {
        let pk = parsed.private_key;
        if (typeof pk === 'string' && pk.includes('\\n') && !pk.includes('\n')) {
          pk = pk.replace(/\\n/g, '\n');
        }
        console.log(`Firebase credentials parsed successfully for project: ${parsed.project_id}`);
        return {
          projectId: parsed.project_id,
          clientEmail: parsed.client_email,
          privateKey: pk,
        };
      }
    } catch {
    }
  }
  return null;
}

function getCredentials(): { projectId: string; clientEmail: string; privateKey: string } {
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountKey) {
    const result = tryParseServiceAccountKey(serviceAccountKey);
    if (result) return result;

    if (serviceAccountKey.includes('-----BEGIN') || serviceAccountKey.includes('PRIVATE KEY')) {
      const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

      if (projectId && clientEmail) {
        let pk = serviceAccountKey.trim();
        if (pk.startsWith('"')) pk = pk.slice(1);
        if (pk.endsWith('"')) pk = pk.slice(0, -1);
        pk = pk.replace(/\\n/g, '\n');
        console.log(`Firebase credentials assembled from private key + env vars for project: ${projectId}`);
        return { projectId, clientEmail, privateKey: pk };
      }

      if (projectId) {
        let pk = serviceAccountKey.trim();
        if (pk.startsWith('"')) pk = pk.slice(1);
        if (pk.endsWith('"')) pk = pk.slice(0, -1);
        pk = pk.replace(/\\n/g, '\n');
        const inferredEmail = `firebase-adminsdk@${projectId}.iam.gserviceaccount.com`;
        console.log(`Firebase credentials assembled with inferred client_email for project: ${projectId}`);
        console.log(`Using inferred client_email: ${inferredEmail}`);
        console.log(`If auth fails, set FIREBASE_CLIENT_EMAIL to the correct service account email from your Firebase console.`);
        return { projectId, clientEmail: inferredEmail, privateKey: pk };
      }

      console.error(
        "FIREBASE_SERVICE_ACCOUNT_KEY contains a private key but no project ID found. " +
        "Set VITE_FIREBASE_PROJECT_ID or FIREBASE_PROJECT_ID."
      );
    } else {
      console.error(
        "FIREBASE_SERVICE_ACCOUNT_KEY is set but could not be parsed as JSON. " +
        `Key starts with: "${serviceAccountKey.substring(0, 30)}..." (length: ${serviceAccountKey.length}). ` +
        "It should be the full JSON from Firebase console > Project Settings > Service Accounts > Generate New Private Key."
      );
    }
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;

  if (clientEmail && privateKey && projectId) {
    let pk = privateKey;
    if (pk.includes('\\n') && !pk.includes('\n')) {
      pk = pk.replace(/\\n/g, '\n');
    }
    console.log(`Firebase credentials loaded from individual env vars for project: ${projectId}`);
    return { projectId, clientEmail, privateKey: pk };
  }

  throw new Error(
    "Firebase credentials not found. Set FIREBASE_SERVICE_ACCOUNT_KEY (full JSON from Firebase console) " +
    "or individual FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY + FIREBASE_PROJECT_ID env vars."
  );
}

function ensureInitialized(): App {
  if (_app) return _app;

  if (getApps().length > 0) {
    _app = getApps()[0];
    return _app;
  }

  const creds = getCredentials();
  console.log("Initializing Firebase Admin SDK (lazy initialization)");

  _app = initializeApp({
    credential: cert({
      projectId: creds.projectId,
      clientEmail: creds.clientEmail,
      privateKey: creds.privateKey,
    }),
    storageBucket: `${creds.projectId}.firebasestorage.app`,
  });

  return _app;
}

export function getDb(): Firestore {
  if (_db) return _db;
  const app = ensureInitialized();
  _db = getFirestore(app);
  return _db;
}

export function getAdminStorage(): Storage {
  if (_storage) return _storage;
  const app = ensureInitialized();
  _storage = getStorage(app);
  return _storage;
}

export function getAdminAuth(): Auth {
  if (_auth) return _auth;
  const app = ensureInitialized();
  _auth = getAuth(app);
  return _auth;
}

export { FieldValue };

export const firestore = new Proxy({} as Firestore, {
  get(_target, prop) {
    return (getDb() as any)[prop];
  },
});

export const firebaseStorage = new Proxy({} as Storage, {
  get(_target, prop) {
    return (getAdminStorage() as any)[prop];
  },
});

export const firebaseAuth = new Proxy({} as Auth, {
  get(_target, prop) {
    return (getAdminAuth() as any)[prop];
  },
});
