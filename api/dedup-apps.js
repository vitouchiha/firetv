// Rimuove le schede di versioni precedenti dal DB, tenendo solo l'ultima per ogni app.
// Chiamare una sola volta (o quando serve una pulizia).

export default async function handler(req, res) {
    const dbUrl = process.env.FIREBASE_DATABASE_URL;
    const apiKey = process.env.FIREBASE_API_KEY;
    const adminEmail = process.env.FIREBASE_ADMIN_EMAIL;
    const adminPassword = process.env.FIREBASE_ADMIN_PASSWORD;

    try {
        // 1. Autenticazione
        const authRes = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
            { method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: adminEmail, password: adminPassword, returnSecureToken: true }) }
        );
        const authData = await authRes.json();
        if (!authData.idToken) return res.status(500).json({ error: 'Auth fallita' });
        const token = authData.idToken;

        // 2. Leggi tutti gli app
        const appsRes = await fetch(`${dbUrl}/apps.json?auth=${token}`);
        const apps = await appsRes.json();
        if (!apps) return res.status(200).json({ success: true, message: 'DB vuoto', removed: 0 });

        // 3. Funzione per estrarre il nome base (senza versione numerica)
        // Es: "Stremio 1.9.8" → "stremio"
        //     "Paramount+ 16.6.1 US Fire TV APK" → "paramount+ us fire tv apk"
        //     "ReVanced Manager 5.0.0" → "revanced manager"
        function baseName(name) {
            return name
                .replace(/\b\d+[\d.]+\b/g, '') // rimuove numeri di versione (es. 1.9.8, 16.6.1)
                .replace(/\s+/g, ' ')
                .trim()
                .toLowerCase();
        }

        // 4. Raggruppa per nome base → { baseKey: [ {key, app}, ... ] }
        const groups = {};
        for (const [key, app] of Object.entries(apps)) {
            if (!app.name) continue;
            const base = baseName(app.name);
            if (!groups[base]) groups[base] = [];
            groups[base].push({ key, app });
        }

        // 5. Per ogni gruppo con più di 1 scheda, elimina le più vecchie
        const toDelete = [];
        for (const [base, entries] of Object.entries(groups)) {
            if (entries.length <= 1) continue;
            // Ordina per timestamp decrescente (più recente prima)
            entries.sort((a, b) => (b.app.timestamp || 0) - (a.app.timestamp || 0));
            // Tieni il primo, segna gli altri per eliminazione
            const keepers = entries.slice(0, 1);
            const toRemove = entries.slice(1);
            console.log(`Gruppo "${base}": tengo "${keepers[0].app.name}", rimuovo ${toRemove.map(e => '"' + e.app.name + '"').join(', ')}`);
            toDelete.push(...toRemove);
        }

        // 6. Elimina le schede obsolete
        for (const { key, app } of toDelete) {
            await fetch(`${dbUrl}/apps/${key}.json?auth=${token}`, { method: 'DELETE' });
            console.log(`Rimossa: [${key}] ${app.name}`);
        }

        return res.status(200).json({
            success: true,
            removed: toDelete.length,
            details: toDelete.map(e => e.app.name)
        });

    } catch (err) {
        console.error('Errore dedup:', err.message);
        return res.status(500).json({ error: err.message });
    }
}
