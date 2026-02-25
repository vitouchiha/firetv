export default async function handler(req, res) {
    const isTV = req.query?.tv === 'true' || req.query?.tv === '1';

    try {
        if (isTV) {
            // --- Paramount+ Android TV (APKMirror) ---
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Referer': 'https://www.apkmirror.com/'
            };

            const rssRes = await fetch('https://www.apkmirror.com/apk/viacomcbs-streaming/paramount-android-tv/feed/', { headers });
            const rssText = await rssRes.text();

            const linkMatch = rssText.match(/<link>https:\/\/www\.apkmirror\.com\/apk\/viacomcbs-streaming\/paramount-android-tv\/([^<]+?-release)\/<\/link>/);
            if (!linkMatch) {
                return res.status(404).send('Release non trovata nel feed RSS APKMirror');
            }

            const releaseSlug = linkMatch[1];
            const releasePage = `https://www.apkmirror.com/apk/viacomcbs-streaming/paramount-android-tv/${releaseSlug}/`;

            const releaseRes = await fetch(releasePage, { headers });
            const releaseHtml = await releaseRes.text();

            const dlPageMatch = releaseHtml.match(/href="(\/apk\/viacomcbs-streaming\/paramount-android-tv\/[^"]+?-android-apk-download\/)"/);
            if (!dlPageMatch) {
                return res.redirect(302, releasePage);
            }

            const downloadPageUrl = 'https://www.apkmirror.com' + dlPageMatch[1];
            const dlPageRes = await fetch(downloadPageUrl, { headers });
            const dlHtml = await dlPageRes.text();

            const finalMatch = dlHtml.match(/href="(https:\/\/[^"]*downloadr[^"]+\.apk[^"]*)"/i)
                || dlHtml.match(/href="([^"]*\/wp-content\/[^"]+\.apk[^"]*)"/i);

            if (finalMatch) {
                return res.redirect(302, finalMatch[1]);
            }
            return res.redirect(302, downloadPageUrl);

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