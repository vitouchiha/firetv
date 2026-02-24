import { initializeApp } from "firebase/app";
import { getDatabase, ref, get, push, update } from "firebase/database";
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

    console.log("Avvio controllo aggiornamenti Paramount+...");

    try {
        // 1. Recupera la pagina di Uptodown per Paramount+
        const response = await fetch('https://com-cbs-ott.en.uptodown.com/android');
        const html = await response.text();

        // 2. Cerca l'ultima versione
        const versionMatch = html.match(/<span class="version">([^<]+)<\/span>/) || html.match(/"softwareVersion":"([^"]+)"/);
        
        if (!versionMatch) {
            return res.status(500).json({ error: 'Impossibile trovare la versione di Paramount+ su Uptodown.' });
        }

        const version = versionMatch[1];
        const appName = `Paramount+ ${version} US TV`;

        console.log(`Versione trovata su Uptodown: ${version}`);

        // 2.5 Costruisci il link diretto alla pagina di download dell'APK
        // L'utente vuole scaricare direttamente l'APK. Poiché i link di Uptodown scadono,
        // usiamo un nostro endpoint API che genera il link fresco al momento del click.
        const directDownloadPageUrl = `/api/download-paramount`;

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
        
        let existingKey = null;
        let existingApp = null;

        if (snapshot.exists()) {
            const apps = snapshot.val();
            // Cerchiamo se esiste già una scheda per Paramount+
            for (const [key, app] of Object.entries(apps)) {
                if (app.name && app.name.startsWith("Paramount+")) {
                    existingKey = key;
                    existingApp = app;
                    break;
                }
            }
        }

        const newAppData = {
            name: appName,
            code: directDownloadPageUrl, // Link alla pagina di download di Uptodown
            desc: `Versione ${version} — APK diretto Uptodown`,
            icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Paramount_Plus.svg/512px-Paramount_Plus.svg.png",
            category: "Streaming",
            timestamp: Date.now()
        };

        // 6. Se non esiste, aggiungila. Se esiste, aggiornala.
        if (!existingKey) {
            console.log(`Nuova app! Aggiungo ${appName} al database...`);
            newAppData.order = -1; // Mettilo all'inizio solo se è nuovo
            await push(dbRef, newAppData);
            console.log("Scheda aggiunta con successo!");
            
            // Invia notifiche Telegram e Email
            await notifyAll(appName, version, `https://${req.headers.host || 'tuosito.com'}${directDownloadPageUrl}`);
            
            return res.status(200).json({ success: true, message: `Aggiunta nuova versione: ${version}` });
        } else {
            // Se esiste già, controlliamo se dobbiamo aggiornarla (es. link diverso, versione vecchia o icona diversa)
            if (existingApp.name !== appName || existingApp.code !== directDownloadPageUrl || existingApp.desc !== newAppData.desc) {
                console.log(`Aggiorno la scheda esistente a ${appName}...`);
                await update(ref(db, `apps/${existingKey}`), newAppData);
                
                // Invia notifiche Telegram e Email
                await notifyAll(appName, version, `https://${req.headers.host || 'tuosito.com'}${directDownloadPageUrl}`);
                
                return res.status(200).json({ success: true, message: `Aggiornata versione esistente a: ${version}` });
            } else {
                console.log("La versione è già presente e aggiornata nel database.");
                return res.status(200).json({ success: true, message: `Nessun aggiornamento. Versione attuale: ${version}` });
            }
        }

    } catch (error) {
        console.error("Errore durante l'esecuzione:", error);
        return res.status(500).json({ error: error.message });
    }
}
