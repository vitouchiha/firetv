export default async function handler(req, res) {
    try {
        const response = await fetch('https://com-cbs-ott.en.uptodown.com/android/download');
        const html = await response.text();
        const match = html.match(/id="detail-download-button"[^>]*data-url="([^"]+)"/);
        
        if (match) {
            const token = match[1];
            const dlUrl = 'https://dw.uptodown.com/dwn/' + token;
            // Redirect the user to the actual download URL
            res.redirect(302, dlUrl);
        } else {
            res.status(404).send('Download link not found');
        }
    } catch (error) {
        res.status(500).send('Error fetching download link');
    }
}