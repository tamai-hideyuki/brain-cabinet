import type { KeyboardEvent } from 'react'
import './Input.css'

type InputProps = {
  type?: 'text' | 'search'
  placeholder?: string
  value: string
  onChange: (value: string) => void
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void
}

export const Input = ({
  type = 'text',
  placeholder,
  value,
  onChange,
  onKeyDown,
}: InputProps) => (
  <input
    className="input"
    type={type}
    placeholder={placeholder}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    onKeyDown={onKeyDown}
  />
)
