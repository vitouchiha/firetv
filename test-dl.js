async function test() {
    const res = await fetch('https://com-cbs-ott.en.uptodown.com/android/download');
    const text = await res.text();
    const match = text.match(/id="detail-download-button"[^>]*data-url="([^"]+)"/);
    if(match) {
        console.log('Token:', match[1]);
        const dlUrl = 'https://dw.uptodown.com/dwn/' + match[1];
        console.log('Trying:', dlUrl);
        const res2 = await fetch(dlUrl, {method: 'GET', redirect: 'manual'});
        console.log(res2.status, res2.headers.get('location'));
    } else {
        console.log("No match");
    }
}
test();