#!/usr/bin/env node
/**
 * scripts/update-readme.js
 * Regenera il badge versione nel README.md allineandolo a package.json.
 * Uso: node scripts/update-readme.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const pkgPath = path.join(ROOT, 'package.json');
const readmePath = path.join(ROOT, 'README.md');

const { version } = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

let readme = fs.readFileSync(readmePath, 'utf8');

// Aggiorna il badge versione
const updated = readme.replace(
  /version-[\d.]+\w*-blue/g,
  `version-${version}-blue`
);

if (updated === readme) {
  console.log(`README già aggiornato a v${version} — nessuna modifica.`);
} else {
  fs.writeFileSync(readmePath, updated, 'utf8');
  console.log(`✅ README aggiornato: badge versione → v${version}`);
}
