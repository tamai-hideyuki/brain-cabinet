import { Input } from '../../atoms/Input'
import { Button } from '../../atoms/Button'
import './SearchBox.css'

type SearchBoxProps = {
  value: string
  onChange: (value: string) => void
  onSearch: () => void
  placeholder?: string
}

export const SearchBox = ({
  value,
  onChange,
  onSearch,
  placeholder = '検索...',
}: SearchBoxProps) => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSearch()
    }
  }

  return (
    <div class="search-box">
      <Input
        type="search"
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
      />
      <Button variant="primary" size="md" onClick={onSearch}>
        検索
      </Button>
    </div>
  )
}
