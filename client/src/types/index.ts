export interface Source {
  id: number
  titre: string
  url: string | null
  auteur_id: number | null
  media_id: number | null
  type_source: string | null
  date_publication: string | null
  paywall: number
  duree_minutes: number | null
  accroche: string | null
  image_url: string | null
  soumis_par: number | null
  soumis_le: string
  statut: 'veille' | 'vivier' | 'atelier' | 'archive'
  origine?: 'web' | 'discord' | 'import'
  a_qualifier?: number
  completude?: 'libre' | 'partiel' | 'integral_offline' | null
  // Joined
  media_nom?: string
  auteur_nom?: string
  soumis_par_nom?: string
  // Badges
  has_archive?: number
  archive_statut?: 'complete' | 'partielle' | 'echouee'
  nb_commentaires?: number
  nb_ateliers?: number
}

export interface SourceDetail extends Source {
  tags: Tag[]
  mecanismes: SourceMecanisme[]
  archive: Archive | null
  score: ScoreResult
}

export interface Tag {
  id: number
  nom: string
  couleur: string | null
  categorie: 'thematique' | 'mecanisme' | 'media' | 'libre'
}

export interface Media {
  id: number
  nom: string
  type: string | null
  url_site: string | null
  description: string | null
  // Propriété structurée (Chantier A)
  proprietaire?: string | null
  actionnaire_ultime?: string | null
  type_propriete?: string | null
  financement?: string | null
  annee_creation?: number | null
  ligne_revendiquee?: string | null
  nb_sources?: number
}

// Événements (Chantier C) — veille multisourcée
export interface Evenement {
  id: number
  titre: string
  description: string | null
  date_evenement: string | null
  cree_le: string
  nb_sources?: number
  nb_medias?: number
  nb_types_propriete?: number
}

export interface EvenementSource {
  id: number
  titre: string
  url: string | null
  accroche: string | null
  date_publication: string | null
  type_source: string | null
  media_id: number | null
  media_nom: string | null
  proprietaire: string | null
  actionnaire_ultime: string | null
  type_propriete: string | null
  ligne_revendiquee: string | null
}

export interface EvenementDetail extends Evenement {
  sources: EvenementSource[]
}

export interface Sujet {
  id: number
  slug: string
  titre: string
  accroche: string | null
  description_md: string | null
  image_url: string | null
  couleur: string | null
  statut: 'propose' | 'publie' | 'archive'
  provenance: string | null
  cree_par: number | null
  valide_par: number | null
  cree_le: string
  maj_le: string
  nb_sources?: number
  nb_evenements?: number
}

export interface SujetSource {
  id: number
  titre: string
  url: string | null
  accroche: string | null
  image_url: string | null
  date_publication: string | null
  media_nom: string | null
  type_propriete: string | null
}

export interface SujetDetail extends Sujet {
  sources: SujetSource[]
  evenements: Evenement[]
}

export interface MecanismeReference {
  id: number
  nom: string
  description: string | null
  exemple: string | null
  questions_guidees: string | null
}

export interface SourceMecanisme {
  id: number
  source_id: number
  mecanisme_id: number
  identifie_par: number | null
  justification: string | null
  extrait: string | null
  identifie_le: string
  mecanisme_nom: string
  mecanisme_description: string | null
  identifie_par_nom?: string
}

export interface Evaluation {
  id: number
  source_id: number
  evaluateur_id: number
  score_echo: number
  score_pedagogie: number
  commentaire: string | null
  evaluee_le: string
  evaluateur_nom?: string
}

export interface Commentaire {
  id: number
  source_id: number
  auteur_id: number
  type: 'commentaire' | 'analyse' | 'question' | 'lien'
  contenu: string
  url: string | null
  cree_le: string
  auteur_nom?: string
}

export interface Archive {
  id: number
  source_id: number
  type: 'readability' | 'markdown' | 'pdf' | 'html'
  contenu: string | null
  chemin: string | null
  statut: 'complete' | 'partielle' | 'echouee'
  nb_mots: number | null
  cree_le: string
}

export interface ScoreResult {
  moyEcho: number
  moyPedagogie: number
  fraicheur: number
  scoreTotal: number
  nbEvaluations: number
}

// Facettes descriptives du vivier (doctrine « décrire, ne pas noter ») :
// des faits exposés, jamais un score-verdict. Le score reste disponible
// comme tri optionnel, il n'est plus la présentation par défaut.
export interface Facettes {
  nbEvaluations: number
  archiveStatut: 'complete' | 'partielle' | 'echouee' | null
  completude: 'libre' | 'partiel' | 'integral_offline' | null
  datePublication: string | null
  nbMecanismes: number
  fraicheur: number
}

export interface Atelier {
  id: number
  numero: number
  date_atelier: string | null
  heure: string | null
  lieu: string | null
  statut: 'preparation' | 'pret' | 'en_cours' | 'termine'
  facilitateur_id: number | null
  facilitateur_nom?: string
  source_choisie_id: number | null
  nb_participants: number | null
  compte_rendu: string | null
  observations: string | null
  observations_surprise: string | null
  questions_restantes: string | null
  mecanisme_identifie: string | null
  cree_le: string
}

export interface AtelierMecanisme {
  atelier_id: number
  mecanisme_id: number
  mecanisme_nom?: string
}

export interface AtelierDetail extends Atelier {
  sources: Source[]
  mecanismes_identifies?: AtelierMecanisme[]
}

export interface Utilisateur {
  id: number
  nom: string
  role: 'membre' | 'animateur' | 'admin'
}

export interface Lecture {
  source_id: number
  utilisateur_id: number
  statut: 'a_lire' | 'lu' | 'recommande'
  recommande_a: number | null
  date_maj: string
  titre?: string
  url?: string
  media_nom?: string
}

export interface Contenu {
  cle: string
  titre: string | null
  contenu: string | null
  modifie_le: string
}

export interface MecanismeStat {
  id: number
  nom: string
  description: string | null
  nb_sources: number
}
