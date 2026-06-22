/**
 * make-dev-db.ts -- fabrique une base de DEV legere et representative a partir de
 * la base CANONIQUE (desormais en PROD sur Bomp4rd, plus sur OneDrive).
 *
 * Depuis 06/2026, la base de reference vit en prod (sauvegardee par restic + un
 * backup dedie). Le dev local n'a plus besoin de porter toute la base : un
 * echantillon de quelques sujets murs + les sources du quiz, AVEC leurs archives,
 * images, tags et mecanismes, suffit pour developper. Resultat : une base de
 * quelques centaines de Ko au lieu de 16 Mo.
 *
 * SECURITE : lecture seule sur la source (A_LA_SOURCE_DB) ; ecrit une NOUVELLE
 * base (DEV_DB_OUT) et REFUSE d'ecraser une base qui ressemble a la canonique
 * (OneDrive / 00_PERSO / /srv/).
 *
 * Usage :
 *   A_LA_SOURCE_DB=/tmp/als-prod-copy.db DEV_DB_OUT=db/a-la-source-dev.db \
 *     npx tsx server/src/scripts/make-dev-db.ts
 */
import Database from 'better-sqlite3'
import { existsSync, rmSync, statSync } from 'fs'

const SRC = process.env.A_LA_SOURCE_DB || ''
const OUT = process.env.DEV_DB_OUT || ''

// Sujets representatifs retenus pour le dev (les plus murs cote matiere, cf
// docs/audit-bdd-2026-06-21.md) : agriculture/pesticides, PFAS, concentration
// des medias, lithium/geothermie, desinformation/reseaux sociaux.
const SUJETS_KEEP = [13, 11, 9, 1, 10]

function die(msg: string): never {
  console.error(msg)
  process.exit(1)
}

if (!SRC || !existsSync(SRC)) die(`A_LA_SOURCE_DB introuvable : ${SRC || '(non defini)'}`)
if (!OUT) die('DEV_DB_OUT non defini (chemin de la base dev a produire).')
if (/OneDrive|00_PERSO|\/srv\//i.test(OUT)) {
  die(`REFUS : DEV_DB_OUT ressemble a la base canonique : ${OUT}`)
}

// 1. Snapshot consistant de la source vers la base dev.
if (existsSync(OUT)) rmSync(OUT)
const src = new Database(SRC, { readonly: true })
src.exec(`VACUUM INTO '${OUT.replace(/'/g, "''")}'`)
src.close()

// 2. Elagage sur la copie.
const db = new Database(OUT)
db.pragma('foreign_keys = OFF')
db.pragma('journal_mode = DELETE')

const sujetSources = db
  .prepare(`SELECT DISTINCT source_id FROM sujet_sources WHERE sujet_id IN (${SUJETS_KEEP.join(',')})`)
  .all() as { source_id: number }[]
const quizSources = db.prepare('SELECT DISTINCT source_id FROM parcours_questions').all() as {
  source_id: number
}[]
const keep = new Set<number>([
  ...sujetSources.map((r) => r.source_id),
  ...quizSources.map((r) => r.source_id),
])
const keepList = [...keep].join(',') || '0'

// Tables portant un source_id (decouvertes dynamiquement), hors sources et FTS.
const tables = (
  db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table'
         AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'sources_fts%'`,
    )
    .all() as { name: string }[]
).map((r) => r.name)

const trim = db.transaction(() => {
  for (const t of tables) {
    const cols = (db.prepare(`PRAGMA table_info("${t}")`).all() as { name: string }[]).map(
      (c) => c.name,
    )
    if (cols.includes('source_id')) {
      db.prepare(`DELETE FROM "${t}" WHERE source_id NOT IN (${keepList})`).run()
    }
  }
  db.prepare(`DELETE FROM sources WHERE id NOT IN (${keepList})`).run()
  db.prepare(`DELETE FROM sujets WHERE id NOT IN (${SUJETS_KEEP.join(',')})`).run()
  db.prepare(`DELETE FROM sujet_sources WHERE sujet_id NOT IN (${SUJETS_KEEP.join(',')})`).run()
  // Medias plus references par aucune source gardee.
  db.prepare(
    'DELETE FROM medias WHERE id NOT IN (SELECT media_id FROM sources WHERE media_id IS NOT NULL)',
  ).run()
  // Activites sans plus aucune source rattachee.
  db.prepare(
    'DELETE FROM activites WHERE id NOT IN (SELECT DISTINCT activite_id FROM activite_sources)',
  ).run()
})
trim()

// 3. Reconstruire l'index FTS5 contentless (content='') : on vide puis on
//    repeuple avec la MEME projection que migrate-phase3.ts (titre, accroche,
//    contenu d'archive nettoye du HTML et tronque, mots-cles concatenes).
db.prepare("INSERT INTO sources_fts(sources_fts) VALUES('delete-all')").run()
const insertFts = db.prepare(
  `INSERT INTO sources_fts(rowid, titre, accroche, contenu_archive, mots_cles)
   VALUES (?, ?, ?, ?, ?)`,
)
const getMots = db.prepare("SELECT GROUP_CONCAT(mot, ' ') AS mots FROM mots_cles WHERE source_id = ?")
const sourcesFts = db
  .prepare(
    `SELECT s.id, s.titre, s.accroche,
       (SELECT ar.contenu FROM archives ar WHERE ar.source_id = s.id LIMIT 1) AS contenu_archive
     FROM sources s`,
  )
  .all() as { id: number; titre: string | null; accroche: string | null; contenu_archive: string | null }[]
const reindexFts = db.transaction(() => {
  for (const s of sourcesFts) {
    const mots = (getMots.get(s.id) as { mots: string | null } | undefined)?.mots || ''
    const contenu = s.contenu_archive?.replace(/<[^>]+>/g, ' ').substring(0, 5000) || ''
    insertFts.run(s.id, s.titre || '', s.accroche || '', contenu, mots)
  }
})
reindexFts()

db.exec('VACUUM')

const nbSources = (db.prepare('SELECT count(*) c FROM sources').get() as { c: number }).c
const nbSujets = (db.prepare('SELECT count(*) c FROM sujets').get() as { c: number }).c
const nbArchives = (db.prepare('SELECT count(*) c FROM archives').get() as { c: number }).c
db.close()

const ko = Math.round(statSync(OUT).size / 1024)
console.log('--- Base dev fabriquee ---')
console.log(`Sortie       : ${OUT} (${ko} Ko)`)
console.log(`Sujets       : ${nbSujets}`)
console.log(`Sources      : ${nbSources}`)
console.log(`Archives     : ${nbArchives}`)
console.log(`FTS indexe   : ${sourcesFts.length}`)
