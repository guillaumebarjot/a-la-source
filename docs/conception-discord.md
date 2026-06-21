# Bot Discord — audit et consolidation (2026-06-21)

Audit du code de `server/src/discord/` (client.ts, ingestion.ts, bot.ts, notify.ts),
vérifié par lecture et par inspection lecture seule du schéma de `a-la-source.db`
(via MCP `sqlite-vault`). Validation par `npx tsc --noEmit` (passe). Le bot ne peut
pas être testé en réel ici (pas de token Discord en dev) : tout ce qui suit est
sourcé sur le code et le schéma, pas sur une exécution.

## 1. État actuel

### Sens entrant (gateway, `client.ts` + `ingestion.ts`)

Sur le canal de veille (ou les guildes) surveillé(s), à chaque message non-bot :

- **Liens de page** → création (ou retrouvé par dédup URL) d'une source `origine='discord'`,
  `statut='veille'`, `a_qualifier=1`, créditée au membre rapproché (`soumis_par`).
  Le bot répond avec le lien `…/lire/<id>`.
- **Liens PDF directs** et **pièces jointes PDF** → téléchargées dans `uploads/`,
  texte extrait, archive `type='pdf'`, `completude='integral_offline'`.
- **Pièces jointes `.ris`** → métadonnées (titre, média, date, résumé) complétées
  si manquantes.
- **Texte en plus d'un lien** → commentaire sur la source.
- **Éditions** (`MessageUpdate`) et **réponses Discord** → rattachées à la source
  d'origine via le mapping `discord_messages` (message_id → source_id). Une URL
  ajoutée par édition devient un *lien alternatif* (version sans paywall), pas un doublon.
- **Gating** : sans `DISCORD_TOKEN`, `startDiscordBot` logge et sort sans rien casser.

### Sens sortant (`notify.ts`)

Webhook (`DISCORD_WEBHOOK_URL`, sans bot) : à la publication d'un sujet / dossier /
débunkage, embed rouge coquelicot posté dans le salon dédié. Fire-and-forget,
no-op silencieux si non configuré. User-Agent explicite (Cloudflare).

### Commandes (`bot.ts`)

`!source`/`!fiche <id>` (fiche : commentaires, débunkages liés, présence de texte),
`!texte <id>` (texte intégral découpé), `!editcom <id> <texte>` (édition d'un
commentaire par son auteur ou un admin), `!score <id>`, `!vivier`, `!atelier`,
`!aide`/`!manuel`/`!guide`, et les conversationnelles `!analyser` / `!evaluer` /
`!commenter` / `!taguer` (machine à états en mémoire, `conversations` Map).

### Identité

`trouverMembreDiscord` (client.ts) rapproche l'auteur Discord d'un compte : d'abord
par `discord_id`, sinon par `discord_pseudo` (insensible à la casse, sur handle /
nom global / surnom serveur), et mémorise alors le `discord_id`. Sans correspondance,
la contribution reste anonyme (`soumis_par = null`).

## 2. Problèmes classés par gravité

### Bloquants (corrigés ici)

1. **`require()` en module ESM** — `bot.ts` (ancien `:194`). Le projet est
   `"type":"module"` (package.json) + `module:"ESNext"` (tsconfig). `require`
   n'existe pas dans ce scope : `!score` jetait `ReferenceError: require is not
   defined` à chaque appel (avalé par le `try/catch` de `MessageCreate`, donc
   échec silencieux). **Corrigé** : import statique `calculerScoreSource` en tête
   de fichier (aucun cycle : `score.ts` n'importe que `db`).

2. **Insertion de commentaire avec `auteur_id` NULL** — `commentaires.auteur_id`
   est `INTEGER NOT NULL` (schéma vérifié). Or trois chemins Discord pouvaient
   passer `null` quand l'auteur n'est pas rapproché à un membre :
   `ingestion.ts` `ajouterCommentaire` (texte de commentaire) et
   `ajouterLienAlternatif` (type `'lien'`), et `bot.ts` `stepCommenter`. L'INSERT
   échouait → commentaire **perdu silencieusement** (juste un `console.error`).
   **Corrigé** : les trois chemins refusent proprement l'insert si pas de membre
   et le **signalent à l'utilisateur** (« renseigne ton pseudo Discord dans l'app »),
   au lieu d'échouer en silence. `ajouterCommentaire` renvoie désormais un booléen.

### Majeurs (à valider, hors périmètre `discord/`)

3. **Évaluations toutes attribuées à l'utilisateur #1** — `bot.ts` `stepEvaluer`
   (`evaluations … evaluateur_id` codé en dur à `1`, commentaire « a ameliorer »).
   `!evaluer` ne crédite jamais le bon membre, et l'`UNIQUE(source_id, evaluateur_id)`
   fait qu'une 2ᵉ évaluation **écrase** la 1ʳᵉ via l'`ON CONFLICT`. Le membre est
   pourtant résolu côté gateway (`auteurMembre`) mais n'est pas passé à `handleCommand`
   pour `!evaluer`/`!analyser`/`!taguer`. **Fix propre** : propager `appUserId`
   jusqu'à `stepEvaluer` et l'utiliser comme `evaluateur_id` (refuser si null,
   comme pour les commentaires). Touche uniquement `bot.ts` mais modifie la
   signature de la machine à états → à faire dans le chantier dédié pour cohérence,
   pas en correctif isolé.

4. **`!analyser` n'attribue pas non plus** — `source_mecanismes` est inséré sans
   trace de l'auteur ; même schéma de propagation que (3). Aucune dédup : un même
   mécanisme peut être posé plusieurs fois sur une source.

5. **Pas d'index `UNIQUE` sur `sources.url`** (schéma vérifié : 0 index unique sur
   url). La dédup est purement applicative (double `SELECT` dans `ingererLien`),
   avec une fenêtre TOCTOU : deux messages quasi simultanés portant la même URL
   peuvent créer deux sources. Cohérent avec les 2 paires de doublons URL relevées
   dans `audit-bdd-2026-06-21.md`. **Fix** : index unique sur `url` (+ `ON CONFLICT`),
   à poser dans `auto-migrate.ts` (hors `discord/`).

6. **`cmdArchiver` est un faux** — `bot.ts` : répond « Archivage lancé » mais ne
   lance **rien** (commentaire « En vrai usage, on ferait un appel API »).
   Promesse non tenue à l'utilisateur. `handleAttachment` insère une archive `pdf`
   sans contenu ni copie de fichier et n'est appelé nulle part. À brancher sur le
   pipeline readability/PDF réel, ou retirer la commande.

### Mineurs / dette (notés, non corrigés)

7. **`MessageUpdate` se redéclenche sur l'auto-embed Discord** — quand Discord
   résout l'aperçu d'un lien, il édite le message → `traiterMessage` rejoue.
   L'idempotence tient (dédup URL, commentaire idempotent, lien alternatif
   idempotent), mais c'est du travail et des fetch réseau inutiles à chaque édition.
   Filtrer (p. ex. ignorer les updates dont seul `embeds` change) — `client.ts:151`.

8. **`attacherPdf` / `importerRis` : fetch sans timeout, sans plafond de taille,
   sans vérif de `content-type`** — `ingestion.ts` (`fetch(fileUrl, …)`). Une URL
   lente ou un fichier énorme bloque le handler ; un PDF se télécharge en entier en
   mémoire (`arrayBuffer` → `Buffer`). Ajouter `AbortSignal.timeout`, un plafond
   d'octets et un contrôle de type.

9. **`attacherPdf` ne dédoublonne pas les archives** — réingérer le même PDF
   (édition, re-post) crée une nouvelle ligne `archives` à chaque fois
   (`INSERT` sans garde), et réécrit `completude='integral_offline'`.

10. **`estSurveille` silencieux si rien n'est configuré** — `client.ts:80`. Si ni
    `channelVeille` ni `guildIds`, la fonction renvoie toujours `false` : le bot se
    connecte mais n'ingère rien, sans avertissement. Logger un warning au boot.

11. **Aucune observabilité de connexion** — `client.ts` n'écoute que `Events.Error`.
    Pas de `Events.Warn`, pas de `ShardDisconnect` / `ShardReconnecting` /
    `Invalidated`, pas de log de reprise. discord.js se reconnecte seul, mais on ne
    voit ni les coupures ni le rate-limiting.

12. **Pas de garde de longueur sur les réponses** — `texteSourceChunks` plafonne
    bien à 1800 c, mais `cmdFiche` tronque à 1900 et plusieurs réponses
    concaténées (`lignes.join('\n')`) ne sont pas bornées. Risque de dépasser la
    limite Discord 2000 c sur un message très fourni.

13. **`cmdEditCommentaire` autorise l'édition d'un commentaire `auteur_id IS NULL`**
    — `bot.ts` (`c.auteur_id == null` dans `autorise`). Reliquat de l'ancien modèle
    anonyme ; désormais aucun commentaire ne devrait avoir d'auteur null. Sans
    conséquence pratique, mais incohérent avec le correctif (2). À nettoyer dans le
    chantier dédié (modification de logique d'autorisation, donc pas un correctif sûr).

14. **`evaluations.sourcing` jamais renseigné** — la colonne existe (CHECK 0-10)
    mais `stepEvaluer` ne la collecte pas, alors qu'elle entre dans le score.

15. **Conversations en mémoire, sans TTL** — `conversations` Map (`bot.ts`) :
    pas d'expiration. Une conversation `!analyser` abandonnée reste « active »
    indéfiniment, et tout message suivant du membre est interprété comme une réponse
    (`hasActiveConversation`). Ajouter un timeout / une commande `!annuler`.

## 3. Correctifs appliqués (sûrs, dans `server/src/discord/` uniquement)

- **`bot.ts`** : `require('../lib/score.js')` → import statique
  `import { calculerScoreSource } from '../lib/score.js'`. Débloque `!score`.
- **`bot.ts`** `stepCommenter` : refuse l'insert si pas de membre rapproché et
  l'explique, au lieu de violer le NOT NULL.
- **`ingestion.ts`** `ajouterCommentaire` : renvoie un booléen, court-circuite si
  `auteurId == null` (plus d'INSERT voué à l'échec).
- **`ingestion.ts`** `ajouterLienAlternatif` : même garde `auteurId == null`.
- **`ingestion.ts`** `traiterMessage` : quand un commentaire est refusé faute de
  membre rapproché, le bot le signale dans sa réponse.

`npx tsc --noEmit` passe depuis `server/`. Aucun fichier hors `server/src/discord/`
n'a été touché.

## 4. Plan de consolidation (périmètre de l'agent dédié au bot Discord)

Ordonné par dépendance et impact. À cadrer avant exécution (R19).

### Étape 1 — Intégrité et attribution (corrige 2-4 proprement)

- Décider du modèle d'attribution anonyme : soit un **utilisateur « système / membre
  Discord non identifié »** dédié (id stable) pour ne plus jamais perdre une
  contribution, soit rendre `commentaires.auteur_id` *nullable* (migration). Le
  correctif actuel ne fait que refuser proprement ; ce choix est structurant.
- Propager `appUserId` à **toutes** les commandes conversationnelles
  (`!evaluer`, `!analyser`, `!commenter`, `!taguer`) et l'utiliser comme
  `evaluateur_id` / auteur, au lieu du `1` codé en dur.
- Dédup `source_mecanismes` (une justification par couple source/mécanisme/auteur).

### Étape 2 — Fiabilité de l'ingestion (corrige 5, 7-9)

- `auto-migrate.ts` : index `UNIQUE(url)` sur `sources` + `INSERT … ON CONFLICT`
  dans `ingererLien` (fin de la fenêtre TOCTOU).
- `fetch` des PDF/RIS : `AbortSignal.timeout`, plafond d'octets, contrôle de
  `content-type`.
- Dédup des archives PDF (ne pas réinsérer si une archive `pdf` `complete` existe
  déjà pour la source, sauf version plus récente).
- Filtrer les `MessageUpdate` qui ne changent que l'embed.

### Étape 3 — Commandes cohérentes (corrige 6, 13-15)

- Brancher `!archiver` sur le vrai pipeline readability (ou retirer la commande et
  `handleAttachment`).
- Collecter `sourcing` dans `!evaluer`.
- TTL sur les conversations + commande `!annuler`.
- Nettoyer la branche `auteur_id == null` de `cmdEditCommentaire`.
- Borne dure de 2000 c sur toutes les réponses (helper commun).

### Étape 4 — Observabilité (corrige 10-11)

- Écouter `Events.Warn`, `ShardDisconnect`, `ShardReconnecting`, `Invalidated`
  et journaliser les reprises.
- Warning au boot si aucun canal ni guilde n'est configuré.
- Compteurs simples (sources ingérées, PDF attachés, erreurs) exposables.

### Étape 5 — Notifications (`notify.ts`)

- Déjà robuste. Pistes : file d'attente / retry sur 429 (rate limit webhook),
  et factorisation de la constante User-Agent partagée avec `ingestion.ts`.

### Garde-fous transverses (mémo projet)

- **User-Agent explicite obligatoire** sur tous les `fetch` (sinon 403/1010
  Cloudflare) — respecté dans `ingestion.ts` et `notify.ts`, à ne jamais retirer.
- **Gating sur `DISCORD_TOKEN`** : l'absence de token ne doit jamais casser le boot
  (respecté dans `client.ts`).
