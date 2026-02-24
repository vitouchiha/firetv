import { initializeApp } from "firebase/app";
import { getDatabase, ref, push, get, query, orderByChild, equalTo } from "firebase/database";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Metodo non consentito' });
    }

    const { email } = req.body;

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        return res.status(400).json({ error: 'Email non valida' });
    }

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

        const adminEmail = process.env.FIREBASE_ADMIN_EMAIL;
        const adminPassword = process.env.FIREBASE_ADMIN_PASSWORD;

        await signInWithEmailAndPassword(auth, adminEmail, adminPassword);

        const subscribersRef = ref(db, 'subscribers');
        
        // Controlla se l'email esiste già
        const emailQuery = query(subscribersRef, orderByChild('email'), equalTo(email));
        const snapshot = await get(emailQuery);

        if (snapshot.exists()) {
            return res.status(400).json({ error: 'Sei già iscritto alle notifiche!' });
        }

        // Aggiungi nuovo iscritto
        await push(subscribersRef, {
            email: email,
            timestamp: Date.now()
        });

        return res.status(200).json({ success: true, message: 'Iscrizione completata con successo!' });

    } catch (error) {
        console.error("Errore durante l'iscrizione:", error);
        return res.status(500).json({ error: 'Errore interno del server' });
    }
}
