import { initializeApp } from "firebase/app";
import { getDatabase, ref, get, push } from "firebase/database";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { notifyAll } from "./utils/notify.js";

export default async function handler(req, res) {
    // Verifica che la richiesta provenga da Vercel Cron (sicurezza)
    /*
    if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
        // In locale o per test manuali, permettiamo l'esecuzione se non c'è CRON_SECRET
        if (process.env.VERCEL_ENV === 'production') {
            return res.status(401).json({ error: 'Non autorizzato' });
        }
    }
    */

    console.log("Avvio controllo aggiornamenti Stremio...");

    try {
        // 1. Recupera la pagina di Stremio
        const response = await fetch('https://www.stremio.com/downloads');
        const html = await response.text();

        // 2. Cerca la versione per Android TV ARM
        const match = html.match(/<a href="([^"]+)" title="Stremio for Android TV ARM">Stremio ([0-9.]+) ARM APK<\/a>/);
        
        if (!match) {
            return res.status(500).json({ error: 'Impossibile trovare la versione di Stremio sulla pagina.' });
        }

        const link = match[1];
        const version = match[2];
        const appName = `Stremio ${version} ARM TV`;

        console.log(`Versione trovata sul sito: ${version}`);

        // 3. Configura Firebase
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

        // 4. Effettua il login come amministratore
        const adminEmail = process.env.FIREBASE_ADMIN_EMAIL;
        const adminPassword = process.env.FIREBASE_ADMIN_PASSWORD;

        if (!adminEmail || !adminPassword) {
            return res.status(500).json({ error: 'Credenziali admin mancanti nelle variabili d\'ambiente.' });
        }

        await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
        console.log("Login Firebase effettuato con successo.");

        // 5. Controlla se la versione esiste già nel database
        const dbRef = ref(db, 'apps');
        const snapshot = await get(dbRef);
        
        let exists = false;
        if (snapshot.exists()) {
            const apps = snapshot.val();
            exists = Object.values(apps).some(app => app.name === appName || app.code === link);
        }

        // 6. Se non esiste, aggiungila
        if (!exists) {
            console.log(`Nuova versione confermata! Aggiungo ${appName} al database...`);
            
            const newApp = {
                name: appName,
                code: link,
                desc: "Ultima versione ufficiale",
                icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Stremio_Icon.svg/512px-Stremio_Icon.svg.png",
                timestamp: Date.now(),
                order: -1 // Mettilo all'inizio
            };
            
            await push(dbRef, newApp);
            console.log("Scheda aggiunta con successo!");
            
            // Invia notifiche
            await notifyAll(appName, version, link, newApp.icon);
            
            return res.status(200).json({ success: true, message: `Aggiunta nuova versione: ${version}` });
        } else {
            console.log("La versione è già presente nel database.");
            return res.status(200).json({ success: true, message: `Nessun aggiornamento. Versione attuale: ${version}` });
        }

    } catch (error) {
        console.error("Errore durante l'esecuzione:", error);
        return res.status(500).json({ error: error.message });
    }
}
