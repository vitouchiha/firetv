# Deploy su Render.com

Questo progetto è un **Sito Statico** (HTML + CSS + JS) e non richiede un server backend (usiamo Firebase per il database).
Segui questi passaggi per metterlo online gratuitamente su Render.

### 1. Prepara i file
Assicurati di avere questa struttura nella tua cartella (che hai già):
- `index.html` (Il sito principale)
- `assets/` (La cartella con tutte le immagini)
- `.gitignore` (File che ho appena creato per ignorare i file inutili)

### 2. Carica su GitHub (Necessario per Render)
Render funziona collegandosi a un repository GitHub (o GitLab).
1. Crea un account su [GitHub.com](https://github.com) se non ne hai uno.
2. Crea un **Nuovo Repository** (chiamalo es. `firetv-code`).
3. Carica i file del tuo progetto in quel repository.
   - Se usi Git da terminale:
     ```bash
     git init
     git add .
     git commit -m "Primo caricamento"
     git branch -M main
     git remote add origin https://github.com/TUO_NOME_UTENTE/firetv-code.git
     git push -u origin main
     ```
   - Oppure usa **GitHub Desktop** o carica i file manualmente via web (drag & drop).

### 3. Configura Render
1. Vai su [Render.com](https://render.com) e crea un account.
2. Clicca su **New +** e seleziona **Static Site** (non Web Service).
3. Collega il tuo account GitHub e seleziona il repository `firetv-code` che hai appena creato.
4. **Configurazione:**
   - **Name:** Scegli un nome (es. `nello-firetv`).
   - **Branch:** `main` (o `master`).
   - **Root Directory:** Lascia vuoto (o scrivi `.`).
   - **Publish Directory:** Lascia vuoto (o scrivi `.`).
5. Clicca **Create Static Site**.

### Fatto!
In pochi secondi Render ti darà un link del tipo `https://nello-firetv.onrender.com`.
Il sito sarà attivo e funzionante, con il database Firebase collegato!
