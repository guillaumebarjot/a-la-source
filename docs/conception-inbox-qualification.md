# Inbox-hub et tunnel de qualification des sources (conception 2026-06-21)

Décisions de Guillaume. Source de vérité pour la refonte de la navigation et de la qualité des sources. Voir aussi `conception-tunnelisation-activites.md` (même logique de tunnel et de jalons factuels, appliquée ici à la source).

## Principe

L'**Inbox partagée devient le hub de la qualité des sources** (entrée de menu H1). « Qualifier » une source n'est plus un simple « envoyer en veille » : c'est un **tunnel d'enrichissement**, pris à la carte, jamais bloquant, avec un **score d'avancement** visible. On peut entrer et sortir du tunnel à tout moment, traiter une étape isolée, revenir plus tard.

Cohérence avec les activités : mêmes **jalons de complétude factuels** (présence d'un champ, d'un rattachement), jamais un score-verdict sur la valeur de la source (doctrine epoché). Le score mesure l'avancement du travail d'intégration, pas la qualité éditoriale.

## Le tunnel de qualification (6 étapes, à la carte)

1. **Accepter** : ce n'est pas un spam, la source entre en veille (sort de l'état `a_qualifier`).
2. **Fiabiliser** : image de couverture, accroche lisible, **copie locale** du texte intégral (archivage readability, ou copie Europresse collée / PDF joint, ou marquage « consulté hors-ligne »), date et média ; remplacer un lien mort ou paywall par la source originale ou un lien Europresse.
3. **Situer** : rattacher à au moins un **sujet**, ajouter des mots-clés.
4. **Analyser** : repérer un **mécanisme** médiatique (optionnel, anonyme possible).
5. **Mobiliser** : verser la source dans un **dossier** ou une **activité** (optionnel).
6. **Commenter** (optionnel).

Aucune étape n'est bloquante : on fait ce qu'on peut, dans l'ordre qu'on veut.

**Copie locale contextuelle (impératif d'ergonomie).** Ajouter une copie locale après coup ne doit JAMAIS demander de repréciser le numéro de la source. Sur la carte de la source, trois gestes inline qui connaissent déjà l'`:id` : « Archiver » (readability auto), « Coller le texte » (Europresse, `POST /sources/:id/archive-manuelle`), « Joindre un PDF » (`POST /sources/:id/archive-fichier`). C'est ce geste qui était mal tunnelé jusqu'ici.

## Jalons factuels et score d'avancement

Jalons booléens calculés côté serveur par source :
`accepte`, `copie_locale` (archive `complete` ou `completude='integral_offline'`), `accroche`, `image`, `sujet` (>= 1 rattachement), `analysee` (>= 1 mécanisme), `mobilisee` (dans >= 1 activité), `commentee`.

**Bien qualifiée** (le minimum, décision Guillaume) = `copie_locale` ET `accroche` ET `image`. C'est le seuil qui fait passer une source de « à travailler » à « propre ».

**Score d'avancement** (0 à 100, pondéré) :
copie_locale 25 · accroche 20 · image 15 · sujet 20 · analysee 10 · mobilisee 5 · commentee 5.
Affiché comme une petite jauge sobre par source (pas un gros chiffre-verdict).

## L'Inbox-hub (page)

- Liste les sources **pas encore bien qualifiées** (et, en option de filtre, toutes les sources pour reprise). Tri : à accepter d'abord, puis score d'avancement croissant (le plus à faire en premier).
- **Filtres par ce qui manque** : à accepter, sans copie locale, sans accroche, sans image, sans sujet, non analysée, lien mort. (Les filtres remplacent les anciennes pages Archiver / Sans copie locale.)
- Par source : la carte (image + titre + média), ses **jalons** (faits / à faire) facon stepper, son **score**, et les **actions inline** de chaque étape (réutiliser les endpoints existants : `PATCH /sources/:id` pour image/accroche/url/date/paywall/completude ; `POST /sources/:id/archiver` ; `POST /sujets/:id/sources` ; commentaires ; mécanismes ; versement dossier/activité). Renvoi vers `/lire/:id` pour les cas lourds (coller Europresse, joindre un PDF).
- Ouvert à **tous les membres connectés** (le travail est collectif).

## Refonte de la navigation H1

Cible : **Accueil · Mon espace · Inbox · Veille · Sujets · Activités · Apprendre · Observatoire**.
- **Mon espace** juste après Accueil.
- **Inbox** en H1 (le hub qualité). **Archiver** disparaît du menu (fondu dans l'Inbox via filtres) ; `/a-archiver` et `/archiver/*` deviennent des filtres / redirections.
- **Parcours** ne vit plus que dans **Apprendre** (retiré d'Activités).
- **Mécanismes** ne vit plus que dans **Observatoire** (retiré d'Apprendre, qui garde Parcours/quiz, Manuel, Aide).
- **Veille** = lecture du flux des sources qualifiées (distinct de l'Inbox = travail sur les sources).

## Accueil pédagogique

L'accueil explique tout : où se déroule quoi, le parcours d'une source (Inbox -> Veille -> Sujets/Activités), avec **aide au survol** et **blocs repliables**. Personne ne doit être perdu, jamais.

## Observatoire (en deux temps)

1. D'abord la **référence critique des médias** : qui possède quoi (propriété/concentration), couverture comparée d'un même fait, fiches médias, catalogue des mécanismes. Outils d'analyse, pas de notation.
2. Puis un **tableau de bord de notre veille** : volumes, médias les plus présents, mécanismes les plus repérés, thèmes actifs, évolution.

## Garde-fous

Ne pas pénaliser l'UX existante ni la logique tunnel/activités. Réutiliser l'existant (endpoints, composants SourceCard, MetadataPanel, EtapesActivite). Dark-safe absolu (`design-alasource.md`). Test sur copie, commits anonymes, déploiement depuis `main`.
