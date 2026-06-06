/**
 * Conversion d'un débunkage vers la syntaxe YesWiki.
 *
 * YesWiki (becs-rouges.fr, rouge-coquelicot.fr) attend une syntaxe wiki maison :
 *   - titres : ======titre 1====== ... =====titre 2===== ... (le nombre de = decroit avec le niveau)
 *   - gras : **texte**
 *   - italique : //texte//
 *   - listes a puces : « - » en debut de ligne
 *   - liens : [[https://url texte]]
 *
 * On rend ici un export texte autoportant (titre, affirmation, demonstration,
 * sources pour / contre, signature) a coller tel quel dans une page YesWiki.
 * Aucune donnee inventee : on ne rend que ce qui existe.
 */

export interface YeswikiSource {
  titre: string
  url: string | null
  media_nom: string | null
  role: string | null
}

export interface YeswikiDebunkage {
  titre: string
  affirmation_visee_md: string | null
  demonstration_md: string | null
  sources: YeswikiSource[]
}

/** Lien YesWiki : [[url texte]] si url, sinon le texte brut. */
function lienYeswiki(url: string | null, texte: string): string {
  const t = texte.trim() || (url ?? '')
  if (url && url.trim()) return `[[${url.trim()} ${t}]]`
  return t
}

/**
 * Convertit le markdown simple d'un champ (affirmation, demonstration) en
 * syntaxe YesWiki. Conversion volontairement minimale et sure :
 *   - titres markdown (#, ##, ###) -> titres YesWiki (=====, ====, ===)
 *   - puces markdown (-, *) -> puces YesWiki (« - »)
 *   - gras **...** conserve tel quel (meme syntaxe)
 *   - italique markdown *...* ou _..._ -> //...//
 * Le reste passe en texte. On preserve les sauts de ligne.
 */
function markdownVersYeswiki(md: string): string {
  const lignes = md.replace(/\r\n/g, '\n').split('\n')
  const out = lignes.map((ligne) => {
    const titre = ligne.match(/^(#{1,6})\s+(.*)$/)
    if (titre) {
      // # -> grand titre. On mappe sur des niveaux 4/3/2 pour rester sous le titre principal de la page.
      const niveau = Math.max(2, 5 - titre[1].length)
      const eq = '='.repeat(niveau)
      return `${eq}${titre[2].trim()}${eq}`
    }
    const puce = ligne.match(/^\s*[-*]\s+(.*)$/)
    if (puce) return `- ${puce[1].trim()}`
    return ligne
  })
  let texte = out.join('\n')
  // Italique : _texte_ ou *texte* (hors **gras**). On traite _..._ et les *...* isoles.
  texte = texte.replace(/_([^_\n]+)_/g, '//$1//')
  return texte
}

/** Rend une liste de sources d'un role donne sous forme de puces YesWiki. */
function rendreSources(sources: YeswikiSource[]): string[] {
  return sources.map((s) => {
    const media = s.media_nom ? ` (${s.media_nom})` : ''
    return `- ${lienYeswiki(s.url, s.titre)}${media}`
  })
}

/**
 * Produit le texte YesWiki complet d'un débunkage.
 * Format : titre, affirmation, demonstration, sources pour / contre, signature.
 */
export function debunkageVersYeswiki(data: YeswikiDebunkage): string {
  const blocs: string[] = []

  blocs.push(`======${data.titre.trim()}======`)

  if (data.affirmation_visee_md && data.affirmation_visee_md.trim()) {
    blocs.push('=====Affirmation visee=====')
    blocs.push(markdownVersYeswiki(data.affirmation_visee_md.trim()))
  }

  if (data.demonstration_md && data.demonstration_md.trim()) {
    blocs.push('=====Demonstration=====')
    blocs.push(markdownVersYeswiki(data.demonstration_md.trim()))
  }

  const pour = data.sources.filter((s) => s.role === 'pour')
  const contre = data.sources.filter((s) => s.role === 'contre')
  const autres = data.sources.filter((s) => s.role !== 'pour' && s.role !== 'contre')

  if (pour.length > 0) {
    blocs.push('=====Sources qui appuient=====')
    blocs.push(rendreSources(pour).join('\n'))
  }
  if (contre.length > 0) {
    blocs.push('=====Sources mises en cause=====')
    blocs.push(rendreSources(contre).join('\n'))
  }
  if (autres.length > 0) {
    blocs.push('=====Autres sources=====')
    blocs.push(rendreSources(autres).join('\n'))
  }

  blocs.push('----')
  blocs.push('**Debunkage par Rouge Coquelicot** // education populaire aux medias //')

  return blocs.join('\n\n') + '\n'
}

// ---------------------------------------------------------------------------
// Dossiers / décryptages
// ---------------------------------------------------------------------------

export interface YeswikiDossier {
  titre: string
  a_chaud?: boolean
  evenement_titre?: string | null
  evenement_date?: string | null
  mise_en_perspective_md: string | null
  contenu_md: string | null
  sources: YeswikiSource[]
}

/**
 * Produit le texte YesWiki complet d'un dossier (ou décryptage à chaud).
 * Format : titre, evenement (si à chaud), mise en perspective, contenu,
 * sources, signature.
 */
export function dossierVersYeswiki(data: YeswikiDossier): string {
  const blocs: string[] = []

  blocs.push(`======${data.titre.trim()}======`)

  if (data.a_chaud && data.evenement_titre && data.evenement_titre.trim()) {
    const date = data.evenement_date && data.evenement_date.trim() ? ` (${data.evenement_date.trim()})` : ''
    blocs.push(`//Decryptage a chaud : ${data.evenement_titre.trim()}${date}//`)
  }

  if (data.mise_en_perspective_md && data.mise_en_perspective_md.trim()) {
    blocs.push('=====Mise en perspective=====')
    blocs.push(markdownVersYeswiki(data.mise_en_perspective_md.trim()))
  }

  if (data.contenu_md && data.contenu_md.trim()) {
    blocs.push('=====Contenu=====')
    blocs.push(markdownVersYeswiki(data.contenu_md.trim()))
  }

  const pour = data.sources.filter((s) => s.role === 'pour')
  const contre = data.sources.filter((s) => s.role === 'contre')
  const autres = data.sources.filter((s) => s.role !== 'pour' && s.role !== 'contre')

  if (pour.length > 0) {
    blocs.push('=====Sources qui appuient=====')
    blocs.push(rendreSources(pour).join('\n'))
  }
  if (contre.length > 0) {
    blocs.push('=====Sources mises en cause=====')
    blocs.push(rendreSources(contre).join('\n'))
  }
  if (autres.length > 0) {
    blocs.push('=====Sources mobilisees=====')
    blocs.push(rendreSources(autres).join('\n'))
  }

  blocs.push('----')
  blocs.push('**Dossier par Rouge Coquelicot** // education populaire aux medias //')

  return blocs.join('\n\n') + '\n'
}

// ---------------------------------------------------------------------------
// Sujets / thèmes
// ---------------------------------------------------------------------------

export interface YeswikiSujetEvenement {
  titre: string
  date_evenement: string | null
}

export interface YeswikiSujet {
  titre: string
  accroche: string | null
  description_md: string | null
  sources: YeswikiSource[]
  evenements: YeswikiSujetEvenement[]
}

/**
 * Produit le texte YesWiki complet d'un thème (sujet) publié.
 * Format : titre, accroche, description, couverture (événements), sources,
 * signature.
 */
export function sujetVersYeswiki(data: YeswikiSujet): string {
  const blocs: string[] = []

  blocs.push(`======${data.titre.trim()}======`)

  if (data.accroche && data.accroche.trim()) {
    blocs.push(`//${data.accroche.trim()}//`)
  }

  if (data.description_md && data.description_md.trim()) {
    blocs.push('=====Description=====')
    blocs.push(markdownVersYeswiki(data.description_md.trim()))
  }

  if (data.evenements.length > 0) {
    blocs.push('=====Couverture=====')
    blocs.push(
      data.evenements
        .map((e) => {
          const date = e.date_evenement && e.date_evenement.trim() ? ` (${e.date_evenement.trim()})` : ''
          return `- **${e.titre.trim()}**${date}`
        })
        .join('\n')
    )
  }

  if (data.sources.length > 0) {
    blocs.push('=====Sources=====')
    blocs.push(rendreSources(data.sources).join('\n'))
  }

  blocs.push('----')
  blocs.push('**Theme suivi par Rouge Coquelicot** // education populaire aux medias //')

  return blocs.join('\n\n') + '\n'
}
