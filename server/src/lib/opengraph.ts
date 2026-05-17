import { JSDOM } from 'jsdom'

export interface OGData {
  title?: string
  description?: string
  image?: string
  siteName?: string
  author?: string
  datePublished?: string
  keywords?: string[]
  paywall?: boolean
}

export async function fetchOpenGraph(url: string): Promise<OGData> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.5',
      },
      signal: AbortSignal.timeout(10000),
    })
    const html = await response.text()
    const dom = new JSDOM(html)
    const doc = dom.window.document

    const getMeta = (property: string): string | undefined => {
      const el = doc.querySelector(`meta[property="${property}"], meta[name="${property}"]`)
      return el?.getAttribute('content') || undefined
    }

    // Keywords
    const keywords: string[] = []
    const kwContent = getMeta('keywords') || getMeta('news_keywords')
    if (kwContent) kwContent.split(/[,;]/).map(k => k.trim()).filter(Boolean).forEach(k => keywords.push(k))
    doc.querySelectorAll('meta[property="article:tag"]').forEach(el => {
      const v = el.getAttribute('content')?.trim()
      if (v && !keywords.includes(v)) keywords.push(v)
    })

    // Author
    const author = getMeta('author')
      || getMeta('article:author')
      || getMeta('og:article:author')
      || doc.querySelector('.article-author, .author-name, [rel="author"]')?.textContent?.trim()

    // Date
    const datePublished = getMeta('article:published_time')
      || getMeta('og:article:published_time')
      || getMeta('date')
      || getMeta('DC.date.issued')
      || doc.querySelector('time[datetime]')?.getAttribute('datetime')
      || undefined

    // Paywall detection
    const isPaywall = !!getMeta('article:content_tier')
      && getMeta('article:content_tier') !== 'free'
      || !!doc.querySelector('[class*="paywall"], [id*="paywall"], [data-paywall]')
      || getMeta('st:section')?.toLowerCase().includes('abonne') === true

    return {
      title: getMeta('og:title') || doc.title || undefined,
      description: getMeta('og:description') || getMeta('description'),
      image: getMeta('og:image'),
      siteName: getMeta('og:site_name'),
      author,
      datePublished: datePublished ? datePublished.slice(0, 10) : undefined,
      keywords: keywords.length > 0 ? keywords.slice(0, 20) : undefined,
      paywall: isPaywall || undefined,
    }
  } catch {
    return {}
  }
}
