/**
 * Diffusion HORS APPLI d'un débunkage publié.
 *
 * Cette route sert une PAGE HTML COMPLETE autoportante (CSS inline, aucune
 * dependance a l'appli React) destinee a etre partagee hors connexion :
 * collee dans Discord, elle est « unfurlee » grace aux balises OpenGraph /
 * Twitter Card du <head> (carte avec titre, description, image).
 *
 * Acces : seul un débunkage PUBLIE est rendu (statut 'publie' dans
 * debunkage_pipeline ou activites). Sinon, page 404 « non disponible ».
 *
 * authMiddleware (global) ne bloque pas : cette route est donc publique au
 * niveau appli. AU DEPLOIEMENT YunoHost, il faut declarer /partage/ en acces
 * public (skipped_uris du SSO), sans quoi le SSO interceptera la requete.
 */
import { Router } from 'express'
import db from '../lib/db.js'

const router = Router()

interface ActiviteRow {
  id: number
  titre: string
  statut_activite: string
}
interface PipelineRow {
  affirmation_visee_md: string | null
  demonstration_md: string | null
  statut: string | null
}
interface SourceRow {
  titre: string
  url: string | null
  accroche: string | null
  image_url: string | null
  media_nom: string | null
  role: string | null
  ordre: number | null
}

/** Echappe pour insertion dans du contenu HTML. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Echappe pour insertion dans un attribut HTML (meta content, href, src). */
function escAttr(s: string): string {
  return esc(s)
}

/**
 * Rendu markdown -> HTML volontairement simple et sur (pas de dependance) :
 * titres (#..######), gras **...**, italique _..._, liens [texte](url),
 * listes a puces (-, *), et paragraphes separes par les lignes vides.
 * Tout est echappe avant transformation : pas d'injection HTML possible.
 */
function markdownVersHtml(md: string): string {
  const lignes = md.replace(/\r\n/g, '\n').split('\n')
  const html: string[] = []
  let dansListe = false
  let paragraphe: string[] = []

  const inline = (texte: string): string => {
    let t = esc(texte)
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    t = t.replace(/_([^_]+)_/g, '<em>$1</em>')
    // Liens markdown [texte](url) -> on re-echappe l'url en attribut
    t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, url: string) =>
      `<a href="${escAttr(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`
    )
    return t
  }
  const flushParagraphe = () => {
    if (paragraphe.length > 0) {
      html.push(`<p>${paragraphe.map(inline).join('<br>')}</p>`)
      paragraphe = []
    }
  }
  const flushListe = () => {
    if (dansListe) {
      html.push('</ul>')
      dansListe = false
    }
  }

  for (const ligne of lignes) {
    const titre = ligne.match(/^(#{1,6})\s+(.*)$/)
    const puce = ligne.match(/^\s*[-*]\s+(.*)$/)
    if (titre) {
      flushParagraphe()
      flushListe()
      const niveau = Math.min(6, titre[1].length + 1)
      html.push(`<h${niveau}>${inline(titre[2].trim())}</h${niveau}>`)
    } else if (puce) {
      flushParagraphe()
      if (!dansListe) {
        html.push('<ul>')
        dansListe = true
      }
      html.push(`<li>${inline(puce[1].trim())}</li>`)
    } else if (ligne.trim() === '') {
      flushParagraphe()
      flushListe()
    } else {
      flushListe()
      paragraphe.push(ligne)
    }
  }
  flushParagraphe()
  flushListe()
  return html.join('\n')
}

/** Tronque proprement une description pour les meta OpenGraph. */
function resume(texte: string, max = 280): string {
  // Retire le markdown leger pour une description propre.
  const plat = texte
    .replace(/[#*_>`]/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
  if (plat.length <= max) return plat
  return plat.slice(0, max - 1).trimEnd() + '…'
}

/** Page 404 « non disponible », autoportante. */
function pageIndisponible(): string {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Debunkage non disponible</title>
<style>
  body { margin:0; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    background:#f7f5f2; color:#2a2a2a; display:flex; min-height:100vh;
    align-items:center; justify-content:center; padding:2rem; }
  .carte { max-width:32rem; text-align:center; background:#fff; border:1px solid #e4ded6;
    border-radius:16px; padding:2.5rem; box-shadow:0 6px 24px rgba(0,0,0,.06); }
  h1 { margin:0 0 .75rem; font-size:1.4rem; color:#b3261e; }
  p { margin:.25rem 0; line-height:1.6; color:#555; }
</style>
</head>
<body>
  <main class="carte">
    <h1>Debunkage non disponible</h1>
    <p>Ce debunkage n'est pas publie, ou n'existe pas.</p>
    <p>Diffusion par Rouge Coquelicot, education populaire aux medias.</p>
  </main>
</body>
</html>
`
}

// GET /partage/debunkage/:id — page HTML publique autoportante (si publie)
router.get('/debunkage/:id', (req, res) => {
  const activite = db.prepare(`
    SELECT a.id, a.titre, a.statut AS statut_activite
    FROM activites a
    WHERE a.id = ? AND a.type = 'debunkage'
  `).get(req.params.id) as ActiviteRow | undefined

  if (!activite) {
    res.status(404).type('html').send(pageIndisponible())
    return
  }

  const pipeline = db.prepare(
    'SELECT affirmation_visee_md, demonstration_md, statut FROM debunkage_pipeline WHERE activite_id = ?'
  ).get(activite.id) as PipelineRow | undefined

  const estPublie = pipeline?.statut === 'publie' || activite.statut_activite === 'publie'
  if (!estPublie) {
    res.status(404).type('html').send(pageIndisponible())
    return
  }

  const sources = db.prepare(`
    SELECT s.titre, s.url, s.accroche, s.image_url,
           m.nom AS media_nom, asr.role, asr.ordre
    FROM activite_sources asr
    JOIN sources s ON s.id = asr.source_id
    LEFT JOIN medias m ON m.id = s.media_id
    WHERE asr.activite_id = ?
    ORDER BY asr.ordre, s.titre
  `).all(activite.id) as SourceRow[]

  const affirmation = pipeline?.affirmation_visee_md?.trim() || ''
  const demonstration = pipeline?.demonstration_md?.trim() || ''

  // Description OG : debut de la demonstration, sinon l'affirmation visee.
  const descriptionSource = demonstration || affirmation || ''
  const description = descriptionSource ? resume(descriptionSource) : `Debunkage par Rouge Coquelicot : ${activite.titre}`

  // Image OG : 1ere source disposant d'une image.
  const premiereImage = sources.find((s) => s.image_url && s.image_url.trim())?.image_url || ''

  // URL absolue de la page courante (pour og:url).
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol
  const host = req.get('host') || ''
  const urlAbsolue = `${proto}://${host}${req.originalUrl}`

  const pour = sources.filter((s) => s.role === 'pour')
  const contre = sources.filter((s) => s.role === 'contre')
  const autres = sources.filter((s) => s.role !== 'pour' && s.role !== 'contre')

  const carteSource = (s: SourceRow): string => {
    const titre = s.url
      ? `<a href="${escAttr(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.titre)}</a>`
      : esc(s.titre)
    const media = s.media_nom ? `<span class="media">${esc(s.media_nom)}</span>` : ''
    const accroche = s.accroche ? `<p class="accroche">${esc(s.accroche)}</p>` : ''
    return `<li class="source">${titre}${media}${accroche}</li>`
  }
  const blocSources = (titre: string, liste: SourceRow[]): string => {
    if (liste.length === 0) return ''
    return `<section class="sources">
      <h2>${esc(titre)}</h2>
      <ul>${liste.map(carteSource).join('')}</ul>
    </section>`
  }

  const ogImageTags = premiereImage
    ? `<meta property="og:image" content="${escAttr(premiereImage)}">
  <meta name="twitter:image" content="${escAttr(premiereImage)}">`
    : ''

  const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(activite.titre)} — Rouge Coquelicot</title>
  <meta name="description" content="${escAttr(description)}">
  <meta property="og:title" content="${escAttr(activite.titre)}">
  <meta property="og:description" content="${escAttr(description)}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${escAttr(urlAbsolue)}">
  <meta property="og:site_name" content="A la source — Rouge Coquelicot">
  ${ogImageTags}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escAttr(activite.titre)}">
  <meta name="twitter:description" content="${escAttr(description)}">
  <style>
    :root {
      --rouge:#b3261e; --encre:#23201d; --gris:#5d574f; --fond:#f7f5f2;
      --carte:#ffffff; --bord:#e7e1d8;
    }
    * { box-sizing: border-box; }
    body {
      margin:0; background:var(--fond); color:var(--encre);
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height:1.65;
    }
    .wrap { max-width:46rem; margin:0 auto; padding:2.5rem 1.25rem 4rem; }
    header.tete { border-bottom:3px solid var(--rouge); padding-bottom:1rem; margin-bottom:2rem; }
    .kicker { text-transform:uppercase; letter-spacing:.08em; font-size:.72rem;
      font-weight:700; color:var(--rouge); margin:0 0 .5rem; }
    h1 { font-size:1.9rem; line-height:1.2; margin:0; color:var(--encre); }
    h2 { font-size:1.15rem; margin:2rem 0 .6rem; color:var(--rouge);
      border-bottom:1px solid var(--bord); padding-bottom:.3rem; }
    h3,h4,h5,h6 { color:var(--encre); margin:1.2rem 0 .4rem; }
    .affirmation { background:var(--carte); border:1px solid var(--bord);
      border-left:4px solid var(--rouge); border-radius:10px;
      padding:1rem 1.2rem; margin:0 0 1.5rem; }
    .affirmation .label { display:block; text-transform:uppercase; letter-spacing:.05em;
      font-size:.7rem; font-weight:700; color:var(--gris); margin-bottom:.4rem; }
    .demonstration p { margin:0 0 1rem; }
    .demonstration ul { margin:0 0 1rem 1.2rem; padding:0; }
    .demonstration a { color:var(--rouge); }
    section.sources ul { list-style:none; margin:0; padding:0; }
    li.source { background:var(--carte); border:1px solid var(--bord); border-radius:10px;
      padding:.8rem 1rem; margin-bottom:.6rem; }
    li.source a { color:var(--rouge); font-weight:600; text-decoration:none; word-break:break-word; }
    li.source a:hover { text-decoration:underline; }
    li.source .media { display:block; font-size:.8rem; color:var(--gris); margin-top:.15rem; }
    li.source .accroche { margin:.4rem 0 0; font-size:.9rem; color:var(--gris); }
    footer.pied { margin-top:3rem; padding-top:1.2rem; border-top:1px solid var(--bord);
      font-size:.85rem; color:var(--gris); text-align:center; }
    footer.pied strong { color:var(--rouge); }
  </style>
</head>
<body>
  <main class="wrap">
    <header class="tete">
      <p class="kicker">Debunkage</p>
      <h1>${esc(activite.titre)}</h1>
    </header>

    ${affirmation ? `<div class="affirmation">
      <span class="label">Affirmation visee</span>
      <div>${markdownVersHtml(affirmation)}</div>
    </div>` : ''}

    ${demonstration ? `<section class="demonstration">
      <h2>Demonstration</h2>
      ${markdownVersHtml(demonstration)}
    </section>` : ''}

    ${blocSources('Sources qui appuient', pour)}
    ${blocSources('Sources mises en cause', contre)}
    ${blocSources('Autres sources', autres)}

    <footer class="pied">
      <p><strong>Debunkage par Rouge Coquelicot</strong><br>education populaire aux medias</p>
    </footer>
  </main>
</body>
</html>
`

  res.type('html').send(html)
})

export default router
