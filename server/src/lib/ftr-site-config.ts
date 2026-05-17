/**
 * Site-specific extraction rules inspired by ftr-site-config (Wallabag/graby).
 * Each entry provides CSS selectors to improve Readability extraction for known sites.
 *
 * Format:
 * - body: selector(s) for article content (Readability will focus here)
 * - strip: selector(s) to remove before extraction (ads, promos, related, etc.)
 * - title: selector for title (optional override)
 * - author: selector for author (optional)
 * - date: selector for date (optional)
 *
 * Domains are matched by suffix (e.g. "lemonde.fr" matches "www.lemonde.fr")
 */

export interface SiteConfig {
  body?: string[]
  strip?: string[]
  title?: string
  author?: string
  date?: string
}

// -- Presse nationale / mainstream --

const SITE_CONFIGS: Record<string, SiteConfig> = {
  // ===== Presse nationale =====
  'lemonde.fr': {
    body: ['article .article__content', '.article__paragraph'],
    strip: [
      '.article__reactions', '.catcher', '.article__footer-single',
      '.aside__iso', '.friend-links', '.article__status',
      '.paywall', '#js-paywall-content',
    ],
    title: '.article__title',
    author: '.article__author-link',
    date: '.article__publication-date time',
  },
  'lefigaro.fr': {
    body: ['.fig-content-body', '.fig-article__body', 'article .fig-paragraph'],
    strip: [
      '.fig-premium-paywall', '.fig-related', '.fig-ad',
      '.fig-social-share', '.fig-newsletter', '.fig-outbrain',
    ],
    title: '.fig-headline',
    author: '.fig-author__name',
    date: 'time.fig-content-metas__pub',
  },
  'liberation.fr': {
    body: ['.article-body', '.article-body-wrapper'],
    strip: [
      '.ad-slot', '.paywall-wrapper', '.article-related',
      '.newsletter-block', '.social-share',
    ],
    title: '.article-header h1',
    author: '.author-name',
  },
  'mediapart.fr': {
    body: ['.content-article', '.news__body__center__article'],
    strip: [
      '.paywall', '.read-also', '.subscriber-only',
      '.toolbar-social', '.js-paywall', '.aside-article',
    ],
    title: '.news__heading__title h1',
    author: '.author__name',
  },
  'humanite.fr': {
    body: ['.field-name-body', '.article-content', 'article .content'],
    strip: ['.ad-wrapper', '.article-related', '.social-links'],
    title: 'h1.article-title',
    author: '.article-author',
  },
  'lepoint.fr': {
    body: ['.art-text', '.article-content-body'],
    strip: [
      '.paywall-block', '.article-outlinks', '.article-aside',
      '.newsletter-subscription', '.social-bar',
    ],
    title: '.art-header h1',
    author: '.art-author',
    date: '.art-date time',
  },
  'lopinion.fr': {
    body: ['.article-full__body', '.article__body'],
    strip: [
      '.paywall', '.article-aside', '.newsletter',
      '.pub-wrapper', '.social-share-buttons',
    ],
    title: '.article-full__title',
    author: '.article-full__author',
  },
  'lobs.com': {
    body: ['.article-body', '.article__text'],
    strip: [
      '.paywall', '.article-aside', '.article-share',
      '.article-related', '.premium-banner',
    ],
    title: '.article-header h1',
    author: '.article-author',
  },
  'lexpress.fr': {
    body: ['.article_content', '.article-body'],
    strip: [
      '.paywall-content', '.article-related',
      '.social-bar', '.newsletter-block',
    ],
    title: '.article_title h1',
    author: '.author-name',
  },
  'marianne.net': {
    body: ['.article-content', '.field--name-body'],
    strip: ['.article-share', '.ad-slot', '.related-articles'],
    title: 'h1.article-title',
    author: '.article-author-name',
  },
  'challenges.fr': {
    body: ['.article-body', '.body-text'],
    strip: ['.paywall', '.social-share', '.related-articles', '.ads'],
    title: 'h1.article-title',
  },
  'leparisien.fr': {
    body: ['.article-section', '.content-article'],
    strip: [
      '.paywall', '.article-related', '.premium-paywall',
      '.social-share', '.newsletter-form',
    ],
    title: 'h1.article-title',
    author: '.article-author',
  },
  'lesechos.fr': {
    body: ['.post-paywall', '.article-body', '.article__body'],
    strip: [
      '.paywall', '.article-related', '.ad-container',
      '.social-tools', '.newsletter',
    ],
    title: 'h1',
    author: '.article-author',
  },
  'latribune.fr': {
    body: ['.article-body', '.field-name-body'],
    strip: ['.social-share', '.related-articles', '.ad-slot'],
    title: 'h1.article-title',
    author: '.article-author',
  },
  'courrierinternational.com': {
    body: ['.article-text', '.article-body'],
    strip: ['.paywall', '.article-aside', '.newsletter', '.social-share'],
    title: 'h1.article-title',
  },

  // ===== Pure players =====
  'reporterre.net': {
    body: ['.article-texte', '.texte_article'],
    strip: ['.encadre-soutien', '.bandeau-don', '.article-share', '.article-related'],
    title: 'h1.article-titre',
    author: '.article-auteur',
  },
  'bastamag.net': {
    body: ['.article-content', '.entry-content'],
    strip: ['.article-share', '.related-posts', '.newsletter-form'],
    title: 'h1.entry-title',
    author: '.author-name',
  },
  'blast-info.fr': {
    body: ['.article-content', '.entry-content', '.post-content'],
    strip: ['.social-share', '.related-posts', '.newsletter'],
    title: 'h1.entry-title',
  },
  'disclose.ngo': {
    body: ['.article-content', '.entry-content'],
    strip: ['.share-buttons', '.related-articles', '.newsletter-banner'],
    title: 'h1',
    author: '.author-name',
  },
  'streetpress.com': {
    body: ['.article-body', '.post-content'],
    strip: ['.social-share', '.related', '.newsletter', '.paywall'],
    title: 'h1',
  },
  'reflets.info': {
    body: ['.entry-content', '.post-content'],
    strip: ['.sharedaddy', '.related-posts', '.newsletter'],
    title: 'h1.entry-title',
  },
  'lesjours.fr': {
    body: ['.article-body', '.episode-body'],
    strip: ['.paywall', '.social-share', '.related', '.subscription-cta'],
    title: 'h1',
    author: '.author-name',
  },
  'arretsurimages.net': {
    body: ['.article-content', '.field-body'],
    strip: ['.paywall', '.asi-aside', '.social-links', '.related'],
    title: 'h1.article-title',
    author: '.article-author',
  },

  // ===== Radio / TV / audiovisuel =====
  'francetvinfo.fr': {
    body: ['.article-body', '.text', '.c-body'],
    strip: [
      '.social-share', '.related-content', '.ad-container',
      '.newsletter-subscribe', '.c-signature',
    ],
    title: 'h1.content-title',
    author: '.author',
    date: 'time',
  },
  'radiofrance.fr': {
    body: ['.article-body', '.e-content', '.transcript-text'],
    strip: ['.social-buttons', '.related-episodes', '.newsletter'],
    title: 'h1',
    author: '.author-name',
  },
  'franceinter.fr': {
    body: ['.article-body', '.e-content'],
    strip: ['.social-buttons', '.related-episodes', '.newsletter'],
    title: 'h1',
    author: '.author-name',
  },
  'franceculture.fr': {
    body: ['.article-body', '.e-content'],
    strip: ['.social-buttons', '.related-episodes', '.newsletter'],
    title: 'h1',
    author: '.author-name',
  },
  'bfmtv.com': {
    body: ['.article-body', '.content-body', '.article_content_wrapper'],
    strip: [
      '.social-share', '.article-related', '.ad-slot',
      '.newsletter-wrapper', '.outbrain',
    ],
    title: 'h1.content-title',
    author: '.article-author',
  },
  'tf1info.fr': {
    body: ['.article-body', '.article-content'],
    strip: ['.social-share', '.related-articles', '.ad-wrapper'],
    title: 'h1',
    author: '.author-name',
  },
  'arte.tv': {
    body: ['.article-content', '.article__body'],
    strip: ['.social-share', '.related', '.newsletter'],
    title: 'h1',
  },
  'rfi.fr': {
    body: ['.article-body', '.o-content'],
    strip: ['.social-share', '.related', '.newsletter', '.ad-container'],
    title: 'h1.article-title',
    author: '.article-author',
  },
  'france24.com': {
    body: ['.article-body', '.o-content', '.t-content__body'],
    strip: ['.social-share', '.related', '.newsletter', '.ad-container'],
    title: 'h1.article-title',
    author: '.article-author',
  },

  // ===== PQR (Presse Quotidienne Regionale) =====
  'lalsace.fr': {
    body: ['.article-body', '.content-article', '.paywall-content'],
    strip: [
      '.article-related', '.social-share', '.paywall-overlay',
      '.subscriber-only-overlay', '.newsletter', '.ad-container',
    ],
    title: 'h1.article-title',
    author: '.article-author',
    date: 'time.article-date',
  },
  'dna.fr': {
    body: ['.article-body', '.content-article', '.paywall-content'],
    strip: ['.article-related', '.social-share', '.paywall-overlay', '.ad-container'],
    title: 'h1.article-title',
    author: '.article-author',
  },
  'estrepublicain.fr': {
    body: ['.article-body', '.content-article'],
    strip: ['.article-related', '.social-share', '.paywall-overlay', '.ad-container'],
    title: 'h1.article-title',
    author: '.article-author',
  },
  'leprogres.fr': {
    body: ['.article-body', '.content-article'],
    strip: ['.article-related', '.social-share', '.paywall-overlay', '.ad-container'],
    title: 'h1.article-title',
    author: '.article-author',
  },
  'ledauphine.com': {
    body: ['.article-body', '.content-article'],
    strip: ['.article-related', '.social-share', '.paywall-overlay', '.ad-container'],
    title: 'h1.article-title',
    author: '.article-author',
  },
  'ladepeche.fr': {
    body: ['.article-body', '.article-content'],
    strip: ['.social-share', '.article-aside', '.ad-container', '.newsletter'],
    title: 'h1.article-title',
    author: '.article-author',
  },
  'sudouest.fr': {
    body: ['.article-body', '.article-content'],
    strip: ['.social-share', '.article-aside', '.ad-container', '.paywall'],
    title: 'h1.article-title',
    author: '.article-author',
  },
  'lavoixdunord.fr': {
    body: ['.article-body', '.article-content'],
    strip: ['.social-share', '.article-aside', '.ad-container', '.paywall'],
    title: 'h1',
    author: '.article-author',
  },
  'ouest-france.fr': {
    body: ['.article-body', '.su-article-body'],
    strip: [
      '.paywall', '.article-related', '.social-bar',
      '.ad-slot', '.newsletter-block',
    ],
    title: 'h1',
    author: '.article-author',
  },
  'letelegramme.fr': {
    body: ['.article-body', '.article-content'],
    strip: ['.paywall', '.social-share', '.ad-container', '.related'],
    title: 'h1',
    author: '.article-author',
  },
  'midilibre.fr': {
    body: ['.article-body', '.content-article'],
    strip: ['.social-share', '.ad-container', '.paywall-overlay', '.related'],
    title: 'h1.article-title',
    author: '.article-author',
  },
  'nicematin.com': {
    body: ['.article-body', '.content-article'],
    strip: ['.social-share', '.ad-container', '.paywall-overlay', '.related'],
    title: 'h1.article-title',
  },
  'lamarseillaise.fr': {
    body: ['.article-body', '.field-name-body'],
    strip: ['.social-share', '.related-articles'],
    title: 'h1',
    author: '.article-author',
  },
  'courrier-picard.fr': {
    body: ['.article-body', '.content-article'],
    strip: ['.article-related', '.social-share', '.paywall-overlay', '.ad-container'],
    title: 'h1.article-title',
  },
  'leparisien.fr/herault': {
    body: ['.article-section'],
    strip: ['.paywall', '.social-share'],
    title: 'h1.article-title',
  },
  'actu.fr': {
    body: ['.article-body', '.entry-content'],
    strip: ['.social-share', '.related-articles', '.ad-container', '.newsletter'],
    title: 'h1.entry-title',
    author: '.author-name',
  },

  // ===== Institutionnel / rapports =====
  'vie-publique.fr': {
    body: ['.field--name-body', '.article-body'],
    strip: ['.social-share', '.related-content', '.breadcrumb'],
    title: 'h1.page-title',
  },
  'senat.fr': {
    body: ['.article-content', '#content'],
    strip: ['.breadcrumb', '.social-share'],
    title: 'h1',
  },
  'assemblee-nationale.fr': {
    body: ['#content-inner', '.article-content'],
    strip: ['.breadcrumb', '.social-share'],
    title: 'h1',
  },
  'legifrance.gouv.fr': {
    body: ['.article-content', '#content'],
    strip: ['.breadcrumb'],
    title: 'h1',
  },
  'insee.fr': {
    body: ['.article-body', '.content-body'],
    strip: ['.social-share', '.related', '.breadcrumb'],
    title: 'h1',
    author: '.author',
  },
  'irdes.fr': {
    body: ['.article-content', '#content'],
    strip: ['.breadcrumb', '.social-share'],
    title: 'h1',
  },

  // ===== Associatif / ONG =====
  'oxfam.org': {
    body: ['.article-body', '.post-content'],
    strip: ['.social-share', '.related', '.newsletter', '.cta-block'],
    title: 'h1',
  },
  'amnesty.fr': {
    body: ['.article-body', '.wysiwyg-content'],
    strip: ['.social-share', '.related', '.newsletter'],
    title: 'h1',
  },
  'greenpeace.fr': {
    body: ['.article-body', '.post-content'],
    strip: ['.social-share', '.related', '.donation-form'],
    title: 'h1',
  },
  'attac.org': {
    body: ['.article-content', '.entry-content'],
    strip: ['.social-share', '.related'],
    title: 'h1',
  },

  // ===== Agences =====
  'afp.com': {
    body: ['.article-body', '.content'],
    strip: ['.social-share', '.related'],
    title: 'h1',
  },

  // ===== Hebdos / magazines =====
  'telerama.fr': {
    body: ['.article-body', '.article-text'],
    strip: ['.paywall', '.social-share', '.article-related', '.newsletter'],
    title: 'h1',
    author: '.article-author',
  },
  'alternatives-economiques.fr': {
    body: ['.article-body', '.field-body'],
    strip: ['.paywall', '.social-share', '.related', '.newsletter'],
    title: 'h1',
    author: '.author-name',
  },
  'politis.fr': {
    body: ['.article-content', '.entry-content'],
    strip: ['.paywall', '.social-share', '.related'],
    title: 'h1',
    author: '.author-name',
  },
  'lecanardenchaine.fr': {
    body: ['.article-content', '.entry-content'],
    strip: ['.paywall', '.social-share'],
    title: 'h1',
  },

  // ===== Sciences / fact-checking =====
  'theconversation.com': {
    body: ['.article-body', '.content-body'],
    strip: ['.social-share', '.related', '.newsletter', '.disclosure'],
    title: 'h1',
    author: '.author-name',
  },
  'lemediatv.fr': {
    body: ['.article-content', '.entry-content'],
    strip: ['.social-share', '.related'],
    title: 'h1',
  },
}

/**
 * Find the matching site config for a given URL.
 * Matches by domain suffix (e.g. "www.lemonde.fr" matches "lemonde.fr").
 */
export function findSiteConfig(url: string): SiteConfig | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    // Try exact match first, then suffix match
    for (const [domain, config] of Object.entries(SITE_CONFIGS)) {
      if (hostname === domain || hostname.endsWith('.' + domain)) {
        return config
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Apply site-specific rules to a JSDOM document before Readability parsing.
 * - Strips unwanted elements
 * - If body selectors exist, wraps matching content for Readability focus
 */
export function applySiteConfig(document: Document, config: SiteConfig): void {
  // Strip unwanted elements
  if (config.strip) {
    for (const selector of config.strip) {
      try {
        const elements = document.querySelectorAll(selector)
        elements.forEach(el => el.remove())
      } catch { /* invalid selector, skip */ }
    }
  }

  // If body selectors are defined and we find content, boost it for Readability
  // by adding a data attribute that helps Readability prioritize it
  if (config.body) {
    for (const selector of config.body) {
      try {
        const el = document.querySelector(selector)
        if (el) {
          // Mark as the main content area
          el.setAttribute('data-reader-content', 'true')
          el.id = el.id || 'ftr-article-body'
          break
        }
      } catch { /* invalid selector, skip */ }
    }
  }
}

/**
 * Extract metadata (author, date) from document using site config.
 */
export function extractSiteMetadata(document: Document, config: SiteConfig): {
  author?: string
  date?: string
  title?: string
} {
  const meta: { author?: string; date?: string; title?: string } = {}

  if (config.author) {
    try {
      const el = document.querySelector(config.author)
      if (el?.textContent) meta.author = el.textContent.trim()
    } catch { /* skip */ }
  }

  if (config.date) {
    try {
      const el = document.querySelector(config.date)
      if (el) {
        meta.date = el.getAttribute('datetime') || el.textContent?.trim()
      }
    } catch { /* skip */ }
  }

  if (config.title) {
    try {
      const el = document.querySelector(config.title)
      if (el?.textContent) meta.title = el.textContent.trim()
    } catch { /* skip */ }
  }

  return meta
}

/** Get the number of configured sites */
export function getSiteConfigCount(): number {
  return Object.keys(SITE_CONFIGS).length
}

/** Get all configured domains */
export function getConfiguredDomains(): string[] {
  return Object.keys(SITE_CONFIGS)
}
