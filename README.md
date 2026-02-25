# 🏴‍☠️ Il Covo di Nello

![Version](https://img.shields.io/badge/version-1.3.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Platform](https://img.shields.io/badge/platform-Fire%20TV%20%7C%20Android%20TV%20%7C%20Web-orange.svg)
![Tech Stack](https://img.shields.io/badge/tech-HTML%20%7C%20CSS%20%7C%20JS%20%7C%20Firebase%20%7C%20Vercel-purple.svg)

**Il Covo di Nello** è un portale web moderno e reattivo, progettato specificamente per facilitare il download e l'installazione di applicazioni (APK) su dispositivi **Amazon Fire TV Stick** e **Android TV**. 

Il progetto include un'interfaccia utente accattivante, un pannello di amministrazione protetto e un sistema di automazione backend per mantenere le app sempre aggiornate.

---

## ✨ Funzionalità Principali

- 📺 **Ottimizzato per TV e Mobile**: Interfaccia utente fluida, navigabile facilmente sia da smartphone che da telecomando TV.
- 🔐 **Pannello di Amministrazione**: Area riservata (tramite Firebase Auth) per aggiungere, modificare, eliminare e riordinare (Drag & Drop) le app nel catalogo.
- 🤖 **Automazione e Cron Jobs**: Script serverless (Vercel Functions) che controllano periodicamente le nuove versioni delle app (es. Paramount+, app da Troypoint) e aggiornano automaticamente il database.
- 🔍 **Ricerca e Filtri**: Ricerca istantanea delle app e filtraggio dinamico per categorie.
- 📊 **Statistiche Integrate**: Contatore di click in tempo reale per ogni applicazione.
- 🌓 **Tema Dinamico**: Supporto per Tema Chiaro e Tema Scuro con salvataggio delle preferenze.
- 📱 **Condivisione Rapida**: Generatore di QR Code integrato per passare rapidamente dalla TV allo smartphone.
- 📖 **Guide Integrate**: Sezione dedicata a tutorial passo-passo per la configurazione di app come Kodi, Stremio e Vimu.
- 🔔 **Sistema di Notifiche**: Modal con pulsante campana nell'header. Gli utenti possono iscriversi via email e **scegliere esattamente quali app** monitorare. Le notifiche vengono inviate tramite [Resend](https://resend.com) solo per le app selezionate.
- 📣 **Canale Telegram**: Pulsante rapido di accesso al canale Telegram per aggiornamenti in tempo reale.

---

## 🛠️ Stack Tecnologico

- **Frontend**: HTML5, CSS3 (Custom Properties, Animazioni, Glassmorphism), Vanilla JavaScript.
- **Backend / API**: Node.js (Vercel Serverless Functions).
- **Database**: Firebase Realtime Database.
- **Autenticazione**: Firebase Authentication.
- **Hosting & CI/CD**: Vercel.

---

## 📂 Struttura del Progetto

```text
📦 Codici Firetv
 ┣ 📂 api/                  # Vercel Serverless Functions & Cron Jobs
 ┃ ┣ 📜 check-paramount.js  # Scraper automatico per Paramount+
 ┃ ┣ 📜 check-revanced.js   # Scraper per ReVanced
 ┃ ┣ 📜 check-stremio.js    # Scraper per Stremio
 ┃ ┣ 📜 check-windows-tools.js # Scraper strumenti Windows
 ┃ ┣ 📜 cron-troypoint.js   # Scraper per app da Troypoint
 ┃ ┣ 📜 subscribe.js        # API iscrizione notifiche email (per singola app)
 ┃ ┗ 📂 utils/
 ┃   ┗ 📜 notify.js         # Invio notifiche Telegram + Email filtrate per app
 ┣ 📂 public/               # File statici (se configurato)
 ┣ 📂 assets/               # Immagini, icone e loghi
 ┣ 📜 index.html            # Entry point principale dell'applicazione
 ┣ 📜 firebase-config.js    # Configurazione client di Firebase
 ┣ 📜 vercel.json           # Configurazione di Vercel e dei Cron Jobs
 ┣ 📜 package.json          # Dipendenze Node.js per gli script backend
 ┗ 📜 README.md             # Questo file
```

---

## 🚀 Installazione e Sviluppo Locale

Per eseguire il progetto localmente e testare le API serverless:

### 1. Clona il repository
```bash
git clone https://github.com/tuo-username/firetv.git
cd firetv
```

### 2. Installa le dipendenze
```bash
npm install
```

### 3. Configura le Variabili d'Ambiente
Crea un file `.env` nella root del progetto e inserisci le tue credenziali Firebase:

```env
FIREBASE_API_KEY=tua_api_key
FIREBASE_AUTH_DOMAIN=tuo_project.firebaseapp.com
FIREBASE_DATABASE_URL=https://tuo_project-default-rtdb.europe-west1.firebasedatabase.app
FIREBASE_PROJECT_ID=tuo_project
FIREBASE_STORAGE_BUCKET=tuo_project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=tuo_sender_id
FIREBASE_APP_ID=tuo_app_id

# Credenziali per l'automazione (Cron Jobs)
FIREBASE_ADMIN_EMAIL=tua_email_admin
FIREBASE_ADMIN_PASSWORD=tua_password_admin
CRON_SECRET=tuo_segreto_per_vercel_cron

# Notifiche Email (Resend)
RESEND_API_KEY=tua_api_key_resend
RESEND_SENDER_EMAIL=noreply@tuodominio.com

# Notifiche Telegram (opzionale)
TELEGRAM_BOT_TOKEN=token_bot_telegram
TELEGRAM_CHAT_ID=id_canale_o_chat
```

### 4. Avvia il server di sviluppo (Vercel CLI)
Se non hai Vercel CLI installato, installalo globalmente con `npm i -g vercel`.
```bash
vercel dev
```
Il progetto sarà disponibile all'indirizzo `http://localhost:3000`.

---

## ⚙️ Automazioni (Cron Jobs)

Il progetto sfrutta **Vercel Cron Jobs** per mantenere il catalogo aggiornato senza intervento manuale. Le configurazioni si trovano nel file `vercel.json`.

| Cron Job | Orario (UTC) | Funzione |
|---|---|---|
| `check-paramount` | 13:00 | Scraping Uptodown per Paramount+ (mobile/tablet) |
| `check-paramount-tv` | 13:00 | Scraping APKMirror RSS per Paramount+ Android TV |
| `check-revanced` | 14:00 | Nuove release ReVanced da GitHub |
| `check-stremio` | 12:00 | Ultima versione Stremio |
| `check-windows-tools` | 15:00 | Strumenti Windows |
| `cron-troypoint` | 08:00 | App selezionate da Troypoint |

Quando viene rilevato un aggiornamento, il sistema:
1. Aggiorna il Realtime Database Firebase con la nuova versione.
2. Invia una **notifica Telegram** al canale configurato.
3. Invia una **notifica email** (via Resend) esclusivamente agli iscritti che hanno selezionato quell'app specifica.

---

## 🔔 Sistema di Notifiche

Gli utenti possono iscriversi alle notifiche direttamente dal sito cliccando il pulsante 🔔 nell'header.

**Flusso utente:**
1. Inserisce la propria email.
2. Seleziona le app che vuole monitorare (o tutte con un click).
3. Riceve aggiornamenti via email solo per le app scelte.

I dati vengono salvati su Firebase nel nodo `subscribers` con la struttura:
```json
{
  "email": "utente@esempio.com",
  "apps": ["Paramount+ 16.5.0 US TV", "Stremio"],
  "timestamp": 1234567890
}
```
Se `apps` contiene `"all"`, l'utente riceve notifiche per ogni app aggiornata.

---

## 🤝 Contribuire

I contributi sono benvenuti! Se vuoi migliorare il progetto:
1. Fai un Fork del repository.
2. Crea un branch per la tua feature (`git checkout -b feature/NuovaFunzionalita`).
3. Fai il commit delle tue modifiche (`git commit -m 'Aggiunta nuova funzionalità'`).
4. Fai il push sul branch (`git push origin feature/NuovaFunzionalita`).
5. Apri una Pull Request.

---

## 📄 Licenza

Questo progetto è distribuito sotto licenza MIT. Sentiti libero di utilizzarlo, modificarlo e distribuirlo.

---
*Sviluppato con ❤️ per la community di Fire TV e Android TV.*

---

## 📝 Changelog

### v1.3.0 — 25 Febbraio 2026
- **Nuovo**: Aggiunta scheda **Paramount+ Android TV** separata con download APK diretto da APKMirror (`/api/download-paramount?tv=true`).
- **Modifica**: Scheda Paramount+ mobile ora indica chiaramente "Solo cellulare/tablet" nella descrizione.
- **Nuovo**: `api/check-paramount-tv.js` — cron giornaliero che controlla aggiornamenti della versione Android TV via RSS APKMirror.
- **Refactor**: `api/download-paramount.js` unificato gestisce sia mobile (Uptodown) che TV (APKMirror) tramite parametro `?tv=true`.
- **Fix**: `api/check-paramount.js` riscritto con Firebase REST API (eliminato SDK client che crashava in serverless).
- **UI**: Rimosso badge "NUOVO" da tutte le card.

### v1.2.0 — 24 Febbraio 2026
- **Fix**: `api/subscribe.js` riscritto con Firebase REST API al posto dell'SDK client — eliminato errore 500 su iscrizione notifiche in ambienti serverless Vercel.
- **Fix**: Rimosso override hardcoded APKCombo in `createAppCard()` — il tasto "Scarica" di Paramount+ ora usa correttamente `/api/download-paramount` (APK diretto da Uptodown).
- **Fix**: Gestione duplicati iscrizioni via email refactored — usa chiave sanitizzata nel nodo Firebase invece di query `orderBy` (che richiedeva indici non configurati).

### v1.1.0
- Sistema notifiche email con selezione app granulare.
- Pulsante campana 🔔 in header, modal iscrizione con griglia app.
- Integrazione Resend per invio email filtrato per app.
- Cron job Troypoint per aggiornamento automatico catalogo.

### v1.0.0
- Release iniziale: catalogo APK Fire TV, pannello admin, Firebase Realtime DB, cron job Paramount+/Stremio/ReVanced.
