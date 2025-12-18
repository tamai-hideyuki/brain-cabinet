import type { ComponentChildren } from 'preact'
import './Badge.css'

type BadgeProps = {
  variant?: 'default' | 'primary' | 'success' | 'warning'
  children: ComponentChildren
}

export const Badge = ({ variant = 'default', children }: BadgeProps) => (
  <span class={`badge badge--${variant}`}>{children}</span>
)
