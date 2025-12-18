import { Text } from '../../atoms/Text'
import './Header.css'

type HeaderProps = {
  title?: string
}

export const Header = ({ title = 'Brain Cabinet' }: HeaderProps) => (
  <header className="header">
    <a href="/ui/" className="header__logo">
      <Text variant="subtitle">{title}</Text>
    </a>
    <nav className="header__nav">
      <a href="/ui/" className="header__nav-link">ノート</a>
      <a href="/ui/reviews" className="header__nav-link">レビュー</a>
    </nav>
  </header>
)
