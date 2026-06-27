# Guide d'utilisation — À la source

## Présentation

« À la source » est un outil collaboratif d'éducation populaire aux médias, porté par Rouge Coquelicot. Il permet de collecter des sources médiatiques, d'identifier les mécanismes informationnels à l'oeuvre, et de préparer des ateliers de décryptage collectif.

## Parcours type (refonte v3, par sujets)

1. **Accueil** : point d'entrée pédagogique. Comprendre où se déroule quoi, reprendre là où on en était.
2. **Inbox** : qualifier les sources entrantes ensemble (copie locale, accroche, image, sujet, mécanisme).
3. **Veille** : explorer et soumettre des sources partagées par la communauté.
4. **Sujets** : retrouver les sources par thème durable, voir la couverture multisource.
5. **Lire** : lire en détail une source, identifier des mécanismes, évaluer.
6. **Activités** : préparer un atelier, un dossier, un débunkage, un arpentage.

## Navigation

Le menu de tête comporte 8 entrées :

```
Accueil | Mon espace | À trier | À lire | Sujets | Activités | Apprendre | Observatoire
```

Les libellés « À trier » et « À lire » correspondent aux routes `/inbox` et `/veille` (URLs inchangées ; les sous-titres `title` rappellent les termes techniques « Inbox » et « Veille »).

Une sous-navigation contextuelle (H2) apparaît selon la page active.

## Pages de l'application

### Accueil (`/accueil`)

Point d'entrée pédagogique. Explique le **parcours d'une source** de bout en bout (de l'Inbox aux activités), avec **aide au survol** sur chaque étape et **blocs repliables** pour le menu de l'application. Affiche en permanence le nombre de sources en Inbox à qualifier, les lectures en cours et les parcours en révision. `/` redirige ici.

### Inbox (`/inbox`)

Le **hub collectif de qualification des sources**. Qualifier une source n'est plus un simple « envoyer en veille » : c'est un **tunnel d'enrichissement à la carte, non bloquant**, en six étapes :

1. **Accepter** : la source n'est pas un spam, elle entre en veille.
2. **Fiabiliser** : copie locale (archivage auto, coller le texte Europresse ou joindre un PDF), image de couverture, accroche lisible, date et média.
3. **Situer** : rattacher à au moins un sujet, ajouter des mots-clés.
4. **Analyser** : repérer un mécanisme médiatique (optionnel).
5. **Mobiliser** : verser dans un dossier ou une activité (optionnel).
6. **Commenter** (optionnel).

Aucune étape n'est bloquante. Chaque source affiche ses **jalons factuels** (faits/à faire) sous forme d'un compteur `N/M jalons`. Une source est « bien qualifiée » quand elle a une copie locale, une accroche et une image.

**Filtres par ce qui manque** : à accepter · sans copie locale · sans accroche · sans image · sans sujet · non analysée. Ces filtres remplacent l'ancienne page Archiver (`/archiver` et `/a-archiver` redirigent ici).

La copie locale s'ajoute directement sur la carte de la source, sans ressaisir l'identifiant : « Archiver » (readability automatique), « Coller le texte » (Europresse), « Joindre un PDF ».

Ouvert à tous les membres connectés.

### Veille (`/veille`)

Le **substrat** de la veille collaborative (distinct de l'Inbox). Affiche les sources soumises, triées par récence (les plus récentes en premier). Les sources anciennes s'estompent progressivement (fraîcheur visuelle).

**Actions possibles** :
- Filtrer par tag, type de source, média, commentées / non commentées
- Soumettre une nouvelle source (coller une URL, tout le reste est auto-fetché)
- Cliquer sur une carte pour accéder à la page Lire

### Lire (`/lire/:id`)

Coeur de l'application. Affiche le contenu archivé d'une source avec une sidebar interactive.

**Sidebar** :
- **Métadonnées** : média, auteur·ice, date, type, paywall
- **Tags** : ajouter ou retirer des tags
- **Mécanismes** : voir les mécanismes identifiés, en identifier de nouveaux
- **Évaluation** : noter la source (complexité, résonance, bonus expert·e)
- **Commentaires** : discuter, analyser, poser des questions

**Actions** :
- Marquer comme lu·e
- Recommander à un·e autre membre
- Proposer au vivier (pour les ateliers)
- **Ranger dans un dossier existant** (parcours inverse veille vers dossier)
- Partager (copier le lien, Discord)

**Panneau « Corriger l'accès »** : toujours disponible, pré-ouvert si la source est signalée paywall ou si l'archive est partielle. Permet de remettre un lien d'accès (source originale, version sans paywall), de coller le texte intégral (Europresse, archive), ou de joindre un PDF, sans ressaisir l'identifiant de la source.

### Sujets (`/sujets`)

Grille des **Sujets** (thèmes durables, ex. le lithium en Alsace). Chaque carte mène à la page du sujet : couverture multisource par événement, sources rattachées (par glisser-déposer), section « Partager » (page publique OpenGraph + export YesWiki). Tout membre crée un sujet ; un·e animateur·ice le publie.

### Activités (`/activites`)

Le **hub** des activités d'éducation populaire, posées sur un socle commun. Section « Créer une activité » en tête avec les formats disponibles : **atelier, dossier, décryptage (à chaud), débunkage, arpentage**. Le **Parcours** ne vit plus ici ; il est accessible sous **Apprendre**.

#### Composer un corpus en glisser-déposer (sujet, dossier, débunkage)

Les pages **Sujet**, **Dossier** et **Débunkage** partagent un même composant de composition de corpus (`CorpusDnD`) : on **promène une carte** (image + titre) depuis la veille vers le corpus, on la réordonne par la poignée, l'ordre est persisté. Sur le **débunkage**, chaque carte reçoit un **rôle** (pour / contre).

#### Débunkage (`/debunkages`)

Activité de démonstration : affirmation visée, démonstration, corpus de sources **pour / contre** (glisser-déposer), **liens de posts réseaux**. Une fois publié, le débunkage dispose d'une page publique partageable (OpenGraph) et d'un export YesWiki.

#### Dossier et décryptage (`/dossiers`)

Le **dossier** est une mise en perspective rédigée autour d'un corpus de sources. Le **décryptage** est un dossier « à chaud », rattaché à un **événement** d'actualité (même page, flag « à chaud »). Sources composées en glisser-déposer, contenu rédigé, section « Partager » (page publique + export YesWiki).

#### Arpentage (`/arpentages`)

Lecture collective **fragmentée** d'un document : découpage en fragments, **attribution** aux participant·es, restitutions, puis **synthèse** collective.

### Ateliers (`/ateliers`)

La page `/ateliers` affiche la **liste unique** de tous les ateliers (à venir et en cours, puis passés), avec un accès direct au **vivier** (`/ateliers/vivier`). Cliquer sur un atelier ouvre sa **page objet** (`/ateliers/:id`), qui comporte :

- un **stepper de jalons factuels** (corpus, source choisie, mécanismes, synthèse, terminé) ;
- trois **onglets internes** (uniquement pour les ateliers actifs) :
  - **Préparation** : composer le corpus en glisser-déposer (vivier à gauche, corpus à droite). Panneau « Profil du corpus » : on **décrit l'ensemble** (diversité de médias, de propriété, de mécanismes, profil de durée) avec des alertes douces et des suggestions de diversification.
  - **Pilotage** : table de pilotage de l'atelier, transitions de statut (prêt, en cours, terminé), accès au mode projection plein écran.
  - **Synthèse** : mécanismes identifiés par le groupe, observations, questions restantes, nombre de participant·es.

Le **vivier** (`/ateliers/vivier`) liste les sources candidates triées par **récence** par défaut (le score reste un tri optionnel, jamais un verdict). On y lit des **facettes factuelles** (fraîcheur, complétude, mécanismes pressentis). Plusieurs ateliers peuvent être actifs simultanément.

### Observatoire (`/observatoire`)

La **référence critique des médias** : qui possède quoi, couverture comparée d'un même fait, fiches médias factuelles, catalogue des mécanismes. 5 sections (sous-nav H2) :

- **Tableau de bord** : miroir factuel de notre veille (volumes globaux, sources ajoutées par mois, médias les plus présents, mécanismes identifiés, sujets instruits). Zéro score-verdict, que des compteurs.
- **Propriété** : cartographie des actionnaires ultimes des médias présents dans la veille, regroupés par groupe propriétaire, avec type de propriété et financement.
- **Couverture comparée** : comment un même fait est couvert différemment selon les médias.
- **Fiches médias** : propriétaire, actionnaire ultime, type de propriété, financement, ligne revendiquée, mécanismes repérés. Pas de score de confiance : on décrit, on ne note pas.
- **Catalogue mécanismes** : les 25 mécanismes de référence (fiches pédagogiques avec définition, exemple type, questions guidées et analyses réelles de la veille).

### Apprendre (`/apprendre`)

Section pédagogique. 3 onglets (sous-nav H2) :

- **Parcours** : quiz de repérage des mécanismes sur cartes-sources nues (score). Génération automatique depuis `source_mecanismes`.
- **Manuel** : le Manuel de déconstruction médiatique, guide complet pour les facilitateur·ices (biais cognitifs, mécaniques de fabrication, grille d'analyse, glossaire, ressources).
- **Aide & Ressources** : fonctionnement de l'outil, contrat d'epoché, guidelines d'évaluation, système de score.

Le catalogue des 25 mécanismes est désormais sous **Observatoire > Mécanismes**.

### Mon espace (`/perso`)

Espace personnel (sous-nav H2 : Mon compte · Mes contributions · Mes lectures · Chaînes amies) :

- **Mon compte** : identité SSO, rôle, et **pseudo Discord** éditable (sert au rapprochement des sources postées sur Discord avec votre compte).
- **Mes contributions** : sources proposées, évaluations, mécanismes, commentaires, activités créées ou animées, sujets créés.
- **Mes lectures** : sources sauvegardées, recommandations reçues.
- **Chaînes amies** : vidéos partenaires (PeerTube / Indymotion).

### Administration (`/admin`)

Réservé aux admins. 2 onglets :

- **Paramétrage** : configuration générale de l'app
- **Utilisateurs** : gestion des rôles (membre, animateur·ice, admin)

### Projection (`/projection/:atelierId`)

Mode plein écran pour la projection en atelier. Fond clair forcé, typographie de lecture. 3 phases :
1. **Sélection** : grille neutre des sources de la shortlist (sans scores ni mécanismes)
2. **Lecture** : reader serif, plein écran, mode archive
3. **Synthèse** : formulaire guidé (mécanismes identifiés, observations, nombre de participants)

## Système de score

> Le score global /100 n'est plus affiché dans l'Inbox (décision 27/06, aligné avec la doctrine « décrire, ne pas noter »). La jauge est remplacée par un compteur de jalons `N/M`. Le score reste disponible comme **tri optionnel** au vivier (`/ateliers/vivier`), jamais comme verdict.

### Score atelier (tri optionnel au vivier)

Chaque source dispose d'un score calculé côté serveur, composé de :

- **Pédagogie** : densité de mécanismes identifiés, diversité, qualité des justifications, complexité du sujet (slider), bonus expert·e (slider)
- **Écho** : croisements internes (tags communs), lectures, commentaires, viralité, résonance (slider)

### Indice timing (A/B/C/D)

Basé sur la durée de lecture/visionnage :
- **A** = 3-8 min (idéal pour un atelier d'1h)
- **B** = 8-15 min (acceptable)
- **C** = 15-30 min (long)
- **D** = >30 min (trop long)

Le·la facilitateur·ice peut overrider cet indice manuellement.

### Fraîcheur

Les sources s'estompent progressivement avec le temps. La vitesse dépend du type de source (un rapport reste « frais » plus longtemps qu'un fait divers). Un toggle permet d'afficher les anciennes sources.

## Rôles

- **Membre** : soumettre, taguer, commenter, évaluer, identifier des mécanismes, lire
- **Animateur·ice** : + gérer les ateliers, sélectionner des sources, overrider le timing
- **Admin** : + gérer les utilisateur·ices, configurer les paramètres

## Tags vs Mots-clés

- **Tags** : posés manuellement par les membres (thématiques, libres)
- **Mots-clés** : extraits automatiquement du contenu (meta HTML + TF-IDF)

## Depuis Discord

Le bot relie le salon Discord du collectif à l'application.

### Poster un lien

- Coller une **URL d'article** dans le canal surveillé crée une source en **Inbox à qualifier**. Le bot **répond** avec le lien vers l'article dans l'app. Si vous avez renseigné votre **pseudo Discord** dans Mon espace, la source vous est créditée.
- **Texte en plus du lien** : ajouté en **commentaire** sur la source.
- **Version sans paywall** : répondre/éditer avec un lien alternatif l'ajoute à la source (pas un doublon).
- **Édition / réponse** Discord : rattachée à la bonne source.

### PDF Europresse et fichiers .ris

- **PDF joint** : copie intégrale **hors-ligne** lisible directement dans l'app.
- **`.ris` joint** : métadonnées récupérées (titre, média, date, résumé).

### Commandes (consultation et manuel)

- `!source <id>` ou `!fiche <id>` : fiche d'une source
- `!texte <id>` : texte intégral, découpé en blocs
- `!editcom <id> <texte>` : modifier un commentaire (auteur ou admin)
- `!vivier`, `!atelier`, `!analyser` : raccourcis vers le pipeline
- `!aide`, `!manuel`, `!guide` : le manuel de déconstruction médiatique

Chaque réponse du bot invite à « faire encore mieux dans l'app ».

### App vers Discord

À la publication d'un **sujet**, d'un **dossier/décryptage** ou d'un **débunkage**, un message est automatiquement posté dans le salon de diffusion (carte « unfurlée »).
