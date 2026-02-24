export default async function handler(req, res) {
    try {
        const response = await fetch('https://com-cbs-ott.en.uptodown.com/android/download');
        const html = await response.text();
        const match = html.match(/id="detail-download-button"[^>]*data-url="([^"]+)"/);
        
        if (match) {
            const token = match[1];
            const dlUrl = 'https://dw.uptodown.com/dwn/' + token;
            
            // Uptodown fa un ulteriore redirect interno (da .com a .net con il nome del file).
            // Per evitare problemi di CORS o blocchi del browser, seguiamo il primo redirect
            // lato server e restituiamo l'URL finale dell'APK.
            const redirectResponse = await fetch(dlUrl, { redirect: 'manual' });
            const finalApkUrl = redirectResponse.headers.get('location');

            if (finalApkUrl) {
                res.redirect(302, finalApkUrl);
            } else {
                // Fallback al primo URL se non c'è location
                res.redirect(302, dlUrl);
            }
        } else {
            res.status(404).send('Download link not found');
        }
    } catch (error) {
        res.status(500).send('Error fetching download link');
    }
}