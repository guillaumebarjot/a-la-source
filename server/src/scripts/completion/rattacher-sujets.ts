/**
 * rattacher-sujets.ts — propose un sujet pour les sources sans sujet.
 *
 * Pour chaque source orpheline de sujet (non présente dans sujet_sources), on
 * calcule un score de correspondance par mots-clés sur le titre + l'accroche +
 * le champ mots_cles + le texte de l'archive, contre un dictionnaire de termes
 * dérivé des sujets existants. Le meilleur sujet au-dessus d'un seuil est
 * proposé.
 *
 * Idempotent : ne touche que les sources sans sujet. En --apply, INSERT OR
 * IGNORE dans sujet_sources (jamais de doublon de rattachement).
 *
 * Modes :
 *   (défaut) --dry-run : id + sujet proposé (+ score), n'écrit rien.
 *   --apply            : INSERT OR IGNORE sur la base A_LA_SOURCE_DB (jamais canonique).
 *
 * Usage dry-run :
 *   A_LA_SOURCE_DB=/tmp/als-completion.db npx tsx \
 *     server/src/scripts/completion/rattacher-sujets.ts
 */
import { parseMode, openGuarded, banner, htmlToText } from './_shared.js'

// Dictionnaire de mots-clés par slug de sujet (termes en minuscule, sans accents
// gérés par la normalisation). Conçu à partir des 27 sujets existants ; vise les
// 15 sources actuellement sans sujet sans rien inventer hors des thèmes connus.
const MOTS_CLES_SUJET: Record<string, string[]> = {
  'sante-deserts-medicaux-alsace-nord': ['sante mentale', 'psy', 'psychologue', 'soin', 'medecin', 'hopital', 'sante'],
  'discriminations-acces-soins': ['discrimination', 'acces aux soins', 'obesite', 'endometriose', 'gyneco'],
  'violences-gyneco-obstetricales': ['endometriose', 'gyneco', 'obstetric', 'femme'],
  'pouvoir-achat-energie': ['controle des prix', 'prix', 'pouvoir d achat', 'energie', 'inflation', 'cout de la vie'],
  'fiscalite-superprofits-patrimoine': ['aide alimentaire', 'pauvre', 'precarite', 'superprofit', 'patrimoine', 'fiscalite', 'impot'],
  'desinformation-reseaux-sociaux': ['algorithme', 'desinformation', 'reseaux sociaux', 'ia', 'intelligence artificielle'],
  'megabassines-accaparement-eau': ['eau', 'nappe', 'source', 'nestle waters', 'nestle', 'aquifere', 'pollution eau', 'mineral'],
  'pfas-nappe-rhenane': ['pfas', 'nappe rhenane', 'pollution', 'polluant eternel'],
  'ecole-numerique': ['telephone portable', 'lycee', 'ecole', 'numerique', 'smartphone'],
  'alimentation-ultra-transformee': ['obesite', 'alimentation', 'ultra transforme', 'malbouffe', 'nutrition'],
  'reforme-retraites-temps-travail': ['emploi', 'metier', 'travail', 'chomage', 'retraite', 'ia emploi'],
  'inondations-risques-alsace-nord': ['secheresse', 'inondation', 'restriction d eau', 'risque', 'meteo', 'climat'],
}

interface Sujet {
  id: number
  slug: string
  titre: string
}
interface Src {
  id: number
  titre: string
  accroche: string | null
  mots_cles: string | null
}

function norm(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

function main(): void {
  const mode = parseMode()
  const db = openGuarded(mode)
  banner('Rattachement des sources sans sujet (proposition par mots-clés)', mode)

  const sujets = db.prepare(`SELECT id, slug, titre FROM sujets`).all() as Sujet[]
  const slugToId = new Map(sujets.map((s) => [s.slug, s.id]))

  const orphelines = db
    .prepare(
      `SELECT id, titre, accroche, mots_cles FROM sources
       WHERE id NOT IN (SELECT source_id FROM sujet_sources)
       ORDER BY id`,
    )
    .all() as Src[]

  const archiveStmt = db.prepare(
    `SELECT contenu FROM archives WHERE source_id = ?
     ORDER BY (statut='complete') DESC, length(contenu) DESC LIMIT 1`,
  )

  const propositions: { id: number; titre: string; slug: string; score: number }[] = []
  const sansProp: Src[] = []

  for (const o of orphelines) {
    const arch = archiveStmt.get(o.id) as { contenu: string } | undefined
    const archTxt = arch?.contenu ? htmlToText(arch.contenu).slice(0, 4000) : ''
    const hay = norm([o.titre, o.accroche || '', o.mots_cles || '', archTxt].join(' '))

    let meilleur: { slug: string; score: number } | null = null
    for (const [slug, termes] of Object.entries(MOTS_CLES_SUJET)) {
      if (!slugToId.has(slug)) continue
      let score = 0
      for (const t of termes) {
        const tn = norm(t)
        // poids fort si le terme apparaît dans titre/accroche, faible si seulement archive
        // Poids fort si le terme est dans le titre (signal éditorial le plus net),
        // moyen dans accroche/mots_cles, faible si seulement dans le corps archivé.
        const inTitre = norm(o.titre).includes(tn)
        const inAcc = norm(`${o.accroche || ''} ${o.mots_cles || ''}`).includes(tn)
        if (inTitre) score += 5
        else if (inAcc) score += 3
        else if (hay.includes(tn)) score += 1
      }
      if (score > 0 && (!meilleur || score > meilleur.score)) meilleur = { slug, score }
    }

    if (meilleur && meilleur.score >= 3) {
      propositions.push({ id: o.id, titre: o.titre, slug: meilleur.slug, score: meilleur.score })
    } else {
      sansProp.push(o)
    }
  }

  console.log(`Sources sans sujet : ${orphelines.length}`)
  console.log(`Propositions (score ≥ 3) : ${propositions.length}`)
  console.log(`Sans proposition fiable : ${sansProp.length}`)
  console.log('')

  for (const p of propositions) {
    console.log(`[${p.id}] → ${p.slug} (score ${p.score})  | ${p.titre.slice(0, 60)}`)
  }
  if (sansProp.length) {
    console.log('')
    console.log('Sans proposition (à qualifier manuellement) :')
    for (const o of sansProp) console.log(`[${o.id}] ${o.titre.slice(0, 70)}`)
  }
  console.log('')

  if (!mode.apply) {
    console.log('DRY-RUN : aucune écriture. Relancer avec --apply pour appliquer les propositions.')
    db.close()
    return
  }

  const ins = db.prepare(
    `INSERT OR IGNORE INTO sujet_sources (sujet_id, source_id) VALUES (@sujet_id, @source_id)`,
  )
  let n = 0
  const tx = db.transaction((rows: typeof propositions) => {
    for (const p of rows) {
      const sid = slugToId.get(p.slug)
      if (sid) n += ins.run({ sujet_id: sid, source_id: p.id }).changes
    }
  })
  tx(propositions)
  console.log(`APPLY : ${n} rattachement(s) sujet_sources créé(s).`)
  db.close()
}

main()
