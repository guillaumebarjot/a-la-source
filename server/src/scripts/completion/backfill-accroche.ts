/**
 * backfill-accroche.ts -- renseigne l'accroche manquante depuis le texte archive.
 *
 * Pour chaque source sans accroche disposant d'une archive non vide, on derive
 * un extrait propre (~200-300 caracteres, sans couper un mot) a partir du texte
 * de l'archive readability (HTML nettoye en texte brut).
 *
 * Ameliorations v2 du nettoyage :
 *  - nettoyerAmorce() enrichi dans _shared.ts : capture les fragments horaires
 *    « HH:MM Mis a jour », les auteurs « Par Prenom NOM · », les heures isolees
 *    « a 14h57 ».
 *  - Second passage nettoyerInterne() pour les residus de boilerplate qui
 *    tombent au milieu du texte apres conversion HTML (ex. « Temps de lecture :
 *    6min » insere par readability entre deux paragraphes).
 *
 * Idempotent : ne touche que les sources dont l'accroche est NULL/vide.
 *
 * Modes :
 *   (defaut) --dry-run : liste id + accroche proposee, n'ecrit rien.
 *   --apply            : applique sur la base A_LA_SOURCE_DB (jamais canonique).
 *
 * Usage dry-run :
 *   A_LA_SOURCE_DB=/tmp/als-fix.db npx tsx \
 *     server/src/scripts/completion/backfill-accroche.ts
 */
import { parseMode, openGuarded, banner, htmlToText, extraitPropre, nettoyerAmorce } from './_shared.js'

/**
 * Retire les residus de boilerplate qui peuvent apparaitre en milieu de texte
 * apres la conversion HTML->texte (readability insere parfois des meta-blocs
 * entre paragraphes). On ne retire que des patterns tres specifiques pour rester
 * best-effort.
 */
function nettoyerInterne(texte: string): string {
  return texte
    .replace(/\bTemps de lecture\s*:?\s*\d+\s*min(?:utes?)?\b\s*/gi, ' ')
    .replace(/\(DR\)\s*/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

interface Ligne {
  id: number
  titre: string
  contenu: string
}

function main(): void {
  const mode = parseMode()
  const db = openGuarded(mode)
  banner('Backfill accroche depuis le texte archivé', mode)

  // Une archive par source (la plus complete et la plus longue d'abord).
  // On exclut les archives anti-bot (readability bloque par JS) : si le contenu
  // contient "enable JS" ou "disable any ad blocker" c'est un faux-positif.
  const lignes = db
    .prepare(
      `SELECT s.id AS id, s.titre AS titre, a.contenu AS contenu
       FROM sources s
       JOIN archives a ON a.source_id = s.id
       WHERE (s.accroche IS NULL OR trim(s.accroche) = '')
         AND a.contenu IS NOT NULL
         AND length(trim(a.contenu)) > 50
         AND a.contenu NOT LIKE '%enable JS%'
         AND a.contenu NOT LIKE '%disable any ad blocker%'
         AND a.contenu NOT LIKE '%Please enable JavaScript%'
       GROUP BY s.id
       HAVING a.contenu = (
         SELECT a2.contenu FROM archives a2
         WHERE a2.source_id = s.id
           AND a2.contenu NOT LIKE '%enable JS%'
           AND a2.contenu NOT LIKE '%disable any ad blocker%'
         ORDER BY (a2.statut = 'complete') DESC, length(a2.contenu) DESC
         LIMIT 1
       )
       ORDER BY s.id`,
    )
    .all() as Ligne[]

  const totalSansAccroche = (
    db.prepare(`SELECT COUNT(*) c FROM sources WHERE accroche IS NULL OR trim(accroche) = ''`).get() as { c: number }
  ).c

  const propositions: { id: number; titre: string; accroche: string }[] = []
  for (const l of lignes) {
    // Pipeline de nettoyage : HTML -> texte brut -> purge residus internes -> purge amorce tete
    const brut = nettoyerInterne(htmlToText(l.contenu))
    const texte = nettoyerAmorce(brut)
    if (texte.length < 80) continue // trop court pour une accroche utile
    const accroche = extraitPropre(texte)
    if (accroche.length < 60) continue
    propositions.push({ id: l.id, titre: l.titre, accroche })
  }

  console.log(`Sources sans accroche : ${totalSansAccroche}`)
  console.log(`Accroches dérivables depuis l'archive : ${propositions.length}`)
  console.log(`Non couvertes (pas d'archive exploitable) : ${totalSansAccroche - propositions.length}`)
  console.log('')

  if (!mode.apply) {
    for (const p of propositions) {
      console.log(`[${p.id}] ${p.titre.slice(0, 70)}`)
      console.log(`   → ${p.accroche}`)
    }
    console.log('')
    console.log('DRY-RUN : aucune écriture. Relancer avec --apply pour appliquer.')
    db.close()
    return
  }

  const stmt = db.prepare(
    `UPDATE sources SET accroche = @accroche
     WHERE id = @id AND (accroche IS NULL OR trim(accroche) = '')`,
  )
  let n = 0
  const tx = db.transaction((rows: typeof propositions) => {
    for (const p of rows) n += stmt.run({ id: p.id, accroche: p.accroche }).changes
  })
  tx(propositions)
  console.log(`APPLY : ${n} accroche(s) écrite(s).`)
  db.close()
}

main()
