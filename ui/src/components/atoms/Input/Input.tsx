import './Input.css'

type InputProps = {
  type?: 'text' | 'search'
  placeholder?: string
  value: string
  onChange: (value: string) => void
  onKeyDown?: (e: KeyboardEvent) => void
}

export const Input = ({
  type = 'text',
  placeholder,
  value,
  onChange,
  onKeyDown,
}: InputProps) => (
  <input
    class="input"
    type={type}
    placeholder={placeholder}
    value={value}
    onInput={(e) => onChange((e.target as HTMLInputElement).value)}
    onKeyDown={onKeyDown}
  />
)
