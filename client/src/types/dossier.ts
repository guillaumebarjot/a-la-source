/**
 * Types Dossier (activité d'éducation populaire aux médias).
 *
 * Le dossier est un format de fond sur un thème. Le DÉCRYPTAGE n'est pas un type
 * distinct : c'est un dossier daté « à chaud » (a_chaud) rattaché à un événement.
 * Local à la feature : ne pas polluer le types/index.ts global.
 */

export type RoleSource = 'pour' | 'contre' | null

export interface DossierSource {
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

export interface DossierContenu {
  activite_id: number
  contenu_md: string | null
  mise_en_perspective_md: string | null
  a_chaud: number
  evenement_id: number | null
  evenement_titre: string | null
  date_evenement: string | null
}

/** Élément de la liste /api/dossiers. */
export interface DossierListItem {
  id: number
  titre: string
  statut_activite: string
  sujet_id: number | null
  cree_le: string
  maj_le: string
  a_chaud: number | null
  evenement_id: number | null
  sujet_titre: string | null
  sujet_slug: string | null
  evenement_titre: string | null
  date_evenement: string | null
  nb_sources: number
}

/** Détail /api/dossiers/:id. */
export interface DossierDetail {
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
  contenu: DossierContenu | null
  sources: DossierSource[]
}

/** Événement minimal (pour le sélecteur de décryptage). */
export interface EvenementOption {
  id: number
  titre: string
  date_evenement: string | null
}
