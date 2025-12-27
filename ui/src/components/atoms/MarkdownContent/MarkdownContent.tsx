import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import rehypeRaw from 'rehype-raw'
import { remarkNoteLink } from './remarkNoteLink'
import { NoteLink } from './NoteLink'
import { AuthImage } from './AuthImage'
import './MarkdownContent.css'

type MarkdownContentProps = {
  content: string
  className?: string
}

/**
 * 認証が必要な画像かどうかを判定
 */
const needsAuth = (src: string): boolean => {
  // note-image:// プロトコルまたは /api/ パスは認証が必要
  return src.startsWith('note-image://') || src.startsWith('/api/')
}

export const MarkdownContent = ({ content, className = '' }: MarkdownContentProps) => {
  return (
    <div className={`markdown-content ${className}`.trim()}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks, remarkNoteLink]}
        rehypePlugins={[rehypeRaw]}
        urlTransform={(url) => url}
        components={{
          a: ({ href, children }) => {
            if (href?.startsWith('note://')) {
              return <NoteLink href={href}>{children}</NoteLink>
            }
            return <a href={href}>{children}</a>
          },
          img: ({ src, alt }) => {
            if (!src) return null

            // 認証が必要な画像はAuthImageコンポーネントを使用
            if (needsAuth(src)) {
              return (
                <AuthImage
                  src={src}
                  alt={alt || ''}
                  className="markdown-content__image"
                />
              )
            }

            // 外部画像は通常のimgタグ
            return (
              <img
                src={src}
                alt={alt || ''}
                className="markdown-content__image"
                loading="lazy"
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
