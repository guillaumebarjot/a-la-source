# Tunnelisation des activités (conception 2026-06-21)

Note de conception (hors code, R19). Elle définit le **tunnel** (funnel) commun par lequel passe une activité d'« À la source », de l'amorce (une source soumise, un thème, un événement) jusqu'à la diffusion (page publique, export YesWiki, notif Discord, réemploi pédagogique). Elle prolonge et confronte la note « Dossier vs Débunkage » (`docs/conception-activites-dossier-debunkage.md`, agent 1) et s'appuie sur l'audit BDD du jour (`docs/audit-bdd-2026-06-21.md`) et sur le **code réel** (server/src/routes/{ateliers,dossiers,debunkages,arpentage,partage,parcours,sources}.ts, server/src/db/schema.sql, server/src/discord/ingestion.ts). Aucune ligne de code n'est écrite ici. Doctrine maintenue : **décrire, ne pas noter** (epoché) ; jamais de score-verdict sur un média ; les conditions de passage d'étape sont **factuelles** (présence d'un champ, d'un corpus, d'un lien), jamais un jugement de qualité automatique.

---

## 1. État réel du tunnel aujourd'hui (constat de code)

Ce que le code fait déjà, qu'il faut nommer et unifier plutôt que réinventer :

- **Socle `activites`** : `statut TEXT NOT NULL DEFAULT 'brouillon'`, **sans CHECK**. Chaque type s'en sert différemment :
  - **atelier** porte son cycle sur `activites.statut` : `preparation → pret → en_cours → termine` (CHECK historique côté table legacy `ateliers`, mais libre sur `activites`). Pas de `publie`, pas de page publique.
  - **dossier / débunkage / arpentage** naissent en `brouillon` et passent à `publie` via une route `POST /:id/publier`.
- **Double statut** pour débunkage : `activites.statut` **et** `debunkage_pipeline.statut`. La page publique `/partage/debunkage/:id` rend si **l'un OU l'autre** vaut `publie` (tolérant mais ambigu). Le dossier, lui, ne regarde que `activites.statut`. L'arpentage n'a **pas** de route `publier` ni de page partage.
- **Publication = effet de bord** déjà câblé : `POST /:id/publier` rend la page `/partage/...` accessible **et** appelle `notifierPublication` (Discord) avec une **garde anti-doublon** (`if statut !== 'publie'`). C'est donc déjà la transition pivot.
- **Corpus unifié** : `activite_sources(activite_id, source_id, ordre, role, note)` + `PATCH /:id/sources/order` (DnD) servent les quatre types. Seul le `role` (pour/contre) distingue un débunkage d'un dossier ; l'atelier n'utilise pas `role`.
- **Point d'entrée amont** : ingestion Discord insère `origine='discord', a_qualifier=1` ; `GET /sources/inbox` liste l'inbox ; `POST /sources/:id/qualifier {statut}` route vers `veille|vivier|atelier|archive` ; `POST /sources/:id/rejeter` classe en `archive` sans détruire. **C'est la bouche du tunnel commune à toutes les activités.**
- **Quiz** (`parcours*`) est **découplé** des activités : il se construit à part (animateur), pioche des `sources` + un `mecanisme_attendu_id`, et s'alimente du stock `source_mecanismes`. Aucun lien `activite → parcours` aujourd'hui.

Conséquence : le tunnel **existe en pièces détachées** mais n'est ni unifié, ni rendu visible à l'animateur. Le travail de conception est de poser un **fil conducteur commun** par-dessus l'existant, sans casser les API.

---

## 2. Le tunnel générique (états communs sur `activites.statut`)

Toutes les activités partagent **trois macro-états de visibilité** sur `activites.statut`, plus un marqueur transverse. Les étapes *internes* (le déroulé métier) vivent dans les extensions de pipeline et ne sont pas des statuts : ce sont des **jalons de complétude** que l'UI calcule et affiche.

Macro-états communs (la colonne vertébrale, à terme sous CHECK) :

```
  amorce            travail              diffusion            fin de vie
 (entrée)                                (sortie)
[brouillon] ───────────────────────► [publie] ──────────────► [archive]
     ▲   │                              │  ▲                       │
     │   └── retour arrière libre ◄─────┘  │                       │
     └──────────── ré-ouverture (dossier vivant) ◄────────────────┘

marqueur transverse : a_chaud (dossier/décryptage)   — pas un statut
```

- **brouillon** : l'activité se construit (corpus, contenu, démonstration, fragments). Tout est éditable, rien n'est public.
- **publie** : transition **toujours humaine** (geste animateur, R éducation populaire = sortie collective assumée). Déclenche page publique `/partage/...` + notif Discord (garde anti-doublon déjà codée). Un **dossier** reste éditable après publication (fond vivant) ; un **débunkage** est figé (objet ponctuel) ; un **atelier** n'a pas de sortie publique (voir §3.1).
- **archive** : retiré de la vie courante, conservé. Réversible.
- **a_chaud** (colonne `dossier_contenu.a_chaud`) : marque un dossier daté sur un événement (décryptage). Ce n'est **pas** un état de visibilité, c'est une facette, conformément à l'agent 1.

Règle d'unification recommandée (sans casser l'existant) : faire de `activites.statut` la **source de vérité unique** de la visibilité (`brouillon | publie | archive`), et **déprécier `debunkage_pipeline.statut`** comme miroir (le garder écrit pour rétrocompat, mais la page `/partage` et les compteurs ne lisent QUE `activites.statut`). L'atelier conserve son cycle logistique propre (`preparation | pret | en_cours | termine`) qui est orthogonal : pour l'atelier, `termine` joue le rôle de `publie` interne (il n'a pas de page publique).

**Conditions de passage (factuelles, jamais un verdict)** : le passage `brouillon → publie` n'est **jamais bloqué** par un score. L'UI affiche une **checklist douce** (« il manque la mise en perspective », « 0 source au corpus ») mais laisse publier : l'animateur reste souverain. La seule garde dure est l'anti-doublon de notif déjà en place.

---

## 3. Tunnels propres par type

Chaque type a un **déroulé interne** (jalons de complétude) qui se superpose aux trois macro-états. Les jalons sont déduits des données présentes, pas stockés comme statuts.

### 3.1 Atelier — la séance (entrée : vivier ; sortie : restitution interne, pas de page publique)

```
[preparation] ──► [pret] ──► [en_cours] ──► [termine]
   │ vivier         │ corpus    │ séance        │ synthèse
   │ → corpus       │ figé +    │ présentielle  │ (mécanismes,
   │ (activite_     │ profil de │ (fiches       │ observations,
   │  sources)      │ diversité │ imprimées,    │ questions
   │                │ consulté  │ /print)       │ restantes)
   └────────── retours arrière libres (rajouter/retirer une source) ──────────┘
```

- **Jalons de complétude factuels** : (a) corpus non vide ; (b) profil de diversité consulté (`GET /:id/diversite`, alerte douce si un axe est faible, jamais bloquant) ; (c) source choisie pour la séance ; (d) synthèse saisie (mécanismes via `activite_mecanismes`, `observations_surprise`, `questions_restantes`).
- **Entrée** : depuis le **vivier** (sources `statut='vivier'`), DnD dans le corpus. Une source soumise via Discord arrive d'abord en inbox, est qualifiée `vivier`, puis entre dans un atelier.
- **Sortie / diffusion** : l'atelier **ne se publie pas** en page publique. Sa diffusion est interne (fiche imprimable `/print`) et **différée** : ses observations et mécanismes **remontent** et peuvent nourrir un dossier (même sujet) ou un quiz. Recommandation : ajouter un geste « verser cet atelier dans un dossier » (préremplit la mise en perspective avec les `questions_restantes` et le corpus).
- **a_chaud** : sans objet.

### 3.2 Dossier — le fond vivant (entrée : un thème/sujet ; sortie : page + YesWiki + Discord)

```
[brouillon] ─────────────────────────────────► [publie] ⇄ (reste éditable)
  amorce        mise en           corpus            publication        enrichissement
  sujet_id  ►   perspective_md ►  collectionné   ►  (page /partage/    continu (fond
  (attendu)     (le fil rouge)    (activite_         dossier/:id +      de rayon : on
                                  sources,           YesWiki + notif)   rajoute des
                                  ordonné,                              sources sans
                                  SANS rôle)                            dé-publier)
```

- **Jalons factuels** : (a) `sujet_id` renseigné (fortement attendu, cf. agent 1 §4.1) ; (b) `mise_en_perspective_md` non vide ; (c) au moins une source au corpus. Aucun n'est bloquant pour publier.
- **Spécificité** : corpus **ordonné mais sans `role`** (on collectionne, on ne tranche pas). Publié, il **reste éditable** : la transition ne fige rien, elle rend visible. C'est le seul type qui boucle `publie → (édition) → publie` sans nouvelle transition.
- **Décryptage à chaud** = ce même tunnel avec `a_chaud=1` + `evenement_id`. Pas un quatrième pipeline (choix de l'agent 1 confirmé par le code : `dossier_contenu` porte déjà les deux champs). Entrée typique : un **événement** (`evenements`) déclenche un dossier court et daté.

### 3.3 Débunkage — l'objet ponctuel (entrée : une affirmation ; sortie : posts + page + Discord)

```
[brouillon] ───────────────────────────────────────────► [publie] (figé)
  affirmation_    démonstration_   corpus pour/contre      consignation des
  visee_md     ►  md            ►  (activite_sources       posts (debunkage_
  (citation       (le raisonne-    avec role 'pour'/       posts) + page
   nette)         ment sourcé)     'contre', central)      /partage/debunkage
                                                           + YesWiki + Discord
```

- **Jalons factuels** : (a) `affirmation_visee_md` (une citation précise, pas un thème) ; (b) `demonstration_md` ; (c) au moins une source avec `role` opposé (le sélecteur pour/contre est l'UI centrale, ce qui le distingue visuellement du dossier) ; (d) au moins un post consigné (peut venir après publication : l'app prépare et consigne, elle ne publie pas sur les réseaux).
- **Spécificité doctrinale** : c'est la **seule** activité où l'on assume une conclusion (« cette affirmation est trompeuse »), parce qu'on porte sur **une affirmation**, jamais sur **un organe de presse**. Publié = **figé** (objet daté).
- **Dette à solder** : unifier le double statut (cf. §2) pour que `/partage/debunkage` et les compteurs lisent `activites.statut` seul.

### 3.4 Arpentage — la lecture collective (entrée : un document long ; sortie : synthèse ; publication à brancher)

```
[brouillon] ──────────────────────────────────────────► [publie] (à créer)
  source +       fragments          restitutions par         synthese_md
  mode_     ►    (découpage,    ►   lecteur (points clés, ►   collective
  decoupage      attribués)         citation, question,       (puis page
                                    mécanisme repéré)         /partage à créer)
```

- **Jalons factuels** : (a) source + mode de découpage ; (b) fragments créés et attribués ; (c) restitutions collectées ; (d) `synthese_md` rédigée.
- **Manques de code à combler** : pas de route `POST /:id/publier`, pas de page `/partage/arpentage/:id`, pas d'export YesWiki. À aligner sur le patron dossier (page publique + notif + export) si l'on veut une diffusion. Sinon, l'arpentage reste une **activité interne** (comme l'atelier) dont la synthèse **alimente un dossier**.

### 3.5 Parcours / quiz — la sortie pédagogique (entrée : un stock de mécanismes ; sortie : jeu rejouable)

Le parcours **n'est pas dans `activites`** : c'est une famille `parcours*` adossée à `source_mecanismes` et `mecanismes_reference`. Son « tunnel » :

```
[création animateur] ──► [questions = sources + mécanisme attendu] ──► [jouable]
  pioche de sources         carte-source NUE (image+titre+chapo,           sessions +
  ayant un mécanisme        AUCUN indice du mécanisme : epoché)            réponses
  identifié (stock 71)                                                     enregistrées
```

- **Articulation recommandée** (cf. agent 1 §4.4, non urgente) : un **dossier mûr** (corpus riche en `source_mecanismes`) devient le **gisement naturel** d'un quiz thématique. Geste futur « créer un quiz à partir de ce dossier » : préremplir `parcours_questions` avec les sources du corpus portant un mécanisme. C'est l'**articulation activité → quiz** manquante.
- **Boucle débunkage → Apprendre** : vérifier que les mécanismes nommés dans une démonstration de débunkage **remontent** à `source_mecanismes` (ils alimentent alors le vivier de questions). Aujourd'hui le pipeline débunkage écrit `demonstration_md` en texte libre, **pas** dans `source_mecanismes` : c'est la fuite à corriger pour fermer la boucle.

---

## 4. Recommandations UX (le fil conducteur)

Le besoin central : que l'animateur sache **toujours où il en est et quelle est la prochaine action**, sans être enfermé.

1. **Barre d'étapes (stepper) en tête de chaque activité.** Une barre horizontale qui matérialise le tunnel propre du type (les jalons de §3), avec l'étape courante surlignée. Les jalons franchis (corpus non vide, perspective saisie...) s'allument en vert **factuellement** (présence de donnée), jamais selon un score. Cliquable : on peut sauter en arrière. Implication données : aucune nouvelle table ; un endpoint léger `GET /api/<type>/:id` renvoie déjà tout le nécessaire, il suffit de **calculer les booléens de jalon côté serveur** (ex. `a_mise_en_perspective`, `a_corpus`, `a_role_oppose`) et de les exposer dans la réponse de détail.

2. **Encart « Prochaine action » contextuel.** Sous le stepper, une phrase unique : « Prochaine étape : ajouter une source pour/contre » avec le bouton qui va bien. Calculé à partir du **premier jalon non franchi**. C'est le coeur du guidage (démarche d'enquête : on accompagne le cheminement, du concret vers la mise en perspective).

3. **Souplesse assumée.** Aucun jalon n'est bloquant ; la barre est un **fil conducteur, pas un rail**. Retours arrière libres (déjà vrai en base : tout est en UPDATE COALESCE). Le seul geste « lourd » est **Publier**, présenté comme une décision (modale « cette activité deviendra publique et sera annoncée sur Discord »).

4. **Bouche du tunnel visible : l'inbox.** Généraliser le geste « ranger / amorcer depuis une source » (le bouton « Dossier » de `Lire.tsx` existe déjà, CHANGELOG 20/06) : depuis l'inbox (`a_qualifier=1`) ou toute carte de veille, proposer **« amorcer un débunkage »**, **« ranger dans un dossier »**, **« mettre au vivier d'un atelier »**. Implication routes : réutiliser `POST /<type>` (création) + `POST /<type>/:id/sources`. Aucune route nouvelle.

5. **Unifier la visibilité sur `activites.statut`** (cf. §2) : poser un CHECK `brouillon|publie|archive`, faire lire ce seul champ par `/partage` et les compteurs de sujet, déprécier le miroir `debunkage_pipeline.statut`. Brancher l'arpentage sur le même patron `publier` si on veut sa diffusion. Implication : une **migration additive** (auto-migrate.ts) + retouche de `partage.ts` et `debunkages.ts`. Sans cela, le « publié » reste à deux endroits et les gardes Discord se fragilisent.

6. **Marqueur d'entrée tracé.** `sources.origine` (`web|discord|import`) et `evenement_id` existent : afficher d'où vient l'amorce (« source Discord du 18/06 », « événement : ... ») en tête de l'activité, pour que le fil conducteur raconte aussi **l'origine**, pas seulement la suite.

---

## 5. Backlog ordonné pour Guillaume

Ordonné par rapport impact/effort. Rien n'est codé tant que ce n'est pas validé. Les actions 1-4 sont du pur affichage (zéro risque données) ; 5-7 touchent la donnée (migration additive) ; 8-10 sont des évolutions.

1. **Calculer et exposer les jalons de complétude** dans la réponse `GET /api/{ateliers,dossiers,debunkages,arpentages}/:id` (booléens factuels). *Socle du fil conducteur, aucune migration.*
2. **Stepper + encart « Prochaine action »** par type (composant React commun paramétré par le tunnel du type, §3). *Le guidage visible, réutilise 1.*
3. **Généraliser l'amorce depuis l'inbox / la veille** : menu « amorcer un débunkage | ranger dans un dossier | verser au vivier » sur chaque carte source. *Ouvre la bouche du tunnel, réutilise les routes existantes.*
4. **Modale de publication** unifiée (rappel : public + notif Discord) sur les routes `/publier` existantes. *Rend la transition pivot consciente et souveraine.*
5. **Unifier la visibilité sur `activites.statut`** : CHECK `brouillon|publie|archive` (migration additive), `/partage` et compteurs lisent ce seul champ, déprécier `debunkage_pipeline.statut`. *Fiabilise les sorties publiques et les gardes Discord.*
6. **Brancher l'arpentage sur le patron de diffusion** : route `POST /arpentages/:id/publier`, page `/partage/arpentage/:id`, export YesWiki, notif Discord — OU acter qu'il reste interne (synthèse versée dans un dossier). *À trancher.*
7. **Fermer la boucle mécanismes** : que la démonstration d'un débunkage écrive dans `source_mecanismes` (et l'atelier via `activite_mecanismes` → `source_mecanismes`), pour alimenter le vivier de questions du quiz. *Boucle pédagogique.*
8. **Geste « verser dans un dossier »** depuis un atelier terminé et depuis un arpentage (préremplit perspective + corpus). *Articulation entre activités internes et fond durable.*
9. **Geste « créer un quiz à partir de ce dossier »** sur les dossiers riches en mécanismes (Agriculture/pesticides, PFAS). *Articulation activité → autoapprentissage (agent 1 §4.4).*
10. **Tracer l'origine de l'amorce** (origine Discord / événement) en tête d'activité, et amorcer 2-3 dossiers réels (sujets 13, 9, 11) pour éprouver le tunnel de bout en bout (reprend le backlog de l'agent 1). *Donne de la vie et valide le format.*

---

> Statut : brouillon de conception, à amender. Aucune ligne de code avant arbitrage. Le tunnel **existe déjà en pièces** dans le code ; l'enjeu n'est pas de le bâtir mais de le **rendre visible (stepper + prochaine action)** et de **l'unifier (un seul `statut` de visibilité)**. Les actions 1-4 sont sans risque et débloquent le guidage ; 5-7 paient la dette de cohérence ; 8-10 tissent les articulations (atelier/arpentage → dossier → quiz).
