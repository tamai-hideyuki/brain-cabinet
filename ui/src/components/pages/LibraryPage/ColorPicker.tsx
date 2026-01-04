/**
 * ColorPicker - ブックマークフォルダの色を選択するポップアップ
 */

import { useState, useEffect, useRef } from 'react'
import './ColorPicker.css'

// プリセットカラー
const PRESET_COLORS = [
  '#F59E0B', // amber (default)
  '#EF4444', // red
  '#F97316', // orange
  '#84CC16', // lime
  '#22C55E', // green
  '#14B8A6', // teal
  '#06B6D4', // cyan
  '#3B82F6', // blue
  '#6366F1', // indigo
  '#8B5CF6', // violet
  '#A855F7', // purple
  '#EC4899', // pink
  '#F43F5E', // rose
  '#78716C', // stone
]

type Props = {
  currentColor: string
  position: { x: number; y: number }
  onSelectColor: (color: string) => void
  onClose: () => void
}

export function ColorPicker({ currentColor, position, onSelectColor, onClose }: Props) {
  const [selectedColor, setSelectedColor] = useState(currentColor)
  const popupRef = useRef<HTMLDivElement>(null)

  // 外側クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  // ESCキーで閉じる
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleColorClick = (color: string) => {
    setSelectedColor(color)
    onSelectColor(color)
    onClose()
  }

  return (
    <div
      ref={popupRef}
      className="color-picker"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <div className="color-picker-header">
        <span>色を選択</span>
      </div>
      <div className="color-picker-grid">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            className={`color-picker-item ${selectedColor === color ? 'selected' : ''}`}
            style={{ backgroundColor: color }}
            onClick={() => handleColorClick(color)}
            title={color}
          />
        ))}
      </div>
    </div>
  )
}
