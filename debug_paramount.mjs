
// Use built-in fetch if possible or require node-fetch
// Assuming Node.js 18+ has fetch built-in, we just remove the import
//import fetch from 'node-fetch'; 

async function testParamount() {
    try {
        console.log("Fetching RSS...");
        const response = await fetch('https://www.apkmirror.com/apk/cbs-interactive-inc/paramount-2/feed/');
        const xml = await response.text();

        // Regex from the original file
        // Note: I need to simulate exact behavior
        const match = xml.match(/<title>Paramount\+ \(Android TV\) ([\d\.]+)[^<]*<\/title>\s*<link>(https:\/\/www\.apkmirror\.com\/apk\/cbs-interactive-inc\/paramount-2\/paramount-android-tv-[^/]+-release\/)<\/link>/);
        
        if (!match) {
            console.log("No match found in RSS");
            return;
        }

        const version = match[1];
        const releaseUrl = match[2];
        console.log(`Version: ${version}`);
        console.log(`Release URL: ${releaseUrl}`);

        const versionDashes = version.replace(/\./g, '-');
        // Original logic:
        // const directDownloadPageUrl = `${releaseUrl}paramount-android-tv-${versionDashes}-android-apk-download/`;
        // But the release URL structure on APKMirror might have changed or be different.
        
        // Let's print the releaseUrl to verify it matches what we expect
        // It usually is .../paramount-android-tv-x-y-z-release/
        
        // The page at releaseUrl lists variants. 
        // The "download" page is usually constructed by appending more specific slug.
        
        console.log("Fetching Release Page to find the actual download page link...");
        const releasePageRes = await fetch(releaseUrl);
        const releasePageHtml = await releasePageRes.text();
        
        // We want the 'APK' or 'BUNDLE' download link.
        // Usually there is a big button or link class="accent_bg btn btn-flat downloadButton"
        // referring to the download page.
        
        // Let's look for the download link pattern in the release page
        // href="/apk/cbs-interactive-inc/paramount-2/paramount-android-tv-12-0-38-release/paramount-android-tv-12-0-38-android-apk-download/"
        
        const downloadLinkRegex = new RegExp(`href="([^"]*paramount-android-tv-${versionDashes}-android-apk-download\/)"`);
        const dlMatch = releasePageHtml.match(downloadLinkRegex);
        
        if (dlMatch) {
            const downloadPagePath = dlMatch[1];
            const downloadPageUrl = 'https://www.apkmirror.com' + downloadPagePath;
            console.log("Download Page URL found: ", downloadPageUrl);
            
            // Now fetch the download page to find the REAL direct link? 
            // APKMirror usually has a "here" link or similar, but it redirects.
            // Often: <a rel="nofollow" href="/wp-content/themes/APKMirror/download.php?id=..." class="...">Download APK</a>
            
            const dlPageRes = await fetch(downloadPageUrl);
            const dlPageHtml = await dlPageRes.text();
            
            // Look for "download.php?id="
            // const idMatch = dlPageHtml.match(/href="([^"]*download\.php\?id=[^"]*)"/);
            // DEBUG: print parts of HTML to see what the button looks like
            const buttonMatch = dlPageHtml.match(/<a[^>]*class="[^"]*downloadButton[^"]*"[^>]*>/);
            if (buttonMatch) {
                console.log("Found download button HTML: ", buttonMatch[0]);
            } else {
                console.log("Could not find download button with class downloadButton");
                // maybe search for "Download APK" text
                const textMatch = dlPageHtml.match(/<a[^>]*>[\s\S]{0,50}Download (APK|Bundle)[\s\S]{0,50}<\/a>/);
                 if (textMatch) {
                    console.log("Found link with text 'Download APK/Bundle': ", textMatch[0]);
                 }
            }

        } else {
            console.log("Could not find download page link in release page");
            // Maybe the constructed one was correct?
            // console.log("Trying constructed: ", directDownloadPageUrl);
        }

    } catch (e) {
        console.error(e);
    }
}

testParamount();
