# Deploiement — A la source

## Prerequis

- Serveur YunoHost fonctionnel
- Node.js >= 22
- Domaine pointe (ex: `source.rouge-coquelicot.fr`)

## Architecture de production

```
[Navigateur] → [nginx (YunoHost)] → [Node.js :3031]
                     ↓
              SSO (Remote-User)
```

Un seul process Node.js sert a la fois l'API et les fichiers statiques du client.

## Installation manuelle

```bash
# Cloner le depot
git clone https://github.com/guillaumebarjot/a-la-source.git
cd a-la-source

# Installer les dependances
npm install

# Initialiser la base de donnees
npm run init-db

# Build du client
npm run build

# Lancer en production
npm start
```

L'application est accessible sur `http://localhost:3031`.

## Variables d'environnement

| Variable | Defaut | Description |
|----------|--------|-------------|
| `PORT` | `3031` | Port d'ecoute du serveur |
| `NODE_ENV` | — | Mettre `production` en prod |

## Authentification SSO

YunoHost transmet l'identite de l'utilisateur·ice via le header HTTP `Remote-User`. Le middleware auth de l'application :

1. Lit le header `Remote-User`
2. Cherche (ou cree) l'utilisateur·ice en base
3. Attache l'objet `req.user` a la requete

En developpement, ajouter `?_user=NomUtilisateur` a l'URL pour simuler l'auth.

## Base de donnees

- SQLite en mode WAL (Write-Ahead Logging)
- Fichier unique : `db/a-la-source.db`
- Pas de SGBD externe necessaire

### Sauvegarde

```bash
# Copie a chaud (WAL mode permet la lecture pendant la copie)
cp db/a-la-source.db db/backup-$(date +%Y%m%d).db
```

### Migrations

Les scripts de migration sont dans `server/src/db/` :
- `migrate-phase1.ts` — parametres, mots-cles, colonnes sources
- `migrate-phase2.ts` — evaluations enrichies, confiance media
- `migrate-phase3.ts` — index FTS5 (recherche plein texte)

```bash
npx tsx server/src/db/migrate-phase1.ts
npx tsx server/src/db/migrate-phase2.ts
npx tsx server/src/db/migrate-phase3.ts
```

## YunoHost — configuration nginx

```nginx
location / {
    proxy_pass http://127.0.0.1:3031;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header Remote-User $remote_user;
}
```

## Mise a jour

```bash
git pull origin main
npm install
npm run build
# Appliquer les nouvelles migrations si besoin
# Redemarrer le service
systemctl restart a-la-source
```

## Service systemd

```ini
[Unit]
Description=A la source — Rouge Coquelicot
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/a-la-source
ExecStart=/usr/bin/node server/src/index.js
Environment=NODE_ENV=production
Restart=always

[Install]
WantedBy=multi-user.target
```

Note : en production, les fichiers TypeScript doivent etre compiles ou executes via `tsx`. Alternative : precompiler le serveur.
