import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

function getCredentials() {
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountKey) {
    try {
      const parsed = JSON.parse(serviceAccountKey);
      if (parsed.project_id && parsed.client_email && parsed.private_key) {
        let pk = parsed.private_key;
        if (typeof pk === 'string' && pk.includes('\\n') && !pk.includes('\n')) pk = pk.replace(/\\n/g, '\n');
        return { projectId: parsed.project_id, clientEmail: parsed.client_email, privateKey: pk };
      }
    } catch {}
  }
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  if (clientEmail && privateKey && projectId) {
    let pk = privateKey;
    if (pk.includes('\\n') && !pk.includes('\n')) pk = pk.replace(/\\n/g, '\n');
    return { projectId, clientEmail, privateKey: pk };
  }
  throw new Error("Firebase credentials not found");
}

async function main() {
  const creds = getCredentials();
  console.log(`Using Firebase project: ${creds.projectId}`);

  const app = getApps().length > 0 ? getApps()[0] : initializeApp({
    credential: cert({ projectId: creds.projectId, clientEmail: creds.clientEmail, privateKey: creds.privateKey }),
  });

  const db = getFirestore(app);
  const imageDir = path.resolve(process.cwd(), "client/public/images/medilab");

  const files = [
    { key: "hero-bg", file: "hero-bg.jpg" },
    { key: "about", file: "about.jpg" },
    { key: "departments-1", file: "departments-1.jpg" },
    { key: "departments-2", file: "departments-2.jpg" },
    { key: "departments-3", file: "departments-3.jpg" },
    { key: "departments-4", file: "departments-4.jpg" },
    { key: "departments-5", file: "departments-5.jpg" },
    { key: "doctors-1", file: "doctors/doctors-1.jpg" },
    { key: "doctors-2", file: "doctors/doctors-2.jpg" },
    { key: "doctors-3", file: "doctors/doctors-3.jpg" },
    { key: "doctors-4", file: "doctors/doctors-4.jpg" },
    { key: "testimonials-1", file: "testimonials/testimonials-1.jpg" },
    { key: "testimonials-2", file: "testimonials/testimonials-2.jpg" },
    { key: "testimonials-3", file: "testimonials/testimonials-3.jpg" },
    { key: "testimonials-4", file: "testimonials/testimonials-4.jpg" },
    { key: "testimonials-5", file: "testimonials/testimonials-5.jpg" },
    { key: "gallery-1", file: "gallery/gallery-1.jpg" },
    { key: "gallery-2", file: "gallery/gallery-2.jpg" },
    { key: "gallery-3", file: "gallery/gallery-3.jpg" },
    { key: "gallery-4", file: "gallery/gallery-4.jpg" },
    { key: "gallery-5", file: "gallery/gallery-5.jpg" },
    { key: "gallery-6", file: "gallery/gallery-6.jpg" },
    { key: "gallery-7", file: "gallery/gallery-7.jpg" },
    { key: "gallery-8", file: "gallery/gallery-8.jpg" },
  ];

  let count = 0;
  for (const { key, file: relPath } of files) {
    const localPath = path.join(imageDir, relPath);
    if (!fs.existsSync(localPath)) {
      console.warn(`SKIP (not found): ${localPath}`);
      continue;
    }

    const buffer = fs.readFileSync(localPath);
    const base64 = buffer.toString("base64");
    const contentType = "image/jpeg";

    await db.collection("defaultImages").doc(key).set({
      key,
      fileName: relPath,
      contentType,
      data: base64,
      size: buffer.length,
      createdAt: new Date().toISOString(),
    });

    count++;
    console.log(`Stored: ${key} (${relPath}) - ${buffer.length} bytes -> /api/default-images/${key}`);
  }

  console.log(`\nDone! Uploaded ${count} images to Firestore 'defaultImages' collection.`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
