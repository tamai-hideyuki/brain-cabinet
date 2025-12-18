import type { ReactNode } from 'react'
import './Badge.css'

type BadgeProps = {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'decision' | 'learning' | 'promotion'
  children: ReactNode
  title?: string
}

export const Badge = ({ variant = 'default', children, title }: BadgeProps) => (
  <span className={`badge badge--${variant}`} title={title}>{children}</span>
)
