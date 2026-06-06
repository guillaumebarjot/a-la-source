/**
 * Types Arpentage (lecture collective fragmentee).
 *
 * Un document long est decoupe en fragments, chaque participant lit un
 * fragment, puis on met en commun (restitutions) et on synthetise. Local a la
 * feature : ne pas polluer le types/index.ts global.
 */

/** Element de la liste /api/arpentages. */
export interface ArpentageListItem {
  id: number
  titre: string
  statut_activite: string
  sujet_id: number | null
  cree_le: string
  maj_le: string
  source_id: number | null
  mode_decoupage: string | null
  sujet_titre: string | null
  sujet_slug: string | null
  source_titre: string | null
  nb_fragments: number
  nb_restitutions: number
}

export interface ArpentagePipeline {
  activite_id: number
  source_id: number | null
  mode_decoupage: string | null
  synthese_md: string | null
  source_titre: string | null
  source_accroche: string | null
  source_url: string | null
}

export interface ArpentageFragment {
  id: number
  activite_id: number
  ordre: number
  titre: string | null
  reference: string | null
  contenu_md: string | null
  attribue_a: number | null
  attribue_a_nom: string | null
}

export interface ArpentageRestitution {
  id: number
  fragment_id: number
  par: number | null
  points_cles_md: string | null
  citation: string | null
  question_md: string | null
  mecanisme_id: number | null
  cree_le: string
  par_nom: string | null
  mecanisme_nom: string | null
}

/** Detail /api/arpentages/:id. */
export interface ArpentageDetail {
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
  pipeline: ArpentagePipeline | null
  fragments: ArpentageFragment[]
  restitutions: ArpentageRestitution[]
}

/** Participant minimal (selecteur d'attribution). */
export interface UtilisateurOption {
  id: number
  nom: string
}

/** Mecanisme minimal (selecteur de restitution). */
export interface MecanismeOption {
  id: number
  nom: string
  categorie?: string | null
}
