// ── AUTH MODULE ──────────────────────────────────────────────────────────────
// Extracted authentication logic from server.js
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

module.exports = function(ACCOUNTS, RESET_TOKENS, mailTransporter, config) {
  // config: { DIR, GMAIL_USER, ADMIN_EMAIL, PORT, ELUS_DEF, db }
  var DIR = config.DIR;
  var GMAIL_USER = config.GMAIL_USER;
  var ADMIN_EMAIL = config.ADMIN_EMAIL;
  var PORT = config.PORT;
  var ELUS_DEF = config.ELUS_DEF || [];
  var db = config.db;

  // ── ACCESS LOGS TABLE ───────────────────────────────────────────────────────
  try { db.exec("CREATE TABLE IF NOT EXISTS access_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, nom TEXT, ip TEXT, success INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now','localtime')))"); } catch(e) {}

  // ── SESSIONS ────────────────────────────────────────────────────────────────
  const SESSIONS = {}; // token → {username, expires}
  function makeToken(){ return crypto.randomBytes(24).toString('hex'); }
  function getSession(req){
    var cookies = req.headers.cookie||'';
    var m = cookies.match(/vem_session=([a-f0-9]+)/);
    if(!m) return null;
    var s = SESSIONS[m[1]];
    if(!s) return null;
    if(s.expires < Date.now()){ delete SESSIONS[m[1]]; return null; }
    return s;
  }
  function authUser(req){
    // 1. Cookie session (navigateur)
    var sess = getSession(req);
    if(sess) return ACCOUNTS[sess.username]?{username:sess.username,...ACCOUNTS[sess.username]}:null;
    // 2. Basic Auth (appels API depuis le JS)
    const a=req.headers['authorization']||'';
    if(!a.startsWith('Basic '))return null;
    const dec=Buffer.from(a.slice(6),'base64').toString();
    const colon=dec.indexOf(':');
    if(colon<0)return null;
    const user=dec.slice(0,colon).toLowerCase();
    const pwd=dec.slice(colon+1);
    const account=ACCOUNTS[user];
    if(!account||!checkPassword(pwd,account.pwd))return null;
    var email=account.email||'';
    if(!email){var eluMatch=ELUS_DEF.find?ELUS_DEF.find(function(e){return e.id===account.id;}):null;if(eluMatch)email=eluMatch.email||'';}
    return {username:user,prenom:account.nom?(account.nom.split(' ')[0]):'',photo:account.photo||'',photoPos:account.photoPos||'center center',email:email,...account};
  }
  function auth(req){return !!authUser(req);}

  // ── HELPERS COMPATIBILITÉ ───────────────────────────────────────────────────
  function nid(table){return db.prepare('SELECT COALESCE(MAX(id),0)+1 as n FROM '+table).get().n;}
  function save(){} // no-op — SQLite gère tout
  function load(){return [];} // no-op

  // ── PASSWORD HASHING ────────────────────────────────────────────────────────
  function hashPassword(pwd) {
    return bcrypt.hashSync(pwd, 10);
  }
  function checkPassword(pwd, hash) {
    if (hash && hash.startsWith('$2')) {
      return bcrypt.compareSync(pwd, hash);
    }
    return pwd === hash; // plain text fallback for migration
  }

  // ── BRUTE-FORCE PROTECTION ──────────────────────────────────────────────────
  const LOGIN_ATTEMPTS = {}; // ip → {count, lastAttempt}
  function checkBruteForce(ip) {
    var entry = LOGIN_ATTEMPTS[ip];
    if (!entry) return false;
    // Reset if last attempt was more than 15 minutes ago
    if (Date.now() - entry.lastAttempt > 15 * 60 * 1000) {
      delete LOGIN_ATTEMPTS[ip];
      return false;
    }
    return entry.count > 5;
  }
  function recordAttempt(ip, success) {
    if (success) {
      delete LOGIN_ATTEMPTS[ip];
      return;
    }
    if (!LOGIN_ATTEMPTS[ip]) {
      LOGIN_ATTEMPTS[ip] = { count: 0, lastAttempt: Date.now() };
    }
    LOGIN_ATTEMPTS[ip].count++;
    LOGIN_ATTEMPTS[ip].lastAttempt = Date.now();
  }

  // ── DENY (LOGIN PAGE) ──────────────────────────────────────────────────────
  function deny(res,msg){
    var errHtml = msg ? '<div style="background:#fee2e2;color:#b91c1c;border-radius:10px;padding:.75rem 1rem;font-size:.78rem;margin-bottom:1rem;font-weight:600">'+msg+'</div>' : '';
    res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});
    res.end(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connexion — VeM Espace élus</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:-apple-system,"Inter",sans-serif;background:linear-gradient(135deg,#0d1e35 0%,#1a3a5c 50%,#2d5a87 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;}
  .box{background:#fff;border-radius:20px;padding:2.5rem 2.75rem;width:min(400px,90vw);box-shadow:0 24px 80px rgba(0,0,0,.35);}
  .logo{display:flex;align-items:center;gap:12px;margin-bottom:1.75rem;justify-content:center;}
  .logo-ico{width:44px;height:44px;border-radius:12px;background:#1a3a2a;display:flex;align-items:center;justify-content:center;font-size:1.3rem;}
  .logo-txt{font-size:.85rem;font-weight:700;color:#1a3a2a;line-height:1.3;}
  .logo-sub{font-size:.7rem;color:#6a7870;font-weight:400;}
  label{display:block;font-size:.68rem;font-weight:700;color:#4a6858;text-transform:uppercase;letter-spacing:.06em;margin-bottom:.35rem;}
  input{width:100%;border:1.5px solid #d0dce8;border-radius:10px;padding:.65rem .9rem;font-size:.88rem;outline:none;transition:.15s;background:#f4f8fc;}
  input:focus{border-color:#2d5a87;background:#fff;box-shadow:0 0 0 3px rgba(45,90,135,.12);}
  .field{margin-bottom:1rem;}
  button{width:100%;background:#1a3a5c;color:#fff;border:none;border-radius:12px;padding:.8rem;font-size:.9rem;font-weight:700;cursor:pointer;margin-top:.5rem;transition:.15s;}
  button:hover{background:#2d5a87;}
  .hint{font-size:.7rem;color:#9aada6;text-align:center;margin-top:1.25rem;line-height:1.6;}
  code{background:#f0fdf4;padding:1px 5px;border-radius:4px;border:1px solid #b8d9c4;font-family:monospace;color:#2d5a40;}
</style></head>
<body><div class="box">
  <div class="logo">
    <div class="logo-ico" style="background:linear-gradient(135deg,#1a3a5c,#2d5a87)">🏛</div>
    <div class="logo-txt">Vizille en Mouvement<br><span class="logo-sub">Espace des conseillers municipaux</span></div>
  </div>
  ${errHtml}
  <form method="POST" action="/login">
    <div class="field">
      <label>Identifiant</label>
      <input type="text" name="username" placeholder="prenom.nom" autocomplete="username" autocorrect="off" autocapitalize="none" required>
    </div>
    <div class="field">
      <label>Mot de passe</label>
      <input type="password" name="password" placeholder="••••••••" autocomplete="current-password" required>
    </div>
    <button type="submit">Se connecter →</button>
  </form>
  <p style="text-align:center;margin-top:1rem"><a href="/forgot-password" style="font-size:.78rem;color:#2d5a87;text-decoration:none;font-weight:600">Mot de passe oublié ?</a></p>
  <p class="hint">Identifiant : <code>prenom.nom</code> · Mot de passe communiqué par l'administrateur<br>En cas de problème : <a href="mailto:thuilliermichel@mac.com" style="color:#2d5a40">contacter l'admin</a></p>
</div></body></html>`);
  }

  // ── FORGOT PASSWORD GET ─────────────────────────────────────────────────────
  function handleForgotPasswordGet(req, res, qs, ACCOUNTS, config) {
    var fMsg=qs.msg==='ok'?'<div style="background:#f0fdf4;color:#166534;border-radius:10px;padding:.75rem 1rem;font-size:.78rem;margin-bottom:1rem;font-weight:600">Demande envoyée ! L\'administrateur va vous transmettre un lien de réinitialisation.</div>'
      :qs.msg==='unknown'?'<div style="background:#fee2e2;color:#b91c1c;border-radius:10px;padding:.75rem 1rem;font-size:.78rem;margin-bottom:1rem;font-weight:600">Identifiant inconnu. Vérifiez votre saisie.</div>':'';
    res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});
    return res.end(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mot de passe oublié — VeM</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:-apple-system,"Inter",sans-serif;background:linear-gradient(135deg,#0d1e35 0%,#1a3a5c 50%,#2d5a87 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;}
  .box{background:#fff;border-radius:20px;padding:2.5rem 2.75rem;width:min(400px,90vw);box-shadow:0 24px 80px rgba(0,0,0,.35);}
  .logo{display:flex;align-items:center;gap:12px;margin-bottom:1.75rem;justify-content:center;}
  .logo-ico{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.3rem;}
  .logo-txt{font-size:.85rem;font-weight:700;color:#1a3a2a;line-height:1.3;}
  .logo-sub{font-size:.7rem;color:#6a7870;font-weight:400;}
  label{display:block;font-size:.68rem;font-weight:700;color:#4a6858;text-transform:uppercase;letter-spacing:.06em;margin-bottom:.35rem;}
  input{width:100%;border:1.5px solid #d0dce8;border-radius:10px;padding:.65rem .9rem;font-size:.88rem;outline:none;transition:.15s;background:#f4f8fc;}
  input:focus{border-color:#2d5a87;background:#fff;box-shadow:0 0 0 3px rgba(45,90,135,.12);}
  .field{margin-bottom:1rem;}
  button{width:100%;background:#1a3a5c;color:#fff;border:none;border-radius:12px;padding:.8rem;font-size:.9rem;font-weight:700;cursor:pointer;margin-top:.5rem;transition:.15s;}
  button:hover{background:#2d5a87;}
  .hint{font-size:.7rem;color:#9aada6;text-align:center;margin-top:1.25rem;line-height:1.6;}
</style></head>
<body><div class="box">
  <div class="logo">
    <div class="logo-ico" style="background:linear-gradient(135deg,#1a3a5c,#2d5a87)">🔑</div>
    <div class="logo-txt">Mot de passe oublié<br><span class="logo-sub">Demande de réinitialisation</span></div>
  </div>
  ${fMsg}
  <form method="POST" action="/forgot-password">
    <div class="field">
      <label>Votre identifiant</label>
      <input type="text" name="username" placeholder="prenom.nom" autocomplete="username" autocorrect="off" autocapitalize="none" required>
    </div>
    <button type="submit">Envoyer la demande →</button>
  </form>
  <p class="hint"><a href="/login" style="color:#2d5a87;text-decoration:none">← Retour à la connexion</a></p>
</div></body></html>`);
  }

  // ── FORGOT PASSWORD POST ────────────────────────────────────────────────────
  function handleForgotPasswordPost(req, res, qs, ACCOUNTS, config) {
    let chunks=[];
    req.on('data',c=>chunks.push(c));
    req.on('end',()=>{
      try{
        var qs2=new URLSearchParams(Buffer.concat(chunks).toString());
        var user=(qs2.get('username')||'').toLowerCase().trim();
        if(!ACCOUNTS[user]){
          res.writeHead(302,{'Location':'/forgot-password?msg=unknown'});
          return res.end();
        }
        // Générer un token de réinitialisation (valable 1h)
        var token=crypto.randomBytes(32).toString('hex');
        RESET_TOKENS[token]={username:user,expires:Date.now()+3600*1000};
        // Déterminer l'URL du site
        var host=req.headers.host||'localhost:'+PORT;
        var proto=req.headers['x-forwarded-proto']||'http';
        var resetUrl=proto+'://'+host+'/reset-password?token='+token;
        var eluNom=ACCOUNTS[user].nom||user;
        // Envoyer l'email à l'admin
        var emailText='Demande de reinitialisation de mot de passe\n\n'
          +eluNom+' (identifiant : '+user+') a demande une reinitialisation de mot de passe.\n\n'
          +'Transmettez-lui ce lien (valable 1 heure) :\n'+resetUrl+'\n';
        var emailHtml='<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px">'
          +'<h2 style="color:#1a3a5c">Demande de r&eacute;initialisation de mot de passe</h2>'
          +'<p><strong>'+eluNom+'</strong> (identifiant : <code>'+user+'</code>) a demand&eacute; une r&eacute;initialisation de mot de passe.</p>'
          +'<p>Transmettez-lui ce lien (valable 1 heure) :</p>'
          +'<p style="background:#f0fdf4;border:1px solid #b8d9c4;border-radius:8px;padding:12px;word-break:break-all"><a href="'+resetUrl+'">'+resetUrl+'</a></p>'
          +'<p style="font-size:12px;color:#888">Ce lien expire dans 1 heure.</p>'
          +'</div>';
        mailTransporter.sendMail({
          from:'VeM Espace Elus <'+GMAIL_USER+'>',
          to:ADMIN_EMAIL,
          subject:'Demande de reinitialisation mot de passe - '+eluNom,
          text:emailText,
          html:emailHtml
        },function(err){
          if(err)console.log('Erreur envoi email reset:',err.message);
          else console.log('Email reset envoye a '+ADMIN_EMAIL+' pour '+user);
        });
        res.writeHead(302,{'Location':'/forgot-password?msg=ok'});
        res.end();
      }catch(e){res.writeHead(302,{'Location':'/forgot-password'});res.end();}
    });
  }

  // ── RESET PASSWORD GET ──────────────────────────────────────────────────────
  function handleResetPasswordGet(req, res, qs, ACCOUNTS, config) {
    var tk=qs.token||'';
    var rst=RESET_TOKENS[tk];
    var pageMsg='';
    if(!rst||rst.expires<Date.now()){
      pageMsg='<div style="background:#fee2e2;color:#b91c1c;border-radius:10px;padding:.75rem 1rem;font-size:.78rem;margin-bottom:1rem;font-weight:600">Lien expiré ou invalide. Faites une nouvelle demande.</div>';
    }
    if(qs.msg==='ok'){
      pageMsg='<div style="background:#f0fdf4;color:#166534;border-radius:10px;padding:.75rem 1rem;font-size:.78rem;margin-bottom:1rem;font-weight:600">Mot de passe modifié avec succès ! Vous pouvez vous connecter.</div>';
    }
    if(qs.msg==='short'){
      pageMsg='<div style="background:#fee2e2;color:#b91c1c;border-radius:10px;padding:.75rem 1rem;font-size:.78rem;margin-bottom:1rem;font-weight:600">Mot de passe trop court (5 caractères minimum).</div>';
    }
    if(qs.msg==='mismatch'){
      pageMsg='<div style="background:#fee2e2;color:#b91c1c;border-radius:10px;padding:.75rem 1rem;font-size:.78rem;margin-bottom:1rem;font-weight:600">Les mots de passe ne correspondent pas.</div>';
    }
    var formDisabled=(!rst||rst.expires<Date.now())&&qs.msg!=='ok';
    res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});
    return res.end(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Nouveau mot de passe — VeM</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:-apple-system,"Inter",sans-serif;background:linear-gradient(135deg,#0d1e35 0%,#1a3a5c 50%,#2d5a87 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;}
  .box{background:#fff;border-radius:20px;padding:2.5rem 2.75rem;width:min(400px,90vw);box-shadow:0 24px 80px rgba(0,0,0,.35);}
  .logo{display:flex;align-items:center;gap:12px;margin-bottom:1.75rem;justify-content:center;}
  .logo-ico{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.3rem;}
  .logo-txt{font-size:.85rem;font-weight:700;color:#1a3a2a;line-height:1.3;}
  .logo-sub{font-size:.7rem;color:#6a7870;font-weight:400;}
  label{display:block;font-size:.68rem;font-weight:700;color:#4a6858;text-transform:uppercase;letter-spacing:.06em;margin-bottom:.35rem;}
  input{width:100%;border:1.5px solid #d0dce8;border-radius:10px;padding:.65rem .9rem;font-size:.88rem;outline:none;transition:.15s;background:#f4f8fc;}
  input:focus{border-color:#2d5a87;background:#fff;box-shadow:0 0 0 3px rgba(45,90,135,.12);}
  .field{margin-bottom:1rem;}
  button{width:100%;background:#1a3a5c;color:#fff;border:none;border-radius:12px;padding:.8rem;font-size:.9rem;font-weight:700;cursor:pointer;margin-top:.5rem;transition:.15s;}
  button:hover{background:#2d5a87;}
  button:disabled{background:#9ca3af;cursor:not-allowed;}
  .hint{font-size:.7rem;color:#9aada6;text-align:center;margin-top:1.25rem;line-height:1.6;}
</style></head>
<body><div class="box">
  <div class="logo">
    <div class="logo-ico" style="background:linear-gradient(135deg,#1a3a5c,#2d5a87)">🔑</div>
    <div class="logo-txt">Nouveau mot de passe<br><span class="logo-sub">Réinitialisation</span></div>
  </div>
  ${pageMsg}
  <form method="POST" action="/reset-password" ${formDisabled?'style="display:none"':''}>
    <input type="hidden" name="token" value="${tk}">
    <div class="field">
      <label>Nouveau mot de passe</label>
      <input type="password" name="newpwd" placeholder="Minimum 5 caractères…" autocomplete="new-password" required minlength="5">
    </div>
    <div class="field">
      <label>Confirmer le mot de passe</label>
      <input type="password" name="newpwd2" placeholder="Répéter le mot de passe…" autocomplete="new-password" required>
    </div>
    <button type="submit">Changer le mot de passe →</button>
  </form>
  <p class="hint"><a href="/login" style="color:#2d5a87;text-decoration:none">← Retour à la connexion</a></p>
</div></body></html>`);
  }

  // ── RESET PASSWORD POST ─────────────────────────────────────────────────────
  function handleResetPasswordPost(req, res, qs, ACCOUNTS, config) {
    let chunks=[];
    req.on('data',c=>chunks.push(c));
    req.on('end',()=>{
      try{
        var qs2=new URLSearchParams(Buffer.concat(chunks).toString());
        var tk=qs2.get('token')||'';
        var newpwd=qs2.get('newpwd')||'';
        var newpwd2=qs2.get('newpwd2')||'';
        var rst=RESET_TOKENS[tk];
        if(!rst||rst.expires<Date.now()){
          res.writeHead(302,{'Location':'/reset-password?token='+tk});
          return res.end();
        }
        if(newpwd.length<5){
          res.writeHead(302,{'Location':'/reset-password?token='+tk+'&msg=short'});
          return res.end();
        }
        if(newpwd!==newpwd2){
          res.writeHead(302,{'Location':'/reset-password?token='+tk+'&msg=mismatch'});
          return res.end();
        }
        // Changer le mot de passe (hash avec bcrypt)
        ACCOUNTS[rst.username].pwd=hashPassword(newpwd);
        try{fs.writeFileSync(path.join(DIR,'accounts.json'),JSON.stringify(ACCOUNTS,null,2),'utf8');}catch(e){}
        // Supprimer le token utilisé
        delete RESET_TOKENS[tk];
        console.log('Mot de passe réinitialisé pour '+rst.username);
        res.writeHead(302,{'Location':'/reset-password?msg=ok'});
        res.end();
      }catch(e){res.writeHead(302,{'Location':'/login'});res.end();}
    });
  }

  // ── RETURN PUBLIC API ───────────────────────────────────────────────────────
  return {
    SESSIONS,
    makeToken,
    getSession,
    authUser,
    auth,
    deny,
    nid,
    save,
    load,
    hashPassword,
    checkPassword,
    checkBruteForce,
    recordAttempt,
    handleForgotPasswordGet,
    handleForgotPasswordPost,
    handleResetPasswordGet,
    handleResetPasswordPost
  };
};
