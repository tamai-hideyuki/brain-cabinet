/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTheme } from './index'

describe('useTheme', () => {
  const createMockMatchMedia = (matches: boolean) => {
    return vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  }

  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(document.documentElement, 'setAttribute')
    window.matchMedia = createMockMatchMedia(false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('ローカルストレージにテーマがあればそれを使用する', () => {
    localStorage.setItem('brain-cabinet-theme', 'dark')

    const { result } = renderHook(() => useTheme())

    expect(result.current.theme).toBe('dark')
  })

  it('ローカルストレージになくダークモード設定ならdarkを使用する', () => {
    window.matchMedia = createMockMatchMedia(true)

    const { result } = renderHook(() => useTheme())

    expect(result.current.theme).toBe('dark')
  })

  it('ローカルストレージになくライトモード設定ならlightを使用する', () => {
    window.matchMedia = createMockMatchMedia(false)

    const { result } = renderHook(() => useTheme())

    expect(result.current.theme).toBe('light')
  })

  it('テーマ変更時にdata-theme属性とローカルストレージを更新する', () => {
    const { result } = renderHook(() => useTheme())

    expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'light')
    expect(localStorage.getItem('brain-cabinet-theme')).toBe('light')

    act(() => {
      result.current.toggleTheme()
    })

    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark')
    expect(localStorage.getItem('brain-cabinet-theme')).toBe('dark')
  })

  it('toggleThemeでテーマを切り替える', () => {
    const { result } = renderHook(() => useTheme())

    expect(result.current.theme).toBe('light')

    act(() => {
      result.current.toggleTheme()
    })

    expect(result.current.theme).toBe('dark')

    act(() => {
      result.current.toggleTheme()
    })

    expect(result.current.theme).toBe('light')
  })

  it('システム設定変更時にローカルストレージがなければテーマを更新する', () => {
    let changeHandler: ((e: MediaQueryListEvent) => void) | null = null
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn((event: string, handler: (e: MediaQueryListEvent) => void) => {
        if (event === 'change') changeHandler = handler
      }),
      removeEventListener: vi.fn(),
    }))

    const { result } = renderHook(() => useTheme())

    expect(result.current.theme).toBe('light')

    localStorage.removeItem('brain-cabinet-theme')

    act(() => {
      if (changeHandler) {
        changeHandler({ matches: true } as MediaQueryListEvent)
      }
    })

    expect(result.current.theme).toBe('dark')
  })

  it('アンマウント時にイベントリスナーを削除する', () => {
    const removeEventListenerMock = vi.fn()
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: removeEventListenerMock,
    }))

    const { unmount } = renderHook(() => useTheme())

    unmount()

    expect(removeEventListenerMock).toHaveBeenCalledWith('change', expect.any(Function))
  })

  it('不正なローカルストレージ値はシステム設定にフォールバックする', () => {
    localStorage.setItem('brain-cabinet-theme', 'invalid')
    window.matchMedia = createMockMatchMedia(true)

    const { result } = renderHook(() => useTheme())

    expect(result.current.theme).toBe('dark')
  })
})
