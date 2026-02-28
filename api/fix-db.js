export default async function handler(req, res) {
    // mode=dedup → rimuove schede vecchie lasciando solo l'ultima versione per ogni app
    // mode=clean (default) → rimuove entry senza nome
    // mode=purge-firestickhacks → rimuove tutte le voci aggiunte dallo scraper FirestickHacks
    // mode=list → restituisce tutte le schede (per debug)
    const mode = req.query?.mode || 'clean';

    const dbUrl = process.env.FIREBASE_DATABASE_URL;
    const apiKey = process.env.FIREBASE_API_KEY;

    try {
        // Autenticazione REST
        const authRes = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
            { method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: process.env.FIREBASE_ADMIN_EMAIL, password: process.env.FIREBASE_ADMIN_PASSWORD, returnSecureToken: true }) }
        );
        const authData = await authRes.json();
        if (!authData.idToken) return res.status(500).json({ error: 'Auth fallita' });
        const token = authData.idToken;

        const appsRes = await fetch(`${dbUrl}/apps.json?auth=${token}`);
        const apps = await appsRes.json();
        if (!apps) return res.status(200).json({ success: true, message: 'DB vuoto', removed: 0 });

        if (mode === 'dedup') {
            function baseName(name) {
                return name.replace(/\b\d+[\d.]+\b/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
            }
            function extractVersion(name) {
                const m = name.match(/\b(\d+)\.(\d+)(?:\.(\d+))?\b/);
                return m ? [parseInt(m[1]), parseInt(m[2]), parseInt(m[3] || 0)] : null;
            }
            function compareEntries(a, b) {
                const vA = extractVersion(a.app.name), vB = extractVersion(b.app.name);
                if (vA && vB) {
                    for (let i = 0; i < 3; i++) {
                        const d = (vB[i] || 0) - (vA[i] || 0);
                        if (d !== 0) return d; // versione più alta vince
                    }
                }
                return (b.app.timestamp || 0) - (a.app.timestamp || 0);
            }
            const groups = {};
            for (const [key, appObj] of Object.entries(apps)) {
                if (!appObj.name) continue;
                const base = baseName(appObj.name);
                if (!groups[base]) groups[base] = [];
                groups[base].push({ key, app: appObj });
            }
            const toDelete = [];
            for (const entries of Object.values(groups)) {
                if (entries.length <= 1) continue;
                entries.sort(compareEntries);
                toDelete.push(...entries.slice(1));
            }
            if (toDelete.length > 0) {
                const patchBody = {};
                for (const { key } of toDelete) patchBody[key] = null;
                await fetch(`${dbUrl}/apps.json?auth=${token}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(patchBody)
                });
            }
            return res.status(200).json({
                success: true,
                removed: toDelete.length,
                details: toDelete.map(e => e.app.name)
            });

        } else if (mode === 'fix') {
            // Fix puntali:
            // 1. Corregge categorie sbagliate su schede Paramount+
            // 2. Re-inserisce app Adobe mancanti (Photoshop Express, Premiere Rush, Lightroom)
            const patchBody = {};
            let fixCount = 0;

            for (const [key, appObj] of Object.entries(apps)) {
                const name = appObj.name || '';
                // Paramount+ schede → categoria Streaming
                if (name.includes('Paramount+') && appObj.category !== 'Streaming') {
                    patchBody[`${key}/category`] = 'Streaming';
                    fixCount++;
                }
            }

            // Adobe apps mancanti
            const adobeApps = [
                {
                    name: "Adobe Photoshop Express",
                    code: "https://apkpure.com/adobe-photoshop-express-photo-editor-collage-maker/com.adobe.psmobile/download",
                    desc: "Editor fotografico Adobe per Android TV e Fire TV",
                    category: "Adobe",
                    icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/Adobe_Photoshop_CC_icon.svg/240px-Adobe_Photoshop_CC_icon.svg.png",
                    timestamp: Date.now()
                },
                {
                    name: "Adobe Premiere Rush",
                    code: "https://apkpure.com/adobe-premiere-rush-video-editor/com.adobe.premiererush.videoeditor/download",
                    desc: "Editor video professionale Adobe per mobile e TV",
                    category: "Adobe",
                    icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Adobe_Premiere_Pro_logo_%282023%29.svg/240px-Adobe_Premiere_Pro_logo_%282023%29.svg.png",
                    timestamp: Date.now()
                },
                {
                    name: "Adobe Lightroom",
                    code: "https://apkpure.com/lightroom-photo-video-editor/com.adobe.lrmobile/download",
                    desc: "Editor foto e video professionale Adobe",
                    category: "Adobe",
                    icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Adobe_Photoshop_Lightroom_CC_logo.svg/240px-Adobe_Photoshop_Lightroom_CC_logo.svg.png",
                    timestamp: Date.now()
                }
            ];

            // Controlla se le app Adobe esistono già
            const existingNames = Object.values(apps).map(a => (a.name || '').toLowerCase().trim());
            for (const adobe of adobeApps) {
                if (!existingNames.includes(adobe.name.toLowerCase())) {
                    // Genera chiave casuale tipo Firebase push key
                    const newKey = 'adobe_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
                    patchBody[newKey] = adobe;
                    fixCount++;
                }
            }

            if (Object.keys(patchBody).length > 0) {
                await fetch(`${dbUrl}/apps.json?auth=${token}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(patchBody)
                });
            }
            return res.status(200).json({ success: true, fixed: fixCount, details: Object.keys(patchBody) });

        } else if (mode === 'purge-firestickhacks') {
            // Rimuove tutte le voci provenienti dallo scraper FirestickHacks
            // Identificate da: category="FireTV Hack"
            const toDelete = [];
            for (const [key, appObj] of Object.entries(apps)) {
                if ((appObj.category || '') === 'FireTV Hack' || (appObj.source || '').toLowerCase().includes('firestickhacks')) {
                    toDelete.push({ key, name: appObj.name });
                }
            }
            if (toDelete.length > 0) {
                // Batch delete: un singolo PATCH con tutti i null è molto più veloce di N DELETE separati
                const patchBody = {};
                for (const { key } of toDelete) patchBody[key] = null;
                await fetch(`${dbUrl}/apps.json?auth=${token}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(patchBody)
                });
            }
            return res.status(200).json({
                success: true,
                removed: toDelete.length,
                details: toDelete.map(e => e.name)
            });

        } else if (mode === 'list') {
            // Elenca tutte le schede (per debug)
            const entries = Object.entries(apps)
                .filter(([, a]) => a.name)
                .map(([key, a]) => ({ key, name: a.name, code: a.code, category: a.category, timestamp: a.timestamp }));
            return res.status(200).json({ success: true, count: entries.length, entries });

        } else {
            // Modalità default: rimuovi entry senza nome (batch)
            const patchBody = {};
            let removedCount = 0;
            for (const [key, appObj] of Object.entries(apps)) {
                if (!appObj.name) { patchBody[key] = null; removedCount++; }
            }
            if (removedCount > 0) {
                await fetch(`${dbUrl}/apps.json?auth=${token}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(patchBody)
                });
            }
            return res.status(200).json({ success: true, message: `Rimosse ${removedCount} entry corrotte.` });
        }

    } catch (error) {
        console.error("Errore:", error);
        return res.status(500).json({ error: error.message });
    }
}
