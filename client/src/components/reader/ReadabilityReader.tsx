interface Props {
  content: string
}

export default function ReadabilityReader({ content }: Props) {
  return (
    <article
      className="reader-content readability-body"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  )
}
