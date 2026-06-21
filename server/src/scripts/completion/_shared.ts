/**
 * Helpers partagés des scripts de complétion BDD (Chantier 3).
 *
 * SÉCURITÉ ABSOLUE : ces scripts ne touchent JAMAIS la base canonique OneDrive.
 * Ils ouvrent leur PROPRE connexion sur la base pointée par A_LA_SOURCE_DB et,
 * en mode --apply, refusent de s'exécuter si ce chemin ressemble à la canonique
 * (présence de "OneDrive" / "00_PERSO" dans le chemin) ou si A_LA_SOURCE_DB est
 * absent. Le mode par défaut est --dry-run : il n'écrit rien.
 *
 * On n'importe volontairement PAS ../../lib/db.js : ce module force le chemin
 * canonique. Ici on veut une connexion isolée et contrôlée.
 */
import Database, { type Database as DatabaseType } from 'better-sqlite3'
import { existsSync } from 'fs'

export interface RunMode {
  apply: boolean
  dbPath: string
}

/**
 * Détermine le mode (dry-run par défaut) et le chemin de base.
 * --apply active l'écriture ; le chemin vient EXCLUSIVEMENT de A_LA_SOURCE_DB.
 */
export function parseMode(): RunMode {
  const apply = process.argv.includes('--apply')
  const dbPath = process.env.A_LA_SOURCE_DB || ''
  return { apply, dbPath }
}

/**
 * Garde-fou : refuse une base introuvable, ou (en --apply) une base qui
 * ressemble à la canonique OneDrive. Renvoie une connexion ouverte.
 */
export function openGuarded(mode: RunMode): DatabaseType {
  if (!mode.dbPath) {
    console.error(
      'A_LA_SOURCE_DB non défini. Ces scripts ne ciblent JAMAIS la base canonique en dur.\n' +
        'Exemple : A_LA_SOURCE_DB=/tmp/als-completion.db npx tsx <script>.ts',
    )
    process.exit(1)
  }
  if (!existsSync(mode.dbPath)) {
    console.error(`Base introuvable : ${mode.dbPath}`)
    process.exit(1)
  }
  const looksCanonical = /OneDrive|00_PERSO/i.test(mode.dbPath)
  if (mode.apply && looksCanonical) {
    console.error(
      'REFUS : --apply pointe une base qui ressemble à la canonique OneDrive.\n' +
        `Chemin : ${mode.dbPath}\n` +
        'Appliquer d\'abord sur une COPIE, puis sur la canonique uniquement après\n' +
        'validation de Guillaume et backup (voir docs/completion-bdd-plan.md).',
    )
    process.exit(1)
  }
  const db = new Database(mode.dbPath, { readonly: !mode.apply })
  // En lecture seule on ne peut pas changer le journal_mode (écriture interdite).
  if (mode.apply) {
    db.pragma('journal_mode = DELETE')
    db.pragma('foreign_keys = ON')
  }
  return db
}

/** Bannière d'en-tête commune. */
export function banner(titre: string, mode: RunMode): void {
  const m = mode.apply ? 'APPLY (écriture)' : 'DRY-RUN (lecture seule, aucune écriture)'
  console.log(`# ${titre}`)
  console.log(`Mode : ${m}`)
  console.log(`Base : ${mode.dbPath}`)
  console.log('')
}

/**
 * Convertit un fragment HTML d'archive readability en texte brut lisible :
 * retire scripts/styles, remplace les balises de bloc par des espaces, décode
 * les entités courantes, normalise les blancs.
 */
export function htmlToText(html: string): string {
  if (!html) return ''
  let t = html
  t = t.replace(/<script[\s\S]*?<\/script>/gi, ' ')
  t = t.replace(/<style[\s\S]*?<\/style>/gi, ' ')
  // balises de bloc -> séparateur
  t = t.replace(/<\/(p|div|li|h[1-6]|section|article|br|tr)>/gi, ' ')
  t = t.replace(/<br\s*\/?>/gi, ' ')
  // toute autre balise -> rien
  t = t.replace(/<[^>]+>/g, '')
  // entités courantes
  const ent: Record<string, string> = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&rsquo;': '’',
    '&laquo;': '«',
    '&raquo;': '»',
    '&eacute;': 'é',
    '&egrave;': 'è',
    '&agrave;': 'à',
    '&ccedil;': 'ç',
  }
  t = t.replace(/&[a-z#0-9]+;/gi, (m) => ent[m.toLowerCase()] ?? ' ')
  // normalisation des blancs
  t = t.replace(/\s+/g, ' ').trim()
  return t
}

/**
 * Retire les amorces de boilerplate fréquentes en tête d'article (dates de
 * publication, temps de lecture, mentions « Publié le… / Mis à jour… »,
 * crédits photo isolés). Best-effort : on ne retire que des motifs sûrs, pour
 * éviter de manger du vrai contenu. Itère tant qu'une amorce est trouvée.
 */
export function nettoyerAmorce(texte: string): string {
  let t = texte.trim()
  const motifs: RegExp[] = [
    /^Publi[ée]\s+le\s+[^.]*?(?:\d{1,2}\s*[hH:]\s*\d{2}|\d{4})\s*(?:,?\s*mis\s+à\s+jour[^.]*?(?:\d{1,2}\s*[hH:]\s*\d{2}|\d{4}))?\s*[.,·•|–-]?\s*/i,
    /^Mis\s+à\s+jour\s+le[^.]*?(?:\d{1,2}\s*[hH:]\s*\d{2}|\d{4})\s*[.,·•|–-]?\s*/i,
    /^Temps\s+de\s+lecture\s*:?\s*\d+\s*min\s*[.,·•|–-]?\s*/i,
    /^\d{1,2}\/\d{1,2}\/\d{2,4}\s+\d{1,2}[:hH]\d{2}\s*[.,·•|–-]?\s*/,
    /^\(DR\)\s*/i,
    /^Informations\s+Présenté\s+par[^.]*?\.\s*/i,
  ]
  let change = true
  while (change) {
    change = false
    for (const re of motifs) {
      const next = t.replace(re, '')
      if (next !== t) {
        t = next.trim()
        change = true
      }
    }
  }
  return t
}

/**
 * Extrait un résumé propre (~200-300 caractères) sans couper un mot.
 * Préfère une coupe sur une fin de phrase si elle tombe dans la fenêtre,
 * sinon coupe au dernier espace avant la borne et ajoute une ellipse.
 */
export function extraitPropre(texte: string, cibleMin = 200, cibleMax = 300): string {
  const t = texte.trim()
  if (t.length <= cibleMax) return t
  // tente une fin de phrase entre cibleMin et cibleMax
  const fenetre = t.slice(0, cibleMax + 1)
  const finPhrase = Math.max(
    fenetre.lastIndexOf('. '),
    fenetre.lastIndexOf('! '),
    fenetre.lastIndexOf('? '),
  )
  if (finPhrase >= cibleMin) {
    return t.slice(0, finPhrase + 1).trim()
  }
  // sinon coupe au dernier espace avant cibleMax
  let coupe = t.lastIndexOf(' ', cibleMax)
  if (coupe < cibleMin) coupe = cibleMax
  return t.slice(0, coupe).trim() + '…'
}

/** Normalise une URL pour comparaison de doublons (scheme/www/slash/query triviale). */
export function normaliserUrl(url: string): string {
  if (!url) return ''
  let u = url.trim().toLowerCase()
  u = u.replace(/^https?:\/\//, '')
  u = u.replace(/^www\./, '')
  u = u.replace(/[#?].*$/, '')
  u = u.replace(/\/+$/, '')
  return u
}
