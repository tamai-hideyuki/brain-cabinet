/**
 * VirtualJoystick - タッチデバイス用の仮想ジョイスティック
 */

import { useRef, useState, useCallback } from 'react'
import './VirtualJoystick.css'

type Props = {
  onMove: (x: number, y: number) => void
  onMoveEnd: () => void
  position: 'left' | 'right'
}

export function VirtualJoystick({ onMove, onMoveEnd, position }: Props) {
  const baseRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [stickPosition, setStickPosition] = useState({ x: 0, y: 0 })

  const handleStart = useCallback((clientX: number, clientY: number) => {
    if (!baseRef.current) return
    setIsDragging(true)

    const rect = baseRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    const deltaX = clientX - centerX
    const deltaY = clientY - centerY
    const maxRadius = rect.width / 2 - 20

    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
    const clampedDistance = Math.min(distance, maxRadius)
    const angle = Math.atan2(deltaY, deltaX)

    const x = Math.cos(angle) * clampedDistance
    const y = Math.sin(angle) * clampedDistance

    setStickPosition({ x, y })
    onMove(x / maxRadius, y / maxRadius)
  }, [onMove])

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging || !baseRef.current) return

    const rect = baseRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    const deltaX = clientX - centerX
    const deltaY = clientY - centerY
    const maxRadius = rect.width / 2 - 20

    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
    const clampedDistance = Math.min(distance, maxRadius)
    const angle = Math.atan2(deltaY, deltaX)

    const x = Math.cos(angle) * clampedDistance
    const y = Math.sin(angle) * clampedDistance

    setStickPosition({ x, y })
    onMove(x / maxRadius, y / maxRadius)
  }, [isDragging, onMove])

  const handleEnd = useCallback(() => {
    setIsDragging(false)
    setStickPosition({ x: 0, y: 0 })
    onMoveEnd()
  }, [onMoveEnd])

  // タッチイベント
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault()
    const touch = e.touches[0]
    handleStart(touch.clientX, touch.clientY)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault()
    const touch = e.touches[0]
    handleMove(touch.clientX, touch.clientY)
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault()
    handleEnd()
  }

  // マウスイベント（デバッグ用）
  const handleMouseDown = (e: React.MouseEvent) => {
    handleStart(e.clientX, e.clientY)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    handleMove(e.clientX, e.clientY)
  }

  const handleMouseUp = () => {
    handleEnd()
  }

  const handleMouseLeave = () => {
    if (isDragging) handleEnd()
  }

  return (
    <div
      ref={baseRef}
      className={`virtual-joystick virtual-joystick--${position}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      <div className="virtual-joystick__base">
        <div
          className="virtual-joystick__stick"
          style={{
            transform: `translate(${stickPosition.x}px, ${stickPosition.y}px)`,
          }}
        />
      </div>
      <div className="virtual-joystick__label">
        {position === 'left' ? '移動' : '回転/上下'}
      </div>
    </div>
  )
}
