interface Props {
  chemin: string | null
  contenu?: string | null
}

export default function PdfReader({ chemin, contenu }: Props) {
  // Le chemin stocke est de la forme "uploads/archive-...pdf" ; le dossier est
  // deja servi sous /uploads, donc on retire un eventuel prefixe "uploads/".
  const src = chemin ? `/uploads/${chemin.replace(/^uploads\//, '')}` : null

  // Si le texte a ete extrait du PDF, on l'affiche (lecture facile) avec un lien
  // vers le PDF original. Sinon, on retombe sur l'iframe du PDF.
  if (contenu && contenu.trim()) {
    return (
      <div className="reader-content pdf-reader pdf-reader--texte">
        {src && (
          <p className="pdf-original-link">
            <a href={src} target="_blank" rel="noopener noreferrer">Ouvrir le PDF original ↗</a>
          </p>
        )}
        <article className="readability-body pdf-texte">{contenu}</article>
      </div>
    )
  }

  if (!src) return <p>Fichier PDF introuvable.</p>

  return (
    <div className="reader-content pdf-reader">
      <iframe src={src} title="PDF" className="pdf-iframe" />
    </div>
  )
}
