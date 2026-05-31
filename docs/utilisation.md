# Guide d'utilisation — A la source

## Presentation

« A la source » est un outil collaboratif d'education populaire aux medias, porte par Rouge Coquelicot. Il permet de collecter des sources mediatiques, d'identifier les mecanismes informationnels a l'oeuvre, et de preparer des ateliers de decryptage collectif.

## Parcours type

1. **Flux** — Decouvrir les dernieres sources partagees par la communaute
2. **Lire** — Lire en detail une source, identifier des mecanismes, evaluer
3. **Vivier** — Les meilleures sources remontent dans le pipeline atelier
4. **Atelier** — Le·la facilitateur·ice compose une shortlist, le groupe choisit et decortique

## Pages de l'application

### Flux (`/flux`)

Page d'accueil. Affiche toutes les sources soumises par la communaute, triees par date (les plus recentes en premier). Les sources anciennes s'estompent progressivement (fraicheur visuelle).

**Actions possibles** :
- Filtrer par tag, type de source, ou media
- Soumettre une nouvelle source (bouton « + Soumettre source »)
- Cliquer sur une carte pour acceder a la page Lire

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

### Ateliers (`/ateliers`)

Pipeline de preparation et gestion des ateliers. 4 onglets :

- **Vivier** : sources proposees, triees par score /100 (60% pedagogie + 40% echo), avec quality gate
- **Preparation** : composer un atelier, selectionner les sources, definir les questions
- **En cours** : atelier actif, acces au mode projection plein ecran
- **Archives** : historique des ateliers termines avec compte-rendu

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

Espace personnel. 2 onglets :

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
