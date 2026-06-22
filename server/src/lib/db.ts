import Database, { type Database as DatabaseType } from 'better-sqlite3'
import { existsSync } from 'fs'
import { DB_PATH } from '../db/dbPath.js'

// Chemin de la base : resolu de maniere UNIQUE dans db/dbPath.ts. La base
// canonique vit en PROD (Bomp4rd) ; en dev local c'est un echantillon leger
// (db/a-la-source-dev.db). Tous les scripts seed/migrate s'y referent aussi.
if (!existsSync(DB_PATH)) {
  console.error(`Base introuvable : ${DB_PATH}`)
  console.error('Lancer : npm run init-db')
  process.exit(1)
}

const db: DatabaseType = new Database(DB_PATH)
// Mode WAL : la base vit desormais sur disque LOCAL (prod = bind-mount Docker
// d'un repertoire, dev = repo local), plus sur OneDrive. WAL autorise des
// lecteurs concurrents pendant une ecriture (bien meilleure tenue a la charge,
// ex. plusieurs dizaines d'utilisateurs) et resiste mieux aux coupures.
// L'ancien mode DELETE etait impose par OneDrive, dont la synchro cloud
// corrompait les sidecars -wal/-shm ("database disk image is malformed") :
// cette contrainte n'existe plus. Ne PAS repasser en DELETE ni pointer la base
// sur un dossier synchronise (OneDrive, Dropbox...).
db.pragma('journal_mode = WAL')
db.pragma('synchronous = NORMAL')
db.pragma('busy_timeout = 5000')
db.pragma('foreign_keys = ON')

export default db
