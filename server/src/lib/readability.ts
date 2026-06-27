/**
 * Extraction d'articles web (anti-linkrot).
 *
 * extractReadability(url) : télécharge la page, applique les règles FTR du site
 * (ftr-site-config.ts), puis Mozilla Readability pour extraire le texte principal.
 * Retourne titre, contenu HTML, texte brut, accroche, auteur et mots-clés.
 *
 * detecterArchivePartielle(textContent, paywall) : détermine si l'archive est
 * complète ou partielle (trop courte, pattern paywall dans les 100 derniers mots).
 *
 * Entrée : URL publique de l'article.
 * Sortie : ReadabilityResult | null (null si fetch échoue ou Readability ne parse pas).
 */
import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'
import { findSiteConfig, applySiteConfig, extractSiteMetadata } from './ftr-site-config.js'

export interface ReadabilityResult {
  title: string
  content: string
  textContent: string
  excerpt: string
  byline: string | null
  motsCles: string[]
}

// Patterns typiques de coupure paywall en fin d'article
const PAYWALL_PATTERNS = [
  /abonnez-vous/i,
  /pour lire la suite/i,
  /article r[ée]serv[ée] aux abonn[ée]s/i,
  /acc[ée]dez [àa] l['']int[ée]gralit[ée]/i,
  /contenu r[ée]serv[ée]/i,
  /d[ée]j[àa] abonn[ée]/i,
  /offre d['']essai/i,
  /il vous reste \d+% de cet article/i,
  /cet article est r[ée]serv[ée]/i,
]

export function detecterArchivePartielle(textContent: string, paywall: number): 'complete' | 'partielle' {
  const mots = textContent.trim().split(/\s+/).filter(Boolean)
  const nbMots = mots.length

  // Trop court pour un article complet
  if (nbMots < 150) return 'partielle'

  // Source paywall + article court = suspect
  if (paywall && nbMots < 400) return 'partielle'

  // Pattern de coupure dans les 100 derniers mots
  const fin = mots.slice(-100).join(' ')
  for (const pattern of PAYWALL_PATTERNS) {
    if (pattern.test(fin)) return 'partielle'
  }

  return 'complete'
}

export function compterMots(html: string): number {
  return html.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length
}

/**
 * Extract keywords from HTML meta tags: <meta name="keywords">, og:article:tag, etc.
 */
function extraireMotsCles(document: Document): string[] {
  const keywords = new Set<string>()

  // <meta name="keywords" content="...">
  const metaKeywords = document.querySelector('meta[name="keywords"]')
  if (metaKeywords) {
    const content = metaKeywords.getAttribute('content') || ''
    content.split(/[,;]/).map(k => k.trim()).filter(Boolean).forEach(k => keywords.add(k))
  }

  // <meta property="article:tag" content="..."> (multiple)
  document.querySelectorAll('meta[property="article:tag"]').forEach(el => {
    const v = el.getAttribute('content')?.trim()
    if (v) keywords.add(v)
  })

  // <meta property="og:article:tag" content="...">
  document.querySelectorAll('meta[property="og:article:tag"]').forEach(el => {
    const v = el.getAttribute('content')?.trim()
    if (v) keywords.add(v)
  })

  // <meta name="news_keywords" content="..."> (Google News)
  const newsKw = document.querySelector('meta[name="news_keywords"]')
  if (newsKw) {
    const content = newsKw.getAttribute('content') || ''
    content.split(/[,;]/).map(k => k.trim()).filter(Boolean).forEach(k => keywords.add(k))
  }

  return Array.from(keywords).slice(0, 20)
}

export async function extractReadability(url: string): Promise<ReadabilityResult | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.5',
      },
      signal: AbortSignal.timeout(15000),
    })
    const html = await response.text()
    const dom = new JSDOM(html, { url })
    const document = dom.window.document

    // Apply site-specific extraction rules (ftr-site-config)
    const siteConfig = findSiteConfig(url)
    if (siteConfig) {
      applySiteConfig(document, siteConfig)
    }

    const reader = new Readability(document)
    const article = reader.parse()

    if (!article) return null

    // Use site-specific metadata if available
    let title = article.title
    let byline = article.byline
    if (siteConfig) {
      const meta = extractSiteMetadata(dom.window.document, siteConfig)
      if (meta.title) title = meta.title
      if (meta.author) byline = meta.author
    }

    // Extract keywords from meta tags
    const motsCles = extraireMotsCles(document)

    return {
      title,
      content: article.content,
      textContent: article.textContent,
      excerpt: article.excerpt,
      byline,
      motsCles,
    }
  } catch {
    return null
  }
}
