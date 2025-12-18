import type { ComponentChildren } from 'preact'
import { Header } from '../../organisms/Header'
import './MainLayout.css'

type MainLayoutProps = {
  children: ComponentChildren
}

export const MainLayout = ({ children }: MainLayoutProps) => (
  <div class="main-layout">
    <Header />
    <main class="main-layout__content">{children}</main>
  </div>
)
