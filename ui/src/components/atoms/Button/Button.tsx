import type { ComponentChildren } from 'preact'
import './Button.css'

type ButtonProps = {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  children: ComponentChildren
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
    class={`btn btn--${variant} btn--${size}`}
    onClick={onClick}
    disabled={disabled}
    type={type}
  >
    {children}
  </button>
)
