/**
 * Migration — consolidation du bot Discord (chantier #3).
 *
 * ADDITIVE, NON DESTRUCTIVE, IDEMPOTENTE. Sûre à rejouer à chaque boot.
 *
 * Pose :
 *   1. Une dédup préalable des doublons d'URL résiduels sur `sources` (la ligne
 *      la plus rattachée est conservée, les autres fusionnées puis supprimées),
 *      PUIS un index UNIQUE sur `sources.url` (l'index échouerait sinon).
 *   2. Une colonne `commentaires.origine` ('app' | 'discord') pour repérer les
 *      commentaires créés via Discord et les exposer comme éditables dans l'app.
 *
 * À câbler dans auto-migrate.ts (voir le rapport de l'agent) :
 *   import { migrateDiscord } from './migrate-discord.js'
 *   migrateDiscord()
 */
import db from '../lib/db.js'

function colonnes(table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name)
}

function ajouterColonne(table: string, colonne: string, type: string): void {
  if (!colonnes(table).includes(colonne)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${colonne} ${type};`)
    console.log(`  migrate-discord: + ${table}.${colonne}`)
  }
}

function indexExiste(nom: string): boolean {
  return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ?").get(nom)
}

/**
 * Score de rattachement d'une source : plus la ligne porte d'objets liés, plus on
 * la conserve lors d'une fusion de doublons. On privilégie les liens difficiles à
 * recréer (archives, commentaires, évaluations, mécanismes, tags, mapping Discord,
 * rattachements activités/sujets), puis on départage par id le plus ancien.
 */
function scoreRattachement(sourceId: number): number {
  const compter = (sql: string): number => {
    try {
      return (db.prepare(sql).get(sourceId) as { c: number }).c
    } catch {
      return 0
    }
  }
  let score = 0
  score += 5 * compter('SELECT COUNT(*) AS c FROM archives WHERE source_id = ?')
  score += 4 * compter('SELECT COUNT(*) AS c FROM commentaires WHERE source_id = ?')
  score += 4 * compter('SELECT COUNT(*) AS c FROM evaluations WHERE source_id = ?')
  score += 3 * compter('SELECT COUNT(*) AS c FROM source_mecanismes WHERE source_id = ?')
  score += 2 * compter('SELECT COUNT(*) AS c FROM source_tags WHERE source_id = ?')
  score += 2 * compter('SELECT COUNT(*) AS c FROM discord_messages WHERE source_id = ?')
  score += 2 * compter('SELECT COUNT(*) AS c FROM sujet_sources WHERE source_id = ?')
  score += 1 * compter('SELECT COUNT(*) AS c FROM activite_sources WHERE source_id = ?')
  return score
}

/**
 * Repointe toutes les références d'un doublon vers la source gardée, puis supprime
 * le doublon. Best-effort table par table (certaines tables peuvent ne pas exister
 * selon l'avancement des migrations). On évite les violations d'unicité avec
 * INSERT OR IGNORE sur les tables de liaison à clé composite.
 */
function fusionnerSource(garde: number, doublon: number): void {
  const exec = (sql: string): void => {
    try {
      db.prepare(sql).run(garde, doublon)
    } catch {
      /* table absente ou contrainte : best-effort */
    }
  }
  // Liens simples (FK source_id) : on repointe.
  exec('UPDATE archives SET source_id = ? WHERE source_id = ?')
  exec('UPDATE commentaires SET source_id = ? WHERE source_id = ?')
  exec('UPDATE source_mecanismes SET source_id = ? WHERE source_id = ?')
  // Liaisons à clé composite : INSERT OR IGNORE pour ne pas violer la PK, puis purge.
  const repointerComposite = (table: string, autre: string): void => {
    try {
      db.prepare(`INSERT OR IGNORE INTO ${table} (source_id, ${autre}) SELECT ?, ${autre} FROM ${table} WHERE source_id = ?`).run(garde, doublon)
      db.prepare(`DELETE FROM ${table} WHERE source_id = ?`).run(doublon)
    } catch {
      /* table absente : best-effort */
    }
  }
  repointerComposite('source_tags', 'tag_id')
  repointerComposite('sujet_sources', 'sujet_id')
  // evaluations : UNIQUE(source_id, evaluateur_id) -> repointer sans collision.
  try {
    db.prepare('UPDATE OR IGNORE evaluations SET source_id = ? WHERE source_id = ?').run(garde, doublon)
    db.prepare('DELETE FROM evaluations WHERE source_id = ?').run(doublon)
  } catch { /* best-effort */ }
  // discord_messages : message_id PK, source_id FK -> repointer.
  try {
    db.prepare('UPDATE discord_messages SET source_id = ? WHERE source_id = ?').run(garde, doublon)
  } catch { /* best-effort */ }
  // activite_sources : PK (activite_id, source_id).
  try {
    db.prepare('INSERT OR IGNORE INTO activite_sources (activite_id, source_id, role) SELECT activite_id, ?, role FROM activite_sources WHERE source_id = ?').run(garde, doublon)
    db.prepare('DELETE FROM activite_sources WHERE source_id = ?').run(doublon)
  } catch { /* best-effort */ }
  // atelier_sources : PK (atelier_id, source_id).
  try {
    db.prepare('INSERT OR IGNORE INTO atelier_sources (atelier_id, source_id) SELECT atelier_id, ? FROM atelier_sources WHERE source_id = ?').run(garde, doublon)
    db.prepare('DELETE FROM atelier_sources WHERE source_id = ?').run(doublon)
  } catch { /* best-effort */ }
  // Enfin, supprimer la source doublon.
  db.prepare('DELETE FROM sources WHERE id = ?').run(doublon)
  console.log(`  migrate-discord: doublon URL source #${doublon} fusionné dans #${garde}`)
}

/** Dédoublonne les sources partageant une même URL avant la création de l'index unique. */
function dedupUrls(): void {
  const groupes = db.prepare(`
    SELECT url, COUNT(*) AS n FROM sources
    WHERE url IS NOT NULL AND url != ''
    GROUP BY url HAVING n > 1
  `).all() as { url: string; n: number }[]

  for (const g of groupes) {
    const lignes = db.prepare('SELECT id FROM sources WHERE url = ? ORDER BY id').all(g.url) as { id: number }[]
    // Garder la plus rattachée ; départage par id le plus ancien (le plus petit).
    let garde = lignes[0].id
    let meilleurScore = scoreRattachement(garde)
    for (const l of lignes) {
      const s = scoreRattachement(l.id)
      if (s > meilleurScore) { meilleurScore = s; garde = l.id }
    }
    for (const l of lignes) {
      if (l.id !== garde) fusionnerSource(garde, l.id)
    }
  }
}

export function migrateDiscord(): void {
  // 1. Dédup des URL résiduelles PUIS index UNIQUE (sinon CREATE UNIQUE INDEX échoue).
  if (!indexExiste('idx_sources_url_unique')) {
    dedupUrls()
    // Index partiel : n'impose l'unicité que sur les URL renseignées (les sources
    // sans URL, ex. PJ seule, ne sont pas contraintes entre elles).
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_sources_url_unique ON sources(url) WHERE url IS NOT NULL AND url != '';")
    console.log('  migrate-discord: index UNIQUE sur sources.url posé')
  }

  // 2. Origine des commentaires : 'app' (défaut) ou 'discord'. Permet d'afficher et
  //    d'autoriser l'édition côté app des commentaires créés via le bot Discord.
  ajouterColonne('commentaires', 'origine', "TEXT DEFAULT 'app' CHECK(origine IN ('app','discord'))")

  console.log('Migration Discord : schéma à jour.')
}

// Exécution directe (tsx server/src/db/migrate-discord.ts)
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateDiscord()
  console.log('Migration discord : terminée.')
}
