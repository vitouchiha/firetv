
import { initializeApp } from "firebase/app";
import { getDatabase, ref, get, update, push } from "firebase/database";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import gplay from 'google-play-scraper';
import dotenv from 'dotenv';
dotenv.config();

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

function categorizeApp(name, currentCat = '') {
    const lower = name.toLowerCase();

    if (lower.includes('vpn') || lower.includes('wireguard') || lower.includes('surfshark')) return 'VPN';
    if (lower.includes('kodi') || lower.includes('plex') || lower.includes('emby') || lower.includes('jellyfin')) return 'Media Center';
    if (lower.includes('launcher') || lower.includes('wolf') || lower.includes('home') || lower.includes('leanback')) return 'Launcher';
    if (lower.includes('stremio') || lower.includes('cinema') || lower.includes('bee') || lower.includes('film') || lower.includes('series') || lower.includes('popcorn') || lower.includes('tea') || lower.includes('nova') || lower.includes('syncler') || lower.includes('cloudstream') || lower.includes('onstream') || lower.includes('hdo') || lower.includes('cuco') || lower.includes('vivatv')) return 'Film & Serie TV';
    if (lower.includes('sport') || lower.includes('calcio') || lower.includes('dazn') || lower.includes('espn') || lower.includes('livescore') || lower.includes('arena')) return 'Sport';
    if (lower.includes('player') || lower.includes('vlc') || lower.includes('mx') || lower.includes('tivimate') || lower.includes('xciptv') || lower.includes('smarters') || lower.includes('implayer') || lower.includes('ott') || lower.includes('purple') || lower.includes('televizo') || lower.includes('sparkle')) return 'Player IPTV';
    if (lower.includes('clean') || lower.includes('boost') || lower.includes('file') || lower.includes('browser') || lower.includes('mouse') || lower.includes('kb') || lower.includes('speed') || lower.includes('test') || lower.includes('adb') || lower.includes('tools') || lower.includes('utility') || lower.includes('manager') || lower.includes('backup')) return 'Strumenti';
    if (lower.includes('store') || lower.includes('market') || lower.includes('aptoide') || lower.includes('aurora') || lower.includes('downloader') || lower.includes('unlinked') || lower.includes('filesynced') || lower.includes('apktime')) return 'Store Alternativi';
    if (lower.includes('youtube') || lower.includes('tube') || lower.includes('revanced') || lower.includes('piped') || lower.includes('newpipe') || lower.includes('smarttube')) return 'Streaming';

    // Keep existing good ones
    if (currentCat && currentCat !== 'Altro' && currentCat !== 'Strumenti' && currentCat !== 'Streaming' && currentCat !== 'undefined') {
        return currentCat;
    }
    
    return 'Altro';
}

async function scrapeTroypoint() {
    console.log("Fetching TroyPoint for fresh data...");
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

async function run() {
    try {
        console.log("Authenticating...");
        if (process.env.FIREBASE_ADMIN_EMAIL && process.env.FIREBASE_ADMIN_PASSWORD) {
            await signInWithEmailAndPassword(auth, process.env.FIREBASE_ADMIN_EMAIL, process.env.FIREBASE_ADMIN_PASSWORD);
        } else {
            console.log("No admin credentials found, trying anonymous access (might fail if rules are secure)...");
        }

        console.log("Reading existing apps...");
        const snapshot = await get(ref(db, 'apps'));
        const existingApps = snapshot.val() || {};
        
        console.log("Scraping TroyPoint...");
        const scrapedApps = await scrapeTroypoint();
        
        const updates = {};
        let addedCount = 0;
        let updatedCount = 0;
        let recategorizedCount = 0;

        // 1. Process Scraped Data
        for (const scraped of scrapedApps) {
            let foundKey = null;
            let existingApp = null;

            // Find existing by name
            for (const [key, val] of Object.entries(existingApps)) {
                if (val.name === scraped.name) {
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
                    updatedCount++;
                }
                // Cleanup desc
                if (existingApp.desc === "Imported from TroyPoint") {
                    updates[`apps/${foundKey}/desc`] = "";
                }
            } else {
                // New App
                const newRef = push(ref(db, 'apps'));
                const newCat = categorizeApp(scraped.name);
                
                // Try fetch icon
                let icon = "assets/nello.png";
                try {
                    const results = await gplay.search({ term: scraped.name, num: 1 });
                    if (results && results.length > 0) icon = results[0].icon;
                } catch(e) {}
                
                updates[`apps/${newRef.key}`] = {
                    name: scraped.name,
                    code: scraped.code,
                    desc: "",
                    category: newCat,
                    icon: icon,
                    timestamp: Date.now()
                };
                addedCount++;
            }
        }

        // 2. Re-Categorize ALL existing apps
        console.log("Re-categorizing ALL apps...");
        for (const [key, val] of Object.entries(existingApps)) {
            const newCat = categorizeApp(val.name, val.category);
            
            // Apply category if changed
            if (newCat !== val.category) {
                updates[`apps/${key}/category`] = newCat;
                recategorizedCount++;
                process.stdout.write(`Moved ${val.name} -> ${newCat}\n`);
            }
            
            // Remove "Imported from TroyPoint"
            if (val.desc === "Imported from TroyPoint") {
                updates[`apps/${key}/desc`] = "";
            }
        }

        if (Object.keys(updates).length > 0) {
            console.log(`Applying ${Object.keys(updates).length} updates to Firebase...`);
            await update(ref(db), updates);
            console.log("✅ Database updated successfully!");
            console.log(`Summary: Added ${addedCount}, Updated Links ${updatedCount}, Recategorized ${recategorizedCount}`);
        } else {
            console.log("No updates needed.");
        }

        process.exit(0);

    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
}

run();
