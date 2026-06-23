# Deploiement — A la source

> Etat de reference : **conteneur Docker sur l'infra PIAF** (serveur Bomp4rd),
> derriere Authentik forward-auth, sur le modele de Prisme. La cible publique est
> `alasource.rouge-coquelicot.fr`. La section YunoHost en fin de document est conservee a
> titre **historique** (ancien mode de deploiement, plus utilise).

## Prerequis

- Acces au serveur PIAF Bomp4rd (Docker + Docker Compose, reseau Docker `web`)
- Nginx Proxy Manager (NPM) et Authentik en place sur l'infra
- Node.js >= 22 (uniquement pour le build dans l'image)
- Sous-domaine pointe : `alasource.rouge-coquelicot.fr`

## Architecture de production

```
[Navigateur] → [NPM] ─(forward-auth)→ [Authentik]
                  │
                  └→ [conteneur a-la-source :3033]  (reseau Docker web)
                          ↓
                  base SQLite locale /data/a-la-source.db
```

NPM termine le TLS (cert dédié `alasource.rouge-coquelicot.fr`), interroge Authentik en forward-auth, puis
transmet la requete au conteneur sur le port interne **3033**. Un seul process
Node.js sert a la fois l'API et le build statique du client.

## Image et conteneur

- **`Dockerfile`** (racine du depot) : build multi-etapes (Node 22), construit les
  deux workspaces (`server/`, `client/`) puis un runtime leger servant l'API + le
  build client sur le port `3033`.
- **`.dockerignore`** : exclut `node_modules`, `db/*.db`, etc.
- **`deploy/docker-compose.yml`** : compose de reference. Conteneur `a-la-source`
  sur le reseau Docker `web`, variables d'environnement (dont
  `A_LA_SOURCE_DB=/data/a-la-source.db`), volumes pour la base et les fichiers.

### Volumes

| Volume hote | Montage conteneur | Role |
|---|---|---|
| `/srv/a-la-source/data` | `/data` | base SQLite (lecture-ecriture) |
| `/srv/a-la-source/uploads` | `/app/uploads` | copies locales (PDF, markdown) |
| `/srv/a-la-source/image-cache` | `/app/db/image-cache` | cache des images |

## Variables d'environnement

Definies dans `/srv/a-la-source/.env` (lu par le compose). Les secrets Discord y
vivent et **ne sont jamais commites**.

| Variable | Valeur de prod | Description |
|----------|----------------|-------------|
| `NODE_ENV` | `production` | Active le serve statique |
| `PORT` | `3033` | Port d'ecoute interne du conteneur |
| `A_LA_SOURCE_DB` | `/data/a-la-source.db` | Chemin de la base (volume) |
| `PUBLIC_BASE_URL` | `https://alasource.rouge-coquelicot.fr` | URL publique (liens, unfurl) |
| `DISCORD_TOKEN` | (secret) | Bot Discord : ingestion + commandes |
| `DISCORD_WEBHOOK_URL` | (secret) | Webhook du salon de diffusion (notifications) |
| `DISCORD_CHANNEL_VEILLE` | (id) | Canal Discord surveille pour l'ingestion |

## Authentification : Authentik forward-auth

L'application ne gere aucun mot de passe. NPM interroge Authentik en forward-auth
et transmet l'identite et les groupes dans des en-tetes poses par la sous-requete
d'auth (NPM ecrase toute valeur envoyee par le client). Le middleware
`authMiddleware` (`server/src/lib/auth.ts`) :

1. lit l'identite dans `X-authentik-username` (repli `Remote-User`, puis `?_user=` en dev) ;
2. derive un role plancher des groupes `X-authentik-groups` (`admins` / `sso-admins` / `rc-admins` → `admin`, sinon `membre`) ;
3. cherche (ou cree) l'utilisateur en base ;
4. attache `req.user`, le role effectif etant le plus haut entre le role en base (qu'un admin peut elever, ex. `animateur`) et le role SSO.

Detail des groupes et de la matrice de droits dans `docs/acces-identite.md`.

### Pages publiques `/partage/*`

Les pages de partage (OpenGraph pour l'unfurl Discord) sont concues pour etre
publiques. Tant que tout est garde derriere le SSO, elles le sont aussi. Pour les
rouvrir, ajouter une exception sans auth sur `/partage/` dans l'hote NPM.

## Mise a jour

Pas de `.git` cote serveur : on pousse le code par archive, puis on rebuild.

```bash
# Depuis le poste de dev (a la racine du depot)
git archive HEAD | tar -x -C /srv/a-la-source/app

# Sur le serveur (dans /srv/a-la-source/app)
docker compose build && docker compose up -d
```

Les evolutions additives de schema sont appliquees automatiquement au boot par
`server/src/db/auto-migrate.ts` (idempotent). Aucune migration manuelle a lancer
en regime normal.

## Base de donnees

- SQLite, base LOCALE au serveur (montee en volume), jamais sur OneDrive en prod.
- Resolution du chemin par `A_LA_SOURCE_DB` (cf. `server/src/db/dbPath.ts`).

### Sauvegarde

```bash
# Copie a chaud depuis le volume
cp /srv/a-la-source/data/a-la-source.db \
   /srv/a-la-source/data/backup-$(date +%Y%m%d).db
```

---

## Annexe historique — deploiement YunoHost (obsolete)

> Mode de deploiement initial, avant la bascule sur l'infra PIAF (Docker +
> Authentik). Conserve pour memoire ; ne plus utiliser.

L'application etait deployee sur YunoHost :

```
[Navigateur] → [nginx (YunoHost)] → [Node.js :3031]
                     ↓
              SSO (Remote-User)
```

Authentification par header HTTP `Remote-User` (le middleware lisait ce header,
cherchait ou creait l'utilisateur, attachait `req.user`). Configuration nginx
type :

```nginx
location / {
    proxy_pass http://127.0.0.1:3031;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header Remote-User $remote_user;
}
```

Les pages `/partage/` devaient etre declarees publiques (`skipped_uris` du SSO).
Le service tournait via un unit systemd, base SQLite locale au serveur. Ce mode
est entierement remplace par le conteneur Docker decrit plus haut.
