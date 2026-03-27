// ── VeM Espace Élus — Point d'entrée ──────────────────────────────────────
const http = require('http'), https = require('https'), fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 3000, DIR = __dirname;

// ── MODULES ─────────────────────────────────────────────────────────────────
const {Elus, Agenda, Projets, Statuts, CR, Biblio, Signalements, Evenements, Chat, Annonces, Tasks, Notifs, RepElus, stats: dbStats, ts, db, ProjetJalons, ProjetPartenaires, ProjetContacts, ProjetDocs, ProjetPresse, ProjetJournal, BiblioDoc} = require('./db.js');

const config = require('./config.js');
const {ACCOUNTS, ELUS_DEF, COMM, COLORS, ICONS, REFS, ELUS0, GUIDES, RESS, mailTransporter, GMAIL_USER, ADMIN_EMAIL} = config;

const RESET_TOKENS = {};
const authModule = require('./auth.js')(ACCOUNTS, RESET_TOKENS, mailTransporter, {
  DIR, GMAIL_USER, ADMIN_EMAIL, PORT, ELUS_DEF, db
});
const {SESSIONS, makeToken, getSession, authUser, auth, deny, nid, checkPassword, hashPassword, checkBruteForce, recordAttempt, handleForgotPasswordGet, handleForgotPasswordPost, handleResetPasswordGet, handleResetPasswordPost} = authModule;

const handleRoutes = require('./routes.js')({
  ACCOUNTS, db, Elus, Agenda, Projets, Statuts, CR, Biblio, Signalements, Evenements, Chat, Annonces, Tasks, Notifs, RepElus, dbStats, ts, nid, ProjetJalons, ProjetPartenaires, ProjetContacts, ProjetDocs, ProjetPresse, ProjetJournal, BiblioDoc, fs, path, DIR, https
});

const buildPublicPage = require('./public-page.js')({Evenements, Agenda, Elus, Projets});
const buildPage = require('./dashboard-page.js')({COMM, COLORS, ICONS, REFS, ELUS0, GUIDES, RESS}, {Projets, Elus});

// Toutes les données viennent de SQLite
console.log('VeM SQLite — ' + Projets.getAll().length + ' projets, ' + Elus.getAll().length + ' élus');

// ── HELPERS ─────────────────────────────────────────────────────────────────
function J(res, d, c) { res.writeHead(c || 200, {'Content-Type': 'application/json;charset=utf-8', 'Access-Control-Allow-Origin': '*'}); res.end(JSON.stringify(d)); }
function body(req, cb) { let b = ''; req.on('data', d => { b += d; if (b.length > 2e6) req.destroy(); }); req.on('end', () => { try { cb(null, JSON.parse(b)); } catch (e) { cb(e); } }); }

// ── SERVEUR HTTP ────────────────────────────────────────────────────────────
const server = http.createServer(function(req, res) {
  const p = req.url.split('?')[0], m = req.method;
  const qs = Object.fromEntries(new URL('http://x' + req.url).searchParams);
  if (m === 'OPTIONS') { res.writeHead(200, {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE', 'Access-Control-Allow-Headers': 'Content,Authorization'}); return res.end(); }

  // ── PAGE PUBLIQUE ─────────────────────────────────────────────────────────
  if (p === '/' || p === '/accueil') { res.writeHead(200, {'Content-Type': 'text/html;charset=utf-8'}); return res.end(buildPublicPage()); }

  // ── API PUBLIQUE ──────────────────────────────────────────────────────────
  if (p === '/api/public') {
    var now2 = new Date().toISOString().slice(0, 10);
    var _ev2 = Evenements.getAll(), _ag2 = Agenda.getAll(), _ann2 = Annonces.getAll(), _el2 = Elus.getAll(), _pr2 = Projets.getAll();
    var pub = {
      evenements: _ev2.filter(function(e) { return e.date >= now2 && e.visibilite !== 'prive'; }).slice(0, 20),
      agenda: _ag2.filter(function(a) { return a.date >= now2 && a.type === 'conseil'; }).slice(0, 10),
      annonces: _ann2.filter(function(a) { return a.visibilite === 'public'; }).slice(0, 5),
      stats: {projets: _pr2.length, elus: _el2.length}
    };
    return J(res, pub);
  }

  // ── UPLOAD FICHIER ────────────────────────────────────────────────────────
  if (p === '/api/upload' && m === 'POST') {
    var ct = req.headers['content-type'] || '';
    if (!ct.includes('multipart/form-data')) return J(res, {ok: false, error: 'multipart requis'}, 400);
    var boundary = ct.split('boundary=')[1];
    if (!boundary) return J(res, {ok: false, error: 'boundary manquant'}, 400);
    var chunks = [];
    req.on('data', function(c) { chunks.push(c); });
    req.on('end', function() {
      try {
        var buf = Buffer.concat(chunks);
        var bnd = Buffer.from('--' + boundary);
        var parts = [];
        var pos = 0;
        while (pos < buf.length) {
          var start = buf.indexOf(bnd, pos); if (start < 0) break;
          var end = buf.indexOf(bnd, start + bnd.length); if (end < 0) end = buf.length;
          parts.push(buf.slice(start + bnd.length, end));
          pos = end;
        }
        var fileData = null, fileName = '';
        parts.forEach(function(part) {
          var headerEnd = part.indexOf('\r\n\r\n'); if (headerEnd < 0) return;
          var headers = part.slice(0, headerEnd).toString();
          var body2 = part.slice(headerEnd + 4);
          if (body2[body2.length - 2] === 13 && body2[body2.length - 1] === 10) body2 = body2.slice(0, -2);
          if (headers.includes('filename=')) {
            var fnMatch = headers.match(/filename="([^"]+)"/);
            if (fnMatch) fileName = fnMatch[1];
            fileData = body2;
          }
        });
        if (!fileData || !fileName) return J(res, {ok: false, error: 'Fichier non trouvé'}, 400);
        var safeName = fileName.replace(/[^a-zA-Z0-9._\-]/g, '_');
        var ts2 = Date.now();
        var outName = ts2 + '_' + safeName;
        var outPath = path.join(DIR, 'uploads', outName);
        try { fs.mkdirSync(path.join(DIR, 'uploads'), {recursive: true}); } catch (e) {}
        fs.writeFileSync(outPath, fileData);
        return J(res, {ok: true, url: '/uploads/' + outName, nom: fileName, taille: fileData.length});
      } catch (e) { return J(res, {ok: false, error: e.message}, 500); }
    });
    return;
  }

  // ── SERVIR UPLOADS ────────────────────────────────────────────────────────
  if (p.startsWith('/uploads/')) {
    var fname2 = p.slice(9);
    var fpath = path.join(DIR, 'uploads', fname2);
    try {
      var fdata = fs.readFileSync(fpath);
      var ext2 = fname2.split('.').pop().toLowerCase();
      var mimes = {'pdf': 'application/pdf', 'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'gif': 'image/gif', 'mp4': 'video/mp4', 'txt': 'text/plain', 'csv': 'text/csv'};
      var mime = mimes[ext2] || 'application/octet-stream';
      res.writeHead(200, {'Content-Type': mime, 'Content-Disposition': 'inline; filename="' + fname2 + '"'});
      return res.end(fdata);
    } catch (e) { return J(res, {ok: false, error: 'Fichier non trouvé'}, 404); }
  }

  // ── MOT DE PASSE OUBLIÉ ───────────────────────────────────────────────────
  if (p === '/forgot-password' && m === 'GET') return handleForgotPasswordGet(req, res, qs, ACCOUNTS, config);
  if (p === '/forgot-password' && m === 'POST') return handleForgotPasswordPost(req, res, qs, ACCOUNTS, config);
  if (p === '/reset-password' && m === 'GET') return handleResetPasswordGet(req, res, qs, ACCOUNTS, config);
  if (p === '/reset-password' && m === 'POST') return handleResetPasswordPost(req, res, qs, ACCOUNTS, config);

  // ── LOGIN ─────────────────────────────────────────────────────────────────
  if (p === '/login' && m === 'POST') {
    let chunks2 = [];
    req.on('data', c => chunks2.push(c));
    req.on('end', () => {
      try {
        var qs2 = new URLSearchParams(Buffer.concat(chunks2).toString());
        var user = (qs2.get('username') || '').toLowerCase().trim();
        var pwd = qs2.get('password') || '';
        var ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';

        // Anti-brute-force
        if (checkBruteForce(ip)) {
          recordAttempt(ip, false);
          deny(res, 'Trop de tentatives. Réessayez dans 15 minutes.');
          return;
        }

        var account = ACCOUNTS[user];
        if (!account || !checkPassword(pwd, account.pwd)) {
          recordAttempt(ip, false);
          // Log tentative échouée
          try { db.prepare('INSERT INTO access_logs (username,nom,ip,success) VALUES (?,?,?,0)').run(user, '', ip); } catch (e) {}
          deny(res, 'Identifiant ou mot de passe incorrect. Réessayez.');
          return;
        }

        recordAttempt(ip, true);
        // Log connexion réussie
        try { db.prepare('INSERT INTO access_logs (username,nom,ip,success) VALUES (?,?,?,1)').run(user, account.nom || user, ip); } catch (e) {}

        // Migration auto : hasher le mot de passe s'il est en clair
        if (!account.pwd.startsWith('$2')) {
          account.pwd = hashPassword(pwd);
          try { fs.writeFileSync(path.join(DIR, 'accounts.json'), JSON.stringify(ACCOUNTS, null, 2), 'utf8'); } catch (e) {}
        }

        var token = makeToken();
        SESSIONS[token] = {username: user, expires: Date.now() + 7 * 24 * 3600 * 1000};
        res.writeHead(302, {
          'Location': '/espace',
          'Set-Cookie': 'vem_session=' + token + '; Path=/; HttpOnly; Max-Age=604800; SameSite=Lax'
        });
        res.end();
      } catch (e) { deny(res, 'Erreur serveur'); }
    });
    return;
  }

  if (p === '/login' && m === 'GET') { deny(res, null); return; }
  if (!auth(req)) { res.writeHead(302, {'Location': '/login'}); return res.end(); }

  // ── ROUTES API (authentifiées) ────────────────────────────────────────────
  const ME = authUser(req);
  if (handleRoutes(req, res, p, m, qs, ME)) return;

  // ── LOGOUT ────────────────────────────────────────────────────────────────
  if (p === '/logout') {
    var cookies3 = req.headers.cookie || '';
    var m3 = cookies3.match(/vem_session=([a-f0-9]+)/);
    if (m3) delete SESSIONS[m3[1]];
    res.writeHead(302, {'Location': '/login', 'Set-Cookie': 'vem_session=; Path=/; Max-Age=0'});
    return res.end();
  }

  // ── ESPACE PRIVÉ ──────────────────────────────────────────────────────────
  if (p === '/espace' || p === '/dashboard') {
    var ME2 = authUser(req);
    if (!ME2) { res.writeHead(302, {'Location': '/login'}); return res.end(); }
    res.writeHead(200, {'Content-Type': 'text/html;charset=utf-8'});
    return res.end(buildPage());
  }

  res.writeHead(404); res.end('404');
});

server.listen(PORT, () => console.log('VeM SQLite port ' + PORT));
