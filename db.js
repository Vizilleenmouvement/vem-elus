// db.js — Couche SQLite pour VeM Espace Élus
// Remplace les fichiers JSON — accès concurrent sécurisé
const path = require('path');
const Database = require('./node_modules/better-sqlite3');

const db = new Database(path.join(__dirname, 'vem.db'));
db.pragma('journal_mode = WAL');   // Écritures concurrentes
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL'); // Bon compromis perf/sécurité

// ── TABLES SUIVI PROJET (créées automatiquement si absentes) ─────────────────
try { db.exec("ALTER TABLE projets ADD COLUMN avancement INTEGER DEFAULT 0;"); } catch(e) {}
try { db.exec("ALTER TABLE projets ADD COLUMN responsable_id INTEGER;"); } catch(e) {}
try { db.exec("ALTER TABLE projets ADD COLUMN responsable_nom TEXT DEFAULT '';"); } catch(e) {}
try { db.exec("ALTER TABLE projets ADD COLUMN budget_prevu REAL DEFAULT 0;"); } catch(e) {}
try { db.exec("ALTER TABLE projets ADD COLUMN budget_engage REAL DEFAULT 0;"); } catch(e) {}

db.exec(`
  CREATE TABLE IF NOT EXISTS projet_jalons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projet_id INTEGER NOT NULL,
    titre TEXT NOT NULL,
    date_jalon TEXT DEFAULT '',
    statut TEXT DEFAULT 'prevu',
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS projet_partenaires (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projet_id INTEGER NOT NULL,
    nom TEXT NOT NULL,
    type TEXT DEFAULT '',
    contact TEXT DEFAULT '',
    email TEXT DEFAULT '',
    tel TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS projet_contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projet_id INTEGER NOT NULL,
    nom TEXT NOT NULL,
    role TEXT DEFAULT '',
    email TEXT DEFAULT '',
    tel TEXT DEFAULT '',
    organisation TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS projet_docs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projet_id INTEGER NOT NULL,
    titre TEXT NOT NULL,
    type TEXT DEFAULT 'Autre',
    url TEXT DEFAULT '',
    description TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS projet_presse (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projet_id INTEGER NOT NULL,
    titre TEXT NOT NULL,
    media TEXT DEFAULT '',
    url TEXT DEFAULT '',
    date_pub TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS projet_journal (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projet_id INTEGER NOT NULL,
    auteur_id INTEGER DEFAULT 0,
    auteur_nom TEXT DEFAULT '',
    action TEXT NOT NULL,
    ancien_val TEXT DEFAULT '',
    nouveau_val TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// ── HELPERS ──────────────────────────────────────────────────────────────────
function ts() { return new Date().toLocaleString('fr-FR'); }
function nid(table) {
  const r = db.prepare(`SELECT MAX(id) as m FROM ${table}`).get();
  return (r.m || 0) + 1;
}
function parseJSON(v, def) { try { return JSON.parse(v); } catch(e) { return def; } }

// ── ÉLUS ─────────────────────────────────────────────────────────────────────
const Elus = {
  getAll() {
    return db.prepare('SELECT * FROM elus ORDER BY id').all();
  },
  patch(id, d) {
    const e = db.prepare('SELECT * FROM elus WHERE id=?').get(id);
    if (!e) return false;
    db.prepare(`UPDATE elus SET prenom=?,nom=?,role=?,tel=?,email=?,commission=?,delegation=?,photo=? WHERE id=?`).run(
      d.prenom!==undefined?d.prenom:e.prenom,
      d.nom!==undefined?d.nom:e.nom,
      d.role!==undefined?d.role:e.role,
      d.tel!==undefined?d.tel:e.tel,
      d.email!==undefined?d.email:e.email,
      d.commission!==undefined?d.commission:e.commission,
      e.delegation,
      d.photo&&d.photo!==''?d.photo:e.photo,
      id
    );
    return true;
  }
};

// ── AGENDA ────────────────────────────────────────────────────────────────────
const Agenda = {
  getAll() { return db.prepare('SELECT * FROM agenda ORDER BY date,heure').all(); },
  insert(d) {
    const r = db.prepare(`INSERT INTO agenda (titre,date,heure,lieu,type,notes,created_by) VALUES (?,?,?,?,?,?,?)`).run(
      d.titre||'', d.date||'', d.heure||'', d.lieu||'', d.type||'autre', d.notes||'', d.created_by||''
    );
    return db.prepare('SELECT * FROM agenda WHERE id=?').get(r.lastInsertRowid);
  },
  patch(id, d) {
    const a = db.prepare('SELECT * FROM agenda WHERE id=?').get(id);
    if (!a) return false;
    db.prepare(`UPDATE agenda SET titre=?,date=?,heure=?,lieu=?,type=?,notes=? WHERE id=?`).run(
      d.titre||a.titre, d.date||a.date,
      d.heure!==undefined?d.heure:a.heure,
      d.lieu!==undefined?d.lieu:a.lieu,
      d.type||a.type,
      d.notes!==undefined?d.notes:a.notes,
      id
    );
    return true;
  },
  delete(id) { db.prepare('DELETE FROM agenda WHERE id=?').run(id); }
};

// ── PROJETS ───────────────────────────────────────────────────────────────────
const Projets = {
  getAll() {
    const rows = db.prepare('SELECT p.*,s.statut as statut_override FROM projets p LEFT JOIN statuts s ON p.id=s.projet_id ORDER BY p.id').all();
    return rows.map(p => ({
      ...p,
      tags: p.tags ? p.tags.split(',').filter(Boolean) : [],
      statut: p.statut_override || p.statut
    }));
  },
  insert(d) {
    const r = db.prepare(`INSERT INTO projets (titre,theme,statut,annee,budget,resume,description,importance,tags) VALUES (?,?,?,?,?,?,?,?,?)`).run(
      d.titre||'', d.theme||'', d.statut||'Programmé', d.annee||null, 0,
      d.resume||'', d.description||'', parseInt(d.importance)||2,
      Array.isArray(d.tags)?d.tags.join(','):(d.tags||'')
    );
    return Projets.getById(r.lastInsertRowid);
  },
  getById(id) {
    const p = db.prepare('SELECT p.*,s.statut as statut_override FROM projets p LEFT JOIN statuts s ON p.id=s.projet_id WHERE p.id=?').get(id);
    if (!p) return null;
    return {...p, tags: p.tags?p.tags.split(',').filter(Boolean):[], statut: p.statut_override||p.statut};
  },
  patch(id, d) {
    const p = db.prepare('SELECT * FROM projets WHERE id=?').get(id);
    if (!p) return null;
    db.prepare(`UPDATE projets SET titre=?,theme=?,statut=?,annee=?,importance=?,resume=?,description=?,tags=?,modified_at=datetime('now') WHERE id=?`).run(
      d.titre!==undefined?d.titre:p.titre,
      d.theme!==undefined?d.theme:p.theme,
      d.statut!==undefined?d.statut:p.statut,
      d.annee!==undefined?(d.annee?parseInt(d.annee):null):p.annee,
      d.importance!==undefined?parseInt(d.importance)||1:p.importance,
      d.resume!==undefined?d.resume:p.resume,
      d.description!==undefined?d.description:p.description,
      d.tags!==undefined?d.tags:p.tags,
      id
    );
    if (d.statut !== undefined) {
      db.prepare('INSERT OR REPLACE INTO statuts (projet_id,statut) VALUES (?,?)').run(id, d.statut);
    }
    return Projets.getById(id);
  },
  delete(id) {
    db.prepare('DELETE FROM projets WHERE id=?').run(id);
    db.prepare('DELETE FROM statuts WHERE projet_id=?').run(id);
  }
};

// ── STATUTS ───────────────────────────────────────────────────────────────────
const Statuts = {
  getAll() {
    const rows = db.prepare('SELECT projet_id,statut FROM statuts').all();
    const obj = {};
    rows.forEach(r => { obj[r.projet_id] = r.statut; });
    return obj;
  },
  set(projetId, statut) {
    db.prepare('INSERT OR REPLACE INTO statuts (projet_id,statut) VALUES (?,?)').run(projetId, statut);
  }
};

// ── COMPTES RENDUS ─────────────────────────────────────────────────────────────
const CR = {
  getAll() { return db.prepare('SELECT * FROM comptes_rendus ORDER BY id DESC').all(); },
  getById(id) { return db.prepare('SELECT * FROM comptes_rendus WHERE id=?').get(id); },
  insert(d) {
    const r = db.prepare(`INSERT INTO comptes_rendus (titre,commission,date,redige_par,participants,odj,content,next_steps,url) VALUES (?,?,?,?,?,?,?,?,?)`).run(
      d.titre||'', d.commission||'', d.date||'', d.redige_par||'',
      d.participants||'', d.odj||'', d.content||'', d.next_steps||'', d.url||''
    );
    return CR.getById(r.lastInsertRowid);
  },
  update(id, d) {
    const c = CR.getById(id); if (!c) return false;
    db.prepare(`UPDATE comptes_rendus SET titre=?,commission=?,date=?,redige_par=?,participants=?,odj=?,content=?,next_steps=?,url=? WHERE id=?`).run(
      d.titre||c.titre, d.commission||c.commission, d.date||c.date,
      d.redige_par||c.redige_par, d.participants||c.participants,
      d.odj||c.odj, d.content||c.content, d.next_steps||c.next_steps,
      d.url||c.url, id
    );
    return true;
  },
  delete(id) { db.prepare('DELETE FROM comptes_rendus WHERE id=?').run(id); }
};

// ── BIBLIO ────────────────────────────────────────────────────────────────────
const Biblio = {
  getAll(eluId, isAdmin) {
    if (isAdmin) return db.prepare('SELECT * FROM biblio ORDER BY id DESC').all();
    return db.prepare("SELECT * FROM biblio WHERE visibilite='public' OR auteur_id=? ORDER BY id DESC").all(eluId);
  },
  search(q, type, commission, eluId, isAdmin) {
    let where = isAdmin ? '1=1' : `(visibilite='public' OR auteur_id=${eluId})`;
    const params = [];
    if (q) { where += ' AND (titre LIKE ? OR description LIKE ? OR tags LIKE ?)'; params.push(`%${q}%`,`%${q}%`,`%${q}%`); }
    if (type) { where += ' AND type=?'; params.push(type); }
    if (commission) { where += ' AND commission=?'; params.push(commission); }
    return db.prepare(`SELECT * FROM biblio WHERE ${where} ORDER BY id DESC`).all(...params);
  },
  insert(d, eluId, eluNom) {
    const r = db.prepare(`INSERT INTO biblio (titre,type,commission,date_doc,description,url,tags,visibilite,auteur_id,auteur_nom) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
      d.titre||'', d.type||'Autre', d.commission||'', d.date_doc||'',
      d.description||'', d.url||'', d.tags||'', d.visibilite||'public',
      eluId, eluNom
    );
    return db.prepare('SELECT * FROM biblio WHERE id=?').get(r.lastInsertRowid);
  },
  delete(id) { db.prepare('DELETE FROM biblio WHERE id=?').run(id); }
};

// ── SIGNALEMENTS ──────────────────────────────────────────────────────────────
const Signalements = {
  getAll() {
    return db.prepare('SELECT * FROM signalements ORDER BY id DESC').all()
      .map(s => ({...s, historique: parseJSON(s.historique, [])}));
  },
  insert(d) {
    const hist = JSON.stringify([{statut:'Nouveau', ts: ts(), auteur: d.signale_par||'Inconnu'}]);
    const r = db.prepare(`INSERT INTO signalements (titre,type,urgence,lieu,description,service,signale_par,statut,historique) VALUES (?,?,?,?,?,?,?,?,?)`).run(
      d.titre||'', d.type||'Autre', d.urgence||'normale', d.lieu||'',
      d.description||'', d.service||'', d.signale_par||'', 'Nouveau', hist
    );
    return {...db.prepare('SELECT * FROM signalements WHERE id=?').get(r.lastInsertRowid), historique: parseJSON(hist, [])};
  },
  updateStatut(id, statut, auteur, commentaire) {
    const s = db.prepare('SELECT * FROM signalements WHERE id=?').get(id);
    if (!s) return false;
    const hist = parseJSON(s.historique, []);
    hist.push({statut, ts: ts(), auteur: auteur||'Élu', commentaire: commentaire||''});
    db.prepare(`UPDATE signalements SET statut=?,historique=?,updated_at=datetime('now') WHERE id=?`).run(statut, JSON.stringify(hist), id);
    return true;
  },
  delete(id) { db.prepare('DELETE FROM signalements WHERE id=?').run(id); }
};

// ── ÉVÉNEMENTS ────────────────────────────────────────────────────────────────
const Evenements = {
  getAll() { return db.prepare('SELECT * FROM evenements ORDER BY date,heure').all(); },
  insert(d) {
    const r = db.prepare(`INSERT INTO evenements (titre,date,heure,lieu,type,description,organisateur,visibilite) VALUES (?,?,?,?,?,?,?,?)`).run(
      d.titre||'', d.date||'', d.heure||'', d.lieu||'',
      d.type||'autre', d.description||'', d.organisateur||'',
      d.visibilite||'public'
    );
    return db.prepare('SELECT * FROM evenements WHERE id=?').get(r.lastInsertRowid);
  },
  delete(id) { db.prepare('DELETE FROM evenements WHERE id=?').run(id); }
};

// ── CHAT ──────────────────────────────────────────────────────────────────────
const Chat = {
  get(channel, since) {
    const msgs = db.prepare('SELECT * FROM chat WHERE channel=? AND id>? ORDER BY id').all(channel||'general', since||0);
    const lastId = db.prepare('SELECT MAX(id) as m FROM chat').get().m || 0;
    return {messages: msgs, lastId};
  },
  insert(d) {
    const r = db.prepare('INSERT INTO chat (channel,auteur,avatar,texte) VALUES (?,?,?,?)').run(
      d.channel||'general', d.auteur||'Élu', d.avatar||'?', d.texte||''
    );
    return db.prepare('SELECT * FROM chat WHERE id=?').get(r.lastInsertRowid);
  }
};

// ── ANNONCES ──────────────────────────────────────────────────────────────────
const Annonces = {
  getAll() { return db.prepare('SELECT * FROM annonces ORDER BY id DESC LIMIT 50').all(); },
  insert(d) {
    const r = db.prepare('INSERT INTO annonces (titre,texte,auteur,visibilite) VALUES (?,?,?,?)').run(
      d.titre||'', d.texte||'', d.auteur||'', d.visibilite||'interne'
    );
    return db.prepare('SELECT * FROM annonces WHERE id=?').get(r.lastInsertRowid);
  },
  delete(id) { db.prepare('DELETE FROM annonces WHERE id=?').run(id); }
};

// ── TÂCHES ────────────────────────────────────────────────────────────────────
const Tasks = {
  getAll() { return db.prepare('SELECT * FROM tasks ORDER BY id').all(); },
  insert(d) {
    const r = db.prepare('INSERT INTO tasks (texte,elu_id) VALUES (?,?)').run(d.texte||'', d.elu_id||0);
    return db.prepare('SELECT * FROM tasks WHERE id=?').get(r.lastInsertRowid);
  },
  toggle(id) {
    const t = db.prepare('SELECT done FROM tasks WHERE id=?').get(id);
    if (!t) return;
    db.prepare('UPDATE tasks SET done=? WHERE id=?').run(t.done?0:1, id);
  },
  delete(id) { db.prepare('DELETE FROM tasks WHERE id=?').run(id); }
};

// ── NOTIFS ────────────────────────────────────────────────────────────────────
const Notifs = {
  getAll() { return db.prepare('SELECT * FROM notifs ORDER BY id DESC LIMIT 80').all()
    .map(n => ({...n, new: !!n.is_new, ts: n.created_at})); },
  insert(titre, statut, ancien, type) {
    const r = db.prepare('INSERT INTO notifs (titre,statut,ancien,type,is_new) VALUES (?,?,?,?,1)').run(titre, statut||'', ancien||'', type||'statut');
    return {id: r.lastInsertRowid, titre, statut, ancien, type, new: true, ts: ts()};
  }
};

// ── REP ÉLUS ──────────────────────────────────────────────────────────────────
const RepElus = {
  get(eluId) { return db.prepare('SELECT * FROM rep_elus WHERE elu_id=? ORDER BY id DESC').all(eluId); },
  getAll() {
    const rows = db.prepare('SELECT * FROM rep_elus ORDER BY elu_id,id DESC').all();
    const obj = {};
    rows.forEach(r => { if (!obj[r.elu_id]) obj[r.elu_id]=[]; obj[r.elu_id].push(r); });
    return obj;
  },
  insert(eluId, d, auteur) {
    const r = db.prepare('INSERT INTO rep_elus (elu_id,nom,url,notes,auteur) VALUES (?,?,?,?,?)').run(
      eluId, d.nom||'', d.url||'', d.notes||'', auteur||''
    );
    return db.prepare('SELECT * FROM rep_elus WHERE id=?').get(r.lastInsertRowid);
  },
  delete(id, eluId) { db.prepare('DELETE FROM rep_elus WHERE id=? AND elu_id=?').run(id, eluId); }
};

// ── STATS ─────────────────────────────────────────────────────────────────────
function stats() {
  const total = db.prepare('SELECT COUNT(*) as n FROM projets').get().n;
  const pr = db.prepare("SELECT COUNT(*) as n FROM statuts WHERE statut='Prioritaire'").get().n;
  const re = db.prepare("SELECT COUNT(*) as n FROM statuts WHERE statut LIKE '%alis%'").get().n;
  const ec = db.prepare("SELECT COUNT(*) as n FROM statuts WHERE statut LIKE '%cours%'").get().n;
  const n26 = db.prepare('SELECT COUNT(*) as n FROM projets WHERE annee=2026').get().n;
  const sig_new = db.prepare("SELECT COUNT(*) as n FROM signalements WHERE statut='Nouveau'").get().n;
  const sig_ec = db.prepare("SELECT COUNT(*) as n FROM signalements WHERE statut='En cours'").get().n;
  return {total, prioritaires:pr, annee2026:n26, realises:re, en_cours:ec, sig_new, sig_ec};
}

// ── PROJETS ÉTENDU ────────────────────────────────────────────────────────────
const ProjetJalons = {
  get(pid) { return db.prepare('SELECT * FROM projet_jalons WHERE projet_id=? ORDER BY date_jalon').all(pid); },
  insert(pid, d) {
    const r = db.prepare('INSERT INTO projet_jalons (projet_id,titre,date_jalon,statut,notes) VALUES (?,?,?,?,?)').run(pid, d.titre||'', d.date||d.date_jalon||'', d.statut||'prevu', d.notes||'');
    return db.prepare('SELECT * FROM projet_jalons WHERE id=?').get(r.lastInsertRowid);
  },
  patch(id, d) {
    const j = db.prepare('SELECT * FROM projet_jalons WHERE id=?').get(id); if(!j) return false;
    db.prepare('UPDATE projet_jalons SET titre=?,date_jalon=?,statut=?,notes=? WHERE id=?').run(d.titre||j.titre, d.date||j.date_jalon||'', d.statut||j.statut, d.notes!==undefined?d.notes:j.notes, id);
    return true;
  },
  delete(id) { db.prepare('DELETE FROM projet_jalons WHERE id=?').run(id); }
};

const ProjetPartenaires = {
  get(pid) { return db.prepare('SELECT * FROM projet_partenaires WHERE projet_id=? ORDER BY id').all(pid); },
  insert(pid, d) {
    const r = db.prepare('INSERT INTO projet_partenaires (projet_id,nom,type,contact,email,tel) VALUES (?,?,?,?,?,?)').run(pid, d.nom||'', d.type||'', d.contact||'', d.email||'', d.tel||'');
    return db.prepare('SELECT * FROM projet_partenaires WHERE id=?').get(r.lastInsertRowid);
  },
  delete(id) { db.prepare('DELETE FROM projet_partenaires WHERE id=?').run(id); }
};

const ProjetContacts = {
  get(pid) { return db.prepare('SELECT * FROM projet_contacts WHERE projet_id=? ORDER BY id').all(pid); },
  insert(pid, d) {
    const r = db.prepare('INSERT INTO projet_contacts (projet_id,nom,role,email,tel,organisation) VALUES (?,?,?,?,?,?)').run(pid, d.nom||'', d.role||'', d.email||'', d.tel||'', d.organisation||'');
    return db.prepare('SELECT * FROM projet_contacts WHERE id=?').get(r.lastInsertRowid);
  },
  delete(id) { db.prepare('DELETE FROM projet_contacts WHERE id=?').run(id); }
};

const ProjetDocs = {
  get(pid) { return db.prepare('SELECT * FROM projet_docs WHERE projet_id=? ORDER BY id DESC').all(pid); },
  insert(pid, d) {
    const r = db.prepare('INSERT INTO projet_docs (projet_id,titre,type,url,description) VALUES (?,?,?,?,?)').run(pid, d.titre||'', d.type||'Autre', d.url||'', d.description||'');
    return db.prepare('SELECT * FROM projet_docs WHERE id=?').get(r.lastInsertRowid);
  },
  delete(id) { db.prepare('DELETE FROM projet_docs WHERE id=?').run(id); }
};

const ProjetPresse = {
  get(pid) { return db.prepare('SELECT * FROM projet_presse WHERE projet_id=? ORDER BY date_pub DESC,id DESC').all(pid); },
  insert(pid, d) {
    const r = db.prepare('INSERT INTO projet_presse (projet_id,titre,media,url,date_pub) VALUES (?,?,?,?,?)').run(pid, d.titre||'', d.media||'', d.url||'', d.date||d.date_pub||'');
    return db.prepare('SELECT * FROM projet_presse WHERE id=?').get(r.lastInsertRowid);
  },
  delete(id) { db.prepare('DELETE FROM projet_presse WHERE id=?').run(id); }
};

const ProjetJournal = {
  get(pid) { return db.prepare('SELECT * FROM projet_journal WHERE projet_id=? ORDER BY id DESC LIMIT 50').all(pid); },
  log(pid, auteurId, auteurNom, action, ancien, nouveau) {
    db.prepare('INSERT INTO projet_journal (projet_id,auteur_id,auteur_nom,action,ancien_val,nouveau_val) VALUES (?,?,?,?,?,?)').run(pid, auteurId||0, auteurNom||'', action||'', ancien||'', nouveau||'');
  }
};

module.exports = {db, Elus, Agenda, Projets, Statuts, CR, Biblio, Signalements, Evenements, Chat, Annonces, Tasks, Notifs, RepElus, stats, ts, nid, ProjetJalons, ProjetPartenaires, ProjetContacts, ProjetDocs, ProjetPresse, ProjetJournal};
