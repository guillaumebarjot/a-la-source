# Workflow git, merge requests et versions — À la source

Ce document fixe une façon simple et propre de faire évoluer le code, même en travaillant seul. Objectif : un historique lisible, des versions repérables, une prod qu'on sait reproduire. **On ne réécrit jamais l'historique de `main`.**

## 1. Branches

- `main` : toujours déployable. C'est la branche de référence déployée en production (`origin/main`). La prod est buildée depuis `main` (HEAD).
- Branches de travail, une par chantier, préfixées par intention :
  - `feat/...` : nouvelle fonctionnalité (ex. `feat/observatoire-export`)
  - `fix/...` : correction de bug
  - `docs/...` : documentation seule
  - `chore/...` : maintenance, dépendances, outillage

Créer une branche :

```bash
git switch -c feat/mon-chantier
```

Garder les branches courtes (un chantier = une branche = une MR). Supprimer la branche une fois fusionnée.

### Nettoyage des branches mortes

Une branche absente d'`origin` et en retard sur `main` (0 commit en avance) est obsolète : son contenu est déjà dans `main`.

```bash
git branch -d feature/nom-branche   # refuse si non mergée
# si vraiment à jeter après vérification :
git branch -D feature/nom-branche
```

## 2. Commits

- Messages **en français accentué**, à l'impératif ou descriptifs, concis.
- **Commits anonymes** : aucune mention d'outil de génération, aucun `Co-Authored-By`, aucun « Generated » (R2).
- Pas de tiret cadratin ni de double tiret décoratif dans les messages (R7).
- Un commit = une idée. Éviter les commits fourre-tout.

## 3. Merge requests (pull requests GitHub)

Même en solo, passer par une PR pour chaque chantier :

```bash
git push -u origin feat/mon-chantier
gh pr create --base main --head feat/mon-chantier \
  --title "Titre clair" --body "Ce que ça change et pourquoi."
```

- La PR sert de trace du raisonnement et de point de relecture.
- Fusion en **squash** ou **merge** selon la granularité voulue ; ne PAS rebaser/forcer `main`.
- Après fusion : `git switch main && git pull && git branch -d feat/...`.

Corps de PR : décrire le quoi/pourquoi, lister les fichiers sensibles touchés (schéma, auth, déploiement), signaler tout impact base de données ou prod.

### Checklist de revue (avant de demander la fusion)

À passer en revue, soi-même ou en relecteur·ice, avant tout merge :

- [ ] **Typecheck serveur** : `npm run build --workspace=server` (`tsc`) passe sans erreur. TypeScript strict, pas de `any` ajouté.
- [ ] **Typecheck + build client** : `npm run build --workspace=client` (`tsc -b && vite build`) passe sans erreur.
- [ ] **Validation locale sur copie de base** : la fonctionnalité a été essayée en local (`npm run dev`) sur une **copie** de la base, jamais sur la base canonique (cf. section 7).
- [ ] **Migrations additives et idempotentes** : toute évolution de schéma est un `migrate-*.ts` additif, appliqué par `auto-migrate.ts`, rejouable sans casse ni perte de données.
- [ ] **Documentation à jour** : si le comportement, le schéma, les routes ou le déploiement changent, les docs concernées (`docs/architecture.md`, `docs/schema-bdd.md`, `docs/utilisation.md`, `docs/deploiement.md`, `README.md`) sont mises à jour dans la même PR. Le `docs/CHANGELOG.md` reçoit une entrée datée.
- [ ] **Pas de secret commité** : tokens et webhooks Discord vivent dans le `.env` du serveur, jamais dans le dépôt.
- [ ] **Commit propre** : messages en français accentué, anonymes, sans tiret cadratin (cf. section 2).

## 4. Versions (semver + tags)

Format `vMAJEUR.MINEUR.CORRECTIF`, aligné avec `package.json` :

- **MAJEUR** : refonte ou rupture (ex. la refonte v3 par sujets).
- **MINEUR** : nouvelle fonctionnalité rétrocompatible.
- **CORRECTIF** : correction sans nouvelle fonctionnalité.

Poser un tag sur `main` à chaque palier :

```bash
# aligner package.json (et server/, client/) sur la version voulue, commit
git tag -a v2.1.0 -m "v2.1.0 - résumé du palier"
git push origin v2.1.0
```

## 5. CHANGELOG

`docs/CHANGELOG.md` est tenu et détaillé. Règle :

- À chaque tag de version, ajouter en tête une entrée `## vX.Y.Z - AAAA-MM-JJ` résumant le palier (les détails fins peuvent rester sous forme datée).
- Le CHANGELOG raconte le « pourquoi » côté produit ; les messages de commit le « quoi » côté code.

## 6. Lien avec le déploiement

- La prod doit pouvoir indiquer **quelle version (tag) elle fait tourner**. Une fois les tags en place, comparer prod vs `main` se résume à comparer un tag à `origin/main`.
- Ne jamais déployer une branche de travail non fusionnée. Seul `main` (HEAD) est déployé.
- Les migrations de schéma sont additives et idempotentes (`auto-migrate.ts`) : une prod en retard se met à niveau au redémarrage, sans perte de données.

## 7. La base canonique ne se modifie que par copie + swap

La base de données de production est **canonique** : elle ne se modifie **jamais en place** depuis un poste de dev ou un script. La règle, déjà appliquée par les scripts de complétion (cf. `docs/completion-bdd-plan.md`) :

1. **Travailler sur une copie**, jamais sur la canonique. Pointer `A_LA_SOURCE_DB` vers une copie (ex. `/tmp/als-travail.db`) ; tout script de transformation refuse une cible dont le chemin contient `OneDrive` ou `00_PERSO`.
2. **Dry-run d'abord** : ouvrir la base en `readonly`, produire le diff proposé et le faire **relire** avant tout `--apply`.
3. **Appliquer sur la copie**, vérifier le résultat, puis **basculer** (swap) la copie validée vers la canonique. On ne fait pas d'écriture concurrente sur la base servie.

En production, la base est LOCALE au serveur (volume `/data`, jamais OneDrive). Voir `docs/deploiement.md` et `docs/acces-identite.md`.
