export default async function handler(req, res) {
    const isTV = req.query?.tv === 'true' || req.query?.tv === '1';

    try {
        if (isTV) {
            // --- Paramount+ Android TV (APKMirror) ---
            // APKMirror blocks server-side scraping via Cloudflare.
            // Strategy: use RSS feed to get latest release slug → build download page URL → redirect user there.
            // The RSS feed is publicly accessible and not protected.
            const rssRes = await fetch(
                'https://www.apkmirror.com/apk/viacomcbs-streaming/paramount-android-tv/feed/',
                { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RSS reader)' } }
            );
            const rssText = await rssRes.text();

            const linkMatch = rssText.match(/<link>https:\/\/www\.apkmirror\.com\/apk\/viacomcbs-streaming\/paramount-android-tv\/([^<]+?-release)\/<\/link>/);
            const releaseSlug = linkMatch ? linkMatch[1] : 'paramount-android-tv-latest-release';

            // Construct the APK download confirmation page URL from the slug
            // Slug pattern: paramount-android-tv-X-Y-Z-release
            // Download page: paramount-android-tv-X-Y-Z-android-apk-download
            const apkSlug = releaseSlug.replace('-release', '-android-apk-download');
            const apkDownloadUrl = `https://www.apkmirror.com/apk/viacomcbs-streaming/paramount-android-tv/${releaseSlug}/${apkSlug}/`;

            return res.redirect(302, apkDownloadUrl);

        } else {
            // --- Paramount+ Mobile/Tablet (Uptodown) ---
            const response = await fetch('https://com-cbs-ott.en.uptodown.com/android/download');
            const html = await response.text();
            const match = html.match(/id="detail-download-button"[^>]*data-url="([^"]+)"/);

            if (match) {
                const token = match[1];
                const dlUrl = 'https://dw.uptodown.com/dwn/' + token;
                const redirectResponse = await fetch(dlUrl, { redirect: 'manual' });
                const finalApkUrl = redirectResponse.headers.get('location');
                return res.redirect(302, finalApkUrl || dlUrl);
            } else {
                res.status(404).send('Download link not found');
            }
        }
    } catch (error) {
        console.error('Errore download Paramount+:', error.message);
        res.status(500).send('Error fetching download link');
    }
}