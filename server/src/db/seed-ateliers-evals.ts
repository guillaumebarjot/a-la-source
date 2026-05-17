/**
 * Seed : ateliers demo, evaluations, mecanismes identifies
 * Run: npx tsx server/src/db/seed-ateliers-evals.ts
 */
import Database from 'better-sqlite3'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dbPath = join(__dirname, '..', '..', '..', 'db', 'a-la-source.db')
const db = new Database(dbPath)
db.pragma('journal_mode = WAL')

// -- Helpers --
function getRandom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
function randInt(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min }

// -- 1. Ateliers --
console.log('=== Ateliers ===')

// Atelier demo (termine)
const existingAteliers = db.prepare('SELECT id FROM ateliers WHERE numero = 0').get()
if (!existingAteliers) {
  db.prepare(`
    INSERT INTO ateliers (numero, date_atelier, lieu, statut, nb_participants, compte_rendu, observations, mecanisme_identifie)
    VALUES (0, '2026-04-12', 'Salle des fetes - Wissembourg', 'termine', 8,
      'Atelier de demonstration. Travail sur une source France Info traitant du prix du gaz. Mecanismes identifies : chiffre-paravent, argument d''autorite, cadrage emotionnel. Discussion riche sur la difference entre information et commentaire.',
      'Bonne dynamique de groupe. Les participant·es ont bien saisi la difference entre identifier un mecanisme et ''denoncer'' un media.',
      'Chiffre-paravent, Argument d''autorite, Cadrage emotionnel')
  `).run()
  console.log('  Atelier 0 (demo termine) cree')
}

// Atelier 2 (prochain)
const atelier2 = db.prepare('SELECT id FROM ateliers WHERE numero = 2').get()
if (!atelier2) {
  db.prepare(`
    INSERT INTO ateliers (numero, date_atelier, lieu, statut)
    VALUES (2, '2026-07-10', 'Maison des associations - Haguenau', 'preparation')
  `).run()
  console.log('  Atelier 2 (preparation) cree')
}

// Atelier 3 (prevu)
const atelier3 = db.prepare('SELECT id FROM ateliers WHERE numero = 3').get()
if (!atelier3) {
  db.prepare(`
    INSERT INTO ateliers (numero, date_atelier, lieu, statut)
    VALUES (3, '2026-09-18', 'Lieu a confirmer - Strasbourg', 'preparation')
  `).run()
  console.log('  Atelier 3 (preparation) cree')
}

// -- 2. Passer des sources en vivier --
console.log('\n=== Passage en vivier ===')
const sourcesVivier = db.prepare("SELECT id FROM sources WHERE statut = 'veille' ORDER BY soumis_le DESC LIMIT 12").all() as { id: number }[]
let nbVivier = 0
for (const s of sourcesVivier.slice(0, 8)) {
  db.prepare("UPDATE sources SET statut = 'vivier' WHERE id = ? AND statut = 'veille'").run(s.id)
  nbVivier++
}
console.log(`  ${nbVivier} sources passees en vivier`)

// -- 3. Mecanismes de reference --
const mecaRefs = db.prepare('SELECT id, nom FROM mecanismes_reference').all() as { id: number; nom: string }[]
console.log(`\n=== Mecanismes de reference : ${mecaRefs.length} ===`)
if (mecaRefs.length === 0) {
  console.log('  ERREUR: pas de mecanismes de reference. Seed annule.')
  process.exit(1)
}

// -- 4. Evaluations --
console.log('\n=== Evaluations ===')
const users = db.prepare('SELECT id FROM utilisateurs').all() as { id: number }[]
const allSources = db.prepare("SELECT id, date_publication FROM sources WHERE statut IN ('vivier', 'veille') ORDER BY soumis_le DESC LIMIT 30").all() as { id: number; date_publication: string | null }[]

const justifications = [
  'Le chiffre est mis en avant sans contexte ni comparaison avec d\'autres periodes.',
  'L\'expert cite n\'a pas de competence specifique sur le sujet traite.',
  'Le cadrage emotionnel oriente la perception avant toute analyse factuelle.',
  'Faux dilemme : deux options presentees comme si elles etaient les seules possibles.',
  'Generalisation abusive a partir d\'un cas particulier.',
  'La source cite une autorite sans verifier si elle est competente sur le sujet.',
  'Le titre sensationnaliste ne correspond pas au contenu de l\'article.',
  'Omission significative : un element essentiel du contexte est passe sous silence.',
  'Le vocabulaire choisi connote negativement sans que ce soit justifie par les faits.',
  'Correlation presentee comme causalite sans demonstration.',
]

const extraits = [
  '"Les experts sont unanimes" — sans preciser lesquels ni combien.',
  '"Une explosion des chiffres" — en realite une hausse de 3%.',
  '"Les Francais pensent que..." — sondage non represente et non source.',
  '"Il faut agir maintenant" — sans expliquer les alternatives.',
  '"Comme le montre cette etude" — etude non referee, commanditee par un lobby.',
  '"Le gouvernement affirme" — sans mise en perspective ni contradiction.',
]

let nbEvals = 0
let nbMecas = 0

for (const source of allSources) {
  // 1-3 evaluateurs par source
  const nbEvaluateurs = randInt(1, Math.min(3, users.length))
  const evaluateurs = [...users].sort(() => Math.random() - 0.5).slice(0, nbEvaluateurs)

  for (const user of evaluateurs) {
    const existing = db.prepare('SELECT id FROM evaluations WHERE source_id = ? AND evaluateur_id = ?').get(source.id, user.id)
    if (existing) continue

    const scoreEcho = randInt(3, 35)
    const scorePedagogie = randInt(5, 38)
    const complexite = randInt(3, 9)
    const bonusExpert = randInt(0, 6)
    const resonance = randInt(2, 9)

    db.prepare(`
      INSERT INTO evaluations (source_id, evaluateur_id, score_echo, score_pedagogie, complexite, bonus_expert, resonance)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(source.id, user.id, scoreEcho, scorePedagogie, complexite, bonusExpert, resonance)
    nbEvals++
  }

  // 0-3 mecanismes identifies par source
  const nbMecaSource = randInt(0, 3)
  const mecasChoisis = [...mecaRefs].sort(() => Math.random() - 0.5).slice(0, nbMecaSource)

  for (const meca of mecasChoisis) {
    const existing = db.prepare('SELECT id FROM source_mecanismes WHERE source_id = ? AND mecanisme_id = ?').get(source.id, meca.id)
    if (existing) continue

    const identifiePar = getRandom(users).id
    const justification = getRandom(justifications)
    const extrait = Math.random() > 0.3 ? getRandom(extraits) : null

    db.prepare(`
      INSERT INTO source_mecanismes (source_id, mecanisme_id, identifie_par, justification, extrait)
      VALUES (?, ?, ?, ?, ?)
    `).run(source.id, meca.id, identifiePar, justification, extrait)
    nbMecas++
  }
}

console.log(`  ${nbEvals} evaluations creees`)
console.log(`  ${nbMecas} mecanismes identifies`)

// -- 5. Lier des sources a l'atelier demo --
const atelierDemo = db.prepare('SELECT id FROM ateliers WHERE numero = 0').get() as { id: number } | undefined
if (atelierDemo) {
  const demoSources = db.prepare("SELECT id FROM sources WHERE statut = 'vivier' LIMIT 3").all() as { id: number }[]
  for (const s of demoSources) {
    const existing = db.prepare('SELECT 1 FROM atelier_sources WHERE atelier_id = ? AND source_id = ?').get(atelierDemo.id, s.id)
    if (!existing) {
      db.prepare('INSERT INTO atelier_sources (atelier_id, source_id) VALUES (?, ?)').run(atelierDemo.id, s.id)
    }
  }
  // Choisir la premiere comme source de l'atelier
  if (demoSources.length > 0) {
    db.prepare('UPDATE ateliers SET source_choisie_id = ? WHERE id = ?').run(demoSources[0].id, atelierDemo.id)
  }
  console.log(`\n  Atelier demo lie a ${demoSources.length} sources`)
}

// -- 6. Duree estimee pour les sources (pour le timing) --
console.log('\n=== Durees estimees ===')
const sourcesWithoutDuree = db.prepare('SELECT id FROM sources WHERE duree_estimee IS NULL').all() as { id: number }[]
let nbDurees = 0
for (const s of sourcesWithoutDuree) {
  // Simuler des durees variees (2 a 25 min)
  const duree = getRandom([3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20])
  db.prepare('UPDATE sources SET duree_estimee = ? WHERE id = ?').run(duree, s.id)
  nbDurees++
}
console.log(`  ${nbDurees} durees estimees ajoutees`)

console.log('\n=== Seed termine ===')
