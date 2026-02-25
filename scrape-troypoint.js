
import fs from 'fs';
import path from 'path'; 
import gplay from 'google-play-scraper';
import { initializeApp } from "firebase/app";
import { getDatabase, ref, push } from "firebase/database";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Handling __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env if available
dotenv.config();

// --- SCRAPER ---
async function scrapeTroypoint() {
    console.log("Fetching TroyPoint Toolbox...");
    const response = await fetch("https://troypoint.com/troypoint-toolbox/");
    const html = await response.text();

    console.log("Parsing HTML...");
    
    // Simple regex parser because no DOM
    const apps = [];
    let currentCategory = "Strumenti"; // Default fallback

    // Split significantly by h3 tags to handle categories
    // Each section starts with the category name (because we split by <h3...>)
    // Then contains all content until next H3.
    const sections = html.split(/<h3[^>]*>/);

    // Skip the first section (header stuff before first H3)
    for (let i = 1; i < sections.length; i++) {
        const section = sections[i];
        
        // Extract category name from the very beginning of the section
        // Since we split by <h3...>, the opening tag is gone, but the name + </h3> is at the start.
        const catEndIndex = section.indexOf('</h3>');
        if (catEndIndex !== -1) {
            let catName = section.substring(0, catEndIndex).replace(/<[^>]+>/g, '').trim();
            
            // Map known categories to our system
            if (catName.includes("VPN")) catName = "Strumenti";
            else if (catName.includes("Kodi")) catName = "Streaming";
            else if (catName.includes("Streaming")) catName = "Streaming";
            else if (catName.includes("IPTV")) catName = "Streaming"; 
            else if (catName.includes("Launchers")) catName = "Launcher";
            else if (catName.includes("Video Players")) catName = "Strumenti";
            else if (catName.includes("App Stores")) catName = "Strumenti";
            else if (catName.includes("Tools")) catName = "Strumenti";
            else if (catName.includes("Windows")) continue; // Skip Windows apps
            
            // Clean up emojis
            catName = catName.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '').trim();

            currentCategory = catName;
        }

        // Now split specifically by the container div that wraps each app
        // Based on inspection: <div class="inherit-container-width wp-block-group
        const appBlocks = section.split('class="inherit-container-width wp-block-group');

        // Skip the first part of the split (content before first app)
        for (let j = 1; j < appBlocks.length; j++) {
            const block = appBlocks[j];

            // 1. Extract Name
            // Look for <p class="has-text-align-center" ... >Name</p>
            // Use a regex that allows optional attributes
            const nameMatch = block.match(/<p class="has-text-align-center"[^>]*>(.*?)<\/p>/);
            
            // 2. Extract Download Link
            // Look for href="..." ... ><strong>Download</strong>
            // Note: Sometimes strong is inside a, sometimes outside? Usually inside based on inspection.
            // <a ... ><strong>Download</strong></a>
            const linkMatch = block.match(/href="([^"]+)"[^>]*><strong>Download<\/strong>/);

            if (nameMatch && linkMatch) {
                let name = nameMatch[1].replace(/<[^>]+>/g, '').trim();
                const downloadUrl = linkMatch[1];
                
                // Filter out junk
                if (!name || name.length < 2) continue;
                if (name.includes("Note:")) continue; 
                // Sometimes scraping picks up "Tutorial" or other text. Validate.
                if (name.toLowerCase().includes("tutorial")) continue;

                // Clean up name
                name = name.replace(/&amp;/g, '&');
                
                // Check duplicates in global list
                if (apps.some(a => a.name === name)) continue;

                const newApp = {
                    name: name, 
                    code: downloadUrl,
                    desc: "Imported from TroyPoint",
                    category: currentCategory,
                    icon: "assets/nello.png", // Default placeholder
                    timestamp: Date.now()
                };
                apps.push(newApp);
            }
        }
    }
    
    console.log(`Found ${apps.length} apps.`);
    return apps;
}

// --- ICON FINDER ---
async function findIconForApp(appName) {
    try {
        const results = await gplay.search({ term: appName, num: 1 });
        if (results && results.length > 0) {
            return results[0].icon;
        }
    } catch (e) {
        // console.warn(`Icon not found for ${appName}`);
    }
    return null;
}

// --- MAIN ---
async function main() {
    try {
        // 1. Scrape
        const scrapedApps = await scrapeTroypoint();
        
        if (scrapedApps.length === 0) {
            console.log("No apps found. Something is wrong with the scraper regex.");
            return;
        }

        // Limit for testing? No, user wants all.
        // const scrapedAppsProcessed = scrapedApps.slice(0, 5); 
        const scrapedAppsProcessed = scrapedApps;

        // 2. Enrich with Icons
        console.log("Enriching with icons (this may take a while)...");
        
        for (let i = 0; i < scrapedAppsProcessed.length; i++) {
            const app = scrapedAppsProcessed[i];
            process.stdout.write(`[${i + 1}/${scrapedAppsProcessed.length}] ${app.name}... `);
            
            const iconUrl = await findIconForApp(app.name);
            if (iconUrl) {
                app.icon = iconUrl;
                process.stdout.write("✅ Icon found\n");
            } else {
                process.stdout.write("❌ No icon\n");
            }
            
            // Rate limit to avoid blocking from Google
            await new Promise(resolve => setTimeout(resolve, 1000)); 
        }

        // 3. Try Firebase Upload IF configured
        // Check for required env vars
        if (process.env.FIREBASE_API_KEY && process.env.FIREBASE_DATABASE_URL && process.env.FIREBASE_DATABASE_URL !== "FIREBASE_DATABASE_URL_PLACEHOLDER") {
            console.log("\nLogging in to Firebase...");
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

            if (process.env.FIREBASE_ADMIN_EMAIL && process.env.FIREBASE_ADMIN_PASSWORD) {
                await signInWithEmailAndPassword(auth, process.env.FIREBASE_ADMIN_EMAIL, process.env.FIREBASE_ADMIN_PASSWORD);
                console.log("Logged in.");
            } else {
                console.log("No admin credentials provided. Attempting public write...");
            }

            const appsRef = ref(db, 'apps');
            console.log(`Uploading ${scrapedAppsProcessed.length} apps to Firebase...`);
            
            let uploaded = 0;
            for (const item of scrapedAppsProcessed) {
                await push(appsRef, item);
                uploaded++;
                if (uploaded % 10 === 0) process.stdout.write('.');
            }
            console.log(`\nSuccessfully uploaded ${uploaded} apps!`);

        } else {
            console.log("\n⚠️  No Firebase config found or using placeholders. Skipping upload.");
            const jsonPath = path.resolve(__dirname, 'scraped_apps.json');
            console.log(`Saving to '${jsonPath}' instead.`);
            fs.writeFileSync(jsonPath, JSON.stringify(scrapedAppsProcessed, null, 2));
            console.log("Done. You can upload this file later or configure .env.");
        }
        
        process.exit(0);

    } catch (error) {
        console.error("FATAL ERROR:", error);
        process.exit(1);
    }
}

main();
