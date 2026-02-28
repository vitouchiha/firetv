import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase, ref, get, update, push } from "firebase/database";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { notifyAll } from "./utils/notify.js";

const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.FIREBASE_DATABASE_URL,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID
};

const CATEGORY = "FireTV Hack";
const PAGE_URL = "https://firestickhacks.com/downloads/";

// Mappa sezione → sotto-categoria
const SECTION_MAP = {
    "Movies/TV Shows Apps": "Film & Serie TV",
    "Sports Apps": "Sport",
    "Live TV Apps": "TV Live",
    "IPTV Apps": "IPTV",
    "IPTV & Media Player": "Player IPTV",
    "Social Media": "Social",
    "Anime Apps": "Anime",
    "Utility Apps": "Utility",
    "Games Apps": "Giochi",
    "Podcasts/Music": "Musica",
    "App Stores": "App Store",
    "VPNs": "VPN"
};

// Icone di fallback per categoria
const FALLBACK_ICONS = {
    "Film & Serie TV": "https://cdn-icons-png.flaticon.com/512/3163/3163478.png",
    "Sport":           "https://cdn-icons-png.flaticon.com/512/857/857401.png",
    "TV Live":         "https://cdn-icons-png.flaticon.com/512/2168/2168433.png",
    "IPTV":            "https://cdn-icons-png.flaticon.com/512/1327/1327496.png",
    "Player IPTV":     "https://cdn-icons-png.flaticon.com/512/726/726571.png",
    "Social":          "https://cdn-icons-png.flaticon.com/512/2111/2111312.png",
    "Anime":           "https://cdn-icons-png.flaticon.com/512/2897/2897918.png",
    "Utility":         "https://cdn-icons-png.flaticon.com/512/900/900782.png",
    "Giochi":          "https://cdn-icons-png.flaticon.com/512/686/686589.png",
    "Musica":          "https://cdn-icons-png.flaticon.com/512/651/651717.png",
    "App Store":       "https://cdn-icons-png.flaticon.com/512/732/732200.png",
    "VPN":             "https://cdn-icons-png.flaticon.com/512/2913/2913461.png",
    "_default":        "https://cdn-icons-png.flaticon.com/512/2991/2991110.png"
};

function generateDesc(appName, subcategory) {
    const n = appName.replace(/\s*\(.*\)/, '').trim();
    const descs = {
        "Film & Serie TV": `${n} — Film e serie TV su Firestick`,
        "Sport":           `${n} — Streaming sportivo su Firestick`,
        "TV Live":         `${n} — TV in diretta su Firestick`,
        "IPTV":            `${n} — App IPTV per Firestick`,
        "Player IPTV":     `${n} — Player IPTV e media per Firestick`,
        "Social":          `${n} — Social media su Firestick`,
        "Anime":           `${n} — Streaming anime su Firestick`,
        "Utility":         `${n} — Strumenti e utility per Firestick`,
        "Giochi":          `${n} — Giochi su Firestick`,
        "Musica":          `${n} — Musica e podcast su Firestick`,
        "App Store":       `${n} — Store alternativo APK per Firestick`,
        "VPN":             `${n} — VPN per streaming sicuro su Firestick`
    };
    return descs[subcategory] || `${n} — App per Firestick`;
}

async function fetchIcon(appName) {
    try {
        const gplay = (await import('google-play-scraper')).default;
        const results = await gplay.search({ term: appName.replace(/\s*\(.*\)/, '').trim(), num: 1 });
        if (results?.length > 0) return results[0].icon;
    } catch (e) { /* ignore */ }
    return null;
}

async function scrapeFirestickHacks() {
    const res = await fetch(PAGE_URL, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,*/*',
            'Accept-Language': 'en-US,en;q=0.9',
        }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${PAGE_URL}`);
    const html = await res.text();

    const apps = [];

    // Trova tutte le sezioni h2 e la loro posizione nel HTML
    const sectionRegex = /<h2[^>]*>[\s\S]*?<\/h2>/gi;
    const sections = [];
    let m;
    while ((m = sectionRegex.exec(html)) !== null) {
        const raw = m[0].replace(/<[^>]+>/g, '').replace(/[*_]/g, '').trim();
        if (SECTION_MAP[raw]) {
            sections.push({ name: raw, sub: SECTION_MAP[raw], start: m.index + m[0].length });
        }
    }

    const SKIP_DOMAINS = [
        'firestickhacks.com', 'surfshark', 'affiliate', 'dmca.com',
        'fonts.google', 'twitter.com', 'youtube.com', 'reddit.com',
        'pinterest.com', 'facebook.com'
    ];

    for (let i = 0; i < sections.length; i++) {
        const sec = sections[i];
        const nextStart = sections[i + 1]?.start ?? html.length;
        const chunk = html.slice(sec.start, nextStart);

        // Estrai tutti i link del blocco: <a href="...">testo</a>
        const linkRe = /<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
        let lm;
        while ((lm = linkRe.exec(chunk)) !== null) {
            const url = lm[1].trim();
            const rawText = lm[2].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();

            // Salta link interni o promo
            if (!url || SKIP_DOMAINS.some(d => url.includes(d))) continue;
            if (!rawText || rawText.length < 3 || rawText.length > 100) continue;
            // Salta link che sembrano articoli o guide
            if (/^(how to|install|best |top \d|about|contact|dmca|privacy|affiliate)/i.test(rawText)) continue;

            // Pulisci il nome: rimuovi "[NEW]", "(APKM v..)", "(XAPK)", "(Newest Version)" ecc.
            const cleanName = rawText
                .replace(/\s*\[.*?\]/g, '')   // [NEW], [64BIT], [Formerly ...]
                .replace(/\s*\(APKM[^)]*\)/gi, '')
                .replace(/\s*\(XAPK[^)]*\)/gi, '')
                .replace(/\s*\(Newest Version\)/gi, '')
                .replace(/\s*NEW\s*$/i, '')
                .trim();

            if (cleanName.length < 2) continue;

            apps.push({ name: cleanName, code: url, subcategory: sec.sub });
        }
    }

    // Deduplicazione locale (stesso nome → tieni primo)
    const seen = new Set();
    return apps.filter(a => {
        const key = a.name.toLowerCase().replace(/\s+/g, ' ');
        if (seen.has(key)) return false;
        seen.add(key); return true;
    });
}

export default async function handler(req, res) {
    if (res.setHeader) res.setHeader('Access-Control-Allow-Origin', '*');
    console.log("Avvio scraping FirestickHacks...");

    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const db = getDatabase(app);
    const auth = getAuth(app);

    try {
        if (process.env.FIREBASE_ADMIN_EMAIL && process.env.FIREBASE_ADMIN_PASSWORD) {
            await signInWithEmailAndPassword(auth, process.env.FIREBASE_ADMIN_EMAIL, process.env.FIREBASE_ADMIN_PASSWORD);
        }

        // 1. Scarica lista dal sito
        const scraped = await scrapeFirestickHacks();
        console.log(`Trovate ${scraped.length} app su FirestickHacks`);
        if (scraped.length === 0) {
            return res.status(200).json({ success: false, message: 'Nessuna app trovata — possibile blocco o cambio struttura HTML' });
        }

        // 2. Leggi DB esistente
        const snapshot = await get(ref(db, 'apps'));
        const existingApps = snapshot.val() || {};

        const updates = {};
        const notifications = [];
        let added = 0, updated = 0;

        for (const scraped_app of scraped) {
            const normName = scraped_app.name.toLowerCase().trim();

            // Cerca entry esistente per questo nome (esatto, case-insensitive)
            let foundKey = null;
            let existingApp = null;
            for (const [key, val] of Object.entries(existingApps)) {
                if (val.name && val.name.toLowerCase().trim() === normName) {
                    foundKey = key;
                    existingApp = val;
                    break;
                }
            }

            if (foundKey) {
                // Aggiorna se il link è cambiato o mancano desc/sub
                const needsUpdate = existingApp.code !== scraped_app.code
                    || !existingApp.desc
                    || !existingApp.subcategory;

                if (needsUpdate) {
                    const patch = { timestamp: Date.now() };
                    if (existingApp.code !== scraped_app.code) {
                        patch.code = scraped_app.code;
                        notifications.push({ name: scraped_app.name, version: "Link aggiornato", link: scraped_app.code, icon: existingApp.icon });
                    }
                    if (!existingApp.desc) patch.desc = generateDesc(scraped_app.name, scraped_app.subcategory);
                    if (!existingApp.subcategory) patch.subcategory = scraped_app.subcategory;
                    // Forza categoria corretta
                    if (existingApp.category !== CATEGORY) patch.category = CATEGORY;

                    Object.entries(patch).forEach(([k, v]) => {
                        updates[`apps/${foundKey}/${k}`] = v;
                    });
                    updated++;
                }
            } else {
                // Nuova app → fetch icon
                let icon = null;
                // Tentiamo Google Play solo per app "famose" (non pixeldrain/mediafire)
                const isDirectApk = /pixeldrain|mediafire|fileroy|mega\.nz/i.test(scraped_app.code);
                if (!isDirectApk) {
                    icon = await fetchIcon(scraped_app.name);
                } else {
                    // Prova comunque
                    icon = await fetchIcon(scraped_app.name);
                }
                if (!icon) icon = FALLBACK_ICONS[scraped_app.subcategory] || FALLBACK_ICONS['_default'];

                const newRef = push(ref(db, 'apps'));
                updates[`apps/${newRef.key}`] = {
                    name: scraped_app.name,
                    code: scraped_app.code,
                    desc: generateDesc(scraped_app.name, scraped_app.subcategory),
                    category: CATEGORY,
                    subcategory: scraped_app.subcategory,
                    icon: icon,
                    timestamp: Date.now()
                };
                notifications.push({ name: scraped_app.name, version: "Nuova App", link: scraped_app.code, icon: icon });
                added++;
            }
        }

        if (Object.keys(updates).length > 0) {
            await update(ref(db), updates);
        }

        // 3. Notifiche (solo prime 5 per non spammare)
        const notifSlice = notifications.slice(0, 5);
        for (const notif of notifSlice) {
            await notifyAll(notif.name, notif.version, notif.link, notif.icon);
        }

        // 4. Dedup post-aggiornamento
        try {
            const baseUrl = process.env.BASE_URL || 'https://nellofire.vercel.app';
            const dedupRes = await fetch(`${baseUrl}/api/fix-db?mode=dedup`);
            const dedupData = await dedupRes.json();
            if (dedupData.removed > 0) {
                console.log(`[dedup] Rimosso ${dedupData.removed} schede obsolete`);
            }
        } catch (e) { console.warn("[dedup] Errore:", e.message); }

        return res.status(200).json({
            success: true,
            total: scraped.length,
            added,
            updated,
            notifications: notifications.length
        });

    } catch (error) {
        console.error("Errore cron-firestickhacks:", error);
        return res.status(500).json({ error: error.message });
    }
}
