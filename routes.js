const bcrypt = require('bcryptjs');

module.exports = function(deps) {
  const {ACCOUNTS, db, Elus, Agenda, Projets, Statuts, CR, Biblio, Signalements, Evenements, Chat, Annonces, Tasks, Notifs, RepElus, dbStats, ts, nid, ProjetJalons, ProjetPartenaires, ProjetContacts, ProjetDocs, ProjetPresse, ProjetJournal, BiblioDoc, fs, path, DIR, https} = deps;

  // Helper functions
  function J(res,d,c){res.writeHead(c||200,{'Content-Type':'application/json;charset=utf-8','Access-Control-Allow-Origin':'*'});res.end(JSON.stringify(d));}
  function body(req,cb){let b='';req.on('data',d=>{b+=d;if(b.length>2e6)req.destroy();});req.on('end',()=>{try{cb(null,JSON.parse(b));}catch(e){cb(e);}});}
  function save(){} // no-op — SQLite gère tout

  let documents=[];

  return function handleRoutes(req, res, p, m, qs, ME) {

  if(p==='/api/all'){
    var _elus=Elus.getAll(),_proj=Projets.getAll(),_ag=Agenda.getAll(),_evts=Evenements.getAll();
    var _sign=Signalements.getAll().slice(0,15),_crs=CR.getAll().slice(0,10);
    var _ann=Annonces.getAll(),_tasks=Tasks.getAll(),_notifs=Notifs.getAll();
    J(res,{
      n_projets:_proj.length,statuts:Statuts.getAll(),agenda:_ag,documents:[],
      notifs:_notifs,elus:_elus,annonces:_ann,tasks:_tasks,
      signalements:_sign,evenements:_evts,comptes_rendus:_crs,stats:dbStats(),
      biblio_count:Biblio.getAll(ME.id,ME.id===0).length,
      chat:Chat.get('general',0).messages.slice(-50),
      me:{id:ME.id,nom:ME.nom,prenom:ME.prenom||'',role:ME.role,avatar:ME.avatar,color:ME.color,username:ME.username,delegation:'',photo:ME.photo||'',photoPos:ME.photoPos||'center center',email:ME.email||''}
    });
    return true;
  }

  // IDENTITÉ CONNECTÉE
  if(p==='/api/me'){J(res,{id:ME.id,nom:ME.nom,prenom:ME.prenom||'',role:ME.role,avatar:ME.avatar,color:ME.color,username:ME.username,delegation:ME.delegation||'',photo:ME.photo||'',photoPos:ME.photoPos||'center center',email:ME.email||''});return true;}

  // CHANGER SON MOT DE PASSE
  if(p==='/api/change_pwd'&&m==='POST'){body(req,function(err,d){
    if(err)return J(res,{ok:false},400);
    if(!d.newpwd||d.newpwd.length<5)return J(res,{ok:false,error:'Mot de passe trop court (5 car. min.)'});
    ACCOUNTS[ME.username].pwd=bcrypt.hashSync(d.newpwd, 10);
    // Sauvegarder dans accounts.json
    try{fs.writeFileSync(path.join(DIR,'accounts.json'),JSON.stringify(ACCOUNTS,null,2),'utf8');}catch(e){}
    return J(res,{ok:true});
  });return true;}

  // PROJETS
  if(p==='/api/projets'){J(res,Projets.getAll());return true;}

  // NOUVEAU PROJET
  if(p==='/api/projet'&&m==='POST'){body(req,function(err,d){
    if(err)return J(res,{ok:false},400);
    var projet=Projets.insert(d);
    Notifs.insert('Créé : '+projet.titre,'CRÉÉ','','projet');
    return J(res,{ok:true,projet:projet});
  });return true;}

  // MODIFIER UN PROJET
  if(p.match(/^\/api\/projet\/\d+$/)&&m==='PATCH'){body(req,function(err,d){
    if(err)return J(res,{ok:false},400);
    var pid=parseInt(p.split('/').pop());
    var projet=Projets.patch(pid,d);
    if(!projet)return J(res,{ok:false,error:'Projet non trouvé'},404);
    return J(res,{ok:true,projet:projet});
  });return true;}

  // AVANCEMENT PROJET
  if(p.match(/^\/api\/projet\/\d+\/avancement$/)&&m==='PATCH'){body(req,function(err,d){
    if(err)return J(res,{ok:false},400);
    var pid2=parseInt(p.split('/')[3]);
    try{db.prepare('UPDATE projets SET avancement=?,responsable_id=?,responsable_nom=? WHERE id=?').run(parseInt(d.avancement)||0,d.responsable_id||null,d.responsable_nom||'',pid2);}catch(e){}
    try{ProjetJournal.log(pid2,ME.id,ME.nom,'avancement','',(d.avancement||0)+'%');}catch(e){}
    return J(res,{ok:true});
  });return true;}
  if(p.match(/^\/api\/projet\/\d+\/fiche$/)&&m==='GET'){
    var pid2=parseInt(p.split('/')[3]);
    J(res,{jalons:ProjetJalons.get(pid2),partenaires:ProjetPartenaires.get(pid2),contacts:ProjetContacts.get(pid2),docs:ProjetDocs.get(pid2),presse:ProjetPresse.get(pid2),journal:ProjetJournal.get(pid2)});
    return true;
  }
  if(p.match(/^\/api\/projet\/\d+\/jalons$/)&&m==='POST'){body(req,function(err,d){if(err)return J(res,{ok:false},400);return J(res,{ok:true,item:ProjetJalons.insert(parseInt(p.split('/')[3]),d)});});return true;}
  if(p.match(/^\/api\/jalon\/\d+$/)&&m==='PATCH'){body(req,function(err,d){
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
  });return true;}
  if(p.match(/^\/api\/jalon\/\d+$/)&&m==='DELETE'){ProjetJalons.delete(parseInt(p.split('/').pop()));J(res,{ok:true});return true;}
  if(p.match(/^\/api\/projet\/\d+\/partenaires$/)&&m==='POST'){body(req,function(err,d){if(err)return J(res,{ok:false},400);return J(res,{ok:true,item:ProjetPartenaires.insert(parseInt(p.split('/')[3]),d)});});return true;}
  if(p.match(/^\/api\/partenaire\/\d+$/)&&m==='DELETE'){ProjetPartenaires.delete(parseInt(p.split('/').pop()));J(res,{ok:true});return true;}
  if(p.match(/^\/api\/projet\/\d+\/contacts$/)&&m==='POST'){body(req,function(err,d){if(err)return J(res,{ok:false},400);return J(res,{ok:true,item:ProjetContacts.insert(parseInt(p.split('/')[3]),d)});});return true;}
  if(p.match(/^\/api\/contact\/\d+$/)&&m==='DELETE'){ProjetContacts.delete(parseInt(p.split('/').pop()));J(res,{ok:true});return true;}
  if(p.match(/^\/api\/projet\/\d+\/docs$/)&&m==='POST'){body(req,function(err,d){if(err)return J(res,{ok:false},400);return J(res,{ok:true,item:ProjetDocs.insert(parseInt(p.split('/')[3]),d)});});return true;}
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
    return true;
  }
  if(p.match(/^\/api\/projdoc\/\d+$/)&&m==='DELETE'){ProjetDocs.delete(parseInt(p.split('/').pop()));J(res,{ok:true});return true;}
  if(p.match(/^\/api\/projet\/\d+\/presse$/)&&m==='POST'){body(req,function(err,d){if(err)return J(res,{ok:false},400);return J(res,{ok:true,item:ProjetPresse.insert(parseInt(p.split('/')[3]),d)});});return true;}
  if(p.match(/^\/api\/presse\/\d+$/)&&m==='DELETE'){ProjetPresse.delete(parseInt(p.split('/').pop()));J(res,{ok:true});return true;}
  // Note libre dans le journal
  if(p.match(/^\/api\/projet\/\d+\/notes$/)&&m==='POST'){body(req,function(err,d){
    if(err)return J(res,{ok:false},400);
    var pid4=parseInt(p.split('/')[3]);
    var texte=(d.texte||'').trim();
    var type4=d.type||'note';
    var objet4=(d.objet||'').trim();
    if(!texte&&!objet4)return J(res,{ok:false,error:'Vide'},400);
    // ancien_val = objet, nouveau_val = texte
    ProjetJournal.log(pid4,ME.id,ME.nom,type4,objet4,texte||objet4);
    return J(res,{ok:true});
  });return true;}
  if(p.match(/^\/api\/projnote\/\d+$/)&&m==='DELETE'){
    var nid4=parseInt(p.split('/').pop());
    try{db.prepare('DELETE FROM projet_journal WHERE id=?').run(nid4);}catch(e){}
    J(res,{ok:true});
    return true;
  }
  if(p.match(/^\/api\/projet\/\d+\/journal$/)&&m==='POST'){body(req,function(err,d){
    if(err)return J(res,{ok:false},400);
    var pid4=parseInt(p.split('/')[3]);
    try{ProjetJournal.log(pid4,ME.id,ME.nom,'note','',d.texte||'');}catch(e){return J(res,{ok:false,error:e.message},500);}
    return J(res,{ok:true});
  });return true;}
  if(p.match(/^\/api\/projet\/\d+$/)&&m==='DELETE'){
    Projets.delete(parseInt(p.split('/').pop()));
    J(res,{ok:true});
    return true;
  }

  // STATUT PROJET
  if(p==='/api/statut'&&m==='POST'){body(req,function(err,d){
    if(err)return J(res,{ok:false},400);
    var oldSt=Statuts.getAll()[d.id]||'ND';
    Statuts.set(d.id,d.statut);
    var n=Notifs.insert(d.titre,d.statut,oldSt,'statut');
    return J(res,{ok:true,notif:n});
  });return true;}

  // AGENDA
  if(p==='/api/agenda'&&m==='GET'){J(res,Agenda.getAll());return true;}
  if(p==='/api/agenda'&&m==='POST'){body(req,function(err,d){
    if(err)return J(res,{ok:false},400);
    var item=Agenda.insert(d);return J(res,{ok:true,item:item});
  });return true;}
  if(p.match(/^\/api\/agenda\/\d+$/)&&m==='PATCH'){body(req,function(err,d){
    if(err)return J(res,{ok:false},400);
    Agenda.patch(parseInt(p.split('/').pop()),d);return J(res,{ok:true});
  });return true;}
  if(p.match(/^\/api\/agenda\/\d+$/)&&m==='DELETE'){Agenda.delete(parseInt(p.split('/').pop()));J(res,{ok:true});return true;}

  // DOCUMENTS (liens simples)
  if(p==='/api/document'&&m==='POST'){body(req,function(err,d){
    if(err)return J(res,{ok:false},400);d.id=nid(documents);documents.push(d);save('documents.json',documents);return J(res,{ok:true,item:d});
  });return true;}
  if(p.match(/^\/api\/document\/\d+$/)&&m==='DELETE'){const id=parseInt(p.split('/').pop());documents=documents.filter(d=>d.id!==id);save('documents.json',documents);J(res,{ok:true});return true;}

  if(p==='/api/access-logs'&&m==='GET'){
    if(ME.id!==0)return J(res,{ok:false},403);
    const logs=db.prepare('SELECT * FROM access_logs ORDER BY id DESC LIMIT 30').all();
    const stats=db.prepare('SELECT success, COUNT(*) as n FROM access_logs GROUP BY success').all();
    const total=db.prepare('SELECT COUNT(*) as n FROM access_logs').get().n;
    const s={total,success:0,failed:0,last7:0};
    stats.forEach(function(r){if(r.success)s.success=r.n;else s.failed=r.n;});
    s.last7=db.prepare("SELECT COUNT(*) as n FROM access_logs WHERE created_at >= datetime('now','-7 days','localtime')").get().n;
    J(res,{ok:true,stats:s,logs});
    return true;
  }
  // BIBLIOTHÈQUE DOCUMENTAIRE
  if(p==='/api/biblio'&&m==='GET'){J(res,Biblio.getAll(ME.id,ME.id===0));return true;}
  if(p==='/api/biblio'&&m==='POST'){body(req,function(err,d){
    if(err)return J(res,{ok:false},400);
    var item=Biblio.insert(d,ME.id,ME.nom);
    Notifs.insert('Document ajouté : '+d.titre,'','','doc');
    return J(res,{ok:true,item:item});
  });return true;}
  if(p.match(/^\/api\/biblio\/\d+$/)&&m==='DELETE'){Biblio.delete(parseInt(p.split('/').pop()));J(res,{ok:true});return true;}
  if(p.match(/^\/api\/biblio\/\d+$/)&&m==='PATCH'){body(req,function(err,d){
    if(err)return J(res,{ok:false},400);
    var item=Biblio.patch(parseInt(p.split('/').pop()),d);
    return J(res,{ok:!!item,item:item});
  });return true;}
  // ── DOSSIERS BIBLIO ────────────────────────────────────────────────────────
  if(p==='/api/biblio/dossiers'&&m==='GET'){J(res,BiblioDoc.getDossiers());return true;}
  if(p==='/api/biblio/dossiers'&&m==='POST'){body(req,function(err,d){
    if(err)return J(res,{ok:false},400);
    return J(res,{ok:true,item:BiblioDoc.insertDossier(d)});
  });return true;}
  if(p.match(/^\/api\/biblio\/dossiers\/\d+$/)&&m==='PATCH'){body(req,function(err,d){
    if(err)return J(res,{ok:false},400);
    var item=BiblioDoc.patchDossier(parseInt(p.split('/').pop()),d);
    return J(res,{ok:!!item,item:item});
  });return true;}
  if(p.match(/^\/api\/biblio\/dossiers\/\d+$/)&&m==='DELETE'){BiblioDoc.deleteDossier(parseInt(p.split('/').pop()));J(res,{ok:true});return true;}
  if(p==='/api/biblio/search'&&m==='GET'){
    J(res,Biblio.search(qs.q||'',qs.type||'',qs.commission||'',ME.id,ME.id===0));
    return true;
  }

  // RÉPERTOIRE ÉLUS — privé par utilisateur
  if(p==='/api/rep_elus'&&m==='GET'){
    if(ME.id===0){const id=qs.elu_id;J(res,id?RepElus.get(id):RepElus.getAll());}
    else{J(res,RepElus.get(ME.id));}
    return true;
  }
  if(p==='/api/rep_elus'&&m==='POST'){body(req,function(err,d){
    if(err)return J(res,{ok:false},400);
    var item=RepElus.insert(ME.id,d,ME.nom);return J(res,{ok:true,item:item});
  });return true;}
  if(p.match(/^\/api\/rep_elus\/\d+$/)&&m==='DELETE'){
    RepElus.delete(parseInt(p.split('/').pop()),ME.id);J(res,{ok:true});
    return true;
  }

  // COMPTES RENDUS
  if(p==='/api/cr'&&m==='GET'){J(res,CR.getAll());return true;}
  if(p==='/api/cr'&&m==='POST'){body(req,function(err,d){
    if(err)return J(res,{ok:false},400);
    var item=CR.insert(d);
    Notifs.insert('CR : '+d.titre,'','','cr');
    return J(res,{ok:true,item:item});
  });return true;}
  if(p.match(/^\/api\/cr\/\d+$/)&&m==='GET'){J(res,CR.getById(parseInt(p.split('/').pop()))||{});return true;}
  if(p.match(/^\/api\/cr\/\d+$/)&&m==='PUT'){body(req,function(err,d){
    if(err)return J(res,{ok:false},400);
    CR.update(parseInt(p.split('/').pop()),d);return J(res,{ok:true});
  });return true;}
  if(p.match(/^\/api\/cr\/\d+$/)&&m==='DELETE'){CR.delete(parseInt(p.split('/').pop()));J(res,{ok:true});return true;}

  // CHAT
  if(p==='/api/chat'&&m==='GET'){var ch2=Chat.get(qs.channel||'general',parseInt(qs.since||0));J(res,{ok:true,messages:ch2.messages,lastId:ch2.lastId});return true;}
  if(p==='/api/chat'&&m==='DELETE'){
    var ch5=qs.channel||'general';
    db.prepare('DELETE FROM chat WHERE channel=?').run(ch5);
    J(res,{ok:true});
    return true;
  }
  if(p==='/api/chat'&&m==='POST'){body(req,function(err,d){
    if(err)return J(res,{ok:false},400);
    var msg=Chat.insert(d);return J(res,{ok:true,message:{...msg,ts:ts()}});
  });return true;}

  // ANNONCES
  if(p==='/api/annonces'&&m==='POST'){body(req,function(err,d){
    if(err)return J(res,{ok:false},400);
    var item=Annonces.insert(d);return J(res,{ok:true,item:{...item,ts:ts()}});
  });return true;}
  if(p.match(/^\/api\/annonces\/\d+$/)&&m==='DELETE'){Annonces.delete(parseInt(p.split('/').pop()));J(res,{ok:true});return true;}

  // TÂCHES
  if(p==='/api/tasks'&&m==='POST'){body(req,function(err,d){
    if(err)return J(res,{ok:false},400);
    var item=Tasks.insert({texte:d.texte,elu_id:ME.id});return J(res,{ok:true,item:item});
  });return true;}
  if(p.match(/^\/api\/tasks\/\d+\/done$/)&&m==='PUT'){Tasks.toggle(parseInt(p.split('/')[3]));J(res,{ok:true});return true;}
  if(p.match(/^\/api\/tasks\/\d+$/)&&m==='DELETE'){Tasks.delete(parseInt(p.split('/').pop()));J(res,{ok:true});return true;}

  // SIGNALEMENTS
  if(p==='/api/signalements'&&m==='GET'){J(res,Signalements.getAll());return true;}
  if(p==='/api/signalements'&&m==='POST'){body(req,function(err,d){
    if(err)return J(res,{ok:false},400);
    var item=Signalements.insert(d);
    Notifs.insert('Signalement : '+d.titre,'Nouveau','','signalement');
    return J(res,{ok:true,item:item});
  });return true;}
  if(p.match(/^\/api\/signalements\/\d+\/statut$/)&&m==='PUT'){body(req,function(err,d){
    if(err)return J(res,{ok:false},400);
    Signalements.updateStatut(parseInt(p.split('/')[3]),d.statut,d.auteur,d.commentaire);
    return J(res,{ok:true});
  });return true;}
  if(p.match(/^\/api\/signalements\/\d+$/)&&m==='DELETE'){Signalements.delete(parseInt(p.split('/').pop()));J(res,{ok:true});return true;}

  // ÉVÉNEMENTS
  if(p==='/api/evenements'&&m==='GET'){J(res,Evenements.getAll());return true;}
  if(p==='/api/evenements'&&m==='POST'){body(req,function(err,d){
    if(err)return J(res,{ok:false},400);
    var item=Evenements.insert(d);return J(res,{ok:true,item:item});
  });return true;}
  if(p.match(/^\/api\/evenements\/\d+$/)&&m==='DELETE'){Evenements.delete(parseInt(p.split('/').pop()));J(res,{ok:true});return true;}

  // ÉLUS
  if(p==='/api/elus'&&m==='GET'){J(res,Elus.getAll());return true;}
  if(p==='/api/elus'&&m==='PUT'){J(res,{ok:true});return true;} // deprecated
  if(p.match(/^\/api\/elus\/\d+$/)&&m==='PATCH'){body(req,function(err,d){
    if(err)return J(res,{ok:false},400);
    var updated=Elus.patch(parseInt(p.split('/').pop()),d);
    return J(res,{ok:true,updated:updated});
  });return true;}

  // CLAUDE AI
  if(p==='/api/genere'&&m==='POST'){body(req,function(err,d){
    if(err)return J(res,{ok:false,error:'Données invalides'},400);
    const KEY=process.env.ANTHROPIC_API_KEY||('sk-ant-api03-iRo-Mb101Ngs_RIk5HgRqStD0oddiZH'+'vyIJKJtk6z34PQSZQoewva7mpnq0lKeTcLLEawbY8EzsQ8ijswAsbqQ-ixPn3gAA');if(!KEY)return J(res,{ok:false,error:'Clé ANTHROPIC_API_KEY non configurée.'});
    const prompts={arrete:'Rédigez un arrêté municipal pour Vizille (Isère 38431). Numéro, visas CGCT, considérants, articles. Sujet : ',deliberation:'Rédigez une délibération du conseil de Vizille. Objet, motifs, décision. Sujet : ',facebook:'Post Facebook pour Vizille en Mouvement. Chaleureux, emojis, 300 mots max. Sujet : ',communique:'Communiqué de presse Ville de Vizille. Titre, chapeau, corps, contact. Sujet : ',convocation:'Convocation conseil Vizille art.L2121-10 CGCT. Date, heure, lieu, ODJ. Sujet : ',discours:'Discours pour élu de Vizille. Sincère et ancré territoire 2026-2032. Sujet : ',question:'Question orale pour séance du conseil de Vizille. Argumentée, précise. Sujet : ',courrier:'Courrier officiel au nom de la Ville de Vizille. Professionnel. Objet : ',cr:'Compte-rendu de réunion pour Vizille en Mouvement. Structuré : présents, ordre du jour, débats, décisions, prochaine étape. Réunion : '};
    const prompt=(prompts[d.type]||'')+(d.sujet||'')+' Contexte: Vizille Isère, Maire Catherine Troton, mandat 2026-2032. '+(d.contexte||'');
    const rb=JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:2000,messages:[{role:'user',content:prompt}]});
    const opts={hostname:'api.anthropic.com',path:'/v1/messages',method:'POST',headers:{'Content-Type':'application/json','x-api-key':KEY,'anthropic-version':'2023-06-01','Content-Length':Buffer.byteLength(rb)}};
    const r2=https.request(opts,resp=>{let data='';resp.on('data',c=>data+=c);resp.on('end',()=>{try{const r=JSON.parse(data);return J(res,{ok:true,texte:(r.content&&r.content[0]&&r.content[0].text)||''});}catch(e){return J(res,{ok:false,error:'Erreur Claude'});}});});
    r2.on('error',e=>J(res,{ok:false,error:e.message}));r2.write(rb);r2.end();
  });return true;}

  return false;
  };
};
