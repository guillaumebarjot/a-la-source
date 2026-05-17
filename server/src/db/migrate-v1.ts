/**
 * Migration v1 → v2
 * Reads existing a-la-source.db (v1 schema), creates a new v2 db,
 * then migrates all data.
 */
import Database from 'better-sqlite3'
import { readFileSync, existsSync, renameSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_DIR = join(__dirname, '..', '..', '..', 'db')
const OLD_DB = join(DB_DIR, 'a-la-source-old.db')
const NEW_DB = join(DB_DIR, 'a-la-source.db')

if (!existsSync(OLD_DB)) {
  console.error('Base v1 introuvable')
  process.exit(1)
}

// Open old db
const old = new Database(OLD_DB, { readonly: true })

// Create new db with v2 schema
const db = new Database(NEW_DB)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = OFF')
const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8')
db.exec(schema)

// Migrate users
const oldUsers = old.prepare('SELECT * FROM utilisateurs').all() as Array<{ id: number; nom: string; actif: number }>
const insertUser = db.prepare('INSERT INTO utilisateurs (id, nom, role, actif) VALUES (?, ?, ?, ?)')
for (const u of oldUsers) {
  const role = u.nom === 'HydroLooney' ? 'admin' : 'membre'
  insertUser.run(u.id, u.nom, role, u.actif)
}
console.log(`${oldUsers.length} utilisateurs migres`)

// Migrate mecanismes
const oldMeca = old.prepare('SELECT * FROM biais_reference').all() as Array<{ id: number; nom: string; description: string; exemple: string; questions_guidees: string }>
const insertMeca = db.prepare('INSERT INTO mecanismes_reference (id, nom, description, exemple, questions_guidees) VALUES (?, ?, ?, ?, ?)')
for (const m of oldMeca) {
  insertMeca.run(m.id, m.nom, m.description, m.exemple, m.questions_guidees)
}
console.log(`${oldMeca.length} mecanismes migres`)

// Migrate sources — extract unique medias and auteurs
const oldSources = old.prepare('SELECT * FROM sources').all() as Array<Record<string, unknown>>

// Build media map
const mediaMap = new Map<string, number>()
const insertMedia = db.prepare('INSERT INTO medias (nom) VALUES (?)')
for (const s of oldSources) {
  const support = s.support as string | null
  if (support && !mediaMap.has(support)) {
    const r = insertMedia.run(support)
    mediaMap.set(support, Number(r.lastInsertRowid))
  }
}
console.log(`${mediaMap.size} medias crees`)

// Build auteur map
const auteurMap = new Map<string, number>()
const insertAuteur = db.prepare('INSERT INTO auteurs (nom, media_id) VALUES (?, ?)')
for (const s of oldSources) {
  const auteur = s.auteur as string | null
  const support = s.support as string | null
  if (auteur) {
    const key = `${auteur}|${support || ''}`
    if (!auteurMap.has(key)) {
      const mediaId = support ? mediaMap.get(support) || null : null
      const r = insertAuteur.run(auteur, mediaId)
      auteurMap.set(key, Number(r.lastInsertRowid))
    }
  }
}
console.log(`${auteurMap.size} auteurs crees`)

// Migrate sources
const insertSource = db.prepare(`
  INSERT INTO sources (id, titre, url, auteur_id, media_id, type_source, date_publication, paywall, duree_minutes, accroche, image_url, soumis_par, soumis_le, statut)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

for (const s of oldSources) {
  const support = s.support as string | null
  const auteur = s.auteur as string | null
  const mediaId = support ? mediaMap.get(support) || null : null
  const auteurKey = auteur ? `${auteur}|${support || ''}` : null
  const auteurId = auteurKey ? auteurMap.get(auteurKey) || null : null
  const paywall = (s.paywall as string) === 'libre' ? 0 : 1
  // Map v1 statut: 'brouillon' → 'veille'
  let statut = (s.statut as string) || 'veille'
  if (statut === 'brouillon') statut = 'veille'

  insertSource.run(
    s.id, s.titre, s.url, auteurId, mediaId,
    s.type_source, s.date_publication, paywall,
    s.duree_minutes, s.accroche, s.image_url,
    s.creee_par, s.creee_le, statut
  )
}
console.log(`${oldSources.length} sources migrees`)

// Migrate tags from old sujet field (if tags table exists in old)
try {
  const oldTags = old.prepare('SELECT * FROM tags').all() as Array<{ id: number; nom: string }>
  const insertTag = db.prepare('INSERT INTO tags (id, nom, categorie) VALUES (?, ?, ?)')
  for (const t of oldTags) {
    insertTag.run(t.id, t.nom, 'thematique')
  }
  const oldSourceTags = old.prepare('SELECT * FROM source_tags').all() as Array<{ source_id: number; tag_id: number }>
  const insertST = db.prepare('INSERT OR IGNORE INTO source_tags (source_id, tag_id) VALUES (?, ?)')
  for (const st of oldSourceTags) {
    insertST.run(st.source_id, st.tag_id)
  }
  console.log(`${oldTags.length} tags migres`)
} catch {
  console.log('Pas de table tags dans v1, skip')
}

// Migrate commentaires
try {
  const oldComments = old.prepare('SELECT * FROM commentaires').all() as Array<{ id: number; source_id: number; auteur_id: number; contenu: string; cree_le: string }>
  const insertComment = db.prepare('INSERT INTO commentaires (id, source_id, auteur_id, contenu, cree_le) VALUES (?, ?, ?, ?, ?)')
  for (const c of oldComments) {
    insertComment.run(c.id, c.source_id, c.auteur_id, c.contenu, c.cree_le)
  }
  console.log(`${oldComments.length} commentaires migres`)
} catch {
  console.log('Pas de commentaires a migrer')
}

// Migrate ateliers
try {
  const oldAteliers = old.prepare('SELECT * FROM ateliers').all() as Array<Record<string, unknown>>
  const insertAtelier = db.prepare(`
    INSERT INTO ateliers (id, numero, date_atelier, lieu, statut, source_choisie_id, nb_participants, compte_rendu, observations, mecanisme_identifie)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  for (const a of oldAteliers) {
    insertAtelier.run(a.id, a.numero, a.date_atelier, a.lieu, a.statut, a.source_choisie_id, a.nb_participants, a.compte_rendu, a.observations, a.mecanisme_identifie)
  }
  const oldAS = old.prepare('SELECT * FROM atelier_sources').all() as Array<{ atelier_id: number; source_id: number; ajoutee_le: string; retiree_le: string | null }>
  const insertAS = db.prepare('INSERT INTO atelier_sources (atelier_id, source_id, ajoutee_le, retiree_le) VALUES (?, ?, ?, ?)')
  for (const as2 of oldAS) {
    insertAS.run(as2.atelier_id, as2.source_id, as2.ajoutee_le, as2.retiree_le)
  }
  console.log(`${oldAteliers.length} ateliers migres`)
} catch (e) {
  console.log('Erreur migration ateliers:', e)
}

// Migrate contenus
try {
  const oldContenus = old.prepare('SELECT * FROM contenus').all() as Array<{ cle: string; titre: string; contenu: string; modifie_le: string }>
  const insertContenu = db.prepare('INSERT OR REPLACE INTO contenus (cle, titre, contenu, modifie_le) VALUES (?, ?, ?, ?)')
  for (const c of oldContenus) {
    insertContenu.run(c.cle, c.titre, c.contenu, c.modifie_le)
  }
  console.log(`${oldContenus.length} contenus migres`)
} catch {
  console.log('Pas de contenus a migrer')
}

// Migrate archives from uploads/ (markdown files linked to sources via lien_local)
try {
  const sourcesWithLocal = old.prepare("SELECT id, lien_local FROM sources WHERE lien_local IS NOT NULL AND lien_local != ''").all() as Array<{ id: number; lien_local: string }>
  const insertArchive = db.prepare("INSERT INTO archives (source_id, type, chemin) VALUES (?, 'markdown', ?)")
  for (const s of sourcesWithLocal) {
    insertArchive.run(s.id, s.lien_local)
  }
  console.log(`${sourcesWithLocal.length} archives locales migrees`)
} catch {
  console.log('Pas de liens locaux a migrer')
}

old.close()
db.close()

console.log('\nMigration terminee. Nouvelle base creee en db/a-la-source.db')
