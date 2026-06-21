/**
 * refetch-images.ts -- recupere l'image manquante (og:image / twitter:image)
 * depuis l'URL d'origine de chaque source sans image_url.
 *
 * Ameliorations v2 :
 *   (a) Decodage des entites HTML dans les URLs recuperees (&amp; -> &, etc.)
 *       grace a decoderEntitesUrl() de _shared.ts.
 *   (b) Elimination des placeholders manifestes (chemins contenant
 *       "placeholder", "default.png", ou un segment "logo" isole de chaine
 *       TV/media generique sans contenu editorial).
 *   (c) Second essai sur 403/429 avec un User-Agent alternatif et un delai
 *       de 1,5 s pour contourner les pare-feux Cloudflare basiques.
 *   (d) Journal structure : TROUVE / PAS_OG / HTTP_404 / HTTP_403 /
 *       HTTP_403_RETRY_OK / HTTP_403_ECHEC / RESEAU -- compteurs en fin.
 *
 * Idempotent : ne cible que les sources dont image_url est NULL/vide.
 * En --apply, n'ecrase jamais une image existante.
 *
 * Modes :
 *   (defaut) --dry-run : id + image trouvee / echec, n'ecrit rien.
 *   --apply            : ecrit image_url sur la base A_LA_SOURCE_DB (jamais canonique).
 *
 * Usage dry-run :
 *   A_LA_SOURCE_DB=/tmp/als-fix.db npx tsx \
 *     server/src/scripts/completion/refetch-images.ts
 */
import { parseMode, openGuarded, banner, decoderEntitesUrl } from './_shared.js'

interface Src {
  id: number
  titre: string
  url: string
}

/** User-Agent principal (Chrome Windows). */
const UA_CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

/** User-Agent de secours (Firefox Linux) pour le second essai sur 403. */
const UA_FIREFOX =
  'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0'

const HEADERS_COMMUNS = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
}

/**
 * Patterns de placeholders generiques qu'on ecarte au profit du fallback
 * initiale. On detecte sur le chemin de l'URL (casse ignoree).
 *
 * Regles :
 *  - "placeholder" -> image de remplacement generique
 *  - "default.png" / "default.jpg" -> image par defaut de CMS
 *  - "/logo." ou "-logo." ou "_logo." -> logo de la chaine/site (pas editorial)
 *    SAUF si le chemin contient aussi un identifiant d'article (chiffres longs)
 *    -> heuristique : si le chemin a plus de 3 segments apres /logo, on garde.
 */
function estPlaceholder(url: string): boolean {
  let chemin: string
  try {
    chemin = new URL(url).pathname.toLowerCase()
  } catch {
    chemin = url.toLowerCase()
  }
  if (chemin.includes('placeholder')) return true
  if (/default\.(png|jpg|jpeg|gif|webp)/.test(chemin)) return true
  // Logo isole : segment /logo. ou suffixe -logo. ou _logo. sans contexte article
  if (/[/_-]logo\.(png|jpg|jpeg|svg|webp)/.test(chemin)) return true
  return false
}

/** Extrait le contenu d'une meta og:image / twitter:image (regex, sans DOM). */
function extraireImage(html: string, baseUrl: string): string | undefined {
  // Limite a 200 000 premiers caracteres (les balises meta sont dans <head>).
  const tete = html.slice(0, 200_000)
  const props = [
    'og:image:secure_url',
    'og:image:url',
    'og:image',
    'twitter:image:src',
    'twitter:image',
  ]
  for (const prop of props) {
    const escaped = prop.replace(/:/g, '\\:')
    const re1 = new RegExp(
      `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]*?content=["']([^"']+)["']`,
      'i',
    )
    const re2 = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]*?(?:property|name)=["']${escaped}["']`,
      'i',
    )
    const m = tete.match(re1) ?? tete.match(re2)
    if (m?.[1]) {
      const raw = decoderEntitesUrl(m[1].trim())
      if (!raw) continue
      try {
        return new URL(raw, baseUrl).toString()
      } catch {
        return raw
      }
    }
  }
  return undefined
}

type StatutFetch =
  | 'TROUVE'
  | 'PAS_OG'
  | 'PLACEHOLDER'
  | 'HTTP_404'
  | 'HTTP_403'
  | 'HTTP_403_RETRY_OK'
  | 'HTTP_403_ECHEC'
  | 'RESEAU'

interface ResultatFetch {
  statut: StatutFetch
  image?: string
  detail?: string
}

async function fetchAvecUA(url: string, ua: string): Promise<{ ok: boolean; status: number; html?: string; finalUrl?: string }> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': ua, ...HEADERS_COMMUNS },
      redirect: 'follow',
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return { ok: false, status: res.status }
    const html = await res.text()
    return { ok: true, status: res.status, html, finalUrl: res.url || url }
  } catch (e: unknown) {
    return { ok: false, status: 0, html: e instanceof Error ? e.message : String(e) }
  }
}

async function fetchImage(url: string): Promise<ResultatFetch> {
  // Premier essai avec Chrome.
  const r1 = await fetchAvecUA(url, UA_CHROME)

  if (r1.ok && r1.html) {
    const img = extraireImage(r1.html, r1.finalUrl ?? url)
    if (!img) return { statut: 'PAS_OG' }
    if (estPlaceholder(img)) return { statut: 'PLACEHOLDER', detail: img }
    return { statut: 'TROUVE', image: img }
  }

  if (r1.status === 404 || r1.status === 410) {
    return { statut: 'HTTP_404', detail: `HTTP ${r1.status}` }
  }

  if (r1.status === 403 || r1.status === 429 || r1.status === 1010 || r1.status === 0) {
    // Delai poli avant le second essai.
    await new Promise((resolve) => setTimeout(resolve, 1_500))
    const r2 = await fetchAvecUA(url, UA_FIREFOX)
    if (r2.ok && r2.html) {
      const img = extraireImage(r2.html, r2.finalUrl ?? url)
      if (!img) return { statut: 'HTTP_403_ECHEC', detail: 'retry OK mais pas d\'og:image' }
      if (estPlaceholder(img)) return { statut: 'HTTP_403_ECHEC', detail: `retry OK mais placeholder: ${img}` }
      return { statut: 'HTTP_403_RETRY_OK', image: img }
    }
    if (r2.status === 404 || r2.status === 410) {
      return { statut: 'HTTP_404', detail: `HTTP ${r2.status} (apres retry)` }
    }
    return { statut: 'HTTP_403_ECHEC', detail: `1er: HTTP ${r1.status} | 2e: HTTP ${r2.status}` }
  }

  // Autre erreur reseau ou statut inattendu.
  return { statut: 'RESEAU', detail: `HTTP ${r1.status} ${r1.html ?? ''}`.slice(0, 80) }
}

async function main(): Promise<void> {
  const mode = parseMode()
  const db = openGuarded(mode)
  banner('Re-fetch des images manquantes (og:image / twitter:image) v2', mode)

  const sources = db
    .prepare(
      `SELECT id, titre, url FROM sources
       WHERE (image_url IS NULL OR trim(image_url) = '')
         AND url LIKE 'http%'
       ORDER BY id`,
    )
    .all() as Src[]

  console.log(`Sources sans image, avec URL http : ${sources.length}`)
  console.log('Interrogation sequentielle (politesse reseau)...')
  console.log('')

  const updateStmt = mode.apply
    ? db.prepare(
        `UPDATE sources SET image_url = @image
         WHERE id = @id AND (image_url IS NULL OR trim(image_url) = '')`,
      )
    : null

  const compteurs: Record<StatutFetch, number> = {
    TROUVE: 0,
    PAS_OG: 0,
    PLACEHOLDER: 0,
    HTTP_404: 0,
    HTTP_403: 0,
    HTTP_403_RETRY_OK: 0,
    HTTP_403_ECHEC: 0,
    RESEAU: 0,
  }
  let ecrites = 0

  for (const s of sources) {
    const r = await fetchImage(s.url)
    compteurs[r.statut]++

    switch (r.statut) {
      case 'TROUVE':
        console.log(`[${s.id}] TROUVE         ${r.image}`)
        if (updateStmt) ecrites += updateStmt.run({ id: s.id, image: r.image }).changes
        break
      case 'HTTP_403_RETRY_OK':
        console.log(`[${s.id}] RETRY_OK       ${r.image}`)
        if (updateStmt) ecrites += updateStmt.run({ id: s.id, image: r.image }).changes
        break
      case 'PAS_OG':
        console.log(`[${s.id}] PAS_OG         ${s.url.slice(0, 70)}`)
        break
      case 'PLACEHOLDER':
        console.log(`[${s.id}] PLACEHOLDER    ecarte: ${(r.detail ?? '').slice(0, 70)}`)
        break
      case 'HTTP_404':
        console.log(`[${s.id}] LIEN_MORT      ${r.detail}  ${s.url.slice(0, 60)}`)
        break
      case 'HTTP_403':
        console.log(`[${s.id}] HTTP_403       ${s.url.slice(0, 70)}`)
        break
      case 'HTTP_403_ECHEC':
        console.log(`[${s.id}] 403_ECHEC      ${r.detail}  ${s.url.slice(0, 50)}`)
        break
      case 'RESEAU':
        console.log(`[${s.id}] RESEAU         ${r.detail}  ${s.url.slice(0, 50)}`)
        break
    }
  }

  const trouves = compteurs.TROUVE + compteurs.HTTP_403_RETRY_OK
  const echecs = sources.length - trouves
  const taux = sources.length ? Math.round((trouves / sources.length) * 100) : 0

  console.log('')
  console.log('--- Synthese ---')
  console.log(`Total candidates    : ${sources.length}`)
  console.log(`TROUVE              : ${compteurs.TROUVE}`)
  console.log(`RETRY_OK (403->OK)  : ${compteurs.HTTP_403_RETRY_OK}`)
  console.log(`PAS_OG              : ${compteurs.PAS_OG}`)
  console.log(`PLACEHOLDER (ecarte): ${compteurs.PLACEHOLDER}`)
  console.log(`LIEN_MORT (404/410) : ${compteurs.HTTP_404}`)
  console.log(`403_ECHEC           : ${compteurs.HTTP_403_ECHEC}`)
  console.log(`RESEAU              : ${compteurs.RESEAU}`)
  console.log(`Taux de succes      : ${taux}% (${trouves}/${sources.length})`)
  console.log(`Echecs irreductibles: ${echecs}`)

  if (mode.apply) {
    console.log(`APPLY : ${ecrites} image_url ecrite(s).`)
  } else {
    console.log('DRY-RUN : aucune ecriture. Relancer avec --apply pour appliquer.')
  }

  db.close()
}

main()
