import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import fs from "fs";
import path from "path";

function getCredentials() {
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountKey) {
    try {
      const parsed = JSON.parse(serviceAccountKey);
      if (parsed.project_id && parsed.client_email && parsed.private_key) {
        let pk = parsed.private_key;
        if (typeof pk === 'string' && pk.includes('\\n') && !pk.includes('\n')) {
          pk = pk.replace(/\\n/g, '\n');
        }
        return { projectId: parsed.project_id, clientEmail: parsed.client_email, privateKey: pk };
      }
    } catch {}
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;

  if (clientEmail && privateKey && projectId) {
    let pk = privateKey;
    if (pk.includes('\\n') && !pk.includes('\n')) {
      pk = pk.replace(/\\n/g, '\n');
    }
    return { projectId, clientEmail, privateKey: pk };
  }

  throw new Error("Firebase credentials not found");
}

async function main() {
  const creds = getCredentials();
  console.log(`Using Firebase project: ${creds.projectId}`);

  const app = getApps().length > 0 ? getApps()[0] : initializeApp({
    credential: cert({
      projectId: creds.projectId,
      clientEmail: creds.clientEmail,
      privateKey: creds.privateKey,
    }),
    storageBucket: `${creds.projectId}.appspot.com`,
  });

  const storage = getStorage(app);
  const bucket = storage.bucket();
  console.log(`Using bucket: ${bucket.name}`);

  const imageDir = path.resolve(process.cwd(), "client/public/images/medilab");

  const files = [
    "hero-bg.jpg",
    "about.jpg",
    "departments-1.jpg",
    "departments-2.jpg",
    "departments-3.jpg",
    "departments-4.jpg",
    "departments-5.jpg",
    "doctors/doctors-1.jpg",
    "doctors/doctors-2.jpg",
    "doctors/doctors-3.jpg",
    "doctors/doctors-4.jpg",
    "testimonials/testimonials-1.jpg",
    "testimonials/testimonials-2.jpg",
    "testimonials/testimonials-3.jpg",
    "testimonials/testimonials-4.jpg",
    "testimonials/testimonials-5.jpg",
    "gallery/gallery-1.jpg",
    "gallery/gallery-2.jpg",
    "gallery/gallery-3.jpg",
    "gallery/gallery-4.jpg",
    "gallery/gallery-5.jpg",
    "gallery/gallery-6.jpg",
    "gallery/gallery-7.jpg",
    "gallery/gallery-8.jpg",
  ];

  const urlMap: Record<string, string> = {};

  for (const relPath of files) {
    const localPath = path.join(imageDir, relPath);
    if (!fs.existsSync(localPath)) {
      console.warn(`SKIP (not found): ${localPath}`);
      continue;
    }

    const destPath = `defaults/${relPath}`;
    const file = bucket.file(destPath);

    const buffer = fs.readFileSync(localPath);
    await file.save(buffer, {
      metadata: { contentType: "image/jpeg" },
    });
    await file.makePublic();

    const url = `https://storage.googleapis.com/${bucket.name}/${destPath}`;
    urlMap[relPath] = url;
    console.log(`Uploaded: ${relPath} -> ${url}`);
  }

  console.log("\n=== URL MAP (JSON) ===");
  console.log(JSON.stringify(urlMap, null, 2));
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
