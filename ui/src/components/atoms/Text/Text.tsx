import type { ComponentChildren } from 'preact'
import './Text.css'

type TextProps = {
  variant?: 'title' | 'subtitle' | 'body' | 'caption'
  truncate?: boolean
  lines?: number
  children: ComponentChildren
}

export const Text = ({
  variant = 'body',
  truncate = false,
  lines,
  children,
}: TextProps) => {
  const Tag = variant === 'title' ? 'h2' : variant === 'subtitle' ? 'h3' : 'p'
  const style = lines ? { WebkitLineClamp: lines } : undefined

  return (
    <Tag
      class={`text text--${variant} ${truncate ? 'text--truncate' : ''} ${lines ? 'text--clamp' : ''}`}
      style={style}
    >
      {children}
    </Tag>
  )
}
