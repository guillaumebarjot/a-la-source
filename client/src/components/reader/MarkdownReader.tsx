import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'

interface Props {
  content: string
}

export default function MarkdownReader({ content }: Props) {
  return (
    <article className="reader-content markdown-body">
      <ReactMarkdown rehypePlugins={[rehypeRaw]}>{content}</ReactMarkdown>
    </article>
  )
}
