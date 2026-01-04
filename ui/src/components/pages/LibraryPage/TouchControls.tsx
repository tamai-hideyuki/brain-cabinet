/**
 * TouchControls - タッチデバイス用のカメラ操作
 * 左ジョイスティック: 前後左右移動
 * 右ジョイスティック: 左右で視点回転、上下で高さ変更
 */

import { useRef, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const MOVE_SPEED = 15
const VERTICAL_SPEED = 10
const ROTATION_SPEED = 2
const FLOOR_Y = 0

// グローバルな入力状態（Canvas外のUIから更新される）
export const touchInputState = {
  move: { x: 0, y: 0 },
  look: { x: 0, y: 0 },
}

/**
 * Canvas内のカメラ制御コンポーネント
 */
export function TouchControls() {
  const { camera } = useThree()
  const euler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'))

  // 初期カメラ角度を取得
  useEffect(() => {
    euler.current.setFromQuaternion(camera.quaternion)
  }, [camera])

  useFrame((_, delta) => {
    const moveInput = touchInputState.move
    const lookInput = touchInputState.look

    // 右ジョイスティック: 左右で視点回転、上下で高さ変更
    if (lookInput.x !== 0) {
      euler.current.y -= lookInput.x * ROTATION_SPEED * delta
      camera.quaternion.setFromEuler(euler.current)
    }

    // 上下移動（右ジョイスティックの上下）
    if (lookInput.y !== 0) {
      camera.position.y -= lookInput.y * VERTICAL_SPEED * delta

      // 床の当たり判定
      if (camera.position.y < FLOOR_Y) {
        camera.position.y = FLOOR_Y
      }
    }

    // 移動
    if (moveInput.x !== 0 || moveInput.y !== 0) {
      // カメラの向きに基づいて移動方向を計算
      const forward = new THREE.Vector3(0, 0, -1)
      forward.applyQuaternion(camera.quaternion)
      forward.y = 0
      forward.normalize()

      const right = new THREE.Vector3(1, 0, 0)
      right.applyQuaternion(camera.quaternion)
      right.y = 0
      right.normalize()

      // ジョイスティック入力を適用（yは反転、上が前進）
      const direction = new THREE.Vector3()
      direction.add(forward.clone().multiplyScalar(-moveInput.y))
      direction.add(right.clone().multiplyScalar(moveInput.x))

      if (direction.length() > 0) {
        direction.normalize()
        camera.position.add(direction.multiplyScalar(MOVE_SPEED * delta))
      }

      // 床の当たり判定
      if (camera.position.y < FLOOR_Y) {
        camera.position.y = FLOOR_Y
      }
    }
  })

  return null
}
