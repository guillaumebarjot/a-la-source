/**
 * Ingestion Discord v2 — logique reutilisable (testable hors gateway).
 *
 * Couvre : liens (avec dedup), liens PDF directs, pieces jointes PDF (copie
 * integrale hors-ligne -> archive lisible dans l'app), pieces jointes .ris
 * (metadonnees), texte de commentaire, et le mapping message Discord <-> source
 * (pour rattacher editions, reponses et PJ posterieures a la bonne source).
 *
 * Tout est defensif : on logge et on continue, on ne throw jamais vers la gateway.
 */

import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { writeFileSync } from 'fs'
import db from '../lib/db.js'
import { fetchOpenGraph } from '../lib/opengraph.js'
import { extrairePdfTexte } from '../lib/pdftext.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
// server/dist/discord -> ../../.. = racine projet ; uploads/ y est servi en /uploads
const uploadsDir = join(__dirname, '..', '..', '..', 'uploads')

const URL_REGEX = /https?:\/\/[^\s<>"')]+/gi

// User-Agent explicite pour les telechargements (CDN Discord, etc.) : certains
// hotes (Cloudflare) refusent les requetes sans User-Agent.
const UA = 'alasource-bot/1.0 (+https://alasource.barjot.net)'

export function nettoyerUrl(brut: string): string {
  return brut.replace(/[.,;:!?]+$/, '').trim()
}

export function extraireUrls(texte: string): string[] {
  const m = texte.match(URL_REGEX)
  if (!m) return []
  return Array.from(new Set(m.map(nettoyerUrl).filter(Boolean)))
}

export function texteSansUrls(texte: string): string {
  return texte.replace(URL_REGEX, '').replace(/\s+/g, ' ').trim()
}

export function estLienPdf(url: string): boolean {
  return /\.pdf($|\?|#)/i.test(url)
}

export function lienApp(sourceId: number): string {
  const base = process.env.PUBLIC_BASE_URL || 'https://alasource.barjot.net'
  return `${base}/lire/${sourceId}`
}

export function sourcePourMessage(messageId: string): number | null {
  const r = db.prepare('SELECT source_id FROM discord_messages WHERE message_id = ?')
    .get(messageId) as { source_id: number } | undefined
  return r?.source_id ?? null
}

function lierMessageSource(messageId: string, sourceId: number, channelId: string): void {
  try {
    db.prepare('INSERT OR IGNORE INTO discord_messages (message_id, source_id, channel_id) VALUES (?, ?, ?)')
      .run(messageId, sourceId, channelId)
  } catch (err) { console.error('Discord: echec mapping message/source', err) }
}

interface ResultatLien { sourceId: number; nouveau: boolean }

/** Cree (ou retrouve, dedup par URL) une source de veille a partir d'une URL de page. */
async function ingererLien(url: string, soumisPar: number | null): Promise<ResultatLien | null> {
  try {
    const existe = db.prepare('SELECT id FROM sources WHERE url = ?').get(url) as { id: number } | undefined
    if (existe) return { sourceId: existe.id, nouveau: false }

    let titre = url
    try {
      const og = await fetchOpenGraph(url)
      if (og.title) titre = og.title
      else { try { titre = new URL(url).hostname } catch { /* garde l'URL */ } }
    } catch { /* best-effort */ }

    const apres = db.prepare('SELECT id FROM sources WHERE url = ?').get(url) as { id: number } | undefined
    if (apres) return { sourceId: apres.id, nouveau: false }

    const r = db.prepare(
      "INSERT INTO sources (titre, url, origine, statut, a_qualifier, soumis_par) VALUES (?, ?, 'discord', 'veille', 1, ?)"
    ).run(titre, url, soumisPar)
    return { sourceId: Number(r.lastInsertRowid), nouveau: true }
  } catch (err) {
    console.error('Discord: echec ingestion lien', url, err)
    return null
  }
}

/** Telecharge un PDF (PJ Discord ou lien direct) et l'attache comme copie integrale lisible. */
async function attacherPdf(sourceId: number, fileUrl: string, soumisPar: number | null): Promise<boolean> {
  try {
    const res = await fetch(fileUrl, { headers: { 'User-Agent': UA } })
    if (!res.ok) return false
    const buf = Buffer.from(await res.arrayBuffer())
    const nom = `archive-${sourceId}-${Date.now()}.pdf`
    writeFileSync(join(uploadsDir, nom), buf)
    // On garde le PDF (fidelite) ET on extrait le texte (lecture plus facile + recherche).
    const texte = await extrairePdfTexte(buf)
    const nbMots = texte ? texte.split(/\s+/).filter(Boolean).length : null
    db.prepare(
      "INSERT INTO archives (source_id, type, chemin, contenu, cree_par, nb_mots, statut) VALUES (?, 'pdf', ?, ?, ?, ?, 'complete')"
    ).run(sourceId, `uploads/${nom}`, texte || null, soumisPar, nbMots)
    db.prepare("UPDATE sources SET completude = 'integral_offline' WHERE id = ?").run(sourceId)
    return true
  } catch (err) {
    console.error('Discord: echec attache PDF', err)
    return false
  }
}

function trouverOuCreerMedia(nom: string): number | null {
  if (!nom) return null
  const e = db.prepare('SELECT id FROM medias WHERE nom = ?').get(nom) as { id: number } | undefined
  if (e) return e.id
  const r = db.prepare('INSERT INTO medias (nom) VALUES (?)').run(nom)
  return Number(r.lastInsertRowid)
}

/** Parse minimal d'un fichier RIS (export Europresse/Zotero) -> metadonnees. */
export function parserRis(texte: string): {
  titre?: string; auteur?: string; media?: string; date?: string; resume?: string; url?: string
} {
  const out: { titre?: string; auteur?: string; media?: string; date?: string; resume?: string; url?: string } = {}
  for (const ligne of texte.split(/\r?\n/)) {
    const m = ligne.match(/^([A-Z0-9]{2})\s+-\s+(.*)$/)
    if (!m) continue
    const tag = m[1]
    const v = m[2].trim()
    if (!v) continue
    switch (tag) {
      case 'TI': case 'T1': if (!out.titre) out.titre = v; break
      case 'AU': case 'A1': if (!out.auteur) out.auteur = v; break
      case 'JO': case 'JF': case 'T2': case 'PB': if (!out.media) out.media = v; break
      case 'DA': case 'PY': case 'Y1': if (!out.date) out.date = v.replace(/\//g, '-').slice(0, 10); break
      case 'AB': if (!out.resume) out.resume = v; break
      case 'UR': if (!out.url) out.url = v; break
    }
  }
  return out
}

async function importerRis(sourceId: number, fileUrl: string): Promise<boolean> {
  try {
    const res = await fetch(fileUrl, { headers: { 'User-Agent': UA } })
    if (!res.ok) return false
    const ris = parserRis(await res.text())
    const src = db.prepare('SELECT titre, url, media_id, date_publication, accroche FROM sources WHERE id = ?')
      .get(sourceId) as { titre: string; url: string | null; media_id: number | null; date_publication: string | null; accroche: string | null } | undefined
    if (!src) return false
    if (ris.titre && (!src.titre || src.titre === src.url)) db.prepare('UPDATE sources SET titre = ? WHERE id = ?').run(ris.titre, sourceId)
    if (ris.date && !src.date_publication) db.prepare('UPDATE sources SET date_publication = ? WHERE id = ?').run(ris.date, sourceId)
    if (ris.resume && !src.accroche) db.prepare('UPDATE sources SET accroche = ? WHERE id = ?').run(ris.resume.slice(0, 500), sourceId)
    if (ris.media && !src.media_id) { const mid = trouverOuCreerMedia(ris.media); if (mid) db.prepare('UPDATE sources SET media_id = ? WHERE id = ?').run(mid, sourceId) }
    return true
  } catch (err) {
    console.error('Discord: echec import RIS', err)
    return false
  }
}

function ajouterCommentaire(sourceId: number, contenu: string, auteurId: number | null): boolean {
  // commentaires.auteur_id est NOT NULL : un membre non rapproche ne peut pas
  // etre credite. On n'insere pas (l'INSERT echouerait et le commentaire serait
  // perdu silencieusement) et on le signale a l'appelant.
  if (auteurId == null) return false
  try {
    // Idempotent : une edition Discord repetee ne doit pas dupliquer le commentaire.
    const ex = db.prepare("SELECT 1 FROM commentaires WHERE source_id = ? AND type = 'commentaire' AND contenu = ?")
      .get(sourceId, contenu)
    if (ex) return true
    db.prepare("INSERT INTO commentaires (source_id, auteur_id, type, contenu) VALUES (?, ?, 'commentaire', ?)")
      .run(sourceId, auteurId, contenu)
    return true
  } catch (err) { console.error('Discord: echec commentaire', err); return false }
}

/** Ajoute un lien alternatif (souvent la version sans paywall ajoutee par edition). Idempotent. */
function ajouterLienAlternatif(sourceId: number, url: string, auteurId: number | null): boolean {
  // commentaires.auteur_id est NOT NULL (cf. ajouterCommentaire) : sans membre
  // rapproche, on n'insere pas plutot que de laisser l'INSERT echouer.
  if (auteurId == null) return false
  try {
    const ex = db.prepare("SELECT 1 FROM commentaires WHERE source_id = ? AND type = 'lien' AND url = ?")
      .get(sourceId, url)
    if (ex) return false
    db.prepare("INSERT INTO commentaires (source_id, auteur_id, type, contenu, url) VALUES (?, ?, 'lien', ?, ?)")
      .run(sourceId, auteurId, 'Version accessible (sans paywall)', url)
    return true
  } catch (err) { console.error('Discord: echec lien alternatif', err); return false }
}

export interface PieceJointe { url: string; nom: string; contentType?: string | null }

export interface ResultatTraitement { sourceIds: number[]; lignes: string[] }

/**
 * Traite un message (creation ou edition) : liens, PDF, RIS, commentaire.
 * `sourceExistante` : source deja rattachee (cas reponse Discord a un message
 * deja ingere, ou edition). Renvoie de quoi composer la reponse du bot.
 */
export async function traiterMessage(opts: {
  messageId: string
  channelId: string
  texte: string
  pjs: PieceJointe[]
  soumisPar: number | null
  sourceExistante?: number | null
}): Promise<ResultatTraitement> {
  const { messageId, channelId, texte, pjs, soumisPar } = opts
  const urls = extraireUrls(texte)
  const pdfUrls = urls.filter(estLienPdf)
  const pageUrls = urls.filter((u) => !estLienPdf(u))
  const commentaire = texteSansUrls(texte)

  const sourceIds: number[] = []
  const lignes: string[] = []
  // Mode rattachement : edition d'un message deja ingere, ou reponse Discord a un
  // message deja ingere. Les URL supplementaires y sont des liens alternatifs de la
  // source existante (ex. version sans paywall), pas de nouvelles sources.
  const rattachement = (opts.sourceExistante ?? sourcePourMessage(messageId)) != null
  let courante: number | null = opts.sourceExistante ?? sourcePourMessage(messageId)

  // 1. Liens de page
  for (const url of pageUrls) {
    if (rattachement && courante != null) {
      const dejaSource = db.prepare('SELECT id FROM sources WHERE url = ?').get(url) as { id: number } | undefined
      if (dejaSource && dejaSource.id === courante) continue // c'est l'URL de la source elle-meme
      if (ajouterLienAlternatif(courante, url, soumisPar)) {
        lignes.push(`🔓 Lien accessible ajouté → ${lienApp(courante)}`)
      }
      continue
    }
    const r = await ingererLien(url, soumisPar)
    if (!r) continue
    sourceIds.push(r.sourceId)
    lierMessageSource(messageId, r.sourceId, channelId)
    if (courante == null) courante = r.sourceId
    lignes.push(r.nouveau
      ? `📥 Ajouté à la veille. 👉 Lire et commenter sur À la source : ${lienApp(r.sourceId)}`
      : `↩️ Déjà sur À la source. 👉 Lire et commenter : ${lienApp(r.sourceId)}`)
  }

  // 2. Liens PDF directs
  for (const url of pdfUrls) {
    if (courante == null) {
      const r = await ingererLien(url, soumisPar)
      if (!r) continue
      courante = r.sourceId
      sourceIds.push(r.sourceId)
      lierMessageSource(messageId, r.sourceId, channelId)
    }
    if (await attacherPdf(courante, url, soumisPar)) {
      lignes.push(`📎 PDF intégral joint. 👉 Lire et commenter sur À la source : ${lienApp(courante)}`)
    }
  }

  // 3. Pieces jointes (PDF, RIS)
  for (const pj of pjs) {
    const ct = (pj.contentType || '').toLowerCase()
    const estPdf = /\.pdf$/i.test(pj.nom) || ct.includes('pdf')
    const estRis = /\.ris$/i.test(pj.nom) || ct.includes('research-info')
    if (!estPdf && !estRis) continue
    if (courante == null) continue // PJ sans source rattachable : ignoree (l'appelant gere les reponses)
    if (estPdf && await attacherPdf(courante, pj.url, soumisPar)) {
      lignes.push(`📎 PDF intégral joint. 👉 Lire et commenter sur À la source : ${lienApp(courante)}`)
    } else if (estRis && await importerRis(courante, pj.url)) {
      lignes.push(`🏷️ Métadonnées RIS importées → ${lienApp(courante)}`)
    }
  }

  // 4. Texte de commentaire (au-dela des URLs)
  if (commentaire && courante != null) {
    const ok = ajouterCommentaire(courante, commentaire, soumisPar)
    if (!ok && soumisPar == null) {
      lignes.push('📝 Pour que ton commentaire soit enregistré et te soit attribué, renseigne ton pseudo Discord dans l\'app (Mon espace → Mon compte).')
    }
  }

  return { sourceIds, lignes }
}
