import { Text } from '../../atoms/Text'
import './Header.css'

type HeaderProps = {
  title?: string
}

export const Header = ({ title = 'Brain Cabinet' }: HeaderProps) => (
  <header class="header">
    <a href="/ui/" class="header__logo">
      <Text variant="subtitle">{title}</Text>
    </a>
    <nav class="header__nav">
      <a href="/ui/" class="header__nav-link">ノート</a>
      <a href="/ui/reviews" class="header__nav-link">レビュー</a>
    </nav>
  </header>
)
