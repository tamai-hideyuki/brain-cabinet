import type { ReactNode } from 'react'
import './Badge.css'

type BadgeProps = {
  variant?: 'default' | 'primary' | 'success' | 'warning'
  children: ReactNode
}

export const Badge = ({ variant = 'default', children }: BadgeProps) => (
  <span className={`badge badge--${variant}`}>{children}</span>
)
