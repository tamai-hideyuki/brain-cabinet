import type { ReactNode } from 'react'
import { Header } from '../../organisms/Header'
import './MainLayout.css'

type MainLayoutProps = {
  children: ReactNode
}

export const MainLayout = ({ children }: MainLayoutProps) => (
  <div className="main-layout">
    <Header />
    <main className="main-layout__content">{children}</main>
  </div>
)
