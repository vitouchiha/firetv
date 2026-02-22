import { initializeApp } from "firebase/app";
import { getDatabase, ref, get, remove } from "firebase/database";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

export default async function handler(req, res) {
    try {
        const firebaseConfig = {
            apiKey: process.env.FIREBASE_API_KEY,
            authDomain: process.env.FIREBASE_AUTH_DOMAIN,
            databaseURL: process.env.FIREBASE_DATABASE_URL,
            projectId: process.env.FIREBASE_PROJECT_ID,
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
            messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
            appId: process.env.FIREBASE_APP_ID
        };

        const app = initializeApp(firebaseConfig);
        const db = getDatabase(app);
        const auth = getAuth(app);

        await signInWithEmailAndPassword(auth, process.env.FIREBASE_ADMIN_EMAIL, process.env.FIREBASE_ADMIN_PASSWORD);
        
        const snapshot = await get(ref(db, 'apps'));
        const apps = snapshot.val();
        let removedCount = 0;
        
        for (const key in apps) {
            if (!apps[key].name) {
                console.log("Rimuovo entry corrotta:", key, apps[key]);
                await remove(ref(db, `apps/${key}`));
                removedCount++;
            }
        }
        
        return res.status(200).json({ success: true, message: `Rimosse ${removedCount} entry corrotte.` });
    } catch (error) {
        console.error("Errore:", error);
        return res.status(500).json({ error: error.message });
    }
}
