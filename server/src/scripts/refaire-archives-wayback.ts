/**
 * Refaire les copies locales anti-bot via la Wayback Machine.
 *
 * Certaines sources (Liberation, Le Monde...) bloquent tout fetch cote serveur
 * (murs Imperva / DataDome) : l'archivage automatique a capture le mur ("Please
 * enable JS", "support ID") au lieu de l'article. Ce script repere ces archives
 * anti-bot, cherche un instantane sur archive.org (qui n'est pas anti-bot),
 * extrait le vrai texte (readability sur l'instantane brut) et remplace l'archive.
 *
 * Idempotent (ne traite que les archives encore anti-bot). Les sources sans
 * instantane exploitable restent a completer a la main (Europresse).
 *
 *   A_LA_SOURCE_DB=<copie> npx tsx server/src/scripts/refaire-archives-wayback.ts          # dry-run
 *   A_LA_SOURCE_DB=<copie> npx tsx server/src/scripts/refaire-archives-wayback.ts --apply  # ecrit
 */
import db from '../lib/db.js'
import { extractReadability, compterMots } from '../lib/readability.js'

const APPLY = process.argv.includes('--apply')
const DB_PATH = process.env.A_LA_SOURCE_DB || ''
if (APPLY && /OneDrive|00_PERSO/i.test(DB_PATH)) {
  console.error('REFUS : --apply interdit sur la base canonique OneDrive. Travailler sur une copie puis swap.')
  process.exit(1)
}

const ANTIBOT = "(ar.contenu LIKE '%enable JavaScript%' OR ar.contenu LIKE '%support ID%' OR ar.contenu LIKE '%disable any ad blocker%')"

interface Src { id: number; url: string }

async function snapshot(url: string): Promise<{ timestamp: string; url: string } | null> {
  try {
    const r = await fetch('https://archive.org/wayback/available?url=' + encodeURIComponent(url), {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    const j = await r.json() as { archived_snapshots?: { closest?: { available?: boolean; timestamp: string; url: string } } }
    const s = j.archived_snapshots?.closest
    return s && s.available ? { timestamp: s.timestamp, url: s.url } : null
  } catch { return null }
}

async function main() {
  const rows = db.prepare(
    `SELECT DISTINCT s.id, s.url FROM sources s
     JOIN archives ar ON ar.source_id = s.id
     WHERE ar.statut = 'complete' AND ${ANTIBOT} AND s.url IS NOT NULL`
  ).all() as Src[]

  console.log(`Archives anti-bot a refaire : ${rows.length}${APPLY ? ' (APPLY)' : ' (dry-run)'}`)
  let ok = 0, ko = 0

  for (const s of rows) {
    const snap = await snapshot(s.url)
    if (!snap) { console.log(`  ${s.id} : pas d'instantane Wayback (a coller a la main)`); ko++; continue }
    const raw = snap.url.replace(/\/web\/(\d+)\//, '/web/$1id_/')
    const art = await extractReadability(raw)
    const n = art ? compterMots(art.content || '') : 0
    const mur = art ? /enable JavaScript|support ID|disable any ad blocker/i.test(art.textContent || '') : true
    if (!art || n < 150 || mur) { console.log(`  ${s.id} : extraction insuffisante (${n} mots)`); ko++; continue }
    console.log(`  ${s.id} : OK ${n} mots — ${(art.title || '').slice(0, 64)}`)
    if (APPLY) {
      const tx = db.transaction(() => {
        db.prepare(`DELETE FROM archives WHERE source_id = ? AND statut = 'complete' AND ${ANTIBOT.replace(/ar\./g, '')}`).run(s.id)
        db.prepare(`INSERT INTO archives (source_id, type, contenu, cree_par, nb_mots, statut) VALUES (?, 'html', ?, NULL, ?, 'complete')`)
          .run(s.id, art.content, n)
      })
      tx()
    }
    ok++
  }
  console.log(`Bilan : ${ok} refaite(s), ${ko} sans Wayback exploitable (a coller depuis Europresse).`)
}

main()
