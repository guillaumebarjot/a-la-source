/**
 * dedup-sources.ts — détecte les doublons de sources et propose une fusion.
 *
 * Détection sur deux clés : URL normalisée (scheme/www/slash/query retirés) et
 * titre normalisé (accents/casse/ponctuation lissés). Pour chaque groupe, on
 * indique quelle ligne porte le plus de rattachements (archives, sujets, tags,
 * mécanismes, activités) : c'est la ligne à CONSERVER ; les autres seraient
 * fusionnées vers elle.
 *
 * DRY-RUN UNIQUEMENT : aucune écriture, même avec --apply. La fusion est un
 * geste manuel prudent (réattribution des rattachements puis suppression), à
 * exécuter à la main après validation. Le script produit le diagnostic et le
 * plan de fusion proposé.
 *
 * Usage :
 *   A_LA_SOURCE_DB=/tmp/als-completion.db npx tsx \
 *     server/src/scripts/completion/dedup-sources.ts
 */
import { parseMode, openGuarded, banner, normaliserUrl } from './_shared.js'

interface Src {
  id: number
  titre: string
  url: string | null
  date_publication: string | null
  accroche: string | null
  image_url: string | null
}

function normaliserTitre(t: string): string {
  return (t || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function compterRattachements(db: import('better-sqlite3').Database, id: number): {
  archives: number
  sujets: number
  tags: number
  mecanismes: number
  activites: number
  total: number
} {
  const c = (sql: string) => (db.prepare(sql).get(id) as { c: number }).c
  const archives = c('SELECT COUNT(*) c FROM archives WHERE source_id = ?')
  const sujets = c('SELECT COUNT(*) c FROM sujet_sources WHERE source_id = ?')
  const tags = c('SELECT COUNT(*) c FROM source_tags WHERE source_id = ?')
  const mecanismes = c('SELECT COUNT(*) c FROM source_mecanismes WHERE source_id = ?')
  const activites = c('SELECT COUNT(*) c FROM activite_sources WHERE source_id = ?')
  return {
    archives,
    sujets,
    tags,
    mecanismes,
    activites,
    total: archives + sujets + tags + mecanismes + activites,
  }
}

function main(): void {
  const mode = parseMode()
  const db = openGuarded(mode)
  banner('Détection de doublons de sources (dry-run uniquement)', mode)

  const sources = db
    .prepare(
      `SELECT id, titre, url, date_publication, accroche, image_url FROM sources ORDER BY id`,
    )
    .all() as Src[]

  // Regroupement par clé URL puis par clé titre.
  const parUrl = new Map<string, Src[]>()
  const parTitre = new Map<string, Src[]>()
  for (const s of sources) {
    const ku = s.url ? normaliserUrl(s.url) : ''
    if (ku) {
      if (!parUrl.has(ku)) parUrl.set(ku, [])
      parUrl.get(ku)!.push(s)
    }
    const kt = normaliserTitre(s.titre)
    if (kt) {
      if (!parTitre.has(kt)) parTitre.set(kt, [])
      parTitre.get(kt)!.push(s)
    }
  }

  const dejaVu = new Set<string>()
  const groupes: { cle: string; type: string; membres: Src[] }[] = []
  for (const [k, arr] of parUrl) if (arr.length > 1) groupes.push({ cle: k, type: 'URL', membres: arr })
  for (const [k, arr] of parTitre) {
    if (arr.length > 1) {
      const ids = arr
        .map((s) => s.id)
        .sort((a, b) => a - b)
        .join(',')
      if (!dejaVu.has(ids)) groupes.push({ cle: k, type: 'TITRE', membres: arr })
    }
  }
  // marque les groupes URL pour éviter le doublon URL+TITRE redondant
  for (const g of groupes.filter((x) => x.type === 'URL')) {
    dejaVu.add(
      g.membres
        .map((s) => s.id)
        .sort((a, b) => a - b)
        .join(','),
    )
  }
  const groupesFiltres = groupes.filter((g, i) => {
    if (g.type === 'TITRE') {
      const ids = g.membres
        .map((s) => s.id)
        .sort((a, b) => a - b)
        .join(',')
      // garder si pas déjà couvert par un groupe URL identique
      const couvertParUrl = groupes.some(
        (o, j) =>
          j !== i &&
          o.type === 'URL' &&
          o.membres
            .map((s) => s.id)
            .sort((a, b) => a - b)
            .join(',') === ids,
      )
      return !couvertParUrl
    }
    return true
  })

  console.log(`Sources totales : ${sources.length}`)
  console.log(`Groupes de doublons détectés : ${groupesFiltres.length}`)
  console.log('')

  for (const g of groupesFiltres) {
    console.log(`--- Doublon par ${g.type} : ${g.cle.slice(0, 80)}`)
    const enrichis = g.membres.map((s) => ({ s, r: compterRattachements(db, s.id) }))
    // ligne à conserver = la plus rattachée, puis la plus complète, puis id le plus petit
    enrichis.sort((a, b) => {
      if (b.r.total !== a.r.total) return b.r.total - a.r.total
      const ca = (a.s.accroche ? 1 : 0) + (a.s.image_url ? 1 : 0)
      const cb = (b.s.accroche ? 1 : 0) + (b.s.image_url ? 1 : 0)
      if (cb !== ca) return cb - ca
      return a.s.id - b.s.id
    })
    const garder = enrichis[0]
    for (const e of enrichis) {
      const flag = e === garder ? 'CONSERVER' : 'fusionner→'
      console.log(
        `   [${e.s.id}] ${flag}  rattach=${e.r.total} ` +
          `(arch=${e.r.archives} suj=${e.r.sujets} tag=${e.r.tags} mec=${e.r.mecanismes} act=${e.r.activites}) ` +
          `| ${e.s.titre.slice(0, 55)}`,
      )
    }
    console.log(
      `   → Plan : conserver ${garder.s.id}, réattribuer les rattachements des autres vers ${garder.s.id}, puis supprimer les autres.`,
    )
    console.log('')
  }

  console.log('DRY-RUN UNIQUEMENT : aucune fusion appliquée (geste manuel prudent).')
  db.close()
}

main()
