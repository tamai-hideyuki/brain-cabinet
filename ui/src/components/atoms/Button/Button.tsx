import type { ReactNode } from 'react'
import './Button.css'

type ButtonProps = {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit'
}

export const Button = ({
  variant = 'primary',
  size = 'md',
  children,
  onClick,
  disabled = false,
  type = 'button',
}: ButtonProps) => (
  <button
    className={`btn btn--${variant} btn--${size}`}
    onClick={onClick}
    disabled={disabled}
    type={type}
  >
    {children}
  </button>
)
