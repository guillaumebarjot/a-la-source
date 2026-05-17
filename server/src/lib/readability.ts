import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'

export interface ReadabilityResult {
  title: string
  content: string
  textContent: string
  excerpt: string
  byline: string | null
}

export async function extractReadability(url: string): Promise<ReadabilityResult | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ALaSource/2.0)' },
      signal: AbortSignal.timeout(15000),
    })
    const html = await response.text()
    const dom = new JSDOM(html, { url })
    const reader = new Readability(dom.window.document)
    const article = reader.parse()

    if (!article) return null

    return {
      title: article.title,
      content: article.content,
      textContent: article.textContent,
      excerpt: article.excerpt,
      byline: article.byline,
    }
  } catch {
    return null
  }
}
