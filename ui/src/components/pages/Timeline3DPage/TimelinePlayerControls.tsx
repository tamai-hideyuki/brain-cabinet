/**
 * TimelinePlayerControls - タイムライン用のプレイヤーコントロール
 * 道に沿った移動に最適化
 */

import { useRef, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { PointerLockControls as PointerLockControlsImpl } from 'three/examples/jsm/controls/PointerLockControls.js'
import * as THREE from 'three'

const MOVE_SPEED = 15
const SPRINT_MULTIPLIER = 2.5
const FLOOR_Y = 0

export function TimelinePlayerControls() {
  const { camera, gl } = useThree()
  const controlsRef = useRef<PointerLockControlsImpl | null>(null)
  const moveState = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false,
    sprint: false,
  })
  const velocity = useRef(new THREE.Vector3())
  const direction = useRef(new THREE.Vector3())

  useEffect(() => {
    const controls = new PointerLockControlsImpl(camera, gl.domElement)
    controlsRef.current = controls

    const handleClick = () => {
      controls.lock()
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          moveState.current.forward = true
          break
        case 'KeyS':
        case 'ArrowDown':
          moveState.current.backward = true
          break
        case 'KeyA':
        case 'ArrowLeft':
          moveState.current.left = true
          break
        case 'KeyD':
        case 'ArrowRight':
          moveState.current.right = true
          break
        case 'KeyQ':
        case 'Space':
          moveState.current.up = true
          break
        case 'KeyE':
        case 'KeyC':
          moveState.current.down = true
          break
        case 'ShiftLeft':
        case 'ShiftRight':
          moveState.current.sprint = true
          break
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          moveState.current.forward = false
          break
        case 'KeyS':
        case 'ArrowDown':
          moveState.current.backward = false
          break
        case 'KeyA':
        case 'ArrowLeft':
          moveState.current.left = false
          break
        case 'KeyD':
        case 'ArrowRight':
          moveState.current.right = false
          break
        case 'KeyQ':
        case 'Space':
          moveState.current.up = false
          break
        case 'KeyE':
        case 'KeyC':
          moveState.current.down = false
          break
        case 'ShiftLeft':
        case 'ShiftRight':
          moveState.current.sprint = false
          break
      }
    }

    gl.domElement.addEventListener('click', handleClick)
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keyup', handleKeyUp)

    return () => {
      controls.dispose()
      gl.domElement.removeEventListener('click', handleClick)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('keyup', handleKeyUp)
    }
  }, [camera, gl])

  useFrame((_, delta) => {
    if (!controlsRef.current?.isLocked) return

    const speed = moveState.current.sprint ? MOVE_SPEED * SPRINT_MULTIPLIER : MOVE_SPEED

    // 減速
    velocity.current.x -= velocity.current.x * 10.0 * delta
    velocity.current.y -= velocity.current.y * 10.0 * delta
    velocity.current.z -= velocity.current.z * 10.0 * delta

    // 入力に基づいて方向を設定
    direction.current.z = Number(moveState.current.forward) - Number(moveState.current.backward)
    direction.current.x = Number(moveState.current.right) - Number(moveState.current.left)
    direction.current.y = Number(moveState.current.up) - Number(moveState.current.down)

    // 水平方向は正規化
    const horizontal = new THREE.Vector2(direction.current.x, direction.current.z)
    horizontal.normalize()
    direction.current.x = horizontal.x
    direction.current.z = horizontal.y

    // 速度を更新
    if (moveState.current.forward || moveState.current.backward) {
      velocity.current.z -= direction.current.z * speed * delta
    }
    if (moveState.current.left || moveState.current.right) {
      velocity.current.x -= direction.current.x * speed * delta
    }
    if (moveState.current.up || moveState.current.down) {
      velocity.current.y += direction.current.y * speed * delta
    }

    // 移動を適用
    controlsRef.current.moveRight(-velocity.current.x)
    controlsRef.current.moveForward(-velocity.current.z)

    // 上下移動
    camera.position.y += velocity.current.y

    // 床の当たり判定
    if (camera.position.y < FLOOR_Y) {
      camera.position.y = FLOOR_Y
      velocity.current.y = 0
    }
  })

  return null
}
