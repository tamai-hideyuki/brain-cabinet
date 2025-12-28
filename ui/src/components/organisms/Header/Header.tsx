import { useState, useEffect } from 'react'
import { UserButton } from '@clerk/clerk-react'
import { Text } from '../../atoms/Text'
import { PTMIndicator } from '../../molecules/PTMIndicator'
import { useTheme } from '../../../hooks/useTheme'
import { usePTM } from '../../../hooks/usePTM'
import './Header.css'

type HeaderProps = {
  title?: string
}

export const Header = ({ title = 'Brain Cabinet' }: HeaderProps) => {
  const { theme, toggleTheme } = useTheme()
  const { ptm, loading: ptmLoading } = usePTM()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  // メニュー開閉時にbodyのスクロールを制御
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMenuOpen])

  // 画面幅が変わったらメニューを閉じる
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 640 && isMenuOpen) {
        setIsMenuOpen(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isMenuOpen])

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen)
  const closeMenu = () => setIsMenuOpen(false)

  const navLinks = [
    { href: '/ui/', label: 'ホーム' },
    { href: '/ui/notes', label: 'ノート' },
    { href: '/ui/bookmarks', label: 'ブックマーク' },
    { href: '/ui/reviews', label: 'レビュー' },
    { href: '/ui/timeline', label: 'タイムライン' },
    { href: '/ui/graph', label: 'グラフ' },
    { href: '/ui/isolation', label: '孤立ノート' },
    { href: '/ui/secret-box', label: 'BOX', isSecret: true },
  ]

  return (
    <>
      <header className="header">
        <a href="/ui/" className="header__logo">
          <Text variant="subtitle">{title}</Text>
        </a>

        {/* デスクトップナビゲーション */}
        <nav className="header__nav header__nav--desktop">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`header__nav-link ${link.isSecret ? 'header__nav-link--secret' : ''}`}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="header__actions">
          <PTMIndicator ptm={ptm} loading={ptmLoading} />
          <a
            href="/ui/system"
            className="header__icon-link"
            aria-label="システム情報"
            title="システム情報"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </a>
          <button
            className="header__theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === 'light' ? 'ダークモードに切り替え' : 'ライトモードに切り替え'}
            title={theme === 'light' ? 'ダークモード' : 'ライトモード'}
          >
            {theme === 'light' ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            )}
          </button>
          <UserButton />

          {/* モバイル用ハンバーガーボタン */}
          <button
            className="header__menu-toggle"
            onClick={toggleMenu}
            aria-label={isMenuOpen ? 'メニューを閉じる' : 'メニューを開く'}
            aria-expanded={isMenuOpen}
          >
            <span className={`header__menu-icon ${isMenuOpen ? 'header__menu-icon--open' : ''}`}>
              <span></span>
              <span></span>
              <span></span>
            </span>
          </button>
        </div>
      </header>

      {/* モバイルメニューオーバーレイ */}
      <div
        className={`header__mobile-overlay ${isMenuOpen ? 'header__mobile-overlay--open' : ''}`}
        onClick={closeMenu}
      />

      {/* モバイルナビゲーションメニュー */}
      <nav className={`header__mobile-nav ${isMenuOpen ? 'header__mobile-nav--open' : ''}`}>
        {navLinks.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className={`header__mobile-nav-link ${link.isSecret ? 'header__mobile-nav-link--secret' : ''}`}
            onClick={closeMenu}
          >
            {link.label}
          </a>
        ))}
      </nav>
    </>
  )
}
