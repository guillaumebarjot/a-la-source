import db from './db.js'
import { calculerTiming } from './score.js'

/*
 * Methode de selection des sources — « decrire, ne pas noter ».
 *
 * On ne note plus une source par un score-verdict. On decrit le CORPUS d'un
 * atelier par son PROFIL DE DIVERSITE : sur plusieurs axes (medias, propriete,
 * types de source, sujets, mecanismes, duree), on compte les valeurs distinctes
 * et on observe la distribution. La qualite d'un atelier est une propriete
 * d'ENSEMBLE (diversite, contraste), pas une somme de notes individuelles.
 *
 * Aucun signal d'echo social (lectures, commentaires, viralite) n'entre ici :
 * la selection respecte par anticipation l'epoche de la projection.
 *
 * Tout derive de donnees deja presentes au socle ; aucun nouveau champ requis.
 * Voir la note de conception « Methode de selection des sources » (vault).
 */

export type AxeDiversiteCle =
  | 'medias'
  | 'propriete'
  | 'types'
  | 'sujets'
  | 'mecanismes'

export interface AxeDiversite {
  cle: AxeDiversiteCle
  label: string
  distinct: number                       // nb de valeurs distinctes dans le corpus
  total: number                          // nb de sources prises en compte (avec valeur connue)
  cible: number                          // seuil indicatif (alerte douce, jamais bloquant)
  atteint: boolean                       // distinct >= cible
  distribution: { valeur: string; n: number }[] // combien de sources par valeur
}

export interface ProfilDuree {
  total: number
  enZoneAtelier: number                  // timing 'A' = 5-10 min, ideal seance
  repartition: { timing: string; n: number }[]
}

export interface AlerteCorpus {
  axe: AxeDiversiteCle | 'duree'
  message: string                        // observation factuelle, jamais une faute
}

export interface CompletudeCorpus {
  total: number
  pretes: number                         // sources avec quality gate OK (evaluee+archivee+accroche)
}

export interface ProfilDiversite {
  nbSources: number
  axes: AxeDiversite[]
  duree: ProfilDuree
  alertes: AlerteCorpus[]
  completude: CompletudeCorpus
}

interface CiblesDiversite {
  medias: number
  propriete: number
  types: number
  sujets: number
  mecanismes: number
  dureeZoneMin: number                   // nb mini de sources en zone atelier (timing A)
  partMemeProprieteAlerte: number        // part (0..1) au-dela de laquelle on signale une sur-representation
}

const CIBLES_DEFAUT: CiblesDiversite = {
  medias: 5,
  propriete: 3,
  types: 4,
  sujets: 5,            // doctrine atelier : au moins 5 sujets parmi 8
  mecanismes: 4,
  dureeZoneMin: 3,
  partMemeProprieteAlerte: 0.6,
}

/** Cibles parametrables (table parametres, cle 'diversite_cibles'), defaut raisonnable. */
export function getCiblesDiversite(): CiblesDiversite {
  const row = db.prepare("SELECT valeur FROM parametres WHERE cle = 'diversite_cibles'").get() as { valeur: string } | undefined
  if (!row) return CIBLES_DEFAUT
  try {
    return { ...CIBLES_DEFAUT, ...(JSON.parse(row.valeur) as Partial<CiblesDiversite>) }
  } catch {
    return CIBLES_DEFAUT
  }
}

const LABELS: Record<AxeDiversiteCle, string> = {
  medias: 'Médias',
  propriete: 'Propriété',
  types: 'Types de source',
  sujets: 'Sujets',
  mecanismes: 'Mécanismes',
}

interface SourceLigne {
  id: number
  media_id: number | null
  media_nom: string | null
  type_propriete: string | null
  type_source: string | null
  duree_minutes: number | null
  duree_estimee: number | null
  timing_override: string | null
  accroche: string | null
}

/** Distribution = comptage par valeur, trie du plus frequent au moins frequent. */
function distribution(valeurs: (string | null)[]): { valeur: string; n: number }[] {
  const m = new Map<string, number>()
  for (const v of valeurs) {
    if (v == null || v === '') continue
    m.set(v, (m.get(v) ?? 0) + 1)
  }
  return [...m.entries()]
    .map(([valeur, n]) => ({ valeur, n }))
    .sort((a, b) => b.n - a.n)
}

function axe(cle: AxeDiversiteCle, valeurs: (string | null)[], cible: number): AxeDiversite {
  const dist = distribution(valeurs)
  const total = valeurs.filter(v => v != null && v !== '').length
  const distinct = dist.length
  return {
    cle,
    label: LABELS[cle],
    distinct,
    total,
    cible,
    atteint: distinct >= cible,
    distribution: dist,
  }
}

/**
 * Profil de diversite d'un corpus (liste de source ids).
 * Fonction pure (lecture seule), aucun effet de bord.
 */
export function profilDiversiteCorpus(sourceIds: number[]): ProfilDiversite {
  const cibles = getCiblesDiversite()
  const ids = [...new Set(sourceIds)].filter(n => Number.isFinite(n))

  if (ids.length === 0) {
    return {
      nbSources: 0,
      axes: [
        axe('medias', [], cibles.medias),
        axe('propriete', [], cibles.propriete),
        axe('types', [], cibles.types),
        axe('sujets', [], cibles.sujets),
        axe('mecanismes', [], cibles.mecanismes),
      ],
      duree: { total: 0, enZoneAtelier: 0, repartition: [] },
      alertes: [],
      completude: { total: 0, pretes: 0 },
    }
  }

  const placeholders = ids.map(() => '?').join(',')

  const sources = db.prepare(`
    SELECT s.id, s.media_id, m.nom AS media_nom, m.type_propriete,
           s.type_source, s.duree_minutes, s.duree_estimee, s.timing_override,
           s.accroche
    FROM sources s
    LEFT JOIN medias m ON m.id = s.media_id
    WHERE s.id IN (${placeholders})
  `).all(...ids) as SourceLigne[]

  // Sujets : tags de categorie 'thematique' rattaches aux sources du corpus.
  const sujetsRows = db.prepare(`
    SELECT t.nom
    FROM source_tags st
    JOIN tags t ON t.id = st.tag_id AND t.categorie = 'thematique'
    WHERE st.source_id IN (${placeholders})
  `).all(...ids) as { nom: string }[]

  // Mecanismes pressentis / identifies sur les sources du corpus.
  const mecaRows = db.prepare(`
    SELECT DISTINCT sm.source_id, mr.nom
    FROM source_mecanismes sm
    JOIN mecanismes_reference mr ON mr.id = sm.mecanisme_id
    WHERE sm.source_id IN (${placeholders})
  `).all(...ids) as { source_id: number; nom: string }[]

  // --- Axes ---
  const axeMedias = axe('medias', sources.map(s => s.media_nom), cibles.medias)
  const axePropriete = axe('propriete', sources.map(s => s.type_propriete), cibles.propriete)
  const axeTypes = axe('types', sources.map(s => s.type_source), cibles.types)
  const axeSujets = axe('sujets', sujetsRows.map(r => r.nom), cibles.sujets)
  const axeMecanismes = axe('mecanismes', mecaRows.map(r => r.nom), cibles.mecanismes)

  // --- Duree / format ---
  const timings = sources.map(s => calculerTiming(s.duree_estimee ?? s.duree_minutes ?? null, s.timing_override ?? null))
  const enZone = timings.filter(t => t === 'A').length
  const duree: ProfilDuree = {
    total: sources.length,
    enZoneAtelier: enZone,
    repartition: distribution(timings).map(d => ({ timing: d.valeur, n: d.n })),
  }

  // --- Completude (quality gate agregee, factuelle) ---
  let pretes = 0
  for (const s of sources) {
    const hasEvaluation = (db.prepare('SELECT COUNT(*) AS n FROM evaluations WHERE source_id = ?').get(s.id) as { n: number }).n >= 1
    const hasArchive = !!(db.prepare('SELECT id FROM archives WHERE source_id = ? LIMIT 1').get(s.id))
    const hasAccroche = !!(s.accroche && s.accroche.trim())
    if (hasEvaluation && hasArchive && hasAccroche) pretes++
  }

  // --- Alertes douces (observations factuelles, jamais des fautes) ---
  const alertes: AlerteCorpus[] = []
  const n = sources.length

  if (!axeSujets.atteint && n > 1) {
    alertes.push({
      axe: 'sujets',
      message: axeSujets.distinct <= 1
        ? 'Un seul sujet représenté : le mécanisme se révèle mieux par contraste de sujets.'
        : `${axeSujets.distinct} sujets pour ${n} sources : la doctrine atelier vise au moins ${cibles.sujets} sujets distincts.`,
    })
  }

  // Sur-representation d'un type de propriete.
  const topPropriete = axePropriete.distribution[0]
  if (topPropriete && n >= 4 && topPropriete.n / n >= cibles.partMemeProprieteAlerte) {
    alertes.push({
      axe: 'propriete',
      message: `${topPropriete.n} sources sur ${n} relèvent du même type de propriété (${topPropriete.valeur}).`,
    })
  }

  // Sur-representation d'un media.
  const topMedia = axeMedias.distribution[0]
  if (topMedia && n >= 4 && topMedia.n >= Math.ceil(n / 2)) {
    alertes.push({
      axe: 'medias',
      message: `${topMedia.n} sources sur ${n} proviennent du même média (${topMedia.valeur}).`,
    })
  }

  // Diversite de types faible.
  if (!axeTypes.atteint && n >= 4) {
    alertes.push({
      axe: 'types',
      message: `${axeTypes.distinct} type(s) de source pour ${n} sources : varier (presse, rapport, vidéo, associatif, officiel...) éclaire le contraste.`,
    })
  }

  // Format / rythme.
  if (n >= 4 && enZone < cibles.dureeZoneMin) {
    alertes.push({
      axe: 'duree',
      message: `${enZone} source(s) en zone atelier (5-10 min) : peu de formats calibrés pour le rythme d'une séance.`,
    })
  }

  return {
    nbSources: n,
    axes: [axeMedias, axePropriete, axeTypes, axeSujets, axeMecanismes],
    duree,
    alertes,
    completude: { total: n, pretes },
  }
}

export interface SuggestionDiversite {
  axe: AxeDiversiteCle
  raison: string                         // ce que la candidate apporte
  source_ids: number[]                   // candidates du vivier comblant l'axe faible
}

/**
 * Suggestions de complement : pour chaque axe SOUS sa cible, propose des sources
 * du vivier qui apportent une VALEUR ABSENTE du corpus. N'impose rien : c'est
 * une aide a la diversification par manipulation directe (cartes a promener).
 */
export function suggestionsDiversite(corpusIds: number[], maxParAxe = 3): SuggestionDiversite[] {
  const profil = profilDiversiteCorpus(corpusIds)
  const corpusSet = new Set(corpusIds)
  const suggestions: SuggestionDiversite[] = []

  // Candidates = vivier hors corpus.
  const candidates = db.prepare(`
    SELECT s.id, s.media_id, m.nom AS media_nom, m.type_propriete, s.type_source
    FROM sources s
    LEFT JOIN medias m ON m.id = s.media_id
    WHERE s.statut = 'vivier'
  `).all() as { id: number; media_id: number | null; media_nom: string | null; type_propriete: string | null; type_source: string | null }[]
  const libres = candidates.filter(c => !corpusSet.has(c.id))

  function valeursPresentes(axe: AxeDiversiteCle): Set<string> {
    const a = profil.axes.find(x => x.cle === axe)
    return new Set((a?.distribution ?? []).map(d => d.valeur))
  }

  // Propriete absente.
  const axeP = profil.axes.find(x => x.cle === 'propriete')
  if (axeP && !axeP.atteint) {
    const presentes = valeursPresentes('propriete')
    const apportent = libres.filter(c => c.type_propriete && !presentes.has(c.type_propriete)).slice(0, maxParAxe)
    if (apportent.length) {
      suggestions.push({
        axe: 'propriete',
        raison: 'Apporte un type de propriété absent du corpus.',
        source_ids: apportent.map(c => c.id),
      })
    }
  }

  // Type de source absent.
  const axeT = profil.axes.find(x => x.cle === 'types')
  if (axeT && !axeT.atteint) {
    const presentes = valeursPresentes('types')
    const apportent = libres.filter(c => c.type_source && !presentes.has(c.type_source)).slice(0, maxParAxe)
    if (apportent.length) {
      suggestions.push({
        axe: 'types',
        raison: 'Apporte un type de source absent du corpus.',
        source_ids: apportent.map(c => c.id),
      })
    }
  }

  // Media absent.
  const axeM = profil.axes.find(x => x.cle === 'medias')
  if (axeM && !axeM.atteint) {
    const presentes = valeursPresentes('medias')
    const apportent = libres.filter(c => c.media_nom && !presentes.has(c.media_nom)).slice(0, maxParAxe)
    if (apportent.length) {
      suggestions.push({
        axe: 'medias',
        raison: 'Apporte un média absent du corpus.',
        source_ids: apportent.map(c => c.id),
      })
    }
  }

  return suggestions
}
