const https = require('https');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const VERSION_FILE = path.join(__dirname, 'stremio-version.txt');

// Configurazione Email (Devi inserire la tua App Password di Google)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'vitoblackpoint@gmail.com',
        pass: 'INSERISCI_QUI_LA_TUA_APP_PASSWORD' // Sostituisci con la password per le app di Google
    }
});

console.log("Controllo aggiornamenti Stremio in corso...");

https.get('https://www.stremio.com/downloads', (res) => {
    let data = '';
    
    res.on('data', chunk => {
        data += chunk;
    });
    
    res.on('end', () => {
        // Cerca la versione per Android TV ARM
        const match = data.match(/<a href="([^"]+)" title="Stremio for Android TV ARM">Stremio ([0-9.]+) ARM APK<\/a>/);
        
        if (match) {
            const version = match[2];
            let lastVersion = '';
            
            // Leggi l'ultima versione salvata (se esiste)
            if (fs.existsSync(VERSION_FILE)) {
                lastVersion = fs.readFileSync(VERSION_FILE, 'utf8').trim();
            }
            
            if (version !== lastVersion) {
                console.log(`🎉 Nuova versione trovata: ${version}! Invio email in corso...`);
                
                const mailOptions = {
                    from: 'vitoblackpoint@gmail.com',
                    to: 'vitoblackpoint@gmail.com',
                    subject: `🚀 Nuovo aggiornamento Stremio: ${version}`,
                    text: `Ciao Vito!\n\nÈ uscita la nuova versione di Stremio per Android TV ARM: ${version}.\n\nVai sul tuo sito e fai l'accesso come admin per aggiornare automaticamente la scheda!\n\nBuona giornata!`
                };

                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) {
                        console.error("❌ Errore nell'invio dell'email:", error);
                        console.log("⚠️ Ricorda: Devi generare una 'Password per le app' dal tuo account Google e inserirla nello script.");
                    } else {
                        console.log('✅ Email inviata con successo: ' + info.response);
                        // Salva la nuova versione solo se l'email è stata inviata con successo
                        fs.writeFileSync(VERSION_FILE, version);
                    }
                });
            } else {
                console.log(`✅ Nessun aggiornamento. La versione attuale è ancora la ${version}.`);
            }
        } else {
            console.log("❌ Impossibile trovare la versione di Stremio sulla pagina.");
        }
    });
}).on('error', err => {
    console.error("Errore di connessione:", err.message);
});
