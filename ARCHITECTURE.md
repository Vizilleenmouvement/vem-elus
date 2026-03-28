# Architecture technique — VeM Espace Elus

## Vue d'ensemble

```
NAVIGATEUR (Chrome/Safari)
    |
    | HTTPS
    v
INFOMANIAK — elus.vizilleenmouvement.fr
    |
    +-- server.js (Node.js) ----+-- Sessions (memoire)
    |                           +-- Anti-brute-force
    |                           +-- Email SMTP Gmail (natif)
    |
    +-- db.js (couche donnees)
    |
    +-- vem.db (SQLite)
    |     |
    |     +-- elus (26)
    |     +-- projets (91)
    |     +-- agenda
    |     +-- comptes_rendus
    |     +-- biblio + biblio_dossiers
    |     +-- chat
    |     +-- articles
    |     +-- signalements
    |     +-- evenements
    |     +-- annonces
    |     +-- tasks
    |     +-- notifs
    |     +-- access_logs
    |     +-- statuts
    |     +-- rep_elus
    |     +-- projet_jalons
    |     +-- projet_partenaires
    |     +-- projet_contacts
    |     +-- projet_docs
    |     +-- projet_presse
    |     +-- projet_journal
    |
    +-- uploads/ (fichiers PDF, Word, images...)

SERVICES EXTERNES
    +-- GitHub (code source)
    +-- Gmail SMTP (emails reset mdp)
    +-- Anthropic Claude API (redaction IA)
```

## Routes API

| Route | Methode | Description |
|-------|---------|-------------|
| `/` | GET | Page publique |
| `/login` | GET/POST | Connexion |
| `/espace` | GET | Dashboard (authentifie) |
| `/forgot-password` | GET/POST | Mot de passe oublie |
| `/reset-password` | GET/POST | Reinitialisation mdp |
| `/logout` | GET | Deconnexion |
| `/api/all` | GET | Toutes les donnees accueil |
| `/api/me` | GET | Identite connectee |
| `/api/projets` | GET | Liste projets |
| `/api/projet/:id` | PATCH/DELETE | Modifier/supprimer projet |
| `/api/projet/:id/fiche` | GET | Fiche detaillee |
| `/api/projet/:id/jalons` | POST | Ajouter jalon |
| `/api/projet/:id/contacts` | POST | Ajouter contact |
| `/api/projet/:id/docs` | POST | Ajouter document |
| `/api/projet/:id/presse` | POST | Ajouter article presse |
| `/api/projet/:id/journal` | POST | Ajouter note journal |
| `/api/statut` | POST | Changer statut projet |
| `/api/agenda` | GET/POST | Reunions |
| `/api/agenda/:id` | PATCH/DELETE | Modifier/supprimer reunion |
| `/api/cr` | GET/POST | Comptes rendus |
| `/api/cr/:id` | GET/PUT/DELETE | Detail/modifier/supprimer CR |
| `/api/biblio` | GET/POST | Bibliotheque documentaire |
| `/api/biblio/:id` | PATCH/DELETE | Modifier/supprimer document |
| `/api/biblio/dossiers` | GET/POST | Dossiers thematiques |
| `/api/chat` | GET/POST/DELETE | Messagerie interne |
| `/api/articles` | GET/POST | Veille & Articles |
| `/api/articles/:id` | DELETE | Supprimer article |
| `/api/annonces` | POST | Publier annonce |
| `/api/tasks` | POST | Ajouter tache |
| `/api/signalements` | GET/POST | Signalements terrain |
| `/api/evenements` | GET/POST | Evenements |
| `/api/elus` | GET | Liste elus |
| `/api/elus/:id` | PATCH | Modifier fiche elu |
| `/api/rep_elus` | GET/POST | Repertoire prive |
| `/api/access-logs` | GET | Journal connexions (admin) |
| `/api/upload` | POST | Upload fichier |
| `/api/genere` | POST | Generation IA Claude |
| `/api/change_pwd` | POST | Changer mot de passe |

## Comptes

| Role | Login | ID | Admin |
|------|-------|----|-------|
| Administrateur | admin | 0 | Oui |
| Michel Thuillier | michel.thuillier | 20 | Oui |
| Catherine Troton | catherine.troton | 1 | Non |
| Bernard Ughetto-Monfrin | bernard.ughetto-monfrin | 2 | Non |
| Saida Berriche | saida.berriche | 3 | Non |
| ... (26 elus au total) | prenom.nom | 1-26 | Non |

## Securite

- **Authentification** : cookie session HttpOnly (7 jours)
- **Anti-brute-force** : 5 tentatives max / 15 minutes par IP
- **Journalisation** : toutes les connexions (reussies + echouees)
- **Reinitialisation mdp** : token temporaire 1h, email admin
- **Upload** : noms de fichiers assainis, dossier uploads/

## Deploiement

- **Hebergement** : Infomaniak (Geneve, Suisse)
- **Code source** : GitHub (Vizilleenmouvement/vem-elus)
- **Deploiement** : push GitHub → Infomaniak tire le code → redemarrage
- **Base de donnees** : SQLite (fichier vem.db sur le serveur)
- **Node.js** : v24.x
