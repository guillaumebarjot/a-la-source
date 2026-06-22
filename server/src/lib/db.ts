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
// On force le mode DELETE (journal rollback classique), jamais WAL : la prod
// monte la base en bind-mount Docker et l'ancienne base de travail vivait sur
// OneDrive (sidecars -wal/-shm desynchronises par la synchro cloud => "database
// disk image is malformed"). DELETE reste le mode sain partout. Ne pas repasser en WAL.
db.pragma('journal_mode = DELETE')
db.pragma('foreign_keys = ON')

export default db
