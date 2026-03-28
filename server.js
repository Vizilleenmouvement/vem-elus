const http=require('http'),https=require('https'),fs=require('fs'),path=require('path'),tls=require('tls');
const PORT=process.env.PORT||3000, DIR=__dirname;

// ── ENVOI EMAIL SMTP GMAIL (sans nodemailer) ────────────────────────────────
const GMAIL_USER=process.env.GMAIL_USER||'mth144443@gmail.com';
const GMAIL_PASS=process.env.GMAIL_PASS||'vhpd jinu qhvf meet';
const ADMIN_EMAIL=process.env.ADMIN_EMAIL||'thuilliermichel@mac.com';

function sendEmail(to,subject,textBody,htmlBody,cb){
  cb=cb||function(){};
  var commands=[],step=0,socket=null;
  var msg='From: VeM Espace Elus <'+GMAIL_USER+'>\r\nTo: '+to+'\r\nSubject: =?UTF-8?B?'+Buffer.from(subject).toString('base64')+'?=\r\nMIME-Version: 1.0\r\nContent-Type: multipart/alternative; boundary="vem_boundary"\r\n\r\n--vem_boundary\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n'+(textBody||'')+'\r\n--vem_boundary\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n'+(htmlBody||'')+'\r\n--vem_boundary--\r\n.\r\n';
  commands=['EHLO localhost\r\n','AUTH LOGIN\r\n',Buffer.from(GMAIL_USER).toString('base64')+'\r\n',Buffer.from(GMAIL_PASS).toString('base64')+'\r\n','MAIL FROM:<'+GMAIL_USER+'>\r\n','RCPT TO:<'+to+'>\r\n','DATA\r\n',msg,'QUIT\r\n'];
  var net=require('net');
  var sock=net.createConnection(587,'smtp.gmail.com',function(){
    sock.on('data',function(data){
      var r=data.toString();
      if(r.startsWith('220')&&step===0){sock.write(commands[step++]);return;}
      if(r.includes('STARTTLS')){sock.write('STARTTLS\r\n');return;}
      if(r.startsWith('220')&&step===1){
        socket=tls.connect({socket:sock,host:'smtp.gmail.com'},function(){
          socket.write(commands[0]);step=1;
          socket.on('data',function(d2){
            var r2=d2.toString();
            if(step<commands.length){socket.write(commands[step++]);}
            if(r2.startsWith('235')){/* auth ok */}
            if(r2.startsWith('221')){socket.end();cb(null);}
            if(r2.startsWith('5')){socket.end();cb(new Error(r2.trim()));}
          });
        });
        return;
      }
      if(step<commands.length){sock.write(commands[step++]);}
    });
  });
  sock.on('error',function(e){cb(e);});
  sock.setTimeout(15000,function(){sock.destroy();cb(new Error('Timeout SMTP'));});
}
const RESET_TOKENS={};

// ── ANTI-BRUTE-FORCE ────────────────────────────────────────────────────────
const LOGIN_ATTEMPTS={};
function checkBruteForce(ip){var a=LOGIN_ATTEMPTS[ip];if(!a)return false;if(Date.now()-a.last>900000){delete LOGIN_ATTEMPTS[ip];return false;}return a.count>=5;}
function recordAttempt(ip,ok){if(ok){delete LOGIN_ATTEMPTS[ip];return;}if(!LOGIN_ATTEMPTS[ip])LOGIN_ATTEMPTS[ip]={count:0,last:0};LOGIN_ATTEMPTS[ip].count++;LOGIN_ATTEMPTS[ip].last=Date.now();}

const {Elus,Agenda,Projets,Statuts,CR,Biblio,Signalements,Evenements,Chat,Annonces,Tasks,Notifs,RepElus,stats:dbStats,ts,db,ProjetJalons,ProjetPartenaires,ProjetContacts,ProjetDocs,ProjetPresse,ProjetJournal,BiblioDoc} = require('./db.js');
try{db.exec("CREATE TABLE IF NOT EXISTS access_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, nom TEXT, ip TEXT, success INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now','localtime')))");}catch(e){}
try{db.exec("CREATE TABLE IF NOT EXISTS articles (id INTEGER PRIMARY KEY AUTOINCREMENT, titre TEXT NOT NULL, url TEXT DEFAULT '', source TEXT DEFAULT '', resume TEXT DEFAULT '', tags TEXT DEFAULT '', auteur_id INTEGER DEFAULT 0, auteur_nom TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now','localtime')))");}catch(e){}
// Articles par défaut au premier démarrage
try{
  var artCount=db.prepare('SELECT COUNT(*) as n FROM articles').get().n;
  if(artCount<3){
    var defArticles=[
      {titre:"Guide pratique de l'élu local 2026",url:"https://www.amf.asso.fr/page-guide-du-maire/40",source:"AMF",resume:"Le guide complet de l'Association des Maires de France pour les nouveaux élus. Droits, devoirs, indemnités, formation.",tags:"guide,droits,formation"},
      {titre:"Finances locales : comprendre le budget de sa commune",url:"https://www.collectivites-locales.gouv.fr/finances-locales/budgets-locaux",source:"Gouv.fr",resume:"Tout savoir sur le budget communal, les dotations de l'État, la fiscalité locale et les règles comptables.",tags:"budget,finances"},
      {titre:"Transition écologique : les leviers des communes",url:"https://www.ecologie.gouv.fr/collectivites-et-transition-ecologique",source:"Min. Écologie",resume:"Plan de transition écologique pour les collectivités. Rénovation énergétique, mobilités douces, biodiversité.",tags:"écologie,transition"},
      {titre:"Urbanisme et PLU : guide pour les élus",url:"https://www.cohesion-territoires.gouv.fr/plan-local-durbanisme-intercommunal-plui-et-plan-local-durbanisme-plu",source:"Gouv.fr",resume:"Comprendre le Plan Local d'Urbanisme, les permis de construire et les outils de maîtrise foncière.",tags:"urbanisme,PLU"},
      {titre:"Commande publique : les marchés pour les petites communes",url:"https://www.economie.gouv.fr/daj/commande-publique",source:"Min. Économie",resume:"Les règles de la commande publique simplifiées. Seuils, procédures, dématérialisation des marchés.",tags:"marchés publics"},
      {titre:"RGPD et collectivités : obligations et bonnes pratiques",url:"https://www.cnil.fr/fr/collectivites-territoriales",source:"CNIL",resume:"Protection des données personnelles dans les communes. Registre des traitements, DPO, droits des administrés.",tags:"RGPD,données"},
      {titre:"Grenoble-Alpes Métropole : compétences et financements",url:"https://www.grenoblealpesmetropole.fr/11-competences.htm",source:"Métropole",resume:"Les compétences transférées à la Métropole, les contrats de territoire et les dispositifs de financement.",tags:"métropole,financement"},
      {titre:"Conflits d'intérêts : guide pour les élus locaux",url:"https://www.observatoire-collectivites.org/spip.php?article9143",source:"Observatoire",resume:"Guide pratique sur la prévention des conflits d'intérêts dans les collectivités. Déport, déclarations, cas concrets.",tags:"déontologie,conflits"}
    ];
    var stmt=db.prepare('INSERT INTO articles (titre,url,source,resume,tags,auteur_nom) VALUES (?,?,?,?,?,?)');
    defArticles.forEach(function(a){stmt.run(a.titre,a.url,a.source,a.resume,a.tags,'Administrateur');});
    console.log('✓ '+defArticles.length+' articles de veille créés');
  }
  // Mettre à jour les URLs corrigées
  var urlFixes={"https://www.amf.asso.fr/documents-guide-lelu-local/41190":"https://www.amf.asso.fr/page-guide-du-maire/40","https://www.collectivites-locales.gouv.fr/finances-locales":"https://www.collectivites-locales.gouv.fr/finances-locales/budgets-locaux","https://www.ecologie.gouv.fr/politiques-publiques/transition-ecologique-collectivites":"https://www.ecologie.gouv.fr/collectivites-et-transition-ecologique","https://www.cohesion-territoires.gouv.fr/plan-local-durbanisme-plu":"https://www.cohesion-territoires.gouv.fr/plan-local-durbanisme-intercommunal-plui-et-plan-local-durbanisme-plu","https://www.grenoblealpesmetropole.fr":"https://www.grenoblealpesmetropole.fr/11-competences.htm","https://www.hatvp.fr/la-deontologie/":"https://www.observatoire-collectivites.org/spip.php?article9143"};
  var upd=db.prepare('UPDATE articles SET url=? WHERE url=?');
  Object.keys(urlFixes).forEach(function(old){upd.run(urlFixes[old],old);});
  // Mettre à jour le titre/source de l'article HATVP → Observatoire
  db.prepare("UPDATE articles SET titre='Conflits d''intérêts : guide pour les élus locaux',source='Observatoire',resume='Guide pratique sur la prévention des conflits d''intérêts dans les collectivités. Déport, déclarations, cas concrets.',tags='déontologie,conflits' WHERE url='https://www.observatoire-collectivites.org/spip.php?article9143'").run();
}catch(e){}

// Comptes élus — peuvent être surchargés via ACCOUNTS_JSON env var
const ACCOUNTS_DEFAULT = {
  "catherine.troton": {
    "id": 1,
    "nom": "Catherine Troton",
    "role": "Tête de Liste",
    "delegation": "",
    "avatar": "CT",
    "color": "#1a3a2a",
    "photo": "https://vizilleenmouvement.fr/images/catherine-troton.jpg",
    "pwd": "ctr2026",
    "email": "catherine.troton@ville-vizille.fr"
  },
  "bernard.ughetto-monfrin": {
    "id": 2,
    "nom": "Bernard Ughetto-Monfrin",
    "role": "Adjoint",
    "delegation": "",
    "avatar": "BU",
    "color": "#2d5a40",
    "photo": "https://vizilleenmouvement.fr/images/bernard-ughetto-monfrin.jpg",
    "pwd": "bug2026",
    "email": "bernard.UGHETTO-MONFRIN@ville-vizille.fr"
  },
  "saida.berriche": {
    "id": 3,
    "nom": "Saïda Berriche",
    "role": "Adjointe",
    "delegation": "",
    "avatar": "SB",
    "color": "#3d7a5a",
    "photo": "https://vizilleenmouvement.fr/images/saida-berriche.jpg",
    "pwd": "sbe2026",
    "email": "saida.berriche@ville-vizille.fr"
  },
  "gilles.faure": {
    "id": 4,
    "nom": "Gilles Faure",
    "role": "Adjoint",
    "delegation": "",
    "avatar": "GF",
    "color": "#8B5CF6",
    "photo": "https://vizilleenmouvement.fr/images/gilles-faure.jpg",
    "pwd": "gfa2026",
    "email": "gilles.FAURE@ville-vizille.fr"
  },
  "angelique.hermitte": {
    "id": 5,
    "nom": "Angélique Hermitte",
    "role": "Conseillère déléguée",
    "delegation": "",
    "avatar": "AH",
    "color": "#F97316",
    "photo": "https://vizilleenmouvement.fr/images/angelique-hermitte.jpg",
    "pwd": "ahe2026",
    "email": "angelique.HERMITTE@ville-vizille.fr"
  },
  "gerard.forestier": {
    "id": 6,
    "nom": "Gérard Forestier",
    "role": "Adjoint",
    "delegation": "",
    "avatar": "GF",
    "color": "#EC4899",
    "photo": "https://vizilleenmouvement.fr/images/gerard-forestier.jpg",
    "pwd": "gfo2026",
    "email": "gerard.FORESTIER@ville-vizille.fr"
  },
  "marie-claude.argoud": {
    "id": 7,
    "nom": "Marie-Claude ARGOUD",
    "role": "Première Adjointe",
    "delegation": "",
    "avatar": "MA",
    "color": "#F59E0B",
    "photo": "https://vizilleenmouvement.fr/images/marie-claude-argoud.jpg",
    "pwd": "mar2026",
    "email": "marie-claude.ARGOUD@ville-vizille.fr"
  },
  "louis.lamarca": {
    "id": 8,
    "nom": "Louis Lamarca",
    "role": "Adjoint",
    "delegation": "",
    "avatar": "LL",
    "color": "#3B82F6",
    "photo": "https://vizilleenmouvement.fr/images/louis-lamarca.jpg",
    "pwd": "lla2026",
    "email": "Louis.Lamarca@ville-vizille.fr"
  },
  "muriel.pasquiou": {
    "id": 9,
    "nom": "Muriel Pasquiou",
    "role": "",
    "delegation": "",
    "avatar": "MP",
    "color": "#10B981",
    "photo": "https://vizilleenmouvement.fr/images/muriel-pasquiou.jpg",
    "pwd": "mpa2026",
    "email": "muriel.pasquiou@gmail.com"
  },
  "laurent.pichon": {
    "id": 10,
    "nom": "Laurent Pichon",
    "role": "",
    "delegation": "",
    "avatar": "LP",
    "color": "#EF4444",
    "photo": "https://vizilleenmouvement.fr/images/laurent-pichon.jpg",
    "pwd": "lpi2026",
    "email": "pichon.laurent@wanadoo.fr"
  },
  "sakina.yahiaoui": {
    "id": 11,
    "nom": "Sakina YAHIAOUI",
    "role": "conseillère déléguée",
    "delegation": "",
    "avatar": "SY",
    "color": "#14B8A6",
    "photo": "https://vizilleenmouvement.fr/images/sakina-yahiaoui.jpg",
    "pwd": "sya2026",
    "email": "sakina.YAHIAOUI@ville-vizille.fr"
  },
  "mohamed.cherigui": {
    "id": 12,
    "nom": "Mohamed CHERIGUI",
    "role": "",
    "delegation": "",
    "avatar": "MC",
    "color": "#6366F1",
    "photo": "https://vizilleenmouvement.fr/images/mohamed-cherigui.jpg",
    "pwd": "mch2026",
    "email": "mohamed.cherigui@sdis38.fr"
  },
  "christelle.reijasse": {
    "id": 13,
    "nom": "Christelle REIJASSE",
    "role": "",
    "delegation": "",
    "avatar": "CR",
    "color": "#db2777",
    "photo": "https://vizilleenmouvement.fr/images/christelle-reijasse.jpg",
    "pwd": "cre2026",
    "email": "reijassechristelle28@gmail.com"
  },
  "ahmed.mendess": {
    "id": 14,
    "nom": "Ahmed MENDESS",
    "role": "Conseillé délégué",
    "delegation": "",
    "avatar": "AM",
    "color": "#0891b2",
    "photo": "https://vizilleenmouvement.fr/images/ahmed-mendess.jpg",
    "pwd": "ame2026",
    "email": "ahmed.MENDESS@ville-vizille.fr"
  },
  "christine.sanchez": {
    "id": 15,
    "nom": "Christine Sanchez",
    "role": "",
    "delegation": "",
    "avatar": "CS",
    "color": "#65a30d",
    "photo": "https://vizilleenmouvement.fr/images/christine-sanchez.jpg",
    "pwd": "csa2026",
    "email": "sanchez7.christine@gmail.com"
  },
  "fabrice.pasquiou": {
    "id": 16,
    "nom": "Fabrice Pasquiou",
    "role": "Conseiller délégué",
    "delegation": "",
    "avatar": "FP",
    "color": "#7c3aed",
    "photo": "https://vizilleenmouvement.fr/images/fabrice-pasquiou.jpg",
    "pwd": "fpa2026",
    "email": "fabrice.PASQUIOU@ville-vizille.fr"
  },
  "meriem.el-kebir": {
    "id": 17,
    "nom": "Meriem El-Kebir",
    "role": "",
    "delegation": "",
    "avatar": "ME",
    "color": "#9333ea",
    "photo": "https://vizilleenmouvement.fr/images/meriem-el-kebir.jpg",
    "pwd": "mel2026",
    "email": "Meriem.El-Kebir@ville-vizille.fr"
  },
  "jean-christophe.garcia": {
    "id": 18,
    "nom": "Jean-Christophe Garcia",
    "role": "",
    "delegation": "",
    "avatar": "JG",
    "color": "#c2410c",
    "photo": "https://vizilleenmouvement.fr/images/jean-christophe-garcia.jpg",
    "pwd": "jga2026",
    "email": "jeanchristophe.garcia38@gmail.com"
  },
  "muriel.picca": {
    "id": 19,
    "nom": "Muriel PICCA",
    "role": "",
    "delegation": "",
    "avatar": "MP",
    "color": "#b45309",
    "photo": "https://vizilleenmouvement.fr/images/muriel-picca.jpg",
    "pwd": "mpi2026",
    "email": "piccamumu@hotmail.fr"
  },
  "michel.thuillier": {
    "id": 20,
    "nom": "Michel Thuillier",
    "role": "",
    "delegation": "",
    "avatar": "MT",
    "color": "#0f766e",
    "photo": "https://vizilleenmouvement.fr/images/michel-thuillier.jpg",
    "pwd": "mth2026",
    "email": "thuilliermichel@mac.com"
  },
  "isabelle.nifenecker": {
    "id": 21,
    "nom": "Isabelle Nifenecker",
    "role": "",
    "delegation": "",
    "avatar": "IN",
    "color": "#1d4ed8",
    "photo": "https://vizilleenmouvement.fr/images/isabelle-nifenecker.jpg",
    "pwd": "ini2026",
    "email": "isabelle_nifenecker@hotmail.fr"
  },
  "andre-paul.venans": {
    "id": 22,
    "nom": "André-Paul Venans",
    "role": "Conseiller",
    "delegation": "",
    "avatar": "AV",
    "color": "#be185d",
    "photo": "https://vizilleenmouvement.fr/images/andre-paul-venans.jpg",
    "pwd": "ave2026",
    "email": "Andre-Paul.Venans@ville-vizille.fr"
  },
  "nathalie.jacolin": {
    "id": 23,
    "nom": "Nathalie Jacolin",
    "role": "",
    "delegation": "",
    "avatar": "NJ",
    "color": "#15803d",
    "photo": "https://vizilleenmouvement.fr/images/nathalie-jacolin.jpg",
    "pwd": "nja2026",
    "email": "jacolin.nathalie@hotmail.fr"
  },
  "ignazio.cosentino": {
    "id": 24,
    "nom": "Ignazio Cosentino",
    "role": "",
    "delegation": "",
    "avatar": "IC",
    "color": "#b91c1c",
    "photo": "https://vizilleenmouvement.fr/images/ignazio-consentino.jpg",
    "pwd": "ico2026",
    "email": "ignazio.cosentino@free.fr"
  },
  "nathalie.germain-vey": {
    "id": 25,
    "nom": "Nathalie Germain-Vey",
    "role": "conseillère déléguée",
    "delegation": "",
    "avatar": "NG",
    "color": "#6d28d9",
    "photo": "https://vizilleenmouvement.fr/images/nathalie-germain-vey.jpg",
    "pwd": "nge2026",
    "email": "Nathalie.Germain-Vey@ville-vizille.fr"
  },
  "stephane.lasserre": {
    "id": 26,
    "nom": "Stéphane Lasserre",
    "role": "Conseiller",
    "delegation": "",
    "avatar": "SL",
    "color": "#0369a1",
    "photo": "https://vizilleenmouvement.fr/images/stephane-lasserre.jpg",
    "pwd": "sla2026",
    "email": "stephane.LASSERRE@ville-vizille.fr"
  },
  "admin": {
    "id": 0,
    "nom": "Administrateur",
    "role": "Admin",
    "delegation": "",
    "avatar": "AD",
    "color": "#1a3a2a",
    "photo": "",
    "pwd": "vem@dmin2026"
  }
};
let ACCOUNTS = JSON.parse(JSON.stringify(ACCOUNTS_DEFAULT));
// Supprimer accounts.json s'il existe (éviter les mdp hashés)
try{var af=path.join(DIR,'accounts.json');if(fs.existsSync(af)){fs.unlinkSync(af);console.log('accounts.json supprimé');}}catch(e){}
console.log('Comptes par défaut utilisés — '+Object.keys(ACCOUNTS).length+' comptes');
// ── SESSIONS ─────────────────────────────────────────────────────────────────
const SESSIONS = {}; // token → {username, expires}
function makeToken(){ return require('crypto').randomBytes(24).toString('hex'); }
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
  if(!account||account.pwd!==pwd)return null;
  var email=account.email||'';
  if(!email){var eluMatch=ELUS_DEF.find?ELUS_DEF.find(function(e){return e.id===account.id;}):null;if(eluMatch)email=eluMatch.email||'';}
  return {username:user,prenom:account.nom?(account.nom.split(' ')[0]):'',photo:account.photo||'',photoPos:account.photoPos||'center center',email:email,...account};
}
// Helpers compatibilité
function nid(table){return db.prepare('SELECT COALESCE(MAX(id),0)+1 as n FROM '+table).get().n;}
function save(){} // no-op — SQLite gère tout
function load(){return [];} // no-op

let documents=[]; // table documents non critique


const ELUS_DEF = [{"id": 1, "nom": "Troton", "prenom": "Catherine", "role": "Tête de Liste", "delegation": "", "avatar": "CT", "color": "#1a3a2a", "photo": "https://vizilleenmouvement.fr/images/catherine-troton.jpg", "photoPos": "center 40%", "tel": "", "email": "catherine.troton@ville-vizille.fr", "commission": ""}, {"id": 2, "nom": "Ughetto-Monfrin", "prenom": "Bernard", "role": "Adjoint", "delegation": "", "avatar": "BU", "color": "#2d5a40", "photo": "https://vizilleenmouvement.fr/images/bernard-ughetto-monfrin.jpg", "photoPos": "center 30%", "tel": "", "email": "bernard.UGHETTO-MONFRIN@ville-vizille.fr", "commission": ""}, {"id": 3, "nom": "Berriche", "prenom": "Saïda", "role": "Adjointe", "delegation": "", "avatar": "SB", "color": "#3d7a5a", "photo": "https://vizilleenmouvement.fr/images/saida-berriche.jpg", "photoPos": "center 25%", "tel": "", "email": "saida.berriche@ville-vizille.fr", "commission": ""}, {"id": 4, "nom": "Faure", "prenom": "Gilles", "role": "Adjoint", "delegation": "", "avatar": "GF", "color": "#8B5CF6", "photo": "https://vizilleenmouvement.fr/images/gilles-faure.jpg", "photoPos": "center center", "tel": "", "email": "gilles.FAURE@ville-vizille.fr", "commission": ""}, {"id": 5, "nom": "Hermitte", "prenom": "Angélique", "role": "Conseillère déléguée", "delegation": "", "avatar": "AH", "color": "#F97316", "photo": "https://vizilleenmouvement.fr/images/angelique-hermitte.jpg", "photoPos": "center center", "tel": "", "email": "angelique.HERMITTE@ville-vizille.fr", "commission": ""}, {"id": 6, "nom": "Forestier", "prenom": "Gérard", "role": "Adjoint", "delegation": "", "avatar": "GF", "color": "#EC4899", "photo": "https://vizilleenmouvement.fr/images/gerard-forestier.jpg", "photoPos": "center 40%", "tel": "", "email": "gerard.FORESTIER@ville-vizille.fr", "commission": ""}, {"id": 7, "nom": "ARGOUD", "prenom": "Marie-Claude", "role": "Première Adjointe", "delegation": "", "avatar": "MA", "color": "#F59E0B", "photo": "https://vizilleenmouvement.fr/images/marie-claude-argoud.jpg", "photoPos": "center center", "tel": "", "email": "marie-claude.ARGOUD@ville-vizille.fr", "commission": ""}, {"id": 8, "nom": "Lamarca", "prenom": "Louis", "role": "Adjoint", "delegation": "", "avatar": "LL", "color": "#3B82F6", "photo": "https://vizilleenmouvement.fr/images/louis-lamarca.jpg", "photoPos": "center 40%", "tel": "", "email": "Louis.Lamarca@ville-vizille.fr", "commission": ""}, {"id": 9, "nom": "Pasquiou", "prenom": "Muriel", "role": "", "delegation": "", "avatar": "MP", "color": "#10B981", "photo": "https://vizilleenmouvement.fr/images/muriel-pasquiou.jpg", "photoPos": "center center", "tel": "", "email": "muriel.pasquiou@gmail.com", "commission": ""}, {"id": 10, "nom": "Pichon", "prenom": "Laurent", "role": "", "delegation": "", "avatar": "LP", "color": "#EF4444", "photo": "https://vizilleenmouvement.fr/images/laurent-pichon.jpg", "photoPos": "center center", "tel": "", "email": "pichon.laurent@wanadoo.fr", "commission": ""}, {"id": 11, "nom": "YAHIAOUI", "prenom": "Sakina", "role": "conseillère déléguée", "delegation": "", "avatar": "SY", "color": "#14B8A6", "photo": "https://vizilleenmouvement.fr/images/sakina-yahiaoui.jpg", "photoPos": "center 40%", "tel": "", "email": "sakina.YAHIAOUI@ville-vizille.fr", "commission": ""}, {"id": 12, "nom": "CHERIGUI", "prenom": "Mohamed", "role": "", "delegation": "", "avatar": "MC", "color": "#6366F1", "photo": "https://vizilleenmouvement.fr/images/mohamed-cherigui.jpg", "photoPos": "center 25%", "tel": "", "email": "mohamed.cherigui@sdis38.fr", "commission": ""}, {"id": 13, "nom": "REIJASSE", "prenom": "Christelle", "role": "", "delegation": "", "avatar": "CR", "color": "#db2777", "photo": "https://vizilleenmouvement.fr/images/christelle-reijasse.jpg", "photoPos": "center center", "tel": "", "email": "reijassechristelle28@gmail.com", "commission": ""}, {"id": 14, "nom": "MENDESS", "prenom": "Ahmed", "role": "Conseillé délégué", "delegation": "", "avatar": "AM", "color": "#0891b2", "photo": "https://vizilleenmouvement.fr/images/ahmed-mendess.jpg", "photoPos": "center center", "tel": "", "email": "ahmed.MENDESS@ville-vizille.fr", "commission": ""}, {"id": 15, "nom": "Sanchez", "prenom": "Christine", "role": "", "delegation": "", "avatar": "CS", "color": "#65a30d", "photo": "https://vizilleenmouvement.fr/images/christine-sanchez.jpg", "photoPos": "center center", "tel": "", "email": "sanchez7.christine@gmail.com", "commission": ""}, {"id": 16, "nom": "Pasquiou", "prenom": "Fabrice", "role": "Conseiller délégué", "delegation": "", "avatar": "FP", "color": "#7c3aed", "photo": "https://vizilleenmouvement.fr/images/fabrice-pasquiou.jpg", "photoPos": "center center", "tel": "", "email": "fabrice.PASQUIOU@ville-vizille.fr", "commission": ""}, {"id": 17, "nom": "El-Kebir", "prenom": "Meriem", "role": "", "delegation": "", "avatar": "ME", "color": "#9333ea", "photo": "https://vizilleenmouvement.fr/images/meriem-el-kebir.jpg", "photoPos": "center center", "tel": "", "email": "Meriem.El-Kebir@ville-vizille.fr", "commission": ""}, {"id": 18, "nom": "Garcia", "prenom": "Jean-Christophe", "role": "", "delegation": "", "avatar": "JG", "color": "#c2410c", "photo": "https://vizilleenmouvement.fr/images/jean-christophe-garcia.jpg", "photoPos": "center center", "tel": "", "email": "jeanchristophe.garcia38@gmail.com", "commission": ""}, {"id": 19, "nom": "PICCA", "prenom": "Muriel", "role": "", "delegation": "", "avatar": "MP", "color": "#b45309", "photo": "https://vizilleenmouvement.fr/images/muriel-picca.jpg", "photoPos": "center center", "tel": "", "email": "piccamumu@hotmail.fr", "commission": ""}, {"id": 20, "nom": "Thuillier", "prenom": "Michel", "role": "", "delegation": "", "avatar": "MT", "color": "#0f766e", "photo": "https://vizilleenmouvement.fr/images/michel-thuillier.jpg", "photoPos": "center center", "tel": "", "email": "thuilliermichel@mac.com", "commission": ""}, {"id": 21, "nom": "Nifenecker", "prenom": "Isabelle", "role": "", "delegation": "", "avatar": "IN", "color": "#1d4ed8", "photo": "https://vizilleenmouvement.fr/images/isabelle-nifenecker.jpg", "photoPos": "center 40%", "tel": "", "email": "isabelle_nifenecker@hotmail.fr", "commission": ""}, {"id": 22, "nom": "Venans", "prenom": "André-Paul", "role": "Conseiller", "delegation": "", "avatar": "AV", "color": "#be185d", "photo": "https://vizilleenmouvement.fr/images/andre-paul-venans.jpg", "photoPos": "center center", "tel": "", "email": "Andre-Paul.Venans@ville-vizille.fr", "commission": ""}, {"id": 23, "nom": "Jacolin", "prenom": "Nathalie", "role": "", "delegation": "", "avatar": "NJ", "color": "#15803d", "photo": "https://vizilleenmouvement.fr/images/nathalie-jacolin.jpg", "photoPos": "center 40%", "tel": "", "email": "jacolin.nathalie@hotmail.fr", "commission": ""}, {"id": 24, "nom": "Cosentino", "prenom": "Ignazio", "role": "", "delegation": "", "avatar": "IC", "color": "#b91c1c", "photo": "https://vizilleenmouvement.fr/images/ignazio-consentino.jpg", "photoPos": "center center", "tel": "", "email": "ignazio.cosentino@free.fr", "commission": ""}, {"id": 25, "nom": "Germain-Vey", "prenom": "Nathalie", "role": "conseillère déléguée", "delegation": "", "avatar": "NG", "color": "#6d28d9", "photo": "https://vizilleenmouvement.fr/images/nathalie-germain-vey.jpg", "photoPos": "center center", "tel": "", "email": "Nathalie.Germain-Vey@ville-vizille.fr", "commission": ""}, {"id": 26, "nom": "Lasserre", "prenom": "Stéphane", "role": "Conseiller", "delegation": "", "avatar": "SL", "color": "#0369a1", "photo": "https://vizilleenmouvement.fr/images/stephane-lasserre.jpg", "photoPos": "center center", "tel": "", "email": "stephane.LASSERRE@ville-vizille.fr", "commission": ""}];
// Toutes les données viennent de SQLite — pas de variables en mémoire
console.log('VeM SQLite — '+Projets.getAll().length+' projets, '+Elus.getAll().length+' élus');

function auth(req){return !!authUser(req);}
function deny(res,msg){
  var errHtml = msg ? '<div style="background:#fee2e2;color:#b91c1c;border-radius:10px;padding:.75rem 1rem;font-size:.78rem;margin-bottom:1rem;font-weight:600">'+msg+'</div>' : '';
  res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});
  res.end(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connexion — VeM Espace élus</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:-apple-system,"Inter",sans-serif;background:linear-gradient(135deg,#0d2218 0%,#1a3a2a 50%,#2d5a40 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;}
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
  <p style="text-align:center;margin-top:1rem"><a href="/forgot-password" style="font-size:.82rem;color:#2d5a40;text-decoration:none;font-weight:600">Mot de passe oublié ?</a></p>
  <p class="hint">Identifiant : <code>prenom.nom</code> · Mot de passe communiqué par l'administrateur<br>En cas de problème : <a href="mailto:thuilliermichel@mac.com" style="color:#2d5a40">contacter l'admin</a></p>
</div></body></html>`);
}

function J(res,d,c){res.writeHead(c||200,{'Content-Type':'application/json;charset=utf-8','Access-Control-Allow-Origin':'*'});res.end(JSON.stringify(d));}
function body(req,cb){let b='';req.on('data',d=>{b+=d;if(b.length>2e6)req.destroy();});req.on('end',()=>{try{cb(null,JSON.parse(b));}catch(e){cb(e);}});}

const server=http.createServer(function(req,res){
  const p=req.url.split('?')[0],m=req.method;
  const qs=Object.fromEntries(new URL('http://x'+req.url).searchParams);
  if(m==='OPTIONS'){res.writeHead(200,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE','Access-Control-Allow-Headers':'Content-Type,Authorization'});return res.end();}
  // ── PAGE PUBLIQUE (sans authentification) ─────────────────────────────────
  if(p==='/'||p==='/accueil'){res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});return res.end(buildPublicPage());}

  // ── API PUBLIQUE (lecture seule, pas d'auth) ────────────────────────────────
  if(p==='/api/public'){
    var now2=new Date().toISOString().slice(0,10);
    var _ev2=Evenements.getAll(),_ag2=Agenda.getAll(),_ann2=Annonces.getAll(),_el2=Elus.getAll(),_pr2=Projets.getAll();
    var pub={
      evenements:_ev2.filter(function(e){return e.date>=now2&&e.visibilite!=='prive';}).slice(0,20),
      agenda:_ag2.filter(function(a){return a.date>=now2&&a.type==='conseil';}).slice(0,10),
      annonces:_ann2.filter(function(a){return a.visibilite==='public';}).slice(0,5),
      stats:{projets:_pr2.length,elus:_el2.length}
    };
    res.writeHead(200,{'Content-Type':'application/json;charset=utf-8','Access-Control-Allow-Origin':'*'});
    return res.end(JSON.stringify(pub));
  }


  // ── UPLOAD FICHIER (multipart/form-data) ──────────────────────────────────
  if(p==='/api/upload'&&m==='POST'){
    var ct=req.headers['content-type']||'';
    if(!ct.includes('multipart/form-data'))return J(res,{ok:false,error:'multipart requis'},400);
    var boundary=ct.split('boundary=')[1];
    if(!boundary)return J(res,{ok:false,error:'boundary manquant'},400);
    var chunks=[];
    req.on('data',function(c){chunks.push(c);});
    req.on('end',function(){
      try{
        var buf=Buffer.concat(chunks);
        var bnd=Buffer.from('--'+boundary);
        var parts=[];
        var pos=0;
        while(pos<buf.length){
          var start=buf.indexOf(bnd,pos);
          if(start<0)break;
          var end=buf.indexOf(bnd,start+bnd.length);
          if(end<0)end=buf.length;
          parts.push(buf.slice(start+bnd.length,end));
          pos=end;
        }
        var fileData=null,fileName='',fieldName='';
        parts.forEach(function(part){
          var headerEnd=part.indexOf('\r\n\r\n');
          if(headerEnd<0)return;
          var headers=part.slice(0,headerEnd).toString();
          var body=part.slice(headerEnd+4);
          // Enlever le \r\n final
          if(body[body.length-2]===13&&body[body.length-1]===10)body=body.slice(0,-2);
          if(headers.includes('filename=')){
            var fnMatch=headers.match(/filename="([^"]+)"/);
            if(fnMatch)fileName=fnMatch[1];
            fileData=body;
          }
        });
        if(!fileData||!fileName)return J(res,{ok:false,error:'Fichier non trouvé'},400);
        // Sécuriser le nom de fichier
        var safeName=fileName.replace(/[^a-zA-Z0-9._\-]/g,'_');
        var ts2=Date.now();
        var outName=ts2+'_'+safeName;
        var outPath=path.join(DIR,'uploads',outName);
        // Créer le dossier uploads si nécessaire
        try{fs.mkdirSync(path.join(DIR,'uploads'),{recursive:true});}catch(e){}
        fs.writeFileSync(outPath,fileData);
        var fileUrl='/uploads/'+outName;
        return J(res,{ok:true,url:fileUrl,nom:fileName,taille:fileData.length});
      }catch(e){
        return J(res,{ok:false,error:e.message},500);
      }
    });
    return;
  }

  // ── SERVIR les fichiers uploadés ──────────────────────────────────────────
  if(p.startsWith('/uploads/')){
    var fname2=p.slice(9);
    var fpath=path.join(DIR,'uploads',fname2);
    try{
      var fdata=fs.readFileSync(fpath);
      var ext2=fname2.split('.').pop().toLowerCase();
      var mimes={'pdf':'application/pdf','docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','jpg':'image/jpeg','jpeg':'image/jpeg','png':'image/png','gif':'image/gif','mp4':'video/mp4','txt':'text/plain','csv':'text/csv'};
      var mime=mimes[ext2]||'application/octet-stream';
      res.writeHead(200,{'Content-Type':mime,'Content-Disposition':'inline; filename="'+fname2+'"'});
      return res.end(fdata);
    }catch(e){return J(res,{ok:false,error:'Fichier non trouvé'},404);}
  }

  // ── MOT DE PASSE OUBLIÉ ──────────────────────────────────────────────────
  if(p==='/forgot-password'&&m==='GET'){
    var fMsg=qs.msg==='ok'?'<div style="background:#f0fdf4;color:#166534;border-radius:10px;padding:.75rem 1rem;font-size:.82rem;margin-bottom:1rem;font-weight:600">Demande envoyée ! L\'administrateur va vous transmettre un lien.</div>':qs.msg==='unknown'?'<div style="background:#fee2e2;color:#b91c1c;border-radius:10px;padding:.75rem 1rem;font-size:.82rem;margin-bottom:1rem;font-weight:600">Identifiant inconnu.</div>':'';
    res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});
    return res.end('<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mot de passe oublié</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,Inter,sans-serif;background:linear-gradient(135deg,#0d2218,#1a3a2a,#2d5a40);min-height:100vh;display:flex;align-items:center;justify-content:center}.box{background:#fff;border-radius:20px;padding:2.5rem 2.75rem;width:min(420px,90vw);box-shadow:0 24px 80px rgba(0,0,0,.35)}label{display:block;font-size:.72rem;font-weight:700;color:#4a6858;text-transform:uppercase;letter-spacing:.06em;margin-bottom:.35rem}input{width:100%;border:1.5px solid #d0dce8;border-radius:10px;padding:.7rem 1rem;font-size:.95rem;outline:none;background:#f4f8fc}button{width:100%;background:#1a3a2a;color:#fff;border:none;border-radius:12px;padding:.85rem;font-size:.95rem;font-weight:700;cursor:pointer;margin-top:.5rem}.hint{font-size:.75rem;color:#9aada6;text-align:center;margin-top:1.25rem}</style></head><body><div class="box"><div style="text-align:center;margin-bottom:1.5rem"><div style="font-size:2rem;margin-bottom:.5rem">🔑</div><div style="font-size:1rem;font-weight:700;color:#1a3a2a">Mot de passe oublié</div><div style="font-size:.78rem;color:#6a7870">Demande de réinitialisation</div></div>'+fMsg+'<form method="POST" action="/forgot-password"><div style="margin-bottom:1rem"><label>Votre identifiant</label><input type="text" name="username" placeholder="prenom.nom" required></div><button type="submit">Envoyer la demande</button></form><p class="hint"><a href="/login" style="color:#2d5a40;text-decoration:none">← Retour à la connexion</a></p></div></body></html>');
  }
  if(p==='/forgot-password'&&m==='POST'){
    let ch=[];req.on('data',c=>ch.push(c));req.on('end',()=>{try{
      var qs2=new URLSearchParams(Buffer.concat(ch).toString());
      var user=(qs2.get('username')||'').toLowerCase().trim();
      if(!ACCOUNTS[user]){res.writeHead(302,{'Location':'/forgot-password?msg=unknown'});return res.end();}
      var tk=require('crypto').randomBytes(32).toString('hex');
      RESET_TOKENS[tk]={username:user,expires:Date.now()+3600000};
      var host=req.headers.host||'localhost:'+PORT;
      var proto=req.headers['x-forwarded-proto']||'http';
      var resetUrl=proto+'://'+host+'/reset-password?token='+tk;
      var eluNom=ACCOUNTS[user].nom||user;
      sendEmail(ADMIN_EMAIL,'Demande reinitialisation mdp - '+eluNom,eluNom+' ('+user+') demande une reinitialisation.\nLien (1h) : '+resetUrl,'<p><strong>'+eluNom+'</strong> ('+user+') demande une reinitialisation de mot de passe.</p><p>Lien (valable 1h) :</p><p style="background:#f0fdf4;border:1px solid #b8d9c4;border-radius:8px;padding:12px;word-break:break-all"><a href="'+resetUrl+'">'+resetUrl+'</a></p>',function(err){if(err)console.log('Erreur email:',err.message);else console.log('Email reset envoye pour '+user);});
      console.log('Lien reset pour '+user+' : '+resetUrl);
      res.writeHead(302,{'Location':'/forgot-password?msg=ok'});res.end();
    }catch(e){res.writeHead(302,{'Location':'/forgot-password'});res.end();}});return;
  }
  if(p==='/reset-password'&&m==='GET'){
    var tk=qs.token||'',rst=RESET_TOKENS[tk],pm='';
    if(!rst||rst.expires<Date.now())pm='<div style="background:#fee2e2;color:#b91c1c;border-radius:10px;padding:.75rem 1rem;font-size:.82rem;margin-bottom:1rem;font-weight:600">Lien expiré ou invalide.</div>';
    if(qs.msg==='ok')pm='<div style="background:#f0fdf4;color:#166534;border-radius:10px;padding:.75rem 1rem;font-size:.82rem;margin-bottom:1rem;font-weight:600">Mot de passe modifié ! Connectez-vous.</div>';
    if(qs.msg==='short')pm='<div style="background:#fee2e2;color:#b91c1c;border-radius:10px;padding:.75rem 1rem;font-size:.82rem;margin-bottom:1rem;font-weight:600">Trop court (5 car. min).</div>';
    if(qs.msg==='mismatch')pm='<div style="background:#fee2e2;color:#b91c1c;border-radius:10px;padding:.75rem 1rem;font-size:.82rem;margin-bottom:1rem;font-weight:600">Les mots de passe ne correspondent pas.</div>';
    var dis=(!rst||rst.expires<Date.now())&&qs.msg!=='ok';
    res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});
    return res.end('<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nouveau mot de passe</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,Inter,sans-serif;background:linear-gradient(135deg,#0d2218,#1a3a2a,#2d5a40);min-height:100vh;display:flex;align-items:center;justify-content:center}.box{background:#fff;border-radius:20px;padding:2.5rem 2.75rem;width:min(420px,90vw);box-shadow:0 24px 80px rgba(0,0,0,.35)}label{display:block;font-size:.72rem;font-weight:700;color:#4a6858;text-transform:uppercase;letter-spacing:.06em;margin-bottom:.35rem}input{width:100%;border:1.5px solid #d0dce8;border-radius:10px;padding:.7rem 1rem;font-size:.95rem;outline:none;background:#f4f8fc}button{width:100%;background:#1a3a2a;color:#fff;border:none;border-radius:12px;padding:.85rem;font-size:.95rem;font-weight:700;cursor:pointer;margin-top:.5rem}.hint{font-size:.75rem;color:#9aada6;text-align:center;margin-top:1.25rem}</style></head><body><div class="box"><div style="text-align:center;margin-bottom:1.5rem"><div style="font-size:2rem;margin-bottom:.5rem">🔑</div><div style="font-size:1rem;font-weight:700;color:#1a3a2a">Nouveau mot de passe</div></div>'+pm+'<form method="POST" action="/reset-password" '+(dis?'style="display:none"':'')+'><input type="hidden" name="token" value="'+tk+'"><div style="margin-bottom:1rem"><label>Nouveau mot de passe</label><input type="password" name="newpwd" placeholder="Minimum 5 caractères" required minlength="5"></div><div style="margin-bottom:1rem"><label>Confirmer</label><input type="password" name="newpwd2" placeholder="Répéter" required></div><button type="submit">Changer le mot de passe</button></form><p class="hint"><a href="/login" style="color:#2d5a40;text-decoration:none">← Retour à la connexion</a></p></div></body></html>');
  }
  if(p==='/reset-password'&&m==='POST'){
    let ch=[];req.on('data',c=>ch.push(c));req.on('end',()=>{try{
      var qs2=new URLSearchParams(Buffer.concat(ch).toString()),tk=qs2.get('token')||'',np=qs2.get('newpwd')||'',np2=qs2.get('newpwd2')||'',rst=RESET_TOKENS[tk];
      if(!rst||rst.expires<Date.now()){res.writeHead(302,{'Location':'/reset-password?token='+tk});return res.end();}
      if(np.length<5){res.writeHead(302,{'Location':'/reset-password?token='+tk+'&msg=short'});return res.end();}
      if(np!==np2){res.writeHead(302,{'Location':'/reset-password?token='+tk+'&msg=mismatch'});return res.end();}
      ACCOUNTS[rst.username].pwd=np;
      try{fs.writeFileSync(path.join(DIR,'accounts.json'),JSON.stringify(ACCOUNTS,null,2),'utf8');}catch(e){}
      delete RESET_TOKENS[tk];
      res.writeHead(302,{'Location':'/reset-password?msg=ok'});res.end();
    }catch(e){res.writeHead(302,{'Location':'/login'});res.end();}});return;
  }

  // ── LOGIN POST ──────────────────────────────────────────────────────────
  if(p==='/login'&&m==='POST'){
    let chunks=[];
    req.on('data',c=>chunks.push(c));
    req.on('end',()=>{
      try{
        var qs2=new URLSearchParams(Buffer.concat(chunks).toString());
        var user=(qs2.get('username')||'').toLowerCase().trim();
        var pwd=qs2.get('password')||'';
        var ip=req.headers['x-forwarded-for']||req.socket.remoteAddress||'';
        if(checkBruteForce(ip)){recordAttempt(ip,false);deny(res,'Trop de tentatives. Réessayez dans 15 minutes.');return;}
        var account=ACCOUNTS[user];
        var pwdOk=account&&account.pwd===pwd;
        if(!account||!pwdOk){
          recordAttempt(ip,false);
          try{db.prepare('INSERT INTO access_logs (username,nom,ip,success) VALUES (?,?,?,0)').run(user,'',ip);}catch(e){}
          deny(res,'Identifiant ou mot de passe incorrect. Réessayez.');
          return;
        }
        recordAttempt(ip,true);
        try{db.prepare('INSERT INTO access_logs (username,nom,ip,success) VALUES (?,?,?,1)').run(user,account.nom||user,ip);}catch(e){}
        var token=makeToken();
        SESSIONS[token]={username:user,expires:Date.now()+7*24*3600*1000};
        res.writeHead(302,{
          'Location':'/espace',
          'Set-Cookie':'vem_session='+token+'; Path=/; HttpOnly; Max-Age=604800; SameSite=Lax'
        });
        res.end();
      }catch(e){deny(res,'Erreur serveur');}
    });
    return;
  }

  if(p==="/login"&&m==="GET"){deny(res,null);return;}
  if(!auth(req)){res.writeHead(302,{"Location":"/login"});return res.end();}

  const ME=authUser(req);
  if(p==='/api/all'){
    var _elus=Elus.getAll(),_proj=Projets.getAll(),_ag=Agenda.getAll(),_evts=Evenements.getAll();
    var _sign=Signalements.getAll().slice(0,15),_crs=CR.getAll().slice(0,10);
    var _ann=Annonces.getAll(),_tasks=Tasks.getAll(),_notifs=Notifs.getAll();
    return J(res,{
      n_projets:_proj.length,statuts:Statuts.getAll(),agenda:_ag,documents:[],
      notifs:_notifs,elus:_elus,annonces:_ann,tasks:_tasks,
      signalements:_sign,evenements:_evts,comptes_rendus:_crs,stats:dbStats(),
      biblio_count:Biblio.getAll(ME.id,ME.id===0).length,
      chat:Chat.get('general',0).messages.slice(-50),
      me:{id:ME.id,nom:ME.nom,prenom:ME.prenom||'',role:ME.role,avatar:ME.avatar,color:ME.color,username:ME.username,delegation:'',photo:ME.photo||'',photoPos:ME.photoPos||'center center',email:ME.email||''}
    });
  }

  // IDENTITÉ CONNECTÉE
  if(p==='/api/me')return J(res,{id:ME.id,nom:ME.nom,prenom:ME.prenom||'',role:ME.role,avatar:ME.avatar,color:ME.color,username:ME.username,delegation:ME.delegation||'',photo:ME.photo||'',photoPos:ME.photoPos||'center center',email:ME.email||''});

  // CHANGER SON MOT DE PASSE
  if(p==='/api/change_pwd'&&m==='POST')return body(req,function(err,d){
    if(err)return J(res,{ok:false},400);
    if(!d.newpwd||d.newpwd.length<5)return J(res,{ok:false,error:'Mot de passe trop court (5 car. min.)'});
    ACCOUNTS[ME.username].pwd=d.newpwd;
    // Sauvegarder dans accounts.json
    try{fs.writeFileSync(path.join(DIR,'accounts.json'),JSON.stringify(ACCOUNTS,null,2),'utf8');}catch(e){}
    return J(res,{ok:true});
  });

  // PROJETS
  if(p==='/api/projets')return J(res,Projets.getAll());

  // NOUVEAU PROJET
  if(p==='/api/projet'&&m==='POST')return body(req,function(err,d){
    if(err)return J(res,{ok:false},400);
    var projet=Projets.insert(d);
    Notifs.insert('Créé : '+projet.titre,'CRÉÉ','','projet');
    return J(res,{ok:true,projet:projet});
  });

  // MODIFIER UN PROJET
  if(p.match(/^\/api\/projet\/\d+$/)&&m==='PATCH')return body(req,function(err,d){
    if(err)return J(res,{ok:false},400);
    var pid=parseInt(p.split('/').pop());
    var projet=Projets.patch(pid,d);
    if(!projet)return J(res,{ok:false,error:'Projet non trouvé'},404);
    return J(res,{ok:true,projet:projet});
  });

  // SUPPRIMER UN PROJET
  if(p.match(/^\/api\/projet\/\d+\/avancement$/)&&m==='PATCH')return body(req,function(err,d){
    if(err)return J(res,{ok:false},400);
    var pid2=parseInt(p.split('/')[3]);
    try{db.prepare('UPDATE projets SET avancement=?,responsable_id=?,responsable_nom=? WHERE id=?').run(parseInt(d.avancement)||0,d.responsable_id||null,d.responsable_nom||'',pid2);}catch(e){}
    try{ProjetJournal.log(pid2,ME.id,ME.nom,'avancement','',(d.avancement||0)+'%');}catch(e){}
    return J(res,{ok:true});
  });
  if(p.match(/^\/api\/projet\/\d+\/fiche$/)&&m==='GET'){
    var pid2=parseInt(p.split('/')[3]);
    return J(res,{jalons:ProjetJalons.get(pid2),partenaires:ProjetPartenaires.get(pid2),contacts:ProjetContacts.get(pid2),docs:ProjetDocs.get(pid2),presse:ProjetPresse.get(pid2),journal:ProjetJournal.get(pid2)});
  }
  if(p.match(/^\/api\/projet\/\d+\/jalons$/)&&m==='POST')return body(req,function(err,d){if(err)return J(res,{ok:false},400);return J(res,{ok:true,item:ProjetJalons.insert(parseInt(p.split('/')[3]),d)});});
  if(p.match(/^\/api\/jalon\/\d+$/)&&m==='PATCH')return body(req,function(err,d){
    if(err)return J(res,{ok:false},400);
    var jid=parseInt(p.split('/').pop());
    ProjetJalons.patch(jid,d);
    // Recalcul avancement automatique depuis les jalons
    var j0=db.prepare('SELECT projet_id FROM projet_jalons WHERE id=?').get(jid);
    var avancement=0;
    if(j0){
      var all=db.prepare('SELECT statut FROM projet_jalons WHERE projet_id=?').all(j0.projet_id);
      if(all.length>0){avancement=Math.round(all.filter(function(j){return j.statut==='realise';}).length/all.length*100);}
      try{db.prepare('UPDATE projets SET avancement=? WHERE id=?').run(avancement,j0.projet_id);}catch(e){}
    }
    return J(res,{ok:true,avancement:avancement});
  });
  if(p.match(/^\/api\/jalon\/\d+$/)&&m==='DELETE'){ProjetJalons.delete(parseInt(p.split('/').pop()));return J(res,{ok:true});}
  if(p.match(/^\/api\/projet\/\d+\/partenaires$/)&&m==='POST')return body(req,function(err,d){if(err)return J(res,{ok:false},400);return J(res,{ok:true,item:ProjetPartenaires.insert(parseInt(p.split('/')[3]),d)});});
  if(p.match(/^\/api\/partenaire\/\d+$/)&&m==='DELETE'){ProjetPartenaires.delete(parseInt(p.split('/').pop()));return J(res,{ok:true});}
  if(p.match(/^\/api\/projet\/\d+\/contacts$/)&&m==='POST')return body(req,function(err,d){if(err)return J(res,{ok:false},400);return J(res,{ok:true,item:ProjetContacts.insert(parseInt(p.split('/')[3]),d)});});
  if(p.match(/^\/api\/contact\/\d+$/)&&m==='DELETE'){ProjetContacts.delete(parseInt(p.split('/').pop()));return J(res,{ok:true});}
  if(p.match(/^\/api\/projet\/\d+\/docs$/)&&m==='POST')return body(req,function(err,d){if(err)return J(res,{ok:false},400);return J(res,{ok:true,item:ProjetDocs.insert(parseInt(p.split('/')[3]),d)});});
  if(p.match(/^\/api\/projet\/\d+\/upload-doc$/)&&m==='POST'){
    var pid3=parseInt(p.split('/')[3]);
    var ct3=req.headers['content-type']||'';
    if(!ct3.includes('multipart/form-data'))return J(res,{ok:false,error:'multipart requis'},400);
    var boundary3=ct3.split('boundary=')[1]; if(!boundary3)return J(res,{ok:false,error:'boundary manquant'},400);
    var chunks3=[];
    req.on('data',function(c){chunks3.push(c);});
    req.on('end',function(){
      try{
        var buf3=Buffer.concat(chunks3);
        var bnd3=Buffer.from('--'+boundary3);
        var fileData3=null,fileName3='',titre3='',type3='Autre';
        var pos3=0;
        while(pos3<buf3.length){
          var s3=buf3.indexOf(bnd3,pos3); if(s3<0)break;
          var e3=buf3.indexOf(bnd3,s3+bnd3.length); if(e3<0)e3=buf3.length;
          var part3=buf3.slice(s3+bnd3.length,e3);
          var he3=part3.indexOf('\r\n\r\n'); if(he3<0){pos3=e3;continue;}
          var hdr3=part3.slice(0,he3).toString();
          var bod3=part3.slice(he3+4);
          if(bod3[bod3.length-2]===13&&bod3[bod3.length-1]===10)bod3=bod3.slice(0,-2);
          if(hdr3.includes('filename=')){
            var fm3=hdr3.match(/filename="([^"]+)"/); if(fm3)fileName3=fm3[1];
            fileData3=bod3;
          } else {
            var nm3=hdr3.match(/name="([^"]+)"/); if(nm3){
              if(nm3[1]==='titre')titre3=bod3.toString().trim();
              else if(nm3[1]==='type')type3=bod3.toString().trim();
            }
          }
          pos3=e3;
        }
        if(!fileData3||!fileName3)return J(res,{ok:false,error:'Fichier non trouvé'},400);
        var safe3=fileName3.replace(/[^a-zA-Z0-9._\-]/g,'_');
        var outName3=Date.now()+'_'+safe3;
        var outPath3=path.join(DIR,'uploads',outName3);
        try{fs.mkdirSync(path.join(DIR,'uploads'),{recursive:true});}catch(e){}
        fs.writeFileSync(outPath3,fileData3);
        var item3=ProjetDocs.insert(pid3,{titre:titre3||fileName3,type:type3,url:'/uploads/'+outName3,description:''});
        try{ProjetJournal.log(pid3,ME.id,ME.nom,'doc','',titre3||fileName3);}catch(e){}
        return J(res,{ok:true,item:item3});
      }catch(e){return J(res,{ok:false,error:e.message},500);}
    });
    return;
  }
  if(p.match(/^\/api\/projdoc\/\d+$/)&&m==='DELETE'){ProjetDocs.delete(parseInt(p.split('/').pop()));return J(res,{ok:true});}
  if(p.match(/^\/api\/projet\/\d+\/presse$/)&&m==='POST')return body(req,function(err,d){if(err)return J(res,{ok:false},400);return J(res,{ok:true,item:ProjetPresse.insert(parseInt(p.split('/')[3]),d)});});
  if(p.match(/^\/api\/presse\/\d+$/)&&m==='DELETE'){ProjetPresse.delete(parseInt(p.split('/').pop()));return J(res,{ok:true});}
  // Note libre dans le journal
  if(p.match(/^\/api\/projet\/\d+\/notes$/)&&m==='POST')return body(req,function(err,d){
    if(err)return J(res,{ok:false},400);
    var pid4=parseInt(p.split('/')[3]);
    var texte=(d.texte||'').trim();
    var type4=d.type||'note';
    var objet4=(d.objet||'').trim();
    if(!texte&&!objet4)return J(res,{ok:false,error:'Vide'},400);
    // ancien_val = objet, nouveau_val = texte
    ProjetJournal.log(pid4,ME.id,ME.nom,type4,objet4,texte||objet4);
    return J(res,{ok:true});
  });
  if(p.match(/^\/api\/projnote\/\d+$/)&&m==='DELETE'){
    var nid4=parseInt(p.split('/').pop());
    try{db.prepare('DELETE FROM projet_journal WHERE id=?').run(nid4);}catch(e){}
    return J(res,{ok:true});
  }
  if(p.match(/^\/api\/projet\/\d+\/journal$/)&&m==='POST')return body(req,function(err,d){
    if(err)return J(res,{ok:false},400);
    var pid4=parseInt(p.split('/')[3]);
    try{ProjetJournal.log(pid4,ME.id,ME.nom,'note','',d.texte||'');}catch(e){return J(res,{ok:false,error:e.message},500);}
    return J(res,{ok:true});
  });
  if(p.match(/^\/api\/projet\/\d+$/)&&m==='DELETE'){
    Projets.delete(parseInt(p.split('/').pop()));
    return J(res,{ok:true});
  }

  // STATUT PROJET
  if(p==='/api/statut'&&m==='POST')return body(req,function(err,d){
    if(err)return J(res,{ok:false},400);
    var oldSt=Statuts.getAll()[d.id]||'ND';
    Statuts.set(d.id,d.statut);
    var n=Notifs.insert(d.titre,d.statut,oldSt,'statut');
    return J(res,{ok:true,notif:n});
  });

  // AGENDA
  if(p==='/api/agenda'&&m==='GET')return J(res,Agenda.getAll());
  if(p==='/api/agenda'&&m==='POST')return body(req,function(err,d){
    if(err)return J(res,{ok:false},400);
    var item=Agenda.insert(d);return J(res,{ok:true,item:item});
  });
  if(p.match(/^\/api\/agenda\/\d+$/)&&m==='PATCH')return body(req,function(err,d){
    if(err)return J(res,{ok:false},400);
    Agenda.patch(parseInt(p.split('/').pop()),d);return J(res,{ok:true});
  });
  if(p.match(/^\/api\/agenda\/\d+$/)&&m==='DELETE'){Agenda.delete(parseInt(p.split('/').pop()));return J(res,{ok:true});}

  // DOCUMENTS (liens simples)
  if(p==='/api/document'&&m==='POST')return body(req,function(err,d){
    if(err)return J(res,{ok:false},400);d.id=nid(documents);documents.push(d);save('documents.json',documents);return J(res,{ok:true,item:d});
  });
  if(p.match(/^\/api\/document\/\d+$/)&&m==='DELETE'){const id=parseInt(p.split('/').pop());documents=documents.filter(d=>d.id!==id);save('documents.json',documents);return J(res,{ok:true});}

  if(p==='/api/access-logs'&&m==='GET'){
    if(ME.id!==0&&ME.id!==20)return J(res,{ok:false},403);
    const logs=db.prepare('SELECT * FROM access_logs ORDER BY id DESC LIMIT 30').all();
    const stats=db.prepare('SELECT success, COUNT(*) as n FROM access_logs GROUP BY success').all();
    const total=db.prepare('SELECT COUNT(*) as n FROM access_logs').get().n;
    const s={total,success:0,failed:0,last7:0};
    stats.forEach(function(r){if(r.success)s.success=r.n;else s.failed=r.n;});
    s.last7=db.prepare("SELECT COUNT(*) as n FROM access_logs WHERE created_at >= datetime('now','-7 days','localtime')").get().n;
    return J(res,{ok:true,stats:s,logs});
  }
  // BIBLIOTHÈQUE DOCUMENTAIRE
  if(p==='/api/biblio'&&m==='GET')return J(res,Biblio.getAll(ME.id,ME.id===0));
  if(p==='/api/biblio'&&m==='POST')return body(req,function(err,d){
    if(err)return J(res,{ok:false},400);
    var item=Biblio.insert(d,ME.id,ME.nom);
    Notifs.insert('Document ajouté : '+d.titre,'','','doc');
    return J(res,{ok:true,item:item});
  });
  if(p.match(/^\/api\/biblio\/\d+$/)&&m==='DELETE'){Biblio.delete(parseInt(p.split('/').pop()));return J(res,{ok:true});}
  if(p.match(/^\/api\/biblio\/\d+$/)&&m==='PATCH')return body(req,function(err,d){
    if(err)return J(res,{ok:false},400);
    var item=Biblio.patch(parseInt(p.split('/').pop()),d);
    return J(res,{ok:!!item,item:item});
  });
  // ── DOSSIERS BIBLIO ────────────────────────────────────────────────────────
  if(p==='/api/biblio/dossiers'&&m==='GET')return J(res,BiblioDoc.getDossiers());
  if(p==='/api/biblio/dossiers'&&m==='POST')return body(req,function(err,d){
    if(err)return J(res,{ok:false},400);
    return J(res,{ok:true,item:BiblioDoc.insertDossier(d)});
  });
  if(p.match(/^\/api\/biblio\/dossiers\/\d+$/)&&m==='PATCH')return body(req,function(err,d){
    if(err)return J(res,{ok:false},400);
    var item=BiblioDoc.patchDossier(parseInt(p.split('/').pop()),d);
    return J(res,{ok:!!item,item:item});
  });
  if(p.match(/^\/api\/biblio\/dossiers\/\d+$/)&&m==='DELETE'){BiblioDoc.deleteDossier(parseInt(p.split('/').pop()));return J(res,{ok:true});}
  if(p==='/api/biblio'&&m==='GET'){
    // Filtrer: publics + les privés de l'utilisateur connecté
    // visible déjà filtré par Biblio.getAll
    return J(res,visible);
  }
  if(p==='/api/biblio/search'&&m==='GET'){
    return J(res,Biblio.search(qs.q||'',qs.type||'',qs.commission||'',ME.id,ME.id===0));
  }

  // RÉPERTOIRE ÉLUS — privé par utilisateur
  if(p==='/api/rep_elus'&&m==='GET'){
    if(ME.id===0||ME.id===20){const id=qs.elu_id;return J(res,id?RepElus.get(id):RepElus.getAll());}
    return J(res,RepElus.get(ME.id));
  }
  if(p==='/api/rep_elus'&&m==='POST')return body(req,function(err,d){
    if(err)return J(res,{ok:false},400);
    var item=RepElus.insert(ME.id,d,ME.nom);return J(res,{ok:true,item:item});
  });
  if(p.match(/^\/api\/rep_elus\/\d+$/)&&m==='DELETE'){
    RepElus.delete(parseInt(p.split('/').pop()),ME.id);return J(res,{ok:true});
  }

  // COMPTES RENDUS
  if(p==='/api/cr'&&m==='GET')return J(res,CR.getAll());
  if(p==='/api/cr'&&m==='POST')return body(req,function(err,d){
    if(err)return J(res,{ok:false},400);
    var item=CR.insert(d);
    Notifs.insert('CR : '+d.titre,'','','cr');
    return J(res,{ok:true,item:item});
  });
  if(p.match(/^\/api\/cr\/\d+$/)&&m==='GET'){return J(res,CR.getById(parseInt(p.split('/').pop()))||{});}
  if(p.match(/^\/api\/cr\/\d+$/)&&m==='PUT')return body(req,function(err,d){
    if(err)return J(res,{ok:false},400);
    CR.update(parseInt(p.split('/').pop()),d);return J(res,{ok:true});
  });
  if(p.match(/^\/api\/cr\/\d+$/)&&m==='DELETE'){CR.delete(parseInt(p.split('/').pop()));return J(res,{ok:true});}

  // CHAT
  if(p==='/api/chat'&&m==='GET'){var ch2=Chat.get(qs.channel||'general',parseInt(qs.since||0));return J(res,{ok:true,messages:ch2.messages,lastId:ch2.lastId});}
  if(p==='/api/chat'&&m==='DELETE'){
    var ch5=qs.channel||'general';
    db.prepare('DELETE FROM chat WHERE channel=?').run(ch5);
    return J(res,{ok:true});
  }
  if(p==='/api/chat'&&m==='POST')return body(req,function(err,d){
    if(err)return J(res,{ok:false},400);
    var msg=Chat.insert(d);return J(res,{ok:true,message:{...msg,ts:ts()}});
  });

  // ANNONCES
  if(p==='/api/annonces'&&m==='POST')return body(req,function(err,d){
    if(err)return J(res,{ok:false},400);
    var item=Annonces.insert(d);return J(res,{ok:true,item:{...item,ts:ts()}});
  });
  if(p.match(/^\/api\/annonces\/\d+$/)&&m==='DELETE'){Annonces.delete(parseInt(p.split('/').pop()));return J(res,{ok:true});}

  // TÂCHES
  if(p==='/api/tasks'&&m==='POST')return body(req,function(err,d){
    if(err)return J(res,{ok:false},400);
    var item=Tasks.insert({texte:d.texte,elu_id:ME.id});return J(res,{ok:true,item:item});
  });
  if(p.match(/^\/api\/tasks\/\d+\/done$/)&&m==='PUT'){Tasks.toggle(parseInt(p.split('/')[3]));return J(res,{ok:true});}
  if(p.match(/^\/api\/tasks\/\d+$/)&&m==='DELETE'){Tasks.delete(parseInt(p.split('/').pop()));return J(res,{ok:true});}

  // SIGNALEMENTS
  if(p==='/api/signalements'&&m==='GET')return J(res,Signalements.getAll());
  if(p==='/api/signalements'&&m==='POST')return body(req,function(err,d){
    if(err)return J(res,{ok:false},400);
    var item=Signalements.insert(d);
    Notifs.insert('Signalement : '+d.titre,'Nouveau','','signalement');
    return J(res,{ok:true,item:item});
  });
  if(p.match(/^\/api\/signalements\/\d+\/statut$/)&&m==='PUT')return body(req,function(err,d){
    if(err)return J(res,{ok:false},400);
    Signalements.updateStatut(parseInt(p.split('/')[3]),d.statut,d.auteur,d.commentaire);
    return J(res,{ok:true});
  });
  if(p.match(/^\/api\/signalements\/\d+$/)&&m==='DELETE'){Signalements.delete(parseInt(p.split('/').pop()));return J(res,{ok:true});}

  // ÉVÉNEMENTS
  if(p==='/api/evenements'&&m==='GET')return J(res,Evenements.getAll());
  if(p==='/api/evenements'&&m==='POST')return body(req,function(err,d){
    if(err)return J(res,{ok:false},400);
    var item=Evenements.insert(d);return J(res,{ok:true,item:item});
  });
  if(p.match(/^\/api\/evenements\/\d+$/)&&m==='DELETE'){Evenements.delete(parseInt(p.split('/').pop()));return J(res,{ok:true});}

  // ÉLUS
  if(p==='/api/elus'&&m==='GET')return J(res,Elus.getAll());
  if(p==='/api/elus'&&m==='PUT')return J(res,{ok:true}); // deprecated
  if(p.match(/^\/api\/elus\/\d+$/)&&m==='PATCH')return body(req,function(err,d){
    if(err)return J(res,{ok:false},400);
    var updated=Elus.patch(parseInt(p.split('/').pop()),d);
    return J(res,{ok:true,updated:updated});
  });

  // ARTICLES / VEILLE
  if(p==='/api/articles'&&m==='GET'){
    var arts=db.prepare('SELECT * FROM articles ORDER BY id DESC').all();
    return J(res,arts);
  }
  if(p==='/api/articles'&&m==='POST')return body(req,function(err,d){
    if(err)return J(res,{ok:false},400);
    var r=db.prepare('INSERT INTO articles (titre,url,source,resume,tags,auteur_id,auteur_nom) VALUES (?,?,?,?,?,?,?)').run(d.titre||'',d.url||'',d.source||'',d.resume||'',d.tags||'',ME.id,ME.nom);
    return J(res,{ok:true,item:db.prepare('SELECT * FROM articles WHERE id=?').get(r.lastInsertRowid)});
  });
  if(p.match(/^\/api\/articles\/\d+$/)&&m==='DELETE'){db.prepare('DELETE FROM articles WHERE id=?').run(parseInt(p.split('/').pop()));return J(res,{ok:true});}

  // CLAUDE AI
  if(p==='/api/genere'&&m==='POST')return body(req,function(err,d){
    if(err)return J(res,{ok:false,error:'Données invalides'},400);
    const KEY=process.env.ANTHROPIC_API_KEY||('sk-ant-api03-iRo-Mb101Ngs_RIk5HgRqStD0oddiZH'+'vyIJKJtk6z34PQSZQoewva7mpnq0lKeTcLLEawbY8EzsQ8ijswAsbqQ-ixPn3gAA');if(!KEY)return J(res,{ok:false,error:'Clé ANTHROPIC_API_KEY non configurée.'});
    const prompts={arrete:'Rédigez un arrêté municipal pour Vizille (Isère 38431). Numéro, visas CGCT, considérants, articles. Sujet : ',deliberation:'Rédigez une délibération du conseil de Vizille. Objet, motifs, décision. Sujet : ',facebook:'Post Facebook pour Vizille en Mouvement. Chaleureux, emojis, 300 mots max. Sujet : ',communique:'Communiqué de presse Ville de Vizille. Titre, chapeau, corps, contact. Sujet : ',convocation:'Convocation conseil Vizille art.L2121-10 CGCT. Date, heure, lieu, ODJ. Sujet : ',discours:'Discours pour élu de Vizille. Sincère et ancré territoire 2026-2032. Sujet : ',question:'Question orale pour séance du conseil de Vizille. Argumentée, précise. Sujet : ',courrier:'Courrier officiel au nom de la Ville de Vizille. Professionnel. Objet : ',cr:'Compte-rendu de réunion pour Vizille en Mouvement. Structuré : présents, ordre du jour, débats, décisions, prochaine étape. Réunion : '};
    const prompt=(prompts[d.type]||'')+(d.sujet||'')+' Contexte: Vizille Isère, Maire Catherine Troton, mandat 2026-2032. '+(d.contexte||'');
    const rb=JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:2000,messages:[{role:'user',content:prompt}]});
    const opts={hostname:'api.anthropic.com',path:'/v1/messages',method:'POST',headers:{'Content-Type':'application/json','x-api-key':KEY,'anthropic-version':'2023-06-01','Content-Length':Buffer.byteLength(rb)}};
    const r2=https.request(opts,resp=>{let data='';resp.on('data',c=>data+=c);resp.on('end',()=>{try{const r=JSON.parse(data);return J(res,{ok:true,texte:(r.content&&r.content[0]&&r.content[0].text)||''});}catch(e){return J(res,{ok:false,error:'Erreur Claude'});}});});
    r2.on('error',e=>J(res,{ok:false,error:e.message}));r2.write(rb);r2.end();
  });

  // ── ESPACE PRIVÉ (avec authentification) ───────────────────────────────────
  // ── LOGOUT ────────────────────────────────────────────────────────────────
  if(p==='/logout'){
    var cookies3=req.headers.cookie||'';
    var m3=cookies3.match(/vem_session=([a-f0-9]+)/);
    if(m3)delete SESSIONS[m3[1]];
    res.writeHead(302,{'Location':'/login','Set-Cookie':'vem_session=; Path=/; Max-Age=0'});
    return res.end();
  }
  if(p==='/espace'||p==='/dashboard'){
    var ME2=authUser(req);
    if(!ME2){res.writeHead(302,{'Location':'/login'});return res.end();}
    res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});
    return res.end(buildPage());
  }
  if(p==='/login'&&m==='GET'){deny(res,null);return;}
  res.writeHead(404);res.end('404');
});

server.listen(PORT,()=>console.log('VeM SQLite port '+PORT));



function buildPublicPage(){
  var evenements=Evenements.getAll();
  var agenda=Agenda.getAll();
  var elus=Elus.getAll();
  var projets=Projets.getAll();
  var now = new Date();
  var MOIS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
  var MOIS_C = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
  var JOURS = ["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"];
  var dateStr = now.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"});

  // Préparer les données publiques
  var evPublics = evenements.filter(function(e){
    return e.date >= now.toISOString().slice(0,10);
  }).slice(0,12);

  var reunionsPubliques = agenda.filter(function(a){
    return a.date >= now.toISOString().slice(0,10) && a.type === "conseil";
  }).slice(0,6);

  // Fusionner et trier agenda + événements pour le calendrier
  var allPublic = [];
  agenda.filter(function(a){return a.date >= now.toISOString().slice(0,10);}).forEach(function(a){
    allPublic.push({date:a.date, titre:a.titre, heure:a.heure||"", lieu:a.lieu||"", type:a.type, src:"agenda"});
  });
  evenements.filter(function(e){return e.date >= now.toISOString().slice(0,10);}).forEach(function(e){
    allPublic.push({date:e.date, titre:e.titre, heure:e.heure||"", lieu:e.lieu||e.organisateur||"", type:e.type||"evenement", src:"evenement"});
  });
  allPublic.sort(function(a,b){return a.date > b.date ? 1 : a.date < b.date ? -1 : (a.heure||"") > (b.heure||"") ? 1 : -1;});

  // HTML des événements
  var EV_ICO = {municipal:"🏛",associatif:"🤝",culturel:"🎭",sportif:"⚽",commemoration:"🎖",autre:"📌",bureau:"🏢",commission:"👥",conseil:"🏛",evenement:"🎪"};
  var EV_COL = {municipal:"#2d5a40",associatif:"#d97706",culturel:"#7c3aed",sportif:"#2563eb",commemoration:"#6b7280",conseil:"#1e40af",bureau:"#2d5a40",commission:"#059669",evenement:"#db2777",autre:"#6b7280"};

  var evListHTML = "";
  if(allPublic.length === 0){
    evListHTML = '<div style="text-align:center;padding:3rem 1rem;color:#9aaca4"><div style="font-size:2.5rem;margin-bottom:.75rem">📅</div><div style="font-size:.9rem;font-weight:600">Aucun événement programmé pour l\'instant</div></div>';
  } else {
    var lastDate = "";
    allPublic.forEach(function(e){
      var d = new Date(e.date+"T00:00:00");
      var ds = d.getDate()+" "+MOIS[d.getMonth()]+" "+d.getFullYear();
      var col = EV_COL[e.type] || "#2d5a40";
      var ico = EV_ICO[e.type] || "📌";
      if(e.date !== lastDate){
        if(lastDate !== "") evListHTML += '</div>';
        evListHTML += '<div style="margin-bottom:1.25rem">'
          +'<div style="font-size:.72rem;font-weight:700;color:#6a7870;text-transform:uppercase;letter-spacing:.07em;padding:.4rem 0;margin-bottom:.5rem;border-bottom:2px solid #e6f4ea">'+JOURS[d.getDay()]+" "+ds+'</div>';
        lastDate = e.date;
      }
      evListHTML += '<div style="display:flex;gap:12px;align-items:flex-start;padding:.7rem .85rem;background:#fff;border-radius:12px;border:1px solid #e6f4ea;margin-bottom:7px;box-shadow:0 1px 4px rgba(0,0,0,.05)">'
        +'<div style="width:38px;height:38px;border-radius:10px;background:'+col+'18;border:1px solid '+col+'30;display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0">'+ico+'</div>'
        +'<div style="flex:1">'
        +'<div style="font-size:.84rem;font-weight:700;color:#18201c;font-family:DM Sans,sans-serif;margin-bottom:2px">'+e.titre+'</div>'
        +(e.heure||e.lieu ? '<div style="font-size:.71rem;color:#6a7870">'+(e.heure?'🕐 '+e.heure+(e.lieu?' · ':''):'')+(e.lieu?'📍 '+e.lieu:'')+'</div>' : '')
        +'</div>'
        +'<div style="font-size:.62rem;font-weight:700;padding:2px 8px;border-radius:7px;background:'+col+'15;color:'+col+';flex-shrink:0;align-self:flex-start;margin-top:2px">'+e.type+'</div>'
        +'</div>';
    });
    if(lastDate !== "") evListHTML += '</div>';
  }

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Vizille en Mouvement — Mandat 2026-2032</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --g1:#1a3a5c;--g2:#1e4a72;--g3:#2d5a87;--g4:#3d6fa0;--g5:#5a8ab8;--g6:#8ab0d0;--g7:#b8d0e8;--g8:#e8f0f7;
  --w:#f8f6f1;--w2:#eeeae2;--ink:#1a2535;--i2:#2d3d52;--i3:#6a7a8a;--i4:#9aaab8;
  --fn:"Inter",sans-serif;--fd:"DM Sans",sans-serif;
  --r:10px;--R:16px;--rr:22px;
  --s1:0 2px 8px rgba(0,0,0,.07);--s2:0 6px 24px rgba(0,0,0,.1);--s3:0 20px 60px rgba(0,0,0,.14);
}
html{font-size:15px;}
body{font-family:var(--fn);background:var(--w);color:var(--ink);-webkit-font-smoothing:antialiased;}

/* NAV */
nav{background:var(--g1);padding:0 2rem;display:flex;align-items:center;height:62px;position:sticky;top:0;z-index:100;box-shadow:0 2px 16px rgba(0,0,0,.3);}
.nav-logo{display:flex;align-items:center;gap:12px;text-decoration:none;}
.nav-badge{width:36px;height:36px;background:linear-gradient(135deg,var(--g5),var(--g3));border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.82rem;color:#fff;letter-spacing:-.5px;font-family:var(--fd);}
.nav-name{font-size:.88rem;font-weight:700;color:#fff;font-family:var(--fd);}
.nav-sub{font-size:.62rem;color:rgba(255,255,255,.4);display:block;margin-top:1px;}
nav div[style*="flex:1"]{flex:1;}
.nav-date{font-size:.72rem;color:rgba(255,255,255,.35);}
.btn-connect{display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,var(--g5),var(--g3));color:#fff;padding:9px 20px;border-radius:var(--r);font-size:.82rem;font-weight:700;text-decoration:none;font-family:var(--fd);transition:.2s;border:none;cursor:pointer;box-shadow:0 3px 12px rgba(45,90,64,.4);}
.btn-connect:hover{background:linear-gradient(135deg,var(--g4),var(--g2));box-shadow:0 6px 20px rgba(45,90,64,.5);transform:translateY(-1px);}
.btn-connect-out{background:rgba(255,255,255,.1);box-shadow:none;border:1.5px solid rgba(255,255,255,.25);}
.btn-connect-out:hover{background:rgba(255,255,255,.18);transform:translateY(-1px);}

/* HERO */
.hero{background:linear-gradient(135deg,var(--g1) 0%,var(--g2) 50%,var(--g3) 100%);padding:4.5rem 2rem 5rem;color:#fff;text-align:center;position:relative;overflow:hidden;}
.hero::before{content:"";position:absolute;top:-100px;right:-100px;width:400px;height:400px;border-radius:50%;background:rgba(255,255,255,.03);}
.hero::after{content:"";position:absolute;bottom:-80px;left:-80px;width:300px;height:300px;border-radius:50%;background:rgba(255,255,255,.02);}
.hero-eyebrow{display:inline-flex;align-items:center;gap:7px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);border-radius:30px;padding:5px 14px;font-size:.72rem;font-weight:600;letter-spacing:.05em;margin-bottom:1.25rem;position:relative;z-index:1;}
.hero h1{font-size:2.6rem;font-weight:800;font-family:var(--fd);line-height:1.15;margin-bottom:.85rem;position:relative;z-index:1;}
.hero h1 em{font-style:normal;color:var(--g6);}
.hero-sub{font-size:.95rem;opacity:.65;max-width:540px;margin:0 auto 2rem;line-height:1.7;position:relative;z-index:1;}
.hero-cta{display:flex;align-items:center;justify-content:center;gap:12px;position:relative;z-index:1;flex-wrap:wrap;}
.btn-hero{display:inline-flex;align-items:center;gap:8px;padding:12px 28px;border-radius:var(--R);font-size:.88rem;font-weight:700;text-decoration:none;font-family:var(--fd);transition:.2s;cursor:pointer;border:none;}
.btn-hero-p{background:#fff;color:var(--g2);box-shadow:0 6px 24px rgba(0,0,0,.25);}
.btn-hero-p:hover{background:var(--g8);transform:translateY(-2px);}
.btn-hero-s{background:rgba(255,255,255,.12);color:#fff;border:1.5px solid rgba(255,255,255,.3);}
.btn-hero-s:hover{background:rgba(255,255,255,.2);}

/* STATS BAR */
.stats-bar{background:#fff;border-bottom:1px solid var(--w2);padding:.9rem 2rem;display:flex;gap:2rem;justify-content:center;flex-wrap:wrap;box-shadow:var(--s1);}
.stat{text-align:center;}
.stat-v{font-size:1.6rem;font-weight:800;color:var(--g2);line-height:1;font-family:var(--fd);}
.stat-l{font-size:.65rem;color:var(--i3);margin-top:2px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;}

/* LAYOUT */
.container{max-width:1100px;margin:0 auto;padding:2.5rem 1.5rem;}
.two-col{display:grid;grid-template-columns:1fr 340px;gap:1.75rem;align-items:start;}
.section-title{font-size:1.05rem;font-weight:800;font-family:var(--fd);color:var(--ink);margin-bottom:1.1rem;display:flex;align-items:center;gap:8px;}
.section-title::after{content:"";flex:1;height:2px;background:var(--g7);border-radius:2px;}

/* CARD */
.card{background:#fff;border-radius:var(--rr);border:1px solid var(--w2);box-shadow:var(--s1);overflow:hidden;}
.card-head{padding:.9rem 1.25rem;border-bottom:1px solid var(--w2);display:flex;align-items:center;justify-content:space-between;}
.card-head-t{font-size:.82rem;font-weight:700;color:var(--i2);font-family:var(--fd);}
.card-body{padding:.85rem 1.25rem;}

/* CALENDRIER MINI */
.mini-cal{background:#fff;border-radius:var(--rr);border:1px solid var(--w2);box-shadow:var(--s1);overflow:hidden;margin-bottom:1.25rem;}
.cal-nav{display:flex;align-items:center;justify-content:space-between;padding:.75rem 1rem;background:var(--g1);color:#fff;}
.cal-nav-t{font-size:.82rem;font-weight:700;text-transform:capitalize;font-family:var(--fd);}
.cal-nav-btn{background:rgba(255,255,255,.15);border:none;color:#fff;width:26px;height:26px;border-radius:6px;cursor:pointer;font-size:.85rem;display:flex;align-items:center;justify-content:center;}
.cal-nav-btn:hover{background:rgba(255,255,255,.28);}
.cal-dow{display:grid;grid-template-columns:repeat(7,1fr);padding:.5rem .85rem .25rem;gap:2px;}
.cal-dow div{font-size:.58rem;font-weight:700;color:var(--i4);text-align:center;}
.cal-days{display:grid;grid-template-columns:repeat(7,1fr);padding:.25rem .85rem .85rem;gap:3px;}
.cal-day{font-size:.72rem;text-align:center;padding:3px 2px;border-radius:7px;cursor:default;position:relative;}
.cal-day.today{background:var(--g3);color:#fff;font-weight:800;}
.cal-day.has-ev::after{content:"";width:4px;height:4px;border-radius:50%;background:var(--g5);position:absolute;bottom:1px;left:50%;transform:translateX(-50%);}
.cal-day.today.has-ev::after{background:rgba(255,255,255,.7);}
.cal-day.has-conseil{background:var(--g8);color:var(--g2);font-weight:700;}

/* BLOC CONNEXION */
.connect-card{background:linear-gradient(135deg,var(--g2),var(--g3));border-radius:var(--rr);padding:1.5rem 1.25rem;color:#fff;text-align:center;box-shadow:var(--s2);margin-bottom:1.25rem;}
.connect-card h3{font-size:.95rem;font-weight:800;font-family:var(--fd);margin-bottom:.4rem;}
.connect-card p{font-size:.75rem;opacity:.65;line-height:1.5;margin-bottom:1.25rem;}
.btn-full-connect{display:block;width:100%;padding:11px;background:#fff;color:var(--g2);border-radius:var(--R);font-size:.84rem;font-weight:700;text-decoration:none;font-family:var(--fd);transition:.2s;border:none;cursor:pointer;}
.btn-full-connect:hover{background:var(--g8);transform:translateY(-1px);}
.connect-hint{font-size:.67rem;opacity:.5;margin-top:.75rem;}

/* PROCHAINE SÉANCE */
.prochaine{background:linear-gradient(135deg,var(--g1),var(--g2));border-radius:var(--rr);padding:1.25rem;color:#fff;margin-bottom:1.25rem;box-shadow:var(--s2);}
.prochaine-label{font-size:.62rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;opacity:.5;margin-bottom:.5rem;}
.prochaine-titre{font-size:.95rem;font-weight:700;font-family:var(--fd);margin-bottom:.35rem;}
.prochaine-date{font-size:.8rem;opacity:.65;}
.prochaine-badge{display:inline-block;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.2);font-size:.62rem;font-weight:700;padding:2px 9px;border-radius:7px;margin-top:.6rem;}

/* FOOTER */
footer{background:var(--g1);color:rgba(255,255,255,.45);text-align:center;padding:1.5rem 1rem;font-size:.72rem;margin-top:3rem;}
footer a{color:rgba(255,255,255,.55);text-decoration:none;}
footer a:hover{color:#fff;}

/* RESPONSIVE */
@media(max-width:768px){
  .hero h1{font-size:1.8rem;}
  .two-col{grid-template-columns:1fr;}
  .hero{padding:3rem 1.25rem 3.5rem;}
  nav{padding:0 1rem;}
  .container{padding:1.5rem 1rem;}
}
</style>
</head>
<body>

<!-- NAVIGATION -->
<nav>
  <a class="nav-logo" href="/">
    <div class="nav-badge">VM</div>
    <div>
      <div class="nav-name">Vizille en Mouvement</div>
      <span class="nav-sub">Mandat 2026–2032</span>
    </div>
  </a>
  <div style="flex:1"></div>
  <span class="nav-date">${dateStr}</span>
  <span style="display:inline-block;width:1px;height:24px;background:rgba(255,255,255,.1);margin:0 1.25rem"></span>
  <a href="/espace" class="btn-connect btn-connect-out">🔑 Espace élus</a>
</nav>

<!-- HERO -->
<div class="hero">
  <div class="hero-eyebrow">🏛 Commune de Vizille · Isère (38)</div>
  <h1>Bienvenue à <em>Vizille</em><br>en Mouvement</h1>
  <p class="hero-sub">Élus au service des 4 350 Vizillois depuis le 15 mars 2026. Retrouvez ici l'agenda public, les événements et la vie municipale.</p>
  <div class="hero-cta">
    <a href="#agenda" class="btn-hero btn-hero-p">📅 Voir l'agenda</a>
    <a href="/espace" class="btn-hero btn-hero-s">🔑 Espace élus →</a>
  </div>
</div>

<!-- STATS BAR -->
<div class="stats-bar">
  <div class="stat"><div class="stat-v">${projets.length}</div><div class="stat-l">Projets au programme</div></div>
  <div class="stat"><div class="stat-v">${elus.length}</div><div class="stat-l">Conseillers élus</div></div>
  <div class="stat"><div class="stat-v">2026</div><div class="stat-l">Année en cours</div></div>
  <div class="stat"><div class="stat-v">6</div><div class="stat-l">Années de mandat</div></div>
  <div class="stat"><div class="stat-v">12</div><div class="stat-l">Commissions</div></div>
</div>

<!-- CONTENU PRINCIPAL -->
<div class="container" id="agenda">
  <div class="two-col">

    <!-- COLONNE GAUCHE : AGENDA -->
    <div>
      <div class="section-title">📅 Agenda & événements à venir</div>

      ${evListHTML.length > 50 ? evListHTML : '<div class="card"><div class="card-body" style="text-align:center;padding:2.5rem;color:var(--i3)"><div style="font-size:2rem;margin-bottom:.75rem">📭</div><div style="font-size:.88rem;font-weight:600">Aucun événement programmé pour l\'instant</div><div style="font-size:.76rem;margin-top:.4rem">Les prochains événements apparaîtront ici.</div></div></div>'}
    </div>

    <!-- COLONNE DROITE : SIDEBAR -->
    <div>

      <!-- PROCHAINE SÉANCE CONSEIL -->
      ${(function(){
        var conseils = agenda.filter(function(a){
          return a.date >= now.toISOString().slice(0,10) && a.type === "conseil";
        }).sort(function(a,b){return a.date > b.date ? 1 : -1;});
        if(!conseils.length) return '<div class="prochaine"><div class="prochaine-label">Prochaine séance</div><div class="prochaine-titre">Aucune séance programmée</div><div class="prochaine-date">Date à confirmer</div></div>';
        var c = conseils[0];
        var d = new Date(c.date+"T00:00:00");
        var JOURS_L = ["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];
        return '<div class="prochaine">'
          +'<div class="prochaine-label">🏛 Prochaine séance du conseil</div>'
          +'<div class="prochaine-titre">'+c.titre+'</div>'
          +'<div class="prochaine-date">'+JOURS_L[d.getDay()]+' '+d.getDate()+' '+MOIS[d.getMonth()]+' '+d.getFullYear()+(c.heure?' à '+c.heure:'')+'</div>'
          +(c.lieu?'<div style="font-size:.73rem;opacity:.55;margin-top:4px">📍 '+c.lieu+'</div>':'')
          +'<div class="prochaine-badge">Séance publique</div>'
          +'</div>';
      })()}

      <!-- MINI CALENDRIER -->
      <div class="mini-cal">
        <div class="cal-nav">
          <button class="cal-nav-btn" onclick="pubCalPrev()">&#x276E;</button>
          <div class="cal-nav-t" id="pub-cal-title"></div>
          <button class="cal-nav-btn" onclick="pubCalNext()">&#x276F;</button>
        </div>
        <div class="cal-dow">
          <div>L</div><div>M</div><div>M</div><div>J</div><div>V</div>
          <div style="color:#d97706">S</div><div style="color:#d97706">D</div>
        </div>
        <div class="cal-days" id="pub-cal-days"></div>
        <div style="display:flex;gap:10px;padding:.5rem .85rem .75rem;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:4px;font-size:.6rem;color:var(--i3)"><div style="width:8px;height:8px;border-radius:2px;background:var(--g8);border:1px solid var(--g7)"></div>Conseil</div>
          <div style="display:flex;align-items:center;gap:4px;font-size:.6rem;color:var(--i3)"><div style="width:6px;height:6px;border-radius:50%;background:var(--g5)"></div>Événement</div>
        </div>
      </div>

      <!-- BLOC CONNEXION ÉLUS -->
      <div class="connect-card">
        <div style="font-size:2rem;margin-bottom:.6rem">🔑</div>
        <h3>Espace réservé aux élus</h3>
        <p>Conseillers municipaux, accédez à votre espace de travail collaboratif : agenda, projets, signalements, documents.</p>
        <a href="/espace" class="btn-full-connect">Se connecter →</a>
        <div class="connect-hint">Identifiants transmis par l'administrateur</div>
      </div>

      <!-- INFOS PRATIQUES -->
      <div class="card">
        <div class="card-head"><span class="card-head-t">ℹ️ Mairie de Vizille</span></div>
        <div class="card-body" style="font-size:.78rem;color:var(--i2);line-height:1.8">
          <div>📍 Place du Château, 38220 Vizille</div>
          <div>📞 04 76 78 06 00</div>
          <div>🌐 <a href="https://vizilleenmouvement.fr" target="_blank" style="color:var(--g3);text-decoration:none">vizilleenmouvement.fr</a></div>
          <div style="margin-top:.65rem;padding-top:.65rem;border-top:1px solid var(--w2)">
            <strong>Maire :</strong> Catherine Troton<br>
            <strong>Mandat :</strong> 2026 – 2032
          </div>
        </div>
      </div>

    </div><!-- /sidebar -->
  </div><!-- /two-col -->
</div><!-- /container -->

<footer>
  <div style="margin-bottom:.4rem">Vizille en Mouvement · Mandat 2026–2032 · Vizille, Isère</div>
  <div><a href="https://vizilleenmouvement.fr">Site public</a> &nbsp;·&nbsp; <a href="/espace">Espace élus</a></div>
</footer>

<script>
// ── CALENDRIER PUBLIC ────────────────────────────────────────────────────────
var _py = new Date().getFullYear();
var _pm = new Date().getMonth();
var _pubAG = ${JSON.stringify(agenda.map(function(a){return {date:a.date,type:a.type};}))};
var _pubEV = ${JSON.stringify(evenements.map(function(e){return {date:e.date};}))};

var MOIS_PUB = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

function pubCalRender(){
  var t = document.getElementById("pub-cal-title");
  var g = document.getElementById("pub-cal-days");
  if(!t||!g) return;
  t.textContent = MOIS_PUB[_pm] + " " + _py;
  var today = new Date();
  var todayStr = today.getFullYear()+"-"+(String(today.getMonth()+1).padStart(2,"0"))+"-"+(String(today.getDate()).padStart(2,"0"));
  var firstDay = new Date(_py,_pm,1);
  var lastDay  = new Date(_py,_pm+1,0);
  var startDow = (firstDay.getDay()+6)%7;
  var ym = _py+"-"+(String(_pm+1).padStart(2,"0"));
  var evDays={}, conseilDays={};
  _pubAG.forEach(function(a){if((a.date||"").startsWith(ym)){if(a.type==="conseil")conseilDays[a.date.slice(8)]=1;else evDays[a.date.slice(8)]=1;}});
  _pubEV.forEach(function(e){if((e.date||"").startsWith(ym))evDays[e.date.slice(8)]=1;});
  var html="";
  for(var i=0;i<startDow;i++) html+='<div></div>';
  for(var d=1;d<=lastDay.getDate();d++){
    var ds = String(d).padStart(2,"0");
    var full = _py+"-"+(String(_pm+1).padStart(2,"0"))+"-"+ds;
    var cls="cal-day"+(full===todayStr?" today":"")+(conseilDays[ds]?" has-conseil":"")+(evDays[ds]?" has-ev":"");
    html+='<div class="'+cls+'">'+d+'</div>';
  }
  g.innerHTML=html;
}
function pubCalPrev(){_pm--;if(_pm<0){_pm=11;_py--;}pubCalRender();}
function pubCalNext(){_pm++;if(_pm>11){_pm=0;_py++;}pubCalRender();}
pubCalRender();
</script>
</body>
</html>`;
}

function buildPage(){
  var projets=Projets.getAll();
  var elus=Elus.getAll();
const today=new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
const COMM={"Culture, Patrimoine & Jumelages": ["Culture", "Patrimoine", "Jumelages"], "Mobilités": ["Mobilités"], "Transition écologique": ["Transition écologique"], "Action sociale": ["Action sociale"], "Concertation citoyenne": ["Concertation citoyenne"], "Animations de proximité": ["Animations de proximité"], "Économie": ["Économie"], "Métropole": ["Métropole"], "Enfance/Jeunesse": ["Enfance/Jeunesse"], "Tranquillité publique": ["Tranquillité publique"], "Travaux & Urbanisme": ["Travaux", "Urbanisme"], "Santé": ["Santé"]};
const COLORS={"Culture, Patrimoine & Jumelages": "#8B5CF6", "Mobilités": "#3B82F6", "Transition écologique": "#10B981", "Action sociale": "#F59E0B", "Concertation citoyenne": "#6366F1", "Animations de proximité": "#EC4899", "Économie": "#14B8A6", "Métropole": "#6B7280", "Enfance/Jeunesse": "#F97316", "Tranquillité publique": "#EF4444", "Travaux & Urbanisme": "#84CC16", "Santé": "#06B6D4"};
const ICONS={"Culture, Patrimoine & Jumelages": "🎭", "Mobilités": "🚲", "Transition écologique": "🌿", "Action sociale": "🤝", "Concertation citoyenne": "🗣", "Animations de proximité": "🎪", "Économie": "💼", "Métropole": "🏙", "Enfance/Jeunesse": "👦", "Tranquillité publique": "🛡", "Travaux & Urbanisme": "🏗", "Santé": "🏥"};
const REFS={"Culture, Patrimoine & Jumelages": "Marie-Claude", "Enfance/Jeunesse": "Angélique", "Animations de proximité": "Jean-Christophe"};
const ELUS0=[{"id": 1, "nom": "Troton", "prenom": "Catherine", "role": "Tête de Liste", "delegation": "", "avatar": "CT", "color": "#1a3a2a", "photo": "https://vizilleenmouvement.fr/images/catherine-troton.jpg", "photoPos": "center 40%", "tel": "", "email": "catherine.troton@ville-vizille.fr", "commission": ""}, {"id": 2, "nom": "Ughetto-Monfrin", "prenom": "Bernard", "role": "Adjoint", "delegation": "", "avatar": "BU", "color": "#2d5a40", "photo": "https://vizilleenmouvement.fr/images/bernard-ughetto-monfrin.jpg", "photoPos": "center 30%", "tel": "", "email": "bernard.UGHETTO-MONFRIN@ville-vizille.fr", "commission": ""}, {"id": 3, "nom": "Berriche", "prenom": "Saïda", "role": "Adjointe", "delegation": "", "avatar": "SB", "color": "#3d7a5a", "photo": "https://vizilleenmouvement.fr/images/saida-berriche.jpg", "photoPos": "center 25%", "tel": "", "email": "saida.berriche@ville-vizille.fr", "commission": ""}, {"id": 4, "nom": "Faure", "prenom": "Gilles", "role": "Adjoint", "delegation": "", "avatar": "GF", "color": "#8B5CF6", "photo": "https://vizilleenmouvement.fr/images/gilles-faure.jpg", "photoPos": "center center", "tel": "", "email": "gilles.FAURE@ville-vizille.fr", "commission": ""}, {"id": 5, "nom": "Hermitte", "prenom": "Angélique", "role": "Conseillère déléguée", "delegation": "", "avatar": "AH", "color": "#F97316", "photo": "https://vizilleenmouvement.fr/images/angelique-hermitte.jpg", "photoPos": "center center", "tel": "", "email": "angelique.HERMITTE@ville-vizille.fr", "commission": ""}, {"id": 6, "nom": "Forestier", "prenom": "Gérard", "role": "Adjoint", "delegation": "", "avatar": "GF", "color": "#EC4899", "photo": "https://vizilleenmouvement.fr/images/gerard-forestier.jpg", "photoPos": "center 40%", "tel": "", "email": "gerard.FORESTIER@ville-vizille.fr", "commission": ""}, {"id": 7, "nom": "ARGOUD", "prenom": "Marie-Claude", "role": "Première Adjointe", "delegation": "", "avatar": "MA", "color": "#F59E0B", "photo": "https://vizilleenmouvement.fr/images/marie-claude-argoud.jpg", "photoPos": "center center", "tel": "", "email": "marie-claude.ARGOUD@ville-vizille.fr", "commission": ""}, {"id": 8, "nom": "Lamarca", "prenom": "Louis", "role": "Adjoint", "delegation": "", "avatar": "LL", "color": "#3B82F6", "photo": "https://vizilleenmouvement.fr/images/louis-lamarca.jpg", "photoPos": "center 40%", "tel": "", "email": "Louis.Lamarca@ville-vizille.fr", "commission": ""}, {"id": 9, "nom": "Pasquiou", "prenom": "Muriel", "role": "", "delegation": "", "avatar": "MP", "color": "#10B981", "photo": "https://vizilleenmouvement.fr/images/muriel-pasquiou.jpg", "photoPos": "center center", "tel": "", "email": "muriel.pasquiou@gmail.com", "commission": ""}, {"id": 10, "nom": "Pichon", "prenom": "Laurent", "role": "", "delegation": "", "avatar": "LP", "color": "#EF4444", "photo": "https://vizilleenmouvement.fr/images/laurent-pichon.jpg", "photoPos": "center center", "tel": "", "email": "pichon.laurent@wanadoo.fr", "commission": ""}, {"id": 11, "nom": "YAHIAOUI", "prenom": "Sakina", "role": "conseillère déléguée", "delegation": "", "avatar": "SY", "color": "#14B8A6", "photo": "https://vizilleenmouvement.fr/images/sakina-yahiaoui.jpg", "photoPos": "center 40%", "tel": "", "email": "sakina.YAHIAOUI@ville-vizille.fr", "commission": ""}, {"id": 12, "nom": "CHERIGUI", "prenom": "Mohamed", "role": "", "delegation": "", "avatar": "MC", "color": "#6366F1", "photo": "https://vizilleenmouvement.fr/images/mohamed-cherigui.jpg", "photoPos": "center 25%", "tel": "", "email": "mohamed.cherigui@sdis38.fr", "commission": ""}, {"id": 13, "nom": "REIJASSE", "prenom": "Christelle", "role": "", "delegation": "", "avatar": "CR", "color": "#db2777", "photo": "https://vizilleenmouvement.fr/images/christelle-reijasse.jpg", "photoPos": "center center", "tel": "", "email": "reijassechristelle28@gmail.com", "commission": ""}, {"id": 14, "nom": "MENDESS", "prenom": "Ahmed", "role": "Conseillé délégué", "delegation": "", "avatar": "AM", "color": "#0891b2", "photo": "https://vizilleenmouvement.fr/images/ahmed-mendess.jpg", "photoPos": "center center", "tel": "", "email": "ahmed.MENDESS@ville-vizille.fr", "commission": ""}, {"id": 15, "nom": "Sanchez", "prenom": "Christine", "role": "", "delegation": "", "avatar": "CS", "color": "#65a30d", "photo": "https://vizilleenmouvement.fr/images/christine-sanchez.jpg", "photoPos": "center center", "tel": "", "email": "sanchez7.christine@gmail.com", "commission": ""}, {"id": 16, "nom": "Pasquiou", "prenom": "Fabrice", "role": "Conseiller délégué", "delegation": "", "avatar": "FP", "color": "#7c3aed", "photo": "https://vizilleenmouvement.fr/images/fabrice-pasquiou.jpg", "photoPos": "center center", "tel": "", "email": "fabrice.PASQUIOU@ville-vizille.fr", "commission": ""}, {"id": 17, "nom": "El-Kebir", "prenom": "Meriem", "role": "", "delegation": "", "avatar": "ME", "color": "#9333ea", "photo": "https://vizilleenmouvement.fr/images/meriem-el-kebir.jpg", "photoPos": "center center", "tel": "", "email": "Meriem.El-Kebir@ville-vizille.fr", "commission": ""}, {"id": 18, "nom": "Garcia", "prenom": "Jean-Christophe", "role": "", "delegation": "", "avatar": "JG", "color": "#c2410c", "photo": "https://vizilleenmouvement.fr/images/jean-christophe-garcia.jpg", "photoPos": "center center", "tel": "", "email": "jeanchristophe.garcia38@gmail.com", "commission": ""}, {"id": 19, "nom": "PICCA", "prenom": "Muriel", "role": "", "delegation": "", "avatar": "MP", "color": "#b45309", "photo": "https://vizilleenmouvement.fr/images/muriel-picca.jpg", "photoPos": "center center", "tel": "", "email": "piccamumu@hotmail.fr", "commission": ""}, {"id": 20, "nom": "Thuillier", "prenom": "Michel", "role": "", "delegation": "", "avatar": "MT", "color": "#0f766e", "photo": "https://vizilleenmouvement.fr/images/michel-thuillier.jpg", "photoPos": "center center", "tel": "", "email": "thuilliermichel@mac.com", "commission": ""}, {"id": 21, "nom": "Nifenecker", "prenom": "Isabelle", "role": "", "delegation": "", "avatar": "IN", "color": "#1d4ed8", "photo": "https://vizilleenmouvement.fr/images/isabelle-nifenecker.jpg", "photoPos": "center 40%", "tel": "", "email": "isabelle_nifenecker@hotmail.fr", "commission": ""}, {"id": 22, "nom": "Venans", "prenom": "André-Paul", "role": "Conseiller", "delegation": "", "avatar": "AV", "color": "#be185d", "photo": "https://vizilleenmouvement.fr/images/andre-paul-venans.jpg", "photoPos": "center center", "tel": "", "email": "Andre-Paul.Venans@ville-vizille.fr", "commission": ""}, {"id": 23, "nom": "Jacolin", "prenom": "Nathalie", "role": "", "delegation": "", "avatar": "NJ", "color": "#15803d", "photo": "https://vizilleenmouvement.fr/images/nathalie-jacolin.jpg", "photoPos": "center 40%", "tel": "", "email": "jacolin.nathalie@hotmail.fr", "commission": ""}, {"id": 24, "nom": "Cosentino", "prenom": "Ignazio", "role": "", "delegation": "", "avatar": "IC", "color": "#b91c1c", "photo": "https://vizilleenmouvement.fr/images/ignazio-consentino.jpg", "photoPos": "center center", "tel": "", "email": "ignazio.cosentino@free.fr", "commission": ""}, {"id": 25, "nom": "Germain-Vey", "prenom": "Nathalie", "role": "conseillère déléguée", "delegation": "", "avatar": "NG", "color": "#6d28d9", "photo": "https://vizilleenmouvement.fr/images/nathalie-germain-vey.jpg", "photoPos": "center center", "tel": "", "email": "Nathalie.Germain-Vey@ville-vizille.fr", "commission": ""}, {"id": 26, "nom": "Lasserre", "prenom": "Stéphane", "role": "Conseiller", "delegation": "", "avatar": "SL", "color": "#0369a1", "photo": "https://vizilleenmouvement.fr/images/stephane-lasserre.jpg", "photoPos": "center center", "tel": "", "email": "stephane.LASSERRE@ville-vizille.fr", "commission": ""}];
const GUIDES=[{"id": "1", "icon": "⚖️", "titre": "Droits et devoirs de l'élu", "contenu": "En tant que conseiller municipal, vous bénéficiez de droits concrets et êtes soumis à des obligations précises.\n\nVOS DROITS\n• Formation : 18h/an remboursées (organismes agréés : AMF Formation, CNFPT). La commune prend en charge les frais pédagogiques et de déplacement.\n• Indemnités : versées selon le rang (maire, adjoint, conseiller). Pour Vizille (~4 350 hab.), les indemnités sont fixées par délibération du conseil.\n• Protection fonctionnelle : la commune vous défend en cas de mise en cause dans l'exercice de vos fonctions.\n• Droit à l'information : vous pouvez consulter tous les documents préparatoires aux délibérations.\n• Droit d'expression : vous pouvez vous exprimer en séance, poser des questions orales, demander des explications de vote.\n• Crédit d'heures : si vous êtes salarié, vous disposez d'un crédit d'heures pour exercer votre mandat (art. L2123-1 CGCT).\n\nVOS DEVOIRS\n• Discrétion : les informations confidentielles obtenues dans l'exercice du mandat ne peuvent être divulguées.\n• Déport : si une délibération vous concerne personnellement (votre rue, votre association, votre employeur), vous devez quitter la salle avant le vote et le signaler.\n• Déclaration d'intérêts : obligatoire pour les adjoints et conseillers délégués (HATVP).\n• Assiduité : votre présence aux séances du conseil est attendue. Trois absences injustifiées consécutives peuvent entraîner une radiation.\n\nEN CAS DE DOUTE : contactez le DGS ou l'AMF (amf.asso.fr, numéro vert gratuit)."}, {"id": "2", "icon": "🏛️", "titre": "Le conseil municipal — comment ça marche", "contenu": "Le conseil municipal est l'organe délibérant de la commune. Il vote le budget, prend les décisions importantes et contrôle l'exécutif.\n\nLES RÉUNIONS\n• Fréquence minimum : 4 fois par an, mais en pratique mensuelle à Vizille.\n• Convocation : envoyée au moins 5 jours avant la séance, avec l'ordre du jour et les documents annexes.\n• Publicité : les séances sont publiques (sauf huis clos voté). Les habitants peuvent assister.\n• Quorum : la moitié des membres en exercice doit être présente. Si le quorum n'est pas atteint, la séance est reportée à 3 jours minimum — sans condition de quorum cette fois.\n\nDÉROULEMENT TYPE D'UNE SÉANCE\n1. Appel nominal et vérification du quorum\n2. Désignation du secrétaire de séance\n3. Approbation du compte-rendu de la séance précédente\n4. Délibérations à l'ordre du jour\n5. Questions diverses / questions orales\n\nLES DÉLIBÉRATIONS\n• Vote à la majorité simple sauf dispositions particulières.\n• Vous pouvez demander un vote à bulletins secrets si la question porte sur des personnes.\n• Vous pouvez voter pour, contre, ou vous abstenir (l'abstention ne compte pas comme un vote).\n• Vous pouvez demander que votre explication de vote figure au procès-verbal.\n\nDROITS PRATIQUES EN SÉANCE\n• Droit d'amendement : vous pouvez proposer une modification d'une délibération.\n• Questions orales : à adresser au maire 48h avant la séance si possible.\n• Procuration : vous pouvez donner procuration à un autre conseiller (une seule procuration par personne)."}, {"id": "3", "icon": "💰", "titre": "Le budget municipal — l'essentiel", "contenu": "Comprendre le budget vous permet de participer utilement aux débats et de porter vos projets efficacement.\n\nSTRUCTURE DU BUDGET DE VIZILLE\n• Budget principal : environ 8-9 M€ par an (fonctionnement + investissement).\n• Section de fonctionnement : dépenses courantes (personnel, charges, subventions). Ne peut pas être financée par emprunt.\n• Section d'investissement : travaux, équipements. Peut être financée par emprunt ou subventions.\n• Règle d'or : le budget doit être voté en équilibre réel.\n\nLE CALENDRIER BUDGÉTAIRE\n• Octobre/novembre : Débat d'Orientation Budgétaire (DOB) — obligatoire, non décisionnel mais structurant.\n• Décembre/janvier : vote du Budget Primitif (BP).\n• En cours d'année : Décisions Modificatives (DM) si nécessaire.\n• N+1 : Compte Administratif (exécution réelle) vs Budget Primitif (prévisionnel).\n\nLES SOURCES DE FINANCEMENT\n• Fiscalité locale (taxe foncière, CFE) : principale ressource.\n• Dotations de l'État (DGF) : en baisse tendancielle depuis 2014.\n• DETR (État) : pour les projets d'investissement ruraux.\n• GAM (Grenoble-Alpes Métropole) : contrats de territoire.\n• Département Isère et Région AURA : appels à projets.\n\nCE QUE VOUS POUVEZ FAIRE\n• Poser des questions en séance sur n'importe quelle ligne budgétaire.\n• Demander un rapport spécial sur une dépense.\n• Voter contre le budget : cela déclenche une procédure de réformation préfectorale.\n• Proposer des vœux budgétaires lors du DOB."}, {"id": "4", "icon": "🏢", "titre": "Qui fait quoi en mairie — organigramme pratique", "contenu": "Connaître les services vous permet d'agir efficacement sans court-circuiter les procédures.\n\nL'EXÉCUTIF POLITIQUE\n• Maire (Catherine Troton) : dirige l'administration, représente la commune, signe les arrêtés et marchés.\n• Adjoints : délégation de signature dans leur domaine. Agissent par délégation du maire.\n• Conseillers délégués : missions spécifiques sans délégation de signature générale.\n• Conseillers : rôle délibératif au conseil, participation aux commissions.\n\nL'ADMINISTRATION MUNICIPALE\n• DGS (Directeur Général des Services) : coordonne tous les services. Votre interlocuteur principal pour les questions transversales.\n• Secrétariat du maire : gère l'agenda, les courriers officiels, les convocations.\n• Service technique (voirie, bâtiments, espaces verts) : travaux et maintenance.\n• Service culturel : médiathèque, animations, patrimoine.\n• CCAS (Centre Communal d'Action Sociale) : action sociale, aides aux personnes.\n• Police Municipale : tranquillité publique, stationnement.\n• Service enfance/jeunesse : crèche, périscolaire, accueil jeunes.\n• Service urbanisme : permis de construire, PLU.\n• Service finances : budget, marchés publics, paie.\n\nLA RÈGLE D'OR\n→ Pour toute demande touchant les services (travaux, renseignements, intervention), passer TOUJOURS par le DGS ou le maire. Ne jamais donner d'instructions directes aux agents.\n→ En tant que conseiller, vous n'avez pas pouvoir hiérarchique sur les agents municipaux.\n\nLES COMMISSIONS\n12 commissions thématiques (voir sidebar). Chaque commission instruit les dossiers avant le conseil. Votre présence aux commissions dont vous êtes membre est essentielle."}, {"id": "5", "icon": "🛡️", "titre": "Conflits d'intérêts — comment les gérer", "contenu": "Le conflit d'intérêts est une situation où votre intérêt personnel peut influencer l'exercice de vos fonctions. La loi est stricte, mais la procédure est simple.\n\nSITUATIONS TYPIQUES À VIZILLE\n• Une délibération concerne une rue où vous habitez (riverain direct).\n• Un marché est attribué à une entreprise qui vous emploie ou appartient à un proche.\n• Une subvention est accordée à une association dont vous êtes président ou membre actif.\n• Un permis de construire voisin de votre propriété est soumis au vote.\n\nLA PROCÉDURE DE DÉPORT (obligatoire)\n1. Signalez la situation au maire AVANT la séance (par écrit si possible).\n2. Lors de la séance, annoncez votre déport à voix haute.\n3. Quittez la salle pendant la délibération ET le vote.\n4. Le procès-verbal mentionnera votre absence sur ce point.\n\nATTENTION : rester assis dans la salle sans voter ne suffit pas — vous devez physiquement quitter la salle.\n\nDÉCLARATION D'INTÉRÊTS (pour adjoints et conseillers délégués)\n• Obligatoire dans les 2 mois suivant la prise de fonctions.\n• À déposer auprès du maire et de la HATVP (hatvp.fr).\n• Mise à jour en cas de changement de situation.\n\nEN CAS DE DOUTE\n• Conseil du DGS ou du maire.\n• Service juridique de l'AMF (gratuit pour les communes adhérentes).\n• En cas de mise en cause pénale : protection fonctionnelle de la commune.\n\nMieux vaut un déport de trop qu'une mise en cause pour prise illégale d'intérêts (délit pénal)."}, {"id": "6", "icon": "🎓", "titre": "Formation et montée en compétences", "contenu": "Vous avez le droit et le devoir de vous former. Les ressources sont nombreuses et souvent gratuites.\n\nVOS DROITS À LA FORMATION\n• 18 heures de formation par an, remboursées sur le budget communal.\n• Les frais pédagogiques, de déplacement et d'hébergement sont pris en charge.\n• Droit individuel à la formation (DIF élu) : 20h/an cumulables sur 6 ans = 120h max.\n• Si vous êtes salarié : droit à un congé formation de 18 jours/mandat.\n\nORGANISMES RECOMMANDÉS\n• AMF Formation (amf.asso.fr) : spécialiste des élus locaux. Programmes thématiques.\n• CNFPT (cnfpt.fr) : formations gratuites ou à tarif réduit pour les élus.\n• IEP Grenoble : formations locales sur les politiques publiques.\n• Université de Grenoble : certificats en droit public local.\n\nFORMATIONS PRIORITAIRES POUR VOTRE MANDAT\n→ Finances locales (comprendre le budget, les marchés publics)\n→ Urbanisme et droit des sols (PLU, permis de construire)\n→ Commande publique (marchés publics, DSP)\n→ Droit de la fonction publique territoriale\n→ Conduite de réunion et concertation citoyenne\n→ Transition écologique pour les collectivités\n\nPROCÉDURE PRATIQUE\n1. Choisissez votre formation sur amf.asso.fr ou cnfpt.fr.\n2. Présentez votre demande au maire avec programme + devis.\n3. Le conseil vote si le montant dépasse le plafond annuel.\n4. La commune paye directement l'organisme.\n\nRESSOURCES GRATUITES EN LIGNE\n• Légifrance (legifrance.gouv.fr) : tous les textes législatifs.\n• Collectivités-locales.gouv.fr : guides pratiques ministériels.\n• Maire-Info (maire-info.com) : actualité quotidienne des communes."}, {"id": "7", "icon": "🗳️", "titre": "Vizille en chiffres — connaître sa commune", "contenu": "Pour intervenir utilement en conseil, voici les données clés de Vizille.\n\nLA COMMUNE\n• Population : environ 7 200 habitants (commune centre) — environ 4 350 dans le périmètre de gestion directe.\n• Superficie : 20,5 km² — commune de montagne, vallée du Drac.\n• Intercommunalité : Grenoble-Alpes Métropole (49 communes, 450 000 hab.).\n• Situation : 25 km au sud de Grenoble, RN85 (route Napoléon), D1091 (Oisans).\n\nLE CONSEIL MUNICIPAL\n• 27 conseillers au total (liste VeM élue le 15 mars 2026).\n• Mandat 2026-2032 (6 ans).\n• Maire : Catherine Troton.\n• 8 adjoints, 5 conseillers délégués, 14 conseillers.\n\nLE BUDGET (estimations 2026)\n• Budget de fonctionnement : ~5,5-6 M€.\n• Budget d'investissement : ~2,5-3 M€.\n• Dette en cours : à consulter au Compte Administratif.\n• Taux de fiscalité : taxe foncière bâtie, CFE (voir délibérations).\n\nLES SERVICES MUNICIPAUX\n• ~80 agents à temps plein équivalent.\n• Services : technique, culturel, enfance, social (CCAS), urbanisme, police municipale, finances.\n\nLES ENJEUX DU MANDAT (programme VeM)\n• Mobilités : désaturation RN85/D1091, alternatives, vélo.\n• Transition écologique : rénovation énergétique, biodiversité, alimentation locale.\n• Centralité vizilloise : réhabilitation centre-ville, OPAH-RU, Tanneries.\n• Enfance/jeunesse : crèche, périscolaire, loisirs.\n• Action sociale : maintien à domicile, CCAS, inclusion.\n• Tranquillité publique : police municipale, médiation.\n• Culture/patrimoine : château, médiathèque, jumelages.\n\nCONTACTS CLÉS\n• Mairie : 04 76 78 06 00 — Place du Château, 38220 Vizille.\n• DGS : votre interlocuteur pour toute question administrative.\n• Préfecture de l'Isère (Grenoble) : tutelle administrative."}, {"id": "8", "icon": "📋", "titre": "Les commissions — rôle et fonctionnement", "contenu": "Les commissions préparent le travail du conseil. C'est là que se fait le vrai travail de fond.\n\nLES 12 COMMISSIONS DE VIZILLE EN MOUVEMENT\n1. Culture, Patrimoine & Jumelages\n2. Mobilités\n3. Transition écologique\n4. Action sociale\n5. Concertation citoyenne\n6. Animations de proximité\n7. Économie\n8. Métropole\n9. Enfance/Jeunesse\n10. Tranquillité publique\n11. Travaux & Urbanisme\n12. Santé\n\nRÔLE DES COMMISSIONS\n• Elles examinent les dossiers AVANT le conseil.\n• Elles formulent des recommandations (avis consultatif — la décision reste au conseil).\n• Elles permettent d'approfondir les sujets et d'auditionner des experts.\n• Elles sont le lieu du travail collectif et du débat interne à la majorité.\n\nFONCTIONNEMENT PRATIQUE\n• Chaque commission a un président (souvent l'adjoint référent du domaine).\n• Les réunions ne sont pas publiques (sauf décision contraire).\n• Vous pouvez assister aux commissions dont vous n'êtes pas membre, sauf vote contraire.\n• Un compte rendu est établi et communiqué aux conseillers.\n\nVOTRE RÔLE EN COMMISSION\n• Préparez les dossiers en lisant les documents transmis à l'avance.\n• Posez vos questions pendant la commission, pas en séance plénière.\n• Si vous êtes référent d'un projet, assurez-vous du suivi entre deux séances.\n• Faites le lien avec les habitants et les associations de votre secteur.\n\nASTUCE : La commission \"Métropole\" suit les dossiers GAM qui impactent Vizille. Particulièrement important pour les mobilités, l'urbanisme et les financements."}];
const RESS=[{"titre": "AMF — Association des Maires", "url": "https://www.amf.asso.fr", "icon": "🏛", "desc": "Actualités, guides, formations"}, {"titre": "Légifrance", "url": "https://www.legifrance.gouv.fr", "icon": "⚖️", "desc": "Textes législatifs et réglementaires"}, {"titre": "Maire-Info", "url": "https://www.maire-info.com", "icon": "📰", "desc": "Actualité quotidienne des communes"}, {"titre": "Collectivités-locales.gouv", "url": "https://www.collectivites-locales.gouv.fr", "icon": "🏗", "desc": "Informations pour les élus"}, {"titre": "kMeet (Visio)", "url": "https://kmeet.infomaniak.com", "icon": "🎥", "desc": "Visioconférence sécurisée"}, {"titre": "Site Vizille en Mouvement", "url": "https://vizilleenmouvement.fr", "icon": "🌐", "desc": "Site public de la liste"}, {"titre": "WordPress Vizille", "url": "https://wp.vizilleenmouvement.fr", "icon": "🖥", "desc": "Site officiel de la commune"}];
return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>VeM &#x2014; Espace élus</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"><\/script>
<style>
:root{
  --g1:#1a3a2a;--g2:#2d5a40;--g3:#3d7a5a;--g4:#4a9a6a;--g5:#6ab88a;--g6:#8dd0a8;--g7:#b8e4cc;--g8:#e0f5ea;--g9:#f0faf4;
  --w:#faf8f4;--w2:#f0ece4;--w3:#ddd8ce;--w4:#c5bfb4;
  --ink:#1a2520;--i2:#2d3d35;--i3:#5a7068;--i4:#8a9e96;
  --or:#c9a227;--or2:#e8c84a;--or3:#f5e8c3;
  --red:#dc2626;--amber:#d97706;--blue:#2563eb;--violet:#7c3aed;--pink:#db2777;--teal:#0891b2;
  --fn:"Inter","Source Sans 3",sans-serif;--fd:"DM Sans",sans-serif;--fh:"Playfair Display",serif;--fm:"JetBrains Mono",monospace;
  --r:10px;--R:16px;--rr:22px;
  --s1:0 2px 6px rgba(26,58,42,.06),0 1px 3px rgba(26,58,42,.04);
  --s2:0 4px 16px rgba(26,58,42,.1),0 2px 6px rgba(26,58,42,.06);
  --s3:0 16px 48px rgba(26,58,42,.14),0 4px 12px rgba(26,58,42,.08);
  --sw:260px;--th:58px;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html{font-size:15.5px;}
body{font-family:var(--fn);background:var(--w);color:var(--ink);height:100vh;margin:0;overflow:hidden;display:flex;flex-direction:column;-webkit-font-smoothing:antialiased;}

/* TOPBAR */
.top{height:var(--th);background:var(--g1);display:flex;align-items:center;padding:0 1.25rem;gap:12px;flex-shrink:0;z-index:200;box-shadow:0 2px 12px rgba(0,0,0,.25);}
.top-badge{width:34px;height:34px;background:linear-gradient(135deg,var(--g4),var(--g3));border-radius:9px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.82rem;color:#fff;}
.top-name{font-size:.84rem;font-weight:600;color:#fff;font-family:var(--fd);}
.top-sub{font-size:.62rem;color:rgba(255,255,255,.38);display:block;margin-top:1px;}
.top-div{width:1px;height:26px;background:rgba(255,255,255,.12);}
.top-date{font-size:.7rem;color:rgba(255,255,255,.4);flex:1;}
.tbtn{display:inline-flex;align-items:center;gap:5px;padding:5px 11px;border-radius:7px;font-size:.72rem;font-weight:600;cursor:pointer;font-family:var(--fn);border:none;transition:.15s;}
.tbtn-v{background:var(--g4);color:#fff;}.tbtn-v:hover{background:var(--g3);}
.tbtn-c{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.15);color:rgba(255,255,255,.85);position:relative;}.tbtn-c:hover{background:rgba(255,255,255,.18);}
.top-av{width:30px;height:30px;background:var(--g4);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.68rem;font-weight:700;color:#fff;cursor:pointer;border:1.5px solid rgba(255,255,255,.2);}
.cbdg{width:7px;height:7px;background:var(--red);border-radius:50%;position:absolute;top:-2px;right:-2px;border:1.5px solid var(--g1);display:none;}

/* LAYOUT — division verticale fixe */
.layout{display:flex;flex-direction:row;width:100%;height:calc(100vh - var(--th));overflow:hidden;}

/* SIDEBAR */
.sb{width:var(--sw);background:var(--g1);flex-shrink:0;display:flex;flex-direction:column;overflow-y:auto;z-index:50;}
.sb::-webkit-scrollbar{width:3px;}.sb::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08);border-radius:2px;}
.sbs{padding:.75rem 1rem .2rem;font-size:.59rem;font-weight:700;color:rgba(255,255,255,.2);text-transform:uppercase;letter-spacing:.1em;}
.sbi{display:flex;align-items:center;gap:9px;padding:.46rem 1rem .46rem 1.1rem;cursor:pointer;color:rgba(255,255,255,.52);font-size:.78rem;border-left:2px solid transparent;transition:all .15s;user-select:none;}
.sbi:hover{background:rgba(255,255,255,.06);color:rgba(255,255,255,.88);}
.sbi.on{background:rgba(255,255,255,.1);color:#fff;border-left:3px solid #4ade80;font-weight:600;}
.sbi-ic{width:18px;text-align:center;font-size:.9rem;flex-shrink:0;}
.sbi-n{font-size:.58rem;font-weight:700;background:var(--g4);color:#fff;padding:1px 6px;border-radius:8px;margin-left:auto;}
.sbi-new{font-size:.56rem;font-weight:700;background:var(--red);color:#fff;padding:1px 5px;border-radius:8px;margin-left:auto;animation:blink 2s infinite;display:none;}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.4}}
.sbf{margin-top:auto;padding:.85rem 1rem;border-top:1px solid rgba(255,255,255,.07);font-size:.63rem;color:rgba(255,255,255,.2);line-height:1.7;}

/* MAIN */
.main{flex:1;overflow-y:auto;background:var(--w);}
.ph{padding:.72rem 1.4rem;background:#fff;border-bottom:1px solid var(--w2);display:flex;align-items:center;gap:12px;box-shadow:var(--s1);}
.ph-ico{width:36px;height:36px;border-radius:var(--r);display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0;}
.ph-t{font-size:.94rem;font-weight:700;color:var(--ink);font-family:var(--fd);line-height:1.2;}
.ph-s{font-size:.69rem;color:var(--i3);margin-top:1px;}
.ph-a{margin-left:auto;display:flex;gap:8px;align-items:center;}
.scr{padding:1.2rem 1.4rem;}
.scr::-webkit-scrollbar{width:4px;}.scr::-webkit-scrollbar-thumb{background:var(--w3);border-radius:2px;}
.wg{min-height:200px;}

/* PAGES */
.page{display:none;}.page.on{display:block;}@keyframes fadeIn{from{opacity:0}to{opacity:1}}

/* CARDS */
.card{background:#fff;border-radius:var(--R);border:1px solid var(--w2);box-shadow:var(--s1);padding:1.1rem 1.25rem;margin-bottom:12px;}
.cardt{font-size:.8rem;font-weight:700;color:var(--i2);margin-bottom:.85rem;display:flex;align-items:center;gap:8px;}
.cardt::before{content:"";width:3px;height:14px;background:var(--g4);border-radius:2px;}

/* KPI */
.kpig{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;margin-bottom:14px;}
.kpi{background:#fff;border-radius:var(--R);padding:.8rem 1rem;border:1px solid var(--w2);box-shadow:var(--s1);position:relative;overflow:hidden;}
.kpi::after{content:"";position:absolute;bottom:0;left:0;right:0;height:3px;background:var(--g5);}
.kpiv{font-size:1.9rem;font-weight:800;color:var(--g2);line-height:1;font-family:var(--fd);}
.kpil{font-size:.65rem;color:var(--i3);margin-top:4px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;}

/* HERO */
.hero{background:linear-gradient(135deg,var(--g1) 0%,var(--g2) 55%,var(--g3) 100%);border-radius:var(--rr);padding:1.5rem 1.75rem;color:#fff;display:flex;align-items:center;gap:1.5rem;margin-bottom:14px;position:relative;overflow:hidden;box-shadow:var(--s2);}
.hero::before{content:"";position:absolute;top:-50px;right:-50px;width:200px;height:200px;border-radius:50%;background:rgba(255,255,255,.04);}
.hero-ico{width:56px;height:56px;background:rgba(255,255,255,.12);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:1.5rem;border:1px solid rgba(255,255,255,.15);flex-shrink:0;z-index:1;}
.hero-c{z-index:1;}
.hero-t{font-size:1.1rem;font-weight:700;font-family:var(--fd);margin-bottom:.3rem;}
.hero-s{font-size:.78rem;opacity:.62;line-height:1.6;}

/* NEXT MEETING */
.nmtg{background:linear-gradient(135deg,var(--g2),var(--g3));border-radius:var(--R);padding:.9rem 1.2rem;color:#fff;display:flex;gap:14px;align-items:center;box-shadow:var(--s2);cursor:pointer;margin-bottom:14px;}
.nmtg:hover{opacity:.92;}
.nmtg-db{background:rgba(255,255,255,.15);border-radius:10px;padding:.5rem .7rem;text-align:center;border:1px solid rgba(255,255,255,.2);flex-shrink:0;}
.nmtg-d{font-size:1.4rem;font-weight:800;line-height:1;font-family:var(--fd);}
.nmtg-m{font-size:.6rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-top:2px;opacity:.75;}
.nmtg-t{font-size:.88rem;font-weight:700;margin-bottom:.25rem;font-family:var(--fd);}
.nmtg-s{font-size:.73rem;opacity:.7;}
.nmtg-b{margin-left:auto;background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.2);color:#fff;font-size:.65rem;font-weight:700;padding:3px 9px;border-radius:8px;flex-shrink:0;}

/* TASKS */
.tsk{display:flex;align-items:flex-start;gap:10px;padding:.55rem .5rem;border-radius:var(--r);transition:.15s;cursor:pointer;}
.tsk:hover{background:var(--w);}
.tsk-cb{width:18px;height:18px;border-radius:5px;border:2px solid var(--w3);flex-shrink:0;display:flex;align-items:center;justify-content:center;margin-top:1px;transition:.15s;}
.tsk-cb.done{background:var(--g4);border-color:var(--g4);}
.tsk-tx{font-size:.78rem;color:var(--ink);line-height:1.4;flex:1;}
.tsk-tx.done{text-decoration:line-through;color:var(--i4);}
.tsk-del{background:none;border:none;color:var(--i4);cursor:pointer;font-size:.85rem;opacity:0;transition:.15s;padding:0 3px;}
.tsk:hover .tsk-del{opacity:1;}

/* ANNONCES */
.ann{display:flex;gap:10px;padding:.65rem .5rem;border-radius:var(--r);margin-bottom:4px;}
.ann:hover{background:var(--w);}
.ann-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-top:5px;}
.ann-t{font-size:.78rem;font-weight:600;color:var(--ink);margin-bottom:2px;}
.ann-tx{font-size:.72rem;color:var(--i3);line-height:1.4;}
.ann-m{font-size:.63rem;color:var(--i4);margin-top:3px;font-family:var(--fm);}

/* COMMISSION GRID */
.cg{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:12px;}
.cc{background:#fff;border-radius:var(--rr);border:1px solid var(--w2);box-shadow:var(--s1);overflow:hidden;cursor:pointer;transition:transform .18s,box-shadow .18s;}
.cc:hover{transform:translateY(-2px);box-shadow:var(--s3);}
.cc-top{height:76px;padding:.8rem 1rem;display:flex;align-items:flex-end;gap:10px;}
.cc-ico{width:40px;height:40px;border-radius:10px;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-size:1.2rem;border:1px solid rgba(255,255,255,.2);}
.cc-ref{margin-left:auto;background:rgba(255,255,255,.18);color:#fff;font-size:.62rem;font-weight:600;padding:2px 7px;border-radius:7px;border:1px solid rgba(255,255,255,.18);}
.cc-b{padding:.85rem 1rem;}
.cc-title{font-size:.84rem;font-weight:700;font-family:var(--fd);color:var(--ink);margin-bottom:.2rem;line-height:1.3;}
.cc-th{font-size:.65rem;color:var(--i3);margin-bottom:.75rem;}
.cc-ks{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-bottom:.65rem;}
.ck{text-align:center;background:var(--w);border-radius:7px;padding:.32rem .2rem;}
.ckv{font-size:1.05rem;font-weight:800;line-height:1;font-family:var(--fd);}
.ckl{font-size:.57rem;color:var(--i4);margin-top:2px;text-transform:uppercase;letter-spacing:.02em;}
.cc-prog{height:4px;background:var(--w2);border-radius:3px;}
.cc-fill{height:4px;border-radius:3px;}
.cc-pct{display:flex;justify-content:space-between;font-size:.63rem;color:var(--i4);margin-top:3px;}

/* TABLE */
.tbw{background:#fff;border-radius:var(--R);border:1px solid var(--w2);box-shadow:var(--s1);overflow:auto;}
.fb{padding:.6rem 1.1rem;background:var(--w);border-bottom:1px solid var(--w2);display:flex;align-items:center;gap:7px;flex-wrap:wrap;}
.fsel{padding:5px 8px;border:1px solid var(--w2);border-radius:7px;font-size:.73rem;background:#fff;color:var(--ink);outline:none;font-family:var(--fn);cursor:pointer;}
.fsel:focus{border-color:var(--g4);}
.fsrch{padding:5px 9px;border:1px solid var(--w2);border-radius:7px;font-size:.73rem;background:#fff;color:var(--ink);outline:none;flex:1;min-width:140px;font-family:var(--fn);}
.fsrch:focus{border-color:var(--g4);}
.fcnt{font-size:.69rem;color:var(--i4);white-space:nowrap;}
table{width:100%;border-collapse:collapse;font-size:.76rem;}
thead{position:sticky;top:0;z-index:2;}
th{background:var(--w);padding:8px 11px;text-align:left;font-size:.66rem;font-weight:700;color:var(--i3);border-bottom:2px solid var(--w2);text-transform:uppercase;letter-spacing:.06em;white-space:nowrap;}
td{padding:8px 11px;border-bottom:1px solid var(--w);vertical-align:middle;}
tr:last-child td{border-bottom:none;}
tr:hover td{background:var(--g9);}
.pn{font-weight:600;font-size:.79rem;color:var(--ink);font-family:var(--fd);}
.pr{font-size:.68rem;color:var(--i3);margin-top:1px;line-height:1.3;}
.chip{display:inline-block;font-size:.62rem;font-weight:700;background:var(--g8);color:var(--g2);padding:2px 7px;border-radius:8px;}

/* BADGES */
.b{display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:20px;font-size:.64rem;font-weight:700;white-space:nowrap;}
.b::before{content:"";width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.8;}
.b-pr{background:#fee2e2;color:#b91c1c;}.b-pg{background:#dcfce7;color:#15803d;}.b-pl{background:#dbeafe;color:#1d4ed8;}
.b-et{background:#fef9c3;color:#a16207;}.b-ec{background:#ffedd5;color:#c2410c;}.b-re{background:#d1fae5;color:#065f46;}.b-nd{background:var(--w2);color:var(--i4);}

.ssel{padding:3px 6px;border:1px solid var(--w2);border-radius:6px;font-size:.69rem;background:#fff;color:var(--ink);cursor:pointer;outline:none;font-family:var(--fn);}

/* AGENDA */
.agc{display:flex;gap:14px;align-items:flex-start;background:#fff;border-radius:var(--R);border:1px solid var(--w2);padding:.85rem 1rem;margin-bottom:10px;box-shadow:var(--s1);}
.agc.past{opacity:.45;}
.agc-db{flex-shrink:0;background:var(--g8);border-radius:var(--r);padding:.4rem .6rem;text-align:center;border:1px solid var(--g7);min-width:46px;}
.agc-day{font-size:1.25rem;font-weight:800;color:var(--g2);line-height:1;font-family:var(--fd);}
.agc-mon{font-size:.58rem;font-weight:700;color:var(--g4);text-transform:uppercase;margin-top:1px;}
.agc-inf{flex:1;}
.agc-t{font-size:.84rem;font-weight:600;font-family:var(--fd);}
.agc-m{font-size:.7rem;color:var(--i3);margin-top:3px;}
.agc-n{font-size:.68rem;color:var(--i3);margin-top:4px;line-height:1.4;}
.atch{font-size:.62rem;font-weight:700;padding:2px 7px;border-radius:7px;}
.at-b{background:#dbeafe;color:#1e40af;}.at-c{background:#dcfce7;color:#166534;}.at-k{background:#fef9c3;color:#854d0e;}.at-a{background:var(--w2);color:var(--i3);}

/* DOCS / CR / BIBLIO */
.dcc{background:#fff;border-radius:var(--R);border:1px solid var(--w2);padding:.85rem 1rem;margin-bottom:10px;display:flex;gap:12px;align-items:flex-start;box-shadow:var(--s1);}
.dcc-ico{width:40px;height:40px;border-radius:var(--r);background:var(--g8);border:1px solid var(--g7);display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0;}

/* CR - comptes rendus */
.crc{background:#fff;border-radius:var(--R);border:1px solid var(--w2);padding:.9rem 1.1rem;margin-bottom:10px;box-shadow:var(--s1);cursor:pointer;transition:.15s;}
.crc:hover{box-shadow:var(--s2);}
.crc-head{display:flex;align-items:flex-start;gap:10px;margin-bottom:.5rem;}
.crc-ico{width:38px;height:38px;border-radius:var(--r);display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0;}
.crc-t{font-size:.85rem;font-weight:700;font-family:var(--fd);color:var(--ink);}
.crc-m{font-size:.71rem;color:var(--i3);margin-top:2px;}
.crc-prev{font-size:.73rem;color:var(--i3);line-height:1.45;margin-top:.35rem;}

/* BIBLIOTHÈQUE */
.bib-card{background:#fff;border-radius:var(--R);border:1px solid var(--w2);padding:.85rem 1rem;margin-bottom:8px;display:flex;gap:12px;align-items:flex-start;box-shadow:var(--s1);}
.bib-ico{width:42px;height:42px;border-radius:var(--r);display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0;}
.bib-t{font-size:.84rem;font-weight:700;font-family:var(--fd);color:var(--ink);}
.bib-m{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;align-items:center;}
.bib-tag{font-size:.62rem;font-weight:600;padding:1px 6px;border-radius:5px;background:var(--w2);color:var(--i3);}
.bib-tag.type{background:var(--g8);color:var(--g2);}
.bib-tag.comm{background:#e0e7ff;color:#3730a3;}

/* RÉPERTOIRE ÉLUS */
.rep-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-bottom:14px;}
.rep-c{background:#fff;border-radius:var(--R);border:1px solid var(--w2);padding:.9rem;box-shadow:var(--s1);cursor:pointer;transition:.15s;}
.rep-c:hover{box-shadow:var(--s2);transform:translateY(-1px);}
.rep-c.on{border-color:var(--g4);box-shadow:0 0 0 2px rgba(61,122,90,.15);}
.rep-av{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.88rem;font-weight:700;color:#fff;flex-shrink:0;font-family:var(--fd);}
.rep-n{font-size:.8rem;font-weight:700;font-family:var(--fd);color:var(--ink);}
.rep-r{font-size:.67rem;color:var(--i3);margin-top:2px;}

/* SIGNALEMENTS */
.sig-c{background:#fff;border-radius:var(--R);border:1px solid var(--w2);padding:.9rem 1rem;margin-bottom:10px;box-shadow:var(--s1);cursor:pointer;transition:.15s;}
.sig-c:hover{box-shadow:var(--s2);}
.sig-c.new{border-left:3px solid var(--red);}
.sig-c.enc{border-left:3px solid var(--amber);}
.sig-c.res{border-left:3px solid var(--g4);}

/* ÉVÉNEMENTS */
.ev-c{background:#fff;border-radius:var(--R);border:1px solid var(--w2);padding:.85rem 1rem;margin-bottom:8px;display:flex;gap:14px;align-items:flex-start;box-shadow:var(--s1);}
.ev-c.past{opacity:.45;}
.ev-db{flex-shrink:0;border-radius:var(--r);padding:.4rem .6rem;text-align:center;min-width:46px;}
.ev-day{font-size:1.2rem;font-weight:800;line-height:1;font-family:var(--fd);}
.ev-mon{font-size:.58rem;font-weight:700;text-transform:uppercase;margin-top:1px;}

/* FORMES */
.ff{margin-bottom:.75rem;}
.ff label{display:block;font-size:.67rem;font-weight:700;color:var(--i3);margin-bottom:.3rem;text-transform:uppercase;letter-spacing:.05em;}
.fi{width:100%;padding:8px 10px;border:1.5px solid var(--w2);border-radius:var(--r);font-size:.79rem;color:var(--ink);background:#fff;outline:none;font-family:var(--fn);transition:.15s;}
.fi:focus{border-color:var(--g4);box-shadow:0 0 0 3px rgba(61,122,90,.1);}
textarea.fi{resize:vertical;min-height:90px;}
.fr2{display:grid;grid-template-columns:1fr 1fr;gap:10px;}

/* BOUTONS */
.btn{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:var(--r);font-size:.76rem;font-weight:600;cursor:pointer;border:1.5px solid transparent;font-family:var(--fn);transition:all .15s;text-decoration:none;}
.btn-p{background:var(--or,#c9a227);color:#fff;border-color:var(--or,#c9a227);}.btn-p:hover{background:#b08a1e;}
.btn-s{background:#fff;color:var(--i2);border-color:var(--w2);}.btn-s:hover{background:var(--w);}
.btn-g{background:var(--w);color:var(--g3);border:1px solid var(--w3);}.btn-g:hover{background:var(--g8);color:var(--g2);border-color:var(--g5);}
.btn-d{background:#fee2e2;color:#b91c1c;border-color:#fca5a5;}.btn-d:hover{background:#fca5a5;}
.btn-sm{padding:4px 9px;font-size:.7rem;}
.btn-full{width:100%;justify-content:center;}

/* GUIDES */
.guide{background:#fff;border-radius:var(--R);border:1px solid var(--w2);box-shadow:var(--s1);cursor:pointer;transition:.15s;overflow:hidden;margin-bottom:8px;}
.guide:hover{box-shadow:var(--s2);}
.guide-h{padding:.85rem 1rem;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--w2);}
.guide-ico{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1rem;background:var(--g8);border:1px solid var(--g7);}
.guide-t{font-size:.82rem;font-weight:700;font-family:var(--fd);}
.guide-prev{padding:.75rem 1rem;font-size:.72rem;color:var(--i3);line-height:1.5;}
.guide-full{display:none;border-top:2px solid var(--g8);}
.guide.open .guide-prev{display:none;}.guide.open .guide-full{display:block;}.guide.open{border-color:var(--g7);}

/* RESSOURCES */
.ress-g{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;}
.ress-c{background:#fff;border-radius:var(--R);border:1px solid var(--w2);padding:.85rem;box-shadow:var(--s1);text-decoration:none;display:flex;gap:10px;align-items:flex-start;transition:.15s;}
.ress-c:hover{box-shadow:var(--s2);transform:translateY(-1px);border-color:var(--g6);}
.ress-ico{width:36px;height:36px;border-radius:9px;background:var(--g8);border:1px solid var(--g7);display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0;}
.ress-n{font-size:.78rem;font-weight:700;font-family:var(--fd);color:var(--ink);margin-bottom:3px;}
.ress-d{font-size:.67rem;color:var(--i3);line-height:1.3;}

/* ÉLUS */
.elus-g{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px;}
.elu{background:#fff;border-radius:var(--R);border:1px solid var(--w2);padding:.9rem;box-shadow:var(--s1);display:flex;gap:11px;align-items:flex-start;cursor:pointer;transition:.15s;}
.elu:hover{box-shadow:var(--s2);transform:translateY(-1px);}
.elu-av{width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.88rem;font-weight:700;color:#fff;flex-shrink:0;font-family:var(--fd);}
.elu-n{font-size:.8rem;font-weight:700;font-family:var(--fd);color:var(--ink);}
.elu-r{font-size:.67rem;color:var(--i3);margin-top:2px;}
.elu-d{font-size:.65rem;color:var(--g3);margin-top:3px;font-weight:500;line-height:1.3;}

/* MODALE */
.ov{display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:500;align-items:center;justify-content:center;backdrop-filter:blur(3px);}
.ov.on{display:flex;}
.modal{background:#fff;border-radius:var(--rr);padding:1.5rem;width:min(560px,92vw);max-height:90vh;overflow-y:auto;box-shadow:0 24px 72px rgba(0,0,0,.2);animation:mIn .2s ease;}
.modal-lg{width:min(800px,95vw);}
@keyframes mIn{from{opacity:0;transform:scale(.96)translateY(8px)}to{opacity:1;transform:none}}
.mhd{display:flex;align-items:center;justify-content:space-between;margin-bottom:1.2rem;}
.mhd h3{font-size:.96rem;font-weight:700;font-family:var(--fd);}
.mcl{background:none;border:none;cursor:pointer;color:var(--i3);font-size:1.2rem;border-radius:var(--r);padding:3px 7px;}
.mcl:hover{background:var(--w);}
.mft{display:flex;gap:8px;justify-content:flex-end;margin-top:1.2rem;padding-top:1rem;border-top:1px solid var(--w2);}

/* CHARTS */
.ch-row{display:grid;grid-template-columns:1.6fr 1fr;gap:12px;margin-bottom:14px;}
.ch-c{background:#fff;border-radius:var(--R);border:1px solid var(--w2);box-shadow:var(--s1);padding:1rem;}
.ch-t{font-size:.76rem;font-weight:700;font-family:var(--fd);color:var(--i2);margin-bottom:.7rem;display:flex;align-items:center;gap:6px;}
.ch-t::before{content:"";width:3px;height:12px;background:var(--g4);border-radius:2px;}
.scut{background:#fff;border-radius:var(--R);border:1px solid var(--w2);padding:.85rem .7rem;text-align:center;cursor:pointer;transition:all .18s;box-shadow:var(--s1);}
.scut:hover{box-shadow:var(--s3);transform:translateY(-2px);}
.wg{transition:.18s;}
.wg:hover{box-shadow:0 6px 24px rgba(0,0,0,.1);}
#today-scr{scrollbar-width:thin;scrollbar-color:var(--w3) transparent;}
#today-scr::-webkit-scrollbar{width:4px;}
#today-scr::-webkit-scrollbar-thumb{background:var(--w3);border-radius:2px;}
.ch-w{position:relative;height:180px;}

/* TCHAT */
.chat-panel{position:fixed;top:var(--th);right:0;bottom:0;width:320px;background:#fff;border-left:1px solid var(--w2);box-shadow:-6px 0 24px rgba(0,0,0,.1);z-index:400;display:flex;flex-direction:column;transform:translateX(100%);transition:transform .25s ease;}
.chat-panel.on{transform:none;}
.chat-hd{padding:.75rem 1rem;border-bottom:1px solid var(--w2);display:flex;align-items:center;gap:8px;background:var(--g1);}
.chat-hd-t{font-size:.82rem;font-weight:700;color:#fff;flex:1;font-family:var(--fd);}
.chat-sel{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.18);color:#fff;border-radius:6px;font-size:.69rem;padding:3px 7px;font-family:var(--fn);}
.chat-x{background:none;border:none;color:rgba(255,255,255,.65);font-size:1.1rem;cursor:pointer;}
.chat-msgs{flex:1;overflow-y:auto;padding:.7rem;display:flex;flex-direction:column;gap:8px;background:var(--w);}
.msg-w{display:flex;flex-direction:column;gap:2px;}
.msg-meta{font-size:.59rem;color:var(--i4);padding:0 6px;}
.msg-bub{background:#fff;border-radius:10px 10px 10px 3px;padding:.5rem .7rem;font-size:.75rem;color:var(--ink);box-shadow:var(--s1);max-width:88%;border:1px solid var(--w2);line-height:1.45;}
.msg-w.me .msg-meta{text-align:right;}
.msg-w.me .msg-bub{background:var(--g3);color:#fff;border-radius:10px 10px 3px 10px;border-color:var(--g3);align-self:flex-end;}
.chat-in{padding:.7rem;border-top:1px solid var(--w2);display:flex;gap:7px;background:#fff;}
.chat-in input{flex:1;padding:7px 10px;border:1.5px solid var(--w2);border-radius:var(--r);font-size:.76rem;font-family:var(--fn);outline:none;}
.chat-in input:focus{border-color:var(--g4);}
.chat-send{background:var(--g3);border:none;color:#fff;border-radius:var(--r);padding:7px 11px;cursor:pointer;font-size:.78rem;}

/* NOTIF */
.nt{display:flex;align-items:center;gap:10px;padding:.58rem .8rem;background:#fff;border-radius:var(--r);border:1px solid var(--w2);margin-bottom:6px;font-size:.75rem;box-shadow:var(--s1);}
.nt-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
.nt-type{font-size:.6rem;font-weight:700;padding:1px 6px;border-radius:5px;}
.nt-tp{background:var(--g8);color:var(--g2);}.nt-ta{background:#fef9c3;color:#a16207;}.nt-tc{background:#dbeafe;color:#1d4ed8;}.nt-ts{background:#fee2e2;color:#b91c1c;}.nt-td{background:#e0e7ff;color:#3730a3;}

/* EMPTY */
.empty{text-align:center;padding:3rem 1rem;color:var(--i3);}
.empty-ico{font-size:2.5rem;margin-bottom:.75rem;}
.empty-t{font-size:.88rem;font-weight:600;font-family:var(--fd);margin-bottom:.4rem;}
.empty-s{font-size:.74rem;color:var(--i4);}

/* TOAST */
.tuto-card:hover{transform:translateY(-3px);box-shadow:0 6px 20px rgba(26,58,42,.12) !important;border-color:var(--g5);}
.art-card{transition:all .2s;}.art-card:hover{box-shadow:var(--s2) !important;border-color:var(--g5) !important;}
.toast{position:fixed;bottom:22px;right:22px;background:var(--g1);color:#fff;padding:10px 18px;border-radius:var(--R);font-size:.78rem;font-weight:500;z-index:1000;display:none;box-shadow:var(--s3);border:1px solid rgba(255,255,255,.1);animation:mIn .2s;}

@media(max-width:900px){
  /* Layout adaptatif */
  .ch-row{grid-template-columns:1fr;}
  .cg{grid-template-columns:1fr;}
  .fr2{grid-template-columns:1fr;}
  .kpig{grid-template-columns:repeat(2,1fr);}
  .rep-grid{grid-template-columns:1fr;}
  .elus-g{grid-template-columns:1fr 1fr;}

  /* Sidebar : overlay glissant depuis gauche */
  .sb{
    position:fixed;left:0;top:var(--th);bottom:0;
    width:280px;z-index:300;
    transform:translateX(-100%);
    transition:transform .25s cubic-bezier(.25,.8,.25,1);
  }
  .sb.on{transform:translateX(0);}

  /* Overlay sombre derrière la sidebar */
  .sb-overlay{
    display:none;position:fixed;inset:0;
    background:rgba(0,0,0,.5);z-index:299;
  }
  .sb-overlay.on{display:block;}

  /* Hamburger */
  .hamburger{display:flex;flex-direction:column;gap:4px;width:24px;cursor:pointer;padding:4px;}
  .hamburger span{height:2px;background:#fff;border-radius:2px;transition:.2s;}
  .hamburger.on span:nth-child(1){transform:rotate(45deg) translate(4px,4px);}
  .hamburger.on span:nth-child(2){opacity:0;}
  .hamburger.on span:nth-child(3){transform:rotate(-45deg) translate(4px,-4px);}

  /* Topbar adaptée */
  .top-date{display:none;}

  /* Barre outils bas écran */
  .bottom-tools{
    position:fixed;bottom:0;left:0;right:0;
    background:var(--g1);padding:.5rem .75rem;
    display:flex;gap:6px;z-index:250;
    box-shadow:0 -2px 12px rgba(0,0,0,.3);
    padding-bottom:max(.5rem,env(safe-area-inset-bottom));
  }
  .bt-ic{
    flex:1;min-width:0;height:42px;border-radius:10px;
    background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.15);
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    font-size:.7rem;color:rgba(255,255,255,.7);cursor:pointer;
    transition:all .15s;gap:2px;text-align:center;
  }
  .bt-ic .bt-ico{font-size:1.1rem;}
  .bt-ic.on{background:var(--g4);color:#fff;}
  .bt-ic:active{transform:scale(.95);}

  /* Padding bas pour ne pas cacher le contenu */
  .main{padding-bottom:60px;}

  /* Grille accueil compacte sur mobile */
  #today-scr [style*="grid-template-columns:1fr 1fr 1fr 1fr"]{
    grid-template-columns:1fr 1fr!important;
  }
  #today-scr [style*="grid-template-columns:1fr 1fr 1fr;"]{
    grid-template-columns:1fr 1fr!important;
  }
  #today-scr [style*="grid-template-columns:repeat(4,1fr)"]{
    grid-template-columns:1fr 1fr!important;
  }
  #today-scr [style*="grid-template-columns:220px 1fr 1fr"]{
    grid-template-columns:1fr!important;
  }
}


/* ── GRILLES FIXES DESKTOP ─────────────────────────────────────────────── */
.grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;}
.grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
.grid-2-1{display:grid;grid-template-columns:1.2fr 1fr;gap:12px;}
.grid-3-1{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;align-items:start;}
.grid-tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;}
/* Sur desktop, les grilles restent fixes */
@media(min-width:901px){
  .grid-4{grid-template-columns:repeat(4,1fr)!important;}
  .grid-3{grid-template-columns:repeat(3,1fr)!important;}
  .grid-tiles{grid-template-columns:repeat(4,1fr)!important;}
  .grid-3-1{grid-template-columns:1fr 1fr 1fr!important;}
}
@media(max-width:900px){
  .grid-4{grid-template-columns:1fr 1fr!important;}
  .grid-3{grid-template-columns:1fr!important;}
  .grid-2{grid-template-columns:1fr!important;}
  .grid-2-1{grid-template-columns:1fr!important;}
  .grid-3-1{grid-template-columns:1fr!important;}
  .grid-tiles{grid-template-columns:1fr 1fr!important;}
}

/* Hamburger caché sur desktop */
.hamburger{display:none;}
.bottom-tools{display:none;}
.sb-overlay{display:none;}
</style>
</head>
<body>

<div class="top">
  <div style="display:flex;align-items:center;gap:10px">
    <div class="top-badge">VM</div>
    <div>
      <div class="top-name">Vizille en Mouvement</div>
      <span class="top-sub">Espace élus &#x2014; Mandat 2026&#x2013;2032</span>
    </div>
  </div>
  <button class="hamburger" id="hamburger" onclick="toggleMobileMenu()" aria-label="Menu" style="background:none;border:none;flex-shrink:0;margin-right:4px">
    <span></span><span></span><span></span>
  </button>
  <div class="top-div"></div>
  <span class="top-date" id="tdate">${today}</span>
  <div style="display:flex;align-items:center;gap:8px">
    <button class="tbtn tbtn-v" onclick="openVisio()">&#x1F4F9; Visio</button>
    <button class="tbtn tbtn-c" onclick="toggleChat()">&#x1F4AC; Tchat<span class="cbdg" id="cbdg"></span></button>
    <button onclick="vemLogout()" style="display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:7px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);color:rgba(255,255,255,.8);font-size:.7rem;font-weight:600;cursor:pointer;margin-right:4px" title="Se déconnecter">&#x23FB; Déconnexion</button>
    <div class="top-av" id="top-av-btn" onclick="om('profile')" title="Mon profil">MT</div>
  </div>
</div>

<div class="layout">
<aside class="sb">
  <div onclick="gp('today',this)" style="margin:.75rem .65rem .5rem;padding:.65rem 1rem;background:var(--or);color:#fff;border-radius:10px;font-size:.82rem;font-weight:800;font-family:var(--fd);cursor:pointer;display:flex;align-items:center;gap:8px">&#x1F3E0; <span>Accueil</span></div>
  <div class="sbs">Mon espace</div>
  <div class="sbi" data-panel="tuto" onclick="openPanel('tuto')"><span class="sbi-ic">🎓</span>Guide d'utilisation</div>
  <div class="sbi" data-panel="guide" onclick="openPanel('guide')"><span class="sbi-ic">&#x1F4D6;</span>Guide de l&#x27;élu</div>
  <div class="sbi" data-panel="ress" onclick="openPanel('ress')"><span class="sbi-ic">📰</span>Veille &amp; Articles</div>

  <div class="sbs">Le mandat</div>
  <div class="sbi" data-panel="agenda" onclick="openPanel('agenda')"><span class="sbi-ic">&#x1F4C5;</span>Agenda</div>
  <div class="sbi" data-panel="cr" onclick="openPanel('cr')"><span class="sbi-ic">&#x1F4DD;</span>Comptes rendus</div>
  <div class="sbi" data-panel="biblio" onclick="openPanel('biblio')"><span class="sbi-ic">&#x1F4DA;</span>Biblioth&#xe8;que<span class="sbi-n" id="sb-bib">0</span></div>
  <div class="sbi" data-panel="repelus" onclick="openPanel('repelus')"><span class="sbi-ic">&#x1F4C2;</span>R&#xe9;pertoire élus</div>
  <div class="sbi" data-panel="elus" onclick="openPanel('elus')"><span class="sbi-ic">&#x1F9D1;&#x200D;&#x1F4BC;</span>L&#x27;équipe</div>

  <div class="sbs">Projets du programme</div>
  <div class="sbi" data-panel="comm" onclick="openPanel('comm')"><span class="sbi-ic">&#x1F465;</span>Par commission<span class="sbi-n" id="sb-tot">91</span></div>
  <div class="sbi" data-panel="global" onclick="openPanel('global')"><span class="sbi-ic">&#x1F4CA;</span>Tous les projets</div>
  <div class="sbi" data-panel="creer" onclick="openPanel('creer')"><span class="sbi-ic">&#x2795;</span>Nouveau projet</div>

  <div class="sbs">Terrain</div>
  <div class="sbi" data-panel="signal" onclick="openPanel('signal')"><span class="sbi-ic">&#x1F534;</span>Signalements<span class="sbi-new" id="sb-sig">!</span></div>
  <div class="sbi" data-panel="events" onclick="openPanel('events')"><span class="sbi-ic">&#x1F3AA;</span>Événements</div>

  <div id="sb-audit-section" style="display:none">
  <div class="sbs">Administration</div>
  <div class="sbi" data-panel="audit" onclick="openPanel('audit')"><span class="sbi-ic">📊</span>Avancement mandat</div>
  <div class="sbi" data-panel="connexions" onclick="openPanel('connexions')"><span class="sbi-ic">🔐</span>Connexions</div>
  </div>
  <div class="sbs">Outils</div>
  <div class="sbi" data-panel="comms" onclick="openPanel('comms')"><span class="sbi-ic">&#x270D;&#xFE0F;</span>Rédiger un doc</div>
  <div class="sbi" data-panel="hist" onclick="openPanel('hist')"><span class="sbi-ic">&#x1F514;</span>Historique</div>

  <!-- WIDGET CALENDRIER -->
  <div style="margin:1rem .75rem;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.15)">
    <div id="sb-cal" style="background:linear-gradient(135deg,#c9a227,#d4a928);padding:1rem;text-align:center;color:#fff">
      <div id="sb-cal-jour" style="font-size:.75rem;font-weight:600;text-transform:capitalize;opacity:.85"></div>
      <div id="sb-cal-num" style="font-size:2.2rem;font-weight:900;font-family:Tahoma,Verdana,sans-serif;line-height:1.1"></div>
      <div id="sb-cal-mois" style="font-size:.72rem;font-weight:600;opacity:.8;text-transform:capitalize"></div>
    </div>
    <div style="background:rgba(255,255,255,.08);padding:.5rem;text-align:center">
      <div id="sb-cal-fete" style="font-size:.65rem;color:rgba(255,255,255,.7);font-style:italic"></div>
      <div id="sb-cal-sem" style="font-size:.58rem;color:rgba(255,255,255,.45);margin-top:2px"></div>
    </div>
  </div>

  <div class="sbf"><a href="#" onclick="openPanel('confidentialite');return false;" style="color:var(--i4);text-decoration:none">Confidentialité</a><br>elus.vizilleenmouvement.fr · Node.js · Infomaniak</div>
</aside>

<main class="main">

<!-- AUJOURD'HUI -->
<div class="page on" id="p-today">
  <div class="scr" id="today-scr" style="display:flex;flex-direction:column;gap:14px;padding:1.25rem 1.5rem;">

    <!-- HERO ACCUEIL -->
    <div id="hero-wrap" style="background:linear-gradient(135deg,var(--g1) 0%,var(--g2) 55%,var(--g3) 100%);border-radius:20px;padding:1.4rem 1.8rem;color:#fff;display:flex;align-items:center;gap:1.25rem;position:relative;overflow:hidden;box-shadow:0 6px 28px rgba(15,35,24,.35)">
      <div style="position:absolute;top:-60px;right:-60px;width:220px;height:220px;border-radius:50%;background:rgba(255,255,255,.04)"></div>
      <div id="hero-av" style="width:56px;height:56px;border-radius:15px;background:rgba(255,255,255,.18);border:2px solid rgba(255,255,255,.28);display:flex;align-items:center;justify-content:center;font-size:1.2rem;font-weight:800;font-family:var(--fd);flex-shrink:0;z-index:1">?</div>
      <div style="flex:1;z-index:1">
        <div id="hero-bonjour" style="font-size:1.1rem;font-weight:700;font-family:var(--fd);margin-bottom:.2rem">Bonjour !</div>
        <div id="hero-role" style="font-size:.75rem;opacity:.55;line-height:1.4"></div>
      </div>
      <div style="text-align:right;z-index:1;flex-shrink:0">
        <div id="hero-date-big" style="font-size:2rem;font-weight:800;font-family:var(--fd);line-height:1"></div>
        <div id="hero-mois" style="font-size:.72rem;opacity:.5;margin-top:2px;text-transform:capitalize"></div>
      </div>
      <div id="hero-citation" style="position:absolute;bottom:.75rem;left:calc(56px + 2.8rem);right:1.8rem;font-size:.71rem;opacity:.5;font-style:italic;z-index:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></div>
    </div>

    <!-- LIGNE 1 : Agenda | Tâches | Signalements -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px">


      <!-- WIDGET AGENDA -->
      <div class="wg" style="background:#fff;border-radius:18px;border:1px solid var(--w2);box-shadow:0 2px 12px rgba(0,0,0,.07);overflow:hidden;display:flex;flex-direction:column">
        <div class="wg-h" style="padding:.9rem 1.1rem .7rem;border-bottom:1px solid var(--w2);display:flex;align-items:center;gap:8px">
          <div style="width:32px;height:32px;border-radius:9px;background:var(--g8);display:flex;align-items:center;justify-content:center;font-size:1rem">&#x1F4C5;</div>
          <div style="flex:1">
            <div style="font-size:.8rem;font-weight:700;font-family:var(--fd);color:var(--ink)">Agenda</div>
            <div id="wg-agenda-sub" style="font-size:.63rem;color:var(--i3)">Chargement…</div>
          </div>
          <button class="btn btn-g btn-sm" onclick="om('agenda')" style="font-size:.63rem">+</button>
        </div>
        <div style="padding:.75rem 1rem;flex:1">
          <!-- Onglets 7 jours compacts -->
          <div id="wg-week" style="display:flex;gap:3px;margin-bottom:.75rem;overflow-x:auto"></div>
          <div id="wg-day-events" style="min-height:80px"></div>
        </div>
        <div style="padding:.6rem 1rem;border-top:1px solid var(--w2);display:flex;gap:6px">
          <button class="btn btn-g btn-sm btn-full" onclick="openPanel('agenda')" style="font-size:.68rem">Toutes les réunions →</button>
        </div>
      </div>

      <!-- WIDGET TÂCHES + ANNONCES -->
      <div class="wg" style="background:#fff;border-radius:18px;border:1px solid var(--w2);box-shadow:0 2px 12px rgba(0,0,0,.07);overflow:hidden;display:flex;flex-direction:column">
        <div class="wg-h" style="padding:.9rem 1.1rem .7rem;border-bottom:1px solid var(--w2);display:flex;align-items:center;gap:8px">
          <div style="width:32px;height:32px;border-radius:9px;background:#fef9c3;display:flex;align-items:center;justify-content:center;font-size:1rem">&#x2705;</div>
          <div style="flex:1">
            <div style="font-size:.8rem;font-weight:700;font-family:var(--fd);color:var(--ink)">Mes tâches</div>
            <div id="task-cnt" style="font-size:.63rem;color:var(--i3)"></div>
          </div>
          <button class="btn btn-p btn-sm" onclick="addTaskFocus()" style="font-size:.63rem">+</button>
        </div>
        <div style="padding:.75rem 1rem;flex:1;overflow-y:auto;max-height:180px">
          <div id="task-list"></div>
        </div>
        <div style="padding:.6rem 1rem;border-top:1px solid var(--w2)">
          <div style="display:flex;gap:7px">
            <input class="fi" id="task-inp" placeholder="Nouvelle tâche…" style="flex:1;font-size:.73rem;padding:6px 9px" onkeydown="if(event.key==='Enter')addTask()">
            <button class="btn btn-p btn-sm" onclick="addTask()" style="flex-shrink:0">+</button>
          </div>
        </div>
      </div>

      

      <!-- WIDGET SIGNALEMENTS -->
      <div class="wg" style="background:#fff;border-radius:18px;border:1px solid var(--w2);box-shadow:0 2px 12px rgba(0,0,0,.07);overflow:hidden;display:flex;flex-direction:column">
        <div class="wg-h" style="padding:.9rem 1.1rem .7rem;border-bottom:1px solid var(--w2);display:flex;align-items:center;gap:8px">
          <div style="width:32px;height:32px;border-radius:9px;background:#fee2e2;display:flex;align-items:center;justify-content:center;font-size:1rem">&#x1F534;</div>
          <div style="flex:1">
            <div style="font-size:.8rem;font-weight:700;font-family:var(--fd);color:var(--ink)">Signalements</div>
            <div id="wg-sig-sub" style="font-size:.63rem;color:var(--i3)">Chargement…</div>
          </div>
          <button class="btn btn-p btn-sm" onclick="om('signal')" style="font-size:.63rem;background:#dc2626;border-color:#dc2626">+</button>
        </div>
        <div style="padding:.75rem 1rem;flex:1;overflow-y:auto;max-height:180px" id="wg-sig-list"></div>
        <div style="padding:.6rem 1rem;border-top:1px solid var(--w2)">
          <button class="btn btn-g btn-sm btn-full" onclick="openPanel('signal')" style="font-size:.68rem">Tous les signalements →</button>
        </div>
      </div>

    </div>

<!-- LIGNE 2 : 4 tuiles accès rapide -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px">

      <!-- BIBLIO -->
      <div class="wg-tile" style="background:linear-gradient(135deg,#6d28d9,#8b5cf6);border-radius:16px;padding:1.1rem 1rem;color:#fff;box-shadow:0 4px 16px rgba(109,40,217,.3);cursor:pointer;transition:.2s;display:flex;flex-direction:column;gap:.5rem" onclick="openPanel('biblio')" onmouseover="this.style.transform='translateY(-3px)';this.style.boxShadow='0 8px 24px rgba(109,40,217,.4)'" onmouseout="this.style.transform='none';this.style.boxShadow='0 4px 16px rgba(109,40,217,.3)'">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:36px;height:36px;background:rgba(255,255,255,.2);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1.1rem">&#x1F4DA;</div>
          <div>
            <div style="font-size:.82rem;font-weight:700;font-family:var(--fd)">Bibliothèque</div>
            <div style="font-size:.62rem;opacity:.65">Documents officiels</div>
          </div>
        </div>
        <div id="wg-bib-cnt" style="font-size:.68rem;opacity:.65;line-height:1.4">délibérations, arrêtés, rapports…</div>
      </div>

      <!-- MON DOSSIER -->
      <div class="wg-tile" style="background:linear-gradient(135deg,#92400e,#d97706);border-radius:16px;padding:1.1rem 1rem;color:#fff;box-shadow:0 4px 16px rgba(146,64,14,.3);cursor:pointer;transition:.2s;display:flex;flex-direction:column;gap:.5rem" onclick="openPanel('repelus')" onmouseover="this.style.transform='translateY(-3px)';this.style.boxShadow='0 8px 24px rgba(146,64,14,.4)'" onmouseout="this.style.transform='none';this.style.boxShadow='0 4px 16px rgba(146,64,14,.3)'">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:36px;height:36px;background:rgba(255,255,255,.2);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1.1rem">&#x1F512;</div>
          <div>
            <div style="font-size:.82rem;font-weight:700;font-family:var(--fd)">Mon dossier</div>
            <div style="font-size:.62rem;opacity:.65">Espace privé</div>
          </div>
        </div>
        <div style="font-size:.68rem;opacity:.55;line-height:1.4">Archives personnelles, visible uniquement par vous</div>
      </div>

      <!-- VISIO KMEET -->
      <div class="wg-tile" style="background:linear-gradient(135deg,#065f46,#10b981);border-radius:16px;padding:1.1rem 1rem;color:#fff;box-shadow:0 4px 16px rgba(6,95,70,.3);cursor:pointer;transition:.2s;display:flex;flex-direction:column;gap:.5rem" onclick="openVisio()" onmouseover="this.style.transform='translateY(-3px)';this.style.boxShadow='0 8px 24px rgba(6,95,70,.4)'" onmouseout="this.style.transform='none';this.style.boxShadow='0 4px 16px rgba(6,95,70,.3)'">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:36px;height:36px;background:rgba(255,255,255,.2);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1.1rem">&#x1F4F9;</div>
          <div>
            <div style="font-size:.82rem;font-weight:700;font-family:var(--fd)">kMeet Visio</div>
            <div style="font-size:.62rem;opacity:.65">Lancer une réunion</div>
          </div>
          <div style="margin-left:auto;font-size:.9rem;opacity:.6">&#x2197;</div>
        </div>
        <div style="font-size:.68rem;opacity:.55;line-height:1.4">Visioconférence sécurisée Infomaniak</div>
      </div>
    </div>

    <!-- LIGNE 3 : Annonces | Tchat | CR -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px">

      <!-- WIDGET ANNONCES -->
      <div class="wg" style="background:#fff;border-radius:18px;border:1px solid var(--w2);box-shadow:0 2px 12px rgba(0,0,0,.07);overflow:hidden;display:flex;flex-direction:column">
        <div class="wg-h" style="padding:.85rem 1.1rem .65rem;border-bottom:1px solid var(--w2);display:flex;align-items:center;gap:8px">
          <div style="width:28px;height:28px;border-radius:8px;background:#fef3c7;display:flex;align-items:center;justify-content:center;font-size:.9rem">&#x1F4E2;</div>
          <div style="font-size:.78rem;font-weight:700;font-family:var(--fd);color:var(--ink);flex:1">Annonces</div>
          <button class="btn btn-p btn-sm" onclick="om('annonce')" style="font-size:.62rem">Publier</button>
        </div>
        <div style="padding:.7rem 1rem;flex:1" id="ann-list">
          <div style="font-size:.73rem;color:var(--i4);text-align:center;padding:.75rem 0">Aucune annonce</div>
        </div>
      </div>

      <!-- WIDGET TCHAT -->
      <div class="wg" style="background:#fff;border-radius:18px;border:1px solid var(--w2);box-shadow:0 2px 12px rgba(0,0,0,.07);overflow:hidden;display:flex;flex-direction:column">
        <div class="wg-h" style="padding:.85rem 1.1rem .65rem;border-bottom:1px solid var(--w2);display:flex;align-items:center;gap:8px">
          <div style="width:28px;height:28px;border-radius:8px;background:var(--g2);display:flex;align-items:center;justify-content:center;font-size:.9rem">&#x1F4AC;</div>
          <div style="font-size:.78rem;font-weight:700;font-family:var(--fd);color:var(--ink);flex:1">Tchat de l&#x27;équipe</div>
          <select id="wg-chat-ch" onchange="wgSwitchCh()" style="font-size:.65rem;padding:2px 6px;border:1px solid var(--w2);border-radius:6px;background:#fff;color:var(--i2);font-family:var(--fn)">
            <option value="general">&#x1F4AC; Général</option>
            <option value="bureau">&#x1F3DB; Bureau</option>
            <option value="culture">&#x1F3AD; Culture</option>
            <option value="mobilites">&#x1F6B2; Mobilités</option>
            <option value="ecologie">&#x1F33F; Écologie</option>
            <option value="social">&#x1F91D; Social</option>
            <option value="enfance">&#x1F466; Enfance</option>
            <option value="tranquillite">&#x1F6E1; Tranquillité</option>
            <option value="travaux">&#x1F3D7; Travaux</option>
          </select>
          <div id="wg-chat-badge" style="width:8px;height:8px;border-radius:50%;background:var(--red);display:none;flex-shrink:0"></div>
          <button onclick="wgResetChat('wg-chat-ch')" title="Archiver ce canal" style="background:none;border:none;cursor:pointer;font-size:.8rem;color:var(--i4);padding:0 2px" title="Archiver">📦</button>
        </div>
        <div id="wg-chat-msgs" style="flex:1;overflow-y:auto;padding:.65rem .9rem;display:flex;flex-direction:column;gap:6px;background:var(--w);min-height:140px;max-height:220px"></div>
        <div style="padding:.6rem .9rem;border-top:1px solid var(--w2);display:flex;gap:7px;background:#fff">
          <input id="wg-chat-inp" class="fi" placeholder="Message&#x2026;" style="flex:1;font-size:.74rem;padding:6px 9px" onkeydown="if(event.key==='Enter')wgSendMsg()">
          <button class="btn btn-p btn-sm" onclick="wgSendMsg()" style="flex-shrink:0;background:var(--g2);border-color:var(--g2)">&#x2192;</button>
        </div>
      </div>

      <!-- WIDGET DERNIERS CR -->
      <div class="wg" style="background:#fff;border-radius:18px;border:1px solid var(--w2);box-shadow:0 2px 12px rgba(0,0,0,.07);overflow:hidden;display:flex;flex-direction:column">
        <div class="wg-h" style="padding:.85rem 1.1rem .65rem;border-bottom:1px solid var(--w2);display:flex;align-items:center;gap:8px">
          <div style="width:28px;height:28px;border-radius:8px;background:var(--g8);display:flex;align-items:center;justify-content:center;font-size:.9rem">&#x1F4DD;</div>
          <div style="font-size:.78rem;font-weight:700;font-family:var(--fd);color:var(--ink);flex:1">Comptes rendus</div>
          <button class="btn btn-g btn-sm" onclick="openPanel('cr')" style="font-size:.62rem">Tous →</button>
        </div>
        <div style="padding:.7rem 1rem;flex:1" id="cr-home-list">
          <div style="font-size:.73rem;color:var(--i4);text-align:center;padding:.75rem 0">Aucun CR</div>
        </div>
        <div style="padding:.6rem 1rem;border-top:1px solid var(--w2)">
          <button class="btn btn-p btn-sm btn-full" onclick="om('cr')" style="font-size:.68rem">+ Nouveau CR</button>
        </div>
      </div>

    </div>


    </div><!-- /today-scr -->
  </div>
</div>

<!-- GUIDE + RESSOURCES -->
<div class="page" id="p-tuto">
  <div class="ph">
    <div class="ph-ico" style="background:#ede9fe">🎓</div>
    <div>
      <div class="ph-t">Guide d'utilisation</div>
      <div class="ph-s">Cliquez sur une carte pour voir les instructions détaillées</div>
    </div>
  </div>
  <div class="scr" style="padding:1.25rem 1.5rem">

    <div style="background:linear-gradient(135deg,#1a3a2a,#2d5a40);border-radius:14px;padding:1.25rem 1.5rem;color:#fff;margin-bottom:1.5rem">
      <div style="font-size:1rem;font-weight:700;margin-bottom:.4rem">🌿 Bienvenue dans l'espace élus Vizille en Mouvement</div>
      <div style="font-size:.78rem;opacity:.85;line-height:1.7">Cet espace est votre outil de travail pour le mandat 2026–2032. Chaque section est expliquée ci-dessous — cliquez sur une carte pour en savoir plus.</div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px" id="tuto-cards"></div>

  </div>
</div>

<div class="page" id="p-guide">
  <div class="ph">
    <div class="ph-ico" style="background:#fef9c3">&#x1F4D6;</div>
    <div>
      <div class="ph-t">Guide &amp; Ressources de l&#x27;élu</div>
      <div class="ph-s">Fiches pratiques du mandat · Liens utiles</div>
    </div>
  </div>
  <div class="scr">
    <div style="font-size:.7rem;font-weight:700;color:var(--i3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:.75rem">&#x1F4CB; Fiches pratiques</div>
    <div id="guides-list" style="margin-bottom:1.75rem"></div>
    <div style="font-size:.7rem;font-weight:700;color:var(--i3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:.75rem">&#x1F517; Liens utiles</div>
    <div id="ress-list" class="ress-g"></div>
  </div>
</div>

<!-- RESSOURCES (alias vers guide) -->
<div class="page" id="p-ress">
  <div class="ph">
    <div class="ph-ico" style="background:#fef3c7">📰</div>
    <div><div class="ph-t">Veille &amp; Articles</div><div class="ph-s">Articles utiles pour les élus</div></div>
    <div class="ph-a"><button class="btn btn-p btn-sm" onclick="om('article')">+ Publier un article</button></div>
  </div>
  <div class="scr" style="padding:1.25rem 1.5rem">
    <div id="articles-list"></div>
    <div style="margin-top:1.5rem;padding-top:1rem;border-top:1px solid var(--w2)">
      <div style="font-size:.72rem;font-weight:700;color:var(--i3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:.75rem">&#x1F517; Liens permanents</div>
      <div id="ress-list-2" class="ress-g"></div>
    </div>
  </div>
</div>

<!-- Modal ajout article -->
<div class="ov" id="ov-article">
  <div class="modal">
    <div style="font-size:.9rem;font-weight:700;color:var(--ink);margin-bottom:1rem;font-family:var(--fd)">📰 Publier un article</div>
    <div class="ff"><label>Titre *</label><input class="fi" id="art-titre" placeholder="Titre de l'article"></div>
    <div class="ff"><label>URL du lien *</label><input class="fi" id="art-url" placeholder="https://..."></div>
    <div class="fr2">
      <div class="ff"><label>Source</label><input class="fi" id="art-source" placeholder="Le Monde, AMF, Maire-Info..."></div>
      <div class="ff"><label>Tags</label><input class="fi" id="art-tags" placeholder="budget, urbanisme..."></div>
    </div>
    <div class="ff"><label>Résumé</label><textarea class="fi" id="art-resume" placeholder="En quelques lignes, de quoi parle cet article..." rows="3"></textarea></div>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button class="btn btn-s" onclick="cm()">Annuler</button>
      <button class="btn btn-p" onclick="saveArticle()">Publier</button>
    </div>
  </div>
</div>



<!-- AGENDA -->
<div class="page" id="p-agenda">
  <div class="ph"><div class="ph-ico" style="background:#dbeafe">&#x1F4C5;</div><div><div class="ph-t">Agenda des r&#xe9;unions</div><div class="ph-s">Bureau &#x2022; Commissions &#x2022; Conseil municipal</div></div><div class="ph-a"><button class="btn btn-p btn-sm" onclick="om('agenda')">+ Ajouter</button></div></div>
  <div class="scr"><div id="ag-list"></div></div>
</div>

<!-- COMPTES RENDUS -->
<div class="page" id="p-cr">
  <div class="ph"><div class="ph-ico" style="background:var(--g8)">&#x1F4DD;</div><div><div class="ph-t">Comptes rendus de r&#xe9;unions</div><div class="ph-s">CR de commissions, bureau municipal, conseil</div></div>
    <div class="ph-a">
      <select class="fsel" id="cr-filt-comm" onchange="renderCR()"><option value="">Toutes commissions</option></select>
      <button class="btn btn-p btn-sm" onclick="om('cr')">+ Nouveau CR</button>
    </div>
  </div>
  <div class="scr"><div id="cr-list"></div></div>
</div>

<!-- BIBLIOTHÈQUE -->
<div class="page" id="p-biblio">
  <div class="ph"><div class="ph-ico" style="background:var(--g8)">&#x1F4DA;</div><div><div class="ph-t">Biblioth&#xe8;que documentaire</div><div class="ph-s">Classement par dossier, type, commission</div></div>
    <div class="ph-a"><button class="btn btn-p btn-sm" onclick="om('biblio')">+ Ajouter</button></div>
  </div>
  <div style="display:flex;height:calc(100% - 70px)">
    <!-- Sidebar dossiers -->
    <div style="width:190px;flex-shrink:0;border-right:1px solid var(--w2);padding:.75rem .5rem;overflow-y:auto;background:var(--g8)" id="bib-dossiers"></div>
    <!-- Contenu -->
    <div style="flex:1;overflow-y:auto">
      <div style="padding:.6rem 1rem .4rem;border-bottom:1px solid var(--w2)">
        <div style="display:flex;gap:6px;margin-bottom:.5rem;align-items:center">
          <input class="fsrch" id="bib-q" placeholder="&#x1F50D;  Rechercher&#x2026;" oninput="renderBiblio()" style="flex:1;font-size:.79rem">
          <span class="fcnt" id="bib-cnt" style="white-space:nowrap"></span>
        </div>
        <div id="bib-type-bar" style="display:flex;gap:5px;flex-wrap:wrap"></div>
      </div>
      <div style="padding:.5rem 1rem 1rem" id="bib-list"></div>
    </div>
  </div>
</div>

<!-- AVANCEMENT MANDAT -->
<div class="page" id="p-audit">
  <div class="ph"><div class="ph-ico" style="background:var(--g8)">📊</div><div><div class="ph-t">Avancement du mandat</div><div class="ph-s">Suivi des projets par commission</div></div><div class="ph-a"><button class="btn btn-s btn-sm" onclick="renderAudit()">🔄 Actualiser</button></div></div>
  <div class="scr" id="audit-body" style="padding:1.25rem 1.5rem"></div>
</div>

<!-- CONNEXIONS ADMIN -->
<div class="page" id="p-connexions">
  <div class="ph"><div class="ph-ico" style="background:#eff6ff">🔐</div><div><div class="ph-t">Journaux de connexion</div><div class="ph-s">Historique des accès</div></div><div class="ph-a"><button class="btn btn-s btn-sm" onclick="renderConnexions()">🔄 Actualiser</button></div></div>
  <div class="scr" id="connexions-body" style="padding:1.25rem 1.5rem"></div>
</div>

<!-- POLITIQUE DE CONFIDENTIALITÉ -->
<div class="page" id="p-confidentialite">
  <div class="ph"><div class="ph-ico" style="background:#e0f2fe">🔒</div><div><div class="ph-t">Politique de confidentialité</div><div class="ph-s">Conformité RGPD — Espace élus Vizille en Mouvement</div></div></div>
  <div class="scr" style="padding:1.25rem 1.5rem;display:flex;flex-direction:column;gap:1rem">
    <div style="background:var(--g8);border-radius:12px;padding:1rem 1.25rem"><div style="font-size:.82rem;font-weight:700;margin-bottom:.4rem">Responsable du traitement</div><div style="font-size:.78rem;color:var(--i2);line-height:1.6">Commune de Vizille — Place du Château, 38220 Vizille<br>Représentée par Catherine Troton, Maire<br>Contact : mairie@ville-vizille.fr · 04 76 78 06 00</div></div>
    <div style="background:var(--g8);border-radius:12px;padding:1rem 1.25rem"><div style="font-size:.82rem;font-weight:700;margin-bottom:.4rem">Données collectées</div><div style="font-size:.78rem;color:var(--i2);line-height:1.6">Identité (nom, initiales, email pro), rôle municipal, activité (connexions, documents, projets, messages), journalisation de sécurité 90 jours. Aucune donnée sensible au sens RGPD.</div></div>
    <div style="background:var(--g8);border-radius:12px;padding:1rem 1.25rem"><div style="font-size:.82rem;font-weight:700;margin-bottom:.4rem">Base légale</div><div style="font-size:.78rem;color:var(--i2);line-height:1.6">Mission d'intérêt public (art. 6.1.e RGPD) — mandat municipal 2026-2032.</div></div>
    <div style="background:var(--g8);border-radius:12px;padding:1rem 1.25rem"><div style="font-size:.82rem;font-weight:700;margin-bottom:.4rem">Hébergement et sécurité</div><div style="font-size:.78rem;color:var(--i2);line-height:1.6">Infomaniak Network SA (Genève, Suisse) — ISO 27001. Accès par authentification individuelle et TLS. Aucun cookie publicitaire, aucun tracker, aucune transmission à des tiers.</div></div>
    <div style="background:var(--g8);border-radius:12px;padding:1rem 1.25rem"><div style="font-size:.82rem;font-weight:700;margin-bottom:.4rem">Conservation</div><div style="font-size:.78rem;color:var(--i2);line-height:1.6">Données de compte : durée du mandat (jusqu'au 31 mars 2032). Journaux de connexion : 90 jours. Documents et projets : archivés à l'issue du mandat.</div></div>
    <div style="background:var(--g8);border-radius:12px;padding:1rem 1.25rem"><div style="font-size:.82rem;font-weight:700;margin-bottom:.4rem">Vos droits (RGPD)</div><div style="font-size:.78rem;color:var(--i2);line-height:1.6">Accès, rectification, effacement, opposition — contact : mairie@ville-vizille.fr<br>Réclamation : CNIL — cnil.fr</div></div>
    <div style="font-size:.68rem;color:var(--i4);text-align:center;padding:.5rem">Mise à jour : mars 2026 · Responsable technique : Michel Thuillier</div>
  </div>
</div>

<!-- RÉPERTOIRE ÉLUS -->
<div class="page" id="p-repelus">
  <div class="ph"><div class="ph-ico" style="background:var(--g8)">&#x1F4C2;</div><div><div class="ph-t">Mon r&#xe9;pertoire personnel</div><div class="ph-s">Vos documents priv&#xe9;s &#x2014; visibles uniquement par vous</div></div><div class="ph-a"><button class="btn btn-p btn-sm" onclick="om(&#x27;repelu&#x27;)">+ Ajouter</button></div></div>
  <div class="scr">
    <div id="rep-elus-grid"></div>
    <div id="rep-elus-files">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:1rem;padding:.85rem 1rem;background:var(--g8);border-radius:var(--R);border:1px solid var(--g7);box-shadow:var(--s1)">
        <div id="rep-elu-av" class="rep-av" style="width:40px;height:40px;font-size:.88rem;flex-shrink:0;background:var(--g3)">?</div>
        <div style="flex:1"><div id="rep-elu-name" style="font-size:.86rem;font-weight:700;font-family:var(--fd);color:var(--ink)">Chargement...</div><div id="rep-elu-role" style="font-size:.7rem;color:var(--g3);margin-top:2px"></div></div>
        <div style="background:var(--g3);color:#fff;font-size:.65rem;font-weight:700;padding:3px 9px;border-radius:8px">&#x1F512; Espace priv&#xe9;</div>
      </div>
      <div style="background:#fff;border-radius:var(--r);border:1px solid var(--w2);padding:.65rem 1rem;margin-bottom:1rem;font-size:.74rem;color:var(--i3)">
        &#x26A0;&#xFE0F; Ces documents sont <strong>strictement priv&#xe9;s</strong>. Aucun autre &#xe9;lu ni l&#x27;administrateur ne peut y acc&#xe9;der. Seul vous y avez acc&#xe8;s avec vos identifiants.
      </div>
      <div id="rep-elu-list"></div>
    </div>
  </div>
</div>

<!-- ÉLUS -->
<div class="page" id="p-elus">
  <div class="ph"><div class="ph-ico" style="background:var(--g8)">&#x1F9D1;&#x200D;&#x1F4BC;</div><div><div class="ph-t">L&#x27;équipe &#x2014; 29 conseillers</div><div class="ph-s">D&#xe9;l&#xe9;gations et contacts</div></div></div>
  <div class="scr"><div class="elus-g" id="elus-list"></div></div>
</div>

<!-- PAR COMMISSION -->
<div class="page" id="p-comm">
  <div class="ph"><div class="ph-ico" style="background:var(--g8)">&#x1F465;</div><div><div class="ph-t">Par commission</div><div class="ph-s">Cliquez pour acc&#xe9;der &#xe0; la page d&#xe9;di&#xe9;e</div></div><div class="ph-a"><button class="btn btn-s btn-sm" onclick="goGlobal()">&#x1F4CA; Vue globale</button></div></div>
  <div class="scr"><div class="cg" id="cg"></div></div>
</div>

<!-- DÉTAIL COMMISSION -->
<div class="page" id="p-cdet">
  <div class="ph"><div class="ph-ico" style="background:var(--g8)" id="cdet-ico">&#x1F4CB;</div><div><div class="ph-t" id="cdet-t">Commission</div><div class="ph-s" id="cdet-s"></div></div><div class="ph-a"><button class="btn btn-s btn-sm" onclick="goComm()">&#x2190; Commissions</button></div></div>
  <div class="scr" style="padding:0">
    <div style="padding:.85rem 1.4rem;background:#fff;border-bottom:1px solid var(--w2);display:flex;gap:10px;flex-wrap:wrap" id="cdet-kpis"></div>
    <div class="fb">
      <select class="fsel" id="cd-st" onchange="fCD()"><option value="">Tous statuts</option></select>
      <input class="fsrch" id="cd-q" placeholder="&#x1F50D;  Rechercher&#x2026;" oninput="fCD()">
      <span class="fcnt" id="cd-cnt"></span>
    </div>
    <div class="tbw" style="border-radius:0;border-left:none;border-right:none;border-bottom:none">
      <table><thead><tr><th>Th&#xe8;me</th><th>Projet</th><th>Statut</th><th>Ann&#xe9;e</th><th>Imp.</th><th>Modifier</th></tr></thead>
      <tbody id="cd-tb"></tbody></table>
    </div>
  </div>
</div>

<!-- TOUS LES PROJETS -->
<div class="page" id="p-global">
  <div class="ph"><div class="ph-ico" style="background:#e0e7ff">&#x1F4CA;</div><div><div class="ph-t">Tous les projets du mandat</div><div class="ph-s">91 projets &#x2022; filtres et mise &#xe0; jour de statut</div></div><div class="ph-a"><button class="btn btn-s btn-sm" onclick="goComm()">&#x1F465; Par commission</button></div></div>
  <div class="scr" style="padding:0">
    <div class="fb">
      <select class="fsel" id="fC" onchange="fG()"><option value="">Toutes commissions</option></select>
      <select class="fsel" id="fT" onchange="fG()"><option value="">Tous th&#xe8;mes</option></select>
      <select class="fsel" id="fS" onchange="fG()"><option value="">Tous statuts</option></select>
      <select class="fsel" id="fA" onchange="fG()"><option value="">Toutes ann&#xe9;es</option></select>
      <input class="fsrch" id="fQ" placeholder="&#x1F50D;  Rechercher un projet&#x2026;" oninput="fG()">
      <span class="fcnt" id="fCnt"></span>
    </div>
    <div class="tbw" style="border-radius:0;border-left:none;border-right:none;border-bottom:none">
      <table><thead><tr><th>Commission</th><th>Projet</th><th>Statut</th><th>Ann&#xe9;e</th><th>Imp.</th><th>Modifier</th></tr></thead>
      <tbody id="g-tb"></tbody></table>
    </div>
  </div>
</div>

<!-- NOUVEAU PROJET -->
<div class="page" id="p-creer">
  <div class="ph"><div class="ph-ico" style="background:var(--g8)">&#x2795;</div><div><div class="ph-t">Nouveau projet</div><div class="ph-s">Ajouter un projet hors programme initial</div></div></div>
  <div class="scr">
    <div class="card" style="max-width:580px">
      <div class="fr2">
        <div class="ff" style="grid-column:1/-1"><label>Titre *</label><input class="fi" id="np-t" placeholder="Intitul&#xe9; complet du projet"></div>
        <div class="ff"><label>Th&#xe8;me / Commission</label>
          <select class="fi" id="np-th"><option value="">-- Choisir --</option>
          <option>Mobilit&#xe9;s</option><option>Tranquillit&#xe9; publique</option><option>Enfance/Jeunesse</option>
          <option>Travaux</option><option>Transition &#xe9;cologique</option><option>Urbanisme</option>
          <option>Culture</option><option>Patrimoine</option><option>Action sociale</option>
          <option>Animations de proximit&#xe9;</option><option>Concertation citoyenne</option>
          <option>Économie</option><option>Sant&#xe9;</option><option>Jumelages</option><option>M&#xe9;tropole</option>
          </select>
        </div>
        <div class="ff"><label>Statut initial</label>
          <select class="fi" id="np-s"><option>Programm&#xe9;</option><option>Prioritaire</option><option>Planifi&#xe9;</option><option>En cours</option><option>&#xc9;tude</option></select>
        </div>
        <div class="ff"><label>Ann&#xe9;e pr&#xe9;vue</label><input class="fi" id="np-a" placeholder="2026, 2027&#x2026;"></div>
        <div class="ff"><label>Importance</label>
          <select class="fi" id="np-i"><option value="1">&#x2605; Faible</option><option value="2">&#x2605;&#x2605; Normale</option><option value="3" selected>&#x2605;&#x2605;&#x2605; Haute</option></select>
        </div>
        <div class="ff" style="grid-column:1/-1"><label>R&#xe9;sum&#xe9; *</label><input class="fi" id="np-r" placeholder="Description en une ligne"></div>
        <div class="ff" style="grid-column:1/-1"><label>Description</label><textarea class="fi" id="np-d"></textarea></div>
        <div class="ff" style="grid-column:1/-1"><label>Tags</label><input class="fi" id="np-tags" placeholder="Seniors, Accessibilit&#xe9;&#x2026;"></div>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-g" onclick="resetNP()">R&#xe9;initialiser</button>
        <button class="btn btn-p" onclick="createP()">&#x2713; Cr&#xe9;er</button>
      </div>
      <div id="np-res" style="margin-top:.85rem"></div>
    </div>
  </div>
</div>

<!-- SIGNALEMENTS -->
<div class="page" id="p-signal">
  <div class="ph"><div class="ph-ico" style="background:#fee2e2">&#x1F534;</div><div><div class="ph-t">Signalements &#x26; incidents</div><div class="ph-s">Main courante terrain &#x2014; tout le monde voit tout</div></div><div class="ph-a"><button class="btn btn-p btn-sm" onclick="om('signal')">+ Signaler</button></div></div>
  <div class="scr" style="padding:0">
    <div style="display:flex;gap:10px;padding:.85rem 1.4rem;background:#fff;border-bottom:1px solid var(--w2);flex-wrap:wrap">
      <div class="kpi" style="flex:1;min-width:90px"><div class="kpiv" id="sk-tot" style="font-size:1.4rem">0</div><div class="kpil">Total</div></div>
      <div class="kpi" style="flex:1;min-width:90px"><div class="kpiv" id="sk-new" style="color:var(--red);font-size:1.4rem">0</div><div class="kpil">Nouveaux</div></div>
      <div class="kpi" style="flex:1;min-width:90px"><div class="kpiv" id="sk-ec" style="color:var(--amber);font-size:1.4rem">0</div><div class="kpil">En cours</div></div>
      <div class="kpi" style="flex:1;min-width:90px"><div class="kpiv" id="sk-re" style="color:var(--g4);font-size:1.4rem">0</div><div class="kpil">R&#xe9;solus</div></div>
    </div>
    <div class="fb">
      <select class="fsel" id="sf-type" onchange="fSig()"><option value="">Tous types</option>
        <option>Voirie</option><option>&#xc9;clairage</option><option>Propret&#xe9;</option>
        <option>Espace vert</option><option>S&#xe9;curit&#xe9;</option><option>B&#xe2;timent</option><option>Autre</option>
      </select>
      <select class="fsel" id="sf-st" onchange="fSig()"><option value="">Tous statuts</option>
        <option>Nouveau</option><option>En cours</option><option>R&#xe9;solu</option><option>Non retenu</option>
      </select>
      <input class="fsrch" id="sf-q" placeholder="&#x1F50D;  Lieu, description&#x2026;" oninput="fSig()">
      <span class="fcnt" id="sf-cnt"></span>
    </div>
    <div style="padding:1rem 1.4rem" id="sig-list"></div>
  </div>
</div>

<!-- ÉVÉNEMENTS -->
<div class="page" id="p-events">
  <div class="ph"><div class="ph-ico" style="background:#fef3c7">&#x1F3AA;</div><div><div class="ph-t">Événements &#xe0; Vizille</div><div class="ph-s">Agenda des manifestations locales</div></div><div class="ph-a"><button class="btn btn-p btn-sm" onclick="om('event')">+ Ajouter</button></div></div>
  <div class="scr"><div id="ev-list"></div></div>
</div>

<!-- RÉDIGER -->
<div class="page" id="p-comms">
  <div class="ph"><div class="ph-ico" style="background:#f3e8ff">&#x270D;&#xFE0F;</div><div><div class="ph-t">R&#xe9;diger un document</div><div class="ph-s">Assist&#xe9; par Claude AI</div></div></div>
  <div class="scr">
    <div style="display:grid;grid-template-columns:1fr 1.3fr;gap:14px;align-items:start">
      <div class="card">
        <div class="ff"><label>Type de document</label>
          <select class="fi" id="ct">
            <option value="arrete">Arr&#xea;t&#xe9; municipal</option>
            <option value="deliberation">D&#xe9;lib&#xe9;ration du conseil</option>
            <option value="cr">Compte-rendu de r&#xe9;union</option>
            <option value="question">Question orale au conseil</option>
            <option value="courrier">Courrier officiel</option>
            <option value="facebook">Post Facebook</option>
            <option value="communique">Communiqu&#xe9; de presse</option>
            <option value="convocation">Convocation au conseil</option>
            <option value="discours">Discours / Allocution</option>
          </select>
        </div>
        <div class="ff"><label>Sujet / Instructions</label>
          <textarea class="fi" id="cs" style="height:130px" placeholder="D&#xe9;crivez pr&#xe9;cis&#xe9;ment le contenu souhait&#xe9;&#x2026;"></textarea>
        </div>
        <div class="ff"><label>Contexte</label><input class="fi" id="cc" placeholder="Commission, date, participants&#x2026;"></div>
        <button class="btn btn-p btn-full" onclick="genC()">&#x2728; G&#xe9;n&#xe9;rer avec Claude</button>
        <div id="c-st" style="font-size:.7rem;color:var(--i3);text-align:center;margin-top:.55rem;min-height:1rem"></div>
      </div>
      <div class="card" style="display:flex;flex-direction:column">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem;padding-bottom:.65rem;border-bottom:1px solid var(--w2)">
          <span style="font-size:.8rem;font-weight:700;font-family:var(--fd);color:var(--i2)">Document g&#xe9;n&#xe9;r&#xe9;</span>
          <div style="display:flex;gap:6px">
            <button class="btn btn-g btn-sm" onclick="copyC()">&#x1F4CB; Copier</button>
            <button class="btn btn-s btn-sm" onclick="saveCR()">&#x1F4BE; Sauver en CR</button>
          </div>
        </div>
        <textarea class="fi" id="cr-gen" style="flex:1;min-height:400px;font-size:.76rem;line-height:1.7;background:var(--w);border-color:transparent;resize:none" placeholder="Le document appara&#xee;tra ici&#x2026;"></textarea>
      </div>
    </div>
  </div>
</div>

<!-- BUDGET -->
<div class="page" id="p-budget">
  <div class="ph">
    <div class="ph-ico" style="background:#dcfce7">&#x1F4C8;</div>
    <div><div class="ph-t">Budget municipal</div><div class="ph-s">Vizille 2025&#x2013;2027 &#x2014; Suivi des cr&#xe9;dits</div></div>
    <div class="ph-a"><label class="btn btn-p btn-sm" style="cursor:pointer">&#x1F4C2; Importer CSV<input type="file" id="bf" accept=".csv" style="display:none" onchange="impB(this)"></label></div>
  </div>
  <div class="scr">

    <!-- KPI BUDGET -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px">
      <div class="kpi" style="border-top:3px solid var(--g4)">
        <div class="kpiv" style="color:var(--g2)" id="bkpi-fonc">8,5 M&#x20ac;</div>
        <div class="kpil">Budget fonctionnement</div>
      </div>
      <div class="kpi" style="border-top:3px solid var(--blue)">
        <div class="kpiv" style="color:var(--blue)" id="bkpi-inv">2,8 M&#x20ac;</div>
        <div class="kpil">Budget investissement</div>
      </div>
      <div class="kpi" style="border-top:3px solid var(--amber)">
        <div class="kpiv" style="color:var(--amber)" id="bkpi-sub">640 k&#x20ac;</div>
        <div class="kpil">Subventions attendues</div>
      </div>
      <div class="kpi" style="border-top:3px solid var(--g5)">
        <div class="kpiv" style="color:var(--g4)" id="bkpi-pct">87%</div>
        <div class="kpil">Budget 2026 allou&#xe9;</div>
      </div>
    </div>

    <!-- GRAPHIQUE + TABLEAU COMPARATIF -->
    <div class="ch-row" style="margin-bottom:14px">
      <div class="ch-c" style="flex:1.5">
        <div class="ch-t">&#xc9;volution budg&#xe9;taire Vizille (k&#x20ac;)</div>
        <div class="ch-w"><canvas id="budgetChart"></canvas></div>
      </div>
      <div class="ch-c" style="flex:1">
        <div class="ch-t">D&#xe9;viation Pr&#xe9;vision / R&#xe9;el</div>
        <div style="padding:.75rem 0">
          <table style="width:100%;font-size:.75rem;border-collapse:collapse">
            <thead>
              <tr style="border-bottom:2px solid var(--w2)">
                <th style="text-align:left;padding:.4rem .5rem;color:var(--i3);font-weight:600">Poste</th>
                <th style="text-align:right;padding:.4rem .5rem;color:var(--i3);font-weight:600">2025 r&#xe9;el</th>
                <th style="text-align:right;padding:.4rem .5rem;color:var(--i3);font-weight:600">2026 pr&#xe9;v.</th>
                <th style="text-align:right;padding:.4rem .5rem;color:var(--i3);font-weight:600">&#xc9;cart</th>
              </tr>
            </thead>
            <tbody id="bdev-table">
              <tr style="border-bottom:1px solid var(--w2)">
                <td style="padding:.4rem .5rem;color:var(--ink)">Fonctionnement</td>
                <td style="text-align:right;padding:.4rem .5rem;font-family:var(--fm);color:var(--i2)">8 240 k&#x20ac;</td>
                <td style="text-align:right;padding:.4rem .5rem;font-family:var(--fm);color:var(--i2)">8 500 k&#x20ac;</td>
                <td style="text-align:right;padding:.4rem .5rem;font-weight:700;color:var(--red)">+2,4%</td>
              </tr>
              <tr style="border-bottom:1px solid var(--w2)">
                <td style="padding:.4rem .5rem;color:var(--ink)">Investissement</td>
                <td style="text-align:right;padding:.4rem .5rem;font-family:var(--fm);color:var(--i2)">2 850 k&#x20ac;</td>
                <td style="text-align:right;padding:.4rem .5rem;font-family:var(--fm);color:var(--i2)">2 800 k&#x20ac;</td>
                <td style="text-align:right;padding:.4rem .5rem;font-weight:700;color:var(--g4)">-1,8%</td>
              </tr>
              <tr style="border-bottom:1px solid var(--w2)">
                <td style="padding:.4rem .5rem;color:var(--ink)">Subventions per&#xe7;ues</td>
                <td style="text-align:right;padding:.4rem .5rem;font-family:var(--fm);color:var(--i2)">528 k&#x20ac;</td>
                <td style="text-align:right;padding:.4rem .5rem;font-family:var(--fm);color:var(--i2)">640 k&#x20ac;</td>
                <td style="text-align:right;padding:.4rem .5rem;font-weight:700;color:var(--g4)">+21%</td>
              </tr>
              <tr>
                <td style="padding:.4rem .5rem;color:var(--ink)">DGF &#xc9;tat</td>
                <td style="text-align:right;padding:.4rem .5rem;font-family:var(--fm);color:var(--i2)">1 120 k&#x20ac;</td>
                <td style="text-align:right;padding:.4rem .5rem;font-family:var(--fm);color:var(--i2)">1 108 k&#x20ac;</td>
                <td style="text-align:right;padding:.4rem .5rem;font-weight:700;color:var(--red)">-1,1%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- TABLEAU IMPORT CSV -->
    <div class="card" style="margin-bottom:14px">
      <div style="font-size:.72rem;color:var(--i3);padding:.5rem 0 .75rem;margin-bottom:.5rem;border-bottom:1px solid var(--w2)">
        Import CSV personnalis&#xe9; — format : <code style="background:var(--w);padding:1px 7px;border-radius:4px;font-family:var(--fm)">Poste,Budget2025,Budget2026,Prevision2027</code>
      </div>
      <div id="btable"></div>
    </div>

  </div>
</div>

<!-- HISTORIQUE -->
<div class="page" id="p-hist">
  <div class="ph"><div class="ph-ico" style="background:#fef9c3">&#x1F514;</div><div><div class="ph-t">Historique des activit&#xe9;s</div><div class="ph-s">Modifications, signalements, documents ajout&#xe9;s</div></div></div>
  <div class="scr"><div id="nt-list"></div></div>
</div>

</main>
</div>

<!-- TCHAT -->
<div class="chat-panel" id="chat-panel">
  <div class="chat-hd">
    <span class="chat-hd-t">&#x1F4AC; Tchat de l&#x27;&#xe9;quipe</span>
    <select class="chat-sel" id="chat-ch" onchange="switchChannel()">
      <option value="general">&#x1F4AC; G&#xe9;n&#xe9;ral</option>
      <option value="bureau">&#x1F3DB; Bureau</option>
      <option value="culture">&#x1F3AD; Culture</option>
      <option value="mobilites">&#x1F6B2; Mobilit&#xe9;s</option>
      <option value="ecologie">&#x1F33F; &#xc9;cologie</option>
      <option value="social">&#x1F91D; Social</option>
      <option value="enfance">&#x1F466; Enfance</option>
      <option value="tranquillite">&#x1F6E1; Tranquillit&#xe9;</option>
      <option value="travaux">&#x1F3D7; Travaux</option>
    </select>
    <button onclick="resetChat()" title="Vider ce canal" style="background:rgba(220,38,38,.3);border:1px solid rgba(220,38,38,.5);color:#fff;border-radius:6px;padding:3px 8px;cursor:pointer;font-size:.72rem">🗑 Vider</button>
    <button class="chat-x" onclick="toggleChat()">&#xd7;</button>
  </div>
  <div class="chat-msgs" id="chat-msgs"></div>
  <div class="chat-in">
    <input id="chat-inp" placeholder="Votre message&#x2026;" onkeydown="if(event.key==='Enter')sendMsg()">
    <button class="chat-send" onclick="sendMsg()">&#x2192;</button>
  </div>
</div>

<!-- MODALES -->
<div class="ov" id="ov-agenda"><div class="modal">
  <div class="mhd"><h3>&#x1F4C5; Ajouter une r&#xe9;union</h3><button class="mcl" onclick="cm()">&#xd7;</button></div>
  <div class="ff"><label>Titre *</label><input class="fi" id="ag-ti" placeholder="Bureau municipal, Commission&#x2026;"></div>
  <div class="fr2">
    <div class="ff"><label>Date</label><input class="fi" type="date" id="ag-d"></div>
    <div class="ff"><label>Heure</label><input class="fi" id="ag-h" placeholder="18h30"></div>
  </div>
  <div class="ff"><label>Lieu</label><input class="fi" id="ag-l" placeholder="Salle du conseil&#x2026;"></div>
  <div class="ff"><label>Type</label>
    <select class="fi" id="ag-ty">
      <option value="bureau">Bureau municipal</option><option value="commission">Commission th&#xe9;matique</option>
      <option value="conseil">Conseil municipal</option><option value="autre">Autre</option>
    </select>
  </div>
  <div class="ff"><label>Ordre du jour / Notes</label><textarea class="fi" id="ag-n" placeholder="Points &#xe0; l&#x27;ordre du jour&#x2026;"></textarea></div>
  <div class="mft"><button class="btn btn-g" onclick="cm()">Annuler</button><button class="btn btn-p" onclick="svAg()">Enregistrer</button></div>
</div></div>

<div class="ov" id="ov-cr"><div class="modal modal-lg">
  <div class="mhd"><h3>&#x1F4DD; Nouveau compte rendu</h3><button class="mcl" onclick="cm()">&#xd7;</button></div>
  <div class="fr2">
    <div class="ff"><label>Titre *</label><input class="fi" id="cr-ti" placeholder="Ex: CR Bureau 15 avril 2026"></div>
    <div class="ff"><label>Commission / R&#xe9;union</label>
      <select class="fi" id="cr-comm">
        <option value="Bureau municipal">Bureau municipal</option>
        <option value="Conseil municipal">Conseil municipal</option>
        <option value="Culture, Patrimoine &amp; Jumelages">Culture, Patrimoine &amp; Jumelages</option>
        <option value="Mobilités">Mobilit&#xe9;s</option>
        <option value="Transition écologique">Transition &#xe9;cologique</option>
        <option value="Action sociale">Action sociale</option>
        <option value="Concertation citoyenne">Concertation citoyenne</option>
        <option value="Animations de proximité">Animations de proximit&#xe9;</option>
        <option value="Enfance/Jeunesse">Enfance/Jeunesse</option>
        <option value="Tranquillité publique">Tranquillit&#xe9; publique</option>
        <option value="Travaux &amp; Urbanisme">Travaux &amp; Urbanisme</option>
        <option value="Santé">Sant&#xe9;</option>
        <option value="Autre">Autre</option>
      </select>
    </div>
    <div class="ff"><label>Date de la r&#xe9;union</label><input class="fi" type="date" id="cr-date"></div>
    <div class="ff"><label>R&#xe9;dig&#xe9; par</label><input class="fi" id="cr-par" placeholder="Votre nom"></div>
  </div>
  <div class="ff"><label>Participants</label><input class="fi" id="cr-part" placeholder="Catherine Troton, Michel Troton&#x2026;"></div>
  <div class="ff"><label>Ordre du jour</label><input class="fi" id="cr-odj" placeholder="1. Budget 2026  2. Projets voirie  3. Questions diverses"></div>
  <div class="ff"><label>Contenu / D&#xe9;lib&#xe9;rations *</label><textarea class="fi" id="cr-content" style="height:220px" placeholder="R&#xe9;sum&#xe9; des d&#xe9;bats, d&#xe9;cisions prises, votes&#x2026;"></textarea></div>
  <div class="ff"><label>Prochaines &#xe9;tapes / Actions</label><textarea class="fi" id="cr-next" style="height:80px" placeholder="Qui fait quoi, &#xe9;ch&#xe9;ances&#x2026;"></textarea></div>
  <div class="ff"><label>Document joint (optionnel)</label>
    <div style="border:2px dashed var(--w2);border-radius:10px;padding:.75rem;text-align:center;cursor:pointer;background:var(--g8);margin-bottom:8px" onclick="document.getElementById('cr-file').click()">
      <div style="font-size:1.1rem;margin-bottom:.2rem">📂</div>
      <div style="font-size:.75rem;color:var(--i3)">Cliquer pour joindre un fichier</div>
      <div style="font-size:.65rem;color:var(--i4)">PDF · Word · Image…</div>
      <input type="file" id="cr-file" style="display:none" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.odt" onchange="crPreviewFile(this)">
    </div>
    <div id="cr-file-preview" style="display:none;padding:.5rem .75rem;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;font-size:.74rem;font-weight:700;color:var(--g1);margin-bottom:6px"></div>
    <input class="fi" type="url" id="cr-url" placeholder="Ou coller un lien (URL, Drive…)">
  </div>
  <div class="mft"><button class="btn btn-g" onclick="cm()">Annuler</button><button class="btn btn-p" onclick="svCR()">Enregistrer le CR</button></div>
</div></div>

<div class="ov" id="ov-cr-view"><div class="modal modal-lg">
  <div class="mhd"><h3 id="crv-title">Compte rendu</h3><button class="mcl" onclick="cm()">&#xd7;</button></div>
  <div id="crv-body"></div>
  <div class="mft"><button class="btn btn-g" onclick="cm()">Fermer</button><button class="btn btn-d btn-sm" id="crv-del" onclick="delCR()">Supprimer</button></div>
</div></div>

<div class="ov" id="ov-biblio"><div class="modal">
  <div class="mhd"><h3>&#x1F4DA; Ajouter un document</h3><button class="mcl" onclick="cm()">&#xd7;</button></div>
  <div class="ff"><label>Titre *</label><input class="fi" id="bib-ti" placeholder="Nom du document"></div>
  <div class="fr2">
    <div class="ff"><label>Type</label>
      <select class="fi" id="bib-ty">
        <option>D&#xe9;lib&#xe9;ration</option><option>Arr&#xea;t&#xe9;</option><option>Rapport</option>
        <option>Compte-rendu</option><option>Budget</option><option>Plan</option>
        <option>Convention</option><option>Courrier</option><option>Autre</option>
      </select>
    </div>
    <div class="ff"><label>Commission</label>
      <select class="fi" id="bib-co">
        <option value="">-- Aucune --</option>
        <option>Bureau municipal</option><option>Conseil municipal</option>
        <option>Culture, Patrimoine &amp; Jumelages</option><option>Mobilit&#xe9;s</option>
        <option>Transition &#xe9;cologique</option><option>Action sociale</option>
        <option>Concertation citoyenne</option><option>Animations de proximit&#xe9;</option>
        <option>Enfance/Jeunesse</option><option>Tranquillit&#xe9; publique</option>
        <option>Travaux &amp; Urbanisme</option><option>Sant&#xe9;</option>
      </select>
    </div>
    <div class="ff"><label>Date du document</label><input class="fi" type="date" id="bib-date"></div>
    <div class="ff"><label>Ann&#xe9;e</label><input class="fi" id="bib-year" placeholder="2026"></div>
  </div>
  <div class="ff">
    <label>Document *</label>
    <div style="display:flex;gap:0;border-radius:var(--r);overflow:hidden;border:1px solid var(--w3);margin-bottom:6px">
      <button id="bib-tab-url" onclick="bibSwitchTab('url')" style="flex:1;padding:7px;font-size:.73rem;font-weight:700;background:var(--g3);color:#fff;border:none;cursor:pointer">&#x1F517; Lien URL</button>
      <button id="bib-tab-file" onclick="bibSwitchTab('file')" style="flex:1;padding:7px;font-size:.73rem;font-weight:700;background:var(--w2);color:var(--i2);border:none;cursor:pointer">&#x1F4C1; Fichier disque / cl&#xe9; USB</button>
    </div>
    <div id="bib-url-section">
      <input class="fi" id="bib-url" placeholder="https://&#x2026;" type="url">
    </div>
    <div id="bib-file-section" style="display:none">
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:.65rem .85rem;border:2px dashed var(--w3);border-radius:var(--r);background:var(--w);transition:.15s">
        <span style="font-size:1.4rem">&#x1F4C2;</span>
        <div style="flex:1">
          <div style="font-size:.76rem;font-weight:700;color:var(--ink)" id="bib-file-label">Cliquer pour choisir un fichier</div>
          <div style="font-size:.63rem;color:var(--i3);margin-top:1px">PDF, Word, Excel, image &#x2014; disque dur ou cl&#xe9; USB</div>
        </div>
        <input type="file" id="bib-file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg,.gif" style="display:none" onchange="bibFileChosen(this)">
      </label>
      <div id="bib-upload-progress" style="display:none;margin-top:6px">
        <div style="height:4px;background:var(--w2);border-radius:2px;overflow:hidden">
          <div id="bib-upload-bar" style="height:4px;background:var(--g4);border-radius:2px;width:0%;transition:width .3s"></div>
        </div>
        <div id="bib-upload-msg" style="font-size:.68rem;color:var(--i3);margin-top:3px">Envoi en cours&#x2026;</div>
      </div>
    </div>
  </div>
  <div class="ff"><label>Description</label><textarea class="fi" id="bib-desc" placeholder="R&#xe9;sum&#xe9;, contexte&#x2026;"></textarea></div>
  <div class="ff"><label>Tags (virgule-s&#xe9;par&#xe9;s)</label><input class="fi" id="bib-tags" placeholder="budget, 2026, voirie&#x2026;"></div>
  <div class="ff"><label>Visibilit&#xe9;</label>
    <div style="display:flex;gap:10px;margin-top:.25rem">
      <label style="display:flex;align-items:center;gap:7px;cursor:pointer;flex:1;padding:.6rem .85rem;border-radius:var(--r);border:2px solid var(--g6);background:var(--g8)">
        <input type="radio" name="bib-vis" id="bib-vis-pub" value="public" checked style="accent-color:var(--g3)">
        <div><div style="font-size:.75rem;font-weight:700;color:var(--g2)">&#x1F465; Public</div><div style="font-size:.62rem;color:var(--i3)">Visible par toute l&#x27;&#xe9;quipe</div></div>
      </label>
      <label style="display:flex;align-items:center;gap:7px;cursor:pointer;flex:1;padding:.6rem .85rem;border-radius:var(--r);border:2px solid var(--w3);background:var(--w)">
        <input type="radio" name="bib-vis" id="bib-vis-priv" value="prive" style="accent-color:var(--g3)">
        <div><div style="font-size:.75rem;font-weight:700;color:var(--ink)">&#x1F512; Privé</div><div style="font-size:.62rem;color:var(--i3)">Uniquement vous</div></div>
      </label>
    </div>
  </div>
  <div class="mft"><button class="btn btn-g" onclick="cm()">Annuler</button><button class="btn btn-p" onclick="svBiblio()">Ajouter</button></div>
</div></div>

<div class="ov" id="ov-repelu"><div class="modal">
  <div class="mhd"><h3>&#x1F4C2; Ajouter un document</h3><button class="mcl" onclick="cm()">&#xd7;</button></div>
  <div class="ff">
    <label>Fichier</label>
    <div style="border:2px dashed var(--w2);border-radius:10px;padding:.85rem;text-align:center;cursor:pointer;background:var(--g8)" onclick="document.getElementById('re-file').click()">
      <div style="font-size:1.2rem;margin-bottom:.2rem">📂</div>
      <div style="font-size:.78rem;color:var(--i3)">Cliquer pour choisir un fichier</div>
      <div style="font-size:.67rem;color:var(--i4)">PDF · Word · Excel · Image…</div>
      <input type="file" id="re-file" style="display:none" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.odt,.eml,.msg" onchange="rePreviewFile(this)">
    </div>
    <div id="re-file-preview" style="display:none;margin-top:6px;padding:.5rem .75rem;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;font-size:.74rem;font-weight:700;color:var(--g1)"></div>
  </div>
  <div class="ff"><label>Titre</label><input class="fi" id="re-ti" placeholder="Nom du document (auto si vide)"></div>
  <div class="ff"><label>Ou coller un lien (URL)</label><input class="fi" type="url" id="re-url" placeholder="https://…"></div>
  <div class="ff"><label>Notes</label><textarea class="fi" id="re-notes" placeholder="Contexte, date, description…" rows="2"></textarea></div>
  <div class="mft"><button class="btn btn-g" onclick="cm()">Annuler</button><button class="btn btn-p" onclick="svRepElu()">💾 Enregistrer</button></div>
</div></div>

<div class="ov" id="ov-annonce"><div class="modal">
  <div class="mhd"><h3>&#x1F4E2; Publier une annonce</h3><button class="mcl" onclick="cm()">&#xd7;</button></div>
  <div style="background:var(--g8);border:1px solid var(--g7);border-radius:var(--r);padding:.75rem;font-size:.75rem;color:var(--g2);margin-bottom:1rem">Visible par tous les membres sur la page "Aujourd&#x27;hui".</div>
  <div class="ff"><label>Titre *</label><input class="fi" id="ann-ti" placeholder="R&#xe9;union report&#xe9;e, Document disponible&#x2026;"></div>
  <div class="ff"><label>Message</label><textarea class="fi" id="ann-tx" placeholder="D&#xe9;tails&#x2026;"></textarea></div>
  <div class="ff"><label>Priorit&#xe9;</label>
    <select class="fi" id="ann-pr"><option value="normal">Normal</option><option value="important">Important</option><option value="urgent">Urgent</option></select>
  </div>
  <div class="mft"><button class="btn btn-g" onclick="cm()">Annuler</button><button class="btn btn-p" onclick="svAnn()">Publier</button></div>
</div></div>

<div class="ov" id="ov-signal"><div class="modal">
  <div class="mhd"><h3>&#x1F534; Nouveau signalement</h3><button class="mcl" onclick="cm()">&#xd7;</button></div>
  <div class="ff"><label>Titre / Objet *</label><input class="fi" id="sig-ti" placeholder="Lumi&#xe8;re &#xe9;teinte, Nid de poule, Graffiti&#x2026;"></div>
  <div class="fr2">
    <div class="ff"><label>Type</label>
      <select class="fi" id="sig-ty"><option>Voirie</option><option>&#xc9;clairage</option><option>Propret&#xe9;</option><option>Espace vert</option><option>S&#xe9;curit&#xe9;</option><option>B&#xe2;timent</option><option>Autre</option></select>
    </div>
    <div class="ff"><label>Urgence</label>
      <select class="fi" id="sig-urg"><option value="normale">Normale</option><option value="importante">Importante</option><option value="urgente">Urgente &#x1F534;</option></select>
    </div>
  </div>
  <div class="ff"><label>Lieu pr&#xe9;cis *</label><input class="fi" id="sig-lieu" placeholder="Rue, quartier, rep&#xe8;re&#x2026;"></div>
  <div class="ff"><label>Description</label><textarea class="fi" id="sig-desc" placeholder="D&#xe9;crivez le probl&#xe8;me&#x2026;"></textarea></div>
  <div class="fr2">
    <div class="ff"><label>Service concern&#xe9;</label>
      <select class="fi" id="sig-serv"><option value="">-- Non attribu&#xe9; --</option><option>Service Technique</option><option>Police Municipale</option><option>CCAS</option><option>Service Culturel</option><option>Service Enfance</option><option>DGS</option></select>
    </div>
    <div class="ff"><label>Signal&#xe9; par</label><input class="fi" id="sig-par" placeholder="Votre nom"></div>
  </div>
  <div class="mft"><button class="btn btn-g" onclick="cm()">Annuler</button><button class="btn btn-p" onclick="svSig()">Enregistrer</button></div>
</div></div>

<div class="ov" id="ov-sig-det"><div class="modal">
  <div class="mhd"><h3 id="sdt-t">Signalement</h3><button class="mcl" onclick="cm()">&#xd7;</button></div>
  <div id="sdt-body"></div>
  <div class="mft" style="flex-wrap:wrap;gap:8px">
    <button class="btn btn-g" onclick="cm()">Fermer</button>
    <select class="fi" id="sdt-nst" style="width:auto;padding:7px 10px"><option value="">Changer statut&#x2026;</option><option>En cours</option><option>R&#xe9;solu</option><option>Non retenu</option></select>
    <button class="btn btn-p" onclick="updSig()">Mettre &#xe0; jour</button>
    <button class="btn btn-d btn-sm" id="sdt-del">Supprimer</button>
  </div>
</div></div>

<div class="ov" id="ov-event"><div class="modal">
  <div class="mhd"><h3>&#x1F3AA; Ajouter un &#xe9;v&#xe9;nement</h3><button class="mcl" onclick="cm()">&#xd7;</button></div>
  <div class="ff"><label>Titre *</label><input class="fi" id="ev-ti" placeholder="March&#xe9; du dimanche, Loto, AG&#x2026;"></div>
  <div class="fr2">
    <div class="ff"><label>Date *</label><input class="fi" type="date" id="ev-d"></div>
    <div class="ff"><label>Heure</label><input class="fi" id="ev-h" placeholder="10h00"></div>
  </div>
  <div class="fr2">
    <div class="ff"><label>Lieu</label><input class="fi" id="ev-lieu" placeholder="Salle, place&#x2026;"></div>
    <div class="ff"><label>Type</label>
      <select class="fi" id="ev-ty"><option value="municipal">Municipal</option><option value="associatif">Associatif</option><option value="culturel">Culturel</option><option value="sportif">Sportif</option><option value="commemoration">Comm&#xe9;moration</option><option value="autre">Autre</option></select>
    </div>
  </div>
  <div class="ff"><label>Description</label><textarea class="fi" id="ev-desc"></textarea></div>
  <div class="ff"><label>Organisateur</label><input class="fi" id="ev-org" placeholder="Association, service&#x2026;"></div>
  <div class="mft"><button class="btn btn-g" onclick="cm()">Annuler</button><button class="btn btn-p" onclick="svEv()">Enregistrer</button></div>
</div></div>

<div class="ov" id="ov-elu-det"><div class="modal">
  <div class="mhd"><h3 id="elu-det-t">Fiche &#xe9;lu</h3><button class="mcl" onclick="cm()">&#xd7;</button></div>
  <div id="elu-det-b"></div>
  <div class="mft"><button class="btn btn-g" onclick="cm()">Fermer</button></div>
</div></div>


<div class="ov" id="ov-profile"><div class="modal">
  <div class="mhd"><h3>&#x1F464; Mon profil</h3><button class="mcl" onclick="cm()">&#xd7;</button></div>
  <div id="profile-body" style="margin-bottom:1.2rem"></div>
  <div style="border-top:1px solid var(--w2);padding-top:1rem">
    <div style="font-size:.76rem;font-weight:700;color:var(--i2);margin-bottom:.75rem">Changer mon mot de passe</div>
    <div class="ff"><label>Nouveau mot de passe</label><input class="fi" type="password" id="new-pwd" placeholder="Minimum 5 caractères&#x2026;" autocomplete="new-password"></div>
    <div class="ff"><label>Confirmer</label><input class="fi" type="password" id="new-pwd2" placeholder="Répéter le mot de passe&#x2026;" autocomplete="new-password"></div>
    <div id="pwd-msg" style="font-size:.72rem;margin-bottom:.5rem"></div>
  </div>
  <div class="mft">
    <button class="btn btn-g" onclick="cm()">Fermer</button>
    <button class="btn btn-p" onclick="changePwd()">Enregistrer</button>
  </div>
</div></div>
<div class="ov" id="ov-projet-edit"><div class="modal" style="max-width:600px">
  <div class="mhd"><h3>&#x270F;&#xFE0F; Modifier le projet</h3><button class="mcl" onclick="cm()">&#xd7;</button></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:.75rem">
    <div class="ff" style="grid-column:1/-1"><label>Titre</label><input class="fi" id="ep-titre"></div>
    <div class="ff"><label>Commission / Th&#xe8;me</label><select class="fi" id="ep-theme"></select></div>
    <div class="ff"><label>Statut</label><select class="fi" id="ep-statut"></select></div>
    <div class="ff"><label>Ann&#xe9;e cible</label><input class="fi" id="ep-annee" type="number" min="2026" max="2032"></div>
    <div class="ff"><label>Importance</label><select class="fi" id="ep-imp"><option value="1">&#x2605; Normale</option><option value="2">&#x2605;&#x2605; Importante</option><option value="3">&#x2605;&#x2605;&#x2605; Prioritaire</option></select></div>
    <div class="ff" style="grid-column:1/-1"><label>R&#xe9;sum&#xe9;</label><input class="fi" id="ep-resume"></div>
    <div class="ff" style="grid-column:1/-1"><label>Description</label><textarea class="fi" id="ep-desc" rows="3" style="resize:vertical"></textarea></div>
    <div class="ff" style="grid-column:1/-1"><label>Tags</label><input class="fi" id="ep-tags" placeholder="tag1, tag2&#x2026;"></div>
  </div>
  <div id="ep-msg" style="font-size:.73rem;color:var(--red);margin-bottom:.5rem"></div>
  <div class="mft">
    <button class="btn btn-g" onclick="cm()">Annuler</button>
    <button class="btn btn-d btn-sm" onclick="dlProj()" style="margin-right:auto">&#x1F5D1; Supprimer</button>
    <button class="btn btn-p" onclick="svProj()">&#x1F4BE; Enregistrer</button>
  </div>
</div></div>
<!-- Overlay mobile sidebar -->
<div class="sb-overlay" id="sb-overlay" onclick="closeMobileMenu()"></div>

<!-- Barre outils bas mobile -->
<div class="bottom-tools" id="bottom-tools">
  <div class="bt-ic on" id="bt-today" onclick="gpMobile('today','bt-today')">
    <span class="bt-ico">&#x1F4CB;</span><span>Accueil</span>
  </div>
  <div class="bt-ic" id="bt-comm" onclick="gpMobile('comm','bt-comm')">
    <span class="bt-ico">&#x1F5C2;</span><span>Projets</span>
  </div>
  <div class="bt-ic" id="bt-agenda" onclick="gpMobile('agenda','bt-agenda')">
    <span class="bt-ico">&#x1F4C5;</span><span>Agenda</span>
  </div>
  <div class="bt-ic" id="bt-signal" onclick="gpMobile('signal','bt-signal')">
    <span class="bt-ico">&#x1F534;</span><span>Alertes</span>
  </div>
  <div class="bt-ic" id="bt-elus" onclick="gpMobile('elus','bt-elus')">
    <span class="bt-ico">&#x1F465;</span><span>&#xc9;lus</span>
  </div>
</div>

<div class="toast" id="toast"></div>

<script>
// ── DONNÉES ET ÉTAT ─────────────────────────────────────────────────────────
var P=[],ST={},AG=[],DC=[],NF=[],CHAT=[],ANN=[],TASKS=[],SIGN=[],EVTS=[],CRS=[],BIBLIO=[],REP_ELUS={};
var ELUS_DATA=[];
var COMM=${JSON.stringify(COMM)};
var COLORS=${JSON.stringify(COLORS)};
var ICONS=${JSON.stringify(ICONS)};
var REFS=${JSON.stringify(REFS)};
var ELUS0=${JSON.stringify(ELUS0)};
var GUIDES=${JSON.stringify(GUIDES)};
var RESS=${JSON.stringify(RESS)};
var SLIST=["Prioritaire","Programmé","Planifié","Étude","En cours","Réalisé","Suspendu"];
var MOIS=["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
var _ci=0,_sigId=null,_crId=null,_repEluId=null,_chatLast=0,_chatOpen=false,_chatTimer=null;
var chT=null,chS=null;
var ME={nom:"Chargement...",avatar:"?",id:0,role:"",color:"var(--g3)",username:""};
function isAdmin(){return ME.id===0||ME.id===20;}
var _auth=""; // Sera mis à jour avec les credentials réels

// ── UTILITAIRES ──────────────────────────────────────────────────────────────
function $(i){var pb=document.getElementById("panel-body");if(pb){var e=pb.querySelector("#"+i);if(e)return e;}return document.getElementById(i);}
function qsa(s){return document.querySelectorAll(s);}
function v(i){var e=$(i);return e?e.value:"";}
function el(i,val){var e=$(i);if(e)e.textContent=val;}
function mkH(extra){
  var h={"Content-Type":"application/json"};
  if(_auth)h["Authorization"]=_auth;
  return Object.assign(h,extra||{});
}
function apiGet(u){return fetch(u,{credentials:"include",headers:_auth?{Authorization:_auth}:{}}).then(function(r){if(r.status===401){showLoginMsg();return {};}return r.json();});}
function apiPost(u,d){return fetch(u,{method:"POST",credentials:"include",headers:mkH(),body:JSON.stringify(d)}).then(function(r){if(r.status===401){showLoginMsg();return {ok:false};}return r.json();});}
function apiPatch(u,d){return fetch(u,{method:"PATCH",credentials:"include",headers:mkH(),body:JSON.stringify(d)}).then(function(r){return r.json();});}
function apiPut(u,d){return fetch(u,{method:"PUT",credentials:"include",headers:mkH(),body:JSON.stringify(d)}).then(function(r){return r.json();});}
function apiDel(u){return fetch(u,{method:"DELETE",credentials:"include",headers:_auth?{Authorization:_auth}:{} }).then(function(r){return r.json();});}
function showLoginMsg(){toast("Session expirée — rechargez la page.",4000);}
function toast(m,t){var e=$("toast");e.textContent=m;e.style.display="block";setTimeout(function(){e.style.display="none";},t||2500);}
function om(id){var e=$("ov-"+id);if(e)e.classList.add("on");}
function cm(){qsa(".ov").forEach(function(o){o.classList.remove("on");});}
qsa(".ov").forEach(function(o){o.addEventListener("click",function(e){if(e.target===o)cm();});});

// ── NAVIGATION ───────────────────────────────────────────────────────────────
function gp(id,ni){
  var _pp=document.getElementById("main-panel");if(_pp)_pp.style.display="none";
  qsa(".page").forEach(function(p){p.classList.remove("on");});
  qsa(".sbi").forEach(function(n){n.classList.remove("on");});
  var pg=$("p-"+id);
  if(pg){pg.classList.add("on");pg.scrollTop=0;}
  if(ni&&ni.classList)ni.classList.add("on");
  // Remonter le scroll de .main à 0 à chaque navigation
  var mainEl=document.querySelector(".main");
  if(mainEl)mainEl.scrollTop=0;
  if(window.innerWidth<=900) closeMobileMenu();
  if(id==="today"){renderHeroAccueil();renderWidgetAgenda();renderWidgetSig();renderCRHome();}
  else if(id==="agenda")renderAg();
  else if(id==="cr")renderCR();
  else if(id==="biblio"){bibLoadDossiers(renderBiblio);}
  else if(id==="repelus")renderRepElus();
  else if(id==="elus")renderElus();
  else if(id==="signal"){fSig();updSig();}
  else if(id==="events")renderEv();
  else if(id==="hist")renderNt();
  else if(id==="comm"){buildCG();}
  else if(id==="global"){fG();}
  else if(id==="creer"){resetNP();}
  else if(id==="budget"){setTimeout(buildBudgetChart,50);}
  else if(id==="guide"||id==="ress"){
    // Ress et Guide fusionnés
    qsa(".page").forEach(function(p){p.classList.remove("on");});
    var pg=$("p-guide");if(pg)pg.classList.add("on");
    if(ni)ni.classList.add("on");
    buildGuides(); buildRess();
    return;
  }
}
// ── PANNEAU UNIQUE — s'ouvre par-dessus le dashboard ─────────────────────────
function openPanel(id){
  // Activer le menu
  qsa(".sbi").forEach(function(n){n.classList.remove("on");});
  var menuEl = document.querySelector("[data-panel='" + id + "']");
  if(menuEl) menuEl.classList.add("on");

  var pg = document.getElementById("p-"+id);
  if(!pg) return;

  // Créer ou réutiliser le panneau
  var panel = document.getElementById("main-panel");
  if(!panel){
    panel = document.createElement("div");
    panel.id = "main-panel";
    panel.style.cssText = "position:fixed;left:252px;right:0;top:54px;bottom:0;z-index:100;display:flex;flex-direction:column;overflow:hidden;background:var(--w);";
    document.body.appendChild(panel);
  }

  // Barre titre avec ✕
  var title = "";
  var phT = pg.querySelector(".ph-t");
  if(phT) title = phT.textContent;
  else { var h = pg.querySelector("h2,h3"); if(h) title = h.textContent; else title = id; }

  panel.innerHTML = '<div style="background:var(--g1);color:#fff;padding:.55rem 1rem;display:flex;align-items:center;gap:8px;flex-shrink:0;font-size:.78rem;font-weight:600;font-family:var(--fd);">'
    + '<span style="flex:1">'+title+'</span>'
    + '<button onclick="closePanel()" style="background:rgba(255,255,255,.15);border:none;color:#fff;border-radius:5px;width:24px;height:24px;cursor:pointer;font-size:.9rem;">&#x2715;</button>'
    + '</div>'
    + '<div id="panel-body" style="flex:1;overflow-y:auto;"></div>';

  var clone = pg.cloneNode(true);
  clone.style.display = "block";
  document.getElementById("panel-body").appendChild(clone);
  panel.style.display = "flex";

  // Charger données
  if(id==="agenda") renderAg();
  else if(id==="cr") renderCR();
  else if(id==="biblio"){bibLoadDossiers(function(){apiGet("/api/biblio").then(function(data){BIBLIO=Array.isArray(data)?data:[];el("sb-bib",BIBLIO.length);renderBiblio();});});}
  else if(id==="repelus") renderRepElus();
  else if(id==="elus") renderElus();
  else if(id==="comm") buildCG();
  else if(id==="global") fG();
  else if(id==="signal"){fSig();updSig();}
  else if(id==="events") renderEv();
  else if(id==="guide") buildGuides();
  else if(id==="ress") buildRess();
  else if(id==="hist") renderNt();
  else if(id==="comms"){}
  else if(id==="tuto") renderTutoCards();
  else if(id==="creer") resetNP();
  else if(id==="cdet") fCD();
  else if(id==="audit") renderAudit();
  else if(id==="connexions") renderConnexions();
  else if(id==="confidentialite"){}
}

function closePanel(){_auditBack=false;
  var panel = document.getElementById("main-panel");
  if(panel) panel.style.display = "none";
  qsa(".sbi").forEach(function(n){n.classList.remove("on");});
  var first = document.querySelector(".sbi");
  if(first) first.classList.add("on");
}


function goComm(){openPanel("comm");}
function goGlobal(){openPanel("global");}

// ── INIT ─────────────────────────────────────────────────────────────────────
function openProfile(){
  var av=$("top-av-btn");if(av){av.textContent=ME.avatar;av.style.background=ME.color||"var(--g4)";}
      setTimeout(applyRoles,100);
  var pb=$("profile-body");if(!pb)return;
  pb.innerHTML='<div style="display:flex;align-items:center;gap:14px;padding:.85rem;background:var(--g8);border-radius:var(--R)">'
    +'<div style="width:50px;height:50px;border-radius:14px;background:'+(ME.color||"var(--g3)")+';display:flex;align-items:center;justify-content:center;font-size:1.1rem;font-weight:700;color:#fff;font-family:var(--fd)">'+ME.avatar+'</div>'
    +'<div><div style="font-size:.95rem;font-weight:700;font-family:var(--fd);color:var(--ink)">'+ME.nom+'</div>'
    +'<div style="font-size:.75rem;color:var(--i3);margin-top:1px">'+ME.role+'</div>'
    +'<div style="font-size:.67rem;color:var(--i4);margin-top:2px;font-family:var(--fm)">Login : '+ME.username+'</div>'
    +'</div></div>';
  $("new-pwd").value=""; $("new-pwd2").value=""; $("pwd-msg").textContent="";
  om("profile");
}

function changePwd(){
  var p1=v("new-pwd"), p2=v("new-pwd2"), msg=$("pwd-msg");
  if(!p1){msg.textContent="Entrez un nouveau mot de passe.";msg.style.color="var(--red)";return;}
  if(p1.length<5){msg.textContent="Minimum 5 caractères.";msg.style.color="var(--red)";return;}
  if(p1!==p2){msg.textContent="Les mots de passe ne correspondent pas.";msg.style.color="var(--red)";return;}
  apiPost("/api/change_pwd",{newpwd:p1}).then(function(d){
    if(d.ok){
      msg.textContent="Mot de passe modifié. Reconnectez-vous avec vos nouveaux identifiants.";
      msg.style.color="var(--g3)";
      $("new-pwd").value=""; $("new-pwd2").value="";
      // Mettre à jour le header auth stocké
      _auth="Basic "+btoa(ME.username+":"+p1);
      toast("Mot de passe modifié !");
    } else {msg.textContent=d.error||"Erreur.";msg.style.color="var(--red)";}
  });
}

function init(){
  var now=new Date();
  $("tdate").textContent=now.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"});

  // Charger agenda et événements EN PRIORITÉ pour le widget accueil
  apiGet("/api/agenda").then(function(data){
    AG=data;
    renderWidgetAgenda();
    renderNextMtg();
    initCal();
  });
  apiGet("/api/evenements").then(function(data){
    EVTS=data;
    renderWidgetAgenda();
    renderEvHome();
  });

  apiGet("/api/all").then(function(d){
    ST=d.statuts; AG=d.agenda; DC=d.documents; NF=d.notifs;
    ANN=d.annonces||[]; TASKS=d.tasks||[];
    if(d.me){
      ME=d.me;
      // Mettre à jour l'avatar dans la topbar
      var av=$("top-av-btn");
      if(av){av.textContent=ME.avatar;av.style.background=ME.color||"var(--g4)";}
      // Mettre à jour le label du répertoire
      var repT=document.querySelector("#p-repelus .ph-t");
      if(repT)repT.textContent="Mon répertoire personnel";
      var repS=document.querySelector("#p-repelus .ph-s");
      if(repS)repS.textContent="Vos documents privés — visibles uniquement par vous";
      if(isAdmin()){var _as=document.getElementById("sb-audit-section");if(_as)_as.style.display="";}
    }
    SIGN=d.signalements||[]; EVTS=d.evenements||[];
    CRS=d.comptes_rendus||[]; ELUS_DATA=d.elus||[];
    BIBLIO=[]; // chargé séparément
    if(d.stats){
      el("k-tot",d.stats.total); el("k-pr",d.stats.prioritaires);
      el("k-26",d.stats.annee2026); el("k-re",d.stats.realises);
      el("k-sig",d.stats.sig_new||0);
      el("sb-tot",d.stats.total);
    }
    renderTasks(); renderAnn(); renderNextMtg();
    buildGuides(); buildRess();
    updSigBadge(); renderHeroAccueil();
    // KPI mandat contextuels
    var sigOpen=SIGN.filter(function(s){return s.statut!=='Résolu'&&s.statut!=='Non retenu';}).length;
    el("kpi-sig-open",sigOpen);
    if(sigOpen>0)$("kpi-sig-open").style.color="var(--red)";
    // Sessions conseil dans l'année
    var y=new Date().getFullYear();
    var conseils=AG.filter(function(a){return a.type==="conseil"&&(a.date||"").startsWith(String(y));}).length;
    el("kpi-conseil",conseils+"/"+Math.max(conseils,4));
    initCal(); renderWidgetAgenda(); renderWidgetSig(); renderCRHome(); renderEvHome(); checkUrgents(); initWidgetChat();
    el("k-sig",d.stats?d.stats.sig_new||0:0);
  });

  apiGet("/api/projets").then(function(data){
    P=data; buildFilters(); fG(); buildCG(); buildCharts();
    renderWidgetMandat();
  });

  bibLoadDossiers(function(){
    apiGet("/api/biblio").then(function(data){
      BIBLIO=Array.isArray(data)?data:[];
      el("sb-bib",BIBLIO.length);
      renderBiblio();
    });
  });

  apiGet("/api/rep_elus").then(function(data){
    REP_ELUS=data||{};
  });

  _chatTimer=setInterval(pollChat,6000);
  renderChatMsgs([]);
}

// ── STATS + KPI ──────────────────────────────────────────────────────────────
function bc(s){
  if(!s)return "b-nd";var l=s.toLowerCase();
  if(l.indexOf("prioritaire")>=0)return "b-pr";
  if(l.indexOf("programm")>=0)return "b-pg";
  if(l.indexOf("planifi")>=0)return "b-pl";
  if(l.indexOf("cours")>=0)return "b-ec";
  if(l.indexOf("tude")>=0)return "b-et";
  if(l.indexOf("alis")>=0)return "b-re";
  return "b-nd";
}
function imp(n){return n?"★".repeat(n):"-";}
function t2c(t){for(var c in COMM){if(COMM[c].indexOf(t)>=0)return c;}return "Autre";}

// ── PROCHAINE RÉUNION ────────────────────────────────────────────────────────

function renderCRHome(){
  var cl=$("cr-home-list"); if(!cl)return;
  var last=CRS.slice(0,4);
  if(!last.length){
    cl.innerHTML='<div style="font-size:.74rem;color:var(--i4);text-align:center;padding:.5rem 0">Aucun CR pour l&#39;instant</div>';
    return;
  }
  var CRCC={"Bureau municipal":"#1d3d2b","Conseil municipal":"#2d5a40","Culture, Patrimoine & Jumelages":"#8B5CF6","Mobilités":"#3B82F6","Transition écologique":"#10B981","Action sociale":"#F59E0B","Animations de proximité":"#EC4899","Enfance/Jeunesse":"#F97316","Tranquillité publique":"#EF4444","Travaux & Urbanisme":"#84CC16","Santé":"#06B6D4"};
  cl.innerHTML=last.map(function(cr){
    var col=CRCC[cr.commission]||"var(--g4)";
    return '<div style="display:flex;gap:9px;align-items:flex-start;padding:.5rem 0;border-bottom:1px solid var(--w2);cursor:pointer" onclick="openCR('+cr.id+')">'
      +'<div style="width:28px;height:28px;border-radius:7px;background:'+col+'18;border:1px solid '+col+'30;display:flex;align-items:center;justify-content:center;font-size:.8rem;flex-shrink:0">📝</div>'
      +'<div style="flex:1;min-width:0">'
      +'<div style="font-size:.76rem;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+cr.titre+'</div>'
      +'<div style="font-size:.65rem;color:var(--i3)">'+cr.commission+(cr.date?" · "+cr.date:"")+'</div>'
      +'</div></div>';
  }).join("");
}

function renderEvHome(){
  var el2=$("ev-home-list"); if(!el2)return;
  var today2=new Date().toISOString().slice(0,10);
  var next=EVTS.filter(function(e){return e.date>=today2;}).slice(0,4);
  if(!next.length){
    el2.innerHTML='<div style="font-size:.74rem;color:var(--i4);text-align:center;padding:.5rem 0">Aucun événement à venir</div>';
    return;
  }
  var MOIS2=["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
  var EVC={municipal:"var(--g3)",associatif:"var(--amber)",culturel:"#8B5CF6",sportif:"var(--blue)",commemoration:"#7f8c8d",autre:"var(--i3)"};
  el2.innerHTML=next.map(function(e){
    var col=EVC[e.type]||"var(--i3)";
    return '<div style="display:flex;gap:9px;align-items:center;padding:.5rem 0;border-bottom:1px solid var(--w2)">'
      +'<div style="background:'+col+'18;border:1px solid '+col+'30;border-radius:7px;padding:.3rem .4rem;text-align:center;min-width:34px;flex-shrink:0">'
      +'<div style="font-size:.85rem;font-weight:800;color:'+col+';line-height:1;font-family:var(--fd)">'+e.date.slice(8)+'</div>'
      +'<div style="font-size:.52rem;font-weight:700;color:'+col+';text-transform:uppercase">'+MOIS2[+e.date.slice(5,7)-1]+'</div></div>'
      +'<div style="flex:1;min-width:0">'
      +'<div style="font-size:.76rem;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+e.titre+'</div>'
      +'<div style="font-size:.65rem;color:var(--i3)">'+(e.lieu||"")+(e.heure?" · "+e.heure:"")+'</div>'
      +'</div></div>';
  }).join("");
}


/* ── WIDGETS ACCUEIL ─────────────────────────────────────────────────────── */

function hideImg(el){el.style.display="none";}
function addTaskFocus(){
  var i=$("task-inp");
  if(i){i.focus();}
}

function renderWidgetAgenda(){
  var now=new Date();
  var todayStr=now.toISOString().slice(0,10);
  var JOURS_C=["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"];
  var MOIS_C=["jan","fév","mar","avr","mai","jun","jul","aoû","sep","oct","nov","déc"];
  
  // Onglets 7 jours
  var wt=$("wg-week"); if(!wt)return;
  var html="";
  for(var i=0;i<7;i++){
    var d=new Date(now); d.setDate(now.getDate()+i);
    var ds=d.toISOString().slice(0,10);
    var isToday=ds===todayStr;
    var nb=AG.filter(function(a){return a.date===ds;}).length
           +EVTS.filter(function(e){return e.date===ds;}).length;
    html+='<div onclick="selADay(this)" data-day="'+ds+'" style="flex-shrink:0;cursor:pointer;padding:.35rem .5rem;border-radius:8px;background:'+(isToday?"var(--g2)":"var(--w)")+';color:'+(isToday?"#fff":"var(--i2)")+';border:1.5px solid '+(isToday?"var(--g2)":isToday?"var(--g5)":"var(--w2)")+';text-align:center;min-width:40px;transition:.12s">'
      +'<div style="font-size:.56rem;font-weight:600;text-transform:uppercase;opacity:.65">'+JOURS_C[d.getDay()]+'</div>'
      +'<div style="font-size:.88rem;font-weight:800;font-family:var(--fd);line-height:1.1">'+d.getDate()+'</div>'
      +(nb?'<div style="width:5px;height:5px;border-radius:50%;background:'+(isToday?"rgba(255,255,255,.8)":"var(--g5)")+';margin:.1rem auto 0"></div>':"<div style='height:5px'></div>")
      +'</div>';
  }
  wt.innerHTML=html;

  // Sélectionner aujourd'hui par défaut
  if(!_selDay) _selDay=todayStr;
  renderWidgetDay(_selDay);

  // Sous-titre
  var fut=AG.filter(function(a){return a.date>=todayStr;}).length
          +EVTS.filter(function(e){return e.date>=todayStr;}).length;
  var sub=$("wg-agenda-sub");
  if(sub) sub.textContent=fut+" événement"+(fut>1?"s":"")+" à venir";
}

function renderWidgetDay(ds){
  var dl=$("wg-day-events"); if(!dl)return;
  var AT={bureau:"Bureau",commission:"Commission",conseil:"Conseil",autre:"Réunion"};
  var AC={bureau:"var(--g3)",commission:"var(--g4)",conseil:"var(--blue)",autre:"var(--i3)"};
  var EC={municipal:"var(--g3)",associatif:"var(--amber)",culturel:"#8B5CF6",sportif:"var(--blue)",commemoration:"#7f8c8d",autre:"var(--i3)"};
  var items=[];
  AG.filter(function(a){return a.date===ds;}).forEach(function(a){
    items.push({heure:a.heure||"",titre:a.titre,lieu:a.lieu||"",col:AC[a.type]||"var(--i3)",lbl:AT[a.type]||"Réunion"});
  });
  EVTS.filter(function(e){return e.date===ds;}).forEach(function(e){
    items.push({heure:e.heure||"",titre:e.titre,lieu:e.lieu||"",col:EC[e.type]||"var(--i3)",lbl:e.type||"Événement"});
  });
  if(!items.length){
    dl.innerHTML='<div style="font-size:.72rem;color:var(--i4);text-align:center;padding:.85rem 0">Journée libre</div>';
    return;
  }
  items.sort(function(a,b){return (a.heure||"99")>(b.heure||"99")?1:-1;});
  dl.innerHTML=items.map(function(it){
    return '<div style="display:flex;gap:8px;align-items:flex-start;padding:.45rem 0;border-bottom:1px solid var(--w2)">'
      +'<div style="border-left:3px solid '+it.col+';padding-left:7px;flex:1">'
      +'<div style="font-size:.76rem;font-weight:600;color:var(--ink)">'+it.titre+'</div>'
      +'<div style="font-size:.64rem;color:var(--i3)">'+(it.heure?it.heure+" · ":"")+it.lbl+(it.lieu?" · "+it.lieu:"")+'</div>'
      +'</div></div>';
  }).join("");
}

function renderWidgetSig(){
  var sl=$("wg-sig-list"); if(!sl)return;
  var sub=$("wg-sig-sub"); 
  var nb=SIGN.filter(function(s){return s.statut==="Nouveau";}).length;
  if(sub) sub.textContent=nb+" nouveau"+(nb>1?"x":"")+" · "+SIGN.length+" total";
  
  var recent=SIGN.filter(function(s){return s.statut!=="Résolu"&&s.statut!=="Non retenu";}).slice(0,5);
  if(!recent.length){
    sl.innerHTML='<div style="font-size:.72rem;color:var(--i4);text-align:center;padding:.75rem 0">&#x2705; Aucun incident ouvert</div>';
    return;
  }
  var SIGCOL={Nouveau:"var(--red)",En_cours:"var(--amber)",Resolu:"var(--g4)"};
  sl.innerHTML=recent.map(function(s){
    var col=s.statut==="Nouveau"?"var(--red)":s.statut==="En cours"?"var(--amber)":"var(--g4)";
    return '<div style="display:flex;gap:8px;align-items:center;padding:.45rem 0;border-bottom:1px solid var(--w2);cursor:pointer" onclick="openSig('+s.id+')">'
      +'<div style="width:7px;height:7px;border-radius:50%;background:'+col+';flex-shrink:0"></div>'
      +'<div style="flex:1;min-width:0">'
      +'<div style="font-size:.74rem;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+s.titre+'</div>'
      +'<div style="font-size:.63rem;color:var(--i3)">'+s.lieu+(s.type?" · "+s.type:"")+'</div>'
      +'</div>'
      +'<span style="font-size:.6rem;font-weight:700;padding:1px 6px;border-radius:6px;background:'+col+'18;color:'+col+';flex-shrink:0">'+s.statut+'</span>'
      +'</div>';
  }).join("");
}

function renderWidgetMandat(){
  var fill=$("wg-mandat-fill"), pct=$("wg-mandat-pct");
  if(!fill||!P.length) return;
  var re=P.filter(function(p){var s=ST[p.id]||p.statut||"";return s.toLowerCase().indexOf("alis")>=0;}).length;
  var pc=Math.round(re/P.length*100);
  fill.style.width=pc+"%";
  if(pct) pct.textContent=pc+"% ("+re+"/"+P.length+")";
  
  var bib=$("wg-bib-cnt");
  if(bib) bib.textContent=BIBLIO.length+" document"+(BIBLIO.length>1?"s":"")+" archivé"+(BIBLIO.length>1?"s":"");
}

/* Surcharger renderHeroAccueil pour la page today */
function renderHeroAccueil(){
  var now=new Date();
  var h=now.getHours();
  var salut=h<5?"Bonne nuit":h<12?"Bonjour":h<18?"Bon après-midi":"Bonsoir";
  var JOURS_L=["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];
  var MOIS_L=["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
  var av=$("hero-av"),bj=$("hero-bonjour"),rl=$("hero-role"),ct=$("hero-citation");
  var db=$("hero-date-big"),mo=$("hero-mois");
  var CITATIONS=[
    "La commune est la cellule vivante de la démocratie.",
    "Servir Vizille, c'est servir ses habitants au quotidien.",
    "Mandat 2026-2032 — construire ensemble l'avenir de Vizille.",
    "Chaque decision compte, meme la plus petite ameliore une vie.",
    "L'action municipale c'est du concret : une rue refaite, un enfant accueilli.",
    "Etre elu, c'est avoir la confiance de ses voisins. Cela oblige.",
    "Vizille a une histoire extraordinaire — son avenir est entre nos mains.",
    "Le service public local est le plus proche des gens.",
  ];
  if(av){
    if(ME.photo){
      av.innerHTML='<img src="'+ME.photo+'" style="width:100%;height:100%;object-fit:cover;object-position:'+(ME.photoPos||"center center")+';border-radius:14px" onerror="hideImg(this)">';
      av.style.background=ME.color||"var(--g4)";
    } else {
      av.textContent=ME.avatar||"?";
      av.style.background=ME.color||"var(--g4)";
    }
  }
  if(bj) bj.textContent=salut+", "+ME.nom.split(" ")[0]+" !";
  if(rl) rl.textContent=(ME.role||"");
  if(db) db.textContent=now.getDate();
  if(mo) mo.textContent=JOURS_L[now.getDay()]+" "+now.toLocaleDateString("fr-FR",{month:"long",year:"numeric"});
  if(ct) ct.textContent=CITATIONS[now.getDate()%CITATIONS.length];
  var topAv=$("top-av-btn");
  if(topAv){topAv.textContent=ME.avatar||"?";topAv.style.background=ME.color||"var(--g4)";}
}

/* Surcharger renderShortcuts — plus utilisé sur l'accueil v2, on garde pour compat */
function renderShortcuts(){}



/* ── WIDGET TCHAT ACCUEIL ────────────────────────────────────────────────── */
// _chatLast → _chatLast

function wgRenderMsgs(msgs) {
  var el2 = $("wg-chat-msgs"); if(!el2) return;
  if(!msgs.length) {
    el2.innerHTML = '<div style="font-size:.72rem;color:var(--i4);text-align:center;padding:1rem 0">Aucun message — soyez le premier !</div>';
    return;
  }
  el2.innerHTML = msgs.slice(-20).map(function(m) {
    var isMe = m.auteur === ME.nom || m.avatar === ME.avatar;
    return '<div style="display:flex;flex-direction:column;gap:1px;align-items:'+(isMe?"flex-end":"flex-start")+'">'
      + '<div style="font-size:.58rem;color:var(--i4);padding:0 4px">'+m.auteur+" · "+(m.ts||m.created_at||'')+'/div>'
      + '<div style="background:'+(isMe?"var(--g3)":"#fff")+';color:'+(isMe?"#fff":"var(--ink)")+';border-radius:'+(isMe?"10px 10px 3px 10px":"10px 10px 10px 3px")+';padding:.45rem .65rem;font-size:.74rem;max-width:88%;box-shadow:var(--s1);border:1px solid '+(isMe?"var(--g3)":"var(--w2)")+';line-height:1.45">'+m.texte+'</div>'
      + '</div>';
  }).join("");
  el2.scrollTop = el2.scrollHeight;
}

function wgPollChat() {
  var ch = v("wg-chat-ch") || "general";
  apiGet("/api/chat?channel="+ch+"&since="+_chatLast).then(function(d) {
    if(d.ok && d.messages && d.messages.length) {
      var _eiw=CHAT.map(function(m){return m.id;});var _nww=d.messages.filter(function(m){return _eiw.indexOf(m.id)<0;});if(_nww.length){CHAT=CHAT.concat(_nww);_chatLast=d.lastId;wgRenderMsgs(CHAT.filter(function(m){return m.channel===ch;}));var _bw=$("wg-chat-badge");if(_bw)_bw.style.display="block";}
    }
  });
}

function wgSwitchCh() {
  CHAT = []; _chatLast = 0;
  var badge = $("wg-chat-badge");
  if(badge) badge.style.display = "none";
  // Charger l'historique du canal
  var ch = v("wg-chat-ch") || "general";
  apiGet("/api/chat?channel="+ch+"&since=0").then(function(d) {
    if(d.ok) {
      CHAT = d.messages || [];
      _chatLast = d.lastId || 0;
      wgRenderMsgs(CHAT);
    }
  });
}

function wgResetChat(selId){
  var sel=document.getElementById(selId);
  var ch=sel?sel.value:'general';
  if(!confirm('Vider ce canal ?'))return;
  fetch('/api/chat?channel='+ch,{method:'DELETE',credentials:'include'})
    .then(function(r){return r.json();})
    .then(function(d){
      if(d.ok){
        // Vider le widget
        var msgsId=selId==='wg-chat-ch'?'wg-chat-msgs':'wg-chat-msgs2';
        var el=document.getElementById(msgsId);if(el)el.innerHTML='';
        // Vider aussi le panel tchat si sur le meme canal
        if(v('chat-ch')===ch){CHAT=[];renderChatMsgs([]);}
        toast('🗑 Canal vidé');
      }
    });
}
function wgSendMsg() {
  var inp = $("wg-chat-inp"), txt = inp ? inp.value.trim() : "";
  if(!txt) return;
  inp.value = "";
  var ch = v("wg-chat-ch") || "general";
  apiPost("/api/chat", {channel:ch, auteur:ME.nom, avatar:ME.avatar, texte:txt})
    .then(function(d) {
      if(d.ok&&d.message){var _eiws=CHAT.map(function(m){return m.id;});if(_eiws.indexOf(d.message.id)<0)CHAT.push(d.message);if(d.message.id&&d.message.id>_chatLast)_chatLast=d.message.id;wgRenderMsgs(CHAT.filter(function(m){return m.channel===ch;}));var _bws=$("wg-chat-badge");if(_bws)_bws.style.display="none";}
    });
}
function wgSendMsg2(){
  var inp=$('wg-chat-inp2');
  if(!inp||!inp.value.trim())return;
  var ch=($('wg-chat-ch2')||{value:'general'}).value;
  fetch('/api/chat',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({channel:ch,auteur:ME.nom,avatar:ME.avatar,texte:inp.value.trim()})})
  .then(function(r){return r.json();}).then(function(){inp.value='';wgLoadChat2();});
}
function wgLoadChat2(){
  var ch=($('wg-chat-ch2')||{value:'general'}).value;
  fetch('/api/chat?channel='+ch,{headers:{'Authorization':'Basic '+btoa(ME.username+':'+ME._pwd)}})
  .then(function(r){return r.json();}).then(function(d){
    var box=$('wg-chat-msgs2');if(!box)return;
    var msgs=d.messages||[];
    box.innerHTML=msgs.length?msgs.slice(-15).map(function(m){
      var isMe=m.auteur===ME.nom;
      return '<div class="msg-w'+(isMe?' me':'')+'"><div class="msg-meta">'+m.auteur+' · '+(m.ts||m.created_at||'')+'</div><div class="msg-bub">'+m.texte+'</div></div>';
    }).join(''):'<div style="font-size:.72rem;color:var(--i4);text-align:center;padding:1rem">Aucun message</div>';
    box.scrollTop=box.scrollHeight;
  });
}
function wgSwitchCh2(){wgLoadChat2();}

function initWidgetChat() {
  wgSwitchCh();
  setInterval(wgPollChat, 8000);
}


function renderNextMtg(){
  var now=new Date().toISOString().slice(0,10);
  var next=AG.filter(function(a){return a.date>=now;}).sort(function(a,b){return a.date>b.date?1:-1;})[0];
  var wrap=$("next-mtg"); if(!wrap)return;
  if(!next){wrap.innerHTML="";return;}
  var TMAP={bureau:"Bureau municipal",commission:"Commission",conseil:"Conseil municipal",autre:"Autre"};
  wrap.innerHTML='<div class="nmtg" onclick="navToAgenda()">'
    +'<div class="nmtg-db"><div class="nmtg-d">'+next.date.slice(8)+'</div><div class="nmtg-m">'+MOIS[+next.date.slice(5,7)-1]+'</div></div>'
    +'<div><div class="nmtg-t">Prochaine réunion : '+next.titre+'</div>'
    +'<div class="nmtg-s">'+(next.heure?"🕐 "+next.heure+"  ":"")+(next.lieu?"📍 "+next.lieu:"")+'</div></div>'
    +'<span class="nmtg-b">'+(TMAP[next.type]||next.type||"Autre")+'</span>'
    +'</div>';
}

// ── TÂCHES ───────────────────────────────────────────────────────────────────
function renderTasks(){
  var tl=$("task-list"); if(!tl)return;
  if(!TASKS.length){tl.innerHTML='<div style="font-size:.74rem;color:var(--i4);padding:.5rem 0">Aucune tâche.</div>';return;}
  tl.innerHTML=TASKS.map(function(t){
    return '<div class="tsk" onclick="toggleTask('+t.id+')">'
      +'<div class="tsk-cb'+(t.done?" done":"")+'">'+( t.done?"✓":"")+' </div>'
      +'<div class="tsk-tx'+(t.done?" done":"")+'">'+t.titre+'</div>'
      +'<button class="tsk-del" onclick="event.stopPropagation();delTask('+t.id+')">×</button>'
      +'</div>';
  }).join("");
}
function addTask(){var i=$("task-inp"),ti=i.value.trim();if(!ti)return;apiPost("/api/tasks",{titre:ti}).then(function(d){if(d.ok){TASKS.push(d.item);renderTasks();i.value="";}});}
function toggleTask(id){apiPut("/api/tasks/"+id+"/done",{}).then(function(d){if(d.ok){TASKS=TASKS.map(function(t){return t.id===id?Object.assign({},t,{done:!t.done}):t;});renderTasks();}});}
function delTask(id){apiDel("/api/tasks/"+id).then(function(d){if(d.ok){TASKS=TASKS.filter(function(t){return t.id!==id;});renderTasks();}});}

// ── ANNONCES ─────────────────────────────────────────────────────────────────
var ANN_COL={normal:"var(--g4)",important:"var(--amber)",urgent:"var(--red)"};
function renderAnn(){
  var al=$("ann-list"); if(!al)return;
  if(!ANN.length){al.innerHTML='<div class="empty" style="padding:1.5rem 0"><div class="empty-ico" style="font-size:1.5rem">📭</div><div class="empty-s">Aucune annonce</div></div>';return;}
  al.innerHTML=ANN.slice(0,8).map(function(a){
    return '<div class="ann">'
      +'<div class="ann-dot" style="background:'+(ANN_COL[a.priorite]||"var(--g4)")+'"></div>'
      +'<div style="flex:1"><div class="ann-t">'+a.titre+'</div>'+(a.texte?'<div class="ann-tx">'+a.texte+'</div>':'')+'<div class="ann-m">'+a.ts+'</div></div>'
      +'<button class="btn btn-d btn-sm" style="flex-shrink:0" onclick="delAnn('+a.id+')">×</button>'
      +'</div>';
  }).join("");
}
function svAnn(){
  var d={titre:v("ann-ti"),texte:v("ann-tx"),priorite:v("ann-pr")};
  if(!d.titre){toast("Titre obligatoire");return;}
  apiPost("/api/annonces",d).then(function(r){if(r.ok){ANN.unshift(r.item);renderAnn();cm();toast("Annonce publiée");}});
}
function delAnn(id){apiDel("/api/annonces/"+id).then(function(d){if(d.ok){ANN=ANN.filter(function(a){return a.id!==id;});renderAnn();}});}

// ── GUIDES ───────────────────────────────────────────────────────────────────
function toggleGuide(el){
  el.classList.toggle("open");
  var arr=el.querySelector(".guide-arr");
  if(arr) arr.style.transform=el.classList.contains("open")?"rotate(90deg)":"none";
}
function fmtGuide(txt){
  return txt.split(String.fromCharCode(10)).map(function(line){
    var t=line.trim();
    if(!t) return '<div style="height:.4rem"></div>';
    if(t===t.toUpperCase()&&t.length>3&&!/^[•→]/.test(t)){
      return '<div style="font-size:.72rem;font-weight:800;color:var(--g2);text-transform:uppercase;letter-spacing:.07em;margin:.85rem 0 .35rem;padding-top:.5rem;border-top:1px solid var(--g8)">'+t+'</div>';
    }
    if(t.startsWith('•')){
      return '<div style="display:flex;gap:7px;margin:.2rem 0"><span style="color:var(--g4);flex-shrink:0;margin-top:.05rem">•</span><span style="font-size:.77rem;color:var(--i2);line-height:1.55">'+t.slice(1).trim()+'</span></div>';
    }
    if(t.startsWith('→')){
      return '<div style="display:flex;gap:7px;margin:.3rem 0;background:var(--g8);border-radius:6px;padding:.45rem .6rem"><span style="color:var(--g3);flex-shrink:0">→</span><span style="font-size:.77rem;color:var(--g2);line-height:1.55;font-weight:600">'+t.slice(1).trim()+'</span></div>';
    }
    if(/^[0-9]+\./.test(t)){
      var num=t.match(/^([0-9]+)\.(.*)$/);
      return '<div style="display:flex;gap:8px;margin:.25rem 0"><span style="min-width:18px;height:18px;background:var(--g3);color:#fff;border-radius:50%;font-size:.62rem;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:.1rem">'+num[1]+'</span><span style="font-size:.77rem;color:var(--i2);line-height:1.55">'+num[2].trim()+'</span></div>';
    }
    return '<p style="font-size:.77rem;color:var(--i2);line-height:1.6;margin:.2rem 0">'+t+'</p>';
  }).join('');
}

function buildGuides(){
  var gl=$("guides-list"); if(!gl)return;
  if(!GUIDES||!GUIDES.length){
    gl.innerHTML='<div class="empty"><div class="empty-ico">&#x1F4D6;</div><div class="empty-t">Fiches en cours de chargement</div></div>';
    return;
  }
  gl.innerHTML=GUIDES.map(function(g,i){
    var preview=g.contenu.split(String.fromCharCode(10)).find(function(l){return l.trim().length>20;})||'';
    return '<div class="guide" onclick="toggleGuide(this)">'
      +'<div class="guide-h">'
      +'<div class="guide-ico">'+g.icon+'</div>'
      +'<div style="flex:1">'
      +'<div class="guide-t">'+g.titre+'</div>'
      +'<div style="font-size:.67rem;color:var(--i3);margin-top:2px" class="guide-prev">'+preview.substring(0,80)+'&#x2026;</div>'
      +'</div>'
      +'<div class="guide-arr" style="color:var(--i4);font-size:.75rem;flex-shrink:0;margin-left:10px;transition:transform .2s">&#x276F;</div>'
      +'</div>'
      +'<div class="guide-full" style="padding:1rem 1.1rem 1.25rem">'+fmtGuide(g.contenu)+'</div>'
      +'</div>';
  }).join("");
}

// ── RESSOURCES ───────────────────────────────────────────────────────────────
function buildRess(){
  if(!RESS||!RESS.length) return;
  var html=RESS.map(function(r){
    return '<a href="'+r.url+'" target="_blank" rel="noopener" class="ress-c" style="text-decoration:none">'
      +'<div class="ress-ico">'+r.icon+'</div>'
      +'<div style="flex:1">'
      +'<div class="ress-n">'+r.titre+'</div>'
      +'<div class="ress-d">'+r.desc+'</div>'
      +'<div style="font-size:.63rem;color:var(--g4);margin-top:3px;word-break:break-all">'+r.url+'</div>'
      +'</div>'
      +'<div style="font-size:.75rem;color:var(--g5);flex-shrink:0;margin-left:6px">&#x2197;</div>'
      +'</a>';
  }).join("");
  var rl=$("ress-list"); if(rl) rl.innerHTML=html;
  var rl2=$("ress-list-2"); if(rl2) rl2.innerHTML=html;
  // Charger les articles
  loadArticles();
}
var ARTICLES=[];
function loadArticles(){
  apiGet('/api/articles').then(function(data){
    ARTICLES=Array.isArray(data)?data:[];
    renderArticles();
  }).catch(function(e){console.log('Erreur chargement articles:',e);});
}
var ART_COLORS=['#1a3a2a','#6d28d9','#0891b2','#b45309','#dc2626','#2563eb','#9333ea','#065f46','#c2410c','#1d4ed8'];
var ART_ICONS=['📰','📋','💡','⚖️','🏛','🌿','💶','🏗','🤝','📊'];
function renderArticles(){
  var el=$('articles-list');if(!el)return;
  if(!ARTICLES.length){
    var msg=isAdmin()?'Cliquez <b>+ Publier un article</b> pour partager une ressource':'Les articles de veille apparaîtront ici';
    el.innerHTML='<div style="text-align:center;padding:3rem 1rem;color:var(--i3)"><div style="font-size:2.5rem;margin-bottom:.75rem">📰</div><div style="font-size:.88rem;font-weight:600">Aucun article pour le moment</div><div style="font-size:.78rem;margin-top:.4rem">'+msg+'</div></div>';
    return;
  }
  var recents=ARTICLES.slice(0,12);
  var anciens=ARTICLES.slice(12);
  // Grille 4 colonnes pour les 12 plus récents
  var html='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px">';
  for(var idx=0;idx<recents.length;idx++){
    var a=recents[idx];
    var date=a.created_at?a.created_at.split(' ')[0]:'';
    var domain='';try{domain=new URL(a.url).hostname.replace('www.','');}catch(e){}
    var col=ART_COLORS[idx%ART_COLORS.length];
    var ico=ART_ICONS[idx%ART_ICONS.length];
    var delBtn='<div style="padding:.4rem .75rem .6rem;border-top:1px solid var(--w2)"><button onclick="delArticle('+a.id+')" style="background:#fee2e2;border:1px solid #fca5a5;color:#dc2626;font-size:.7rem;cursor:pointer;border-radius:8px;padding:5px 12px;font-weight:600;width:100%">🗑 Supprimer</button></div>';
    html+='<div class="art-card" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:var(--s1);height:100%;display:flex;flex-direction:column">'
      +'<a href="'+(a.url||'#')+'" target="_blank" rel="noopener" style="text-decoration:none;display:flex;flex-direction:column;flex:1;cursor:pointer">'
      +'<div style="background:linear-gradient(135deg,'+col+','+col+'cc);padding:1rem;color:#fff;position:relative;overflow:hidden">'
      +'<div style="position:absolute;top:-15px;right:-15px;width:60px;height:60px;border-radius:50%;background:rgba(255,255,255,.08)"></div>'
      +'<div style="font-size:1.3rem;margin-bottom:.5rem">'+ico+'</div>'
      +'<div style="font-size:.82rem;font-weight:700;font-family:var(--fd);line-height:1.3">'+a.titre+'</div>'
      +'</div>'
      +'<div style="padding:.75rem 1rem;flex:1;display:flex;flex-direction:column">'
      +(a.resume?'<div style="font-size:.72rem;color:var(--i2);line-height:1.55;margin-bottom:.5rem;flex:1;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">'+a.resume+'</div>':'<div style="flex:1"></div>')
      +'<div style="display:flex;align-items:center;gap:6px;font-size:.62rem;color:var(--i4)">'
      +(a.source?'<span style="font-weight:600;color:var(--g3);background:var(--g8);padding:1px 6px;border-radius:4px">'+a.source+'</span>':'')
      +'<span>'+date+'</span>'
      +'<span style="margin-left:auto;color:var(--g3);font-weight:600">Lire →</span>'
      +'</div></div></a>'
      +delBtn
      +'</div>';
  }
  html+='</div>';
  // Liste compacte pour les anciens
  if(anciens.length>0){
    html+='<div style="margin-top:1.5rem;padding-top:1rem;border-top:1px solid var(--w2)">';
    html+='<div style="font-size:.72rem;font-weight:700;color:var(--i3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:.6rem">📦 Archives ('+anciens.length+' articles)</div>';
    html+='<div style="display:flex;flex-direction:column;gap:4px">';
    for(var j=0;j<anciens.length;j++){
      var b=anciens[j];
      var bdate=b.created_at?b.created_at.split(' ')[0]:'';
      var bdel='<button onclick="event.preventDefault();event.stopPropagation();delArticle('+b.id+')" style="background:#fee2e2;border:none;font-size:.62rem;color:#dc2626;cursor:pointer;margin-left:4px;border-radius:4px;padding:2px 6px">suppr.</button>';
      html+='<a href="'+(b.url||'#')+'" target="_blank" rel="noopener" style="text-decoration:none;display:flex;align-items:center;gap:8px;padding:.45rem .7rem;background:#fff;border-radius:8px;border:1px solid var(--w2);font-size:.75rem;transition:background .15s" class="art-card">'
        +'<span style="color:var(--i4);font-size:.65rem;white-space:nowrap">'+bdate+'</span>'
        +'<span style="font-weight:600;color:var(--ink);flex:1">'+b.titre+'</span>'
        +(b.source?'<span style="font-size:.6rem;color:var(--g3);background:var(--g8);padding:1px 5px;border-radius:3px">'+b.source+'</span>':'')
        +'<span style="color:var(--g4);font-size:.7rem">↗</span>'
        +bdel+'</a>';
    }
    html+='</div></div>';
  }
  el.innerHTML=html;
}
function saveArticle(){
  var titre=v('art-titre'),url=v('art-url'),source=v('art-source'),resume=v('art-resume'),tags=v('art-tags');
  if(!titre||!url){toast('Titre et URL requis');return;}
  apiPost('/api/articles',{titre:titre,url:url,source:source,resume:resume,tags:tags}).then(function(r){
    if(r.ok){cm();ARTICLES.unshift(r.item);renderArticles();toast('Article publié !');
    ['art-titre','art-url','art-source','art-resume','art-tags'].forEach(function(id){var e=$(id);if(e)e.value='';});}
  });
}
function delArticle(id){
  if(!confirm('Supprimer cet article ?'))return;
  apiDel('/api/articles/'+id).then(function(r){if(r.ok){ARTICLES=ARTICLES.filter(function(a){return a.id!==id;});renderArticles();toast('Article supprimé');}});
}

// ── AGENDA ───────────────────────────────────────────────────────────────────
var ATMAP={bureau:"Bureau municipal",commission:"Commission",conseil:"Conseil municipal",autre:"Autre"};
var ATCLS={bureau:"at-b",commission:"at-c",conseil:"at-k",autre:"at-a"};
function renderAg(){
  var _pb=document.getElementById("panel-body");
  var al=(_pb&&_pb.querySelector("#ag-list"))||$("ag-list"); if(!al)return;
  var now=new Date().toISOString().slice(0,10);
  var sorted=AG.slice().sort(function(a,b){return a.date>b.date?1:-1;});
  al.innerHTML=sorted.map(function(e){
    var past=e.date<now;
    var tyLbl={bureau:"Bureau",commission:"Commission",conseil:"Conseil",autre:"Autre"}[e.type]||e.type||"Autre";
    var tyCls={bureau:"at-b",commission:"at-c",conseil:"at-cs",autre:"at-a"}[e.type]||"at-a";
    return '<div class="agc'+(past?" past":"")+'" data-agid="'+e.id+'">'
      +'<div class="agc-db"><div class="agc-day">'+e.date.slice(8)+'</div><div class="agc-mon">'+MOIS[+e.date.slice(5,7)-1]+'</div></div>'
      +'<div class="agc-inf">'
      +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">'
      +'<span class="agc-t">'+e.titre+'</span>'
      +'<span class="atch '+tyCls+'">'+tyLbl+'</span>'
      +'</div>'
      +'<div class="agc-m">'+(e.heure?"🕐 "+e.heure+"  ":"")+(e.lieu?"📍 "+e.lieu:"")+'</div>'
      +(e.notes?'<div class="agc-n">'+e.notes+'</div>':'')
      +'</div>'
      +'<div style="display:flex;flex-direction:column;gap:5px;flex-shrink:0;align-self:flex-start">'
      +'<button class="btn btn-s btn-sm" onclick="editAgInline('+e.id+',this)" title="Modifier">✏️</button>'
      +'<button class="btn btn-d btn-sm" onclick="delAg('+e.id+')">×</button>'
      +'</div>'
      +'</div>';
  }).join("")||'<div class="empty"><div class="empty-ico">📅</div><div class="empty-t">Aucune réunion</div><div class="empty-s">Cliquez sur + Ajouter.</div></div>';
}

function editAgInline(id, btn){
  var e=AG.find(function(a){return a.id===id;}); if(!e)return;
  var card=btn.closest ? btn.closest("[data-agid]") : (function(){var n=btn;while(n&&n.getAttribute&&!n.getAttribute("data-agid"))n=n.parentNode;return n;})();
  if(!card)return;
  card.innerHTML=
    '<div style="flex:1;display:flex;flex-direction:column;gap:8px;padding:2px">'
    +'<div style="display:grid;grid-template-columns:1fr auto;gap:8px">'
    +'<input id="ae-ti-'+id+'" class="fi" value="'+e.titre.replace(/"/g,"&quot;")+'" placeholder="Titre *" style="font-size:.79rem;padding:6px 9px">'
    +'<input id="ae-d-'+id+'" class="fi" type="date" value="'+e.date+'" style="font-size:.79rem;padding:6px 9px">'
    +'</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">'
    +'<input id="ae-h-'+id+'" class="fi" value="'+( e.heure||"")+'" placeholder="Heure ex: 18h30" style="font-size:.79rem;padding:6px 9px">'
    +'<input id="ae-l-'+id+'" class="fi" value="'+( e.lieu||"").replace(/"/g,"&quot;")+'" placeholder="Lieu" style="font-size:.79rem;padding:6px 9px">'
    +'<select id="ae-ty-'+id+'" class="fi" style="font-size:.79rem;padding:6px 9px">'
    +'<option value="bureau"'+(e.type==="bureau"?" selected":"")+'>Bureau</option>'
    +'<option value="commission"'+(e.type==="commission"?" selected":"")+'>Commission</option>'
    +'<option value="conseil"'+(e.type==="conseil"?" selected":"")+'>Conseil</option>'
    +'<option value="autre"'+(e.type==="autre"?" selected":"")+'>Autre</option>'
    +'</select></div>'
    +'<input id="ae-n-'+id+'" class="fi" value="'+( e.notes||"").replace(/"/g,"&quot;")+'" placeholder="Notes" style="font-size:.79rem;padding:6px 9px">'
    +'<div style="display:flex;gap:8px;justify-content:flex-end">'
    +'<button onclick="renderAg()" class="btn btn-g btn-sm">Annuler</button>'
    +'<button onclick="saveAgInline('+id+')" class="btn btn-p btn-sm">💾 Enregistrer</button>'
    +'</div></div>';
}

function saveAgInline(id){
  var titre=(document.getElementById("ae-ti-"+id)||{value:""}).value.trim();
  if(!titre){toast("Titre obligatoire");return;}
  var d={
    titre:titre,
    date:(document.getElementById("ae-d-"+id)||{value:""}).value,
    heure:(document.getElementById("ae-h-"+id)||{value:""}).value,
    lieu:(document.getElementById("ae-l-"+id)||{value:""}).value,
    type:(document.getElementById("ae-ty-"+id)||{value:"autre"}).value,
    notes:(document.getElementById("ae-n-"+id)||{value:""}).value
  };
  apiPatch("/api/agenda/"+id,d).then(function(r){
    if(r&&r.ok){
      AG=AG.map(function(a){return a.id===id?Object.assign({},a,d):a;});
      renderAg();renderNextMtg();renderWidgetAgenda();
      toast("Réunion mise à jour !");
    } else {toast("Erreur",3000);}
  });
}

function svAg(){
  var d={titre:v("ag-ti"),date:v("ag-d"),heure:v("ag-h"),lieu:v("ag-l"),type:v("ag-ty"),notes:v("ag-n")};
  if(!d.titre||!d.date){toast("Titre et date obligatoires");return;}
  apiPost("/api/agenda",d).then(function(r){if(r.ok){AG.push(r.item);cm();renderAg();renderNextMtg();renderWidgetAgenda();toast("Réunion ajoutée");}});
}
function delAg(id){if(!confirm("Supprimer cette réunion ?"))return;apiDel("/api/agenda/"+id).then(function(d){if(d.ok){AG=AG.filter(function(a){return a.id!==id;});renderAg();renderNextMtg();renderWidgetAgenda();}});}

// ── COMPTES RENDUS ───────────────────────────────────────────────────────────
var CR_COM_COL={"Bureau municipal":"#1d3d2b","Conseil municipal":"#2d5a40","Culture, Patrimoine & Jumelages":"#8B5CF6","Mobilités":"#3B82F6","Transition écologique":"#10B981","Action sociale":"#F59E0B","Concertation citoyenne":"#6366F1","Animations de proximité":"#EC4899","Enfance/Jeunesse":"#F97316","Tranquillité publique":"#EF4444","Travaux & Urbanisme":"#84CC16","Santé":"#06B6D4"};

function renderCR(){
  var cl=$("cr-list"); if(!cl)return;
  var fc=$("cr-filt-comm");
  if(fc&&fc.options.length<=1){
    var comms=["Bureau municipal","Conseil municipal"];
    Object.keys(COMM).forEach(function(c){comms.push(c);});
    comms.forEach(function(c){var o=document.createElement("option");o.value=c;o.textContent=c;fc.appendChild(o);});
  }
  var fv=fc?fc.value:"";
  var filtered=CRS.filter(function(cr){return !fv||cr.commission===fv;});
  cl.innerHTML=filtered.length?filtered.map(function(cr){
    var col=CR_COM_COL[cr.commission]||"var(--g3)";
    return '<div class="crc" onclick="openCR('+cr.id+')">'
      +'<div class="crc-head">'
      +'<div class="crc-ico" style="background:'+col+'22;border:1px solid '+col+'44"><span style="color:'+col+'">📝</span></div>'
      +'<div style="flex:1">'
      +'<div class="crc-t">'+cr.titre+'</div>'
      +'<div class="crc-m">'+cr.commission+(cr.date?" · "+cr.date:"")+(cr.redige_par?" · "+cr.redige_par:"")+'</div>'
      +'</div>'
      +(cr.url?'<a href="'+cr.url+'" target="_blank" class="btn btn-s btn-sm" onclick="event.stopPropagation()" style="flex-shrink:0">📄 Doc</a>':"")
      +'</div>'
      +(cr.content?'<div class="crc-prev">'+cr.content.substring(0,120)+'…</div>':"")
      +'</div>';
  }).join(""):'<div class="empty"><div class="empty-ico">📝</div><div class="empty-t">Aucun compte rendu</div><div class="empty-s">Cliquez sur + Nouveau CR.</div></div>';
}

function svCR(){
  var d={titre:v("cr-ti"),commission:v("cr-comm"),date:v("cr-date"),redige_par:v("cr-par"),participants:v("cr-part"),odj:v("cr-odj"),content:v("cr-content"),next_steps:v("cr-next"),url:v("cr-url")};
  if(!d.titre||!d.content){toast("Titre et contenu obligatoires");return;}
  var fi=document.getElementById("cr-file");
  var file=fi&&fi.files&&fi.files[0]?fi.files[0]:null;
  function doSave(url){
    d.url=url||d.url;
    apiPost("/api/cr",d).then(function(r){if(r.ok){
        draftClear("cr_content"); draftClear("cr_next");
        var inp=document.getElementById("cr-content"); if(inp)inp.style.background="";
        var inp2=document.getElementById("cr-next"); if(inp2)inp2.style.background="";
        CRS.unshift(r.item);cm();renderCR();toast("CR enregistré ✓");}});
  }
  if(file){
    var btn=document.querySelector('[onclick="svCR()"]');
    if(btn){btn.disabled=true;btn.textContent="⏳ Upload…";}
    var form=new FormData();
    form.append("file",file,file.name);
    form.append("titre",d.titre);
    form.append("type","Compte rendu");
    var xhr=new XMLHttpRequest();
    xhr.open("POST","/api/upload");
    xhr.withCredentials=true;
    xhr.onload=function(){
      var r=JSON.parse(xhr.responseText||"{}");
      doSave(r.ok?r.url:d.url);
    };
    xhr.onerror=function(){doSave(d.url);};
    xhr.send(form);
  } else {
    doSave(d.url);
  }
}

function crPreviewFile(input){
  var file=input.files[0]; if(!file)return;
  var prev=document.getElementById("cr-file-preview");
  if(prev){prev.style.display="block";prev.textContent="📎 "+file.name+" ("+Math.round(file.size/1024)+" Ko)";}
}

function openCR(id){
  _crId=id;
  var cr=CRS.find(function(c){return c.id===id;});if(!cr)return;
  var col=CR_COM_COL[cr.commission]||"var(--g3)";
  $("crv-title").textContent="📝 "+cr.titre;
  $("crv-body").innerHTML='<div style="background:'+col+'15;border-left:3px solid '+col+';border-radius:var(--r);padding:.85rem 1rem;margin-bottom:1rem">'
    +'<div style="font-size:.82rem;font-weight:700;margin-bottom:.2rem">'+cr.titre+'</div>'
    +'<div style="font-size:.72rem;color:var(--i3)">'+cr.commission+(cr.date?" · "+cr.date:"")+(cr.redige_par?" · Rédigé par "+cr.redige_par:"")+'</div>'
    +'</div>'
    +(cr.participants?'<div style="font-size:.75rem;color:var(--i3);margin-bottom:.75rem"><strong>Participants :</strong> '+cr.participants+'</div>':"")
    +(cr.odj?'<div style="font-size:.75rem;color:var(--i2);margin-bottom:.75rem"><strong>Ordre du jour :</strong> '+cr.odj+'</div>':"")
    +'<div style="font-size:.78rem;color:var(--i2);line-height:1.72;margin-bottom:.85rem;white-space:pre-wrap">'+cr.content+'</div>'
    +(cr.next_steps?'<div style="background:var(--g8);border-radius:var(--r);padding:.75rem;font-size:.76rem;color:var(--g2)"><strong>Prochaines étapes :</strong><br>'+cr.next_steps+'</div>':"")
    +(cr.url?'<div style="margin-top:.85rem;display:flex;gap:8px"><a href="'+cr.url+'" target="_blank" class="btn btn-s" style="font-size:.75rem">'+(cr.url.startsWith('/uploads/')?"⬇️ Télécharger":"🔗 Voir le document")+'</a></div>':"");
  om("cr-view");
}
function delCR(){
  if(!confirm("Supprimer ce compte rendu ?"))return;
  apiDel("/api/cr/"+_crId).then(function(d){if(d.ok){CRS=CRS.filter(function(c){return c.id!==_crId;});cm();renderCR();toast("Supprimé");}});
}

// ── BIBLIOTHÈQUE ─────────────────────────────────────────────────────────────
var BIB_ICONS={"Délibération":"⚖️","Arrêté":"🔏","Rapport":"📊","Compte-rendu":"📝","Budget":"💰","Plan":"🗺","Convention":"🤝","Courrier":"✉️","Autre":"📄"};

// ── BIBLIOTHÈQUE DOCUMENTAIRE — dossiers parents + filtre type ───────────────
var BIBLIO_DOSSIERS = [];
var _bibDosActif = null;   // null=tous, 0=non classé, N=dossier id
var _bibGrpOuvert = {theme:true, nature:false}; // accordéon groupes
var _bibTypeFiltre = '';   // filtre type fichier actif
var _bibAnnee = '';            // filtre année

// Extensions → type affiché
var EXT_TYPE = {
  pdf:'PDF', doc:'Word', docx:'Word', xls:'Excel', xlsx:'Excel',
  eml:'Email', msg:'Email', jpg:'Image', jpeg:'Image', png:'Image',
  gif:'Image', webp:'Image', odt:'Word', ods:'Excel',
  ppt:'PPT', pptx:'PPT', txt:'Texte', csv:'Texte'
};
function getFileType(url){
  if(!url)return'Autre';
  var ext=(url.split('.').pop()||'').toLowerCase();
  return EXT_TYPE[ext]||'Autre';
}
var TYPE_ICONS={'PDF':'📄','Word':'📝','Excel':'📊','Email':'📧','Image':'🖼','PPT':'📽','Texte':'📃','Autre':'📦'};
var TYPE_COLORS={'PDF':'#dc2626','Word':'#2563eb','Excel':'#16a34a','Email':'#c9a227','Image':'#7c3aed','PPT':'#d97706','Texte':'#6b7280','Autre':'#9ca3af'};

function bibLoadDossiers(cb){
  apiGet('/api/biblio/dossiers').then(function(d){
    BIBLIO_DOSSIERS=Array.isArray(d)?d:[];
    if(cb)cb();
  });
}

function renderBiblio(){
  var bl=$("bib-list"); if(!bl)return;
  var q=v("bib-q").toLowerCase();

  // ── Barre filtres NATURE du document ────────────────────────────────────────
  var NATURES=['CR de commission','Délibération','Procès-verbal','Rapport','Étude','Avis','Courrier','Email','Devis','Marché public','Budget','Autre'];
  var ADMIN_NOMS=["Conseil municipal","Bureau municipal","Délibérations","Procès-verbaux","Rapports & Études","Courriers & Emails","Budget & Finances","Marchés publics","Urbanisme & PLU","Administration générale"];
  var typeBar=$("bib-type-bar");
  if(typeBar){
    // Menu 1 : Nature du document
    var selNat=document.createElement('select');
    selNat.className='fsel';
    selNat.style.cssText='font-size:.75rem;max-width:180px';
    selNat.innerHTML='<option value="">📄 Toutes natures</option>'
      +NATURES.map(function(t){return '<option value="'+t+'"'+(_bibTypeFiltre===t?' selected':'')+'>'+t+'</option>';}).join('');
    selNat.addEventListener('change',function(){bibSetType(selNat.value);});
    // Menu 2 : Dossier admin
    var adminDos=BIBLIO_DOSSIERS.filter(function(d){return ADMIN_NOMS.indexOf(d.nom)>=0;});
    var selDos=document.createElement('select');
    selDos.className='fsel';
    selDos.style.cssText='font-size:.75rem;max-width:200px';
    var curAdminDos=adminDos.find(function(d){return d.id===_bibDosActif;})||null;
    selDos.innerHTML='<option value="">📁 Tous dossiers</option>'
      +adminDos.map(function(d){return '<option value="'+d.id+'"'+(_bibDosActif===d.id?' selected':'')+'>'+( d.icone||'📁')+' '+d.nom+'</option>';}).join('');
    selDos.addEventListener('change',function(){bibSetDos(selDos.value?parseInt(selDos.value):null);});
    // Menu 3 : Année (extraite de date_doc)
    var annees=[];
    BIBLIO.forEach(function(b){var a=b.date_doc?b.date_doc.substring(0,4):'';if(a&&annees.indexOf(a)<0)annees.push(a);});
    annees.sort().reverse();
    var selAn=document.createElement('select');
    selAn.className='fsel';
    selAn.style.cssText='font-size:.75rem;max-width:120px';
    selAn.innerHTML='<option value="">📅 Toutes années</option>'
      +annees.map(function(a){return '<option value="'+a+'"'+(_bibAnnee===a?' selected':'')+'>'+a+'</option>';}).join('');
    selAn.addEventListener('change',function(){_bibAnnee=selAn.value;renderBiblio();});
    typeBar.innerHTML='';
    typeBar.style.cssText='display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:.2rem 0';
    typeBar.appendChild(selNat);
    typeBar.appendChild(selDos);
    typeBar.appendChild(selAn);
  }

  // ── Filtrage ──────────────────────────────────────────────────────────────
  var themes=BIBLIO_DOSSIERS.filter(function(d){return d.groupe==='theme';}).sort(function(a,b){return a.nom.localeCompare(b.nom,'fr');});
  var natures=BIBLIO_DOSSIERS.filter(function(d){return d.groupe==='nature';});

  var r=BIBLIO.filter(function(b){
    var matchQ=!q||(b.titre||'').toLowerCase().indexOf(q)>=0||(b.description||'').toLowerCase().indexOf(q)>=0;
    var matchDos=_bibDosActif===null?true:(_bibDosActif===0?!b.dossier_id:b.dossier_id===_bibDosActif);
    var matchType=!_bibTypeFiltre||(b.type||'')=== _bibTypeFiltre;
    var matchAnnee=!_bibAnnee||((b.date_doc||'').substring(0,4)===_bibAnnee);
    return matchQ&&matchDos&&matchType&&matchAnnee;
  });

  el("bib-cnt",r.length+' document'+(r.length>1?'s':''));
  el("sb-bib",BIBLIO.length);

  // ── Sidebar : THÈMES uniquement, toujours visibles ───────────────────────
  var side=$("bib-dossiers");
  if(side){
    function dosItem(d){
      var cnt=BIBLIO.filter(function(b){return b.dossier_id===d.id;}).length;
      var active=_bibDosActif===d.id;
      return '<div onclick="bibSetDos('+d.id+')" style="display:flex;align-items:center;gap:6px;padding:.3rem .5rem .3rem 1rem;border-radius:7px;cursor:pointer;'
        +(active?'background:'+d.couleur+'20;border-left:3px solid '+d.couleur+';':'border-left:3px solid transparent;')
        +'">'
        +'<span style="font-size:.82rem">'+d.icone+'</span>'
        +'<span style="flex:1;font-size:.71rem;font-weight:'+(active?700:400)+';color:'+(active?d.couleur:'var(--i2)')+'">'+d.nom+'</span>'
        +(cnt?'<span style="font-size:.62rem;background:'+(active?d.couleur+'30':'var(--w2)')+';color:'+(active?d.couleur:'var(--i4)')+';padding:0 6px;border-radius:8px">'+cnt+'</span>':'')
        +'</div>';
    }

    var shtml=
      // Tous / Non classé
      '<div style="margin-bottom:.5rem">'
      +'<div onclick="bibSetDos(null)" style="display:flex;align-items:center;gap:7px;padding:.42rem .6rem;border-radius:8px;cursor:pointer;'
      +(_bibDosActif===null?'background:var(--g1);':'')
      +'">'
      +'<span>📚</span><span style="flex:1;font-size:.75rem;font-weight:700;color:'+(_bibDosActif===null?'#fff':'var(--i2)')+'">Tous</span>'
      +'<span style="font-size:.67rem;color:'+(_bibDosActif===null?'rgba(255,255,255,.7)':'var(--i4)')+';font-weight:600">'+BIBLIO.length+'</span>'
      +'</div>'
      +'<div onclick="bibSetDos(0)" style="display:flex;align-items:center;gap:7px;padding:.38rem .6rem;border-radius:8px;cursor:pointer;border-left:3px solid '+(_bibDosActif===0?'var(--g3)':'transparent')+'">'
      +'<span>📄</span><span style="flex:1;font-size:.71rem;color:'+(_bibDosActif===0?'var(--g2)':'var(--i3)')+'">Non classé</span>'
      +'<span style="font-size:.62rem;color:var(--i4)">'+BIBLIO.filter(function(b){return !b.dossier_id;}).length+'</span>'
      +'</div>'
      +'</div>'
      // Séparateur + label THÈMES
      +'<div style="height:1px;background:var(--w2);margin:.2rem .2rem .5rem"></div>'
      +'<div style="font-size:.6rem;font-weight:800;color:var(--i4);text-transform:uppercase;letter-spacing:.08em;padding:.1rem .5rem .4rem">Thèmes projets</div>'
      +themes.filter(function(d){return ["Action sociale","Concertation citoyenne","Culture & Patrimoine","Économie","Enfance / Jeunesse","Mobilités","Métropole","Santé","Tranquillité publique","Transition écologique","Travaux & Urbanisme"].indexOf(d.nom)>=0;}).map(dosItem).join('')
      +'<div style="padding:.3rem .5rem .1rem">'
      +'<button data-grp="theme" onclick="bibNewDos(this.dataset.grp)" style="font-size:.64rem;color:var(--g3);background:none;border:none;cursor:pointer;padding:0">+ Ajouter un thème</button>'
      +'</div>';

    side.innerHTML=shtml;
  }

  // ── Liste documents ───────────────────────────────────────────────────────
  if(!r.length){
    bl.innerHTML='<div class="empty"><div class="empty-ico">📚</div><div class="empty-t">Aucun document</div>'
      +'<div class="empty-s">'+(_bibDosActif&&_bibDosActif!==null?'Ce dossier est vide.':'Ajoutez des documents ou affinez le filtre.')+'</div></div>';
    return;
  }

  bl.innerHTML=r.map(function(b){
    var ftype=getFileType(b.url);
    var fico=TYPE_ICONS[ftype]||'📄';
    var fcol=TYPE_COLORS[ftype]||'#9ca3af';
    var dosTh=BIBLIO_DOSSIERS.find(function(d){return d.id===b.dossier_id;});
    var isLocal=b.url&&b.url.startsWith('/uploads/');
    var isPdf=b.url&&b.url.toLowerCase().endsWith('.pdf');
    var isImg=b.url&&/\.(jpg|jpeg|png|gif|webp)$/i.test(b.url);

    var previewBtn='';
    var previewZone='';
    if(isPdf&&isLocal){
      previewBtn='<button data-url="'+b.url+'" onclick="bibTogglePreview(this,this.dataset.url)" style="background:var(--g8);border:1px solid var(--g7);border-radius:7px;padding:3px 9px;font-size:.69rem;font-weight:600;cursor:pointer;color:var(--g2)">👁 Prévisualiser</button>';
      previewZone='<div class="bib-preview" style="display:none;margin-top:.6rem;border-radius:10px;overflow:hidden;border:1px solid var(--w2)"><iframe style="width:100%;height:400px;border:none" loading="lazy"></iframe></div>';
    } else if(isImg&&isLocal){
      previewZone='<div style="margin-top:.6rem"><img src="'+b.url+'" style="max-width:100%;max-height:220px;border-radius:10px;border:1px solid var(--w2);object-fit:contain" loading="lazy"></div>';
    }

    // Menu déroulant THÈME (dossiers groupe=theme)
    var dosThemes=BIBLIO_DOSSIERS.filter(function(d){return d.groupe==='theme';});
    var themeSelect='<select onchange="bibMoveTo('+b.id+',this.value)" style="font-size:.67rem;background:var(--g9);border:1px solid var(--w2);border-radius:7px;padding:3px 7px;cursor:pointer;color:var(--i3);max-width:140px">'
      +'<option value="">📂 '+(dosTh&&dosTh.groupe==='theme'?dosTh.icone+' '+dosTh.nom:'Thème…')+'</option>'
      +dosThemes.filter(function(d){return d.id!==b.dossier_id;}).map(function(d){return '<option value="'+d.id+'">'+d.icone+' '+d.nom+'</option>';}).join('')
      +(b.dossier_id&&dosTh&&dosTh.groupe==='theme'?'<option value="0">📄 Sans thème</option>':'')
      +'</select>';

    // Menu déroulant NATURE
    var NATURES2=['CR de commission','Délibération','Procès-verbal','Rapport','Étude','Avis','Courrier','Email','Devis','Marché public','Budget','Autre'];
    var natureSelect='<select onchange="bibChangeType('+b.id+',this.value)" style="font-size:.67rem;background:var(--g9);border:1px solid var(--w2);border-radius:7px;padding:3px 7px;cursor:pointer;color:var(--i3);max-width:130px">'
      +'<option value="">🏷 '+(b.type||'Nature…')+'</option>'
      +NATURES2.map(function(t){return '<option value="'+t+'"'+(b.type===t?' selected':'')+'>'+t+'</option>';}).join('')
      +'</select>';

    return '<div class="bib-card" style="flex-direction:column;padding:0;overflow:hidden">'
      +'<div style="display:flex;gap:10px;padding:.85rem 1rem;align-items:flex-start">'
      +'<div style="width:40px;height:40px;border-radius:10px;background:'+fcol+'15;border:1.5px solid '+fcol+'30;display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0">'+fico+'</div>'
      +'<div style="flex:1;min-width:0">'
      +'<div style="display:flex;align-items:flex-start;gap:6px;flex-wrap:wrap;margin-bottom:4px">'
      +'<span style="font-size:.85rem;font-weight:700;color:var(--ink);font-family:var(--fd);line-height:1.3">'+b.titre+'</span>'
      +(b.type?'<span style="font-size:.65rem;background:var(--or,#c9a227)18;color:var(--or,#c9a227);padding:2px 8px;border-radius:10px;font-weight:700;border:1px solid var(--or,#c9a227)33;white-space:nowrap">'+b.type+'</span>':'')
      +(dosTh?'<span style="font-size:.65rem;background:'+dosTh.couleur+'15;color:'+dosTh.couleur+';padding:2px 8px;border-radius:10px;font-weight:600;border:1px solid '+dosTh.couleur+'30">'+dosTh.icone+' '+dosTh.nom+'</span>':'')
      +(isLocal?'<span style="font-size:.62rem;background:#dcfce7;color:#15803d;padding:2px 6px;border-radius:8px;font-weight:600">local</span>':'')
      +'</div>'
      +(b.date_doc?'<div style="font-size:.67rem;color:var(--i4);margin-bottom:3px">'+b.date_doc+'</div>':'')
      +(b.description?'<div style="font-size:.71rem;color:var(--i3);line-height:1.5;margin-bottom:4px">'+b.description+'</div>':'')
      // Actions
      +'<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;align-items:center">'
      +previewBtn
      +(b.url?'<a href="'+b.url+'" target="_blank" style="background:var(--g8);border:1px solid var(--g7);border-radius:7px;padding:3px 9px;font-size:.69rem;font-weight:600;cursor:pointer;color:var(--g2);text-decoration:none;white-space:nowrap">'+(isLocal?'⬇️ Télécharger':'🔗 Ouvrir')+'</a>':'')
      +themeSelect
      +natureSelect
      +'<button onclick="delBiblio('+b.id+')" style="background:#fee2e2;border:1px solid #fca5a5;border-radius:7px;padding:3px 8px;font-size:.69rem;cursor:pointer;color:#b91c1c;margin-left:auto">×</button>'
      +'</div>'
      +previewZone
      +'</div>'
      +'</div>'
      +'</div>';
  }).join('');
}

function bibTogglePreview(btn,url){
  var card=btn.closest('.bib-card');if(!card)return;
  var pz=card.querySelector('.bib-preview');if(!pz)return;
  if(pz.style.display==='none'){
    var iframe=pz.querySelector('iframe');
    if(iframe&&!iframe.src)iframe.src=url;
    pz.style.display='block';btn.textContent='✕ Fermer';
  } else {pz.style.display='none';btn.textContent='👁 Prévisualiser';}
}

function bibSetDos(id){_bibDosActif=id;if(id===null){_bibTypeFiltre="";}renderBiblio();}
function bibSetType(t){_bibTypeFiltre=t;renderBiblio();}
function bibSetAnnee(a){_bibAnnee=a;renderBiblio();}
function bibToggleGrp(key){renderBiblio();}

function bibNewDos(groupe){
  var nom=prompt('Nom du nouveau thème :');if(!nom||!nom.trim())return;
  var icone=prompt('Icône (emoji) :','📁')||'📁';
  var cols=['#1a3a5c','#2d5a87','#c9a227','#16a34a','#d97706','#dc2626','#7c3aed','#0891b2'];
  var couleur=cols[Math.floor(Math.random()*cols.length)];
  apiPost('/api/biblio/dossiers',{nom:nom.trim(),icone:icone,couleur:couleur,groupe:groupe||'theme',ordre:99}).then(function(r){
    if(r&&r.ok){BIBLIO_DOSSIERS.push(r.item);_bibDosActif=r.item.id;renderBiblio();toast('Dossier créé ✓');}
  });
}

function bibRenameDos(id){
  var dos=BIBLIO_DOSSIERS.find(function(d){return d.id===id;});if(!dos)return;
  var nom=prompt('Nouveau nom :',dos.nom);if(!nom||!nom.trim())return;
  var icone=prompt('Icône :',dos.icone)||dos.icone;
  apiPatch('/api/biblio/dossiers/'+id,{nom:nom.trim(),icone:icone}).then(function(r){
    if(r&&r.ok){var i=BIBLIO_DOSSIERS.findIndex(function(d){return d.id===id;});if(i>=0)BIBLIO_DOSSIERS[i]=r.item;renderBiblio();toast('Renommé ✓');}
  });
}

function bibDelDos(id){
  var dos=BIBLIO_DOSSIERS.find(function(d){return d.id===id;});if(!dos)return;
  var cnt=BIBLIO.filter(function(b){return b.dossier_id===id;}).length;
  if(!confirm('Supprimer « '+dos.nom+' » ?'+(cnt?' Les '+cnt+' documents seront déclassés.':'')))return;
  apiDel('/api/biblio/dossiers/'+id).then(function(r){
    if(r&&r.ok){
      BIBLIO_DOSSIERS=BIBLIO_DOSSIERS.filter(function(d){return d.id!==id;});
      BIBLIO.forEach(function(b){if(b.dossier_id===id)b.dossier_id=null;});
      if(_bibDosActif===id)_bibDosActif=null;
      renderBiblio();toast('Dossier supprimé');
    }
  });
}

function bibMoveTo(docId,dosId){
  var did=dosId==='0'?null:(parseInt(dosId)||null);
  apiPatch('/api/biblio/'+docId,{dossier_id:did}).then(function(r){
    if(r&&r.ok){var i=BIBLIO.findIndex(function(b){return b.id===docId;});if(i>=0)BIBLIO[i].dossier_id=did;renderBiblio();
      var dos=BIBLIO_DOSSIERS.find(function(d){return d.id===did;});
      toast(dos?'📁 Classé dans « '+dos.nom+' »':'📄 Déclassé');
    }
  });
}

function bibChangeType(docId,type){
  if(!type)return;
  apiPatch('/api/biblio/'+docId,{type:type}).then(function(r){
    if(r&&r.ok){var i=BIBLIO.findIndex(function(b){return b.id===docId;});if(i>=0)BIBLIO[i].type=type;renderBiblio();toast('🏷 Nature mise à jour ✓');}
  });
}

function delBiblio(id){
  if(!confirm('Supprimer ce document ?'))return;
  apiDel('/api/biblio/'+id).then(function(d){
    if(d.ok){BIBLIO=BIBLIO.filter(function(b){return b.id!==id;});el('sb-bib',BIBLIO.length);renderBiblio();toast('Document supprimé ✓');}
  });
}




function bibSwitchTab(tab){
  var urlSec=$("bib-url-section"),fileSec=$("bib-file-section");
  var tabUrl=$("bib-tab-url"),tabFile=$("bib-tab-file");
  if(tab==='url'){
    if(urlSec)urlSec.style.display='block'; if(fileSec)fileSec.style.display='none';
    if(tabUrl){tabUrl.style.background='var(--g3)';tabUrl.style.color='#fff';}
    if(tabFile){tabFile.style.background='var(--w2)';tabFile.style.color='var(--i2)';}
  } else {
    if(urlSec)urlSec.style.display='none'; if(fileSec)fileSec.style.display='block';
    if(tabUrl){tabUrl.style.background='var(--w2)';tabUrl.style.color='var(--i2)';}
    if(tabFile){tabFile.style.background='var(--g3)';tabFile.style.color='#fff';}
  }
}

function bibFileChosen(input){
  var file=input.files[0]; if(!file)return;
  var label=$("bib-file-label");
  if(label)label.textContent=file.name+' ('+Math.round(file.size/1024)+' Ko)';
  var ti=$("bib-ti"); if(ti&&!ti.value)ti.value=file.name.replace(/\.[^.]+$/,'');
}

function svBiblio(){
  var vis=document.querySelector('input[name="bib-vis"]:checked');
  var urlSec=$("bib-url-section");
  var isFileMode=urlSec&&urlSec.style.display==='none';
  var fileInput=$("bib-file");
  if(isFileMode&&fileInput&&fileInput.files[0]){
    var file=fileInput.files[0];
    var titre=v("bib-ti"); if(!titre){toast("Titre obligatoire");return;}
    var form=new FormData(); form.append('file',file);
    var btn=document.querySelector('[onclick="svBiblio()"]');
    if(btn){btn.disabled=true;btn.textContent='⏳ Upload…';}
    var xhr=new XMLHttpRequest();
    xhr.open('POST','/api/upload');
    xhr.withCredentials=true;
    xhr.onload=function(){
      if(btn){btn.disabled=false;btn.textContent='Ajouter';}
      var r=JSON.parse(xhr.responseText||'{}');
      if(r.ok){
        var d={titre:titre,type:v("bib-ty"),commission:v("bib-co"),url:r.url,
          description:v("bib-desc"),tags:v("bib-tags"),date_doc:v("bib-date"),
          annee:v("bib-year"),visibilite:vis?vis.value:"public",source:"upload"};
        apiPost("/api/biblio",d).then(function(res){
          if(res.ok){BIBLIO.unshift(res.item);renderBiblio();cm();
            toast(d.visibilite==="prive"?"Fichier privé ajouté 🔒":"Fichier ajouté ✓");}
          else toast("Erreur d'enregistrement");
        });
      } else { toast("Erreur upload: "+(r.error||"?"),4000); }
    };
    xhr.onerror=function(){if(btn){btn.disabled=false;btn.textContent='Ajouter';}toast("Erreur réseau",3000);};
    xhr.send(form);
  } else {
    var d={titre:v("bib-ti"),type:v("bib-ty"),commission:v("bib-co"),url:v("bib-url"),
      description:v("bib-desc"),tags:v("bib-tags"),date_doc:v("bib-date"),
      annee:v("bib-year"),visibilite:vis?vis.value:"public"};
    if(!d.titre||(!d.url&&!isFileMode)){toast("Titre et lien obligatoires");return;}
    apiPost("/api/biblio",d).then(function(r){
      if(r.ok){BIBLIO.unshift(r.item);renderBiblio();cm();
        toast(d.visibilite==="prive"?"Document privé ajouté 🔒":"Document ajouté ✓");}
    });
  }
}

function saveCR(){
  var texte=v("cr-gen"); if(!texte.trim()){toast("Aucun document généré");return;}
  var d={titre:"Document généré - "+new Date().toLocaleDateString("fr-FR"),commission:v("ct")||"Autre",date:new Date().toISOString().slice(0,10),redige_par:ME.nom,content:texte};
  apiPost("/api/cr",d).then(function(r){if(r.ok){CRS.unshift(r.item);toast("Sauvegardé en CR !");}});
}

// ── RÉPERTOIRE ÉLUS ──────────────────────────────────────────────────────────
var ELU_COLORS=["#1d3d2b","#2d5a40","#3d7a5a","#8B5CF6","#F97316","#EC4899","#F59E0B","#3B82F6","#10B981","#EF4444","#14B8A6","#6366F1"];

function renderRepElus(){
  var g=$("rep-elus-grid"), f=$("rep-elus-files");
  if(g)g.style.display="none";
  if(f)f.style.display="block";
  // En-tête avec photo si disponible
  var av=$("rep-elu-av");
  if(av){
    if(ME.photo){
      av.innerHTML='<img src="'+ME.photo+'" style="width:100%;height:100%;object-fit:cover;object-position:'+(ME.photoPos||"center center")+'" onerror="hideImg(this)">';
    } else {
      av.textContent=ME.avatar;
    }
    av.style.background=ME.color||"var(--g3)";
  }
  el("rep-elu-name",(ME.prenom?ME.prenom+' ':'')+ME.nom);
  el("rep-elu-role",ME.role+" — Répertoire privé");
  // Charger les fichiers depuis le serveur
  apiGet("/api/rep_elus").then(function(data){
    REP_ELUS[ME.id]=Array.isArray(data)?data:(data[ME.id]||[]);
    _repEluId=ME.id;
    renderRepEluFiles();
  });
}

function openRepElu(eluId){_repEluId=eluId;renderRepEluFiles();}
function closeRepElu(){renderRepElus();}

function renderRepEluFiles(){
  var files=REP_ELUS[_repEluId]||[];
  var rl=$("rep-elu-list"); if(!rl)return;
  rl.innerHTML=files.length?files.map(function(f){
    return '<div class="bib-card">'
      +'<div class="bib-ico" style="background:var(--g8);border:1px solid var(--g7)">📂</div>'
      +'<div style="flex:1">'
      +(f.url?'<a href="'+f.url+'" target="_blank" style="font-size:.84rem;font-weight:700;font-family:var(--fd);color:var(--g2);text-decoration:none">'+(f.url.startsWith('/uploads/')? '⬇️ ': '🔗 ')+f.titre+'</a>'
             :'<div style="font-size:.84rem;font-weight:700;font-family:var(--fd);color:var(--ink)">'+f.titre+'</div>')
      +(f.notes?'<div style="font-size:.71rem;color:var(--i3);margin-top:4px">'+f.notes+'</div>':"")
      +'<div style="font-size:.63rem;color:var(--i4);margin-top:3px;font-family:var(--fm)">'+f.created+'</div>'
      +'</div>'
      +'<button class="btn btn-d btn-sm" style="flex-shrink:0;align-self:flex-start" onclick="delRepFile('+f.id+')">×</button>'
      +'</div>';
  }).join(""):'<div class="empty"><div class="empty-ico">📁</div><div class="empty-t">Répertoire vide</div><div class="empty-s">Cliquez sur "+ Ajouter" pour déposer un document.</div></div>';
}

function rePreviewFile(input){
  var file=input.files[0]; if(!file)return;
  var prev=document.getElementById("re-file-preview");
  var ti=document.getElementById("re-ti");
  if(prev){prev.style.display="block";prev.textContent="📎 "+file.name+" ("+Math.round(file.size/1024)+" Ko)";}
  if(ti&&!ti.value)ti.value=file.name.replace(/\.[^.]+$/,"");
}
function svRepElu(){
  var fi=document.getElementById("re-file");
  var file=fi&&fi.files&&fi.files[0]?fi.files[0]:null;
  var titre=v("re-ti");
  if(file&&!titre)titre=file.name.replace(/\.[^.]+$/,"");
  var d={titre:titre,url:v("re-url"),notes:v("re-notes")};
  if(!d.titre&&!file&&!d.url){toast("Fichier, titre ou lien requis");return;}
  function doSaveRep(url){
    if(url)d.url=url;
    if(!d.titre)d.titre=d.url?d.url.split("/").pop():"Document";
    apiPost("/api/rep_elus",d).then(function(r){
      if(r.ok){
        if(!REP_ELUS[ME.id])REP_ELUS[ME.id]=[];
        REP_ELUS[ME.id].unshift(r.item);
        _repEluId=ME.id;
        renderRepEluFiles();cm();toast("Document ajouté ✓");
        ["re-ti","re-url","re-notes"].forEach(function(i){var e=$(i);if(e)e.value="";});
        var prev=document.getElementById("re-file-preview");
        if(prev){prev.style.display="none";}
        if(fi)fi.value="";
        var btn=document.querySelector('[onclick="svRepElu()"]');
        if(btn){btn.disabled=false;btn.textContent="💾 Enregistrer";}
      }
    });
  }
  if(file){
    var btn=document.querySelector('[onclick="svRepElu()"]');
    if(btn){btn.disabled=true;btn.textContent="⏳ Upload…";}
    var form=new FormData();
    form.append("file",file,file.name);
    form.append("titre",d.titre||file.name);
    var xhr=new XMLHttpRequest();
    xhr.open("POST","/api/upload");
    xhr.withCredentials=true;
    xhr.onload=function(){var r=JSON.parse(xhr.responseText||"{}");doSaveRep(r.ok?r.url:"");};
    xhr.onerror=function(){doSaveRep("");};
    xhr.send(form);
  } else {
    doSaveRep(d.url);
  }
}
function delRepFile(id){
  if(!confirm("Supprimer ?"))return;
  apiDel("/api/rep_elus/"+id).then(function(d){
    if(d.ok){
      if(REP_ELUS[ME.id])REP_ELUS[ME.id]=REP_ELUS[ME.id].filter(function(f){return f.id!==id;});
      renderRepEluFiles();
    }
  });
}

// ── ÉLUS ─────────────────────────────────────────────────────────────────────
function renderElus(){
  var _pb=document.getElementById("panel-body");
  var el2=(_pb&&_pb.querySelector("#elus-list"))||$("elus-list"); if(!el2)return;
  var list=ELUS_DATA.length?ELUS_DATA:ELUS0;
  el2.innerHTML=list.map(function(e,i){
    var photoHtml=e.photo
      ?'<img src="'+e.photo+'" style="width:100%;height:100%;object-fit:cover;object-position:'+(e.photoPos||"center center")+'" onerror="hideImg(this)">'
       +'<div style="display:none;width:100%;height:100%;align-items:center;justify-content:center;font-size:1.1rem;font-weight:800;color:#fff;font-family:var(--fd)">'+e.avatar+'</div>'
      :'<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:1.1rem;font-weight:800;color:#fff;font-family:var(--fd)">'+e.avatar+'</div>';
    return '<div class="elu" onclick="openElu('+i+')">'
      +'<div class="elu-av" style="background:'+(e.color||'var(--g3)')+';overflow:hidden;border-radius:50%;flex-shrink:0">'+photoHtml+'</div>'
      +'<div style="flex:1;min-width:0">'
      +'<div class="elu-n">'+(e.prenom?e.prenom+' ':'')+e.nom+'</div>'
      +'<div class="elu-r">'+e.role+'</div>'
      
      +'</div></div>';
  }).join("");
}
function openElu(i){
  var list=ELUS_DATA.length?ELUS_DATA:ELUS0;
  var e=list[i];if(!e)return;
  var col=e.color||"var(--g3)";
  var fullName=(e.prenom?e.prenom+" ":"")+e.nom;
  $("elu-det-t").textContent=fullName;
  var commOpts=Object.keys(COMM).map(function(c){return'<option value="'+c+'"'+(e.commission===c?' selected':'')+'>'+c+'</option>';}).join('');
  $("elu-det-b").innerHTML=
    '<div style="display:flex;align-items:center;gap:12px;padding:.85rem;background:var(--g8);border-radius:var(--R);margin-bottom:1rem;border:1px solid var(--g7)">'
    +'<div style="width:52px;height:52px;border-radius:12px;background:'+col+';display:flex;align-items:center;justify-content:center;font-size:1.1rem;font-weight:800;color:#fff;flex-shrink:0">'+e.avatar+'</div>'
    +'<div><div style="font-size:.95rem;font-weight:700;font-family:var(--fd)">'+fullName+'</div>'
    +'<div style="font-size:.75rem;color:var(--g3)">'+(e.role||'')+'</div></div></div>'
    +'<div style="display:flex;flex-direction:column;gap:9px">'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
    +'<div><label style="font-size:.67rem;font-weight:700;color:var(--i3);display:block;margin-bottom:3px;text-transform:uppercase">Prénom</label><input id="ef-pr" class="fi" value="'+(e.prenom||'')+'" style="font-size:.76rem;padding:6px 9px"></div>'
    +'<div><label style="font-size:.67rem;font-weight:700;color:var(--i3);display:block;margin-bottom:3px;text-transform:uppercase">Nom</label><input id="ef-no" class="fi" value="'+(e.nom||'')+'" style="font-size:.76rem;padding:6px 9px"></div>'
    +'</div>'
    +'<div><label style="font-size:.67rem;font-weight:700;color:var(--i3);display:block;margin-bottom:3px;text-transform:uppercase">Rôle</label><input id="ef-ro" class="fi" value="'+(e.role||'')+'" placeholder="1ère Adjointe, Conseiller délégué…" style="font-size:.76rem;padding:6px 9px"></div>'
    +'<div><label style="font-size:.67rem;font-weight:700;color:var(--i3);display:block;margin-bottom:3px;text-transform:uppercase">Commission</label><select id="ef-co" class="fi" style="font-size:.76rem;padding:6px 9px"><option value="">— aucune —</option>'+commOpts+'</select></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
    +'<div><label style="font-size:.67rem;font-weight:700;color:var(--i3);display:block;margin-bottom:3px;text-transform:uppercase">Téléphone</label><input id="ef-te" class="fi" value="'+(e.tel||'')+'" placeholder="06 00 00 00 00" style="font-size:.76rem;padding:6px 9px"></div>'
    +'<div><label style="font-size:.67rem;font-weight:700;color:var(--i3);display:block;margin-bottom:3px;text-transform:uppercase">Email</label><input id="ef-em" class="fi" value="'+(e.email||'')+'" type="email" style="font-size:.76rem;padding:6px 9px"></div>'
    +'</div>'
    +'<div style="display:flex;justify-content:flex-end;padding-top:4px"><button class="btn btn-p" onclick="saveEluFull('+e.id+')">💾 Enregistrer</button></div>'
    +'</div>';
  om("elu-det");
}

function saveEluFull(eluId){
  var d={
    prenom:(document.getElementById("ef-pr")||{value:""}).value.trim(),
    nom:(document.getElementById("ef-no")||{value:""}).value.trim(),
    role:(document.getElementById("ef-ro")||{value:""}).value.trim(),
    commission:(document.getElementById("ef-co")||{value:""}).value,
    tel:(document.getElementById("ef-te")||{value:""}).value.trim(),
    email:(document.getElementById("ef-em")||{value:""}).value.trim()
  };
  if(!d.nom){toast("Le nom est obligatoire");return;}
  apiPatch("/api/elus/"+eluId,d).then(function(r){
    if(r&&r.ok){
      [ELUS_DATA,ELUS0].forEach(function(arr){arr.forEach(function(e){
        if(e.id===eluId){e.prenom=d.prenom;e.nom=d.nom;e.role=d.role;e.commission=d.commission;e.tel=d.tel;e.email=d.email;}
      });});
      cm();renderElus();toast("Élu mis à jour !");
    } else {toast("Erreur",3000);}
  });
}
function saveEluContact(eluId){saveEluFull(eluId);}



// ── COMMISSIONS ──────────────────────────────────────────────────────────────
function buildFilters(){
  var th={},st={},an={};
  P.forEach(function(p){th[p.theme||"?"]=1;st[ST[p.id]||p.statut||"ND"]=1;an[p.annee?String(p.annee):"?"]=1;});
  fSel("fC",Object.keys(COMM),"Toutes commissions");
  fSel("fT",Object.keys(th).sort(),"Tous thèmes");
  fSel("fS",SLIST,"Tous statuts");
  fSel("fA",Object.keys(an).sort(),"Toutes années");
  fSel("cd-st",SLIST,"Tous statuts");
}
function fSel(id,opts,def){var s=$(id);if(!s)return;s.innerHTML='<option value="">'+def+'</option>';opts.forEach(function(o){var op=document.createElement("option");op.value=o;op.textContent=o;s.appendChild(op);});}


/* ── GRAPHIQUE BUDGET ────────────────────────────────────────────────────── */
var _budgetChart = null;
function buildBudgetChart(){
  var canvas = $("budgetChart"); if(!canvas) return;
  if(_budgetChart){_budgetChart.destroy(); _budgetChart=null;}
  var ctx = canvas.getContext("2d");
  _budgetChart = new Chart(ctx,{
    type:"bar",
    data:{
      labels:["Fonctionnement","Investissement","Subventions","DGF État","Personnel","Services"],
      datasets:[
        {label:"2025 réel",backgroundColor:"rgba(45,90,64,.7)",data:[8240,2850,528,1120,3890,620]},
        {label:"2026 prévu",backgroundColor:"rgba(61,122,90,.7)",data:[8500,2800,640,1108,4050,650]},
        {label:"2027 projection",backgroundColor:"rgba(90,154,112,.5)",borderColor:"rgba(90,154,112,.8)",borderWidth:2,type:"line",data:[8700,3100,680,1095,4200,680]}
      ]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{labels:{font:{size:11},padding:12}}},
      scales:{
        x:{ticks:{font:{size:10}},grid:{display:false}},
        y:{ticks:{font:{size:10},callback:function(v){return v>=1000?(v/1000).toFixed(1)+"M€":v+"k€";}},grid:{color:"rgba(0,0,0,.05)"}}
      }
    }
  });
}

/* ── NAVIGATION MOBILE ───────────────────────────────────────────────────── */
var _mobileMenuOpen = false;

function toggleMobileMenu(){
  var sb  = document.querySelector('.sb');
  var ov  = $("sb-overlay");
  var hbg = $("hamburger");
  _mobileMenuOpen = !_mobileMenuOpen;
  if(sb)  sb.classList.toggle("on", _mobileMenuOpen);
  if(ov)  ov.classList.toggle("on", _mobileMenuOpen);
  if(hbg) hbg.classList.toggle("on", _mobileMenuOpen);
}

function closeMobileMenu(){
  var sb  = document.querySelector('.sb');
  var ov  = $("sb-overlay");
  var hbg = $("hamburger");
  _mobileMenuOpen = false;
  if(sb)  sb.classList.remove("on");
  if(ov)  ov.classList.remove("on");
  if(hbg) hbg.classList.remove("on");
}

function gpMobile(pageId, btId){
  // Naviguer et mettre à jour la barre bas
  gp(pageId);
  qsa(".bt-ic").forEach(function(b){ b.classList.remove("on"); });
  var bt = $(btId);
  if(bt) bt.classList.add("on");
  closeMobileMenu();
}

function fG(){
  var c=v("fC"),t=v("fT"),s=v("fS"),a=v("fA"),q=v("fQ").toLowerCase();
  var r=P.filter(function(p){var ps=ST[p.id]||p.statut||"ND",pa=p.annee?String(p.annee):"?",pc=t2c(p.theme);return(!c||pc===c)&&(!t||p.theme===t)&&(!s||ps===s)&&(!a||pa===a)&&(!q||(p.titre||"").toLowerCase().indexOf(q)>=0||(p.resume||"").toLowerCase().indexOf(q)>=0);});
  el("fCnt",r.length+" projet(s)");
  rTb("g-tb",r,true);
}

function rTb(bid,rows,showC){
  var tb=$(bid);if(!tb)return;
  tb.innerHTML=rows.map(function(p){
    var st=ST[p.id]||p.statut||"ND";
    var opts=SLIST.map(function(sv){return '<option value="'+sv+'"'+(st===sv?" selected":"")+'>'+sv+'</option>';}).join("");
    var c1=showC
      ?'<td><span class="chip">'+t2c(p.theme||"")+'</span><br><span style="font-size:.63rem;color:var(--i4)">'+(p.theme||"—")+'</span></td>'
      :'<td style="font-size:.72rem;color:var(--i3)">'+(p.theme||"—")+'</td>';
    return '<tr>'+c1
      +'<td><div class="pn">'+(p.titre||"—")+'</div><div class="pr">'+(p.resume||"")+'</div></td>'
      +'<td><span class="b '+bc(st)+'">'+st+'</span></td>'
      +'<td style="color:var(--i3);font-family:var(--fm);font-size:.72rem">'+(p.annee||"—")+'</td>'
      +'<td>'+imp(p.importance)+'</td>'
      +'<td><div style="display:flex;align-items:center;gap:5px"><select class="ssel" data-pid="'+p.id+'" data-t="'+p.titre.replace(/"/g,"&quot;")+'" onchange="uSt(+this.dataset.pid,this.value,this.dataset.t)">'+opts+'</select>'
      +'<button onclick="oProj('+p.id+')" title="Modifier" style="padding:8px 16px;font-size:.82rem;font-weight:700;cursor:pointer;background:var(--g2);color:#fff;border:none;border-radius:8px;flex-shrink:0;font-family:var(--fd);display:flex;align-items:center;gap:5px;white-space:nowrap">&#x270F;&#xFE0F; Modifier</button></div></td>'
      +'</tr>';
  }).join("");
}

function uSt(id,nst,titre){
  apiPost("/api/statut",{id:id,statut:nst,titre:titre}).then(function(d){
    if(d.ok){ST[id]=nst;NF.unshift(d.notif);fG();if($("p-cdet").classList.contains("on"))fCD();buildCG();buildCharts();toast("Statut : "+nst);}
  });
}

function buildCG(){
  var pb=document.getElementById("panel-body");var cg=(pb&&pb.querySelector("#cg"))||document.getElementById("cg"); if(!cg)return;
  var ks=Object.keys(COMM);
  cg.innerHTML=ks.map(function(comm,idx){
    var pp=P.filter(function(p){return COMM[comm].indexOf(p.theme)>=0;});
    var to=pp.length,pr=0,ec=0,re=0;
    pp.forEach(function(p){var s=ST[p.id]||p.statut||"";if(s==="Prioritaire")pr++;if(s.indexOf("cours")>=0)ec++;if(s.indexOf("alis")>=0)re++;});
    var pct=to?Math.round(re/to*100):0;
    var col=COLORS[comm]||"#3d7a5a";
    return '<div class="cc" onclick="showCD('+idx+')">'
      +'<div class="cc-top" style="background:'+col+'20;border-bottom:1px solid '+col+'30">'
      +'<div class="cc-ico" style="background:'+col+'">'+( ICONS[comm]||"📋")+'</div>'
      +(REFS[comm]?'<span class="cc-ref" style="background:'+col+'30;border-color:'+col+'50;color:'+col+'">'+REFS[comm]+'</span>':"")
      +'</div>'
      +'<div class="cc-b">'
      +'<div class="cc-title">'+comm+'</div>'
      +'<div class="cc-th">'+COMM[comm].join(" · ")+'</div>'
      +'<div class="cc-ks">'
      +'<div class="ck"><div class="ckv" style="color:var(--g2)">'+to+'</div><div class="ckl">total</div></div>'
      +'<div class="ck"><div class="ckv" style="color:var(--red)">'+pr+'</div><div class="ckl">prio.</div></div>'
      +'<div class="ck"><div class="ckv" style="color:var(--amber)">'+ec+'</div><div class="ckl">cours</div></div>'
      +'<div class="ck"><div class="ckv" style="color:var(--g4)">'+re+'</div><div class="ckl">réal.</div></div>'
      +'</div>'
      +'<div class="cc-prog"><div class="cc-fill" style="width:'+pct+'%;background:'+col+'"></div></div>'
      +'<div class="cc-pct"><span>Avancement</span><span>'+pct+'%</span></div>'
      +'</div></div>';
  }).join("");
}

function showCD(idx){
  _ci=idx;
  var comm=Object.keys(COMM)[idx],themes=COMM[comm],col=COLORS[comm]||"var(--g3)";
  var pp=P.filter(function(p){return themes.indexOf(p.theme)>=0;});
  var to=pp.length,pr=0,ec=0,re=0;
  pp.forEach(function(p){var s=ST[p.id]||p.statut||"";if(s==="Prioritaire")pr++;if(s.indexOf("cours")>=0)ec++;if(s.indexOf("alis")>=0)re++;});
  var statOpts=SLIST.map(function(s){return'<option value="'+s+'">'+s+'</option>';}).join('');
  var _ico=document.getElementById("cdet-ico");if(_ico)_ico.textContent=ICONS[comm]||"📋";
  var _tit=document.getElementById("cdet-t");if(_tit)_tit.textContent=comm;
  var _sub=document.getElementById("cdet-s");if(_sub)_sub.textContent=themes.join(" · ")+(REFS[comm]?" — "+REFS[comm]:"");
  var _kpi=document.getElementById("cdet-kpis");if(_kpi)_kpi.innerHTML='<div class="kpi" style="flex:1"><div class="kpiv">'+to+'</div><div class="kpil">Projets</div></div><div class="kpi" style="flex:1"><div class="kpiv" style="color:var(--red)">'+pr+'</div><div class="kpil">Prioritaires</div></div><div class="kpi" style="flex:1"><div class="kpiv" style="color:var(--amber)">'+ec+'</div><div class="kpil">En cours</div></div><div class="kpi" style="flex:1"><div class="kpiv" style="color:var(--g4)">'+re+'</div><div class="kpil">Réalisés</div></div>';
  var _cst=document.getElementById("cd-st");if(_cst)_cst.innerHTML='<option value="">Tous statuts</option>'+statOpts;
  openPanel("cdet"); return;
  var pb=document.getElementById("panel-body"); if(!pb)return;
  pb.innerHTML=
    '<div style="background:'+col+'18;border-bottom:3px solid '+col+';padding:.85rem 1.4rem;display:flex;align-items:center;gap:12px;flex-shrink:0">'
    +'<div style="width:40px;height:40px;border-radius:10px;background:'+col+';display:flex;align-items:center;justify-content:center;font-size:1.2rem">'+(ICONS[comm]||"📋")+'</div>'
    +'<div style="flex:1"><div style="font-size:1rem;font-weight:800;font-family:var(--fd)">'+comm+'</div>'
    +'<div style="font-size:.72rem;color:var(--i3)">'+themes.join(" · ")+(REFS[comm]?" — <strong>"+REFS[comm]+"</strong>":"")+'</div></div>'
    +'<button onclick="goComm()" style="background:rgba(0,0,0,.08);border:none;border-radius:7px;padding:5px 12px;font-size:.73rem;cursor:pointer;color:var(--i2)">&#x2190; Commissions</button>'
    +'</div>'
    +'<div style="display:flex;gap:8px;padding:.75rem 1.4rem;background:#fff;border-bottom:1px solid var(--w2)">'
    +'<div class="kpi" style="flex:1"><div class="kpiv">'+to+'</div><div class="kpil">Projets</div></div>'
    +'<div class="kpi" style="flex:1"><div class="kpiv" style="color:var(--red)">'+pr+'</div><div class="kpil">Prioritaires</div></div>'
    +'<div class="kpi" style="flex:1"><div class="kpiv" style="color:var(--amber)">'+ec+'</div><div class="kpil">En cours</div></div>'
    +'<div class="kpi" style="flex:1"><div class="kpiv" style="color:var(--g4)">'+re+'</div><div class="kpil">Réalisés</div></div>'
    +'</div>'
    +'<div class="fb">'
    +'<select class="fsel" id="cd-st-p" onchange="fCDP()"><option value="">Tous statuts</option>'+statOpts+'</select>'
    +'<input class="fsrch" id="cd-q-p" placeholder="&#x1F50D; Rechercher..." oninput="fCDP()">'
    +'<span class="fcnt" id="cd-cnt-p"></span>'
    +'</div>'
    +'<div class="tbw" style="border-radius:0;border-left:none;border-right:none;border-bottom:none">'
    +'<table><thead><tr><th>Thème</th><th>Projet</th><th>Statut</th><th>Année</th><th>Imp.</th><th>Modifier</th></tr></thead>'
    +'<tbody id="cd-tb-p"></tbody></table></div>';
  fCDP();
}
function fCDP(){
  var comm=Object.keys(COMM)[_ci],themes=COMM[comm];
  var s=(document.getElementById("cd-st-p")||{value:""}).value;
  var q=((document.getElementById("cd-q-p")||{value:""}).value||"").toLowerCase();
  var r=P.filter(function(p){var ps=ST[p.id]||p.statut||"ND";return themes.indexOf(p.theme)>=0&&(!s||ps===s)&&(!q||(p.titre||"").toLowerCase().indexOf(q)>=0||(p.resume||"").toLowerCase().indexOf(q)>=0);});
  var cnt=document.getElementById("cd-cnt-p"); if(cnt)cnt.textContent=r.length+" projet(s)";
  rTb("cd-tb-p",r,false);
}
function fCD(){
  var comm=Object.keys(COMM)[_ci],themes=COMM[comm];
  var s=v("cd-st"),q=(v("cd-q")||"").toLowerCase();
  var r=P.filter(function(p){var ps=ST[p.id]||p.statut||"ND";return themes.indexOf(p.theme)>=0&&(!s||ps===s)&&(!q||(p.titre||"").toLowerCase().indexOf(q)>=0||(p.resume||"").toLowerCase().indexOf(q)>=0);});
  el("cd-cnt",r.length+" projet(s)");
  rTb("cd-tb",r,false);
}

// ── CHARTS ───────────────────────────────────────────────────────────────────
function buildCharts(){
  var th={},st={};
  P.forEach(function(p){var t=p.theme||"?";th[t]=(th[t]||0)+1;var s=ST[p.id]||p.statut||"ND";st[s]=(st[s]||0)+1;});
  var tk=Object.keys(th).sort(),tv=tk.map(function(k){return th[k];});
  var sk=Object.keys(st),sv=sk.map(function(k){return st[k];});
  var G=["#1d3d2b","#2d5a40","#3d7a5a","#5a9a70","#7ab890","#a8d4b4","#b8d9c4","#3a5a48","#5a8a70","#7aaa88","#9ac8a0","#c0d9c4","#2a4a38","#4a7a5a"];
  if(chT)chT.destroy();if(chS)chS.destroy();
  var et=$("chT"),es=$("chS");
  if(et)chT=new Chart(et,{type:"bar",data:{labels:tk,datasets:[{data:tv,backgroundColor:G,borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{font:{size:9},color:"var(--i3)"}},y:{grid:{color:"rgba(0,0,0,.04)"},ticks:{stepSize:1,font:{size:9},color:"var(--i3)"}}}}});
  if(es)chS=new Chart(es,{type:"doughnut",data:{labels:sk,datasets:[{data:sv,backgroundColor:["#dc2626","#16a34a","#2563eb","#d97706","#ea580c","#0d9488","#9ca3af"],borderWidth:2,borderColor:"#fff"}]},options:{responsive:true,maintainAspectRatio:false,cutout:"64%",plugins:{legend:{position:"bottom",labels:{font:{size:10},padding:10,usePointStyle:true}}}}});
}

// ── SIGNALEMENTS ─────────────────────────────────────────────────────────────
var SIG_ICO={Voirie:"🛣",Eclairage:"💡",Proprete:"🗑","Espace vert":"🌿","Securite":"🛡","Batiment":"🏗",Autre:"📋"};
function updSigBadge(){
  var nb=SIGN.filter(function(s){return s.statut==="Nouveau";}).length;
  var b=$("sb-sig");if(b)b.style.display=nb>0?"inline":"none";
  el("sk-tot",SIGN.length);
  el("sk-new",SIGN.filter(function(s){return s.statut==="Nouveau";}).length);
  el("sk-ec",SIGN.filter(function(s){return s.statut==="En cours";}).length);
  el("sk-re",SIGN.filter(function(s){return s.statut==="Résolu";}).length);
  el("k-sig",SIGN.filter(function(s){return s.statut==="Nouveau";}).length);
}
function fSig(){
  var ty=v("sf-type"),st=v("sf-st"),q=v("sf-q").toLowerCase();
  var r=SIGN.filter(function(s){return(!ty||s.type===ty)&&(!st||s.statut===st)&&(!q||(s.titre||"").toLowerCase().indexOf(q)>=0||(s.lieu||"").toLowerCase().indexOf(q)>=0);});
  el("sf-cnt",r.length+" signalement(s)");
  var sl=$("sig-list"); if(!sl)return;
  sl.innerHTML=r.length?r.map(function(s){
    var col=s.statut==="Nouveau"?"var(--red)":s.statut==="En cours"?"var(--amber)":s.statut==="Résolu"?"var(--g4)":"var(--i4)";
    var cls=s.statut==="Nouveau"?"new":s.statut==="En cours"?"enc":s.statut==="Résolu"?"res":"";
    return '<div class="sig-c '+cls+'" onclick="openSig('+s.id+')">'
      +'<div style="display:flex;align-items:flex-start;gap:12px">'
      +'<div style="width:42px;height:42px;border-radius:10px;background:'+col+'18;border:1px solid '+col+'30;display:flex;align-items:center;justify-content:center;font-size:1.15rem;flex-shrink:0">'+( SIG_ICO[s.type]||"📋")+'</div>'
      +'<div style="flex:1">'
      +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">'
      +'<span style="font-size:.84rem;font-weight:700;font-family:var(--fd)">'+(s.urgence==="urgente"?"🔴 ":s.urgence==="importante"?"🟡 ":"")+s.titre+'</span>'
      +'<span class="b b-nd" style="background:'+col+'18;color:'+col+'">'+s.statut+'</span>'
      +'</div>'
      +'<div style="font-size:.73rem;color:var(--i3)">📍 '+s.lieu+(s.service?" — 🏢 "+s.service:"")+'</div>'
      +(s.description?'<div style="font-size:.7rem;color:var(--i4);margin-top:2px">'+s.description.substring(0,100)+'</div>':"")
      +'<div style="font-size:.62rem;color:var(--i4);margin-top:3px;font-family:var(--fm)">'+( s.signale_par||"—")+" · "+s.created+'</div>'
      +'</div>'
      +'<button class="btn btn-d btn-sm" style="flex-shrink:0" onclick="event.stopPropagation();delSig('+s.id+')">×</button>'
      +'</div></div>';
  }).join(""):'<div class="empty"><div class="empty-ico">✅</div><div class="empty-t">Aucun signalement</div><div class="empty-s">Cliquez sur + Signaler.</div></div>';
}

function svSig(){
  var d={titre:v("sig-ti"),type:v("sig-ty"),urgence:v("sig-urg"),lieu:v("sig-lieu"),description:v("sig-desc"),service:v("sig-serv"),signale_par:v("sig-par")||"Élu"};
  if(!d.titre||!d.lieu){toast("Titre et lieu obligatoires");return;}
  apiPost("/api/signalements",d).then(function(r){if(r.ok){SIGN.unshift(r.item);cm();fSig();updSigBadge();toast("Signalement enregistré");}});
}

function openSig(id){
  _sigId=id;
  var s=SIGN.find(function(x){return x.id===id;});if(!s)return;
  var col=s.statut==="Nouveau"?"var(--red)":s.statut==="En cours"?"var(--amber)":s.statut==="Résolu"?"var(--g4)":"var(--i4)";
  $("sdt-t").textContent="🔴 "+s.titre;
  $("sdt-body").innerHTML='<div style="background:'+col+'12;border-left:3px solid '+col+';border-radius:var(--r);padding:.75rem 1rem;margin-bottom:.85rem">'
    +'<div style="font-size:.82rem;font-weight:700">'+s.titre+'</div>'
    +'<div style="font-size:.73rem;color:var(--i3)">'+s.type+" · "+s.lieu+(s.urgence?" · "+s.urgence:"")+'</div></div>'
    +(s.description?'<div style="font-size:.78rem;color:var(--i2);margin-bottom:.85rem;line-height:1.6">'+s.description+'</div>':"")
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:.85rem">'
    +'<div style="font-size:.72rem;background:var(--w);border-radius:var(--r);padding:.6rem .75rem"><span style="font-size:.62rem;font-weight:700;color:var(--i3);text-transform:uppercase;display:block;margin-bottom:2px">Signalé par</span>'+(s.signale_par||"—")+'</div>'
    +'<div style="font-size:.72rem;background:var(--w);border-radius:var(--r);padding:.6rem .75rem"><span style="font-size:.62rem;font-weight:700;color:var(--i3);text-transform:uppercase;display:block;margin-bottom:2px">Service</span>'+(s.service||"Non attribué")+'</div>'
    +'<div style="font-size:.72rem;background:var(--w);border-radius:var(--r);padding:.6rem .75rem"><span style="font-size:.62rem;font-weight:700;color:var(--i3);text-transform:uppercase;display:block;margin-bottom:2px">Statut</span><span style="color:'+col+';font-weight:700">'+s.statut+'</span></div>'
    +'<div style="font-size:.72rem;background:var(--w);border-radius:var(--r);padding:.6rem .75rem"><span style="font-size:.62rem;font-weight:700;color:var(--i3);text-transform:uppercase;display:block;margin-bottom:2px">Créé le</span>'+s.created+'</div>'
    +'</div>'
    +'<div style="font-size:.72rem;font-weight:700;color:var(--i2);margin-bottom:.5rem">Historique</div>'
    +'<div style="display:flex;flex-direction:column;gap:5px">'
    +((s.historique||[]).map(function(h){return '<div style="display:flex;align-items:center;gap:8px;font-size:.71rem;padding:.45rem .7rem;background:var(--w);border-radius:var(--r)"><span style="font-weight:700;color:var(--g3)">'+h.statut+'</span><span style="color:var(--i3)">—</span><span>'+h.auteur+'</span><span style="color:var(--i4);font-family:var(--fm);margin-left:auto">'+h.ts+'</span></div>';}).join(""))
    +'</div>';
  var dd=$("sdt-del");if(dd){dd.onclick=function(){if(!confirm("Supprimer ce signalement ?"))return;apiDel("/api/signalements/"+id).then(function(d){if(d.ok){SIGN=SIGN.filter(function(s){return s.id!==id;});cm();fSig();updSigBadge();toast("Supprimé");}});};}
  $("sdt-nst").value="";
  om("sig-det");
}

function updSig(){
  var nst=v("sdt-nst");if(!nst){toast("Choisissez un statut");return;}
  apiPut("/api/signalements/"+_sigId+"/statut",{statut:nst,auteur:ME.nom}).then(function(d){
    if(d.ok){SIGN=SIGN.map(function(s){return s.id===_sigId?Object.assign({},s,{statut:nst}):s;});cm();fSig();updSigBadge();toast("Statut : "+nst);}
  });
}
function delSig(id){if(!confirm("Supprimer ?"))return;apiDel("/api/signalements/"+id).then(function(d){if(d.ok){SIGN=SIGN.filter(function(s){return s.id!==id;});fSig();updSigBadge();}});}

// ── ÉVÉNEMENTS ───────────────────────────────────────────────────────────────
var EV_ICO={municipal:"🏛",associatif:"🤝",culturel:"🎭",sportif:"⚽",commemoration:"🎖",autre:"📌"};
var EV_COL={municipal:"var(--g3)",associatif:"var(--amber)",culturel:"#8B5CF6",sportif:"var(--blue)",commemoration:"#7f8c8d",autre:"var(--i3)"};
function renderEv(){
  var now=new Date().toISOString().slice(0,10);
  var ev=$("ev-list"); if(!ev)return;
  var sorted=EVTS.slice().sort(function(a,b){return a.date>b.date?1:-1;});
  var fut=sorted.filter(function(e){return e.date>=now;}),past=sorted.filter(function(e){return e.date<now;});
  function card(e,isPast){
    var col=EV_COL[e.type]||"var(--i3)";var ico=EV_ICO[e.type]||"📌";
    return '<div class="ev-c'+(isPast?" past":"")+'">'
      +'<div class="ev-db" style="background:'+col+'18;border:1px solid '+col+'30"><div class="ev-day" style="color:'+col+'">'+e.date.slice(8)+'</div><div class="ev-mon" style="color:'+col+'">'+MOIS[+e.date.slice(5,7)-1]+'</div></div>'
      +'<div style="flex:1">'
      +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><span style="font-size:1rem">'+ico+'</span><span style="font-size:.86rem;font-weight:700;font-family:var(--fd)">'+e.titre+'</span><span style="font-size:.62rem;font-weight:600;padding:2px 7px;border-radius:7px;background:'+col+'18;color:'+col+'">'+e.type+'</span></div>'
      +'<div style="font-size:.72rem;color:var(--i3)">'+(e.heure?"🕐 "+e.heure+"  ":"")+(e.lieu?"📍 "+e.lieu:"")+(e.organisateur?"  · "+e.organisateur:"")+'</div>'
      +(e.description?'<div style="font-size:.7rem;color:var(--i4);margin-top:3px;line-height:1.4">'+e.description+'</div>':"")
      +'</div>'
      +'<button class="btn btn-d btn-sm" style="flex-shrink:0;align-self:flex-start" onclick="delEv('+e.id+')">×</button>'
      +'</div>';
  }
  var html="";
  if(fut.length)html+='<div style="font-size:.72rem;font-weight:700;color:var(--i3);text-transform:uppercase;letter-spacing:.06em;padding:.25rem 0 .65rem">À venir ('+fut.length+')</div>'+fut.map(function(e){return card(e,false);}).join("");
  if(past.length)html+='<div style="font-size:.72rem;font-weight:700;color:var(--i3);text-transform:uppercase;letter-spacing:.06em;padding:.75rem 0 .65rem;margin-top:.5rem;border-top:1px solid var(--w2)">Passés ('+past.length+')</div>'+past.map(function(e){return card(e,true);}).join("");
  ev.innerHTML=html||'<div class="empty"><div class="empty-ico">🎪</div><div class="empty-t">Aucun événement</div><div class="empty-s">Cliquez sur + Ajouter.</div></div>';
}
function svEv(){
  var d={titre:v("ev-ti"),date:v("ev-d"),heure:v("ev-h"),lieu:v("ev-lieu"),type:v("ev-ty"),description:v("ev-desc"),organisateur:v("ev-org")};
  if(!d.titre||!d.date){toast("Titre et date obligatoires");return;}
  apiPost("/api/evenements",d).then(function(r){if(r.ok){EVTS.push(r.item);EVTS.sort(function(a,b){return a.date>b.date?1:-1;});cm();renderEv();toast("Événement ajouté");}});
}
function delEv(id){if(!confirm("Supprimer ?"))return;apiDel("/api/evenements/"+id).then(function(d){if(d.ok){EVTS=EVTS.filter(function(e){return e.id!==id;});renderEv();}});}

// ── NOUVEAU PROJET ────────────────────────────────────────────────────────────
function createP(){
  var t=v("np-t").trim(),r=v("np-r").trim();
  if(!t||!r){toast("Titre et résumé obligatoires");return;}
  apiPost("/api/projet",{titre:t,theme:v("np-th"),statut:v("np-s"),annee:v("np-a"),importance:v("np-i"),resume:r,description:v("np-d"),tags:v("np-tags")}).then(function(res){
    if(res.ok){P.push(res.projet);buildFilters();fG();buildCG();buildCharts();resetNP();
    $("np-res").innerHTML='<div style="background:var(--g8);border-radius:var(--r);padding:.75rem;font-size:.79rem;color:var(--g2);border:1px solid var(--g7)">Projet créé : <strong>'+res.projet.titre+'</strong></div>';
    toast("Projet créé !");}
  });
}
function resetNP(){["np-t","np-r","np-d","np-tags","np-a"].forEach(function(i){var e=$(i);if(e)e.value="";});$("np-res").innerHTML="";}

// ── HISTORIQUE ────────────────────────────────────────────────────────────────
function renderNt(){
  var nl=$("nt-list"); if(!nl)return;
  var TYPE_CLS={statut:"nt-tp",annonce:"nt-ta",doc:"nt-td",signalement:"nt-ts",cr:"nt-tp",projet:"nt-tc"};
  var TYPE_LBL={statut:"Statut",annonce:"Annonce",doc:"Document",signalement:"Signal.",cr:"CR",projet:"Créé"};
  nl.innerHTML=NF.slice(0,80).map(function(n){
    var cls=TYPE_CLS[n.type]||"nt-tp",lbl=TYPE_LBL[n.type]||"Notif";
    return '<div class="nt"><div class="nt-dot" style="background:'+(n.new?"var(--g4)":"var(--i4)")+'"></div>'
      +'<span class="nt-type '+cls+'">'+lbl+'</span>'
      +'<span style="flex:1;font-size:.76rem"><strong>'+n.titre+'</strong>'+(n.statut?' → <span class="b '+bc(n.statut)+'">'+n.statut+'</span>':"")+'</span>'
      +'<span style="font-size:.66rem;color:var(--i4);font-family:var(--fm)">'+n.ts+'</span></div>';
  }).join("")||'<div class="empty"><div class="empty-ico">🔔</div><div class="empty-t">Aucune activité</div></div>';
}

// ── BUDGET ────────────────────────────────────────────────────────────────────
function impB(inp){
  var f=inp.files[0];if(!f)return;
  var rd=new FileReader();
  rd.onload=function(e){
    var sep=String.fromCharCode(10);
    var lines=e.target.result.split(sep).filter(function(l){return l.trim();});
    if(!lines.length)return;
    var hd=lines[0].split(",").map(function(h){return h.trim();});
    var rows=lines.slice(1).map(function(l){return l.split(",").map(function(c){return c.trim();});});
    var html='<div class="tbw"><table><thead><tr>'+hd.map(function(h,i){return '<th style="text-align:'+(i>0?"right":"left")+'">'+h+'</th>';}).join("")+'</tr></thead><tbody>';
    rows.forEach(function(row){html+='<tr>'+row.map(function(cell,i){var num=parseFloat(cell.replace(/[^0-9.-]/g,""));var fmt=(!isNaN(num)&&i>0)?new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(num):cell;var col="";if(i===2&&row[1]){var v1=parseFloat(row[1].replace(/[^0-9.-]/g,"")),v2=parseFloat(row[2].replace(/[^0-9.-]/g,""));if(!isNaN(v1)&&!isNaN(v2)){col=v2>v1?"color:var(--red);font-weight:600":"color:var(--g4);font-weight:600";}}return'<td style="text-align:'+(i>0?"right":"left")+";"+col+'">'+fmt+'</td>';}).join("")+'</tr>';});
    html+='</tbody></table></div>';
    $("btable").innerHTML=html;
    toast("Budget importé : "+rows.length+" lignes");
  };
  rd.readAsText(f);
}

// ── COMMUNICATIONS ────────────────────────────────────────────────────────────
function genC(){
  var type=v("ct"),sujet=v("cs").trim(),ctx=v("cc");
  if(!sujet){toast("Indiquez le sujet");return;}
  el("c-st","⏳ Génération en cours…");
  $("cr-gen").value="";
  apiPost("/api/genere",{type:type,sujet:sujet,contexte:ctx}).then(function(d){
    el("c-st","");
    if(d.ok){$("cr-gen").value=d.texte;toast("Document généré");}
    else{$("cr-gen").value="Erreur : "+d.error;toast("Erreur : "+d.error,4000);}
  }).catch(function(){el("c-st","");toast("Erreur réseau");});
}
function copyC(){var t=$("cr-gen");t.select();document.execCommand("copy");toast("Copié !");}

// ── CHAT ──────────────────────────────────────────────────────────────────────
function toggleChat(){_chatOpen=!_chatOpen;$("chat-panel").classList.toggle("on",_chatOpen);if(_chatOpen){$("cbdg").style.display="none";renderChatMsgs(CHAT);scrollChat();}}
function openVisio(){window.open("https://kmeet.infomaniak.com/vizilleenmouvement","_blank");}
function switchChannel(){CHAT=[];renderChatMsgs([]);pollChat();}
function resetChat(){
  var ch=v('chat-ch')||'general';
  if(!confirm('Vider ce canal ? Les messages seront supprimés.'))return;
  fetch('/api/chat?channel='+ch,{method:'DELETE',credentials:'include'})
    .then(function(r){return r.json();})
    .then(function(d){
      if(d.ok){
        CHAT=[];
        renderChatMsgs([]);
        // Vider aussi les widgets du dashboard sur le même canal
        var wgCh=v('wg-chat-ch');
        if(wgCh===ch){var wm=$('wg-chat-msgs');if(wm)wm.innerHTML='';}
        var wgCh2=v('wg-chat-ch2');
        if(wgCh2===ch){var wm2=$('wg-chat-msgs2');if(wm2)wm2.innerHTML='';}
        toast('🗑 Canal vidé');
      } else {toast('Erreur',3000);}
    });
}


function sendMsg(){var i=$("chat-inp"),txt=i.value.trim();if(!txt)return;i.value="";apiPost("/api/chat",{channel:v("chat-ch"),auteur:ME.nom,avatar:ME.avatar,texte:txt}).then(function(d){if(d.ok&&d.message){var _eis=CHAT.map(function(m){return m.id;});if(_eis.indexOf(d.message.id)<0)CHAT.push(d.message);if(d.message.id)_chatLast=d.message.id;renderChatMsgs(CHAT);scrollChat();}}); }
function pollChat(){var ch=v("chat-ch")||"general";apiGet("/api/chat?channel="+ch+"&since="+_chatLast).then(function(d){if(d.ok&&d.messages&&d.messages.length){var _ei=CHAT.map(function(m){return m.id;});var _nw=d.messages.filter(function(m){return _ei.indexOf(m.id)<0;});if(_nw.length){CHAT=CHAT.concat(_nw);_chatLast=d.lastId;if(_chatOpen){renderChatMsgs(CHAT);scrollChat();}else{var _b=$("cbdg");if(_b)_b.style.display="block";}}}});}
function renderChatMsgs(msgs){var el2=$("chat-msgs");if(!el2)return;el2.innerHTML=msgs.slice(-40).map(function(m){var me=m.auteur===ME.nom||m.avatar===ME.avatar;return '<div class="msg-w'+(me?" me":"")+'">'+'<div class="msg-meta">'+m.auteur+" · "+(m.ts||m.created_at||'')+'</div>'+'<div class="msg-bub'+(me?" me":"")+'">'+m.texte+'</div></div>';}).join("")||'<div class="empty" style="padding:2rem"><div class="empty-ico">💬</div><div class="empty-s">Aucun message.</div></div>';}
function scrollChat(){var e=$("chat-msgs");if(e)e.scrollTop=e.scrollHeight;}

// ── DÉMARRAGE ─────────────────────────────────────────────────────────────────
  // ── PAGE ACCUEIL PERSONNALISÉE ─────────────────────────────────────────────
  var CITATIONS = [
    "Un élu de proximité, c'est d'abord quelqu'un qui écoute.",
    "Vizille se construit ensemble, quartier par quartier.",
    "L'action municipale, c'est du concret au quotidien.",
    "Chaque projet voté est une promesse tenue aux Vizillois.",
    "La démocratie locale commence dans nos rues et nos salles de conseil.",
    "Gouverner, c'est prévoir — et agir avec le cœur.",
    "Le mandat 2026-2032 : six ans pour transformer Vizille.",
    "Ensemble, nous portons l'avenir de notre commune.",
  ];

/* ── ACCUEIL : HERO ─────────────────────────────────────────────────────── */
var CITATIONS = [
  "La commune, c'est la cellule vivante de la démocratie.",
  "Servir Vizille, c'est servir ses habitants au quotidien.",
  "Chaque décision compte — même la plus petite améliore une vie.",
  "Un élu de proximité voit la réalité là où d'autres voient des statistiques.",
  "Le mandat 2026-2032 : six ans pour transformer Vizille ensemble.",
  "Être élu, c'est avoir la confiance de ses voisins. Cela oblige.",
  "Les grands projets naissent souvent d'une petite idée bien portée.",
  "La concertation n'est pas une contrainte, c'est une force.",
  "Vizille a une histoire extraordinaire — son avenir est entre nos mains.",
  "L'action municipale, c'est du concret : une rue refaite, un enfant accueilli.",
  "Ensemble nous représentons 4 350 Vizillois — responsabilité et fierté.",
  "Le service public local, c'est le plus proche des gens.",
];



/* ── ACCUEIL : RACCOURCIS ────────────────────────────────────────────────── */
function renderShortcuts(){
  var sg=$("shortcuts-grid"); if(!sg)return;
  var today2=new Date().toISOString().slice(0,10);
  var sigNew=SIGN.filter(function(s){return s.statut==="Nouveau";}).length;
  var shortcuts=[
    {ico:"📚",lbl:"Bibliothèque",  sub:BIBLIO.length+" doc",       page:"biblio", col:"#ede9fe",tcol:"#6d28d9"},
    {ico:"🔴",lbl:"Signalements",  sub:sigNew?sigNew+" urgent"+(sigNew>1?"s":""):"RAS", page:"signal",col:sigNew?"#fee2e2":"var(--g8)",tcol:sigNew?"var(--red)":"var(--g2)"},
    {ico:"📂",lbl:"Mon dossier",   sub:"Privé 🔒",                  page:"repelus",col:"#fef3c7",tcol:"#92400e"},
    {ico:"👥",lbl:"Commissions",   sub:P.length+" projets",          page:"comm",  col:"var(--g8)",tcol:"var(--g2)"},
    {ico:"📊",lbl:"Tous projets",  sub:"Filtrer, modifier",          page:"global",col:"#e0e7ff",tcol:"#3730a3"},
    {ico:"✍️",lbl:"Rédiger",       sub:"Assisté IA",                 page:"comms", col:"#f3e8ff",tcol:"#7c3aed"},
    {ico:"🧑‍💼",lbl:"L'équipe",    sub:ELUS_DATA.length+" élus",    page:"elus",  col:"var(--g8)",tcol:"var(--g2)"},
    {ico:"📖",lbl:"Guide élu",     sub:"Droits & devoirs",           page:"guide", col:"#fef9c3",tcol:"#a16207"},
  ];
  sg.innerHTML=shortcuts.map(function(s){
    return '<div onclick="gpN(this)" data-page="'+s.page+'" class="scut">'
      +'<div style="display:flex;align-items:center;gap:8px">'
      +'<div style="width:30px;height:30px;border-radius:8px;background:'+s.col+';display:flex;align-items:center;justify-content:center;font-size:.9rem;flex-shrink:0">'+s.ico+'</div>'
      +'<div style="min-width:0"><div style="font-size:.73rem;font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+s.lbl+'</div>'
      +'<div style="font-size:.62rem;color:'+s.tcol+';margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+s.sub+'</div>'
      +'</div></div>'
      +'</div>';
  }).join("");
}

/* ── CALENDRIER MENSUEL ──────────────────────────────────────────────────── */
var _calYear=0,_calMonth=0;

function initCal(){
  var now=new Date();
  _calYear=now.getFullYear(); _calMonth=now.getMonth();
  renderCal();
}
function calPrev(){_calMonth--;if(_calMonth<0){_calMonth=11;_calYear--;}renderCal();}
function calNext(){_calMonth++;if(_calMonth>11){_calMonth=0;_calYear++;}renderCal();}

function renderCal(){
  var MOIS_N=["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
  var ct=$("cal-title"); if(ct)ct.textContent=MOIS_N[_calMonth]+" "+_calYear;
  var grid=$("cal-grid"); if(!grid)return;

  var today=new Date();
  var todayStr=today.getFullYear()+"-"+(String(today.getMonth()+1).padStart(2,"0"))+"-"+(String(today.getDate()).padStart(2,"0"));

  // Jours du mois
  var firstDay=new Date(_calYear,_calMonth,1);
  var lastDay=new Date(_calYear,_calMonth+1,0);
  // Lundi=0, ..., Dimanche=6
  var startDow=(firstDay.getDay()+6)%7; // convertir dim=0 → lun=0

  // Collecter les dates avec événements
  var eventDates={}, meetingDates={}, conseilDates={};
  var ym=_calYear+"-"+(String(_calMonth+1).padStart(2,"0"));
  AG.forEach(function(a){
    if((a.date||"").startsWith(ym)){
      var d=a.date.slice(8);
      if(a.type==="conseil") conseilDates[d]=true;
      else meetingDates[d]=true;
    }
  });
  EVTS.forEach(function(e){
    if((e.date||"").startsWith(ym)) eventDates[e.date.slice(8)]=true;
  });

  var cells="";
  // Cases vides avant le 1er
  for(var i=0;i<startDow;i++) cells+='<div></div>';
  // Jours
  for(var d2=1;d2<=lastDay.getDate();d2++){
    var ds=String(d2).padStart(2,"0");
    var fullDate=_calYear+"-"+(String(_calMonth+1).padStart(2,"0"))+"-"+ds;
    var isToday=fullDate===todayStr;
    var hasMtg=meetingDates[ds];
    var hasEv=eventDates[ds];
    var hasConseil=conseilDates[ds];

    var bg=isToday?"var(--g3)":"transparent";
    var fg=isToday?"#fff":"var(--ink)";
    var fw=isToday?"800":"400";
    var br=isToday?"50%":"4px";

    // Indicateurs colorés
    var dots="";
    if(hasConseil) dots+='<div style="width:4px;height:4px;border-radius:50%;background:#93c5fd;margin:0 1px"></div>';
    if(hasMtg)     dots+='<div style="width:4px;height:4px;border-radius:50%;background:var(--g5);margin:0 1px"></div>';
    if(hasEv)      dots+='<div style="width:4px;height:4px;border-radius:50%;background:var(--amber);margin:0 1px"></div>';

    var dotsHtml=dots?'<div style="display:flex;justify-content:center;margin-top:1px">'+dots+'</div>':"";

    cells+='<div onclick="selDay(this)" data-date="'+fullDate+'" style="cursor:pointer;text-align:center;border-radius:'+br+';background:'+bg+';padding:2px 1px;transition:.12s">'
      +'<div style="font-size:.7rem;font-weight:'+fw+';color:'+fg+'">'+d2+'</div>'
      +dotsHtml
      +'</div>';
  }
  grid.innerHTML=cells;
}

function selDay(el){selectCalDay(el.dataset.date||el.getAttribute("data-date"));}
function selectCalDay(dateStr){
  // Afficher les événements de ce jour dans l'agenda
  renderAgendaDay(dateStr);
}

/* ── AGENDA SEMAINE + JOUR SÉLECTIONNÉ ───────────────────────────────────── */
var _selDay="";

function renderAgendaWeek(){
  var now=new Date();
  var todayStr=now.toISOString().slice(0,10);
  _selDay=_selDay||todayStr;

  // Onglets : aujourd'hui + 6 jours suivants
  var tabs=$("week-tabs"); if(!tabs)return;
  var JOURS_C=["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"];
  var MOIS_C=["jan","fév","mar","avr","mai","jun","jul","aoû","sep","oct","nov","déc"];
  var html="";
  for(var i=0;i<7;i++){
    var d=new Date(now);
    d.setDate(now.getDate()+i);
    var ds=d.toISOString().slice(0,10);
    var isSelected=ds===_selDay;
    var isToday=ds===todayStr;
    // Compter les événements du jour
    var nb=AG.filter(function(a){return a.date===ds;}).length+EVTS.filter(function(e){return e.date===ds;}).length;
    html+='<div onclick="selADay(this)" data-day="'+ds+'" style="flex-shrink:0;cursor:pointer;padding:.45rem .75rem;border-radius:var(--r);background:'+(isSelected?"var(--g2)":"var(--w)")+';color:'+(isSelected?"#fff":"var(--i2)")+';border:1.5px solid '+(isSelected?"var(--g2)":isToday?"var(--g5)":"var(--w2)")+';text-align:center;min-width:52px;transition:.15s">'
      +'<div style="font-size:.6rem;font-weight:600;text-transform:uppercase;opacity:'+(isSelected?".8":".6")+'">'+JOURS_C[d.getDay()]+'</div>'
      +'<div style="font-size:1rem;font-weight:800;font-family:var(--fd);line-height:1.1">'+d.getDate()+'</div>'
      +'<div style="font-size:.58rem;opacity:'+(isSelected?".65":".45")+'">'+MOIS_C[d.getMonth()]+'</div>'
      +(nb?'<div style="width:6px;height:6px;border-radius:50%;background:'+(isSelected?"rgba(255,255,255,.8)":"var(--g5)")+';margin:.15rem auto 0"></div>':"")
      +'</div>';
  }
  tabs.innerHTML=html;
  renderAgendaDay(_selDay);
}

function selADay(el){var ds=el.dataset.day||el.getAttribute("data-day");selectAgendaDay(ds);renderWidgetDay(ds);}
function selectAgendaDay(ds){
  _selDay=ds;
  renderAgendaWeek();
}

function renderAgendaDay(ds){
  var dl=$("agenda-day-list"); if(!dl)return;
  var items=[];
  var AT={bureau:"Bureau municipal",commission:"Commission",conseil:"Conseil municipal",autre:"Réunion"};
  var ATCOL={bureau:"var(--g3)",commission:"var(--g4)",conseil:"var(--blue)",autre:"var(--i3)"};
  var EVC={municipal:"var(--g3)",associatif:"var(--amber)",culturel:"#8B5CF6",sportif:"var(--blue)",commemoration:"#7f8c8d",autre:"var(--i3)"};

  AG.filter(function(a){return a.date===ds;}).forEach(function(a){
    items.push({heure:a.heure||"",titre:a.titre,sous:a.lieu||"",col:ATCOL[a.type]||"var(--i3)",type:AT[a.type]||"Réunion",ico:"📅",id:"ag_"+a.id});
  });
  EVTS.filter(function(e){return e.date===ds;}).forEach(function(e){
    items.push({heure:e.heure||"",titre:e.titre,sous:e.lieu||e.organisateur||"",col:EVC[e.type]||"var(--i3)",type:e.type,ico:"🎪",id:"ev_"+e.id});
  });

  if(!items.length){
    dl.innerHTML='<div style="text-align:center;padding:.85rem 0;color:var(--i4);font-size:.75rem">Journée libre — aucune réunion ni événement prévu</div>';
    return;
  }
  items.sort(function(a,b){return (a.heure||"99:99")>(b.heure||"99:99")?1:-1;});
  dl.innerHTML=items.map(function(it){
    return '<div style="display:flex;gap:10px;align-items:flex-start;padding:.6rem .5rem;border-radius:var(--r);transition:.12s;cursor:default">'
      +'<div style="width:38px;text-align:center;flex-shrink:0;padding-top:1px">'
      +(it.heure?'<div style="font-size:.7rem;font-weight:700;color:var(--i2);font-family:var(--fm)">'+it.heure+'</div>':"")
      +'<div style="font-size:.9rem">'+it.ico+'</div>'
      +'</div>'
      +'<div style="border-left:3px solid '+it.col+';padding-left:.7rem;flex:1">'
      +'<div style="font-size:.8rem;font-weight:700;color:var(--ink)">'+it.titre+'</div>'
      +(it.sous?'<div style="font-size:.69rem;color:var(--i3);margin-top:1px">'+it.sous+'</div>':"")
      +'<div style="font-size:.62rem;font-weight:600;color:'+it.col+';margin-top:2px">'+it.type+'</div>'
      +'</div></div>';
  }).join("");

  // Prochaines échéances (7 prochains jours)
  renderUpcoming();
}

function renderUpcoming(){
  var up=$("agenda-upcoming"); if(!up)return;
  var now=new Date();
  var next7=new Date(now); next7.setDate(next7.getDate()+7);
  var todayStr=now.toISOString().slice(0,10);
  var endStr=next7.toISOString().slice(0,10);

  var items=[];
  var MOIS_U=["jan","fév","mar","avr","mai","jun","jul","aoû","sep","oct","nov","déc"];
  AG.forEach(function(a){if(a.date>todayStr&&a.date<=endStr)items.push({date:a.date,titre:a.titre,col:"var(--g4)",ico:"📅"});});
  EVTS.forEach(function(e){if(e.date>todayStr&&e.date<=endStr)items.push({date:e.date,titre:e.titre,col:"var(--amber)",ico:"🎪"});});
  items.sort(function(a,b){return a.date>b.date?1:-1;});

  if(!items.length){up.innerHTML='';return;}
  var html='<div style="font-size:.68rem;font-weight:700;color:var(--i3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:.5rem">Dans les 7 prochains jours</div>';
  html+=items.slice(0,5).map(function(it){
    var d=new Date(it.date+"T00:00:00");
    return '<div style="display:flex;align-items:center;gap:8px;padding:.35rem 0;border-bottom:1px solid var(--w2)">'
      +'<div style="font-size:.7rem;color:'+it.col+';font-weight:700;font-family:var(--fm);width:50px;flex-shrink:0">'+d.getDate()+" "+MOIS_U[d.getMonth()]+'</div>'
      +'<span style="font-size:.9rem">'+it.ico+'</span>'
      +'<div style="font-size:.75rem;color:var(--ink)">'+it.titre+'</div>'
      +'</div>';
  }).join("");
  up.innerHTML=html;
}

/* ── SIGNALEMENTS URGENTS SUR ACCUEIL ────────────────────────────────────── */
function checkUrgents(){
  var urgents=SIGN.filter(function(s){return s.statut==="Nouveau"&&s.urgence==="urgente";});
  var al=$("alert-urgents"); if(!al)return;
  if(urgents.length){
    al.style.display="flex";
    $("alert-urgents-txt").textContent=urgents.length+" signalement"+(urgents.length>1?"s":"")+" urgent"+(urgents.length>1?"s":"")+": "+urgents.slice(0,2).map(function(s){return s.titre;}).join(", ");
  } else {
    al.style.display="none";
  }
}

function gpN(el){gpByName(el.dataset.page||el.getAttribute("data-page"));}
function gpByName(pageName){
  var items=qsa(".sbi");
  for(var i=0;i<items.length;i++){
    var item=items[i];
    if(item.getAttribute("onclick")&&item.getAttribute("onclick").indexOf("'"+pageName+"'")>=0){
      item.click(); return;
    }
  }
}
function navToAgenda(){gp("agenda",qsa(".sbi")[3]);}


// ── ÉDITION PROJET ──────────────────────────────────────────────────────────
var _ePid=null, _auditBack=false;

// ── FICHE PROJET v3 ──────────────────────────────────────────────────────────
function _fpPanel(){
  var p=document.getElementById('main-panel');
  if(!p){p=document.createElement('div');p.id='main-panel';document.body.appendChild(p);}
  p.style.cssText='position:fixed;left:252px;right:0;top:54px;bottom:0;z-index:100;display:flex;flex-direction:column;overflow:hidden;background:var(--w);';
  return p;
}
function _fpCss(){
  if(document.getElementById('fp-css'))return;
  var s=document.createElement('style');s.id='fp-css';
  s.textContent='.fpt{background:none;border:none;padding:.55rem 1rem;font-size:.75rem;font-weight:600;color:var(--i3);cursor:pointer;border-bottom:2px solid transparent;white-space:nowrap;font-family:var(--fd)}.fpt.on{color:var(--g1);border-bottom-color:var(--g1);background:#fff}';
  document.head.appendChild(s);
}

function goAudit(){_auditBack=false;openPanel("audit");}
function oProjAudit(pid){_auditBack=true;oProj(pid);}
function oProj(pid){
  if(!_auditBack)_auditBack=false; // reset si appelé directement
  var p=P.find(function(x){return x.id===pid;}); if(!p)return;
  _ePid=pid; window._fpPid=pid;
  var statut=ST[pid]||p.statut||'ND';
  var cols={Prioritaire:'#dc2626',Programmé:'#2563eb','En cours':'#d97706',Réalisé:'#16a34a',Étude:'#8B5CF6',Abandonné:'#9ca3af'};
  var col=cols[statut]||'#64748b';
  var panel=_fpPanel(); _fpCss();
  var TABS=['infos','journal','contacts','docs','presse'];
  var TLBL={infos:'📋 Infos',journal:'📒 Journal',contacts:'👥 Contacts',docs:'📄 Documents',presse:'📰 Presse'};
  var th=''; TABS.forEach(function(t){th+='<button class="'+(t===TABS[0]?'fpt on':'fpt')+'" data-tab="'+t+'" onclick="fpTab(this)">'+TLBL[t]+'</button>';});
  panel.innerHTML=
    '<div style="background:var(--g1);color:#fff;padding:.6rem 1rem;display:flex;align-items:center;gap:10px;flex-shrink:0">'
    +'<div style="width:8px;height:8px;border-radius:50%;background:'+col+'"></div>'
    +'<span style="flex:1;font-size:.78rem;font-weight:700;font-family:var(--fd);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+p.titre+'</span>'
    +(_auditBack?'<button onclick="goAudit()" style="background:rgba(255,255,255,.15);border:none;color:#fff;border-radius:8px;padding:0 10px;height:26px;cursor:pointer;font-size:.72rem;font-weight:700;flex-shrink:0;white-space:nowrap">← Audit</button>':'')
    +'<button onclick="closePanel()" style="background:rgba(255,255,255,.15);border:none;color:#fff;border-radius:5px;width:26px;height:26px;cursor:pointer;font-size:1rem;flex-shrink:0">✕</button></div>'
    +'<div style="display:flex;background:var(--g8);border-bottom:1px solid var(--w2);flex-shrink:0;overflow-x:auto">'+th+'</div>'
    +'<div id="fp-body" style="flex:1;overflow-y:auto;padding:1.25rem 1.5rem"></div>';
  fpTab(panel.querySelector('.fpt'));
  panel.style.display='flex';
  qsa('.sbi').forEach(function(n){n.classList.remove('on');});
}
function fpTab(btn){
  var panel=document.getElementById('main-panel'); if(!panel)return;
  panel.querySelectorAll('.fpt').forEach(function(b){b.classList.remove('on');});
  if(btn)btn.classList.add('on');
  var tab=btn?(btn.getAttribute('data-tab')||'infos'):'infos';
  var pb=document.getElementById('fp-body'); if(!pb)return;
  var pid=window._fpPid;
  var p=P.find(function(x){return x.id===pid;})||{};
  var statut=ST[pid]||p.statut||'ND';
  if(tab==='infos'){fpRenderInfos(pid,p,statut);return;}
  pb.innerHTML='<div style="text-align:center;padding:3rem;color:var(--i3)">⏳ Chargement…</div>';
  apiGet('/api/projet/'+pid+'/fiche').then(function(f){
    if(!f){pb.innerHTML='<div style="text-align:center;padding:2rem;color:var(--red)">Erreur</div>';return;}
    if(tab==='journal')          fpRenderJournal(pid,p,statut,f);
    else if(tab==='contacts')    fpRenderPartContacts(pid,f.partenaires||[],f.contacts||[]);
    else if(tab==='docs')        fpRenderDocs(pid,f.docs||[]);
    else if(tab==='presse')      fpRenderPresse(pid,f.presse||[]);
  });
}
function fpReload(tab){var b=document.querySelector('.fpt[data-tab="'+tab+'"]');if(b)fpTab(b);}

// ── JOURNAL DE BORD (fusion Infos + Étapes + Notes) ─────────────────────────

// ── INFOS PROJET (pleine page) ───────────────────────────────────────────────
function fpRenderInfos(pid,p,statut){
  var pb=document.getElementById('fp-body'); if(!pb)return;
  var av=p.avancement||0;
  var stCols={Prioritaire:'#dc2626',Programmé:'#2563eb',Planifié:'#7c3aed','En cours':'#d97706',Réalisé:'#16a34a',Étude:'#6b7280',Suspendu:'#9ca3af',ND:'#9ca3af'};
  var col=stCols[statut]||'#64748b';
  var thO=''; Object.keys(COMM).forEach(function(k){COMM[k].forEach(function(t){thO+='<option value="'+t+'"'+(p.theme===t?' selected':'')+'>'+k+' — '+t+'</option>';});});
  var stO=''; SLIST.forEach(function(s){stO+='<option value="'+s+'"'+(statut===s?' selected':'')+'>'+s+'</option>';});
  var rO='<option value="">— Aucun référent —</option>';
  ELUS_DATA.forEach(function(e){var n=(e.prenom?e.prenom+' ':'')+e.nom;rO+='<option value="'+e.id+'"'+(p.responsable_id===e.id?' selected':'')+'>'+n+'</option>';});
  var ti=(p.titre||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  var rs=(p.resume||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  var ds=(p.description||'').replace(/&/g,'&amp;').replace(/</g,'&lt;');
  var tg=(Array.isArray(p.tags)?p.tags.join(', '):(p.tags||'')).replace(/"/g,'&quot;');
  var imp=p.importance||2;
  // Timeline supprimée (version 2)
  pb.innerHTML=
    '<div style="display:flex;flex-direction:column;gap:1rem">'
    // Statut + avancement
    +'<div style="background:#fff;border-radius:var(--R);border:1px solid var(--w2);padding:1.1rem 1.25rem;box-shadow:var(--s1)">'

    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:.75rem">'
    +'<select id="fp-st" class="fi" style="font-size:.78rem;padding:6px 9px" onchange="fpStatutChange(this)">'+stO+'</select>'
    +'<select id="fp-rsp" class="fi" style="font-size:.78rem;padding:6px 9px">'+rO+'</select>'
    +'</div>'
    +'<div style="display:flex;align-items:center;gap:8px">'
    +'<div style="background:var(--w2);border-radius:4px;height:8px;flex:1;overflow:hidden">'
    +'<div id="fp-av-bar" style="height:100%;border-radius:4px;background:'+col+';width:'+av+'%;transition:width .3s"></div>'
    +'</div>'
    +'<span id="fp-av-pct" style="font-size:.75rem;font-weight:700;color:var(--g1);white-space:nowrap;min-width:36px">'+av+'%</span>'
    +'<input type="range" id="fp-av-rng" min="0" max="100" value="'+av+'" style="width:80px;accent-color:var(--g2)" oninput="fpAvInput(this)">'
    +'<button onclick="fpSvAv('+pid+')" class="btn btn-p btn-sm" style="font-size:.68rem;padding:4px 10px">💾</button>'
    +'</div></div>'
    // Infos éditables
    +'<div style="background:#fff;border-radius:var(--R);border:1px solid var(--w2);padding:1.1rem 1.25rem;box-shadow:var(--s1)">'
    +'<div style="font-size:.68rem;font-weight:700;color:var(--i3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.85rem">Informations du projet</div>'
    +'<div style="display:flex;flex-direction:column;gap:9px">'
    +'<input id="fp-ti" class="fi" value="'+ti+'" placeholder="Titre *" style="font-size:.84rem;padding:8px 11px;font-weight:600">'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:9px">'
    +'<select id="fp-th" class="fi" style="font-size:.78rem;padding:7px 10px">'+thO+'</select>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
    +'<input id="fp-an" class="fi" type="number" value="'+(p.annee||'')+'" min="2026" max="2032" placeholder="Année" style="font-size:.78rem;padding:7px 10px">'
    +'<select id="fp-im" class="fi" style="font-size:.78rem;padding:7px 10px">'
    +'<option value="1"'+(imp===1?' selected':'')+'>★ Normale</option>'
    +'<option value="2"'+(imp===2?' selected':'')+'>★★ Importante</option>'
    +'<option value="3"'+(imp===3?' selected':'')+'>★★★ Prioritaire</option>'
    +'</select></div></div>'
    +'<input id="fp-rs" class="fi" value="'+rs+'" placeholder="Résumé court" style="font-size:.78rem;padding:7px 10px">'
    +'<textarea id="fp-ds" class="fi" rows="4" style="font-size:.78rem;padding:7px 10px;resize:vertical">'+ds+'</textarea>'
    +'<input id="fp-tg" class="fi" value="'+tg+'" placeholder="Tags…" style="font-size:.78rem;padding:7px 10px">'
    +'<div style="display:flex;gap:10px;padding-top:.25rem">'
    +'<button onclick="fpSvProj('+pid+')" class="btn btn-p">💾 Enregistrer</button>'
    +'<button onclick="fpDlProj('+pid+')" class="btn btn-d btn-sm" style="margin-left:auto">🗑 Supprimer</button>'
    +'</div></div></div>'
    +'</div>';
}

// ── JOURNAL = MAIN COURANTE ──────────────────────────────────────────────────
function fpRenderJournal(pid,p,statut,fiche){
  var pb=document.getElementById('fp-body'); if(!pb)return;
  var entries=(fiche&&fiche.journal)||[];
  var icoType={note:'📝',etape:'🏁',doc:'📎',statut:'🔄',avancement:'📊'};

  // ── Formulaire saisie ──
  var now=new Date();
  var dateStr=now.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  var timeStr=now.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
  var html=
    '<div style="background:#fff;border-radius:var(--R);border:1px solid var(--w2);padding:1.1rem 1.25rem;margin-bottom:1.25rem;box-shadow:var(--s1)">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.85rem">'
    +'<div style="font-size:.68rem;font-weight:700;color:var(--i3);text-transform:uppercase;letter-spacing:.05em">✍️ Nouvelle entrée</div>'
    +'<div style="font-size:.68rem;color:var(--i4)" id="jnow-lbl">'+dateStr+' à '+timeStr+'</div>'
    +'</div>'
    +'<input id="jn-obj" class="fi" placeholder="Objet (ex: Réunion avec la Métropole, Décision en bureau…)" style="font-size:.8rem;padding:7px 10px;margin-bottom:8px;width:100%;box-sizing:border-box">'
    +'<textarea id="jn-tx" class="fi" rows="4" placeholder="Compte rendu, décision prise, observation, point de situation…" style="font-size:.79rem;padding:8px 10px;resize:vertical;width:100%;box-sizing:border-box;margin-bottom:8px"></textarea>'
    // Fichier optionnel
    +'<div style="border:1px dashed var(--w2);border-radius:9px;padding:.65rem .9rem;display:flex;align-items:center;gap:10px;cursor:pointer;background:var(--g8);margin-bottom:8px" onclick="fpOpenFile('+pid+')">'
    +'<span style="font-size:1rem">📎</span>'
    +'<div id="jn-file-lbl" style="font-size:.74rem;color:var(--i3);flex:1">Joindre un fichier (optionnel) — PDF, Word, Email, Image…</div>'
    +'<input type="file" id="dc-file-'+pid+'" style="display:none" accept=".pdf,.doc,.docx,.xls,.xlsx,.eml,.msg,.txt,.jpg,.jpeg,.png,.odt,.ods" onchange="fpPreviewDoc(this,'+pid+')">'
    +'</div>'
    +'<div id="dc-preview-'+pid+'" style="display:none;margin-bottom:8px;padding:.5rem .8rem;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;font-size:.74rem;font-weight:700;color:var(--g1)"></div>'
    +'<div style="display:flex;align-items:center;gap:10px">'
    +'<label style="display:flex;align-items:center;gap:6px;font-size:.73rem;color:var(--i3);cursor:pointer">'
    +'<input type="checkbox" id="dc-bib-'+pid+'" style="accent-color:var(--g2)"> Ajouter à la Bibliothèque générale</label>'
    +'<button onclick="fpPublishEntry('+pid+')" class="btn btn-p" style="margin-left:auto">✅ Publier</button>'
    +'</div></div>';

  // ── Chronologie ──
  if(entries.length){
    html+='<div style="font-size:.65rem;font-weight:700;color:var(--i3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:.6rem">Chronologie</div>';
    entries.forEach(function(e){
      var isNote=(e.action==='note'), isDoc=(e.action==='doc');
      var ico=icoType[e.action]||'📝';
      var bdr=isNote?'border-left:3px solid var(--g4)':'border-left:3px solid var(--w2)';
      // Formater la date/heure de façon lisible
      var dt=''; var dtRaw=e.created_at||'';
      if(dtRaw){
        var d=new Date(dtRaw.replace(' ','T'));
        if(!isNaN(d)){
          dt=d.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short',year:'numeric'})
            +' à '+d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
        } else { dt=dtRaw.slice(0,16).replace('T',' '); }
      }
      html+='<div style="background:#fff;border-radius:var(--R);border:1px solid var(--w2);'+bdr+';padding:.85rem 1rem;margin-bottom:.5rem;box-shadow:var(--s1)">'
        +'<div style="display:flex;align-items:flex-start;gap:10px">'
        +'<span style="font-size:1rem;flex-shrink:0;padding-top:2px">'+ico+'</span>'
        +'<div style="flex:1;min-width:0">'
        // En-tête : auteur + date/heure bien visible
        +'<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:.2rem">'
        +'<span style="font-size:.75rem;font-weight:700;color:var(--g2)">'+(e.auteur_nom||'Système')+'</span>'
        +(dt?'<span style="font-size:.67rem;color:var(--i4);white-space:nowrap">🕐 '+dt+'</span>':'')
        +'</div>'
        // Objet en gras si présent
        +(e.ancien_val?'<div style="font-size:.82rem;font-weight:700;color:var(--ink);margin-bottom:.2rem">'+e.ancien_val+'</div>':'')
        // Texte
        +(e.nouveau_val?'<div style="font-size:.78rem;color:var(--i2);line-height:1.65;white-space:pre-wrap">'+e.nouveau_val+'</div>':'')
        +'</div>'
        +((e.action==='note'||e.action==='doc')
          ?'<button onclick="fpDelNote('+e.id+')" style="background:none;border:none;color:var(--i4);cursor:pointer;font-size:.85rem;flex-shrink:0;padding:2px 4px" title="Supprimer">×</button>'
          :'')
        +'</div></div>';
    });
  } else {
    html+='<div class="empty"><div class="empty-ico">📒</div><div class="empty-s">Aucune entrée — rédigez la première note ci-dessus.</div></div>';
  }
  pb.innerHTML=html;
  // Brouillons
  setTimeout(function(){
    draftAttach(document.getElementById('jn-obj'),'jobj_'+pid);
    draftAttach(document.getElementById('jn-tx'),'jtx_'+pid);
  },50);
  // Mettre à jour l'heure toutes les minutes
  setInterval(function(){
    var d=new Date();
    var el=document.getElementById('jnow-lbl');
    if(el)el.textContent=d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})+' à '+d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
  },60000);
}

function fpPublishEntry(pid){
  var obj=document.getElementById('jn-obj');
  var tx=document.getElementById('jn-tx');
  var fi=document.getElementById('dc-file-'+pid);
  var file=fi&&fi.files&&fi.files[0]?fi.files[0]:null;
  var objet=(obj?obj.value.trim():'');
  var texte=(tx?tx.value.trim():'');
  var bibCb=document.getElementById('dc-bib-'+pid);
  var toBib=bibCb&&bibCb.checked;
  if(!objet&&!texte&&!file){toast('Saisir un objet, un texte ou joindre un fichier');return;}
  function afterSave(){
    draftClear('jobj_'+pid); draftClear('jtx_'+pid);
    if(obj)obj.value=''; if(tx)tx.value='';
    if(fi)fi.value='';
    var prev=document.getElementById('dc-preview-'+pid);
    if(prev)prev.style.display='none';
    if(bibCb)bibCb.checked=false;
    fpReload('journal');
    var d=new Date();
    toast('📝 Publié — '+d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}));
  }
  if(file){
    // Upload + note avec objet
    var form=new FormData();
    form.append('file',file,file.name);
    form.append('titre',objet||file.name.replace(/\.[^.]+$/,''));
    form.append('type','Autre');
    var btn=document.querySelector('[onclick="fpPublishEntry('+pid+')"]');
    if(btn){btn.disabled=true;btn.textContent='⏳';}
    var xhr=new XMLHttpRequest();
    xhr.open('POST','/api/projet/'+pid+'/upload-doc');
    xhr.withCredentials=true;
    xhr.onload=function(){
      var r=JSON.parse(xhr.responseText||'{}');
      if(r.ok&&toBib) fpAddToBiblio(objet||file.name,r.type||'Autre',r.url||'',pid);
      // Publier aussi la note texte si présente
      if(texte){
        apiPost('/api/projet/'+pid+'/notes',{type:'note',texte:texte,objet:objet}).then(afterSave);
      } else {
        afterSave();
      }
      if(btn){btn.disabled=false;btn.textContent='✅ Publier';}
    };
    xhr.onerror=function(){toast('Erreur réseau',3000);if(btn){btn.disabled=false;btn.textContent='✅ Publier';}};
    xhr.send(form);
  } else {
    // Note texte seule
    apiPost('/api/projet/'+pid+'/notes',{type:'note',texte:(texte||objet),objet:objet}).then(function(r){
      if(r&&r.ok) afterSave(); else toast('Erreur',3000);
    });
  }
}

// Alias pour compatibilité
function fpAddNote(pid){fpPublishEntry(pid);}
function fpJTab(i){}
function fpAttachDrafts(pid){}


// ── PARTENAIRES + CONTACTS (onglet fusionné) ─────────────────────────────────
function fpRenderPartContacts(pid,partenaires,contacts){
  var pb=document.getElementById('fp-body'); if(!pb)return;
  // Fusion : anciens partenaires + contacts dans une liste unique
  var tous=[];
  partenaires.forEach(function(p){tous.push({id:p.id,src:'part',nom:p.nom,rs:p.type||'',role:'',email:p.email||'',tel:p.tel||'',partenariat:1});});
  contacts.forEach(function(c){tous.push({id:c.id,src:'ct',nom:c.nom,rs:c.raison_sociale||c.organisation||'',role:c.role||'',email:c.email||'',tel:c.tel||'',partenariat:c.partenariat?1:0});});
  var html=
    '<div style="background:#fff;border-radius:var(--R);border:1px solid var(--w2);padding:1rem 1.25rem;margin-bottom:1rem;box-shadow:var(--s1)">'
    +'<div style="font-size:.68rem;font-weight:700;color:var(--i3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.85rem">+ Ajouter un contact</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">'
    +'<input id="ct-nm" class="fi" placeholder="Nom *" style="font-size:.79rem;padding:6px 9px">'
    +'<input id="ct-ro" class="fi" placeholder="Rôle / Fonction" style="font-size:.79rem;padding:6px 9px">'
    +'<input id="ct-rs" class="fi" placeholder="Raison sociale (organisme, société…)" style="font-size:.79rem;padding:6px 9px">'
    +'<input id="ct-em" class="fi" placeholder="Email" type="email" style="font-size:.79rem;padding:6px 9px">'
    +'<input id="ct-te" class="fi" placeholder="Téléphone" style="font-size:.79rem;padding:6px 9px">'
    +'<div style="display:flex;align-items:center;gap:8px;padding:0 2px">'
    +'<input type="checkbox" id="ct-pt" style="width:15px;height:15px;accent-color:var(--g2);cursor:pointer">'
    +'<label for="ct-pt" style="font-size:.76rem;color:var(--i2);cursor:pointer">Organisme partenaire</label>'
    +'</div></div>'
    +'<div style="display:flex;justify-content:flex-end">'
    +'<button onclick="fpAddContact('+pid+')" class="btn btn-p btn-sm">+ Ajouter</button>'
    +'</div></div>';
  if(tous.length){
    tous.forEach(function(c){
      var ico=c.partenariat?'🤝':'👤';
      var badge=c.partenariat?'<span style="font-size:.63rem;background:#dcfce7;color:#15803d;padding:1px 7px;border-radius:4px;font-weight:700;margin-left:6px">Partenaire</span>':'';
      var delFn=c.src==='part'?'fpDelPart':'fpDelCt';
      html+='<div style="background:#fff;border-radius:var(--R);border:1px solid var(--w2);padding:.75rem 1rem;margin-bottom:.4rem;display:flex;align-items:center;gap:10px;box-shadow:var(--s1)">'
        +'<span style="font-size:1.1rem;flex-shrink:0">'+ico+'</span>'
        +'<div style="flex:1">'
        +'<div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px">'
        +'<span style="font-size:.82rem;font-weight:700">'+c.nom+'</span>'+badge
        +'</div>'
        +((c.rs||c.role)?'<div style="font-size:.7rem;color:var(--i3)">'+(c.rs||'')+(c.rs&&c.role?' · ':'')+c.role+'</div>':'')
        +(c.email?'<a href="mailto:'+c.email+'" style="font-size:.7rem;color:var(--g3)">'+c.email+'</a>':'')
        +(c.tel?'<span style="font-size:.7rem;color:var(--i4);margin-left:8px">'+c.tel+'</span>':'')
        +'</div>'
        +'<button onclick="'+delFn+'('+c.id+','+pid+')" style="background:none;border:none;color:var(--i4);cursor:pointer;font-size:.9rem;flex-shrink:0">×</button>'
        +'</div>';
    });
  } else {
    html+='<div class="empty"><div class="empty-ico">👥</div><div class="empty-s">Aucun contact pour ce projet.</div></div>';
  }
  pb.innerHTML=html;
}
function fpAddContact(pid){
  var nm=document.getElementById('ct-nm'); if(!nm||!nm.value.trim()){toast('Nom obligatoire');return;}
  var pt=document.getElementById('ct-pt');
  apiPost('/api/projet/'+pid+'/contacts',{
    nom:nm.value.trim(),
    role:(document.getElementById('ct-ro')||{}).value||'',
    raison_sociale:(document.getElementById('ct-rs')||{}).value||'',
    email:(document.getElementById('ct-em')||{}).value||'',
    tel:(document.getElementById('ct-te')||{}).value||'',
    partenariat:pt&&pt.checked?1:0
  }).then(function(r){if(r&&r.ok)fpReload('contacts');});
}
function fpAddPart(pid){fpAddContact(pid);}
function fpAddCt(pid){fpAddContact(pid);}
function fpDelPart(id,pid){apiDel('/api/partenaire/'+id).then(function(){fpReload('contacts');});}
function fpDelCt(id,pid){apiDel('/api/contact/'+id).then(function(){fpReload('contacts');});}


function fpRenderDocs(pid,items){
  var pb=document.getElementById('fp-body'); if(!pb)return;
  var tyOpts='<option value="CR de commission">CR de commission</option><option value="Délibération">Délibération</option><option value="Étude">Étude</option><option value="Rapport">Rapport</option><option value="Avis">Avis</option><option value="Devis">Devis</option><option value="Courrier">Courrier</option><option value="Email">Email</option><option value="Autre">Autre</option>';
  var icoMap={'CR de commission':'📋','Délibération':'🏛','Étude':'🔬','Rapport':'📊','Avis':'⚖️','Devis':'💶','Courrier':'📨','Email':'📧','Autre':'📄'};
  var html=
    '<div style="background:#fff;border-radius:var(--R);border:1px solid var(--w2);padding:1.1rem;margin-bottom:1rem;box-shadow:var(--s1)">'
    +'<div style="font-size:.68rem;font-weight:700;color:var(--i3);text-transform:uppercase;margin-bottom:.85rem">📎 Déposer un document</div>'
    // Upload fichier
    +'<div style="border:2px dashed var(--w2);border-radius:10px;padding:1rem;text-align:center;margin-bottom:.85rem;background:var(--g8);cursor:pointer" onclick="fpOpenFile('+pid+')">'
    +'<div style="font-size:1.5rem;margin-bottom:.3rem">📂</div>'
    +'<div style="font-size:.78rem;color:var(--i3)">Cliquer pour sélectionner un fichier</div>'
    +'<div style="font-size:.67rem;color:var(--i4);margin-top:2px">PDF, Word, Excel, Email, Image…</div>'
    +'<input type="file" id="dc-file-'+pid+'" style="display:none" accept=".pdf,.doc,.docx,.xls,.xlsx,.eml,.msg,.txt,.jpg,.jpeg,.png,.odt,.ods,.ppt,.pptx" onchange="fpPreviewDoc(this,'+pid+')">'
    +'</div>'
    +'<div id="dc-preview-'+pid+'" style="display:none;margin-bottom:.85rem;padding:.7rem;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0">'
    +'<div style="font-size:.75rem;font-weight:700;color:var(--g1)" id="dc-fname-'+pid+'"></div>'
    +'</div>'
    // Métadonnées + lien optionnel
    +'<div style="display:grid;grid-template-columns:1fr auto;gap:8px;margin-bottom:8px">'
    +'<input id="dc-ti-'+pid+'" class="fi" placeholder="Titre du document *" style="font-size:.79rem;padding:6px 9px">'
    +'<select id="dc-ty-'+pid+'" class="fi" style="font-size:.79rem;padding:6px 9px">'+tyOpts+'</select>'
    +'</div>'
    +'<input id="dc-ul-'+pid+'" class="fi" placeholder="Ou coller un lien URL (optionnel si fichier joint)" style="font-size:.79rem;padding:6px 9px;width:100%;box-sizing:border-box;margin-bottom:8px">'
    +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:.75rem;color:var(--i3)">'
    +'<input type="checkbox" id="dc-bib-'+pid+'" style="width:14px;height:14px;accent-color:var(--g2);cursor:pointer">'
    +'<label for="dc-bib-'+pid+'" style="cursor:pointer">Ajouter aussi à la <strong>Bibliothèque générale</strong></label>'
    +'</div>'
    +'<div style="display:flex;justify-content:flex-end">'
    +'<button onclick="fpAddDoc('+pid+')" class="btn btn-p btn-sm">💾 Enregistrer</button></div></div>';

  // Liste des documents
  if(items.length){
    items.forEach(function(d){
      var ico=icoMap[d.type]||'📄';
      var ext=d.url?(d.url.split('.').pop().toLowerCase()):'';
      var isFile=d.url&&d.url.startsWith('/uploads/');
      var isPdf=ext==='pdf';
      var isImg=['jpg','jpeg','png','gif','webp'].indexOf(ext)>=0;
      html+='<div style="background:#fff;border-radius:var(--R);border:1px solid var(--w2);padding:.85rem 1rem;margin-bottom:.6rem;box-shadow:var(--s1)">'
        +'<div style="display:flex;align-items:center;gap:10px">'
        +'<span style="font-size:1.3rem;flex-shrink:0">'+ico+'</span>'
        +'<div style="flex:1">'
        +'<div style="font-size:.82rem;font-weight:700;font-family:var(--fd)">'+d.titre+'</div>'
        +(d.type?'<span style="font-size:.67rem;background:var(--g8);color:var(--g2);padding:1px 8px;border-radius:6px;font-weight:600">'+d.type+'</span>':'')
        +(d.created_at?'<span style="font-size:.65rem;color:var(--i4);margin-left:8px">'+d.created_at.slice(0,10)+'</span>':'')
        +'</div>'
        +'<div style="display:flex;gap:6px;flex-shrink:0">'
        +(d.url
          ?'<a href="'+d.url+'" target="_blank" style="background:var(--g8);border:1px solid var(--g7);border-radius:7px;padding:4px 10px;font-size:.72rem;font-weight:700;color:var(--g2);text-decoration:none;display:flex;align-items:center;gap:4px">'+(isFile?'⬇️ Télécharger':'🔗 Ouvrir')+'</a>'
          :'')
        +'<button onclick="fpDelDoc('+d.id+','+pid+')" style="background:#fee2e2;border:1px solid #fca5a5;border-radius:6px;width:28px;height:28px;cursor:pointer;font-size:.8rem">×</button>'
        +'</div></div>'
        // Aperçu PDF inline
        +(isPdf&&isFile?'<div style="margin-top:.75rem;border-radius:8px;overflow:hidden;border:1px solid var(--w2)"><iframe src="'+d.url+'" style="width:100%;height:320px;border:none"></iframe></div>':'')
        +(isImg&&isFile?'<div style="margin-top:.75rem"><img src="'+d.url+'" style="max-width:100%;border-radius:8px;border:1px solid var(--w2)"></div>':'')
        +'</div>';
    });
  } else {
    html+='<div class="empty"><div class="empty-ico">📂</div><div class="empty-s">Aucun document — déposez des CR, rapports, courriers, emails…</div></div>';
  }
  pb.innerHTML=html;
}

function fpOpenFile(pid){var fi=document.getElementById('dc-file-'+pid);if(fi)fi.click();}
function fpPreviewDoc(input,pid){
  var file=input.files[0]; if(!file)return;
  var prev=document.getElementById('dc-preview-'+pid);
  var ti=document.getElementById('dc-ti-'+pid);
  if(prev){
    prev.style.display='block';
    prev.textContent='📎 '+file.name+' ('+Math.round(file.size/1024)+' Ko)';
  }
  if(ti&&!ti.value)ti.value=file.name.replace(/\.[^.]+$/,'');
}

function fpAddDoc(pid){
  var ti=document.getElementById('dc-ti-'+pid);
  var ty=(document.getElementById('dc-ty-'+pid)||{value:'Autre'}).value||'Autre';
  var ul=(document.getElementById('dc-ul-'+pid)||{value:''}).value.trim()||'';
  var fi=document.getElementById('dc-file-'+pid);
  var file=fi&&fi.files&&fi.files[0]?fi.files[0]:null;
  // Titre automatique depuis le fichier si vide
  if(file&&ti&&!ti.value.trim()) ti.value=file.name.replace(/\.[^.]+$/,'');
  var titre=ti?ti.value.trim():'';
  if(!titre&&!file&&!ul){toast('Ajouter un fichier ou un lien');return;}
  if(!titre)titre=file?file.name:(ul.split('/').pop()||'Document');
  if(file){
    var btn=document.querySelector('[onclick="fpAddDoc('+pid+')"]');
    if(btn){btn.disabled=true;btn.textContent='⏳ Upload…';}
    var form=new FormData();
    form.append('file',file,file.name);
    form.append('titre',titre);
    form.append('type',ty);
    var xhr=new XMLHttpRequest();
    xhr.open('POST','/api/projet/'+pid+'/upload-doc');
    xhr.withCredentials=true;
    xhr.onload=function(){
      var r=JSON.parse(xhr.responseText||'{}');
      if(r.ok){
        var bibCb=document.getElementById('dc-bib-'+pid);
        if(bibCb&&bibCb.checked) fpAddToBiblio(titre,ty,r.url||'',pid);
        var activeTab=document.querySelector('.fpt.on');
        var tab=activeTab?activeTab.getAttribute('data-tab'):'docs';
        if(tab==='journal') fpReload('journal'); else fpReload('docs');
        toast('📎 Document enregistré ✓');
      } else {toast('Erreur upload : '+(r.error||'?'),3000);}
    };
    xhr.onerror=function(){toast('Erreur réseau',3000);};
    xhr.send(form);
  } else if(ul){
    apiPost('/api/projet/'+pid+'/docs',{titre:titre,type:ty,url:ul}).then(function(r){
      if(r&&r.ok){
        var bibCb=document.getElementById('dc-bib-'+pid);
        if(bibCb&&bibCb.checked) fpAddToBiblio(titre,ty,ul,pid);
        var activeTab=document.querySelector('.fpt.on');
        var tab=activeTab?activeTab.getAttribute('data-tab'):'docs';
        if(tab==='journal') fpReload('journal'); else fpReload('docs');
        toast('🔗 Lien enregistré ✓');
      }
    });
  } else {
    toast('Joindre un fichier ou saisir un lien');
  }
}

function fpDelDoc(id,pid){
  if(!confirm('Supprimer ce document ?'))return;
  apiDel('/api/projdoc/'+id).then(function(){fpReload('docs');});
}

function fpAddToBiblio(titre,type,url,pid){
  var proj=P.find(function(p){return p.id===pid;})||{};
  var desc='Projet : '+(proj.titre||'');
  apiPost('/api/biblio',{titre:titre,type:type||'Autre',url:url,description:desc,auteur:ME.nom||'',visibilite:'prive'}).then(function(r){
    if(r&&r.ok){if(window.BIBLIO)BIBLIO.unshift(r.item);toast('📚 Ajouté à la bibliothèque ✓');}
  });
}

function fpRenderPresse(pid,items){
  var pb=document.getElementById('fp-body'); if(!pb)return;
  var html='<div style="background:#fff;border-radius:var(--R);border:1px solid var(--w2);padding:1rem;margin-bottom:1rem;box-shadow:var(--s1)">'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
    +'<input id="pr-ti" class="fi" placeholder="Titre *" style="font-size:.79rem;padding:6px 9px">'
    +'<input id="pr-me" class="fi" placeholder="Média" style="font-size:.79rem;padding:6px 9px">'
    +'<input id="pr-ul" class="fi" placeholder="URL" style="font-size:.79rem;padding:6px 9px">'
    +'<input id="pr-dt" class="fi" type="date" style="font-size:.79rem;padding:6px 9px">'
    +'</div><div style="display:flex;justify-content:flex-end;margin-top:8px">'
    +'<button onclick="fpAddPresse('+pid+')" class="btn btn-p btn-sm">+ Ajouter</button></div></div>';
  items.forEach(function(a){html+='<div style="background:#fff;border-radius:var(--R);border:1px solid var(--w2);padding:.85rem 1rem;margin-bottom:.5rem;display:flex;align-items:center;gap:10px;box-shadow:var(--s1)"><span style="font-size:1.2rem;flex-shrink:0">📰</span><div style="flex:1"><div style="font-size:.82rem;font-weight:700">'+a.titre+'</div><div style="font-size:.7rem;color:var(--i3)">'+(a.media||'')+(a.date_pub?' · '+a.date_pub:'')+'</div>'+(a.url?'<a href="'+a.url+'" target="_blank" style="font-size:.7rem;color:var(--g3)">🔗 Lire</a>':'')+'</div><button onclick="fpDelPresse('+a.id+','+pid+')" style="background:#fee2e2;border:1px solid #fca5a5;border-radius:6px;width:24px;height:24px;cursor:pointer">×</button></div>';});
  if(!items.length)html+='<div class="empty"><div class="empty-ico">📰</div><div class="empty-s">Aucun article.</div></div>';
  pb.innerHTML=html;
}
function fpAddPresse(pid){var ti=document.getElementById('pr-ti');if(!ti||!ti.value.trim()){toast('Titre obligatoire');return;}apiPost('/api/projet/'+pid+'/presse',{titre:ti.value.trim(),media:(document.getElementById('pr-me')||{}).value||'',url:(document.getElementById('pr-ul')||{}).value||'',date:(document.getElementById('pr-dt')||{}).value||''}).then(function(r){if(r&&r.ok)fpReload('presse');});}
function fpDelPresse(id,pid){apiDel('/api/presse/'+id).then(function(){fpReload('presse');});}

function svFicheProj(pid){fpSvProj(pid);}
function dlFicheProj(pid){fpDlProj(pid);}
function svProj(){fpSvProj(_ePid);}
function dlProj(){fpDlProj(_ePid);}


// ── RESTRICTION MENUS SELON ROLE ─────────────────────────────────────────────
function applyRoles(){
  var isPriv=ME.role==='Admin'||ME.role==='Maire'||ME.role==='Tete de Liste'||(ME.role&&ME.role.toLowerCase().indexOf('adjoint')>=0)||ME.username==='admin';
  qsa(".sbi").forEach(function(el){
    var oc=el.getAttribute("onclick")||'';
    if(oc.indexOf("'creer'")>=0)el.style.display=isPriv?'':'none';
  });
  if(ME.username==='admin'||ME.role==='Admin'){
    if(!$("adm-badge")){
      var b=document.createElement("div");b.id="adm-badge";b.textContent="Admin";
      b.style.cssText="background:#b91c1c;color:#fff;font-size:.6rem;font-weight:700;padding:2px 7px;border-radius:5px;letter-spacing:.05em;margin-right:6px;";
      var tc=document.querySelector(".tbtn-c");if(tc)tc.before(b);
    }
  }
}


function auditToggle(id){
  var el=document.getElementById(id);
  var ico=document.getElementById(id+'-ico');
  if(!el)return;
  var open=el.style.display==='none';
  el.style.display=open?'block':'none';
  if(ico)ico.textContent=open?'▼':'▶';
}

function renderAudit(){
  var body=$('audit-body'); if(!body)return;
  var total=P.length;
  if(!total){body.innerHTML='<div class="empty"><div class="empty-ico">📊</div><div class="empty-t">Aucun projet chargé</div></div>';return;}
  var counts={};SLIST.forEach(function(s){counts[s]=0;});counts['ND']=0;
  P.forEach(function(p){var s=ST[p.id]||p.statut||'ND';counts[s]=(counts[s]||0)+1;});
  var stC={Prioritaire:'#dc2626',Programmé:'#2563eb',Planifié:'#7c3aed','En cours':'#d97706',Réalisé:'#16a34a',Étude:'#0891b2',ND:'#9ca3af'};
  var realises=counts['Réalisé']||0,pct=total?Math.round(realises/total*100):0;
  var h='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:1rem">';
  h+='<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:.85rem;text-align:center"><div style="font-size:2rem;font-weight:800;color:#16a34a">'+realises+'</div><div style="font-size:.82rem;color:#166534;font-weight:600">Réalisés</div></div>';
  h+='<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:.85rem;text-align:center"><div style="font-size:2rem;font-weight:800;color:#d97706">'+(counts['En cours']||0)+'</div><div style="font-size:.82rem;color:#92400e;font-weight:600">En cours</div></div>';
  h+='<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:.85rem;text-align:center"><div style="font-size:2rem;font-weight:800;color:#2563eb">'+(counts['Programmé']||0)+'</div><div style="font-size:.82rem;color:#1e40af;font-weight:600">Programmés</div></div>';
  h+='<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:.85rem;text-align:center"><div style="font-size:2rem;font-weight:800;color:#dc2626">'+(counts['Prioritaire']||0)+'</div><div style="font-size:.82rem;color:#991b1b;font-weight:600">Prioritaires</div></div></div>';
  h+='<div style="background:var(--g8);border-radius:12px;padding:1rem 1.25rem;margin-bottom:1rem">';
  h+='<div style="display:flex;justify-content:space-between;font-size:.88rem;font-weight:700;margin-bottom:.5rem"><span>Avancement global — mandat 2026-2032</span><span style="color:var(--g3)">'+pct+'% réalisés</span></div>';
  h+='<div style="background:var(--w2);border-radius:8px;height:12px;overflow:hidden;display:flex">';
  SLIST.forEach(function(s){var n=counts[s]||0,w=total?Math.round(n/total*100):0;if(w>0)h+='<div title="'+s+' : '+n+'" style="width:'+w+'%;background:'+(stC[s]||'#ccc')+';height:100%"></div>';});
  h+='</div><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:.5rem">';
  SLIST.forEach(function(s){var n=counts[s]||0;if(n>0)h+='<span style="font-size:.75rem;display:flex;align-items:center;gap:3px"><span style="width:8px;height:8px;border-radius:2px;background:'+(stC[s]||'#ccc')+';display:inline-block"></span>'+s+' ('+n+')</span>';});
  h+='</div></div>';
  h+='<div style="margin-bottom:1rem"><div style="font-size:.78rem;font-weight:800;color:var(--ink);margin-bottom:.6rem">Par commission</div><div style="display:flex;flex-direction:column;gap:5px">';
  Object.keys(COMM).forEach(function(comm,ci){
    var themes=COMM[comm],col=COLORS[comm]||'var(--g3)',icon=ICONS[comm]||'📋';
    var pp=P.filter(function(p){return themes.indexOf(p.theme)>=0;});
    var tot=pp.length,ok=pp.filter(function(p){return(ST[p.id]||p.statut||'')==='Réalisé';}).length;
    var pr=pp.filter(function(p){return(ST[p.id]||p.statut||'')==='Prioritaire';}).length;
    var pctC=tot?Math.round(ok/tot*100):0,cid='auc'+ci;
    h+='<div style="border:1px solid '+col+'30;border-radius:10px;overflow:hidden">';
    h+='<div onclick="auditToggle(&quot;'+cid+'&quot;)" style="display:flex;align-items:center;gap:8px;padding:.65rem .85rem;background:'+col+'10;cursor:pointer">';
    h+=icon+' <span style="flex:1;font-size:.84rem;font-weight:700">'+comm+'</span>';
    if(pr>0)h+='<span style="font-size:.72rem;background:#fef2f2;color:#dc2626;border-radius:5px;padding:1px 6px;font-weight:700">⚠ '+pr+'</span>';
    h+='<div style="width:70px;background:var(--w2);border-radius:4px;height:6px;overflow:hidden;margin:0 6px"><div style="width:'+pctC+'%;background:'+col+';height:100%"></div></div>';
    h+='<span style="font-size:.7rem;font-weight:700;color:'+col+'">'+pctC+'%</span>';
    h+='<span id="'+cid+'-ico" style="font-size:.75rem;margin-left:4px;color:var(--i3)">▶</span></div>';
    h+='<div id="'+cid+'" style="display:none;padding:.5rem .75rem">';
    themes.forEach(function(theme){
      var tp=pp.filter(function(p){return p.theme===theme;});if(!tp.length)return;
      h+='<div style="font-size:.78rem;font-weight:800;color:'+col+';text-transform:uppercase;padding:.25rem 0 .15rem">'+theme+'</div>';
      tp.forEach(function(p){
        var s=ST[p.id]||p.statut||'ND';
        h+='<div onclick="oProjAudit('+p.id+')" style="display:flex;align-items:center;gap:8px;padding:.28rem .35rem;border-radius:5px;cursor:pointer">';
        h+='<span style="font-size:.82rem;flex:1">'+p.titre+'</span><span class="b '+bc(s)+'" style="font-size:.6rem">'+s+'</span></div>';
      });
    });
    h+='</div></div>';
  });
  h+='</div>';
  body.innerHTML=h;
}

function renderConnexions(){
  var body=$('connexions-body');if(!body)return;
  body.innerHTML='<div style="font-size:.85rem;color:var(--i3)">Chargement…</div>';
  apiGet('/api/access-logs').then(function(d){
    if(!d||!d.ok){body.innerHTML='<div style="font-size:.78rem;color:var(--i3)">Non disponible</div>';return;}
    var s=d.stats;
    var lh='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:1rem">';
    lh+='<div style="padding:.85rem;border-radius:12px;background:var(--g8);text-align:center"><div style="font-size:1.8rem;font-weight:800">'+s.total+'</div><div style="font-size:.82rem;color:var(--i3);font-weight:600">Total</div></div>';
    lh+='<div style="padding:.85rem;border-radius:12px;background:#f0fdf4;border:1px solid #bbf7d0;text-align:center"><div style="font-size:1.8rem;font-weight:800;color:#16a34a">'+s.success+'</div><div style="font-size:.82rem;color:#166534;font-weight:600">Réussies</div></div>';
    lh+='<div style="padding:.85rem;border-radius:12px;background:#fef2f2;border:1px solid #fecaca;text-align:center"><div style="font-size:1.8rem;font-weight:800;color:#dc2626">'+s.failed+'</div><div style="font-size:.82rem;color:#991b1b;font-weight:600">Échouées</div></div>';
    lh+='<div style="padding:.85rem;border-radius:12px;background:#eff6ff;border:1px solid #bfdbfe;text-align:center"><div style="font-size:1.8rem;font-weight:800;color:#2563eb">'+s.last7+'</div><div style="font-size:.82rem;color:#1e40af;font-weight:600">7 derniers jours</div></div></div>';
    lh+='<div style="display:flex;flex-direction:column;gap:3px">';
    d.logs.forEach(function(l){
      lh+='<div style="display:flex;align-items:center;gap:8px;padding:.5rem .75rem;background:var(--g8);border-radius:8px;font-size:.82rem">';
      lh+='<span style="width:8px;height:8px;border-radius:50%;background:'+(l.success?'#16a34a':'#dc2626')+';flex-shrink:0"></span>';
      lh+='<span style="color:var(--i4);font-size:.78rem;white-space:nowrap">'+l.created_at+'</span>';
      lh+='<span style="font-weight:600">'+l.nom+'</span>';
      lh+='<span style="color:var(--i4)">'+l.username+'</span>';
      lh+='<span style="color:var(--i4);font-size:.75rem;margin-left:auto">'+l.ip+'</span></div>';
    });
    lh+='</div>';
    body.innerHTML=lh;
  });
}

// ── GUIDE D'UTILISATION — CARTES ────────────────────────────────────────────
var TUTO_CARDS=[
  {ico:"🏠",bg:"#e0f5ea",color:"#1a3a2a",titre:"Accueil",resume:"Votre tableau de bord quotidien",detail:"<b>La page d'accueil</b> affiche un résumé de votre activité :<br><br>• <b>Agenda</b> — les prochaines réunions de la semaine avec un mini-calendrier<br>• <b>Mes tâches</b> — votre to-do list personnelle<br>• <b>Signalements</b> — les incidents remontés du terrain<br>• <b>Annonces</b> — les communications internes<br>• <b>Tchat</b> — les derniers messages de l'équipe<br>• <b>Comptes rendus</b> — les derniers CR publiés<br><br>Les 3 tuiles colorées donnent un accès rapide à la <b>Bibliothèque</b>, votre <b>Dossier personnel</b> et la <b>Visioconférence kMeet</b>."},
  {ico:"📅",bg:"#dbeafe",color:"#1e40af",titre:"Agenda",resume:"Réunions, bureaux, conseils",detail:"<b>L'agenda</b> centralise toutes les réunions :<br><br>1. Cliquez <b>+ Ajouter</b> pour créer une réunion<br>2. Renseignez le <b>titre</b>, la <b>date</b>, l'<b>heure</b>, le <b>lieu</b><br>3. Choisissez le <b>type</b> : conseil, bureau, commission, autre<br>4. Ajoutez des <b>notes</b> si nécessaire<br><br>Les réunions de type <b>conseil</b> apparaissent aussi sur la page publique du site.<br><br>Pour modifier une réunion, cliquez directement dessus dans la liste."},
  {ico:"📝",bg:"#fef3c7",color:"#92400e",titre:"Comptes rendus",resume:"Rédiger et archiver les CR",detail:"<b>Les comptes rendus</b> permettent de garder une trace de chaque réunion :<br><br>1. Cliquez <b>+ Nouveau CR</b><br>2. Renseignez : <b>titre</b>, <b>commission</b>, <b>date</b>, <b>rédigé par</b><br>3. Listez les <b>participants</b> et l'<b>ordre du jour</b><br>4. Rédigez le <b>contenu</b> du compte rendu<br>5. Notez les <b>prochaines étapes</b><br>6. Joignez un <b>fichier</b> ou un <b>lien</b> si besoin<br><br>Tous les élus peuvent consulter les CR publiés."},
  {ico:"📚",bg:"#ede9fe",color:"#6d28d9",titre:"Bibliothèque",resume:"Documents officiels classés",detail:"<b>La bibliothèque</b> centralise tous les documents du mandat :<br><br>• Organisez par <b>dossiers thématiques</b> (Conseil municipal, Budget, Urbanisme…)<br>• Filtrez par <b>type</b> (Délibération, PV, Rapport, Courrier…)<br>• <b>Ajoutez un document</b> : titre, type, fichier ou lien, description<br>• <b>Déplacez</b> un document d'un dossier à l'autre en un clic<br>• <b>Changez le type</b> directement dans la liste<br>• Les documents <b>privés</b> ne sont visibles que par leur auteur<br><br>Formats acceptés : PDF, Word, Excel, images, vidéos."},
  {ico:"🔒",bg:"#fef3c7",color:"#92400e",titre:"Répertoire élus",resume:"Votre espace privé",detail:"<b>Le répertoire élus</b> est votre carnet d'adresses personnel :<br><br>• Ajoutez vos <b>contacts</b> liés au mandat (nom, URL, notes)<br>• Ces contacts sont <b>privés</b> — visibles uniquement par vous<br>• L'administrateur peut voir tous les répertoires<br><br>C'est aussi ici que vous pouvez <b>changer votre mot de passe</b> :<br>Ouvrez votre fiche → cliquez <b>Changer le mot de passe</b>."},
  {ico:"👥",bg:"#e0f5ea",color:"#1a3a2a",titre:"L'équipe",resume:"Les 27 élus du mandat",detail:"<b>L'équipe</b> affiche la liste complète des 27 conseillers municipaux :<br><br>• Photo, nom, rôle (Maire, Adjoint, Conseiller délégué…)<br>• Email et téléphone<br>• Commission de rattachement<br><br>L'administrateur peut <b>modifier les fiches</b> (photo, rôle, contacts)."},
  {ico:"📊",bg:"#dbeafe",color:"#1e40af",titre:"Par commission",resume:"Projets groupés par thème",detail:"<b>Vue par commission</b> — les 91 projets du programme regroupés par thème :<br><br>• 12 commissions : Mobilités, Culture, Transition écologique…<br>• Chaque projet affiche son <b>statut</b> (Programmé, En cours, Réalisé…)<br>• Cliquez sur un projet pour ouvrir sa <b>fiche détaillée</b><br>• La barre de progression montre l'avancement par commission<br><br>Un compteur en haut indique le nombre de projets par statut."},
  {ico:"📋",bg:"#f0fdf4",color:"#166534",titre:"Tous les projets",resume:"Liste complète avec filtres",detail:"<b>Tous les projets</b> — vue en liste avec filtres et recherche :<br><br>• <b>Recherche</b> par titre ou mot-clé<br>• <b>Filtres</b> par statut, commission, année, importance<br>• Changez le <b>statut</b> directement dans la liste<br>• Cliquez pour ouvrir la <b>fiche projet</b> complète avec 5 onglets :<br><br>&nbsp;&nbsp;📋 <b>Infos</b> — statut, avancement, description<br>&nbsp;&nbsp;📒 <b>Journal</b> — main courante, observations, documents joints<br>&nbsp;&nbsp;👥 <b>Contacts</b> — interlocuteurs et partenaires<br>&nbsp;&nbsp;📄 <b>Documents</b> — pièces liées au projet<br>&nbsp;&nbsp;📰 <b>Presse</b> — articles et références médias"},
  {ico:"🔴",bg:"#fee2e2",color:"#991b1b",titre:"Signalements",resume:"Incidents terrain à suivre",detail:"<b>Les signalements</b> permettent de remonter des problèmes du terrain :<br><br>1. Cliquez <b>+ Nouveau</b><br>2. Renseignez : <b>titre</b>, <b>type</b> (voirie, propreté…), <b>urgence</b>, <b>lieu</b><br>3. Ajoutez une <b>description</b> et le <b>service concerné</b><br><br>Chaque signalement a un <b>historique de statut</b> :<br>Nouveau → En cours → Résolu / Fermé<br><br>L'administrateur peut mettre à jour le statut et ajouter un commentaire."},
  {ico:"🎪",bg:"#fce7f3",color:"#9d174d",titre:"Événements",resume:"Vie locale et agenda public",detail:"<b>Les événements</b> sont les manifestations de la vie locale :<br><br>• Créez un événement : <b>titre</b>, <b>date</b>, <b>heure</b>, <b>lieu</b>, <b>type</b><br>• Types : municipal, associatif, culturel, sportif, commémoration…<br>• Les événements <b>publics</b> apparaissent sur la page d'accueil du site<br>• Les événements <b>privés</b> sont visibles uniquement par les élus"},
  {ico:"💬",bg:"#e0f5ea",color:"#1a3a2a",titre:"Tchat",resume:"Messagerie interne par canal",detail:"<b>Le tchat</b> est la messagerie instantanée de l'équipe :<br><br>• <b>Canaux</b> : Général, Bureau, Culture, Mobilités, Écologie, Social, Enfance, Tranquillité, Travaux<br>• Tapez votre message et appuyez <b>Entrée</b> pour envoyer<br>• Bouton <b>📦</b> pour archiver les messages d'un canal<br>• Les messages archivés restent consultables<br><br>Le tchat est aussi accessible via le bouton <b>Tchat</b> dans la barre du haut."},
  {ico:"🔐",bg:"#f0fdf4",color:"#166534",titre:"Connexion",resume:"Identifiants et sécurité",detail:"<b>Votre connexion</b> :<br><br>• Identifiant : <b>prenom.nom</b> (ex : <code style='background:var(--g8);padding:2px 8px;border-radius:4px'>michel.thuillier</code>)<br>• Mot de passe : communiqué par l'administrateur<br>• La session dure <b>7 jours</b><br>• Déconnexion automatique après <b>30 min d'inactivité</b> (avertissement à 25 min)<br><br><b>Mot de passe oublié ?</b><br>Cliquez le lien sur la page de connexion. L'administrateur recevra un email et vous transmettra un lien de réinitialisation.<br><br><b>Changer son mot de passe :</b><br>Menu Répertoire élus → votre fiche → Changer le mot de passe."},
  {ico:"❓",bg:"#fef3c7",color:"#92400e",titre:"Besoin d'aide",resume:"Contacter l'administrateur",detail:"<b>En cas de problème</b>, contactez l'administrateur technique :<br><br>📧 <a href='mailto:thuilliermichel@mac.com' style='color:var(--g3);font-weight:600'>thuilliermichel@mac.com</a><br><br>Vous pouvez aussi utiliser le <b>tchat interne</b> (canal Général) pour poser vos questions aux autres élus."}
];
function renderTutoCards(){
  var c=document.getElementById('panel-body');
  if(c){var t=c.querySelector('#tuto-cards');if(t)c=t;else return;}
  else{c=$('tuto-cards');if(!c)return;}
  c.innerHTML=TUTO_CARDS.map(function(t,i){
    return '<div class="tuto-card" style="background:#fff;border-radius:16px;border:1px solid var(--w2);box-shadow:var(--s1);overflow:hidden">'
      +'<div onclick="toggleTuto(this)" style="padding:1.1rem 1.25rem;cursor:pointer;display:flex;align-items:center;gap:10px">'
      +'<div style="width:44px;height:44px;border-radius:12px;background:'+t.bg+';display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0">'+t.ico+'</div>'
      +'<div style="flex:1">'
      +'<div style="font-size:.88rem;font-weight:700;color:var(--ink);font-family:var(--fd)">'+t.titre+'</div>'
      +'<div style="font-size:.72rem;color:var(--i3)">'+t.resume+'</div>'
      +'</div>'
      +'<div class="tuto-arr" style="color:var(--i4);font-size:.9rem;transition:transform .2s">▶</div>'
      +'</div>'
      +'<div class="tuto-body" style="display:none;padding:0 1.25rem 1.1rem;border-top:1px solid var(--w2)">'
      +'<div style="padding-top:.85rem;font-size:.82rem;color:var(--i2);line-height:1.8">'+t.detail+'</div>'
      +'</div></div>';
  }).join('');
}
function toggleTuto(el){
  var card=el.parentNode;
  var body=card.querySelector('.tuto-body');
  var arr=card.querySelector('.tuto-arr');
  if(!body)return;
  if(body.style.display==='none'){
    body.style.display='block';
    if(arr)arr.style.transform='rotate(90deg)';
  } else {
    body.style.display='none';
    if(arr)arr.style.transform='none';
  }
}

// ── WIDGET CALENDRIER SIDEBAR ────────────────────────────────────────────────
(function(){
  var jours=['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
  var moisN=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  var saints={"1/1":"Jour de l'An","1/2":"Basile","1/3":"Geneviève","1/4":"Odilon","1/5":"Édouard","1/6":"Épiphanie","1/7":"Raymond","1/8":"Lucien","1/9":"Alix","1/10":"Guillaume","1/11":"Paulin","1/12":"Tatiana","1/13":"Yvette","1/14":"Nina","1/15":"Rémi","1/16":"Marcel","1/17":"Roseline","1/18":"Prisca","1/19":"Marius","1/20":"Sébastien","1/21":"Agnès","1/22":"Vincent","1/23":"Barnard","1/24":"François de Sales","1/25":"Conversion de Paul","1/26":"Paule","1/27":"Angèle","1/28":"Thomas d'Aquin","1/29":"Gildas","1/30":"Martine","1/31":"Marcelle","2/1":"Ella","2/2":"Chandeleur","2/3":"Blaise","2/4":"Véronique","2/5":"Agathe","2/6":"Gaston","2/7":"Eugénie","2/8":"Jacqueline","2/9":"Apolline","2/10":"Arnaud","2/11":"Notre-Dame de Lourdes","2/12":"Félix","2/13":"Béatrice","2/14":"Valentin","2/15":"Claude","2/16":"Julienne","2/17":"Alexis","2/18":"Bernadette","2/19":"Gabin","2/20":"Aimée","2/21":"Damien","2/22":"Isabelle","2/23":"Lazare","2/24":"Modeste","2/25":"Roméo","2/26":"Nestor","2/27":"Honorine","2/28":"Romain","2/29":"Auguste","3/1":"Aubin","3/2":"Charles le Bon","3/3":"Guénolé","3/4":"Casimir","3/5":"Olive","3/6":"Colette","3/7":"Félicité","3/8":"Jean de Dieu","3/9":"Françoise","3/10":"Vivien","3/11":"Rosine","3/12":"Justine","3/13":"Rodrigue","3/14":"Mathilde","3/15":"Louise","3/16":"Bénédicte","3/17":"Patrick","3/18":"Cyrille","3/19":"Joseph","3/20":"Printemps","3/21":"Clémence","3/22":"Léa","3/23":"Victorien","3/24":"Catherine de Suède","3/25":"Annonciation","3/26":"Larissa","3/27":"Habib","3/28":"Gontran","3/29":"Gwladys","3/30":"Amédée","3/31":"Benjamin","4/1":"Hugues","4/2":"Sandrine","4/3":"Richard","4/4":"Isidore","4/5":"Irène","4/6":"Marcellin","4/7":"Jean-Baptiste de la Salle","4/8":"Julie","4/9":"Gautier","4/10":"Fulbert","4/11":"Stanislas","4/12":"Jules","4/13":"Ida","4/14":"Maxime","4/15":"Paterne","4/16":"Benoît-Joseph","4/17":"Anicet","4/18":"Parfait","4/19":"Emma","4/20":"Odette","4/21":"Anselme","4/22":"Alexandre","4/23":"Georges","4/24":"Fidèle","4/25":"Marc","4/26":"Alida","4/27":"Zita","4/28":"Valérie","4/29":"Catherine de Sienne","4/30":"Robert","5/1":"Fête du Travail","5/2":"Boris","5/3":"Philippe - Jacques","5/4":"Sylvain","5/5":"Judith","5/6":"Prudence","5/7":"Gisèle","5/8":"Victoire 1945","5/9":"Pacôme","5/10":"Solange","5/11":"Estelle","5/12":"Achille","5/13":"Rolande","5/14":"Matthias","5/15":"Denise","5/16":"Honoré","5/17":"Pascal","5/18":"Éric","5/19":"Yves","5/20":"Bernardin","5/21":"Constantin","5/22":"Émile","5/23":"Didier","5/24":"Donatien","5/25":"Sophie","5/26":"Bérenger","5/27":"Augustin","5/28":"Germain","5/29":"Aymar","5/30":"Ferdinand","5/31":"Pétronille","6/1":"Justin","6/2":"Blandine","6/3":"Kévin","6/4":"Clotilde","6/5":"Igor","6/6":"Norbert","6/7":"Gilbert","6/8":"Médard","6/9":"Diane","6/10":"Landry","6/11":"Barnabé","6/12":"Guy","6/13":"Antoine de Padoue","6/14":"Élisée","6/15":"Germaine","6/16":"Jean-François Régis","6/17":"Hervé","6/18":"Léonce","6/19":"Romuald","6/20":"Silvère","6/21":"Été","6/22":"Alban","6/23":"Audrey","6/24":"Jean-Baptiste","6/25":"Prosper","6/26":"Anthelme","6/27":"Fernand","6/28":"Irénée","6/29":"Pierre - Paul","6/30":"Martial","7/1":"Thierry","7/2":"Martinien","7/3":"Thomas","7/4":"Florent","7/5":"Antoine","7/6":"Mariette","7/7":"Raoul","7/8":"Thibault","7/9":"Amandine","7/10":"Ulrich","7/11":"Benoît","7/12":"Olivier","7/13":"Henri et Joël","7/14":"Fête nationale","7/15":"Donald","7/16":"Carmen","7/17":"Charlotte","7/18":"Frédéric","7/19":"Arsène","7/20":"Marina","7/21":"Victor","7/22":"Marie-Madeleine","7/23":"Brigitte","7/24":"Christine","7/25":"Jacques","7/26":"Anne et Joachim","7/27":"Nathalie","7/28":"Samson","7/29":"Marthe","7/30":"Juliette","7/31":"Ignace de Loyola","8/1":"Alphonse","8/2":"Julien Eymard","8/3":"Lydie","8/4":"Jean-Marie Vianney","8/5":"Abel","8/6":"Transfiguration","8/7":"Gaétan","8/8":"Dominique","8/9":"Amour","8/10":"Laurent","8/11":"Claire","8/12":"Clarisse","8/13":"Hippolyte","8/14":"Evrard","8/15":"Assomption","8/16":"Armel","8/17":"Hyacinthe","8/18":"Hélène","8/19":"Jean Eudes","8/20":"Bernard","8/21":"Christophe","8/22":"Fabrice","8/23":"Rose de Lima","8/24":"Barthélémy","8/25":"Louis","8/26":"Natacha","8/27":"Monique","8/28":"Augustin","8/29":"Sabine","8/30":"Fiacre","8/31":"Aristide","9/1":"Gilles","9/2":"Ingrid","9/3":"Grégoire","9/4":"Rosalie","9/5":"Raïssa","9/6":"Bertrand","9/7":"Reine","9/8":"Nativité","9/9":"Alain","9/10":"Inès","9/11":"Adelphe","9/12":"Apollinaire","9/13":"Aimé","9/14":"La Sainte-Croix","9/15":"Roland","9/16":"Edith","9/17":"Renaud","9/18":"Nadège","9/19":"Émilie","9/20":"Davy","9/21":"Matthieu","9/22":"Maurice","9/23":"Automne","9/24":"Thècle","9/25":"Hermann","9/26":"Côme et Damien","9/27":"Vincent de Paul","9/28":"Venceslas","9/29":"Michel","9/30":"Jérôme","10/1":"Thérèse de l'Enfant Jésus","10/2":"Léger","10/3":"Gérard","10/4":"François d'Assise","10/5":"Fleur","10/6":"Bruno","10/7":"Serge","10/8":"Pélagie","10/9":"Denis","10/10":"Ghislain","10/11":"Firmin","10/12":"Wilfried","10/13":"Géraud","10/14":"Juste","10/15":"Thérèse d'Avila","10/16":"Edwige","10/17":"Baudouin","10/18":"Luc","10/19":"René","10/20":"Adeline","10/21":"Céline","10/22":"Élodie","10/23":"Jean de Capistran","10/24":"Florentin","10/25":"Crépin","10/26":"Dimitri","10/27":"Émeline","10/28":"Simon","10/29":"Narcisse","10/30":"Bienvenue","10/31":"Quentin","11/1":"Toussaint","11/2":"Défunts","11/3":"Hubert","11/4":"Charles","11/5":"Sylvie","11/6":"Bertille","11/7":"Carine","11/8":"Geoffroy","11/9":"Théodore","11/10":"Léon","11/11":"Armistice","11/12":"Christian","11/13":"Brice","11/14":"Sidoine","11/15":"Albert","11/16":"Marguerite","11/17":"Élisabeth","11/18":"Aude","11/19":"Tanguy","11/20":"Edmond","11/21":"Présentation","11/22":"Cécile","11/23":"Clément","11/24":"Flora","11/25":"Catherine","11/26":"Delphine","11/27":"Sévrin","11/28":"Jacques de la Marche","11/29":"Saturnin","11/30":"André","12/1":"Florence","12/2":"Viviane","12/3":"François-Xavier","12/4":"Barbara","12/5":"Gérald","12/6":"Nicolas","12/7":"Ambroise","12/8":"Immaculée Conception","12/9":"Pierre Fourier","12/10":"Romaric","12/11":"Daniel","12/12":"Chantal","12/13":"Lucie","12/14":"Odile","12/15":"Ninon","12/16":"Alice","12/17":"Gaël","12/18":"Gatien","12/19":"Urbain","12/20":"Théophile","12/21":"Hiver","12/22":"Françoise-Xavière","12/23":"Armand","12/24":"Adèle","12/25":"Noël","12/26":"Étienne","12/27":"Jean","12/28":"Innocents","12/29":"David","12/30":"Roger","12/31":"Sylvestre"};
  var d=new Date();
  var j=d.getDay(),n=d.getDate(),m=d.getMonth(),y=d.getFullYear();
  // Numéro de semaine ISO
  var tmp=new Date(d.valueOf());var dow=(d.getDay()+6)%7;tmp.setDate(tmp.getDate()-dow+3);var ref=tmp.valueOf();tmp.setMonth(0,1);if(tmp.getDay()!==4)tmp.setMonth(0,1+(4-tmp.getDay()+7)%7);var sem=1+Math.ceil((ref-tmp)/604800000);
  var cj=document.getElementById('sb-cal-jour');if(cj)cj.textContent=jours[j];
  var cn=document.getElementById('sb-cal-num');if(cn)cn.textContent=n<10?'0'+n:n;
  var cm2=document.getElementById('sb-cal-mois');if(cm2)cm2.textContent=moisN[m]+' '+y;
  var cf=document.getElementById('sb-cal-fete');var skey=(m+1)+'/'+n;if(cf)cf.textContent=saints[skey]||'';
  var cs=document.getElementById('sb-cal-sem');if(cs)cs.textContent='Semaine '+sem;
})();

init();

// ── DÉCONNEXION + AUTO-LOGOUT ─────────────────────────────────────────────────
var _idleT=null, _idleW=null, _idleC=null, _idleR=0;
var IDLE_MIN=9999, WARN_MIN=9990;

function vemLogout(){
  if(confirm('Déconnexion ?')) window.location.href='/logout';
}

function idleReset(){
  clearTimeout(_idleT); clearTimeout(_idleW); clearInterval(_idleC);
  var w=document.getElementById('idle-warn'); if(w)w.style.display='none';
  _idleW=setTimeout(idleWarn, WARN_MIN*60000);
  _idleT=setTimeout(function(){window.location.href='/logout';}, IDLE_MIN*60000);
}

function idleWarn(){
  var w=document.getElementById('idle-warn');
  if(!w){w=document.createElement('div');w.id='idle-warn';document.body.appendChild(w);}
  w.style.cssText='position:fixed;bottom:20px;right:20px;z-index:9999;background:#1a3a2a;color:#fff;border-radius:14px;padding:1.1rem 1.4rem;box-shadow:0 8px 32px rgba(0,0,0,.3);min-width:280px;font-family:var(--fd)';
  _idleR=(IDLE_MIN-WARN_MIN)*60;
  function tick(){
    var m=Math.floor(_idleR/60),s=_idleR%60;
    var mStr=m>0?m+'min ':'';
    w.style.display='block';
    w.innerHTML='<div style="font-size:.78rem;font-weight:700;margin-bottom:.5rem">⏱ Déconnexion dans</div>'
      +'<div style="font-size:1.4rem;font-weight:800;text-align:center;letter-spacing:.05em;margin-bottom:.75rem">'+mStr+s+'s</div>'
      +'<div style="display:flex;gap:8px">'
      +'<button onclick="idleReset()" style="flex:1;background:var(--g4);border:none;color:#fff;border-radius:8px;padding:.5rem;font-weight:700;cursor:pointer;font-size:.78rem">Je suis là ✓</button>'
      +'<button onclick="vemLogout()" style="flex:1;background:rgba(255,255,255,.15);border:none;color:#fff;border-radius:8px;padding:.5rem;font-weight:600;cursor:pointer;font-size:.78rem">Déconnecter</button>'
      +'</div>';
    if(--_idleR<0){clearInterval(_idleC); window.location.href='/logout';}
  }
  tick(); _idleC=setInterval(tick,1000);
}

// ── BROUILLONS AUTO-SAUVEGARDÉS ──────────────────────────────────────────────
function draftKey(ctx){ return 'vem_draft_'+ctx; }

function draftSave(ctx, val){
  try{ localStorage.setItem(draftKey(ctx), JSON.stringify({val:val,ts:Date.now()})); }catch(e){}
}

function draftLoad(ctx){
  try{
    var d=localStorage.getItem(draftKey(ctx));
    if(!d)return null;
    var o=JSON.parse(d);
    // Expirer après 7 jours
    if(Date.now()-o.ts>7*86400000){localStorage.removeItem(draftKey(ctx));return null;}
    return o.val;
  }catch(e){return null;}
}

function draftClear(ctx){ try{localStorage.removeItem(draftKey(ctx));}catch(e){} }

function draftAttach(el, ctx){
  if(!el)return;
  // Restaurer brouillon existant
  var saved=draftLoad(ctx);
  if(saved&&!el.value){
    el.value=saved;
    el.style.background='#fffbeb';
    el.title='Brouillon restauré — modifié le '+new Date(JSON.parse(localStorage.getItem(draftKey(ctx))||'{}').ts||0).toLocaleString('fr-FR');
  }
  // Sauvegarder à chaque frappe
  el.addEventListener('input',function(){ draftSave(ctx,el.value); el.style.background=''; });
}

function draftClearOnSubmit(ctx, el){
  draftClear(ctx);
  if(el)el.style.background='';
}

['mousedown','mousemove','keydown','touchstart','scroll','click'].forEach(function(e){
  document.addEventListener(e,idleReset,{passive:true});
});
idleReset();

</script>
</body>
</html>
`;
}
