import { initializeApp } from "firebase/app";
import { getDatabase, ref, update } from "firebase/database";
import https from 'https';

// --- CONFIGURAZIONE APP WINDOWS ---
const APPS = {
    scrcpy: {
        name: "scrcpy (Android Screen Mirroring)",
        repo: "Genymobile/scrcpy",
        assetFilter: (name) => name.includes("win64") && name.endsWith(".zip"),
        firebaseKey: "scrcpy_win64"
    },
    wsa_builds: {
        name: "WSA Builds (Windows Subsystem for Android)",
        repo: "MustardChef/WSABuilds",
        // Filtro per: GApps incluso E NoAmazon incluso. Escludiamo Magisk/KernelSU se non specificato (l'utente ha chiesto 'gapps no amazon')
        // Preferiamo la versione standard senza root per semplicità, a meno che l'utente non voglia root, ma "gapps no amazon" è generico.
        // Release assets: 
        // WSA_..._Release-Nightly-GApps-13.0-NoAmazon.7z
        // WSA_..._Release-Nightly-with-magisk-...-GApps-13.0-NoAmazon.7z
        // Prenderemo la versione più pulita (senza "with-magisk" o "with-KernelSU" nel nome se possibile, altrimenti la prima che matcha)
        assetFilter: (name) => {
            const lowerName = name.toLowerCase();
            return lowerName.includes("gapps") && 
                   lowerName.includes("noamazon") && 
                   !lowerName.includes("nogapps") && // ridondante ma sicuro
                   !lowerName.includes("magisk") && 
                   !lowerName.includes("kernelsu");
        },
        firebaseKey: "wsa_gapps_noamazon"
    }
};

// --- CODICI STATICI ---
const staticCodes = {
    "software/winhubx": {
        name: "WinHubX",
        version: "Static Code",
        code: "1303984",
        lastUpdated: new Date().toISOString()
    },
    "software/aimods_store": {
        name: "AIMODS-Store",
        version: "Static Code",
        code: "3386029",
        lastUpdated: new Date().toISOString()
    },
    "software/adobe_acrobat_pro_2025": {
        name: "Adobe_Acrobat_Pro_2025",
        version: "Static Code",
        code: "7855030",
        lastUpdated: new Date().toISOString()
    },
    "software/office_2016": {
        name: "Microsoft Office Professional Plus 2016",
        version: "Static Code",
        code: "2086958",
        lastUpdated: new Date().toISOString()
    }
};

const getLatestGithubRelease = async (repo) => {
    const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`);
    if (!response.ok) throw new Error(`GitHub API error: ${response.statusText}`);
    return await response.json();
};

export default async function handler(req, res) {
    /*
    if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
        if (process.env.VERCEL_ENV === 'production') {
            return res.status(401).json({ error: 'Non autorizzato' });
        }
    }
    */

    console.log("Avvio controllo aggiornamenti Windows Tools...");

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
    // Inizializza updates con i codici statici per assicurarci che siano sempre presenti/aggiornati
    const updates = { ...staticCodes };
    const log = ["Codici statici accodati per l'aggiornamento."];

    try {
        for (const [key, config] of Object.entries(APPS)) {
            try {
                log.push(`Controllo ${config.name}...`);
                const release = await getLatestGithubRelease(config.repo);
                const version = release.tag_name;
                
                const asset = release.assets.find(a => config.assetFilter(a.name));

                if (asset) {
                    updates[`software/${config.firebaseKey}`] = {
                        name: config.name,
                        version: version,
                        code: asset.browser_download_url, // Link diretto al download
                        lastUpdated: new Date().toISOString(),
                        releaseNote: `Release: ${release.name}`
                    };
                    log.push(`Trovato aggiornamento per ${config.name}: ${version} -> ${asset.name}`);
                } else {
                    log.push(`Nessun asset corrispondente trovato per ${config.name} nella release ${version}`);
                    // Logghiamo i nomi degli asset disponibili per debug
                    log.push(`Assets disponibili: ${release.assets.map(a => a.name).join(", ")}`);
                }

            } catch (err) {
                console.error(`Errore ${config.name}:`, err);
                log.push(`Errore ${config.name}: ${err.message}`);
            }
        }

        if (Object.keys(updates).length > 0) {
            await update(ref(db), updates);
            log.push("Database aggiornato.");
        } else {
            log.push("Nessun aggiornamento necessario.");
        }

        res.status(200).json({ success: true, log, updates });

    } catch (error) {
        console.error("Critical error:", error);
        res.status(500).json({ error: error.message, log });
    }
}
