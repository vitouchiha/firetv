import { initializeApp } from "firebase/app";
import { getDatabase, ref, get, push } from "firebase/database";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

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

    console.log("Avvio controllo aggiornamenti Paramount+...");

    try {
        // 1. Recupera il feed RSS di APKMirror per Paramount+ Android TV
        const response = await fetch('https://www.apkmirror.com/apk/cbs-interactive-inc/paramount-2/feed/');
        const xml = await response.text();

        // 2. Cerca l'ultima versione e il link della pagina di release
        const match = xml.match(/<title>Paramount\+ \(Android TV\) ([\d\.]+)[^<]*<\/title>\s*<link>(https:\/\/www\.apkmirror\.com\/apk\/cbs-interactive-inc\/paramount-2\/paramount-android-tv-[^/]+-release\/)<\/link>/);
        
        if (!match) {
            return res.status(500).json({ error: 'Impossibile trovare la versione di Paramount+ nel feed RSS.' });
        }

        const version = match[1];
        const releaseUrl = match[2];
        const appName = `Paramount+ ${version} US TV`;

        console.log(`Versione trovata sul feed: ${version}`);

        // 2.5 Costruisci il link diretto alla pagina di download dell'APK
        // Sostituiamo i punti della versione con i trattini (es. 16.5.0 -> 16-5-0)
        const versionDashes = version.replace(/\./g, '-');
        const directDownloadPageUrl = `${releaseUrl}paramount-android-tv-${versionDashes}-android-apk-download/`;

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
            exists = Object.values(apps).some(app => app.name === appName || app.code === directDownloadPageUrl);
        }

        // 6. Se non esiste, aggiungila
        if (!exists) {
            console.log(`Nuova versione confermata! Aggiungo ${appName} al database...`);
            
            const newApp = {
                name: appName,
                code: directDownloadPageUrl, // Link alla pagina di download di APKMirror
                desc: "Scarica da APKMirror",
                icon: "https://play-lh.googleusercontent.com/rdzfnSN_CJ0930nHwaZbD8my6X_s8xAFORVg6gvdUTiNz5qgYqObKEVIT8mOzapaUB4T=w240-h480-rw",
                category: "Streaming",
                timestamp: Date.now(),
                order: -1 // Mettilo all'inizio
            };
            
            const newAppRef = await push(dbRef, newApp);
            console.log("Scheda aggiunta con successo!");
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
