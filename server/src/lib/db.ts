import Database, { type Database as DatabaseType } from 'better-sqlite3'
import { join } from 'path'
import { existsSync } from 'fs'

// La base vit HORS du repo, dans OneDrive 00_PERSO/A la source/ (donnees
// synchronisees par OneDrive ; code par git). Racine OneDrive detectee par
// plateforme (PRO win32 / PERSO darwin), surchargeable par ONEDRIVE_ROOT,
// chemin complet par A_LA_SOURCE_DB.
const ONEDRIVE_ROOTS: Record<string, string> = {
  win32: 'C:/Users/guillaume.barjot/OneDrive - ARTELIA',
  darwin: '/Users/invite/Library/CloudStorage/OneDrive-ARTELIA',
}
const ONEDRIVE_ROOT =
  process.env.ONEDRIVE_ROOT || ONEDRIVE_ROOTS[process.platform] || ''
const DB_PATH =
  process.env.A_LA_SOURCE_DB ||
  join(ONEDRIVE_ROOT, '00_PERSO', 'A la source', 'a-la-source.db')

if (!existsSync(DB_PATH)) {
  console.error(`Base introuvable : ${DB_PATH}`)
  console.error('Lancer : npm run init-db')
  process.exit(1)
}

const db: DatabaseType = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

export default db
