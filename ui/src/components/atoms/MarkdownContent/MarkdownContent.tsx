import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './MarkdownContent.css'

type MarkdownContentProps = {
  content: string
  className?: string
}

export const MarkdownContent = ({ content, className = '' }: MarkdownContentProps) => {
  return (
    <div className={`markdown-content ${className}`.trim()}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )
}
