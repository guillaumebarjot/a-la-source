# Guide d'utilisation — A la source

## Presentation

« A la source » est un outil collaboratif d'education populaire aux medias, porte par Rouge Coquelicot. Il permet de collecter des sources mediatiques, d'identifier les mecanismes informationnels a l'oeuvre, et de preparer des ateliers de decryptage collectif.

## Parcours type (refonte v3, par sujets)

1. **Sujets** — Page d'accueil : explorer les themes durables (couverture multisource)
2. **Veille** — Le substrat : decouvrir et soumettre des sources partagees par la communaute
3. **Lire** — Lire en detail une source, identifier des mecanismes, evaluer
4. **Activites** — Le hub : preparer un atelier, un dossier, un debunkage, un arpentage…

## Navigation

Le menu de tete comporte 8 entrees, **Sujets en premier**, la Veille reléguée en substrat :

```
Sujets | Activites | Veille | Observatoire | Archiver | Apprendre | Mon espace | [Admin]
```

## Pages de l'application

### Sujets (`/sujets`)

Page d'accueil (`/` y redirige). Grille des **Sujets** (themes durables, ex. le lithium en Alsace), l'objet pivot editorial. Chaque carte mene a la page du sujet : couverture multisource par evenement, sources rattachees (par glisser-deposer), section « Partager » (page publique OpenGraph + export YesWiki). Tout membre cree un sujet ; un·e animateur·ice le publie.

### Veille (`/veille`)

Le **substrat** de la veille collaborative (anciennement « Flux »). Affiche les sources soumises par la communaute, triees par recence (les plus recentes en premier). Les sources anciennes s'estompent progressivement (fraicheur visuelle).

**Actions possibles** :
- Filtrer par tag, type de source, media, et **commentees / non commentees**
- Soumettre une nouvelle source (coller une URL, tout le reste est auto-fetche)
- Cliquer sur une carte pour acceder a la page Lire
- Acceder a l'**Inbox a qualifier** via le lien discret en tete

### Inbox a qualifier (`/inbox`)

Les sources entrantes en attente de tri, notamment celles **ingerees depuis Discord** (origine `discord`). Pour chaque carte : **Qualifier** (→ veille / vivier) ou **Rejeter** (→ archive, non destructif).

### Lire (`/lire/:id`)

Coeur de l'application. Affiche le contenu archive d'une source avec une sidebar interactive.

**Sidebar** :
- **Metadonnees** : media, auteur·ice, date, type, paywall
- **Tags** : ajouter ou retirer des tags
- **Mecanismes** : voir les mecanismes identifies, en identifier de nouveaux
- **Evaluation** : noter la source (complexite, resonance, bonus expert·e)
- **Commentaires** : discuter, analyser, poser des questions

**Actions** :
- Marquer comme lu·e
- Recommander a un·e autre membre
- Proposer au vivier (pour les ateliers)
- Archiver (si pas encore fait)
- Partager (copier le lien, Discord)

### Observatoire (`/observatoire`)

Visualisations et statistiques sur l'ensemble des sources analysees. 4 onglets :

- **Mecanismes** : timeline des mecanismes identifies (barres empilees), matrice media × mecanisme (heatmap)
- **Medias** : nombre de sources par media, indice de confiance par media
- **Fiches medias** : fiches detaillees (proprietaire, ligne editoriale, stats)
- **Sources** : top sources les plus evaluees

### Activites (`/activites`)

Le **hub** des activites d'education populaire, posees sur un socle commun. Section « Creer une activite » en tete avec les 6 formats : **atelier, dossier, decryptage (a chaud), debunkage, parcours, arpentage**. Compteurs et acces a chaque famille.

### Ateliers (`/ateliers`)

Pipeline de preparation et gestion des ateliers. 4 onglets :

- **Vivier** : sources proposees, triees par **recence** par defaut (le score reste un tri optionnel, plus un verdict). On lit des **facettes factuelles** (nombre d'evaluations, completude, mecanismes pressentis, fraicheur) ; la checklist « pretes pour atelier » (evaluee + archivee + accroche) est une **completude**, pas une note.
- **Preparation** : composer un atelier en glisser-deposer (vivier a gauche, corpus a droite). Panneau « Profil du corpus » : on **decrit l'ensemble** (diversite de medias, de propriete, de mecanismes, profil de duree) avec des alertes douces et des suggestions de diversification, sans nombre-verdict.
- **En cours** : atelier actif, table de pilotage sur un ecran, acces au mode projection plein ecran.
- **Archives** : historique des ateliers termines avec compte-rendu.

### Archiver (`/archiver`)

Page collaborative d'archivage anti-linkrot. 3 onglets :

- **A archiver** : sources prioritaires non encore archivees
- **Archives partielles** : sources dont l'archivage est incomplet
- **Completer** : contribuer a l'archivage (upload manuel, markdown, PDF)

### Apprendre (`/apprendre`)

Section pedagogique. 3 onglets :

- **Catalogue** : les 25+ mecanismes informationnels classes par categorie (6 familles), avec fiches detaillees, exemples, questions guidees
- **Manuel** : le Manuel de deconstruction mediatique, guide complet pour les facilitateur·ices (biais cognitifs, mecaniques de fabrication, grille d'analyse, glossaire, ressources)
- **Aide & Ressources** : fonctionnement de l'outil, contrat d'epoche, guidelines d'evaluation, systeme de score

### Mon espace (`/perso`)

Espace personnel :

- **Mon compte** : identite SSO, role, et **pseudo Discord** editable (sert au rapprochement des sources postees sur Discord avec votre compte)
- **Mes contributions** : sources proposees, evaluations, mecanismes, commentaires, activites creees ou animees, sujets crees
- **Mes lectures** : sources sauvegardees, recommandations reçues
- **Chaines amies** : videos partenaires (PeerTube / Indymotion)

### Administration (`/admin`)

Reserve aux admins. 2 onglets :

- **Parametrage** : configuration generale de l'app
- **Utilisateurs** : gestion des roles (membre, animateur·ice, admin)

### Projection (`/projection/:atelierId`)

Mode plein ecran pour la projection en atelier. Fond clair force, typographie de lecture. 3 phases :
1. **Selection** : grille neutre des sources de la shortlist (sans scores ni mecanismes)
2. **Lecture** : reader serif, plein ecran, mode archive
3. **Synthese** : formulaire guide (mecanismes identifies, observations, nombre de participants)

## Systeme de score

### Score atelier /100

Chaque source reçoit un score sur 100, compose de :

- **Pedagogie (50 pts)** : densite de mecanismes identifies, diversite, qualite des justifications, complexite du sujet (slider), bonus expert·e (slider)
- **Echo (50 pts)** : croisements internes (tags communs), lectures, commentaires, viralite, resonance (slider)

### Indice timing (A/B/C/D)

Base sur la duree de lecture/visionnage :
- **A** = 3-8 min (ideal pour un atelier d'1h)
- **B** = 8-15 min (acceptable)
- **C** = 15-30 min (long)
- **D** = >30 min (trop long)

Le·la facilitateur·ice peut overrider cet indice manuellement.

### Fraicheur

Les sources s'estompent progressivement avec le temps. La vitesse depend du type de source (un rapport reste « frais » plus longtemps qu'un fait divers). Un toggle permet d'afficher les anciennes sources.

## Roles

- **Membre** : soumettre, taguer, commenter, evaluer, identifier des mecanismes, lire
- **Animateur·ice** : + gerer les ateliers, selectionner des sources, overrider le timing
- **Admin** : + gerer les utilisateur·ices, configurer les parametres

## Tags vs Mots-cles

- **Tags** : poses manuellement par les membres (thematiques, libres)
- **Mots-cles** : extraits automatiquement du contenu (meta HTML + TF-IDF)

## Depuis Discord

Le bot relie le salon Discord du collectif a l'application.

### Poster un lien

- Coller une **URL d'article** dans le canal surveille cree une source en **Inbox a qualifier**. Le bot **repond** avec le lien vers l'article dans l'app. Si vous avez renseigne votre **pseudo Discord** dans Mon espace, la source vous est creditee.
- **Texte en plus du lien** : ajoute en **commentaire** sur la source.
- **Version sans paywall** : repondre/editer avec un lien alternatif l'ajoute a la source (pas un doublon).
- **Edition / reponse** Discord : rattachee a la bonne source (le bot garde le lien message ↔ source).

### PDF Europresse et fichiers .ris

- **PDF joint** : copie integrale **hors-ligne** lisible directement dans l'app (utile pour Europresse / BnF).
- **`.ris` joint** : metadonnees recuperees (titre, media, date, resume).

### Commandes (consultation et manuel)

- `!source <id>` ou `!fiche <id>` : fiche d'une source (commentaires avec id, debunkages lies, presence de texte)
- `!texte <id>` : texte integral, decoupe en blocs
- `!editcom <id> <texte>` : modifier un commentaire (auteur ou admin)
- `!vivier`, `!atelier`, `!analyser` : raccourcis vers le pipeline
- `!aide`, `!manuel`, `!guide` : le manuel de deconstruction mediatique

Chaque reponse du bot invite a « faire encore mieux dans l'app ».

### App vers Discord

A la publication d'un **sujet**, d'un **dossier/decryptage** ou d'un **debunkage**, un message est automatiquement poste dans le salon de diffusion (carte « unfurlee »).
