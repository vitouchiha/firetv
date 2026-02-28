import { notifyAll } from "./utils/notify.js";

export default async function handler(req, res) {
    console.log("Avvio controllo aggiornamenti Paramount+ US (Fire TV)...");

    const headers = {
        'User-Agent': 'Mozilla/5.0 (compatible; RSS reader)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
    };

    const dbUrl = process.env.FIREBASE_DATABASE_URL;
    const apiKey = process.env.FIREBASE_API_KEY;
    const adminEmail = process.env.FIREBASE_ADMIN_EMAIL;
    const adminPassword = process.env.FIREBASE_ADMIN_PASSWORD;

    try {
        // 1. Leggi RSS APKMirror per Paramount+ US (com.cbs.app - versione americana, compatibile Fire TV)
        const rssRes = await fetch('https://www.apkmirror.com/apk/cbs-interactive-inc/paramount/feed/', { headers });
        const rssText = await rssRes.text();

        const titleMatch = rssText.match(/<title>Paramount\+\s*([\d.]+)[^<]*<\/title>/);
        const slugMatch = rssText.match(/<link>https:\/\/www\.apkmirror\.com\/apk\/cbs-interactive-inc\/paramount\/(paramount-[\d-]+-release)\/<\/link>/);

        if (!titleMatch) {
            return res.status(500).json({ error: 'Impossibile trovare la versione Paramount+ US nel feed RSS.' });
        }

        const version = titleMatch[1];
        const releaseSlug = slugMatch ? slugMatch[1] : null;
        const appName = `Paramount+ ${version} US Fire TV`;
        // Usa sempre l'endpoint API che gestisce il download via proxy (got-scraping + Webshare)
        const downloadUrl = `/api/download-paramount?tv=us`;

        console.log(`Versione US trovata su APKMirror: ${version} — slug: ${releaseSlug}`);

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
                if (app.name && app.name.includes('Paramount+') && (app.name.includes('Android TV') || app.name.includes('US Fire TV'))) {
                    existingKey = key;
                    existingApp = app;
                    break;
                }
            }
        }

        const newAppData = {
            name: appName,
            code: downloadUrl,
            desc: `Versione ${version} USA — Download diretto APKMirror (compatibile Fire TV con proxy US)`,  
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

            await notifyAll(appName, version, downloadUrl);
            return res.status(200).json({ success: true, message: `Aggiunta nuova versione US Fire TV: ${version}` });

        } else if (existingApp.name !== appName || existingApp.desc !== newAppData.desc) {
            // Aggiorna scheda esistente
            await fetch(`${dbUrl}/apps/${existingKey}.json?auth=${token}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newAppData)
            });
            console.log(`Scheda Paramount+ US Fire TV aggiornata a ${version}`);

            await notifyAll(appName, version, downloadUrl);
            return res.status(200).json({ success: true, message: `Aggiornata versione US Fire TV: ${version}` });

        } else {
            return res.status(200).json({ success: true, message: `Nessun aggiornamento. Versione TV attuale: ${version}` });
        }

    } catch (error) {
        console.error('Errore check Paramount+ TV:', error.message);
        return res.status(500).json({ error: 'Errore interno del server' });
    }
}
