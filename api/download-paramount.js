export default async function handler(req, res) {
    const isTV = req.query?.tv === 'true' || req.query?.tv === '1' || req.query?.tv === 'us';

    try {
        if (isTV) {
            // --- Paramount+ US (com.cbs.app - stessa app, download diretto via Uptodown) ---
            // com-cbs-ott su Uptodown è esattamente com.cbs.app, la versione americana
            const response = await fetch('https://com-cbs-ott.en.uptodown.com/android/download', {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });
            const html = await response.text();
            const match = html.match(/id="detail-download-button"[^>]*data-url="([^"]+)"/);

            if (match) {
                const token = match[1];
                const dlUrl = 'https://dw.uptodown.com/dwn/' + token;
                const redirectResponse = await fetch(dlUrl, { redirect: 'manual' });
                const finalApkUrl = redirectResponse.headers.get('location');
                return res.redirect(302, finalApkUrl || dlUrl);
            } else {
                // Fallback alla pagina APKMirror se Uptodown non risponde
                return res.redirect(302, 'https://www.apkmirror.com/apk/cbs-interactive-inc/paramount/');
            }

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