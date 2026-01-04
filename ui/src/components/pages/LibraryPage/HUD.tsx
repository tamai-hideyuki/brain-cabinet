/**
 * HUD - ヘッドアップディスプレイ（操作ガイド）
 */

import './HUD.css'

type Props = {
  noteCount: number
  clusterCount: number
}

export function HUD({ noteCount, clusterCount }: Props) {
  return (
    <div className="library-hud">
      <div className="library-hud-stats">
        <span>{clusterCount} clusters</span>
        <span className="library-hud-divider">|</span>
        <span>{noteCount} notes</span>
      </div>
      <div className="library-hud-controls">
        <div className="library-hud-key">
          <kbd>Click</kbd>
          <span>ロック</span>
        </div>
        <div className="library-hud-key">
          <kbd>WASD</kbd>
          <span>移動</span>
        </div>
        <div className="library-hud-key">
          <kbd>Q / Space</kbd>
          <span>上昇</span>
        </div>
        <div className="library-hud-key">
          <kbd>E / C</kbd>
          <span>下降</span>
        </div>
        <div className="library-hud-key">
          <kbd>Shift</kbd>
          <span>加速</span>
        </div>
        <div className="library-hud-key">
          <kbd>ESC</kbd>
          <span>解除</span>
        </div>
      </div>
    </div>
  )
}
