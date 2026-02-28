export default async function handler(req, res) {
    const isTV = req.query?.tv === 'true' || req.query?.tv === '1' || req.query?.tv === 'us';

    try {
        if (isTV) {
            // --- Paramount+ US Fire TV (APKMirror - com.cbs.app, versione americana) ---
            const rssRes = await fetch(
                'https://www.apkmirror.com/apk/cbs-interactive-inc/paramount/feed/',
                { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RSS reader)' } }
            );
            const rssText = await rssRes.text();

            const slugMatch = rssText.match(/<link>https:\/\/www\.apkmirror\.com\/apk\/cbs-interactive-inc\/paramount\/(paramount-[\d-]+-release)\/<\/link>/);
            const releaseSlug = slugMatch ? slugMatch[1] : null;

            if (!releaseSlug) {
                // Fallback alla pagina generale
                return res.redirect(302, 'https://www.apkmirror.com/apk/cbs-interactive-inc/paramount/');
            }

            const apkDownloadUrl = `https://www.apkmirror.com/apk/cbs-interactive-inc/paramount/${releaseSlug}/${releaseSlug.replace('-release', '-android-apk-download')}/`;
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