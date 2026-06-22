/**
 * cache-images-local.ts -- telecharge en local les images des sources (anti
 * link-rot et anti-hotlink durable) dans image-cache/source-<id>.<ext>, et
 * reecrit image_url en /images/source-<id>.<ext>.
 *
 * Deux cas :
 *  (a) image_url http(s) externe -> on telecharge directement cette URL.
 *  (b) image_url = /images/source-N deja local mais FICHIER MANQUANT -> on
 *      re-derive l'og:image depuis l'URL d'origine de la source, puis on
 *      telecharge.
 * En cas d'echec (403, lien mort, pas d'og), on LAISSE l'image_url telle quelle
 * (le front sait afficher l'externe via referrerPolicy, ou le repli initiale).
 *
 * Sorties : fichiers dans IMG_OUT_DIR ; en --apply, met a jour la base
 * A_LA_SOURCE_DB ET ecrit un patch SQL (IMG_SQL_OUT) d'UPDATE image_url, pour
 * application sur la prod sans swap de base.
 *
 * Usage :
 *   A_LA_SOURCE_DB=/tmp/als-work.db IMG_OUT_DIR=/tmp/als-image-cache \
 *   IMG_SQL_OUT=/tmp/als-image-patch.sql \
 *   npx tsx server/src/scripts/completion/cache-images-local.ts --apply
 */
import Database from 'better-sqlite3'
import { existsSync, mkdirSync, writeFileSync, appendFileSync } from 'fs'
import { join } from 'path'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const HEADERS = {
  'User-Agent': UA,
  Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.5',
}

const apply = process.argv.includes('--apply')
const DB = process.env.A_LA_SOURCE_DB || ''
const OUT = process.env.IMG_OUT_DIR || ''
const SQL_OUT = process.env.IMG_SQL_OUT || ''
if (!DB || !existsSync(DB)) { console.error(`A_LA_SOURCE_DB introuvable : ${DB}`); process.exit(1) }
if (!OUT) { console.error('IMG_OUT_DIR non defini'); process.exit(1) }
if (apply && /OneDrive|00_PERSO/i.test(DB)) { console.error('REFUS : base canonique OneDrive'); process.exit(1) }
mkdirSync(OUT, { recursive: true })
if (apply && SQL_OUT) writeFileSync(SQL_OUT, '-- Patch image_url (cache local). Genere par cache-images-local.ts\n')

const EXT_PAR_MIME: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'image/gif': 'gif', 'image/avif': 'avif', 'image/svg+xml': 'svg',
}

function extDepuis(url: string, mime?: string): string {
  if (mime && EXT_PAR_MIME[mime.split(';')[0].trim()]) return EXT_PAR_MIME[mime.split(';')[0].trim()]
  const m = url.split('?')[0].match(/\.(jpe?g|png|webp|gif|avif|svg)$/i)
  return m ? m[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg'
}

function extraireOgImage(html: string, baseUrl: string): string | undefined {
  const tete = html.slice(0, 200_000)
  for (const prop of ['og:image:secure_url', 'og:image:url', 'og:image', 'twitter:image:src', 'twitter:image']) {
    const e = prop.replace(/:/g, '\\:')
    const m =
      tete.match(new RegExp(`<meta[^>]+(?:property|name)=["']${e}["'][^>]*?content=["']([^"']+)["']`, 'i')) ??
      tete.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*?(?:property|name)=["']${e}["']`, 'i'))
    if (m?.[1]) {
      try { return new URL(m[1].trim().replace(/&amp;/g, '&'), baseUrl).toString() } catch { return m[1].trim() }
    }
  }
  return undefined
}

async function telecharger(imgUrl: string, id: number): Promise<string | undefined> {
  try {
    const res = await fetch(imgUrl, { headers: HEADERS, redirect: 'follow', signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return undefined
    const mime = res.headers.get('content-type') || ''
    if (!mime.startsWith('image/')) return undefined
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 1024) return undefined // trop petit = pixel/erreur
    const ext = extDepuis(imgUrl, mime)
    const nom = `source-${id}.${ext}`
    writeFileSync(join(OUT, nom), buf)
    return `/images/${nom}`
  } catch { return undefined }
}

async function ogPuisTelecharger(srcUrl: string, id: number): Promise<string | undefined> {
  try {
    const res = await fetch(srcUrl, { headers: { ...HEADERS, Accept: 'text/html,*/*' }, redirect: 'follow', signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return undefined
    const og = extraireOgImage(await res.text(), res.url || srcUrl)
    if (!og) return undefined
    return telecharger(og, id)
  } catch { return undefined }
}

interface Src { id: number; url: string; image_url: string }

async function main(): Promise<void> {
  const db = new Database(DB, { readonly: !apply })
  if (apply) db.pragma('journal_mode = DELETE')
  const httpImgs = db.prepare("SELECT id, url, image_url FROM sources WHERE image_url LIKE 'http%' ORDER BY id").all() as Src[]
  const localCasses = db.prepare("SELECT id, url, image_url FROM sources WHERE image_url LIKE '/images/%' ORDER BY id").all() as Src[]
  const upd = apply ? db.prepare('UPDATE sources SET image_url = @p WHERE id = @id') : null

  let okHttp = 0, echecHttp = 0, okLocal = 0, echecLocal = 0
  console.log(`Images http a cacher : ${httpImgs.length} | chemins locaux a (re)remplir : ${localCasses.length}`)

  for (const s of httpImgs) {
    const local = await telecharger(s.image_url, s.id)
    if (local) {
      okHttp++
      if (upd) { upd.run({ p: local, id: s.id }); if (SQL_OUT) appendFileSync(SQL_OUT, `UPDATE sources SET image_url='${local}' WHERE id=${s.id};\n`) }
      console.log(`[${s.id}] CACHE   ${local}`)
    } else { echecHttp++; console.log(`[${s.id}] ECHEC   (garde externe) ${s.image_url.slice(0, 60)}`) }
  }
  for (const s of localCasses) {
    const local = await ogPuisTelecharger(s.url, s.id)
    if (local) {
      okLocal++
      if (upd) { upd.run({ p: local, id: s.id }); if (SQL_OUT) appendFileSync(SQL_OUT, `UPDATE sources SET image_url='${local}' WHERE id=${s.id};\n`) }
      console.log(`[${s.id}] REREMPLI ${local}`)
    } else { echecLocal++; console.log(`[${s.id}] OG_ECHEC (chemin local reste casse) ${s.url.slice(0, 55)}`) }
  }

  console.log('\n--- Synthese ---')
  console.log(`http caches : ${okHttp}/${httpImgs.length} (echecs ${echecHttp}, externe conserve)`)
  console.log(`locaux re-remplis : ${okLocal}/${localCasses.length} (echecs ${echecLocal})`)
  console.log(apply ? `APPLY : base ${DB} mise a jour${SQL_OUT ? `, patch SQL -> ${SQL_OUT}` : ''}.` : 'DRY-RUN : aucune ecriture.')
  db.close()
}
main()
