import { useState } from 'react'

interface SourceImageProps {
  src?: string | null
  alt?: string
  className?: string
  loading?: 'lazy' | 'eager'
  /** Affiché si pas d'URL ou si le chargement échoue (hotlink bloqué, lien mort). */
  fallback?: React.ReactNode
}

/**
 * Image d'une source, robuste au hotlinking.
 *
 * Beaucoup de médias renvoient 403 quand on charge leur og:image depuis un
 * autre domaine (ils vérifient l'en-tête Referer). `referrerPolicy="no-referrer"`
 * supprime cet en-tête et débloque l'immense majorité des images « invisibles ».
 * Si le chargement échoue malgré tout (lien mort, image supprimée), on retombe
 * sur le fallback fourni — fidèle à la doctrine « la source est une carte qu'on
 * promène » : toujours une image, ou à défaut une initiale sobre.
 */
export default function SourceImage({
  src,
  alt = '',
  className,
  loading = 'lazy',
  fallback = null,
}: SourceImageProps) {
  const [enErreur, setEnErreur] = useState(false)
  if (!src || enErreur) return <>{fallback}</>
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={loading}
      referrerPolicy="no-referrer"
      onError={() => setEnErreur(true)}
    />
  )
}
