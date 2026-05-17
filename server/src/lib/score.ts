import db from './db.js'

interface EvalRow {
  score_echo: number
  score_pedagogie: number
}

/**
 * Calcul du coefficient de fraicheur selon l'age de la source.
 * < 3 mois: 1.0, 3-4 mois: 0.85, 4-6 mois: 0.55, > 6 mois: 0.25
 */
export function coeffFraicheur(datePublication: string | null): number {
  if (!datePublication) return 0.5
  const pub = new Date(datePublication)
  const now = new Date()
  const mois = (now.getTime() - pub.getTime()) / (1000 * 60 * 60 * 24 * 30)
  if (mois < 3) return 1.0
  if (mois < 4) return 0.85
  if (mois < 6) return 0.55
  return 0.25
}

/**
 * Score composite agrege pour une source (pipeline atelier).
 * Moyenne des evaluations multi-utilisateurs × fraicheur.
 */
export function calculerScoreSource(sourceId: number, datePublication: string | null): {
  moyEcho: number
  moyPedagogie: number
  fraicheur: number
  scoreTotal: number
  nbEvaluations: number
} {
  const evals = db.prepare(
    'SELECT score_echo, score_pedagogie FROM evaluations WHERE source_id = ?'
  ).all(sourceId) as EvalRow[]

  if (evals.length === 0) {
    return { moyEcho: 0, moyPedagogie: 0, fraicheur: coeffFraicheur(datePublication), scoreTotal: 0, nbEvaluations: 0 }
  }

  const moyEcho = evals.reduce((s, e) => s + e.score_echo, 0) / evals.length
  const moyPedagogie = evals.reduce((s, e) => s + e.score_pedagogie, 0) / evals.length
  const fraicheur = coeffFraicheur(datePublication)
  const scoreTotal = Math.round((moyEcho + moyPedagogie) * fraicheur)

  return { moyEcho, moyPedagogie, fraicheur, scoreTotal, nbEvaluations: evals.length }
}
