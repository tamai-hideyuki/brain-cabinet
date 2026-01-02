import { useState, useEffect } from 'react'
import { Text } from '../../atoms/Text'
import { Badge } from '../../atoms/Badge'
import { Spinner } from '../../atoms/Spinner'
import {
  fetchIdentities,
  fetchIdentityTimeline,
  fetchSnapshots,
  fetchSnapshotEvents,
  type ClusterIdentity,
  type IdentityTimelineEntry,
  type SnapshotSummary,
  type ClusterEvent,
} from '../../../api/clusterEvolutionApi'
import './ClusterEvolution.css'

type ClusterEvolutionProps = {
  onNoteClick?: (noteId: string) => void
}

const formatDate = (timestamp: number): string => {
  return new Date(timestamp * 1000).toLocaleDateString('ja-JP', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const getTriggerLabel = (trigger: string): string => {
  const labels: Record<string, string> = {
    significant_change: '変化検出',
    scheduled: '定期',
    manual: '手動',
    initial: '初期',
  }
  return labels[trigger] || trigger
}

const getEventLabel = (eventType: string): string => {
  const labels: Record<string, string> = {
    split: '分裂',
    merge: '統合',
    extinct: '消滅',
    emerge: '出現',
    continue: '継続',
  }
  return labels[eventType] || eventType
}

const getEventVariant = (eventType: string): 'default' | 'decision' | 'learning' => {
  if (eventType === 'emerge') return 'learning'
  if (eventType === 'extinct') return 'decision'
  if (eventType === 'split' || eventType === 'merge') return 'default'
  return 'default'
}

export const ClusterEvolution = ({ onNoteClick: _onNoteClick }: ClusterEvolutionProps) => {
  // Note: onNoteClick will be used in future when clicking on sample notes in timeline
  const [identities, setIdentities] = useState<ClusterIdentity[]>([])
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([])
  const [selectedIdentityId, setSelectedIdentityId] = useState<number | null>(null)
  const [identityTimeline, setIdentityTimeline] = useState<IdentityTimelineEntry[]>([])
  const [snapshotEvents, setSnapshotEvents] = useState<Map<number, ClusterEvent[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'identities' | 'snapshots'>('identities')

  useEffect(() => {
    const loadData = async () => {
      try {
        const [identitiesResult, snapshotsResult] = await Promise.all([
          fetchIdentities(false),
          fetchSnapshots(20),
        ])
        setIdentities(identitiesResult.identities)
        setSnapshots(snapshotsResult.snapshots)

        // 最初のアクティブなアイデンティティを選択
        const activeIdentity = identitiesResult.identities.find((i) => i.isActive)
        if (activeIdentity) {
          setSelectedIdentityId(activeIdentity.id)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'データの読み込みに失敗しました')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  useEffect(() => {
    if (selectedIdentityId === null) return

    const loadTimeline = async () => {
      setTimelineLoading(true)
      try {
        const result = await fetchIdentityTimeline(selectedIdentityId)
        setIdentityTimeline(result.timeline)
      } catch (e) {
        console.error('Failed to load timeline:', e)
      } finally {
        setTimelineLoading(false)
      }
    }
    loadTimeline()
  }, [selectedIdentityId])

  const loadSnapshotEvents = async (snapshotId: number) => {
    if (snapshotEvents.has(snapshotId)) return

    try {
      const result = await fetchSnapshotEvents(snapshotId)
      setSnapshotEvents((prev) => new Map(prev).set(snapshotId, result.events))
    } catch (e) {
      console.error('Failed to load events:', e)
    }
  }

  if (loading) {
    return (
      <div className="cluster-evolution__loading">
        <Spinner size="lg" />
        <Text variant="body">読み込み中...</Text>
      </div>
    )
  }

  if (error) {
    return (
      <div className="cluster-evolution__error">
        <Text variant="body">{error}</Text>
      </div>
    )
  }

  const selectedIdentity = identities.find((i) => i.id === selectedIdentityId)

  return (
    <div className="cluster-evolution">
      {/* タブ切り替え */}
      <div className="cluster-evolution__tabs">
        <button
          className={`cluster-evolution__tab ${tab === 'identities' ? 'cluster-evolution__tab--active' : ''}`}
          onClick={() => setTab('identities')}
        >
          思考系譜
        </button>
        <button
          className={`cluster-evolution__tab ${tab === 'snapshots' ? 'cluster-evolution__tab--active' : ''}`}
          onClick={() => setTab('snapshots')}
        >
          スナップショット履歴
        </button>
      </div>

      {tab === 'identities' ? (
        <div className="cluster-evolution__identities">
          {/* アイデンティティ一覧 */}
          <div className="cluster-evolution__identity-list">
            <Text variant="subtitle">思考系譜</Text>
            <div className="cluster-evolution__identity-items">
              {identities.map((identity) => (
                <button
                  key={identity.id}
                  className={`cluster-evolution__identity-item ${
                    identity.id === selectedIdentityId ? 'cluster-evolution__identity-item--selected' : ''
                  } ${!identity.isActive ? 'cluster-evolution__identity-item--inactive' : ''}`}
                  onClick={() => setSelectedIdentityId(identity.id)}
                >
                  <div className="cluster-evolution__identity-info">
                    <Text variant="body">
                      {identity.label || `系譜 #${identity.id}`}
                    </Text>
                    <Text variant="caption">
                      {identity.isActive ? 'アクティブ' : '消滅'}
                    </Text>
                  </div>
                  <Badge variant={identity.isActive ? 'learning' : 'default'}>
                    #{identity.id}
                  </Badge>
                </button>
              ))}
              {identities.length === 0 && (
                <div className="cluster-evolution__empty">
                  <Text variant="caption">まだ系譜がありません</Text>
                </div>
              )}
            </div>
          </div>

          {/* 選択中のアイデンティティのタイムライン */}
          <div className="cluster-evolution__timeline">
            {selectedIdentity && (
              <>
                <div className="cluster-evolution__timeline-header">
                  <Text variant="subtitle">
                    {selectedIdentity.label || `系譜 #${selectedIdentity.id}`}
                  </Text>
                  {selectedIdentity.description && (
                    <Text variant="caption">{selectedIdentity.description}</Text>
                  )}
                </div>
                {timelineLoading ? (
                  <div className="cluster-evolution__timeline-loading">
                    <Spinner size="sm" />
                  </div>
                ) : (
                  <div className="cluster-evolution__timeline-entries">
                    {identityTimeline.map((entry, index) => (
                      <div key={entry.snapshotId} className="cluster-evolution__timeline-entry">
                        <div className="cluster-evolution__timeline-line">
                          <div className="cluster-evolution__timeline-dot" />
                          {index < identityTimeline.length - 1 && (
                            <div className="cluster-evolution__timeline-connector" />
                          )}
                        </div>
                        <div className="cluster-evolution__timeline-content">
                          <Text variant="caption">{formatDate(entry.snapshotCreatedAt)}</Text>
                          <div className="cluster-evolution__timeline-stats">
                            <Text variant="body">サイズ: {entry.size}</Text>
                            {entry.cohesion !== null && (
                              <Text variant="caption">
                                凝集度: {(entry.cohesion * 100).toFixed(1)}%
                              </Text>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {identityTimeline.length === 0 && (
                      <div className="cluster-evolution__empty">
                        <Text variant="caption">タイムラインデータがありません</Text>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
            {!selectedIdentity && (
              <div className="cluster-evolution__empty">
                <Text variant="caption">左から系譜を選択してください</Text>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="cluster-evolution__snapshots">
          {/* スナップショット履歴 */}
          <div className="cluster-evolution__snapshot-list">
            {snapshots.map((snapshot) => (
              <div
                key={snapshot.id}
                className={`cluster-evolution__snapshot-item ${
                  snapshot.isCurrent ? 'cluster-evolution__snapshot-item--current' : ''
                }`}
                onClick={() => loadSnapshotEvents(snapshot.id)}
              >
                <div className="cluster-evolution__snapshot-header">
                  <div className="cluster-evolution__snapshot-title">
                    <Text variant="body">{formatDate(snapshot.createdAt)}</Text>
                    <Badge variant={snapshot.isCurrent ? 'learning' : 'default'}>
                      {getTriggerLabel(snapshot.trigger)}
                    </Badge>
                  </div>
                  <div className="cluster-evolution__snapshot-stats">
                    <Text variant="caption">
                      クラスタ: {snapshot.k} | ノート: {snapshot.totalNotes}
                    </Text>
                    {snapshot.changeScore !== null && (
                      <Text variant="caption">
                        変化度: {(snapshot.changeScore * 100).toFixed(1)}%
                      </Text>
                    )}
                  </div>
                </div>

                {/* イベント（初期スナップショットは表示しない） */}
                {snapshot.trigger !== 'initial' && snapshotEvents.has(snapshot.id) && (
                  <div className="cluster-evolution__snapshot-events">
                    {snapshotEvents.get(snapshot.id)!.map((event) => (
                      <Badge key={event.id} variant={getEventVariant(event.eventType)}>
                        {getEventLabel(event.eventType)}
                      </Badge>
                    ))}
                    {snapshotEvents.get(snapshot.id)!.length === 0 && (
                      <Text variant="caption">イベントなし</Text>
                    )}
                  </div>
                )}
                {snapshot.trigger === 'initial' && (
                  <div className="cluster-evolution__snapshot-events">
                    <Text variant="caption">初期構築（{snapshot.k}クラスタ）</Text>
                  </div>
                )}

                {/* ノート増減 */}
                {(snapshot.notesAdded > 0 || snapshot.notesRemoved > 0) && (
                  <div className="cluster-evolution__snapshot-changes">
                    {snapshot.notesAdded > 0 && (
                      <Text variant="caption">+{snapshot.notesAdded}</Text>
                    )}
                    {snapshot.notesRemoved > 0 && (
                      <Text variant="caption">-{snapshot.notesRemoved}</Text>
                    )}
                  </div>
                )}
              </div>
            ))}
            {snapshots.length === 0 && (
              <div className="cluster-evolution__empty">
                <Text variant="caption">まだスナップショットがありません</Text>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
