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
  </header>
)
