interface Props {
  chemin: string | null
}

export default function PdfReader({ chemin }: Props) {
  if (!chemin) return <p>Fichier PDF introuvable.</p>

  // Le chemin stocke est de la forme "uploads/archive-...pdf" ; le dossier est
  // deja servi sous /uploads, donc on retire un eventuel prefixe "uploads/".
  const src = `/uploads/${chemin.replace(/^uploads\//, '')}`

  return (
    <div className="reader-content pdf-reader">
      <iframe src={src} title="PDF" className="pdf-iframe" />
    </div>
  )
}
