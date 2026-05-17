interface Props {
  chemin: string | null
}

export default function PdfReader({ chemin }: Props) {
  if (!chemin) return <p>Fichier PDF introuvable.</p>

  return (
    <div className="reader-content pdf-reader">
      <iframe src={`/uploads/${chemin}`} title="PDF" className="pdf-iframe" />
    </div>
  )
}
