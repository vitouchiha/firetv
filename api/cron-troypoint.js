
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

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

function categorizeApp(name, currentCat = '') {
    const lower = name.toLowerCase();
    
    // Explicit keywords override generic categories
    if (lower.includes('vpn') || lower.includes('wireguard') || lower.includes('surfshark')) return 'VPN';
    if (lower.includes('kodi') || lower.includes('plex') || lower.includes('emby') || lower.includes('jellyfin')) return 'Media Center';
    if (lower.includes('launcher') || lower.includes('wolf') || lower.includes('home') || lower.includes('leanback')) return 'Launcher';
    if (lower.includes('stremio') || lower.includes('cinema') || lower.includes('bee') || lower.includes('film') || lower.includes('series') || lower.includes('popcorn') || lower.includes('tea') || lower.includes('nova') || lower.includes('syncler') || lower.includes('cloudstream') || lower.includes('onstream') || lower.includes('hdo') || lower.includes('cuco') || lower.includes('vivatv')) return 'Film & Serie TV';
    if (lower.includes('sport') || lower.includes('calcio') || lower.includes('dazn') || lower.includes('espn') || lower.includes('livescore') || lower.includes('arena')) return 'Sport';
    if (lower.includes('player') || lower.includes('vlc') || lower.includes('mx') || lower.includes('tivimate') || lower.includes('xciptv') || lower.includes('smarters') || lower.includes('implayer') || lower.includes('ott') || lower.includes('purple') || lower.includes('televizo') || lower.includes('sparkle')) return 'Player IPTV';
    if (lower.includes('clean') || lower.includes('boost') || lower.includes('file') || lower.includes('browser') || lower.includes('mouse') || lower.includes('kb') || lower.includes('speed') || lower.includes('test') || lower.includes('adb') || lower.includes('tools') || lower.includes('utility') || lower.includes('manager') || lower.includes('backup')) return 'Strumenti';
    if (lower.includes('store') || lower.includes('market') || lower.includes('aptoide') || lower.includes('aurora') || lower.includes('downloader') || lower.includes('unlinked') || lower.includes('filesynced') || lower.includes('apktime')) return 'Store Alternativi';
    if (lower.includes('youtube') || lower.includes('tube') || lower.includes('revanced') || lower.includes('piped') || lower.includes('newpipe') || lower.includes('smarttube')) return 'Streaming';

    // If current category is specific, keep it
    if (currentCat && currentCat !== 'Altro' && currentCat !== 'Strumenti' && currentCat !== 'Streaming') {
        return currentCat;
    }
    
    return 'Altro';
}

async function scrapeTroypoint() {
    try {
        const response = await fetch("https://troypoint.com/troypoint-toolbox/");
        const html = await response.text();
        const apps = [];
        
        const sections = html.split(/<h3[^>]*>/);
        for (let i = 1; i < sections.length; i++) {
            const section = sections[i];
            const appBlocks = section.split('class="inherit-container-width wp-block-group');
            for (let j = 1; j < appBlocks.length; j++) {
                const block = appBlocks[j];
                const nameMatch = block.match(/<p class="has-text-align-center"[^>]*>(.*?)<\/p>/);
                const linkMatch = block.match(/href="([^"]+)"[^>]*><strong>Download<\/strong>/);

                if (nameMatch && linkMatch) {
                    let name = nameMatch[1].replace(/<[^>]+>/g, '').trim();
                    const downloadUrl = linkMatch[1];
                    if (!name || name.length < 2 || name.includes("Note:") || name.toLowerCase().includes("tutorial")) continue;
                    name = name.replace(/&amp;/g, '&');
                    
                    if (!apps.some(a => a.name === name)) {
                        apps.push({
                            name: name,
                            code: downloadUrl,
                            timestamp: Date.now()
                        });
                    }
                }
            }
        }
        return apps;
    } catch (e) {
        console.error("Scrape failed:", e);
        return [];
    }
}

export default async function handler(req, res) {
    if (res.setHeader) res.setHeader('Access-Control-Allow-Origin', '*');

    try {
        if (process.env.FIREBASE_ADMIN_EMAIL && process.env.FIREBASE_ADMIN_PASSWORD) {
            await signInWithEmailAndPassword(auth, process.env.FIREBASE_ADMIN_EMAIL, process.env.FIREBASE_ADMIN_PASSWORD);
        }

        const [snapshot, ignoredSnapshot] = await Promise.all([
            get(ref(db, 'apps')),
            get(ref(db, 'troypoint_ignored'))
        ]);

        const existingApps = snapshot.val() || {};
        const scrapedApps = await scrapeTroypoint();

        // Costruisci set dei nomi ignorati (normalizzati)
        const ignoredNames = new Set();
        if (ignoredSnapshot.exists()) {
            Object.values(ignoredSnapshot.val()).forEach(entry => {
                if (entry.name) ignoredNames.add(entry.name.toLowerCase().trim());
            });
        }
        
        const updates = {};
        const notifications = [];
        
        // 1. Process Scraped Data (Add new or Update existing links)
        for (const scraped of scrapedApps) {
            const scrapedNameNorm = scraped.name.toLowerCase().trim();

            // Salta se l'admin ha eliminato questa app in precedenza
            if (ignoredNames.has(scrapedNameNorm)) {
                console.log(`Skipping ignored app: ${scraped.name}`);
                continue;
            }

            let foundKey = null;
            let existingApp = null;

            // Trova per nome (case-insensitive + trim per sicurezza)
            for (const [key, val] of Object.entries(existingApps)) {
                if (val.name && val.name.toLowerCase().trim() === scrapedNameNorm) {
                    foundKey = key;
                    existingApp = val;
                    break;
                }
            }

            if (foundKey) {
                // Check updates
                if (existingApp.code !== scraped.code) {
                    updates[`apps/${foundKey}/code`] = scraped.code;
                    updates[`apps/${foundKey}/timestamp`] = Date.now();
                    notifications.push({ name: scraped.name, version: "Aggiornata", link: scraped.code, icon: existingApp.icon });
                }
                // Cleanup desc if needed
                if (existingApp.desc === "Imported from TroyPoint") {
                    updates[`apps/${foundKey}/desc`] = "";
                }
            } else {
                // New App
                const newRef = push(ref(db, 'apps'));
                const newCat = categorizeApp(scraped.name);
                
                // Try fetch icon (import dinamico per evitare crash serverless)
                let icon = "assets/nello.png";
                try {
                    const gplay = (await import('google-play-scraper')).default;
                    const results = await gplay.search({ term: scraped.name, num: 1 });
                    if (results && results.length > 0) icon = results[0].icon;
                } catch(e) { console.warn("gplay icon fetch failed:", e.message); }
                
                updates[`apps/${newRef.key}`] = {
                    name: scraped.name,
                    code: scraped.code,
                    desc: "",
                    category: newCat,
                    icon: icon,
                    timestamp: Date.now()
                };
                notifications.push({ name: scraped.name, version: "Nuova App", link: scraped.code, icon: icon });
            }
        }

        // 2. Re-Categorize & Cleanup ALL existing apps (User Request)
        for (const [key, val] of Object.entries(existingApps)) {
            const newCat = categorizeApp(val.name, val.category);
            
            // Apply category if changed
            if (newCat !== val.category) {
                updates[`apps/${key}/category`] = newCat;
            }
            
            // Remove "Imported from TroyPoint"
            if (val.desc === "Imported from TroyPoint") {
                updates[`apps/${key}/desc`] = "";
            }
        }

        if (Object.keys(updates).length > 0) {
            await update(ref(db), updates);
            
            // Invia notifiche
            for (const notif of notifications) {
                await notifyAll(notif.name, notif.version, notif.link, notif.icon);
            }
        }

        return res.status(200).json({ success: true, updates: Object.keys(updates).length, ignored: ignoredNames.size });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
}
