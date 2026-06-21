# Dossier vs Débunkage — modèle d'activité (conception 2026-06-21)

Note de conception (hors code, R19). Elle clarifie deux types d'activité du socle `activites` (atelier, dossier, decryptage, debunkage, parcours, arpentage) qui se recouvrent et restent quasi inexploités : le **dossier** et le **débunkage**. Elle s'appuie sur l'audit BDD du 2026-06-21 (`docs/audit-bdd-2026-06-21.md`), sur la doctrine « décrire, ne pas noter » du socle, et sur une étude d'Acrimed et d'analogues. Aucune ligne de code n'est écrite ici : le livrable est un cadre et un backlog à valider.

Notes de conception du vault qui font foi en amont : « À la source — Conception v3 — Refonte par sujets », « — Observatoire et thèmes », « — Débunkage et relais site », « — Cycle de vie de l'atelier », et « GroundNews — analyse et conséquences pour À la source » (Engagements/Rouge Coquelicot/À la source/).

---

## 1. Le problème, en deux faits d'audit

1. **27 sujets existent, aucun n'est relié à une activité** ni doté d'image ou de `description_md`. La porte d'entrée v3 (le Sujet) est posée mais vide de vie : on a une bibliothèque de thèmes sans rien dessus.
2. **Le socle activités est inerte** : 5 activités (4 ateliers, 1 dossier « Test »), tables `debunkage_pipeline` et `arpentage_*` vides, aucune source avec `role` pour/contre, aucune activité avec `sujet_id`. Le dossier et le débunkage n'existent qu'en schéma.

La conséquence pratique : la matière (162 sources, archives, 71 mécanismes posés sur 47 sources) est là, mais aucun **format de sortie durable** ne la met en perspective. Le dossier et le débunkage sont précisément ces deux formats. Il faut les définir nettement avant de les coder.

---

## 2. Définition nette des deux types (et de leurs voisins)

On distingue par quatre traits : **finalité**, **durée de vie**, **forme de sortie**, **posture d'éducation populaire**.

### Dossier — collectionner des sources sur un thème, dans la durée

| Trait | Dossier |
|---|---|
| **Finalité** | Mettre en perspective un thème : rassembler dans le temps les sources qui l'éclairent, montrer comment un sujet est couvert (qui en parle, avec quels cadrages, quelles absences), construire une compréhension d'ensemble. |
| **Durée de vie** | **Durable, vivant.** Un dossier n'est jamais « fini » : il s'enrichit à mesure que la veille apporte des sources. C'est un fond de rayon, pas un coup. |
| **Forme de sortie** | Une **page** : `mise_en_perspective_md` (le fil rouge, la lecture critique) + `contenu_md` + un **corpus de sources collectionnées** (cartes, ordonnées). Page publique partageable (`/partage/dossier/:id`) et export YesWiki déjà branchés. |
| **Posture éduc pop** | **Conscientisation par accumulation et structuration.** On ne dénonce pas, on donne à voir une structure (concentration des médias, récurrence d'un cadrage). Le lecteur chemine dans un corpus organisé. |

Le dossier est le **frère éditorial du Sujet** : le Sujet est le thème (l'étiquette, la couverture brute, ouvert à tous) ; le dossier est le **propos construit sur ce thème** (une mise en perspective signée, validée). Un sujet peut porter zéro, un ou plusieurs dossiers (ex. un dossier « fond » + un décryptage « à chaud »).

### Débunkage — démonter une affirmation ciblée

| Trait | Débunkage |
|---|---|
| **Finalité** | Réfuter **une affirmation précise** (une infox, une affirmation trompeuse) de façon sourcée et pédagogique. Objet ponctuel et borné, pas un panorama. |
| **Durée de vie** | **Ponctuel.** Un débunkage répond à une affirmation à un moment donné ; une fois publié, il est figé (l'affirmation et sa réfutation ne bougent plus). |
| **Forme de sortie** | Un **post réseau social** (Instagram, Facebook), dont on **consigne les liens** (`debunkage_posts`). L'app est le lieu de **préparation et de consignation**, pas de publication. Relais site optionnel (page autoportante, cf. note « Débunkage et relais site »). |
| **Posture éduc pop** | **Outillage à la réfutation.** On muscle l'argumentaire militant : affirmation visée + sources **pour/contre** opposées + démonstration courte nommant les mécanismes en jeu. C'est faire chercher l'adhérent (composer son corpus contradictoire), pas asséner un verdict d'autorité. |

### Décryptage à chaud — un dossier daté sur un événement (pas un type distinct)

Acté et déjà modélisé : le décryptage n'est **pas** un type à part. C'est un **dossier** avec `a_chaud = 1` et un `evenement_id`. Même structure (`dossier_contenu`), même page, mais déclenché par un fait d'actualité et signalé comme tel. Garder ce choix : il évite un quatrième pipeline et reflète la réalité (un décryptage est une mise en perspective rapide d'un événement, soit exactement un dossier court et daté).

### Frontières et recouvrements (le point qui prête à confusion)

- **Dossier vs Débunkage** : le dossier **collectionne et met en perspective** (ouvert, durable, neutre dans la collecte) ; le débunkage **oppose et tranche** sur un point (borné, ponctuel, argumentatif). Test pratique : si la sortie naturelle est « une page de fond qu'on enrichira », c'est un dossier ; si c'est « un post qui dit que telle affirmation est trompeuse, voici pourquoi », c'est un débunkage.
- **Dossier vs Sujet** : le Sujet est le **thème ouvert** (tout membre rattache des sources, couverture brute) ; le dossier est le **propos éditorial validé** sur ce thème. Un dossier s'**adosse à un sujet** (voir §4).
- **Dossier vs Atelier** : l'atelier est une **séance** (epoché, carte nue, déroulé en présentiel) ; le dossier est un **livrable écrit** consultable hors séance. Un atelier peut nourrir un dossier (ses observations remontent), l'inverse aussi (un dossier sert de support d'atelier).
- **Recouvrement assumé** : un débunkage **se mène sur un thème** et peut être listé dans le dossier de ce thème comme une de ses pièces. Le rôle pour/contre des sources est le seul trait de données qui sépare nettement un débunkage d'un dossier (un dossier collectionne sans opposer ; un débunkage oppose).

---

## 3. Ce qu'Acrimed et les analogues font de bien (vérifié)

Positionnement maison rappelé (note Observatoire) : on décrit l'app par ses fonctions, **jamais** par référence à un concurrent ; la seule référence **assumée et alliée** est **Acrimed**.

### Acrimed (acrimed.org) — l'allié de référence

Acrimed, association de 1996, observatoire militant des médias dans la tradition de l'éducation populaire critique. Patrons concrets observés (navigation du site et note vault « Acrimed — Observatoire critique des médias ») :

- **Dossiers thématiques durables, mis à jour** : « Médias et mouvements sociaux » (dossier permanent), « Les médias et les élections » (réactivé avant chaque scrutin), « La concentration de la presse ». Patron à reprendre : le dossier est un **fond vivant** qu'on rouvre et complète, pas un article figé. C'est exactement notre `dossier` durable.
- **Infographie « Médias français : qui possède quoi ? »** : la cartographie de la propriété comme pièce maîtresse pédagogique. Patron à reprendre : adosser le dossier « propriété et concentration des médias » (sujet 9, 14 sources déjà) à nos champs `medias.proprietaire / actionnaire_ultime / type_propriete`. L'audit montre que ces champs sont massivement vides (102 sans `type_propriete`) : les remplir **fait** ce dossier.
- **Distinction structure vs fait ponctuel** : Acrimed analyse des **structures** (qui possède, quelle logique d'audience) plutôt que de vérifier des faits isolés. C'est la justification de notre **dossier** (structure, durable) face au **débunkage** (fait/affirmation, ponctuel). Les deux postures sont complémentaires, pas concurrentes.
- **Formats courts réutilisables** : décryptages de matinales et de JT, brèves, analyses. Patron : prévoir un dossier « léger » (le décryptage à chaud) à côté du dossier de fond, ce que `a_chaud` permet déjà.
- **Positionnement nommé** : Acrimed assume son ancrage à gauche et le **nomme** ; sa limite reconnue est l'angle mort sur les médias alternatifs. À reprendre comme principe : un dossier doit **nommer son point de vue** (provenance, parti pris) plutôt que feindre la neutralité.

### Arrêt sur images (arretsurimages.net) — le décryptage comparé

Site professionnel d'analyse des médias (2008, suite de l'émission de D. Schneidermann). Rubriques : Actualités, Émissions, Chroniques ; formats articles, chroniques, émissions de décryptage. Cœur de méthode vérifié : **l'analyse critique de la présentation d'une même information par des médias différents** (mise en regard). Patron à reprendre : le **décryptage à chaud** comme mise en regard d'un même fait à travers plusieurs traitements, ce que nos `evenements` + couverture multisource permettent déjà.

### GroundNews — la comparaison de couverture (déjà digérée)

Retenu (note GroundNews) : la **comparaison de couverture** (un fait, plusieurs traitements) est le geste pédagogique le plus fort et **ne nécessite aucune notation tierce** ; l'**ownership** est la donnée la plus solide. Écarté : l'axe gauche-droite à l'américaine, et **toute note synthétique bon/mauvais** par média (piège Decodex, route `confiance` à refondre). Le dossier hérite de ce geste : il **donne à voir** la couverture, il ne note pas.

### AFP Factuel (fact-checkers) — pour le débunkage uniquement

AFP Factuel sélectionne **les affirmations virales et potentiellement nuisibles** vérifiables, puis affiche un verdict en capitales (FAUX, EXAGÉRÉ, TROMPEUR, EXPLICATIONS) et **raconte comment la vérification a été menée**. Deux patrons pour notre débunkage :

- **Critère de sélection** : on ne débunke pas tout, on cible une affirmation **précise, circulante et nuisible** (le `affirmation_visee_md` doit être une citation nette, pas un thème).
- **Montrer la démarche, pas seulement le résultat** : reprendre l'affirmation initiale et **dérouler le raisonnement sourcé**. Notre `demonstration_md` + sources pour/contre fait cela.

Différence à tenir avec notre doctrine : AFP **tranche par un verdict-mention**. À la source garde sa **doctrine epoché** au vivier et en atelier (carte nue, pas de score-verdict sur les sources). Le débunkage est la **seule** activité où l'on assume une conclusion (« cette affirmation est trompeuse »), parce qu'on porte sur **une affirmation**, jamais sur **un média**. La ligne rouge reste : on ne colle pas de verdict bon/mauvais à un **organe de presse**.

---

## 4. Recommandations modèle de données et UX (au vu de l'audit)

Le schéma actuel est **suffisant pour démarrer** (tables `dossier_contenu`, `debunkage_pipeline`, `debunkage_posts`, `activite_sources.role`, `CorpusDnD` existent). Les recommandations portent surtout sur **l'exploitation** de l'existant, plus quelques évolutions ciblées.

### 4.1 Adosser tout dossier (et débunkage) à un sujet

`activites.sujet_id` existe et est **NULL partout**. Recommandation forte : pour un **dossier** et un **décryptage**, rendre `sujet_id` **fortement attendu** (proposé d'office à la création, modifiable). Bénéfices immédiats au vu de l'audit :

- Les 27 sujets cessent d'être des coquilles vides : ils affichent enfin « N activités » (la requête `nb_activites` retournera autre chose que 0).
- La page Sujet devient vivante (mix dossier de fond + décryptages à chaud + débunkages), ce que la v3 vise.
- Pour l'**atelier**, garder `sujet_id` **nullable** (un atelier traverse plusieurs sujets, doctrine confirmée). La contrainte d'adossement ne vaut que pour dossier/décryptage/débunkage.

Geste concret : amorcer 2 ou 3 dossiers réels sur les sujets les plus mûrs identifiés par l'audit (Agriculture/pesticides — sujet 13, le plus mûr ; Propriété/concentration des médias — sujet 9 ; PFAS — sujet 11), pour remplir le socle et tester le format de bout en bout.

### 4.2 Le dossier « collectionne » via le corpus existant (CorpusDnD)

Le glisser-déposer de corpus est **déjà** en place pour Dossier, Débunkage, Sujet et Atelier (`activite_sources` + `PATCH .../sources/order` + `CorpusDnD`). Donc « collectionner des sources dans un dossier » est **déjà faisable** techniquement. Ce qui manque est UX et alimentation :

- **Rattachement depuis la lecture** : le bouton « Dossier » sur `Lire.tsx` existe (CHANGELOG 20/06). Le généraliser comme geste premier : depuis n'importe quelle carte de veille, « ranger dans un dossier ». C'est le parcours d'accumulation d'Acrimed (un dossier grandit au fil de la veille).
- **Distinguer collectionner (dossier) de opposer (débunkage)** dans l'UI : dans un dossier, le corpus est **ordonné mais sans rôle pour/contre** (mise en perspective) ; dans un débunkage, le sélecteur **pour/contre** est central. Même socle `CorpusDnD`, `renderExtra` différent (déjà prévu par le slot). Ne pas afficher le sélecteur de rôle dans le dossier : c'est ce qui sépare visuellement les deux types.

### 4.3 Cycle de vie : brouillon → publié → archive, partout

`activites.statut` est libre (TEXT sans CHECK), et les pipelines ont leur propre `statut`. Recommandation : **unifier** le cycle sur `activites.statut` avec un jeu commun `brouillon | publie | archive`, le décryptage ajoutant le seul marqueur `a_chaud` (pas un statut). Raisons :

- La **publication est le déclencheur** des effets de bord déjà codés : page publique `/partage/...` rendue **si publié**, notification Discord **à la transition vers publié** (garde anti-doublon). Un statut unique et fiable est le pivot de ces gardes.
- Le débunkage publié est **figé** (ponctuel) ; le dossier publié reste **éditable** (durable) et peut repasser des sources en plus sans changer de statut. Le statut encode donc la **visibilité**, pas la fin de vie du dossier.
- Garde-fou éditorial (note relais) : la transition vers `publie` reste un **geste humain** d'un animateur (sortie publique militante), jamais automatique.

### 4.4 Articulation avec le quiz et la veille

- **Veille → dossier** : la veille est le substrat ; le dossier est sa cristallisation thématique. Brancher l'alimentation (4.2) ferme la boucle veille → sujet → dossier.
- **Dossier/débunkage → quiz** : un dossier mûr (corpus avec mécanismes posés) est le **gisement naturel d'un quiz thématique**. L'audit identifie Agriculture/pesticides et PFAS comme les plus riches en mécanismes : un dossier sur ces thèmes peut **engendrer** un parcours quiz ciblé (aujourd'hui le quiz unique est trans-thème et bancal, 10/10 sources sans accroche). Recommandation : à terme, proposer « créer un quiz à partir de ce dossier » (réutilise `source_mecanismes` du corpus). Hors périmètre immédiat, mais c'est la bonne articulation.
- **Débunkage → Apprendre** : les mécanismes nommés dans une démonstration de débunkage devraient **remonter au socle** (`source_mecanismes`) et donc alimenter les fiches « exemples réels » d'Apprendre (mécanisme déjà auto-alimentée). À vérifier que le pipeline débunkage écrit bien dans `source_mecanismes`.

### 4.5 Évolutions de données précises (ciblées, non urgentes)

- **`dossier_contenu`** : suffisant. Optionnel — un champ `provenance` (déjà présent sur `sujets`) ou une convention pour **nommer le point de vue** du dossier (patron Acrimed « positionnement nommé »).
- **`debunkage_pipeline`** : ajouter à terme le suivi de relais site (`debunkage_relais` proposé dans la note dédiée : cible, stratégie, url_page) plutôt que le seul booléen `relaye_site`. À trancher avec les 4 questions de la note « Débunkage et relais site » (cible une ou deux, source canonique, déclenchement manuel, niveau de contenu).
- **Nettoyage préalable** (audit §4) : supprimer le dossier « Test » (id 8) et l'atelier vide #1 (id 1) avant d'amorcer les vrais dossiers, pour ne pas polluer les compteurs.

---

## 5. Prochaines actions de dev (backlog ordonné, à valider)

Ordonné par rapport impact/effort. Rien n'est codé tant que Guillaume n'a pas validé.

1. **Nettoyer les activités fantômes** : supprimer le dossier « Test » (id 8) et l'atelier vide (id 1). Geste manuel prudent. *(prérequis propreté)*
2. **Amorcer 2-3 dossiers réels adossés à un sujet** : Agriculture/pesticides (sujet 13), Propriété/concentration des médias (sujet 9), PFAS (sujet 11). Renseigner `sujet_id`, `mise_en_perspective_md`, et collectionner leur corpus via CorpusDnD. Donne vie aux sujets et teste le format. *(impact maximal)*
3. **Adossement sujet à la création** d'un dossier/décryptage/débunkage : proposer `sujet_id` d'office (modifiable), nullable seulement pour l'atelier. Faire apparaître « N activités » sur les cartes-sujets. *(débloque la page Sujet vivante)*
4. **Différencier l'UI dossier vs débunkage** sur le socle CorpusDnD : dossier = corpus ordonné sans rôle ; débunkage = sélecteur pour/contre central. *(clarifie la frontière côté usage)*
5. **Généraliser « ranger dans un dossier »** depuis toute carte de veille et la lecture (parcours d'accumulation type Acrimed). *(alimente les dossiers en continu)*
6. **Unifier le cycle de vie** `brouillon | publie | archive` sur `activites.statut` (CHECK), le décryptage portant `a_chaud` ; vérifier que les gardes page publique + notif Discord s'appuient dessus ; publication = geste humain animateur. *(fiabilise les sorties publiques)*
7. **Premier dossier « propriété des médias »** branché sur les champs `medias` (proprietaire/type_propriete) + remplissage progressif de ces champs (audit : ~100 vides) à partir de la carte Acrimed « qui possède quoi ». *(fait exister le sujet phare)*
8. **Décryptage à chaud pilote** : un dossier `a_chaud=1` + `evenement_id` sur un fait récent, mise en regard de plusieurs traitements (réutilise couverture multisource). Valide le format léger. *(prouve le décryptage sans nouveau pipeline)*
9. **Vérifier la remontée mécanismes** d'un débunkage vers `source_mecanismes` (alimentation des fiches Apprendre). *(boucle pédagogique)*
10. **À terme — « créer un quiz depuis un dossier »** sur les dossiers riches en mécanismes (Agriculture/pesticides, PFAS) ; et trancher le relais site débunkage (4 questions de la note dédiée, table `debunkage_relais`). *(évolutions, après validation des fondations)*

---

> Statut : brouillon de conception, à amender. Aucune ligne de code avant arbitrage. Le schéma existant suffit pour les actions 1 à 9 ; seules les actions 10 supposent des évolutions de données à décider.
