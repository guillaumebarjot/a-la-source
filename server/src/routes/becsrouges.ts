import { Router } from 'express'

const router = Router()

interface PeerTubeVideo {
  uuid: string
  name: string
  description: string
  thumbnailPath: string
  duration: number
  publishedAt: string
  views: number
  url: string
}

interface YouTubeSnippet {
  title: string
  description: string
  publishedAt: string
  thumbnails: { medium?: { url: string } }
  resourceId?: { videoId: string }
}

// Cache en memoire (rafraichi toutes les heures)
let cacheIndymotion: { data: unknown[]; fetchedAt: number } = { data: [], fetchedAt: 0 }
let cacheYoutube: { data: unknown[]; fetchedAt: number } = { data: [], fetchedAt: 0 }
const CACHE_TTL = 3600000 // 1 heure

// GET /api/becs-rouges/videos/indymotion
router.get('/videos/indymotion', async (_req, res) => {
  const now = Date.now()
  if (cacheIndymotion.data.length > 0 && now - cacheIndymotion.fetchedAt < CACHE_TTL) {
    return res.json(cacheIndymotion.data)
  }

  try {
    // API PeerTube — recuperer les videos du compte
    const resp = await fetch(
      'https://indymotion.fr/api/v1/accounts/nupesalsacenordvosgesdunord/videos?count=12&sort=-publishedAt'
    )
    if (!resp.ok) throw new Error(`PeerTube ${resp.status}`)
    const json = await resp.json() as { data: PeerTubeVideo[] }

    const videos = json.data.map((v) => ({
      id: v.uuid,
      titre: v.name,
      description: v.description?.substring(0, 200) || '',
      vignette: `https://indymotion.fr${v.thumbnailPath}`,
      duree: v.duration,
      date: v.publishedAt,
      vues: v.views,
      url: `https://indymotion.fr/w/${v.uuid}`,
      plateforme: 'indymotion'
    }))

    cacheIndymotion = { data: videos, fetchedAt: now }
    res.json(videos)
  } catch (err) {
    console.error('Erreur PeerTube:', err)
    res.json(cacheIndymotion.data) // renvoyer le cache meme expire
  }
})

// GET /api/becs-rouges/videos/youtube
router.get('/videos/youtube', async (_req, res) => {
  const now = Date.now()
  if (cacheYoutube.data.length > 0 && now - cacheYoutube.fetchedAt < CACHE_TTL) {
    return res.json(cacheYoutube.data)
  }

  try {
    // Sans cle API YouTube, on utilise le RSS feed
    const resp = await fetch(
      'https://www.youtube.com/feeds/videos.xml?channel_id=UCxxxxxxxxxxx' // channel ID des Becs Rouges
    )
    // Fallback : retourner un tableau vide avec message
    // L'integration complete necessite une cle API YouTube ou le channel ID exact
    res.json([])
  } catch {
    res.json([])
  }
})

export default router
