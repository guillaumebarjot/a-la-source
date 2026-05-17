import { JSDOM } from 'jsdom'

export interface OGData {
  title?: string
  description?: string
  image?: string
  siteName?: string
}

export async function fetchOpenGraph(url: string): Promise<OGData> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ALaSource/2.0)' },
      signal: AbortSignal.timeout(10000),
    })
    const html = await response.text()
    const dom = new JSDOM(html)
    const doc = dom.window.document

    const getMeta = (property: string): string | undefined => {
      const el = doc.querySelector(`meta[property="${property}"], meta[name="${property}"]`)
      return el?.getAttribute('content') || undefined
    }

    return {
      title: getMeta('og:title') || doc.title || undefined,
      description: getMeta('og:description') || getMeta('description'),
      image: getMeta('og:image'),
      siteName: getMeta('og:site_name'),
    }
  } catch {
    return {}
  }
}
