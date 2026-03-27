module.exports = function(deps) {
  const {Evenements, Agenda, Elus, Projets} = deps;

  return function buildPublicPage(){
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
  };
};
