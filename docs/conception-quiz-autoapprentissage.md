# Conception — Quiz et autoapprentissage (À la source)

Note de conception du chantier « Quiz & autoapprentissage ». S'appuie sur l'audit
BDD du 2026-06-21 (`docs/audit-bdd-2026-06-21.md`) et sur l'inspection du code du
module `parcours` (client `Parcours.tsx` / `ParcoursSession.tsx`, serveur
`server/src/routes/parcours.ts`). Le correctif d'affichage des images décrit en
section 2 est déjà livré ; le reste (section 3 et suivantes) est spécifié, pas codé.

---

## 1. Le quiz aujourd'hui

Un module `parcours` fonctionnel mais minimal, adossé aux tables `parcours`,
`parcours_questions`, `parcours_sessions`, `parcours_reponses` et au catalogue
`mecanismes_reference`.

- **Un seul parcours** : « Découverte des mécanismes », 10 questions.
- Chaque question = une source réelle (image + titre) + un mécanisme attendu + une
  explication. Le joueur choisit un mécanisme parmi les 25 du catalogue, le serveur
  corrige, compte le score, et clôt la session quand toutes les questions ont une
  réponse.
- Le parcours **ne porte pas sur un thème** : ses 10 sources piochent dans plusieurs
  sujets (fiscalité, PFAS, agriculture, alimentation, lithium, médias…).

### Diagnostic des reproches

**a) Trop rigide.**
- Ordre des questions figé (`ORDER BY q.ordre`), pas de reprise possible, pas de
  navigation arrière, une seule tentative par question.
- Le seul retour est un score chiffré (« 7 / 10 ») : posture d'examen, pas
  d'exploration. C'est l'inverse de l'esprit éducation populaire (apprendre en
  furetant, pas être noté).
- Un seul parcours générique : on ne peut pas réviser un thème précis.

**b) On ne peut pas LIRE la source d'exemple.**
- La carte de question expose `titre`, `accroche`, `image_url` — rien d'autre, et
  **aucun lien vers la source en plein**. Or l'audit confirme que **les 10 sources
  du quiz ont une accroche vide** : la carte se réduisait donc à un titre nu.
- Le texte archivé existe pourtant en base (7 des 10 sources ont une archive
  lisible via `/lire/:id`), mais le quiz n'y donnait aucun accès. D'où « sources
  illisibles ».

**c) On ne VOIT pas les images — cause technique exacte.**
- Le rendu était `{question.source_image_url && <img src=… />}` : **aucun
  fallback, aucun `onError`**. Conséquences réelles :
  - `image_url` **NULL** (80 sources sur 162 en base, soit 49 %) → rien n'est rendu,
    la carte s'effondre sur un titre nu (et accroche vide → carte quasi vide).
  - `image_url` = **chemin relatif** `/images/source-N.jpg` (8 sources, images
    censées être hébergées localement) → **404 vérifié** en dev → icône d'image
    cassée du navigateur.
  - `image_url` externe **morte / hotlink 403 / mixed-content** → idem, glyphe cassé.
- Contraste avec le reste de l'app : `SourceCard.tsx` et `Mecanismes.tsx` rendent
  **toujours** un visuel — l'image si elle charge, **sinon un placeholder sobre**
  (initiale du média). Le module quiz était le seul à ne pas suivre ce patron, d'où
  le ressenti « images invisibles » concentré sur le quiz.
- Note : sur la **copie de base de dev**, les 10 images du parcours existant
  chargent (testé une à une, toutes `OK`). Le défaut n'était donc pas visible sur ce
  jeu précis, mais le **patron de rendu était fragile** et se cassait dès qu'une
  source sans image (ou à chemin relatif) entrait dans un quiz — ce qui est la norme
  vu que 49 % des sources n'ont pas d'image.

**d) Il faut PLUSIEURS quiz par grand thème (10-15 questions max).**
- Le modèle de données ne rattache **pas** un parcours à un `sujet`. Impossible
  aujourd'hui de dire « les quiz du thème PFAS ». À introduire (section 3).

---

## 2. Correctif livré (front, sûr)

Périmètre strict : `client/src/pages/ParcoursSession.tsx`,
`client/src/types/parcours.ts`, `client/src/styles/parcours.css`. Aucun fichier
partagé ni serveur touché.

- **Image toujours présente.** Nouveau composant `SourceVisuel` : rend l'image si
  elle charge, bascule sur un **placeholder dark-safe** (initiale du média ou du
  titre) si `image_url` est nulle **ou** si le chargement échoue (`onError`). Aligne
  le quiz sur le patron de `SourceCard`. Plus jamais de carte vide ni d'icône cassée.
  Le composant est `key={question.id}` pour réinitialiser l'état d'erreur à chaque
  question.
- **Source lisible.** Ajout d'un lien « Lire la source en entier » vers `/lire/:id`
  (ouvert dans un nouvel onglet) sous le titre, plus l'affichage du nom du média
  s'il est fourni. Le joueur peut donc consulter l'article archivé avant de répondre.
  Aucune dépendance serveur : `source_id` est déjà dans la charge utile.
- **Types** : `ParcoursQuestion` gagne deux champs **facultatifs**
  (`source_media_nom`, `source_url`) — le front se dégrade proprement quand le
  serveur ne les fournit pas (ce qui est le cas aujourd'hui : aucune régression).
- **CSS** : styles du placeholder, du nom de média et du lien « lire » ;
  réorganisation du corps de carte en colonne avec `gap`.

Validé : `npx tsc --noEmit` passe ; rendu vérifié via Playwright (image OK,
placeholder « B » sur image forcée en erreur, lien `/lire/69` correct).

---

## 3. Modèle cible

### 3.1 Posture (éducation populaire)

On apprend en explorant, pas en étant noté. Conséquences de design :

- **Le score n'est pas un verdict.** On affiche une progression (« questions
  explorées ») et, à la fin, un récapitulatif des mécanismes rencontrés plutôt
  qu'une note sèche. Le feedback de chaque question reste l'élément central : le
  « pourquoi » (explication + accès à la source) prime sur le « combien ».
- **La source est toujours accessible en plein** pendant et après la question :
  lire l'article, voir l'image, comprendre le mécanisme sur un cas concret.
- **Souplesse** : ordre librement parcourable, retour arrière, reprise d'une session
  interrompue, possibilité de rejouer.

### 3.2 Plusieurs quiz par grand thème

Cible : pour chaque grand sujet mûr, **un ou plusieurs quiz de 10 à 15 questions**.
D'après l'audit, thèmes prêts ou quasi prêts : Agriculture/pesticides (sujet 13),
Concentration des médias (9), PFAS (11), Désinformation/réseaux (10), Lithium (1).

### 3.3 Modèle de données

Évolution minimale et rétrocompatible des tables `parcours*`.

- **Rattacher un quiz à un sujet** : ajouter `parcours.sujet_id` (FK `sujets.id`,
  nullable pour conserver le parcours « transversal » actuel). Permet « les quiz du
  thème PFAS » et l'entrée par sujet.
- **Plusieurs quiz par sujet** : relation naturelle `1 sujet → N parcours` via le
  `sujet_id` ci-dessus. Pas de table de jointure nécessaire.
- **Métadonnées de quiz** (optionnelles) : `parcours.niveau`
  (`decouverte` / `approfondissement`), `parcours.duree_estimee_min`,
  `parcours.publie` (brouillon vs visible).
- **Garde-fou qualité** : un quiz ne devrait embarquer que des sources « jouables »
  (image **ou** placeholder acceptable + accroche **ou** archive lisible +
  mécanisme attendu). Le placeholder livré en section 2 supprime déjà le besoin
  d'image stricte. Reste à garantir accroche/archive (chantiers data 1 et 5 de
  l'audit). On peut matérialiser ce filtre par une **vue** `sources_jouables` plutôt
  qu'un champ figé.
- **Pas de migration destructrice** : le parcours existant (sujet_id NULL, niveau
  NULL) reste valide.

### 3.4 UX cible

- **Page Parcours** (liste) : regroupement **par sujet** (carte de sujet → ses
  quiz), avec le niveau et le nombre de questions. Conserver une section « Parcours
  transversaux » pour les quiz sans sujet.
- **Session** : sur la carte de question, garder image + titre + média + lien
  « lire » (livrés). Ajouter une barre d'actions souple : « Passer », « Revenir »,
  « Reprendre plus tard ». Le bandeau de progression devient « exploré N/M », sans
  connotation de note.
- **Feedback** : verdict doux + mécanisme attendu + explication + **renvoi vers la
  fiche du mécanisme** (`/mecanismes/...`) et vers la source en plein. C'est le
  moment pédagogique : on explique, on documente, on ouvre.
- **Fin de quiz** : récapitulatif des mécanismes croisés (avec lien fiche),
  proposition d'un quiz voisin du même sujet, et « rejouer ». Pas de classement.
- **Entrée par le sujet** : depuis une page Sujet, un encart « Tester son œil »
  liste les quiz du sujet (cohérent avec l'UX « nav par sujets »).

---

## Inspirations LMS : Moodle/H5P et répétition espacée (Anki)

Sources vérifiées (R1) : la banque de questions Moodle et le tirage aléatoire par
catégorie ([MoodleDocs Building Quiz](https://docs.moodle.org/502/en/Building_Quiz),
[City University guide question bank](https://city-uk-ett.libguides.com/staff/moodle/quiz/questions/random)) ;
les types interactifs H5P ([H5P content types](https://h5p.org/content-types-and-applications)) ;
l'algorithme SM-2 d'Anki ([Anki FAQ algorithme](https://faqs.ankiweb.net/what-spaced-repetition-algorithm),
[RemNote SM-2](https://help.remnote.com/en/articles/6026144-the-anki-sm-2-spaced-repetition-algorithm)).
Le filtre est constant : on retient les **patrons structurants**, on écarte tout ce
qui relève de la note-verdict (score d'examen, classement, réussite/échec).

### A. Banque de questions par thème (patron Moodle)

Dans Moodle, les questions ne vivent pas dans un quiz : elles vivent dans une
**banque** organisée en **catégories**, et chaque quiz **pioche** dans la banque
(questions fixes ou tirage aléatoire de N questions d'une catégorie). Une même
question sert ainsi plusieurs quiz, et chaque passage peut varier.

Transposition À la source, **sans nouvelle table lourde** : notre « banque » existe
déjà, c'est `source_mecanismes` (71 mécanismes posés sur 47 sources). Chaque ligne
`(source_id, mecanisme_id)` **est** une question potentielle : une source réelle dont
on connaît le mécanisme attendu. La « catégorie » Moodle = le **sujet** du thème
(`parcours.sujet_id` proposé en section 3) croisé éventuellement avec la
`categorie` du mécanisme (déjà dans `mecanismes_reference.categorie`).

Conséquence de design :

- **La banque par thème est une vue, pas un stock dupliqué.** Une vue
  `questions_jouables` (qui prolonge `sources_jouables` de la section 3) liste les
  triplets `(source_id, mecanisme_attendu_id, sujet_id)` jouables : source avec
  image-ou-placeholder, accroche ou archive lisible, mécanisme posé. C'est la banque.
- **Plusieurs quiz tirés de la même banque.** Deux modes de constitution d'un
  `parcours`, sans changer la table `parcours_questions` :
  1. **Quiz figé (curaté)** : l'animateur choisit explicitement ses questions
     (l'`INSERT` actuel dans `parcours_questions`). C'est le quiz signé, stable.
  2. **Quiz à tirage** : on ne fige pas les questions, on stocke une **règle de
     tirage** (sujet, nombre de questions, catégories de mécanismes) et on
     matérialise les questions **au démarrage de la session**, en piochant dans la
     banque. Deux passages du même quiz n'ont alors pas exactement les mêmes
     sources : c'est le « random question » de Moodle, qui ici **renouvelle
     l'exploration** plutôt que d'empêcher la triche.
- **Implication données minimale** : pour le tirage, ajouter à `parcours` une
  colonne `mode TEXT DEFAULT 'curate' CHECK(mode IN ('curate','tirage'))` et une
  colonne `regle_tirage JSON` (sujet, n, catégories, exclusions). En mode `tirage`,
  `parcours_questions` n'est pas pré-rempli : c'est la session qui instancie les
  questions tirées (on peut les consigner dans `parcours_reponses` via le
  `question_id` matérialisé, ou tracer le tirage dans la session). Additif, le mode
  `curate` reste le défaut et préserve l'existant.

### B. Variété d'interactions (patron H5P), tamisée éduc pop

H5P offre une **palette modulaire** d'interactions (Question Set, vrai/faux,
glisser-déposer, fill-in-the-blanks, Branching Scenario, Course Presentation). On
n'en reprend que ce qui sert l'esprit critique **sans poser de verdict** :

- **Question Set** = notre format actuel (suite de cartes), à garder comme socle.
- **Glisser-déposer** : associer des **sources à des mécanismes** (ou des extraits à
  des mécanismes). Pédagogiquement plus riche que le QCM, et naturel pour nous
  puisque le geste « source que l'on promène » est déjà l'UX transverse de l'app.
  Réutilise `source_mecanismes` comme corrigé.
- **Vrai/faux nuancé** : « cette source mobilise-t-elle le mécanisme X ? », avec
  l'explication systématique en feedback (jamais un simple bon/faux).
- **Branching Scenario / Lesson à embranchements** : un **parcours d'enquête**
  guidé où le choix oriente la suite (« vous avez repéré un cadrage, voulez-vous
  voir un contre-exemple ou une source du même angle ? »). Forme idéale pour
  enchaîner sources et mécanismes en racontant une démarche, pas en cochant des
  cases. Hors périmètre immédiat (plus lourd côté front), mais c'est la direction
  H5P la plus alignée avec la posture « on explore, on chemine ».

Ligne rouge maintenue : **aucun de ces types ne produit une note-verdict**. Le
glisser-déposer ou le vrai/faux donnent un **retour formatif** (le pourquoi, la
fiche mécanisme, la source en plein), jamais un score d'examen. On reprend la
mécanique d'interaction de H5P, pas sa logique de scoring.

### C. Répétition espacée (patron Anki), recadrée auto-apprentissage

Anki planifie la **réapparition d'une carte** au moment où l'on est sur le point de
l'oublier. Modèle SM-2 minimal par carte : un **intervalle** (en jours), un nombre
de **répétitions réussies**, un **facteur de facilité** (ease, départ 2.5, plancher
1.3) ; à chaque révision, l'intervalle croît (1 j, puis 6 j, puis intervalle ×
ease), et un échec ramène l'intervalle au plus court. La donnée pilotante est la
**date de prochaine révision**.

Transposition À la source : la « carte » n'est **pas** une question d'examen, c'est
un **mécanisme rencontré** (ou un couple source/mécanisme marquant). L'enjeu n'est
pas la performance mémoire mais **ancrer l'esprit critique dans la durée** : revoir
au bon moment les mécanismes déjà croisés pour que l'œil les reconnaisse de
lui-même. Recadrage doctrinal :

- **Pas de note, pas de fail.** Le retour de l'apprenant n'est pas « juste/faux »
  mais « je le reconnais facilement / à revoir bientôt ». On garde l'idée
  d'**intervalle qui s'allonge** quand c'est acquis, sans la sémantique d'échec
  d'Anki (le « repetitions reset à 0 » devient un simple raccourcissement doux).
- **Granularité = le mécanisme**, pas la source précise : on réancre une **grille de
  lecture** (les 25 mécanismes du catalogue), réutilisable sur n'importe quelle
  source. La révision peut donc présenter une **nouvelle** source mobilisant le même
  mécanisme (cohérent avec le tirage en banque du point A).

**Schéma de données additif proposé** (une seule table, hors des tables
`parcours*`, pour ne pas alourdir le quiz existant) :

```sql
-- planification de révision espacée, par personne et par mécanisme
CREATE TABLE IF NOT EXISTS revisions_mecanismes (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  utilisateur_id      INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  mecanisme_id        INTEGER NOT NULL REFERENCES mecanismes_reference(id),
  intervalle_jours    INTEGER NOT NULL DEFAULT 1,   -- 1, 6, puis x facilite
  facilite            REAL    NOT NULL DEFAULT 2.5,  -- ease SM-2, plancher 1.3
  nb_revus            INTEGER NOT NULL DEFAULT 0,    -- compteur de passages
  prochaine_revision  DATE    NOT NULL,             -- la donnee pilotante
  derniere_revision   DATETIME,
  cree_le             DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(utilisateur_id, mecanisme_id)
);
CREATE INDEX IF NOT EXISTS idx_revisions_due
  ON revisions_mecanismes(utilisateur_id, prochaine_revision);
```

- **Une ligne par personne et par mécanisme** rencontré (clé unique). Quand un
  apprenant croise un mécanisme dans un quiz, un atelier ou une fiche, on
  **upsert** la ligne et on programme `prochaine_revision`.
- **Calcul** : à chaque révision, si « reconnu facilement » on allonge
  (`intervalle = round(intervalle * facilite)`, `facilite` ajustée vers le haut) ;
  si « à revoir » on raccourcit (intervalle court, `facilite` vers le bas sans
  passer sous 1.3). Le `prochaine_revision = date(now, +intervalle jours)`.
- **Surface UX** : un encart doux « À réancrer aujourd'hui » (les mécanismes dont
  `prochaine_revision <= aujourd'hui` pour l'utilisateur), qui propose un mini-quiz
  de révision **tiré de la banque** sur ces mécanismes. Jamais de « streak », jamais
  de dette culpabilisante : c'est une invitation, pas une obligation.
- **Lien avec les sessions existantes** : `parcours_reponses` reste la trace
  d'activité ; `revisions_mecanismes` en dérive la planification. On peut alimenter
  l'upsert directement depuis la clôture d'une réponse (le `mecanisme_attendu_id` de
  la question donne le `mecanisme_id` à programmer).

---

## Le quiz comme unité d'apprentissage

Au-delà du quiz, les patrons LMS invitent à penser **toute activité d'À la source
comme une unité d'apprentissage** (façon « learning object ») : un **objectif**
(reconnaître un mécanisme, comprendre un cadrage), un **contenu** (une ou des
sources réelles), une **interaction** (choisir, associer, lire, opposer), et une
**trace de progression non notée** (exploré / rencontré / à réancrer). C'est le pont
avec la note de tunnelisation (`conception-tunnelisation-activites.md` §3.5) :

- Un **atelier terminé** produit des mécanismes (`activite_mecanismes`) : autant de
  cartes candidates à la révision espacée et de questions candidates à la banque.
- Un **dossier mûr** (corpus riche en `source_mecanismes`) est le **gisement** d'un
  quiz thématique (geste « créer un quiz à partir de ce dossier ») et nourrit la
  banque par sujet du point A.
- Un **débunkage** dont la démonstration nomme des mécanismes les fait **remonter**
  dans `source_mecanismes` (boucle à fermer, cf. tunnelisation §3.5) : ils
  alimentent à la fois la banque de questions et la planification de révision.

Vu ainsi, `source_mecanismes` est le **socle commun** des trois briques (banque de
questions, interactions, révision espacée), et les tables `parcours*` +
`revisions_mecanismes` ne sont que des **manières de rejouer** ce socle dans le
temps. Aucune de ces briques ne réintroduit de note : elles tracent un
**cheminement**, conformément à la doctrine epoché de l'app.

---

## Backlog ordonné

1. **[FAIT] Correctif d'affichage des images du quiz** + source lisible (lien
   `/lire/:id`, média, placeholder). Front seul, sûr.
2. **Compléter les accroches des 10 sources du quiz actuel** (toutes vides) et
   archiver les 3 sans texte (sources 78, 90, 166). Chantiers data 1 et 5 de l'audit.
   Lève le « sources illisibles » sur le quiz existant. *Data, semi-auto.*
3. **Schéma : `parcours.sujet_id`** (FK nullable) + champs `niveau`,
   `duree_estimee_min`, `publie`. Migration additive, rétrocompatible. *Serveur/BDD.*
4. **API** : exposer `sujet_id` et `source_media_nom` dans `GET /parcours` et
   `GET /parcours/:id` (le front consomme déjà `source_media_nom` en option) ;
   filtrer la liste par sujet. *Serveur.*
5. **Vue `sources_jouables`** (image-ou-placeholder OK + accroche/archive +
   mécanisme attendu) pour outiller la construction de quiz de qualité. *BDD.*
6. **Front liste Parcours par sujet** + section transversale + niveau/durée.
   *Client (Parcours.tsx).*
7. **Souplesse de session** : passer/revenir, reprise d'une session non terminée,
   rejouer ; bandeau « exploré N/M » au lieu d'un score-verdict. *Client + API
   sessions.*
8. **Feedback enrichi** : lien vers la fiche mécanisme et vers la source en plein
   dans le panneau de correction. *Client.*
9. **Bâtir 2 quiz thématiques pilotes** : Agriculture/pesticides (sujet 13, le plus
   mûr) et PFAS (sujet 11, le plus riche en mécanismes), 10-15 questions chacun,
   après complétion images/accroches du thème. *Contenu + back-office.*
10. **Back-office de création de quiz** par sujet (l'endpoint `POST /parcours`
    existe déjà, réservé animateur/admin ; lui ajouter le rattachement au sujet et un
    sélecteur de sources jouables). *Client admin + serveur.*
11. **Entrée « Tester son œil » depuis la page Sujet**. *Client (Sujet.tsx).*
12. **Récap de fin orienté apprentissage** (mécanismes croisés, quiz voisin,
    rejouer). *Client.*
13. **Vue `questions_jouables`** (banque par thème : triplets source / mécanisme
    attendu / sujet jouables) au-dessus de `source_mecanismes`. Socle des quiz à
    tirage. *BDD (patron Moodle, cf. section Inspirations LMS).*
14. **Quiz à tirage** : `parcours.mode` (`curate` / `tirage`) + `parcours.regle_tirage`
    (JSON : sujet, nombre, catégories de mécanismes) ; instanciation des questions au
    démarrage de session depuis la banque. Additif, `curate` reste le défaut.
    *Serveur/BDD + Client.*
15. **Interaction glisser-déposer** (associer source ↔ mécanisme) en plus du QCM,
    réutilise le geste « source qu'on promène » et `source_mecanismes` comme corrigé.
    *Client (patron H5P, retour formatif sans note).*
16. **Révision espacée** : table additive `revisions_mecanismes` (par personne et par
    mécanisme : intervalle, facilité, prochaine révision), upsert à la clôture d'une
    réponse, encart doux « À réancrer aujourd'hui » proposant un mini-quiz tiré de la
    banque. Recadrage auto-apprentissage, jamais de streak ni de fail. *BDD + Serveur
    + Client (patron Anki/SM-2).*
