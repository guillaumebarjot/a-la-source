# Guide d'utilisation — A la source

## Presentation

« A la source » est un outil collaboratif d'education populaire sur l'information, porte par Rouge Coquelicot. Il permet de collecter des sources mediatiques, d'identifier les mecanismes informationnels a l'oeuvre, et de preparer des ateliers de decryptage collectif.

## Parcours type

1. **Flux** — Decouvrir les dernieres sources partagees par la communaute
2. **Lire** — Lire en detail une source, identifier des mecanismes, evaluer
3. **Vivier** — Les meilleures sources remontent dans le pipeline atelier
4. **Atelier** — Le·la facilitateur·ice selectionne, le groupe decouvre et debat

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

### Observatoire (`/observatoire`)

Visualisations et statistiques sur l'ensemble des sources analysees.

- Timeline des mecanismes (evolution mois par mois)
- Matrice media × mecanisme (qui utilise quoi)
- Top sources les plus evaluees
- Radar confiance media

### Ateliers (`/ateliers`)

Pipeline de preparation des ateliers.

- **Vivier** : sources proposees, triees par score /100
- **Preparation** : composer un atelier, selectionner les sources
- **Archives** : historique des ateliers passes

### Archiver (`/archiver`)

Page collaborative d'archivage. Montre les sources les plus consultees mais non encore archivees. Permet de lancer l'archivage d'une URL.

### Becs Rouges (`/becs-rouges`)

Page dediee aux Becs Rouges : videos (Indymotion, YouTube), podcasts, presentation.

### Mon espace (`/perso`)

Espace personnel : sources a lire, recommandations reçues, contributions.

### Aide (`/aide`)

Documentation integree a l'application.

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
- **Facilitateur·ice** : + gerer les ateliers, selectionner des sources, overrider le timing
- **Admin** : + gerer les utilisateur·ices, configurer les parametres

## Tags vs Mots-cles

- **Tags** : poses manuellement par les membres (thematiques, libres)
- **Mots-cles** : extraits automatiquement du contenu (meta HTML + TF-IDF)
