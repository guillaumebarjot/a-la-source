import Database, { type Database as DatabaseType } from 'better-sqlite3'
import { existsSync } from 'fs'
import { DB_PATH } from '../db/dbPath.js'

// Chemin de la base : resolu de maniere UNIQUE dans db/dbPath.ts (une seule base,
// canonique, dans OneDrive). Tous les scripts seed/migrate s'y referent aussi.
if (!existsSync(DB_PATH)) {
  console.error(`Base introuvable : ${DB_PATH}`)
  console.error('Lancer : npm run init-db')
  process.exit(1)
}

const db: DatabaseType = new Database(DB_PATH)
// Base canonique sur OneDrive : le mode WAL y est incompatible (les sidecars -wal/-shm
// sont desynchronises par la synchro cloud => "database disk image is malformed" et
// regressions de donnees). On force le mode DELETE (journal rollback classique), comme
// pour les autres bases OneDrive du vault. Ne JAMAIS repasser en WAL ici.
db.pragma('journal_mode = DELETE')
db.pragma('foreign_keys = ON')

export default db
