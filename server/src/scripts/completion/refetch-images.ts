/**
 * refetch-images.ts — récupère l'image manquante (og:image / twitter:image)
 * depuis l'URL d'origine de chaque source sans image_url.
 *
 * Utilise le fetch global de Node 22 (aucune dépendance ajoutée). Mémo projet :
 * Cloudflare renvoie 403/1010 sans User-Agent explicite -> on envoie un UA de
 * navigateur réel (aligné sur lib/opengraph.ts) et des en-têtes Accept. Timeout
 * court (12 s) pour ne pas bloquer le lot.
 *
 * Idempotent : ne cible que les sources dont image_url est NULL/vide. En --apply,
 * n'écrase jamais une image existante.
 *
 * Modes :
 *   (défaut) --dry-run : id + image trouvée / échec, n'écrit rien.
 *   --apply            : écrit image_url sur la base A_LA_SOURCE_DB (jamais canonique).
 *
 * Usage dry-run :
 *   A_LA_SOURCE_DB=/tmp/als-completion.db npx tsx \
 *     server/src/scripts/completion/refetch-images.ts
 */
import { parseMode, openGuarded, banner } from './_shared.js'

interface Src {
  id: number
  titre: string
  url: string
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// Extrait le contenu d'une meta og:image / twitter:image sans dépendance DOM.
function extractImage(html: string, baseUrl: string): string | undefined {
  const head = html.slice(0, 200000) // les balises meta sont dans le <head>
  const props = [
    'og:image:secure_url',
    'og:image:url',
    'og:image',
    'twitter:image:src',
    'twitter:image',
  ]
  for (const prop of props) {
    // property="og:image" content="..."  OU  content="..." property="og:image"
    const re1 = new RegExp(
      `<meta[^>]+(?:property|name)=["']${prop.replace(/[:]/g, '\\$&')}["'][^>]*?content=["']([^"']+)["']`,
      'i',
    )
    const re2 = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]*?(?:property|name)=["']${prop.replace(/[:]/g, '\\$&')}["']`,
      'i',
    )
    const m = head.match(re1) || head.match(re2)
    if (m && m[1]) {
      const raw = m[1].trim()
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

async function fetchImage(url: string): Promise<{ image?: string; erreur?: string }> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.5',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return { erreur: `HTTP ${res.status}` }
    const html = await res.text()
    const image = extractImage(html, res.url || url)
    return image ? { image } : { erreur: 'pas d’og:image' }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.name + (e.message ? `: ${e.message}` : '') : String(e)
    return { erreur: msg }
  }
}

async function main(): Promise<void> {
  const mode = parseMode()
  const db = openGuarded(mode)
  banner('Re-fetch des images manquantes (og:image / twitter:image)', mode)

  const sources = db
    .prepare(
      `SELECT id, titre, url FROM sources
       WHERE (image_url IS NULL OR trim(image_url) = '')
         AND url LIKE 'http%'
       ORDER BY id`,
    )
    .all() as Src[]

  console.log(`Sources sans image, avec URL http : ${sources.length}`)
  console.log('Interrogation séquentielle (politesse réseau)…')
  console.log('')

  const updateStmt = mode.apply
    ? db.prepare(
        `UPDATE sources SET image_url = @image
         WHERE id = @id AND (image_url IS NULL OR trim(image_url) = '')`,
      )
    : null

  let ok = 0
  let ko = 0
  let ecrites = 0
  for (const s of sources) {
    const r = await fetchImage(s.url)
    if (r.image) {
      ok++
      console.log(`[${s.id}] OK  ${r.image}`)
      if (updateStmt) ecrites += updateStmt.run({ id: s.id, image: r.image }).changes
    } else {
      ko++
      console.log(`[${s.id}] --  ${r.erreur}  (${s.url.slice(0, 60)})`)
    }
  }

  const taux = sources.length ? Math.round((ok / sources.length) * 100) : 0
  console.log('')
  console.log(`Récupérées : ${ok} | Échecs : ${ko} | Taux de succès : ${taux}%`)
  if (mode.apply) console.log(`APPLY : ${ecrites} image_url écrite(s).`)
  else console.log('DRY-RUN : aucune écriture. Relancer avec --apply pour appliquer.')
  db.close()
}

main()
