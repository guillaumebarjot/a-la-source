# Workflow git, merge requests et versions - « A la source »

Ce document fixe une facon simple et propre de faire evoluer le code, meme en
travaillant seul. Objectif : un historique lisible, des versions reperables,
une prod qu'on sait reproduire. **On ne reecrit jamais l'historique de `main`.**

---

## 1. Branches

- `main` : toujours deployable. C'est la reference (`origin/main`).
- Branches de travail, une par chantier, prefixees par intention :
  - `feat/...` : nouvelle fonctionnalite (ex. `feat/observatoire-export`)
  - `fix/...` : correction de bug
  - `docs/...` : documentation seule
  - `chore/...` : maintenance, dependances, outillage

Creer une branche :

```bash
git switch -c feat/mon-chantier
```

Garder les branches courtes (un chantier = une branche = une MR). Supprimer la
branche une fois fusionnee.

### Nettoyage des branches mortes

Une branche absente d'`origin` et en retard sur `main` (0 commit en avance) est
obsolete : son contenu est deja dans `main`. Exemple constate le 11/06/2026 :
`feature/observatoire-propriete` (locale, 26 commits de retard, 0 en avance).

```bash
git branch -d feature/observatoire-propriete   # refuse si non mergee
# si vraiment a jeter apres verification :
git branch -D feature/observatoire-propriete
```

---

## 2. Commits

- Messages **en francais accentue**, a l'imperatif ou descriptifs, concis.
- **Commits anonymes** : aucune mention d'outil de generation, aucun
  `Co-Authored-By`, aucun « Generated ». (Convention deja respectee dans
  l'historique.)
- Pas de tiret cadratin ni de « -- » decoratif dans les messages.
- Un commit = une idee. Eviter les commits fourre-tout.

---

## 3. Merge requests (pull requests GitHub)

Meme en solo, passer par une PR pour chaque chantier :

```bash
git push -u origin feat/mon-chantier
gh pr create --base main --head feat/mon-chantier \
  --title "Titre clair" --body "Ce que ca change et pourquoi."
```

- La PR sert de trace du raisonnement et de point de relecture.
- Fusion en **squash** ou **merge** selon la granularite voulue ; ne PAS
  rebaser/forcer `main`.
- Apres fusion : `git switch main && git pull && git branch -d feat/...`.

Corps de PR : decrire le quoi/pourquoi, lister les fichiers sensibles touches
(schema, auth, deploiement), signaler tout impact base de donnees ou prod.

---

## 4. Versions (semver + tags)

Format `vMAJEUR.MINEUR.CORRECTIF`, aligne avec `package.json` :

- **MAJEUR** : refonte ou rupture (ex. la refonte v3 par sujets).
- **MINEUR** : nouvelle fonctionnalite retrocompatible.
- **CORRECTIF** : correction sans nouvelle fonctionnalite.

Poser un tag sur `main` a chaque palier :

```bash
# aligner package.json (et server/, client/) sur la version voulue, commit
git tag -a v2.1.0 -m "v2.1.0 - resume du palier"
git push origin v2.1.0
```

### Premier jalon a poser

Le depot n'a aucun tag. Ancrer l'existant en posant `v2.0.0` sur le commit
courant (`97df9de` au 07/06/2026), qui correspond au `package.json` actuel :

```bash
git tag -a v2.0.0 -m "v2.0.0 - socle v3 (refonte par sujets)" 97df9de
git push origin v2.0.0
```

Ensuite, avancer en `v2.x` au fil des chantiers.

---

## 5. CHANGELOG

`docs/CHANGELOG.md` est deja tenu et detaille. Regle :

- A chaque tag de version, ajouter en tete une entree `## vX.Y.Z - AAAA-MM-JJ`
  resumant le palier (les details fins peuvent rester sous forme datee comme
  aujourd'hui).
- Le CHANGELOG raconte le « pourquoi » cote produit ; les messages de commit le
  « quoi » cote code.

---

## 6. Lien avec le deploiement

- La prod doit pouvoir indiquer **quelle version (tag) elle fait tourner**.
  Une fois les tags en place, comparer prod vs `main` se resume a comparer un
  tag a `origin/main` (cf. `docs/audit-2026-06-11.md`, section 1).
- Ne jamais deployer une branche de travail non fusionnee.
- Les migrations de schema sont additives et idempotentes (`auto-migrate.ts`) :
  une prod en retard se met a niveau au redemarrage, sans perte de donnees.
