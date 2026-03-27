// ── config.js ─────────────────────────────────────────────────────────────────
// Configuration extraite de server.js
// NOTE : DIR = __dirname, ce fichier doit résider dans le même répertoire que server.js
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

const DIR = path.join(__dirname);

// ── CONFIG EMAIL (Gmail) ────────────────────────────────────────────────────
const GMAIL_USER = process.env.GMAIL_USER || 'mth144443@gmail.com';
const GMAIL_PASS = process.env.GMAIL_PASS || 'vhpd jinu qhvf meet';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'thuilliermichel@mac.com';
const mailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: GMAIL_USER, pass: GMAIL_PASS }
});

// ── COMPTES PAR DÉFAUT ──────────────────────────────────────────────────────

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

let ACCOUNTS = ACCOUNTS_DEFAULT;
try {
  if(process.env.ACCOUNTS_JSON) ACCOUNTS = JSON.parse(process.env.ACCOUNTS_JSON);
  else {
    const af = path.join(DIR,'accounts.json');
    if(fs.existsSync(af)) ACCOUNTS = JSON.parse(fs.readFileSync(af,'utf8'));
  }
} catch(e) { console.log('Comptes par défaut utilisés'); }

// ── ÉLUS PAR DÉFAUT ──────────────────────────────────────────────────────────
const ELUS_DEF = [{"id": 1, "nom": "Troton", "prenom": "Catherine", "role": "Tête de Liste", "delegation": "", "avatar": "CT", "color": "#1a3a2a", "photo": "https://vizilleenmouvement.fr/images/catherine-troton.jpg", "photoPos": "center 40%", "tel": "", "email": "catherine.troton@ville-vizille.fr", "commission": ""}, {"id": 2, "nom": "Ughetto-Monfrin", "prenom": "Bernard", "role": "Adjoint", "delegation": "", "avatar": "BU", "color": "#2d5a40", "photo": "https://vizilleenmouvement.fr/images/bernard-ughetto-monfrin.jpg", "photoPos": "center 30%", "tel": "", "email": "bernard.UGHETTO-MONFRIN@ville-vizille.fr", "commission": ""}, {"id": 3, "nom": "Berriche", "prenom": "Saïda", "role": "Adjointe", "delegation": "", "avatar": "SB", "color": "#3d7a5a", "photo": "https://vizilleenmouvement.fr/images/saida-berriche.jpg", "photoPos": "center 25%", "tel": "", "email": "saida.berriche@ville-vizille.fr", "commission": ""}, {"id": 4, "nom": "Faure", "prenom": "Gilles", "role": "Adjoint", "delegation": "", "avatar": "GF", "color": "#8B5CF6", "photo": "https://vizilleenmouvement.fr/images/gilles-faure.jpg", "photoPos": "center center", "tel": "", "email": "gilles.FAURE@ville-vizille.fr", "commission": ""}, {"id": 5, "nom": "Hermitte", "prenom": "Angélique", "role": "Conseillère déléguée", "delegation": "", "avatar": "AH", "color": "#F97316", "photo": "https://vizilleenmouvement.fr/images/angelique-hermitte.jpg", "photoPos": "center center", "tel": "", "email": "angelique.HERMITTE@ville-vizille.fr", "commission": ""}, {"id": 6, "nom": "Forestier", "prenom": "Gérard", "role": "Adjoint", "delegation": "", "avatar": "GF", "color": "#EC4899", "photo": "https://vizilleenmouvement.fr/images/gerard-forestier.jpg", "photoPos": "center 40%", "tel": "", "email": "gerard.FORESTIER@ville-vizille.fr", "commission": ""}, {"id": 7, "nom": "ARGOUD", "prenom": "Marie-Claude", "role": "Première Adjointe", "delegation": "", "avatar": "MA", "color": "#F59E0B", "photo": "https://vizilleenmouvement.fr/images/marie-claude-argoud.jpg", "photoPos": "center center", "tel": "", "email": "marie-claude.ARGOUD@ville-vizille.fr", "commission": ""}, {"id": 8, "nom": "Lamarca", "prenom": "Louis", "role": "Adjoint", "delegation": "", "avatar": "LL", "color": "#3B82F6", "photo": "https://vizilleenmouvement.fr/images/louis-lamarca.jpg", "photoPos": "center 40%", "tel": "", "email": "Louis.Lamarca@ville-vizille.fr", "commission": ""}, {"id": 9, "nom": "Pasquiou", "prenom": "Muriel", "role": "", "delegation": "", "avatar": "MP", "color": "#10B981", "photo": "https://vizilleenmouvement.fr/images/muriel-pasquiou.jpg", "photoPos": "center center", "tel": "", "email": "muriel.pasquiou@gmail.com", "commission": ""}, {"id": 10, "nom": "Pichon", "prenom": "Laurent", "role": "", "delegation": "", "avatar": "LP", "color": "#EF4444", "photo": "https://vizilleenmouvement.fr/images/laurent-pichon.jpg", "photoPos": "center center", "tel": "", "email": "pichon.laurent@wanadoo.fr", "commission": ""}, {"id": 11, "nom": "YAHIAOUI", "prenom": "Sakina", "role": "conseillère déléguée", "delegation": "", "avatar": "SY", "color": "#14B8A6", "photo": "https://vizilleenmouvement.fr/images/sakina-yahiaoui.jpg", "photoPos": "center 40%", "tel": "", "email": "sakina.YAHIAOUI@ville-vizille.fr", "commission": ""}, {"id": 12, "nom": "CHERIGUI", "prenom": "Mohamed", "role": "", "delegation": "", "avatar": "MC", "color": "#6366F1", "photo": "https://vizilleenmouvement.fr/images/mohamed-cherigui.jpg", "photoPos": "center 25%", "tel": "", "email": "mohamed.cherigui@sdis38.fr", "commission": ""}, {"id": 13, "nom": "REIJASSE", "prenom": "Christelle", "role": "", "delegation": "", "avatar": "CR", "color": "#db2777", "photo": "https://vizilleenmouvement.fr/images/christelle-reijasse.jpg", "photoPos": "center center", "tel": "", "email": "reijassechristelle28@gmail.com", "commission": ""}, {"id": 14, "nom": "MENDESS", "prenom": "Ahmed", "role": "Conseillé délégué", "delegation": "", "avatar": "AM", "color": "#0891b2", "photo": "https://vizilleenmouvement.fr/images/ahmed-mendess.jpg", "photoPos": "center center", "tel": "", "email": "ahmed.MENDESS@ville-vizille.fr", "commission": ""}, {"id": 15, "nom": "Sanchez", "prenom": "Christine", "role": "", "delegation": "", "avatar": "CS", "color": "#65a30d", "photo": "https://vizilleenmouvement.fr/images/christine-sanchez.jpg", "photoPos": "center center", "tel": "", "email": "sanchez7.christine@gmail.com", "commission": ""}, {"id": 16, "nom": "Pasquiou", "prenom": "Fabrice", "role": "Conseiller délégué", "delegation": "", "avatar": "FP", "color": "#7c3aed", "photo": "https://vizilleenmouvement.fr/images/fabrice-pasquiou.jpg", "photoPos": "center center", "tel": "", "email": "fabrice.PASQUIOU@ville-vizille.fr", "commission": ""}, {"id": 17, "nom": "El-Kebir", "prenom": "Meriem", "role": "", "delegation": "", "avatar": "ME", "color": "#9333ea", "photo": "https://vizilleenmouvement.fr/images/meriem-el-kebir.jpg", "photoPos": "center center", "tel": "", "email": "Meriem.El-Kebir@ville-vizille.fr", "commission": ""}, {"id": 18, "nom": "Garcia", "prenom": "Jean-Christophe", "role": "", "delegation": "", "avatar": "JG", "color": "#c2410c", "photo": "https://vizilleenmouvement.fr/images/jean-christophe-garcia.jpg", "photoPos": "center center", "tel": "", "email": "jeanchristophe.garcia38@gmail.com", "commission": ""}, {"id": 19, "nom": "PICCA", "prenom": "Muriel", "role": "", "delegation": "", "avatar": "MP", "color": "#b45309", "photo": "https://vizilleenmouvement.fr/images/muriel-picca.jpg", "photoPos": "center center", "tel": "", "email": "piccamumu@hotmail.fr", "commission": ""}, {"id": 20, "nom": "Thuillier", "prenom": "Michel", "role": "", "delegation": "", "avatar": "MT", "color": "#0f766e", "photo": "https://vizilleenmouvement.fr/images/michel-thuillier.jpg", "photoPos": "center center", "tel": "", "email": "thuilliermichel@mac.com", "commission": ""}, {"id": 21, "nom": "Nifenecker", "prenom": "Isabelle", "role": "", "delegation": "", "avatar": "IN", "color": "#1d4ed8", "photo": "https://vizilleenmouvement.fr/images/isabelle-nifenecker.jpg", "photoPos": "center 40%", "tel": "", "email": "isabelle_nifenecker@hotmail.fr", "commission": ""}, {"id": 22, "nom": "Venans", "prenom": "André-Paul", "role": "Conseiller", "delegation": "", "avatar": "AV", "color": "#be185d", "photo": "https://vizilleenmouvement.fr/images/andre-paul-venans.jpg", "photoPos": "center center", "tel": "", "email": "Andre-Paul.Venans@ville-vizille.fr", "commission": ""}, {"id": 23, "nom": "Jacolin", "prenom": "Nathalie", "role": "", "delegation": "", "avatar": "NJ", "color": "#15803d", "photo": "https://vizilleenmouvement.fr/images/nathalie-jacolin.jpg", "photoPos": "center 40%", "tel": "", "email": "jacolin.nathalie@hotmail.fr", "commission": ""}, {"id": 24, "nom": "Cosentino", "prenom": "Ignazio", "role": "", "delegation": "", "avatar": "IC", "color": "#b91c1c", "photo": "https://vizilleenmouvement.fr/images/ignazio-consentino.jpg", "photoPos": "center center", "tel": "", "email": "ignazio.cosentino@free.fr", "commission": ""}, {"id": 25, "nom": "Germain-Vey", "prenom": "Nathalie", "role": "conseillère déléguée", "delegation": "", "avatar": "NG", "color": "#6d28d9", "photo": "https://vizilleenmouvement.fr/images/nathalie-germain-vey.jpg", "photoPos": "center center", "tel": "", "email": "Nathalie.Germain-Vey@ville-vizille.fr", "commission": ""}, {"id": 26, "nom": "Lasserre", "prenom": "Stéphane", "role": "Conseiller", "delegation": "", "avatar": "SL", "color": "#0369a1", "photo": "https://vizilleenmouvement.fr/images/stephane-lasserre.jpg", "photoPos": "center center", "tel": "", "email": "stephane.LASSERRE@ville-vizille.fr", "commission": ""}];

// ── CONSTANTES COMMISSIONS / COULEURS / ICÔNES / RÉFÉRENTS ────────────────────
const COMM={"Culture, Patrimoine & Jumelages": ["Culture", "Patrimoine", "Jumelages"], "Mobilités": ["Mobilités"], "Transition écologique": ["Transition écologique"], "Action sociale": ["Action sociale"], "Concertation citoyenne": ["Concertation citoyenne"], "Animations de proximité": ["Animations de proximité"], "Économie": ["Économie"], "Métropole": ["Métropole"], "Enfance/Jeunesse": ["Enfance/Jeunesse"], "Tranquillité publique": ["Tranquillité publique"], "Travaux & Urbanisme": ["Travaux", "Urbanisme"], "Santé": ["Santé"]};
const COLORS={"Culture, Patrimoine & Jumelages": "#8B5CF6", "Mobilités": "#3B82F6", "Transition écologique": "#10B981", "Action sociale": "#F59E0B", "Concertation citoyenne": "#6366F1", "Animations de proximité": "#EC4899", "Économie": "#14B8A6", "Métropole": "#6B7280", "Enfance/Jeunesse": "#F97316", "Tranquillité publique": "#EF4444", "Travaux & Urbanisme": "#84CC16", "Santé": "#06B6D4"};
const ICONS={"Culture, Patrimoine & Jumelages": "🎭", "Mobilités": "🚲", "Transition écologique": "🌿", "Action sociale": "🤝", "Concertation citoyenne": "🗣", "Animations de proximité": "🎪", "Économie": "💼", "Métropole": "🏙", "Enfance/Jeunesse": "👦", "Tranquillité publique": "🛡", "Travaux & Urbanisme": "🏗", "Santé": "🏥"};
const REFS={"Culture, Patrimoine & Jumelages": "Marie-Claude", "Enfance/Jeunesse": "Angélique", "Animations de proximité": "Jean-Christophe"};
const ELUS0=[{"id": 1, "nom": "Troton", "prenom": "Catherine", "role": "Tête de Liste", "delegation": "", "avatar": "CT", "color": "#1a3a2a", "photo": "https://vizilleenmouvement.fr/images/catherine-troton.jpg", "photoPos": "center 40%", "tel": "", "email": "catherine.troton@ville-vizille.fr", "commission": ""}, {"id": 2, "nom": "Ughetto-Monfrin", "prenom": "Bernard", "role": "Adjoint", "delegation": "", "avatar": "BU", "color": "#2d5a40", "photo": "https://vizilleenmouvement.fr/images/bernard-ughetto-monfrin.jpg", "photoPos": "center 30%", "tel": "", "email": "bernard.UGHETTO-MONFRIN@ville-vizille.fr", "commission": ""}, {"id": 3, "nom": "Berriche", "prenom": "Saïda", "role": "Adjointe", "delegation": "", "avatar": "SB", "color": "#3d7a5a", "photo": "https://vizilleenmouvement.fr/images/saida-berriche.jpg", "photoPos": "center 25%", "tel": "", "email": "saida.berriche@ville-vizille.fr", "commission": ""}, {"id": 4, "nom": "Faure", "prenom": "Gilles", "role": "Adjoint", "delegation": "", "avatar": "GF", "color": "#8B5CF6", "photo": "https://vizilleenmouvement.fr/images/gilles-faure.jpg", "photoPos": "center center", "tel": "", "email": "gilles.FAURE@ville-vizille.fr", "commission": ""}, {"id": 5, "nom": "Hermitte", "prenom": "Angélique", "role": "Conseillère déléguée", "delegation": "", "avatar": "AH", "color": "#F97316", "photo": "https://vizilleenmouvement.fr/images/angelique-hermitte.jpg", "photoPos": "center center", "tel": "", "email": "angelique.HERMITTE@ville-vizille.fr", "commission": ""}, {"id": 6, "nom": "Forestier", "prenom": "Gérard", "role": "Adjoint", "delegation": "", "avatar": "GF", "color": "#EC4899", "photo": "https://vizilleenmouvement.fr/images/gerard-forestier.jpg", "photoPos": "center 40%", "tel": "", "email": "gerard.FORESTIER@ville-vizille.fr", "commission": ""}, {"id": 7, "nom": "ARGOUD", "prenom": "Marie-Claude", "role": "Première Adjointe", "delegation": "", "avatar": "MA", "color": "#F59E0B", "photo": "https://vizilleenmouvement.fr/images/marie-claude-argoud.jpg", "photoPos": "center center", "tel": "", "email": "marie-claude.ARGOUD@ville-vizille.fr", "commission": ""}, {"id": 8, "nom": "Lamarca", "prenom": "Louis", "role": "Adjoint", "delegation": "", "avatar": "LL", "color": "#3B82F6", "photo": "https://vizilleenmouvement.fr/images/louis-lamarca.jpg", "photoPos": "center 40%", "tel": "", "email": "Louis.Lamarca@ville-vizille.fr", "commission": ""}, {"id": 9, "nom": "Pasquiou", "prenom": "Muriel", "role": "", "delegation": "", "avatar": "MP", "color": "#10B981", "photo": "https://vizilleenmouvement.fr/images/muriel-pasquiou.jpg", "photoPos": "center center", "tel": "", "email": "muriel.pasquiou@gmail.com", "commission": ""}, {"id": 10, "nom": "Pichon", "prenom": "Laurent", "role": "", "delegation": "", "avatar": "LP", "color": "#EF4444", "photo": "https://vizilleenmouvement.fr/images/laurent-pichon.jpg", "photoPos": "center center", "tel": "", "email": "pichon.laurent@wanadoo.fr", "commission": ""}, {"id": 11, "nom": "YAHIAOUI", "prenom": "Sakina", "role": "conseillère déléguée", "delegation": "", "avatar": "SY", "color": "#14B8A6", "photo": "https://vizilleenmouvement.fr/images/sakina-yahiaoui.jpg", "photoPos": "center 40%", "tel": "", "email": "sakina.YAHIAOUI@ville-vizille.fr", "commission": ""}, {"id": 12, "nom": "CHERIGUI", "prenom": "Mohamed", "role": "", "delegation": "", "avatar": "MC", "color": "#6366F1", "photo": "https://vizilleenmouvement.fr/images/mohamed-cherigui.jpg", "photoPos": "center 25%", "tel": "", "email": "mohamed.cherigui@sdis38.fr", "commission": ""}, {"id": 13, "nom": "REIJASSE", "prenom": "Christelle", "role": "", "delegation": "", "avatar": "CR", "color": "#db2777", "photo": "https://vizilleenmouvement.fr/images/christelle-reijasse.jpg", "photoPos": "center center", "tel": "", "email": "reijassechristelle28@gmail.com", "commission": ""}, {"id": 14, "nom": "MENDESS", "prenom": "Ahmed", "role": "Conseillé délégué", "delegation": "", "avatar": "AM", "color": "#0891b2", "photo": "https://vizilleenmouvement.fr/images/ahmed-mendess.jpg", "photoPos": "center center", "tel": "", "email": "ahmed.MENDESS@ville-vizille.fr", "commission": ""}, {"id": 15, "nom": "Sanchez", "prenom": "Christine", "role": "", "delegation": "", "avatar": "CS", "color": "#65a30d", "photo": "https://vizilleenmouvement.fr/images/christine-sanchez.jpg", "photoPos": "center center", "tel": "", "email": "sanchez7.christine@gmail.com", "commission": ""}, {"id": 16, "nom": "Pasquiou", "prenom": "Fabrice", "role": "Conseiller délégué", "delegation": "", "avatar": "FP", "color": "#7c3aed", "photo": "https://vizilleenmouvement.fr/images/fabrice-pasquiou.jpg", "photoPos": "center center", "tel": "", "email": "fabrice.PASQUIOU@ville-vizille.fr", "commission": ""}, {"id": 17, "nom": "El-Kebir", "prenom": "Meriem", "role": "", "delegation": "", "avatar": "ME", "color": "#9333ea", "photo": "https://vizilleenmouvement.fr/images/meriem-el-kebir.jpg", "photoPos": "center center", "tel": "", "email": "Meriem.El-Kebir@ville-vizille.fr", "commission": ""}, {"id": 18, "nom": "Garcia", "prenom": "Jean-Christophe", "role": "", "delegation": "", "avatar": "JG", "color": "#c2410c", "photo": "https://vizilleenmouvement.fr/images/jean-christophe-garcia.jpg", "photoPos": "center center", "tel": "", "email": "jeanchristophe.garcia38@gmail.com", "commission": ""}, {"id": 19, "nom": "PICCA", "prenom": "Muriel", "role": "", "delegation": "", "avatar": "MP", "color": "#b45309", "photo": "https://vizilleenmouvement.fr/images/muriel-picca.jpg", "photoPos": "center center", "tel": "", "email": "piccamumu@hotmail.fr", "commission": ""}, {"id": 20, "nom": "Thuillier", "prenom": "Michel", "role": "", "delegation": "", "avatar": "MT", "color": "#0f766e", "photo": "https://vizilleenmouvement.fr/images/michel-thuillier.jpg", "photoPos": "center center", "tel": "", "email": "thuilliermichel@mac.com", "commission": ""}, {"id": 21, "nom": "Nifenecker", "prenom": "Isabelle", "role": "", "delegation": "", "avatar": "IN", "color": "#1d4ed8", "photo": "https://vizilleenmouvement.fr/images/isabelle-nifenecker.jpg", "photoPos": "center 40%", "tel": "", "email": "isabelle_nifenecker@hotmail.fr", "commission": ""}, {"id": 22, "nom": "Venans", "prenom": "André-Paul", "role": "Conseiller", "delegation": "", "avatar": "AV", "color": "#be185d", "photo": "https://vizilleenmouvement.fr/images/andre-paul-venans.jpg", "photoPos": "center center", "tel": "", "email": "Andre-Paul.Venans@ville-vizille.fr", "commission": ""}, {"id": 23, "nom": "Jacolin", "prenom": "Nathalie", "role": "", "delegation": "", "avatar": "NJ", "color": "#15803d", "photo": "https://vizilleenmouvement.fr/images/nathalie-jacolin.jpg", "photoPos": "center 40%", "tel": "", "email": "jacolin.nathalie@hotmail.fr", "commission": ""}, {"id": 24, "nom": "Cosentino", "prenom": "Ignazio", "role": "", "delegation": "", "avatar": "IC", "color": "#b91c1c", "photo": "https://vizilleenmouvement.fr/images/ignazio-consentino.jpg", "photoPos": "center center", "tel": "", "email": "ignazio.cosentino@free.fr", "commission": ""}, {"id": 25, "nom": "Germain-Vey", "prenom": "Nathalie", "role": "conseillère déléguée", "delegation": "", "avatar": "NG", "color": "#6d28d9", "photo": "https://vizilleenmouvement.fr/images/nathalie-germain-vey.jpg", "photoPos": "center center", "tel": "", "email": "Nathalie.Germain-Vey@ville-vizille.fr", "commission": ""}, {"id": 26, "nom": "Lasserre", "prenom": "Stéphane", "role": "Conseiller", "delegation": "", "avatar": "SL", "color": "#0369a1", "photo": "https://vizilleenmouvement.fr/images/stephane-lasserre.jpg", "photoPos": "center center", "tel": "", "email": "stephane.LASSERRE@ville-vizille.fr", "commission": ""}];
const GUIDES=[{"id": "1", "icon": "⚖️", "titre": "Droits et devoirs de l'élu", "contenu": "En tant que conseiller municipal, vous bénéficiez de droits concrets et êtes soumis à des obligations précises.\n\nVOS DROITS\n• Formation : 18h/an remboursées (organismes agréés : AMF Formation, CNFPT). La commune prend en charge les frais pédagogiques et de déplacement.\n• Indemnités : versées selon le rang (maire, adjoint, conseiller). Pour Vizille (~4 350 hab.), les indemnités sont fixées par délibération du conseil.\n• Protection fonctionnelle : la commune vous défend en cas de mise en cause dans l'exercice de vos fonctions.\n• Droit à l'information : vous pouvez consulter tous les documents préparatoires aux délibérations.\n• Droit d'expression : vous pouvez vous exprimer en séance, poser des questions orales, demander des explications de vote.\n• Crédit d'heures : si vous êtes salarié, vous disposez d'un crédit d'heures pour exercer votre mandat (art. L2123-1 CGCT).\n\nVOS DEVOIRS\n• Discrétion : les informations confidentielles obtenues dans l'exercice du mandat ne peuvent être divulguées.\n• Déport : si une délibération vous concerne personnellement (votre rue, votre association, votre employeur), vous devez quitter la salle avant le vote et le signaler.\n• Déclaration d'intérêts : obligatoire pour les adjoints et conseillers délégués (HATVP).\n• Assiduité : votre présence aux séances du conseil est attendue. Trois absences injustifiées consécutives peuvent entraîner une radiation.\n\n\nLIENS UTILES\n• Code Général des Collectivités Territoriales : https://www.legifrance.gouv.fr/codes/id/LEGITEXT000006070633\n• Guide de l'élu local (AMF) : https://www.amf.asso.fr/documents-guide-lelu-local/41190\n• Haute Autorité pour la Transparence : https://www.hatvp.fr\n• CNFPT — formations élus : https://www.cnfpt.fr\n\nEN CAS DE DOUTE : contactez le DGS ou l'AMF (amf.asso.fr, numéro vert gratuit)."}, {"id": "2", "icon": "🏛️", "titre": "Le conseil municipal — comment ça marche", "contenu": "Le conseil municipal est l'organe délibérant de la commune. Il vote le budget, prend les décisions importantes et contrôle l'exécutif.\n\nLES RÉUNIONS\n• Fréquence minimum : 4 fois par an, mais en pratique mensuelle à Vizille.\n• Convocation : envoyée au moins 5 jours avant la séance, avec l'ordre du jour et les documents annexes.\n• Publicité : les séances sont publiques (sauf huis clos voté). Les habitants peuvent assister.\n• Quorum : la moitié des membres en exercice doit être présente. Si le quorum n'est pas atteint, la séance est reportée à 3 jours minimum — sans condition de quorum cette fois.\n\nDÉROULEMENT TYPE D'UNE SÉANCE\n1. Appel nominal et vérification du quorum\n2. Désignation du secrétaire de séance\n3. Approbation du compte-rendu de la séance précédente\n4. Délibérations à l'ordre du jour\n5. Questions diverses / questions orales\n\nLES DÉLIBÉRATIONS\n• Vote à la majorité simple sauf dispositions particulières.\n• Vous pouvez demander un vote à bulletins secrets si la question porte sur des personnes.\n• Vous pouvez voter pour, contre, ou vous abstenir (l'abstention ne compte pas comme un vote).\n• Vous pouvez demander que votre explication de vote figure au procès-verbal.\n\nDROITS PRATIQUES EN SÉANCE\n• Droit d'amendement : vous pouvez proposer une modification d'une délibération.\n• Questions orales : à adresser au maire 48h avant la séance si possible.\n• Procuration : vous pouvez donner procuration à un autre conseiller (une seule procuration par personne).\n\nLIENS UTILES\n• Articles L2121-1 et suivants du CGCT : https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006070633/LEGISCTA000006164562\n• Fiche AMF — Le conseil municipal : https://www.amf.asso.fr/documents-le-conseil-municipal/41191\n• Modèles de délibérations : https://www.collectivites-locales.gouv.fr/finances-locales/deliberations"}, {"id": "3", "icon": "💰", "titre": "Le budget municipal — l'essentiel", "contenu": "Comprendre le budget vous permet de participer utilement aux débats et de porter vos projets efficacement.\n\nSTRUCTURE DU BUDGET DE VIZILLE\n• Budget principal : environ 8-9 M€ par an (fonctionnement + investissement).\n• Section de fonctionnement : dépenses courantes (personnel, charges, subventions). Ne peut pas être financée par emprunt.\n• Section d'investissement : travaux, équipements. Peut être financée par emprunt ou subventions.\n• Règle d'or : le budget doit être voté en équilibre réel.\n\nLE CALENDRIER BUDGÉTAIRE\n• Octobre/novembre : Débat d'Orientation Budgétaire (DOB) — obligatoire, non décisionnel mais structurant.\n• Décembre/janvier : vote du Budget Primitif (BP).\n• En cours d'année : Décisions Modificatives (DM) si nécessaire.\n• N+1 : Compte Administratif (exécution réelle) vs Budget Primitif (prévisionnel).\n\nLES SOURCES DE FINANCEMENT\n• Fiscalité locale (taxe foncière, CFE) : principale ressource.\n• Dotations de l'État (DGF) : en baisse tendancielle depuis 2014.\n• DETR (État) : pour les projets d'investissement ruraux.\n• GAM (Grenoble-Alpes Métropole) : contrats de territoire.\n• Département Isère et Région AURA : appels à projets.\n\nCE QUE VOUS POUVEZ FAIRE\n• Poser des questions en séance sur n'importe quelle ligne budgétaire.\n• Demander un rapport spécial sur une dépense.\n• Voter contre le budget : cela déclenche une procédure de réformation préfectorale.\n• Proposer des vœux budgétaires lors du DOB.\n\nLIENS UTILES\n• Guide des finances locales : https://www.collectivites-locales.gouv.fr/finances-locales\n• Comptes des communes (data.gouv) : https://www.data.gouv.fr/fr/datasets/comptes-individuels-des-communes\n• DETR — subventions État : https://www.isere.gouv.fr/Actions-de-l-Etat/Collectivites-et-finances-locales/DETR\n• Grenoble-Alpes Métropole : https://www.grenoblealpesmetropole.fr"}, {"id": "4", "icon": "🏢", "titre": "Qui fait quoi en mairie — organigramme pratique", "contenu": "Connaître les services vous permet d'agir efficacement sans court-circuiter les procédures.\n\nL'EXÉCUTIF POLITIQUE\n• Maire (Catherine Troton) : dirige l'administration, représente la commune, signe les arrêtés et marchés.\n• Adjoints : délégation de signature dans leur domaine. Agissent par délégation du maire.\n• Conseillers délégués : missions spécifiques sans délégation de signature générale.\n• Conseillers : rôle délibératif au conseil, participation aux commissions.\n\nL'ADMINISTRATION MUNICIPALE\n• DGS (Directeur Général des Services) : coordonne tous les services. Votre interlocuteur principal pour les questions transversales.\n• Secrétariat du maire : gère l'agenda, les courriers officiels, les convocations.\n• Service technique (voirie, bâtiments, espaces verts) : travaux et maintenance.\n• Service culturel : médiathèque, animations, patrimoine.\n• CCAS (Centre Communal d'Action Sociale) : action sociale, aides aux personnes.\n• Police Municipale : tranquillité publique, stationnement.\n• Service enfance/jeunesse : crèche, périscolaire, accueil jeunes.\n• Service urbanisme : permis de construire, PLU.\n• Service finances : budget, marchés publics, paie.\n\nLA RÈGLE D'OR\n→ Pour toute demande touchant les services (travaux, renseignements, intervention), passer TOUJOURS par le DGS ou le maire. Ne jamais donner d'instructions directes aux agents.\n→ En tant que conseiller, vous n'avez pas pouvoir hiérarchique sur les agents municipaux.\n\nLES COMMISSIONS\n12 commissions thématiques (voir sidebar). Chaque commission instruit les dossiers avant le conseil. Votre présence aux commissions dont vous êtes membre est essentielle.\n\nLIENS UTILES\n• Annuaire des services publics : https://lannuaire.service-public.fr\n• Ville de Vizille : https://www.ville-vizille.fr\n• Portail de la fonction publique territoriale : https://www.emploi-territorial.fr"}, {"id": "5", "icon": "🛡️", "titre": "Conflits d'intérêts — comment les gérer", "contenu": "Le conflit d'intérêts est une situation où votre intérêt personnel peut influencer l'exercice de vos fonctions. La loi est stricte, mais la procédure est simple.\n\nSITUATIONS TYPIQUES À VIZILLE\n• Une délibération concerne une rue où vous habitez (riverain direct).\n• Un marché est attribué à une entreprise qui vous emploie ou appartient à un proche.\n• Une subvention est accordée à une association dont vous êtes président ou membre actif.\n• Un permis de construire voisin de votre propriété est soumis au vote.\n\nLA PROCÉDURE DE DÉPORT (obligatoire)\n1. Signalez la situation au maire AVANT la séance (par écrit si possible).\n2. Lors de la séance, annoncez votre déport à voix haute.\n3. Quittez la salle pendant la délibération ET le vote.\n4. Le procès-verbal mentionnera votre absence sur ce point.\n\nATTENTION : rester assis dans la salle sans voter ne suffit pas — vous devez physiquement quitter la salle.\n\nDÉCLARATION D'INTÉRÊTS (pour adjoints et conseillers délégués)\n• Obligatoire dans les 2 mois suivant la prise de fonctions.\n• À déposer auprès du maire et de la HATVP (hatvp.fr).\n• Mise à jour en cas de changement de situation.\n\nEN CAS DE DOUTE\n• Conseil du DGS ou du maire.\n• Service juridique de l'AMF (gratuit pour les communes adhérentes).\n• En cas de mise en cause pénale : protection fonctionnelle de la commune.\n\nMieux vaut un déport de trop qu'une mise en cause pour prise illégale d'intérêts (délit pénal).\n\nLIENS UTILES\n• HATVP — déclarations en ligne : https://declarations.hatvp.fr\n• Guide déontologie de l'élu (AMF) : https://www.amf.asso.fr/documents-deontologie-de-lelu-local/41192\n• Article 432-12 du Code pénal (prise illégale d'intérêts) : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006418534"}, {"id": "6", "icon": "🎓", "titre": "Formation et montée en compétences", "contenu": "Vous avez le droit et le devoir de vous former. Les ressources sont nombreuses et souvent gratuites.\n\nVOS DROITS À LA FORMATION\n• 18 heures de formation par an, remboursées sur le budget communal.\n• Les frais pédagogiques, de déplacement et d'hébergement sont pris en charge.\n• Droit individuel à la formation (DIF élu) : 20h/an cumulables sur 6 ans = 120h max.\n• Si vous êtes salarié : droit à un congé formation de 18 jours/mandat.\n\nORGANISMES RECOMMANDÉS\n• AMF Formation (amf.asso.fr) : spécialiste des élus locaux. Programmes thématiques.\n• CNFPT (cnfpt.fr) : formations gratuites ou à tarif réduit pour les élus.\n• IEP Grenoble : formations locales sur les politiques publiques.\n• Université de Grenoble : certificats en droit public local.\n\nFORMATIONS PRIORITAIRES POUR VOTRE MANDAT\n→ Finances locales (comprendre le budget, les marchés publics)\n→ Urbanisme et droit des sols (PLU, permis de construire)\n→ Commande publique (marchés publics, DSP)\n→ Droit de la fonction publique territoriale\n→ Conduite de réunion et concertation citoyenne\n→ Transition écologique pour les collectivités\n\nPROCÉDURE PRATIQUE\n1. Choisissez votre formation sur amf.asso.fr ou cnfpt.fr.\n2. Présentez votre demande au maire avec programme + devis.\n3. Le conseil vote si le montant dépasse le plafond annuel.\n4. La commune paye directement l'organisme.\n\nRESSOURCES GRATUITES EN LIGNE\n• Légifrance (legifrance.gouv.fr) : tous les textes législatifs.\n• Collectivités-locales.gouv.fr : guides pratiques ministériels.\n• Maire-Info (maire-info.com) : actualité quotidienne des communes.\n\nLIENS UTILES\n• AMF Formation — catalogue : https://www.amf.asso.fr/page-formation-des-elus/41060\n• CNFPT — offre élus : https://www.cnfpt.fr/se-former/former-vos-elus\n• DIF élu — mode d'emploi : https://www.collectivites-locales.gouv.fr/competences/le-droit-individuel-a-la-formation-des-elus-locaux\n• IEP Grenoble : https://www.sciencespo-grenoble.fr"}, {"id": "7", "icon": "🗳️", "titre": "Vizille en chiffres — connaître sa commune", "contenu": "Pour intervenir utilement en conseil, voici les données clés de Vizille.\n\nLA COMMUNE\n• Population : environ 7 200 habitants (commune centre) — environ 4 350 dans le périmètre de gestion directe.\n• Superficie : 20,5 km² — commune de montagne, vallée du Drac.\n• Intercommunalité : Grenoble-Alpes Métropole (49 communes, 450 000 hab.).\n• Situation : 25 km au sud de Grenoble, RN85 (route Napoléon), D1091 (Oisans).\n\nLE CONSEIL MUNICIPAL\n• 27 conseillers au total (liste VeM élue le 15 mars 2026).\n• Mandat 2026-2032 (6 ans).\n• Maire : Catherine Troton.\n• 8 adjoints, 5 conseillers délégués, 14 conseillers.\n\nLE BUDGET (estimations 2026)\n• Budget de fonctionnement : ~5,5-6 M€.\n• Budget d'investissement : ~2,5-3 M€.\n• Dette en cours : à consulter au Compte Administratif.\n• Taux de fiscalité : taxe foncière bâtie, CFE (voir délibérations).\n\nLES SERVICES MUNICIPAUX\n• ~80 agents à temps plein équivalent.\n• Services : technique, culturel, enfance, social (CCAS), urbanisme, police municipale, finances.\n\nLES ENJEUX DU MANDAT (programme VeM)\n• Mobilités : désaturation RN85/D1091, alternatives, vélo.\n• Transition écologique : rénovation énergétique, biodiversité, alimentation locale.\n• Centralité vizilloise : réhabilitation centre-ville, OPAH-RU, Tanneries.\n• Enfance/jeunesse : crèche, périscolaire, loisirs.\n• Action sociale : maintien à domicile, CCAS, inclusion.\n• Tranquillité publique : police municipale, médiation.\n• Culture/patrimoine : château, médiathèque, jumelages.\n\nCONTACTS CLÉS\n• Mairie : 04 76 78 06 00 — Place du Château, 38220 Vizille.\n• DGS : votre interlocuteur pour toute question administrative.\n• Préfecture de l'Isère (Grenoble) : tutelle administrative.\n\nLIENS UTILES\n• Fiche INSEE Vizille : https://www.insee.fr/fr/statistiques/2011101?geo=COM-38553\n• Géoportail — carte Vizille : https://www.geoportail.gouv.fr\n• Grenoble-Alpes Métropole : https://www.grenoblealpesmetropole.fr\n• Préfecture de l'Isère : https://www.isere.gouv.fr"}, {"id": "8", "icon": "📋", "titre": "Les commissions — rôle et fonctionnement", "contenu": "Les commissions préparent le travail du conseil. C'est là que se fait le vrai travail de fond.\n\nLES 12 COMMISSIONS DE VIZILLE EN MOUVEMENT\n1. Culture, Patrimoine & Jumelages\n2. Mobilités\n3. Transition écologique\n4. Action sociale\n5. Concertation citoyenne\n6. Animations de proximité\n7. Économie\n8. Métropole\n9. Enfance/Jeunesse\n10. Tranquillité publique\n11. Travaux & Urbanisme\n12. Santé\n\nRÔLE DES COMMISSIONS\n• Elles examinent les dossiers AVANT le conseil.\n• Elles formulent des recommandations (avis consultatif — la décision reste au conseil).\n• Elles permettent d'approfondir les sujets et d'auditionner des experts.\n• Elles sont le lieu du travail collectif et du débat interne à la majorité.\n\nFONCTIONNEMENT PRATIQUE\n• Chaque commission a un président (souvent l'adjoint référent du domaine).\n• Les réunions ne sont pas publiques (sauf décision contraire).\n• Vous pouvez assister aux commissions dont vous n'êtes pas membre, sauf vote contraire.\n• Un compte rendu est établi et communiqué aux conseillers.\n\nVOTRE RÔLE EN COMMISSION\n• Préparez les dossiers en lisant les documents transmis à l'avance.\n• Posez vos questions pendant la commission, pas en séance plénière.\n• Si vous êtes référent d'un projet, assurez-vous du suivi entre deux séances.\n• Faites le lien avec les habitants et les associations de votre secteur.\n\nASTUCE : La commission \"Métropole\" suit les dossiers GAM qui impactent Vizille. Particulièrement important pour les mobilités, l'urbanisme et les financements.\n\nLIENS UTILES\n• Grenoble-Alpes Métropole — commissions : https://www.grenoblealpesmetropole.fr/10-fonctionnement.htm\n• Guide AMF — commissions municipales : https://www.amf.asso.fr/documents-les-commissions-municipales/41193"}];
const RESS=[{"titre": "AMF — Association des Maires", "url": "https://www.amf.asso.fr", "icon": "🏛", "desc": "Actualités, guides, formations"}, {"titre": "Légifrance", "url": "https://www.legifrance.gouv.fr", "icon": "⚖️", "desc": "Textes législatifs et réglementaires"}, {"titre": "Maire-Info", "url": "https://www.maire-info.com", "icon": "📰", "desc": "Actualité quotidienne des communes"}, {"titre": "Collectivités-locales.gouv", "url": "https://www.collectivites-locales.gouv.fr", "icon": "🏗", "desc": "Informations pour les élus"}, {"titre": "kMeet (Visio)", "url": "https://kmeet.infomaniak.com", "icon": "🎥", "desc": "Visioconférence sécurisée"}, {"titre": "Site Vizille en Mouvement", "url": "https://vizilleenmouvement.fr", "icon": "🌐", "desc": "Site public de la liste"}, {"titre": "WordPress Vizille", "url": "https://wp.vizilleenmouvement.fr", "icon": "🖥", "desc": "Site officiel de la commune"}];

// ── EXPORTS ──────────────────────────────────────────────────────────────────
module.exports = {
  ACCOUNTS,
  ACCOUNTS_DEFAULT,
  ELUS_DEF,
  COMM,
  COLORS,
  ICONS,
  REFS,
  ELUS0,
  GUIDES,
  RESS,
  mailTransporter,
  GMAIL_USER,
  GMAIL_PASS,
  ADMIN_EMAIL,
  DIR
};
