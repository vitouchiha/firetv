import { notifyAll } from "./utils/notify.js";

export default async function handler(req, res) {
    console.log("Avvio controllo aggiornamenti Paramount+ Android TV...");

    const headers = {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
    };

    const dbUrl = process.env.FIREBASE_DATABASE_URL;
    const apiKey = process.env.FIREBASE_API_KEY;
    const adminEmail = process.env.FIREBASE_ADMIN_EMAIL;
    const adminPassword = process.env.FIREBASE_ADMIN_PASSWORD;

    try {
        // 1. Leggi RSS APKMirror per Paramount+ Android TV
        const rssRes = await fetch('https://www.apkmirror.com/apk/viacomcbs-streaming/paramount-android-tv/feed/', { headers });
        const rssText = await rssRes.text();

        const titleMatch = rssText.match(/<title>Paramount\+[^<]*?(\d+\.\d+[\d.]*)[^<]*?<\/title>/);
        const versionMatch = rssText.match(/paramount-android-tv-([\d-]+)-release/);

        if (!titleMatch && !versionMatch) {
            return res.status(500).json({ error: 'Impossibile trovare la versione Paramount+ TV nel feed RSS.' });
        }

        // Estrai la versione dal titolo o dallo slug
        let version = '';
        if (titleMatch) {
            version = titleMatch[1];
        } else if (versionMatch) {
            version = versionMatch[1].replace(/-/g, '.');
        }

        const appName = `Paramount+ ${version} Android TV`;
        const downloadUrl = `/api/download-paramount?tv=true`;
        console.log(`Versione trovata su APKMirror: ${version}`);

        // 2. Autentica su Firebase
        const authResponse = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: adminEmail, password: adminPassword, returnSecureToken: true })
            }
        );
        const authData = await authResponse.json();
        if (!authResponse.ok || !authData.idToken) {
            return res.status(500).json({ error: 'Errore autenticazione Firebase' });
        }
        const token = authData.idToken;

        // 3. Leggi il DB per trovare una scheda esistente per Paramount+ TV
        const appsRes = await fetch(`${dbUrl}/apps.json?auth=${token}`);
        const apps = await appsRes.json();

        let existingKey = null;
        let existingApp = null;
        if (apps) {
            for (const [key, app] of Object.entries(apps)) {
                if (app.name && app.name.includes('Paramount+') && app.name.includes('Android TV')) {
                    existingKey = key;
                    existingApp = app;
                    break;
                }
            }
        }

        const newAppData = {
            name: appName,
            code: downloadUrl,
            desc: `Versione ${version} — APK diretto APKMirror`,
            icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Paramount_Plus.svg/512px-Paramount_Plus.svg.png",
            category: "Streaming",
            timestamp: Date.now()
        };

        if (!existingKey) {
            // Aggiungi nuova scheda
            newAppData.order = -1;
            await fetch(`${dbUrl}/apps.json?auth=${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newAppData)
            });
            console.log('Nuova scheda Paramount+ TV aggiunta!');

            await notifyAll(appName, version, `https://${req.headers.host}${downloadUrl}`);
            return res.status(200).json({ success: true, message: `Aggiunta nuova versione TV: ${version}` });

        } else if (existingApp.name !== appName || existingApp.desc !== newAppData.desc) {
            // Aggiorna scheda esistente
            await fetch(`${dbUrl}/apps/${existingKey}.json?auth=${token}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newAppData)
            });
            console.log(`Scheda Paramount+ TV aggiornata a ${version}`);

            await notifyAll(appName, version, `https://${req.headers.host}${downloadUrl}`);
            return res.status(200).json({ success: true, message: `Aggiornata versione TV: ${version}` });

        } else {
            return res.status(200).json({ success: true, message: `Nessun aggiornamento. Versione TV attuale: ${version}` });
        }

    } catch (error) {
        console.error('Errore check Paramount+ TV:', error.message);
        return res.status(500).json({ error: 'Errore interno del server' });
    }
}
