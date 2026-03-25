// Migration JSON → SQLite pour VeM Espace Élus
const path = require('path');
const fs = require('fs');
const Database = require('./node_modules/better-sqlite3');

const DIR = __dirname;
const DB_PATH = path.join(DIR, 'vem.db');

// Supprimer l'ancienne base si elle existe
if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
  console.log('✓ Ancienne base supprimée');
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');  // Écritures concurrentes
db.pragma('foreign_keys = ON');

function load(f, d) {
  try { return JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); }
  catch(e) { return d; }
}

// ── SCHÉMA ──────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS elus (
    id INTEGER PRIMARY KEY,
    prenom TEXT, nom TEXT, role TEXT, delegation TEXT DEFAULT '',
    avatar TEXT, color TEXT, photo TEXT, photoPos TEXT,
    tel TEXT DEFAULT '', email TEXT DEFAULT '', commission TEXT DEFAULT '',
    pwd_key TEXT
  );

  CREATE TABLE IF NOT EXISTS agenda (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titre TEXT NOT NULL, date TEXT, heure TEXT DEFAULT '',
    lieu TEXT DEFAULT '', type TEXT DEFAULT 'autre',
    notes TEXT DEFAULT '', created_by TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS projets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titre TEXT NOT NULL, theme TEXT, statut TEXT DEFAULT 'Programmé',
    annee INTEGER, budget REAL DEFAULT 0,
    resume TEXT DEFAULT '', description TEXT DEFAULT '',
    importance INTEGER DEFAULT 2, tags TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    modified_at TEXT
  );

  CREATE TABLE IF NOT EXISTS statuts (
    projet_id INTEGER PRIMARY KEY,
    statut TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS comptes_rendus (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titre TEXT NOT NULL, commission TEXT DEFAULT '',
    date TEXT DEFAULT '', redige_par TEXT DEFAULT '',
    participants TEXT DEFAULT '', odj TEXT DEFAULT '',
    content TEXT DEFAULT '', next_steps TEXT DEFAULT '',
    url TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS biblio (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titre TEXT NOT NULL, type TEXT DEFAULT 'Autre',
    commission TEXT DEFAULT '', date_doc TEXT DEFAULT '',
    description TEXT DEFAULT '', url TEXT DEFAULT '',
    tags TEXT DEFAULT '', visibilite TEXT DEFAULT 'public',
    auteur_id INTEGER, auteur_nom TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS signalements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titre TEXT NOT NULL, type TEXT DEFAULT 'Autre',
    urgence TEXT DEFAULT 'normale', lieu TEXT DEFAULT '',
    description TEXT DEFAULT '', service TEXT DEFAULT '',
    signale_par TEXT DEFAULT '', statut TEXT DEFAULT 'Nouveau',
    historique TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS evenements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titre TEXT NOT NULL, date TEXT, heure TEXT DEFAULT '',
    lieu TEXT DEFAULT '', type TEXT DEFAULT 'autre',
    description TEXT DEFAULT '', organisateur TEXT DEFAULT '',
    visibilite TEXT DEFAULT 'public',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS chat (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel TEXT DEFAULT 'general',
    auteur TEXT DEFAULT '', avatar TEXT DEFAULT '',
    texte TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notifs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titre TEXT NOT NULL, statut TEXT DEFAULT '',
    ancien TEXT DEFAULT '', type TEXT DEFAULT 'statut',
    is_new INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS annonces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titre TEXT NOT NULL, texte TEXT DEFAULT '',
    auteur TEXT DEFAULT '', visibilite TEXT DEFAULT 'interne',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    texte TEXT NOT NULL, done INTEGER DEFAULT 0,
    elu_id INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titre TEXT NOT NULL, url TEXT DEFAULT '',
    type TEXT DEFAULT 'Autre', commission TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS rep_elus (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    elu_id INTEGER NOT NULL, nom TEXT DEFAULT '',
    url TEXT DEFAULT '', notes TEXT DEFAULT '',
    auteur TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

console.log('✓ Schéma créé');

// ── MIGRATION DES DONNÉES ────────────────────────────────────────────────────

// ÉLUS
const elus = load('elus.json', []);
const insElu = db.prepare(`INSERT OR REPLACE INTO elus (id,prenom,nom,role,delegation,avatar,color,photo,photoPos,tel,email,commission) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
const insManyElus = db.transaction((rows) => {
  for (const e of rows) insElu.run(e.id, e.prenom||'', e.nom||'', e.role||'', e.delegation||'', e.avatar||'', e.color||'', e.photo||'', e.photoPos||'center center', e.tel||'', e.email||'', e.commission||'');
});
insManyElus(elus);
console.log(`✓ Élus : ${elus.length}`);

// AGENDA
const agenda = load('agenda.json', []);
const insAg = db.prepare(`INSERT INTO agenda (id,titre,date,heure,lieu,type,notes,created_by) VALUES (?,?,?,?,?,?,?,?)`);
const insManyAg = db.transaction((rows) => {
  for (const a of rows) insAg.run(a.id, a.titre||'', a.date||'', a.heure||'', a.lieu||'', a.type||'autre', a.notes||'', a.created_by||'');
});
insManyAg(agenda);
console.log(`✓ Agenda : ${agenda.length}`);

// PROJETS
const projets = load('projets.json', []);
const insProj = db.prepare(`INSERT INTO projets (id,titre,theme,statut,annee,budget,resume,description,importance,tags) VALUES (?,?,?,?,?,?,?,?,?,?)`);
const insManyProj = db.transaction((rows) => {
  for (const p of rows) insProj.run(p.id, p.titre||'', p.theme||'', p.statut||'Programmé', p.annee||null, p.budget||0, p.resume||'', p.description||'', p.importance||2, Array.isArray(p.tags)?p.tags.join(','):(p.tags||''));
});
insManyProj(projets);
console.log(`✓ Projets : ${projets.length}`);

// STATUTS
const statuts = load('statuts.json', {});
const insSt = db.prepare(`INSERT OR REPLACE INTO statuts (projet_id,statut) VALUES (?,?)`);
const insManySt = db.transaction((obj) => {
  for (const [k,v] of Object.entries(obj)) insSt.run(parseInt(k), v);
});
insManySt(statuts);
console.log(`✓ Statuts : ${Object.keys(statuts).length}`);

// NOTIFS
const notifs = load('notifs.json', []);
const insNt = db.prepare(`INSERT INTO notifs (id,titre,statut,ancien,type,is_new) VALUES (?,?,?,?,?,?)`);
const insManyNt = db.transaction((rows) => {
  for (const n of rows) insNt.run(n.id||Date.now(), n.titre||'', n.statut||'', n.ancien||'', n.type||'statut', n.new?1:0);
});
insManyNt(notifs.slice(0, 200));
console.log(`✓ Notifs : ${Math.min(notifs.length, 200)}`);

// CHAT
const chat = load('chat.json', []);
const insChat = db.prepare(`INSERT INTO chat (id,channel,auteur,avatar,texte) VALUES (?,?,?,?,?)`);
const insManyChat = db.transaction((rows) => {
  for (const m of rows) insChat.run(m.id, m.channel||'general', m.auteur||'', m.avatar||'', m.texte||'');
});
insManyChat(chat.slice(-200));
console.log(`✓ Chat : ${Math.min(chat.length, 200)} messages`);

// Vérification finale
const tables = ['elus','agenda','projets','statuts','notifs','chat'];
console.log('\n── Vérification ──────────────────────────');
for (const t of tables) {
  const n = db.prepare(`SELECT COUNT(*) as n FROM ${t}`).get();
  console.log(`  ${t}: ${n.n} lignes`);
}

db.close();
console.log('\n✅ Migration terminée → vem.db');
