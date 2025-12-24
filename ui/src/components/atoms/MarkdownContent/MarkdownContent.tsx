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

/**
 * note-image:// プロトコルを実際のAPI URLに変換
 */
const transformImageUrl = (src: string): string => {
  if (src.startsWith('note-image://')) {
    const imageId = src.replace('note-image://', '')
    return `/api/notes/images/${imageId}/data`
  }
  return src
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
          img: ({ src, alt, ...props }) => {
            const transformedSrc = src ? transformImageUrl(src) : ''
            return (
              <img
                src={transformedSrc}
                alt={alt || ''}
                className="markdown-content__image"
                loading="lazy"
                {...props}
              />
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
