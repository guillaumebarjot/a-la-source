import db from './db.js'

interface EvalRow {
  score_echo: number
  score_pedagogie: number
  complexite: number
  bonus_expert: number
  resonance: number
}

interface ParamPoids {
  pedagogie: number
  echo: number
}

/**
 * Recupere les poids depuis la table parametres (defaut 50/50)
 */
function getPoids(): ParamPoids {
  const row = db.prepare("SELECT valeur FROM parametres WHERE cle = 'score_poids'").get() as { valeur: string } | undefined
  if (!row) return { pedagogie: 60, echo: 40 }
  try {
    return JSON.parse(row.valeur) as ParamPoids
  } catch {
    return { pedagogie: 60, echo: 40 }
  }
}

/**
 * Coefficient de fraicheur parametrable par type de source.
 * Utilise une demi-vie exponentielle configurable dans admin.
 */
export function coeffFraicheur(datePublication: string | null, typeSource?: string | null): number {
  if (!datePublication) return 0.5
  const pub = new Date(datePublication)
  const now = new Date()
  const jours = (now.getTime() - pub.getTime()) / (1000 * 60 * 60 * 24)

  // Recuperer la demi-vie configuree
  let demiVie = 60 // defaut
  const row = db.prepare("SELECT valeur FROM parametres WHERE cle = 'fraicheur_courbes'").get() as { valeur: string } | undefined
  if (row && typeSource) {
    try {
      const courbes = JSON.parse(row.valeur)
      if (courbes[typeSource]?.demi_vie_jours) {
        demiVie = courbes[typeSource].demi_vie_jours
      }
    } catch { /* ignore */ }
  }

  // Decroissance exponentielle : opacite = e^(-ln2 * jours / demi_vie)
  const opacite = Math.exp(-0.693 * jours / demiVie)
  return Math.max(0.05, Math.min(1.0, opacite))
}

/**
 * Indice timing A/B/C/D base sur la duree de lecture/visionnage.
 * Zone optimale atelier : 5-10 min = A. Trop court ou trop long = penalise.
 *   A : 5-10 min (ideal atelier)
 *   B : 3-5 min ou 10-12 min
 *   C : 1-3 min ou 12-20 min
 *   D : < 1 min ou > 20 min
 */
export function calculerTiming(dureeMinutes: number | null, timingOverride: string | null): string {
  if (timingOverride) return timingOverride
  if (!dureeMinutes) return 'B' // defaut si inconnu
  if (dureeMinutes >= 5 && dureeMinutes <= 10) return 'A'
  if ((dureeMinutes >= 3 && dureeMinutes < 5) || (dureeMinutes > 10 && dureeMinutes <= 12)) return 'B'
  if ((dureeMinutes >= 1 && dureeMinutes < 3) || (dureeMinutes > 12 && dureeMinutes <= 20)) return 'C'
  return 'D'
}

/**
 * Score atelier /100 — calcul complet
 *
 * Pedagogie (50 pts max) :
 *   - Densite mecanismes (auto) : nb_mecanismes / 3 * 10, max 10
 *   - Diversite mecanismes (auto) : nb_types_differents / 5 * 10, max 10
 *   - Qualite justifications (auto) : % mecanismes avec justification + extrait, * 10
 *   - Complexite (slider moyen) : moy(complexite) sur evaluateurs, /10 * 10
 *   - Bonus expert (slider moyen) : moy(bonus_expert), /10 * 10
 *
 * Echo (50 pts max) :
 *   - Croisement interne (auto) : nb sources partageant >= 2 tags communs, /5 * 10, max 10
 *   - Nb lectures (auto) : nb lectures marquees, /10 * 10, max 10
 *   - Commentaires (auto) : nb commentaires, /5 * 10, max 10
 *   - Viralite (mixte) : viralite_qualitative -> score /10
 *   - Resonance (slider moyen) : moy(resonance) /10 * 10
 */
export function calculerScoreSource(sourceId: number, datePublication: string | null, typeSource?: string | null): {
  pedagogie: number
  echo: number
  fraicheur: number
  scoreTotal: number
  timing: string
  nbEvaluations: number
  details: {
    densiteMecanismes: number
    diversiteMecanismes: number
    qualiteJustifications: number
    complexite: number
    bonusExpert: number
    croisementInterne: number
    nbLectures: number
    nbCommentaires: number
    viralite: number
    resonance: number
  }
} {
  const poids = getPoids()
  const fraicheur = coeffFraicheur(datePublication, typeSource)

  // --- Pedagogie (auto) ---
  const mecanismes = db.prepare(`
    SELECT sm.mecanisme_id, sm.justification, sm.extrait
    FROM source_mecanismes sm WHERE sm.source_id = ?
  `).all(sourceId) as { mecanisme_id: number; justification: string | null; extrait: string | null }[]

  const nbMecanismes = mecanismes.length
  const typesDistincts = new Set(mecanismes.map(m => m.mecanisme_id)).size
  const avecJustif = mecanismes.filter(m => m.justification && m.extrait).length
  const qualiteJustif = nbMecanismes > 0 ? (avecJustif / nbMecanismes) : 0

  const densiteMecanismes = Math.min(10, (nbMecanismes / 3) * 10)
  const diversiteMecanismes = Math.min(10, (typesDistincts / 5) * 10)
  const qualiteJustifications = qualiteJustif * 10

  // --- Pedagogie (sliders) ---
  const evals = db.prepare(
    'SELECT score_echo, score_pedagogie, complexite, bonus_expert, resonance FROM evaluations WHERE source_id = ?'
  ).all(sourceId) as EvalRow[]

  const nbEvals = evals.length
  const moyComplexite = nbEvals > 0 ? evals.reduce((s, e) => s + (e.complexite || 0), 0) / nbEvals : 0
  const moyBonusExpert = nbEvals > 0 ? evals.reduce((s, e) => s + (e.bonus_expert || 0), 0) / nbEvals : 0

  const pedagogieRaw = densiteMecanismes + diversiteMecanismes + qualiteJustifications + moyComplexite + moyBonusExpert
  const pedagogie = Math.min(poids.pedagogie, (pedagogieRaw / 50) * poids.pedagogie)

  // --- Echo (auto) ---
  // Croisement interne : sources partageant >= 2 tags communs
  const croisement = db.prepare(`
    SELECT COUNT(DISTINCT st2.source_id) as nb
    FROM source_tags st1
    JOIN source_tags st2 ON st1.tag_id = st2.tag_id AND st2.source_id != st1.source_id
    WHERE st1.source_id = ?
    GROUP BY st2.source_id
    HAVING COUNT(*) >= 2
  `).all(sourceId).length

  // Lectures
  const lecturesRow = db.prepare(
    "SELECT COUNT(*) as nb FROM lectures WHERE source_id = ? AND statut = 'lu'"
  ).get(sourceId) as { nb: number }
  const nbLectures = lecturesRow?.nb || 0

  // Commentaires
  const commRow = db.prepare(
    'SELECT COUNT(*) as nb FROM commentaires WHERE source_id = ?'
  ).get(sourceId) as { nb: number }
  const nbCommentaires = commRow?.nb || 0

  // Viralite qualitative
  const sourceRow = db.prepare(
    'SELECT viralite_qualitative, duree_minutes, duree_estimee, timing_override FROM sources WHERE id = ?'
  ).get(sourceId) as { viralite_qualitative: string | null; duree_minutes: number | null; duree_estimee: number | null; timing_override: string | null } | undefined

  let viraliteScore = 0
  if (sourceRow?.viralite_qualitative) {
    const map: Record<string, number> = { confidentiel: 2, circule: 5, viral: 8, tres_viral: 10 }
    viraliteScore = map[sourceRow.viralite_qualitative] || 0
  }

  // Resonance (slider)
  const moyResonance = nbEvals > 0 ? evals.reduce((s, e) => s + (e.resonance || 0), 0) / nbEvals : 0

  const croisementScore = Math.min(10, (croisement / 5) * 10)
  const lecturesScore = Math.min(10, (nbLectures / 10) * 10)
  const commentairesScore = Math.min(10, (nbCommentaires / 5) * 10)

  const echoRaw = croisementScore + lecturesScore + commentairesScore + viraliteScore + moyResonance
  const echo = Math.min(poids.echo, (echoRaw / 50) * poids.echo)

  // Score total
  const scoreTotal = Math.round(pedagogie + echo)

  // Timing
  const duree = sourceRow?.duree_estimee || sourceRow?.duree_minutes || null
  const timing = calculerTiming(duree, sourceRow?.timing_override || null)

  return {
    pedagogie: Math.round(pedagogie * 10) / 10,
    echo: Math.round(echo * 10) / 10,
    fraicheur,
    scoreTotal,
    timing,
    nbEvaluations: nbEvals,
    details: {
      densiteMecanismes: Math.round(densiteMecanismes * 10) / 10,
      diversiteMecanismes: Math.round(diversiteMecanismes * 10) / 10,
      qualiteJustifications: Math.round(qualiteJustifications * 10) / 10,
      complexite: Math.round(moyComplexite * 10) / 10,
      bonusExpert: Math.round(moyBonusExpert * 10) / 10,
      croisementInterne: Math.round(croisementScore * 10) / 10,
      nbLectures: Math.round(lecturesScore * 10) / 10,
      nbCommentaires: Math.round(commentairesScore * 10) / 10,
      viralite: viraliteScore,
      resonance: Math.round(moyResonance * 10) / 10
    }
  }
}

/**
 * Score de confiance media (inverse du score atelier, sans echo)
 * Plus un media produit des articles scores haut = plus il utilise des mecanismes problematiques
 */
export function calculerConfianceMedia(mediaId: number): {
  score: number
  nbSources: number
  nbMecanismesMoyen: number
  diversiteMecanismes: number
} {
  const sources = db.prepare(
    'SELECT id FROM sources WHERE media_id = ?'
  ).all(mediaId) as { id: number }[]

  if (sources.length === 0) return { score: 100, nbSources: 0, nbMecanismesMoyen: 0, diversiteMecanismes: 0 }

  // Nb mecanismes moyen par source
  const mecaStats = db.prepare(`
    SELECT s.id, COUNT(sm.id) as nb_meca, COUNT(DISTINCT sm.mecanisme_id) as nb_types
    FROM sources s
    LEFT JOIN source_mecanismes sm ON sm.source_id = s.id
    WHERE s.media_id = ?
    GROUP BY s.id
  `).all(mediaId) as { id: number; nb_meca: number; nb_types: number }[]

  const nbMecaMoyen = mecaStats.reduce((s, r) => s + r.nb_meca, 0) / mecaStats.length
  const diversite = mecaStats.reduce((s, r) => s + r.nb_types, 0) / mecaStats.length

  // Coefficient K depuis parametres
  let coeffK = 1.0
  const row = db.prepare("SELECT valeur FROM parametres WHERE cle = 'confiance_media'").get() as { valeur: string } | undefined
  if (row) {
    try {
      const conf = JSON.parse(row.valeur)
      if (conf.coefficient_k) coeffK = conf.coefficient_k
    } catch { /* ignore */ }
  }

  // Score confiance = 100 - (nbMecaMoyen * 10 + diversite * 5) * K, clamp 0-100
  const penalty = (nbMecaMoyen * 10 + diversite * 5) * coeffK
  const score = Math.max(0, Math.min(100, Math.round(100 - penalty)))

  return { score, nbSources: sources.length, nbMecanismesMoyen: Math.round(nbMecaMoyen * 10) / 10, diversiteMecanismes: Math.round(diversite * 10) / 10 }
}
