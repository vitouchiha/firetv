export default async function handler(req, res) {
    // mode=dedup → rimuove schede vecchie lasciando solo l'ultima versione per ogni app
    // mode=clean (default) → rimuove entry senza nome
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
            // Raggruppa per nome base (senza numeri di versione)
            function baseName(name) {
                return name.replace(/\b\d+[\d.]+\b/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
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
                entries.sort((a, b) => (b.app.timestamp || 0) - (a.app.timestamp || 0));
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

        const snapshot = await get(ref(db, 'apps'));
        const apps = snapshot.val();
        if (!apps) return res.status(200).json({ success: true, message: 'DB vuoto', removed: 0 });

        if (mode === 'dedup') {
            // Raggruppa per nome base (senza numeri di versione)
            function baseName(name) {
                return name.replace(/\b\d+[\d.]+\b/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
            }
            const groups = {};
            for (const [key, app] of Object.entries(apps)) {
                if (!app.name) continue;
                const base = baseName(app.name);
                if (!groups[base]) groups[base] = [];
                groups[base].push({ key, app });
            }
            const toDelete = [];
            for (const entries of Object.values(groups)) {
                if (entries.length <= 1) continue;
                entries.sort((a, b) => (b.app.timestamp || 0) - (a.app.timestamp || 0));
                toDelete.push(...entries.slice(1));
            }
            for (const { key } of toDelete) {
                await remove(ref(db, `apps/${key}`));
            }
            return res.status(200).json({
                success: true,
                removed: toDelete.length,
                details: toDelete.map(e => e.app.name)
            });
        } else {
            // Modalità default: rimuovi entry senza nome
            let removedCount = 0;
            for (const key in apps) {
                if (!apps[key].name) {
                    await remove(ref(db, `apps/${key}`));
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
