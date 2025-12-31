import { Text } from '../../atoms/Text'
import { Badge } from '../../atoms/Badge'
import type { ClusterPersonaSummary } from '../../../types/ptm'
import './ClusterInsightSection.css'

type ClusterInsightSectionProps = {
  clusters: ClusterPersonaSummary[]
}

const getRoleLabel = (role: ClusterPersonaSummary['role']): string => {
  const labels: Record<ClusterPersonaSummary['role'], string> = {
    driver: 'ドライバー',
    stabilizer: '安定化',
    bridge: 'ブリッジ',
    isolated: '孤立',
  }
  return labels[role]
}

const getRoleDescription = (role: ClusterPersonaSummary['role']): string => {
  const descriptions: Record<ClusterPersonaSummary['role'], string> = {
    driver: '思考を牽引する中心的なクラスタ',
    stabilizer: '安定した基盤となるクラスタ',
    bridge: '異なる思考領域をつなぐクラスタ',
    isolated: '他との関連が薄いクラスタ',
  }
  return descriptions[role]
}

const getRoleIcon = (role: ClusterPersonaSummary['role']): string => {
  const icons: Record<ClusterPersonaSummary['role'], string> = {
    driver: '🚀',
    stabilizer: '🏛️',
    bridge: '🌉',
    isolated: '🏝️',
  }
  return icons[role]
}

const getTrendIcon = (trend: 'rising' | 'falling' | 'flat'): string => {
  const icons: Record<string, string> = {
    rising: '↗️',
    falling: '↘️',
    flat: '→',
  }
  return icons[trend]
}

const getTrendLabel = (trend: 'rising' | 'falling' | 'flat'): string => {
  const labels: Record<string, string> = {
    rising: '上昇中',
    falling: '下降中',
    flat: '横ばい',
  }
  return labels[trend]
}

const getCohesionLevel = (cohesion: number): { label: string; color: string } => {
  if (cohesion >= 0.7) return { label: '高', color: 'var(--color-success)' }
  if (cohesion >= 0.4) return { label: '中', color: 'var(--color-warning)' }
  return { label: '低', color: 'var(--color-error)' }
}

export const ClusterInsightSection = ({ clusters }: ClusterInsightSectionProps) => {
  if (!clusters || clusters.length === 0) {
    return null
  }

  // 役割別にソート（driver > bridge > stabilizer > isolated）
  const rolePriority: Record<ClusterPersonaSummary['role'], number> = {
    driver: 0,
    bridge: 1,
    stabilizer: 2,
    isolated: 3,
  }
  const sortedClusters = [...clusters].sort(
    (a, b) => rolePriority[a.role] - rolePriority[b.role]
  )

  return (
    <div className="cluster-insight">
      <div className="cluster-insight__header">
        <Text variant="subtitle">クラスタインサイト</Text>
        <Text variant="caption">{clusters.length}クラスタ</Text>
      </div>

      <div className="cluster-insight__list">
        {sortedClusters.map((cluster) => {
          const cohesionInfo = getCohesionLevel(cluster.cohesion)
          return (
            <div key={cluster.clusterId} className="cluster-insight__card">
              <div className="cluster-insight__card-header">
                <div className="cluster-insight__role">
                  <span className="cluster-insight__role-icon">
                    {getRoleIcon(cluster.role)}
                  </span>
                  <Badge
                    variant={
                      cluster.role === 'driver'
                        ? 'decision'
                        : cluster.role === 'bridge'
                          ? 'learning'
                          : 'default'
                    }
                  >
                    {getRoleLabel(cluster.role)}
                  </Badge>
                </div>
                <div className="cluster-insight__trend">
                  <span className="cluster-insight__trend-icon">
                    {getTrendIcon(cluster.drift.trend)}
                  </span>
                  <Text variant="caption">{getTrendLabel(cluster.drift.trend)}</Text>
                </div>
              </div>

              <div className="cluster-insight__keywords">
                {cluster.keywords.slice(0, 4).map((keyword, i) => (
                  <span key={i} className="cluster-insight__keyword">
                    {keyword}
                  </span>
                ))}
              </div>

              <div className="cluster-insight__metrics">
                <div className="cluster-insight__metric">
                  <Text variant="caption">ノート数</Text>
                  <Text variant="body">{cluster.noteCount}</Text>
                </div>
                <div className="cluster-insight__metric">
                  <Text variant="caption">凝集度</Text>
                  <div className="cluster-insight__cohesion">
                    <div
                      className="cluster-insight__cohesion-bar"
                      style={{
                        width: `${cluster.cohesion * 100}%`,
                        backgroundColor: cohesionInfo.color,
                      }}
                    />
                    <Text variant="caption">{cohesionInfo.label}</Text>
                  </div>
                </div>
                <div className="cluster-insight__metric">
                  <Text variant="caption">影響力</Text>
                  <Text variant="body">
                    {(cluster.influence.hubness * 100).toFixed(0)}%
                  </Text>
                </div>
              </div>

              <div className="cluster-insight__description">
                <Text variant="caption">{getRoleDescription(cluster.role)}</Text>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
