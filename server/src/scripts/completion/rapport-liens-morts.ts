/**
 * rapport-liens-morts.ts -- detecte les sources dont l'URL est un lien mort
 * (HTTP 404 / 410 / ENOTFOUND) et produit un rapport pour traitement manuel.
 *
 * LECTURE SEULE UNIQUEMENT : n'ecrit jamais rien dans la base, meme avec
 * --apply. La decision de supprimer ou d'archiver un lien mort appartient a
 * Guillaume (risque de perte de source editoriale).
 *
 * Comportement :
 *  - Parcourt toutes les sources avec une URL http*.
 *  - Envoie une requete HEAD (rapide, pas de transfert de corps) avec fallback
 *    GET si le serveur refuse HEAD.
 *  - Classifie : MORT_404 / MORT_410 / MORT_RESEAU / REDIRIGE / VIVANT.
 *  - Produit un rapport consolide en fin de run avec les URLs mortes.
 *
 * Idempotent et rejouable : aucun etat persiste entre deux executions.
 *
 * Usage :
 *   A_LA_SOURCE_DB=/tmp/als-fix.db npx tsx \
 *     server/src/scripts/completion/rapport-liens-morts.ts
 *
 *   # Ou sur la canonique en lecture seule (aucun --apply possible de toute facon) :
 *   A_LA_SOURCE_DB="/Users/invite/Library/CloudStorage/OneDrive-ARTELIA/00_PERSO/A la source/a-la-source.db" \
 *     npx tsx server/src/scripts/completion/rapport-liens-morts.ts
 */
import { parseMode, openGuarded, banner } from './_shared.js'

interface Src {
  id: number
  titre: string
  url: string
  date_publication: string | null
}

type StatutLien = 'VIVANT' | 'REDIRIGE' | 'MORT_404' | 'MORT_410' | 'MORT_AUTRE' | 'RESEAU'

interface ResultatLien {
  statut: StatutLien
  codeHttp?: number
  detail?: string
  urlFinale?: string
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const HEADERS = {
  'User-Agent': UA,
  Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9',
}

async function verifierLien(url: string): Promise<ResultatLien> {
  // 1. Essai HEAD (leger).
  try {
    const resHead = await fetch(url, {
      method: 'HEAD',
      headers: HEADERS,
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
    })
    if (resHead.status === 404) return { statut: 'MORT_404', codeHttp: 404 }
    if (resHead.status === 410) return { statut: 'MORT_410', codeHttp: 410 }
    if (resHead.ok) {
      const urlFinale = resHead.url && resHead.url !== url ? resHead.url : undefined
      return { statut: urlFinale ? 'REDIRIGE' : 'VIVANT', codeHttp: resHead.status, urlFinale }
    }
    // Certains serveurs refusent HEAD avec 405 / 403 : on tente GET.
    if (resHead.status === 405 || resHead.status === 403 || resHead.status === 400) {
      const resGet = await fetch(url, {
        method: 'GET',
        headers: HEADERS,
        redirect: 'follow',
        signal: AbortSignal.timeout(12_000),
      })
      if (resGet.status === 404) return { statut: 'MORT_404', codeHttp: 404 }
      if (resGet.status === 410) return { statut: 'MORT_410', codeHttp: 410 }
      if (resGet.ok) {
        const urlFinale = resGet.url && resGet.url !== url ? resGet.url : undefined
        return { statut: urlFinale ? 'REDIRIGE' : 'VIVANT', codeHttp: resGet.status, urlFinale }
      }
      return { statut: 'MORT_AUTRE', codeHttp: resGet.status }
    }
    return { statut: 'MORT_AUTRE', codeHttp: resHead.status }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    // ENOTFOUND, ECONNREFUSED, TimeoutError = lien definitif mort reseau
    const definitif =
      msg.includes('ENOTFOUND') ||
      msg.includes('ECONNREFUSED') ||
      msg.includes('ERR_NAME_NOT_RESOLVED')
    return {
      statut: definitif ? 'MORT_AUTRE' : 'RESEAU',
      detail: msg.slice(0, 120),
    }
  }
}

async function main(): Promise<void> {
  const mode = parseMode()
  // Ce script est lecture seule : on ouvre en readonly meme si --apply est passe.
  const modeForce = { ...mode, apply: false }
  const db = openGuarded(modeForce)
  banner('Rapport des liens morts (lecture seule, idempotent)', modeForce)

  if (mode.apply) {
    console.log('NOTE : --apply ignore pour ce script (lecture seule par conception).')
    console.log('')
  }

  const sources = db
    .prepare(
      `SELECT id, titre, url, date_publication FROM sources
       WHERE url LIKE 'http%'
       ORDER BY id`,
    )
    .all() as Src[]

  console.log(`Sources avec URL http a verifier : ${sources.length}`)
  console.log('Verification sequentielle (HEAD puis GET si refus)...')
  console.log('')

  const morts: { src: Src; r: ResultatLien }[] = []
  const compteurs: Record<StatutLien, number> = {
    VIVANT: 0,
    REDIRIGE: 0,
    MORT_404: 0,
    MORT_410: 0,
    MORT_AUTRE: 0,
    RESEAU: 0,
  }

  for (const s of sources) {
    const r = await verifierLien(s.url)
    compteurs[r.statut]++

    const estMort = r.statut === 'MORT_404' || r.statut === 'MORT_410' || r.statut === 'MORT_AUTRE'
    if (estMort) {
      morts.push({ src: s, r })
      console.log(`[${s.id}] ${r.statut.padEnd(12)} HTTP ${r.codeHttp ?? '---'}  ${s.url.slice(0, 70)}`)
    } else if (r.statut === 'RESEAU') {
      console.log(`[${s.id}] RESEAU       ${r.detail}`)
    }
    // VIVANT et REDIRIGE : silencieux pour ne pas noyer le rapport.
  }

  console.log('')
  console.log('=== RAPPORT LIENS MORTS ===')
  console.log('')

  if (morts.length === 0) {
    console.log('Aucun lien mort detecte.')
  } else {
    console.log(`${morts.length} lien(s) mort(s) detecte(s) :`)
    console.log('')
    for (const { src, r } of morts) {
      console.log(`[${src.id}] ${r.statut} (HTTP ${r.codeHttp ?? '---'})`)
      console.log(`    Titre : ${src.titre.slice(0, 80)}`)
      console.log(`    URL   : ${src.url}`)
      if (src.date_publication) console.log(`    Date  : ${src.date_publication}`)
      console.log('')
    }
  }

  console.log('--- Synthese ---')
  console.log(`VIVANT              : ${compteurs.VIVANT}`)
  console.log(`REDIRIGE            : ${compteurs.REDIRIGE}`)
  console.log(`MORT_404            : ${compteurs.MORT_404}`)
  console.log(`MORT_410            : ${compteurs.MORT_410}`)
  console.log(`MORT_AUTRE (autres) : ${compteurs.MORT_AUTRE}`)
  console.log(`RESEAU (timeout...) : ${compteurs.RESEAU}`)
  console.log(`Total verifie       : ${sources.length}`)
  console.log('')
  console.log('ACTION : aucune ecriture effectuee. Les liens morts sont a traiter manuellement')
  console.log('(archiver la source, pointer vers une version archive.org, ou supprimer).')

  db.close()
}

main()
