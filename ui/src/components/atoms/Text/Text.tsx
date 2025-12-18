import type { ReactNode } from 'react'
import './Text.css'

type TextProps = {
  variant?: 'title' | 'subtitle' | 'body' | 'caption'
  truncate?: boolean
  lines?: number
  children: ReactNode
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
      className={`text text--${variant} ${truncate ? 'text--truncate' : ''} ${lines ? 'text--clamp' : ''}`}
      style={style}
    >
      {children}
    </Tag>
  )
}
