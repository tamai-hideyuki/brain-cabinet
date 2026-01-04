/**
 * TouchJoystickOverlay - Canvas外に配置するジョイスティックUI
 */

import { useCallback } from 'react'
import { VirtualJoystick } from './VirtualJoystick'
import { touchInputState } from './TouchControls'

export function TouchJoystickOverlay() {
  const handleMoveChange = useCallback((x: number, y: number) => {
    touchInputState.move = { x, y }
  }, [])

  const handleMoveEnd = useCallback(() => {
    touchInputState.move = { x: 0, y: 0 }
  }, [])

  const handleLookChange = useCallback((x: number, y: number) => {
    touchInputState.look = { x, y }
  }, [])

  const handleLookEnd = useCallback(() => {
    touchInputState.look = { x: 0, y: 0 }
  }, [])

  return (
    <>
      <VirtualJoystick
        position="left"
        onMove={handleMoveChange}
        onMoveEnd={handleMoveEnd}
      />
      <VirtualJoystick
        position="right"
        onMove={handleLookChange}
        onMoveEnd={handleLookEnd}
      />
    </>
  )
}
