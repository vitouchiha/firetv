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
            for (const { key } of toDelete) {
                await fetch(`${dbUrl}/apps/${key}.json?auth=${token}`, { method: 'DELETE' });
            }
            return res.status(200).json({
                success: true,
                removed: toDelete.length,
                details: toDelete.map(e => e.app.name)
            });

        } else if (mode === 'purge-firestickhacks') {
            // Rimuove tutte le voci provenienti dallo scraper FirestickHacks
            // Identificate da: category="FireTV Hack" OR code contenente firestickhacks/pixeldrain/mediafire aggiunto in blocco
            // Il modo sicuro: categoria "FireTV Hack" (impostata dallo scraper)
            const toDelete = [];
            for (const [key, appObj] of Object.entries(apps)) {
                const code = (appObj.code || '').toLowerCase();
                const source = (appObj.source || '').toLowerCase();
                const category = (appObj.category || '');
                const name = (appObj.name || '').toLowerCase();
                if (
                    category === 'FireTV Hack' ||
                    source.includes('firestickhacks') ||
                    name.includes('firestickhacks')
                ) {
                    toDelete.push({ key, name: appObj.name });
                }
            }
            for (const { key } of toDelete) {
                await fetch(`${dbUrl}/apps/${key}.json?auth=${token}`, { method: 'DELETE' });
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
            // Modalità default: rimuovi entry senza nome
            let removedCount = 0;
            for (const [key, appObj] of Object.entries(apps)) {
                if (!appObj.name) {
                    await fetch(`${dbUrl}/apps/${key}.json?auth=${token}`, { method: 'DELETE' });
                    removedCount++;
                }
            }
            return res.status(200).json({ success: true, message: `Rimosse ${removedCount} entry corrotte.` });
        }

    } catch (error) {
        console.error("Errore:", error);
        return res.status(500).json({ error: error.message });
    }
}
