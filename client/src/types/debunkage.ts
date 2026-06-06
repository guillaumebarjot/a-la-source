/**
 * Types Débunkage (activité d'éducation populaire aux médias).
 * Local à la feature : ne pas polluer le types/index.ts global.
 */

export type ReseauPost = 'instagram' | 'facebook' | 'autre'

export type RoleSource = 'pour' | 'contre' | null

export interface DebunkagePost {
  id: number
  activite_id: number
  reseau: ReseauPost | null
  url: string
  publie_le: string
}

export interface DebunkageSource {
  id: number
  titre: string
  url: string | null
  accroche: string | null
  image_url: string | null
  date_publication: string | null
  media_nom: string | null
  type_propriete: string | null
  role: RoleSource
  ordre: number | null
  note: string | null
}

export interface DebunkagePipeline {
  activite_id: number
  affirmation_visee_md: string | null
  demonstration_md: string | null
  statut: string | null
  relaye_site: number
}

/** Élément de la liste /api/debunkages. */
export interface DebunkageListItem {
  id: number
  titre: string
  statut_activite: string
  sujet_id: number | null
  cree_le: string
  maj_le: string
  statut: string | null
  relaye_site: number | null
  sujet_titre: string | null
  sujet_slug: string | null
  nb_posts: number
  nb_sources: number
}

/** Détail /api/debunkages/:id. */
export interface DebunkageDetail {
  id: number
  titre: string
  type: string
  statut_activite: string
  sujet_id: number | null
  anime_par: number | null
  cree_par: number | null
  cree_le: string
  maj_le: string
  sujet_titre: string | null
  sujet_slug: string | null
  pipeline: DebunkagePipeline | null
  posts: DebunkagePost[]
  sources: DebunkageSource[]
}
