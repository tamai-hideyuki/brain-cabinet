/**
 * libraryStorage のテスト
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as commandClient from '../api/commandClient'

// モック
vi.mock('../api/commandClient', () => ({
  sendCommand: vi.fn(),
}))

// 動的インポートでキャッシュをリセット
const importFreshModule = async () => {
  vi.resetModules()
  return await import('./libraryStorage')
}

describe('libraryStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('loadLibraryPositions', () => {
    it('サーバーから位置を取得してキャッシュする', async () => {
      const mockPositions = {
        'Folder1': [0, 0, 0] as [number, number, number],
        'Folder2': [60, 0, 0] as [number, number, number],
      }
      vi.mocked(commandClient.sendCommand).mockResolvedValue(mockPositions)

      const { loadLibraryPositions } = await importFreshModule()
      const result = await loadLibraryPositions()

      expect(commandClient.sendCommand).toHaveBeenCalledWith('bookmark.getLibraryPositions', {})
      expect(result).toEqual(mockPositions)
    })

    it('エラー時は空オブジェクトを返す', async () => {
      vi.mocked(commandClient.sendCommand).mockRejectedValue(new Error('Network error'))
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const { loadLibraryPositions } = await importFreshModule()
      const result = await loadLibraryPositions()

      expect(result).toEqual({})
      consoleSpy.mockRestore()
    })
  })

  describe('saveBookmarkPosition', () => {
    it('サーバーに位置を保存してキャッシュを更新する', async () => {
      const mockPositions = { 'Folder1': [0, 0, 0] as [number, number, number] }
      vi.mocked(commandClient.sendCommand)
        .mockResolvedValueOnce(mockPositions) // loadLibraryPositions
        .mockResolvedValueOnce({ success: true }) // saveBookmarkPosition

      const { loadLibraryPositions, saveBookmarkPosition, getBookmarkPosition } = await importFreshModule()

      // 先に位置をロード
      await loadLibraryPositions()

      // 新しい位置を保存
      await saveBookmarkPosition('Folder1', [100, 0, -50])

      expect(commandClient.sendCommand).toHaveBeenCalledWith('bookmark.updateLibraryPosition', {
        folderName: 'Folder1',
        position: [100, 0, -50],
      })

      // キャッシュが更新されている
      const cached = getBookmarkPosition('Folder1')
      expect(cached).toEqual([100, 0, -50])
    })

    it('エラー時はログを出力するがスローしない', async () => {
      vi.mocked(commandClient.sendCommand)
        .mockResolvedValueOnce({}) // loadLibraryPositions
        .mockRejectedValueOnce(new Error('Save failed')) // saveBookmarkPosition
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const { loadLibraryPositions, saveBookmarkPosition } = await importFreshModule()
      await loadLibraryPositions()

      // エラーがスローされないことを確認
      await expect(saveBookmarkPosition('Test', [0, 0, 0])).resolves.toBeUndefined()

      consoleSpy.mockRestore()
    })
  })

  describe('getBookmarkPosition', () => {
    it('キャッシュから位置を取得する', async () => {
      const mockPositions = { 'MyFolder': [10, 20, 30] as [number, number, number] }
      vi.mocked(commandClient.sendCommand).mockResolvedValue(mockPositions)

      const { loadLibraryPositions, getBookmarkPosition } = await importFreshModule()
      await loadLibraryPositions()

      const result = getBookmarkPosition('MyFolder')
      expect(result).toEqual([10, 20, 30])
    })

    it('存在しないフォルダはnullを返す', async () => {
      vi.mocked(commandClient.sendCommand).mockResolvedValue({})

      const { loadLibraryPositions, getBookmarkPosition } = await importFreshModule()
      await loadLibraryPositions()

      const result = getBookmarkPosition('NonExistent')
      expect(result).toBeNull()
    })

    it('ロード前はnullを返す', async () => {
      const { getBookmarkPosition } = await importFreshModule()

      const result = getBookmarkPosition('AnyFolder')
      expect(result).toBeNull()
    })
  })

  describe('loadLibraryColors', () => {
    it('サーバーから色を取得してキャッシュする', async () => {
      const mockColors = {
        'Folder1': '#FF5733',
        'Folder2': '#3B82F6',
      }
      vi.mocked(commandClient.sendCommand).mockResolvedValue(mockColors)

      const { loadLibraryColors } = await importFreshModule()
      const result = await loadLibraryColors()

      expect(commandClient.sendCommand).toHaveBeenCalledWith('bookmark.getLibraryColors', {})
      expect(result).toEqual(mockColors)
    })

    it('エラー時は空オブジェクトを返す', async () => {
      vi.mocked(commandClient.sendCommand).mockRejectedValue(new Error('Network error'))
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const { loadLibraryColors } = await importFreshModule()
      const result = await loadLibraryColors()

      expect(result).toEqual({})
      consoleSpy.mockRestore()
    })
  })

  describe('saveBookmarkColor', () => {
    it('サーバーに色を保存してキャッシュを更新する', async () => {
      const mockColors = { 'Folder1': '#F59E0B' }
      vi.mocked(commandClient.sendCommand)
        .mockResolvedValueOnce(mockColors) // loadLibraryColors
        .mockResolvedValueOnce({ success: true }) // saveBookmarkColor

      const { loadLibraryColors, saveBookmarkColor, getBookmarkColor } = await importFreshModule()

      // 先に色をロード
      await loadLibraryColors()

      // 新しい色を保存
      await saveBookmarkColor('Folder1', '#EF4444')

      expect(commandClient.sendCommand).toHaveBeenCalledWith('bookmark.updateLibraryColor', {
        folderName: 'Folder1',
        color: '#EF4444',
      })

      // キャッシュが更新されている
      const cached = getBookmarkColor('Folder1')
      expect(cached).toBe('#EF4444')
    })

    it('エラー時はログを出力するがスローしない', async () => {
      vi.mocked(commandClient.sendCommand)
        .mockResolvedValueOnce({}) // loadLibraryColors
        .mockRejectedValueOnce(new Error('Save failed')) // saveBookmarkColor
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const { loadLibraryColors, saveBookmarkColor } = await importFreshModule()
      await loadLibraryColors()

      // エラーがスローされないことを確認
      await expect(saveBookmarkColor('Test', '#FF0000')).resolves.toBeUndefined()

      consoleSpy.mockRestore()
    })
  })

  describe('getBookmarkColor', () => {
    it('キャッシュから色を取得する', async () => {
      const mockColors = { 'MyFolder': '#22C55E' }
      vi.mocked(commandClient.sendCommand).mockResolvedValue(mockColors)

      const { loadLibraryColors, getBookmarkColor } = await importFreshModule()
      await loadLibraryColors()

      const result = getBookmarkColor('MyFolder')
      expect(result).toBe('#22C55E')
    })

    it('存在しないフォルダはnullを返す', async () => {
      vi.mocked(commandClient.sendCommand).mockResolvedValue({})

      const { loadLibraryColors, getBookmarkColor } = await importFreshModule()
      await loadLibraryColors()

      const result = getBookmarkColor('NonExistent')
      expect(result).toBeNull()
    })

    it('ロード前はnullを返す', async () => {
      const { getBookmarkColor } = await importFreshModule()

      const result = getBookmarkColor('AnyFolder')
      expect(result).toBeNull()
    })
  })
})
