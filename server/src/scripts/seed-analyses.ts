/**
 * seed-analyses.ts — Amorcer des analyses de mécanismes médiatiques sur les
 * sources d'À la source qui disposent d'une COPIE LOCALE (archive de texte
 * intégral, statut 'complete').
 *
 * Une analyse = un lien dans `source_mecanismes` (source_id, mecanisme_id,
 * justification, extrait, identifie_par). Le catalogue de référence est la
 * table `mecanismes_reference` (25 mécanismes, lus en base).
 *
 * DOCTRINE (R1, exigence de l'utilisateur) :
 *   - CONSERVATEUR : on n'attribue un mécanisme que s'il est CLAIREMENT présent
 *     dans le texte archivé, extrait verbatim à l'appui. 0, 1 ou au plus 2
 *     mécanismes par source. Dans le doute, on n'attribue RIEN. Mieux vaut une
 *     source sans analyse qu'une analyse forcée.
 *   - ANONYME : identifie_par = NULL (jamais un utilisateur, jamais « Claude »).
 *   - IN EXTENSO : l'`extrait` est une citation EXACTE du texte archivé, jamais
 *     une paraphrase. Au chargement, chaque décision est revérifiée contre le
 *     texte de l'archive (nettoyé en texte brut) ; toute décision dont l'extrait
 *     ne se retrouve pas mot pour mot est ÉCARTÉE (ni dry-run, ni apply). Cela
 *     rend le script sûr et portable d'une base à l'autre (canonique, prod).
 *
 * IDEMPOTENT : on n'insère un couple (source_id, mecanisme_id) que s'il n'existe
 * pas déjà. Relance à l'identique = 0 nouvelle insertion.
 *
 * SÉCURITÉ : réutilise le garde-fou de completion/_shared.ts (refuse --apply sur
 * un chemin qui ressemble à la canonique OneDrive). Mode --dry-run par défaut :
 * il n'écrit rien.
 *
 *   A_LA_SOURCE_DB=/tmp/als-analyses.db npx tsx server/src/scripts/seed-analyses.ts            # dry-run
 *   A_LA_SOURCE_DB=/tmp/als-analyses.db npx tsx server/src/scripts/seed-analyses.ts --apply    # écrit
 *
 * NB : l'application aux bases (canonique, prod) reste à l'orchestrateur. Ce
 * script ne touche QUE la base pointée par A_LA_SOURCE_DB.
 */
import type { Database as DatabaseType } from 'better-sqlite3'
import { parseMode, openGuarded, banner, htmlToText } from './completion/_shared.js'

/**
 * Une décision d'analyse. mecanisme_nom est le nom EXACT dans
 * mecanismes_reference (résolu en id au chargement, pour rester portable même si
 * les ids diffèrent d'une base à l'autre). justification = une phrase courte.
 * extrait = citation EXACTE tirée du texte archivé (revérifiée au chargement).
 */
interface Decision {
  source_id: number
  mecanisme_nom: string
  justification: string
  extrait: string
}

/**
 * Décisions encodées en données. Sélection volontairement RESTREINTE : seules
 * les sources où un mécanisme est manifeste, avec un extrait verbatim. La grande
 * majorité des sources à copie locale ne reçoit AUCUNE analyse (texte trop
 * factuel, reportage neutre, dépêche, page sans contenu d'article, PDF binaire).
 */
const DECISIONS: Decision[] = [
  // ── Source 73 — « Le contrôle des prix ne fonctionne (toujours) pas »
  // Tribune d'opinion économique. Deux mécanismes manifestes.
  {
    source_id: 73,
    mecanisme_nom: "Argument d'autorité",
    justification:
      "La thèse est scellée par l'invocation de Milton Friedman plutôt que par une démonstration sur le cas discuté.",
    extrait:
      'Pour paraphraser Friedman, l’inflation est toujours et partout un problème d’offre inférieure à la demande.',
  },
  {
    source_id: 73,
    mecanisme_nom: 'Naturalisation',
    justification:
      "Un choix de politique économique contestable est présenté comme une loi naturelle et quasi éternelle de l'histoire.",
    extrait:
      'C’est une leçon (quasi) éternelle de l’histoire économique : le plafonnement des prix est une fausse bonne idée.',
  },

  // ── Source 71 — « Fiscalité des riches : le mirage des milliards d'euros »
  // Étude d'un think tank (IFRAP). Un taux d'imposition global maximal est mis
  // en avant pour soutenir que les plus riches sont déjà sur-imposés.
  {
    source_id: 71,
    mecanisme_nom: 'Chiffre-paravent',
    justification:
      "Un taux d'imposition cumulé spectaculaire (66,8 %) est mis en avant pour suggérer que toute taxation supplémentaire serait injuste.",
    extrait:
      ", et même 66,8% si on y ajoute les impôts indirects type TVA (contre 45,6% pour l'ensemble des Français).",
  },

  // ── Source 64 — Rapport Institut Thomas More sur l'audiovisuel public
  // L'autorité de l'IA est invoquée pour présenter les résultats comme neutres.
  {
    source_id: 64,
    mecanisme_nom: "Argument d'autorité",
    justification:
      "La neutralité des conclusions est garantie par l'autorité prêtée à l'IA, présentée comme productrice de résultats objectifs.",
    extrait:
      'celle-ci produit des résultats neutres, fiables et débarrassés des biais et affects personnels humains.',
  },

  // ── Source 98 — « Budget 2026 : les plus riches peuvent dormir tranquilles »
  // Tract militant. Registre émotionnel et ironique pour court-circuiter le débat.
  {
    source_id: 98,
    mecanisme_nom: "Appel à l'émotion",
    justification:
      "Le registre ironique et indigné ('poudre de perlimpinpin') mobilise l'émotion plutôt que l'analyse des mesures.",
    extrait: 'De la poudre de perlimpinpin !',
  },

  // ── Source 296 — « 2025, l'année du bilinguisme » (Collectivité d'Alsace)
  // Communication institutionnelle : un projet politique d'identité présenté
  // comme une évidence naturelle et historique.
  {
    source_id: 296,
    mecanisme_nom: 'Naturalisation',
    justification:
      "Un choix politique de promotion identitaire est présenté comme une 'opportunité historique' naturelle pour le territoire.",
    extrait:
      'La compétence bilinguisme de la Collectivité européenne d’Alsace est une opportunité historique pour le territoire alsacien de renforcer sa singularité',
  },
]

/** Récupère le texte brut de l'archive 'complete' la plus complète d'une source. */
function texteArchiveComplete(db: DatabaseType, sourceId: number): string {
  const row = db
    .prepare(
      `SELECT contenu FROM archives
       WHERE source_id = ? AND statut = 'complete' AND contenu IS NOT NULL AND length(contenu) > 0
       ORDER BY COALESCE(nb_mots, length(contenu)) DESC
       LIMIT 1`,
    )
    .get(sourceId) as { contenu: string } | undefined
  return row?.contenu ? htmlToText(row.contenu) : ''
}

function main(): void {
  const mode = parseMode()
  const db = openGuarded(mode)
  banner('Analyses de mécanismes médiatiques (sources à copie locale) — conservateur, anonyme', mode)

  // Résolution des ids de mécanismes par nom, normalisé (minuscule, sans accents)
  // pour rester portable : certaines bases stockent les noms sans accents
  // (« Argument d'autorite »), d'autres avec.
  const normNom = (s: string): string =>
    (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .trim()
  const mecanismes = db.prepare(`SELECT id, nom FROM mecanismes_reference`).all() as {
    id: number
    nom: string
  }[]
  const nomToId = new Map(mecanismes.map((m) => [normNom(m.nom), m.id]))

  // Couples (source_id, mecanisme_id) déjà présents : on ne double jamais.
  const dejaPresents = new Set(
    (db.prepare(`SELECT source_id, mecanisme_id FROM source_mecanismes`).all() as {
      source_id: number
      mecanisme_id: number
    }[]).map((r) => `${r.source_id}:${r.mecanisme_id}`),
  )

  const aInserer: { d: Decision; mecanisme_id: number }[] = []
  const ecartees: { d: Decision; raison: string }[] = []
  const dejaLa: Decision[] = []

  for (const d of DECISIONS) {
    const mecId = nomToId.get(normNom(d.mecanisme_nom))
    if (mecId == null) {
      ecartees.push({ d, raison: `mécanisme inconnu en base : « ${d.mecanisme_nom} »` })
      continue
    }
    // Source doit exister ET avoir une archive 'complete'.
    const src = db.prepare(`SELECT id, titre FROM sources WHERE id = ?`).get(d.source_id) as
      | { id: number; titre: string }
      | undefined
    if (!src) {
      ecartees.push({ d, raison: 'source introuvable' })
      continue
    }
    const texte = texteArchiveComplete(db, d.source_id)
    if (!texte) {
      ecartees.push({ d, raison: "pas d'archive 'complete' exploitable (copie locale absente)" })
      continue
    }
    // R1 : l'extrait DOIT se retrouver mot pour mot dans le texte archivé.
    if (!texte.includes(d.extrait)) {
      ecartees.push({ d, raison: 'extrait non retrouvé in extenso dans le texte archivé' })
      continue
    }
    if (dejaPresents.has(`${d.source_id}:${mecId}`)) {
      dejaLa.push(d)
      continue
    }
    aInserer.push({ d, mecanisme_id: mecId })
  }

  // Rapport.
  const titreStmt = db.prepare(`SELECT titre FROM sources WHERE id = ?`)
  const titreDe = (id: number) =>
    ((titreStmt.get(id) as { titre: string } | undefined)?.titre ?? '').slice(0, 60)

  console.log(`Décisions encodées          : ${DECISIONS.length}`)
  console.log(`À insérer (nouvelles)       : ${aInserer.length}`)
  console.log(`Déjà présentes (idempotent) : ${dejaLa.length}`)
  console.log(`Écartées (sécurité R1)      : ${ecartees.length}`)
  console.log('')

  const parMec = new Map<string, number>()
  const parSrc = new Set<number>()
  for (const { d } of aInserer) {
    parMec.set(d.mecanisme_nom, (parMec.get(d.mecanisme_nom) ?? 0) + 1)
    parSrc.add(d.source_id)
  }
  if (aInserer.length) {
    console.log('Répartition par mécanisme (à insérer) :')
    for (const [nom, n] of [...parMec.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  - ${nom} : ${n}`)
    }
    console.log('')
    console.log('Détail des insertions prévues :')
    for (const { d } of aInserer) {
      console.log(`  [${d.source_id}] ${titreDe(d.source_id)} → ${d.mecanisme_nom}`)
      console.log(`      extrait : « ${d.extrait.slice(0, 90)}${d.extrait.length > 90 ? '…' : ''} »`)
    }
    console.log('')
    console.log(
      `Sources concernées : ${parSrc.size} | moyenne ${(aInserer.length / Math.max(1, parSrc.size)).toFixed(2)} mécanisme(s)/source`,
    )
    console.log('')
  }
  if (ecartees.length) {
    console.log('Écartées :')
    for (const { d, raison } of ecartees) {
      console.log(`  [${d.source_id}] ${d.mecanisme_nom} — ${raison}`)
    }
    console.log('')
  }

  if (!mode.apply) {
    console.log('DRY-RUN : aucune écriture. identifie_par sera NULL. Relancer avec --apply pour appliquer.')
    db.close()
    return
  }

  const ins = db.prepare(
    `INSERT INTO source_mecanismes (source_id, mecanisme_id, identifie_par, justification, extrait)
     VALUES (@source_id, @mecanisme_id, NULL, @justification, @extrait)`,
  )
  let n = 0
  const tx = db.transaction((rows: typeof aInserer) => {
    for (const { d, mecanisme_id } of rows) {
      // Garde anti-doublon final, au cas où (transaction = état figé).
      const existe = db
        .prepare(
          `SELECT 1 FROM source_mecanismes WHERE source_id = ? AND mecanisme_id = ? LIMIT 1`,
        )
        .get(d.source_id, mecanisme_id)
      if (existe) continue
      ins.run({
        source_id: d.source_id,
        mecanisme_id,
        justification: d.justification,
        extrait: d.extrait,
      })
      n += 1
    }
  })
  tx(aInserer)
  console.log(`APPLY : ${n} analyse(s) source_mecanismes créée(s), identifie_par = NULL.`)
  db.close()
}

main()
