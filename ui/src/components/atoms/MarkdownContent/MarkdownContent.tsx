import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import { remarkNoteLink } from './remarkNoteLink'
import { NoteLink } from './NoteLink'
import './MarkdownContent.css'

type MarkdownContentProps = {
  content: string
  className?: string
}

export const MarkdownContent = ({ content, className = '' }: MarkdownContentProps) => {
  return (
    <div className={`markdown-content ${className}`.trim()}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks, remarkNoteLink]}
        urlTransform={(url) => url}
        components={{
          a: ({ href, children }) => {
            if (href?.startsWith('note://')) {
              return <NoteLink href={href}>{children}</NoteLink>
            }
            return <a href={href}>{children}</a>
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
