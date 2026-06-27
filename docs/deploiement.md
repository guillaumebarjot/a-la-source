# Déploiement — À la source

> État de référence : **conteneur Docker sur l'infra PIAF** (serveur Bomp4rd),
> derrière Authentik forward-auth, sur le modèle de Prisme. La cible publique est
> `alasource.rouge-coquelicot.fr`. La section YunoHost en fin de document est conservée à
> titre **historique** (ancien mode de déploiement, plus utilisé).

## Prérequis

- Accès au serveur PIAF Bomp4rd (Docker + Docker Compose, réseau Docker `web`)
- Nginx Proxy Manager (NPM) et Authentik en place sur l'infra
- Node.js >= 22 (uniquement pour le build dans l'image)
- Sous-domaine pointé : `alasource.rouge-coquelicot.fr`

## Architecture de production

```
[Navigateur] -> [NPM] -(forward-auth)-> [Authentik]
                  |
                  +-> [conteneur a-la-source :3033]  (réseau Docker web)
                          |
                  base SQLite locale /data/a-la-source.db
```

NPM termine le TLS (cert dédié `alasource.rouge-coquelicot.fr`), interroge Authentik en forward-auth, puis
transmet la requête au conteneur sur le port interne **3033**. Un seul process
Node.js sert à la fois l'API et le build statique du client.

## Image et conteneur

- **`Dockerfile`** (racine du dépôt) : build multi-étapes (Node 22), construit les
  deux workspaces (`server/`, `client/`) puis un runtime léger servant l'API + le
  build client sur le port `3033`.
- **`.dockerignore`** : exclut `node_modules`, `db/*.db`, etc.
- **`deploy/docker-compose.yml`** : compose de référence. Conteneur `a-la-source`
  sur le réseau Docker `web`, variables d'environnement (dont
  `A_LA_SOURCE_DB=/data/a-la-source.db`), volumes pour la base et les fichiers.

### Volumes

| Volume hôte | Montage conteneur | Rôle |
|---|---|---|
| `/srv/a-la-source/data` | `/data` | base SQLite (lecture-écriture) |
| `/srv/a-la-source/uploads` | `/app/uploads` | copies locales (PDF, markdown) |
| `/srv/a-la-source/image-cache` | `/app/db/image-cache` | cache des images |

## Variables d'environnement

Définies dans `/srv/a-la-source/.env` (lu par le compose). Les secrets Discord y
vivent et **ne sont jamais commités**.

| Variable | Valeur de prod | Description |
|----------|----------------|-------------|
| `NODE_ENV` | `production` | Active le serve statique |
| `PORT` | `3033` | Port d'écoute interne du conteneur |
| `A_LA_SOURCE_DB` | `/data/a-la-source.db` | Chemin de la base (volume) |
| `PUBLIC_BASE_URL` | `https://alasource.rouge-coquelicot.fr` | URL publique (liens, unfurl) |
| `DISCORD_TOKEN` | (secret) | Bot Discord : ingestion + commandes |
| `DISCORD_WEBHOOK_URL` | (secret) | Webhook du salon de diffusion (notifications) |
| `DISCORD_CHANNEL_VEILLE` | (id) | Canal Discord surveillé pour l'ingestion |

## Authentification : Authentik forward-auth

L'application ne gère aucun mot de passe. NPM interroge Authentik en forward-auth
et transmet l'identité et les groupes dans des en-têtes posés par la sous-requête
d'auth (NPM écrase toute valeur envoyée par le client). Le middleware
`authMiddleware` (`server/src/lib/auth.ts`) :

1. lit l'identité dans `X-authentik-username` (repli `Remote-User`, puis `?_user=` en dev) ;
2. dérive un rôle plancher des groupes `X-authentik-groups` (`admins` / `sso-admins` / `rc-admins` → `admin`, sinon `membre`) ;
3. cherche (ou crée) l'utilisateur en base ;
4. attache `req.user`, le rôle effectif étant le plus haut entre le rôle en base (qu'un admin peut élever, ex. `animateur`) et le rôle SSO.

Détail des groupes et de la matrice de droits dans `docs/acces-identite.md`.

### Pages publiques `/partage/*`

Les pages de partage (OpenGraph pour l'unfurl Discord) sont conçues pour être
publiques. Tant que tout est gardé derrière le SSO, elles le sont aussi. Pour les
rouvrir, ajouter une exception sans auth sur `/partage/` dans l'hôte NPM.

## Mise à jour

Pas de `.git` côté serveur : on pousse le code par archive, puis on rebuild.

```bash
# Depuis le poste de dev (à la racine du dépôt)
git archive HEAD | ssh bomp4rd 'tar -x -C /srv/a-la-source/app'

# Sur le serveur (dans /srv/a-la-source/app)
docker compose build && docker compose up -d
```

Les évolutions additives de schéma sont appliquées automatiquement au boot par
`server/src/db/auto-migrate.ts` (idempotent). Aucune migration manuelle à lancer
en régime normal.

## Base de données

- SQLite, base LOCALE au serveur (montée en volume), jamais sur OneDrive en prod.
- Résolution du chemin par `A_LA_SOURCE_DB` (cf. `server/src/db/dbPath.ts`).

### Sauvegarde

```bash
# Copie à chaud depuis le volume
cp /srv/a-la-source/data/a-la-source.db \
   /srv/a-la-source/data/backup-$(date +%Y%m%d).db
```

---

## Annexe historique — déploiement YunoHost (obsolète)

> Mode de déploiement initial, avant la bascule sur l'infra PIAF (Docker +
> Authentik). Conservé pour mémoire ; ne plus utiliser.

L'application était déployée sur YunoHost :

```
[Navigateur] -> [nginx (YunoHost)] -> [Node.js :3031]
                     |
              SSO (Remote-User)
```

Authentification par header HTTP `Remote-User` (le middleware lisait ce header,
cherchait ou créait l'utilisateur, attachait `req.user`). Configuration nginx
type :

```nginx
location / {
    proxy_pass http://127.0.0.1:3031;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header Remote-User $remote_user;
}
```

Les pages `/partage/` devaient être déclarées publiques (`skipped_uris` du SSO).
Le service tournait via un unit systemd, base SQLite locale au serveur. Ce mode
est entièrement remplacé par le conteneur Docker décrit plus haut.
