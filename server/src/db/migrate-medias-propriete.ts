/**
 * Migration — Propriété des médias (Chantier A)
 *
 * Structure la propriété des médias, jusque-là décrite en texte libre dans
 * medias.description, en champs requêtables. Modèle inspiré de la fonction
 * Ownership de GroundNews (propriété codée à la main) et de la cartographie
 * Acrimed « Médias français, qui possède quoi ? ».
 *
 * Idempotent. Utilise lib/db (donc la base réelle de l'app, surchargeable
 * par A_LA_SOURCE_DB pour les tests).
 *
 * Usage : npx tsx server/src/db/migrate-medias-propriete.ts
 */
import db from '../lib/db.js'

console.log('Migration medias propriété — début')

const cols = (db.prepare('PRAGMA table_info(medias)').all() as { name: string }[]).map(c => c.name)

const ADD: Record<string, string> = {
  proprietaire: 'TEXT',          // groupe ou structure propriétaire, ex « Groupe Dassault »
  actionnaire_ultime: 'TEXT',    // personne ou entité au bout de la chaîne, ex « Famille Dassault »
  type_propriete: 'TEXT',        // enum logique ci-dessous (non contraint pour rester souple)
  financement: 'TEXT',           // « publicité », « abonnements », « dons », « public », « mixte »...
  annee_creation: 'INTEGER',
  ligne_revendiquee: 'TEXT',     // ce que le média dit de lui-même, sans jugement
}

// type_propriete attendu (documentaire) :
// conglomerat | capital_prive | groupe_industriel | public | cooperative | associatif | independant | autre

let added = 0
for (const [col, type] of Object.entries(ADD)) {
  if (!cols.includes(col)) {
    db.exec(`ALTER TABLE medias ADD COLUMN ${col} ${type};`)
    console.log(`  + medias.${col}`)
    added++
  }
}

console.log(`Migration medias propriété — terminée (${added} colonne(s) ajoutée(s))`)
