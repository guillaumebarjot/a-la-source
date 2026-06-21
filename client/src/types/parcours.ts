// Types du module Parcours / Quiz (cursus d'apprentissage).

export type ParcoursMode = 'curate' | 'tirage'

export interface ParcoursListItem {
  id: number
  titre: string
  description: string | null
  cree_le: string
  nb_questions: number
  /* Multi-quiz par theme : rattachement optionnel a un sujet + mode du quiz.
     sujet_id null = quiz transversal (le parcours historique). */
  sujet_id: number | null
  sujet_titre: string | null
  sujet_slug: string | null
  mode: ParcoursMode
}

// Question telle qu'envoyee pour jouer : carte-source NUE, aucun indice
// du mecanisme attendu (anti-biais, esprit epoche).
export interface ParcoursQuestion {
  id: number
  ordre: number
  source_id: number
  source_titre: string
  source_accroche: string | null
  source_image_url: string | null
  /* Champs facultatifs : presents seulement si le serveur les expose un jour.
     Le front degrade proprement quand ils manquent (placeholder, pas de lien media). */
  source_media_nom?: string | null
  source_url?: string | null
}

export interface MecanismeChoix {
  id: number
  nom: string
  categorie: string | null
}

export interface ParcoursDetail {
  id: number
  titre: string
  description: string | null
  sujet_id?: number | null
  sujet_titre?: string | null
  sujet_slug?: string | null
  mode?: ParcoursMode
  questions: ParcoursQuestion[]
  mecanismes: MecanismeChoix[]
}

export interface SessionDemarree {
  session_id: number
  total: number
}

export interface ReponseResultat {
  correct: boolean
  mecanisme_attendu: MecanismeChoix | null
  explication: string | null
  score: number
  total: number
  termine: boolean
}
