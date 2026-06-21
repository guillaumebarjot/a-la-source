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
