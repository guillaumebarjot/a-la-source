// Types du module Parcours / Quiz (cursus d'apprentissage).

export interface ParcoursListItem {
  id: number
  titre: string
  description: string | null
  cree_le: string
  nb_questions: number
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
