export default async function handler(req, res) {
    const isTV = req.query?.tv === 'true' || req.query?.tv === '1' || req.query?.tv === 'us';

    try {
        if (isTV) {
            // --- Paramount+ US Fire TV (APKMirror via got-scraping + Webshare proxy) ---
            const proxyUser = process.env.WEBSHARE_PROXY_USER?.trim();
            const proxyPass = process.env.WEBSHARE_PROXY_PASS?.trim();
            const proxyUrl = `http://${proxyUser}:${proxyPass}@p.webshare.io:80`;

            const { gotScraping } = await import('got-scraping');

            const scraperOpts = {
                proxyUrl,
                headerGeneratorOptions: {
                    browsers: [{ name: 'chrome', minVersion: 120 }],
                    operatingSystems: ['windows']
                }
            };

            // 1. RSS feed APKMirror (non protetto da Cloudflare) → versione + slug
            const rssRes = await fetch('https://www.apkmirror.com/apk/cbs-interactive-inc/paramount/feed/', {
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RSS reader)' }
            });
            const rssText = await rssRes.text();
            const slugMatch = rssText.match(/<link>https:\/\/www\.apkmirror\.com\/apk\/cbs-interactive-inc\/paramount\/(paramount-[\d-]+-release)\/<\/link>/);
            const releaseSlug = slugMatch ? slugMatch[1] : null;

            if (!releaseSlug) {
                return res.redirect(302, 'https://www.apkmirror.com/apk/cbs-interactive-inc/paramount/');
            }

            const downloadPage = `https://www.apkmirror.com/apk/cbs-interactive-inc/paramount/${releaseSlug}/${releaseSlug.replace('-release', '-android-apk-download')}/`;

            // 2. Fetch pagina download con proxy (bypass Cloudflare)
            const pageRes = await gotScraping(downloadPage, scraperOpts);
            const pageHtml = pageRes.body;

            // 3. Estrai ?key=XXXX
            const keyMatch = pageHtml.match(/href="[^"]*\?key=([a-zA-Z0-9_-]+)"/);
            if (!keyMatch) {
                console.warn('APKMirror: key non trovato, fallback alla pagina');
                return res.redirect(302, downloadPage);
            }

            const key = keyMatch[1];
            const keyUrl = downloadPage + '?key=' + key;

            // 4. Fetch pagina thank-you con proxy → estrai link download.php
            const thankYouRes = await gotScraping(keyUrl, scraperOpts);
            const thankYouHtml = thankYouRes.body;

            // Cerca /wp-content/themes/APKMirror/download.php?id=XXXX
            const dlPhpMatch = thankYouHtml.match(/href="(\/wp-content\/themes\/APKMirror\/download\.php\?id=[^"]+)"/);
            if (!dlPhpMatch) {
                console.warn('APKMirror: download.php non trovato, fallback');
                return res.redirect(302, downloadPage);
            }

            const dlPhpUrl = 'https://www.apkmirror.com' + dlPhpMatch[1];

            // 5. Segui redirect CDN tramite proxy
            const cdnRes = await gotScraping(dlPhpUrl, { ...scraperOpts, followRedirect: false });
            const finalUrl = cdnRes.headers.location || dlPhpUrl;

            return res.redirect(302, finalUrl);

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