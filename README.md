# 🏴‍☠️ Il Covo di Nello

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
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
 ┃ ┣ 📜 cron-troypoint.js   # Scraper per app da Troypoint
 ┃ ┗ 📜 ...
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

Esempio di automazione (`api/check-paramount.js`):
1. Effettua lo scraping della pagina di download (es. Uptodown).
2. Estrae l'ultima versione disponibile.
3. Effettua il login su Firebase come Admin.
4. Aggiorna il Realtime Database con il nuovo link APK diretto e la nuova versione.

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
