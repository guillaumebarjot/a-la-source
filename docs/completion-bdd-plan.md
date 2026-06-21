# Plan de complétion BDD — exécution dry-run 2026-06-21

Suite de l'audit `docs/audit-bdd-2026-06-21.md`. Quatre scripts idempotents
écrits sous `server/src/scripts/completion/`, chacun en mode `--dry-run` par
défaut (lecture seule, aucune écriture) et `--apply` (écriture uniquement sur la
base pointée par `A_LA_SOURCE_DB`, jamais la canonique).

## Garde-fous (rappel sécurité)

- Aucun script ne touche la base canonique OneDrive. Le chemin vient
  EXCLUSIVEMENT de la variable `A_LA_SOURCE_DB`.
- En `--apply`, le helper `openGuarded` (`_shared.ts`) refuse de s'exécuter si le
  chemin contient `OneDrive` ou `00_PERSO` (motif canonique). Vérifié : un
  `--apply` sur `.../00_PERSO/A la source/a-la-source.db` est rejeté avec le
  message « REFUS ».
- En `--dry-run`, la base est ouverte en `readonly`.
- Les dry-runs de ce rapport ont tourné sur une COPIE : `/tmp/als-completion.db`
  (copie de la canonique). La canonique n'a PAS été modifiée (mtime inchangé).

## Préparer la copie de travail

```sh
cp "/Users/invite/Library/CloudStorage/OneDrive-ARTELIA/00_PERSO/A la source/a-la-source.db" /tmp/als-completion.db
```

Tous les dry-runs ci-dessous : `A_LA_SOURCE_DB=/tmp/als-completion.db npx tsx <script>`.

---

## 1. Accroches — `backfill-accroche.ts`

Dérive l'accroche manquante depuis le texte archivé (archive readability), HTML
nettoyé en texte brut (`htmlToText`), boilerplate de tête atténué
(`nettoyerAmorce`), extrait propre de ~200-300 caractères sans couper un mot
(`extraitPropre`).

- **Volume traité (dry-run réel)** : 74 sources sans accroche. **49 accroches
  dérivables** depuis l'archive ; 25 non couvertes (pas d'archive exploitable).
- **Taux** : 49/74 = **66 %** automatisable depuis l'archive.
- **Risques** : certaines amorces gardent des résidus (date « à 14h57 », « Temps
  de lecture », crédit « (DR) », blurb de chaîne TV). Le nettoyage est
  best-effort. **Relecture humaine recommandée** avant validation — le dry-run
  liste id + accroche proposée précisément pour ça. Pour les 25 sources sans
  archive : accroche à rédiger à la main (ou après archivage readability).
- **Idempotent** : ne cible que `accroche` NULL/vide ; relance = 0 écriture
  (vérifié sur copie : 49 puis 0).
- **Commande --apply (plus tard, sur copie d'abord)** :
  ```sh
  A_LA_SOURCE_DB=/tmp/als-completion.db npx tsx server/src/scripts/completion/backfill-accroche.ts --apply
  ```

## 2. Images — `refetch-images.ts`

Récupère `og:image` (puis `twitter:image`) depuis l'URL d'origine via le `fetch`
global de Node 22 (aucune dépendance ajoutée), User-Agent navigateur explicite
(mémo projet : Cloudflare renvoie 403/1010 sans UA), timeout 12 s, extraction
des meta par regex sur le `<head>` (pas de JSDOM, pas de dépendance).

- **Volume traité (dry-run réel)** : 80 sources sans image, toutes avec URL http.
- **Taux de récupération** : **52 images trouvées sur 80 = 65 %**. Échecs : 28
  (13 « pas d'og:image » sur la page, 8 HTTP 404 lien mort, 7 HTTP 403 anti-bot).
- **Risques** : l'image og n'est pas toujours l'illustration de l'article (parfois
  logo/visuel générique) → relecture conseillée sur les médias à og générique.
  Les 404 signalent des liens morts à corriger en amont. Les 403 (anti-bot
  résiduel) pourraient passer un autre jour ; le script est rejouable sans risque
  (n'écrase jamais une image existante). Fallback connu : upload local
  `/images/source-N.*` (8 sources le font déjà).
- **Idempotent** : ne cible que `image_url` NULL/vide.
- **Commande --apply** :
  ```sh
  A_LA_SOURCE_DB=/tmp/als-completion.db npx tsx server/src/scripts/completion/refetch-images.ts --apply
  ```

## 3. Doublons — `dedup-sources.ts`

Détecte les doublons par URL normalisée et par titre normalisé. Pour chaque
groupe, compte les rattachements (archives, sujets, tags, mécanismes, activités)
et désigne la ligne à CONSERVER (la plus rattachée). **Dry-run uniquement** :
aucune écriture même avec `--apply` (fusion = geste manuel prudent).

- **Volume (dry-run réel)** : **2 groupes** détectés (conforme à l'audit) :
  - URL `rue89strasbourg.com/...-387001` : conserver **26** (rattach=4), fusionner
    259 (rattach=2).
  - URL `connaissancedesenergies.org/...lithium...` : conserver **256** (rattach=2),
    fusionner 252 (rattach=2, égalité → 256 légèrement plus complet).
- **Risques** : la fusion réelle (réattribuer les rattachements de la ligne
  fusionnée vers celle conservée, puis supprimer) reste manuelle ; vérifier qu'on
  ne perd pas un rattachement unique porté par la ligne supprimée. Le script
  fournit le plan, pas l'exécution.
- **Pas de --apply** (par conception). Geste manuel à valider au cas par cas.

## 4. Rattachement sujets — `rattacher-sujets.ts`

Propose un sujet pour chaque source sans sujet, par score de mots-clés
(dictionnaire dérivé des 27 sujets existants) sur titre (poids 5), accroche +
mots_cles (poids 3), corps archivé (poids 1). Seuil de proposition : score ≥ 3.

- **Volume (dry-run réel)** : 15 sources sans sujet. **15 propositions** (toutes
  au-dessus du seuil), 0 sans proposition. Exemples nets : 217 → méga-bassines
  (score 10), 300 → école-numérique (score 11), 22/298 → santé.
- **Taux** : 15/15 proposées ; qualité forte sur ~12, à surveiller sur 3 cas
  faibles (227 « métiers IA » → désinformation ; 299 hantavirus → méga-bassines,
  match faible santé/eau ; 248 endométriose → discriminations-accès-soins).
- **Risques** : ce sont des PROPOSITIONS à valider. Les 3 cas faibles peuvent être
  re-routés à la main avant `--apply`. INSERT OR IGNORE → jamais de doublon de
  rattachement.
- **Idempotent** : ne cible que les sources absentes de `sujet_sources`.
- **Commande --apply** :
  ```sh
  A_LA_SOURCE_DB=/tmp/als-completion.db npx tsx server/src/scripts/completion/rattacher-sujets.ts --apply
  ```

---

## Ordre d'exécution recommandé

1. **Dédoublonner d'abord** (`dedup-sources.ts`, dry-run) puis fusionner les 2
   paires À LA MAIN — pour ne pas backfiller une ligne qui sera supprimée.
2. **Accroches** (`backfill-accroche.ts --apply`) — relire la liste dry-run,
   corriger les résidus de boilerplate avant ou après application.
3. **Images** (`refetch-images.ts --apply`) — réseau, ~65 % de réussite ;
   rejouable. Traiter les 404 (liens morts) et 403 séparément.
4. **Rattachement sujets** (`rattacher-sujets.ts --apply`) — après avoir
   re-routé à la main les 3 cas faibles.

## Procédure d'application sur la canonique (APRÈS validation Guillaume)

1. Backup horodaté de la canonique OneDrive.
2. Copier la canonique en `/tmp/als-completion.db`, appliquer chaque `--apply` sur
   cette copie, relire les diffs.
3. Une fois validé, appliquer sur la canonique : le garde-fou refusant les chemins
   « OneDrive / 00_PERSO », l'application canonique se fait manuellement (copie
   retravaillée recopiée en place, ou `ONEDRIVE_ROOT`/chemin explicite hors motif
   bloquant **et** sous supervision), jamais en aveugle.

Aucune écriture canonique n'a eu lieu lors de cette session : tous les dry-runs et
les tests `--apply` ont tourné sur des copies dans `/tmp/`.
