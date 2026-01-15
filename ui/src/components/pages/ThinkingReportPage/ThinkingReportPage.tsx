/**
 * Thinking Report Page
 * 思考成長レポートページ
 */

import { useState } from 'react'
import { MainLayout } from '../../templates/MainLayout'
import { Text } from '../../atoms/Text'
import { useThinkingReport } from '../../../hooks/useThinkingReport'
import type { ThinkingPhase, Perspective } from '../../../api/thinkingReportApi'
import './ThinkingReportPage.css'

// フェーズの日本語ラベル
const PHASE_LABELS: Record<ThinkingPhase, string> = {
  exploration: '探索',
  structuring: '構造化',
  implementation: '実装',
  reflection: '振り返り',
}

// 視点の色
const PERSPECTIVE_COLORS: Record<Perspective, string> = {
  engineer: '#3b82f6',
  po: '#10b981',
  user: '#f59e0b',
  cto: '#8b5cf6',
  team: '#ec4899',
  stakeholder: '#6366f1',
}

export const ThinkingReportPage = () => {
  const {
    report,
    distribution,
    loading,
    error,
    labelGenerating,
    labelMessage,
    generateLabels,
    toggleClusterExpand,
    isClusterExpanded,
    isClusterLoading,
    getClusterNotes,
  } = useThinkingReport()

  const [activeTab, setActiveTab] = useState<'forest' | 'trees'>('forest')

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="thinking-report">
          <div className="thinking-report__loading">
            <Text>読み込み中...</Text>
          </div>
        </div>
      </MainLayout>
    )
  }

  if (error) {
    return (
      <MainLayout>
        <div className="thinking-report">
          <div className="thinking-report__error">
            <Text variant="body">{error}</Text>
          </div>
        </div>
      </MainLayout>
    )
  }

  if (!report) {
    return (
      <MainLayout>
        <div className="thinking-report">
          <div className="thinking-report__empty">
            <Text>レポートデータがありません</Text>
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="thinking-report">
        <header className="thinking-report__header">
          <div className="thinking-report__header-top">
            <Text variant="title">思考成長レポート</Text>
            <div className="thinking-report__label-buttons">
              <button
                className="thinking-report__label-btn"
                onClick={() => generateLabels(false)}
                disabled={labelGenerating}
              >
                {labelGenerating ? '生成中...' : 'ラベル生成'}
              </button>
              <button
                className="thinking-report__label-btn thinking-report__label-btn--secondary"
                onClick={() => generateLabels(true)}
                disabled={labelGenerating}
                title="既存ラベルも含めて全て再生成"
              >
                全再生成
              </button>
            </div>
          </div>
          <p className="thinking-report__period">
            {formatDate(report.period.start)} - {formatDate(report.period.end)}
          </p>
          {labelMessage && (
            <p className="thinking-report__label-message">{labelMessage}</p>
          )}
        </header>

        {/* タブ切り替え */}
        <div className="thinking-report__tabs">
          <button
            className={`thinking-report__tab ${activeTab === 'forest' ? 'thinking-report__tab--active' : ''}`}
            onClick={() => setActiveTab('forest')}
          >
            森（全体傾向）
          </button>
          <button
            className={`thinking-report__tab ${activeTab === 'trees' ? 'thinking-report__tab--active' : ''}`}
            onClick={() => setActiveTab('trees')}
          >
            木（詳細）
          </button>
        </div>

        {/* 森: 全体傾向 */}
        {activeTab === 'forest' && (
          <div className="thinking-report__forest">
            {/* 思考フェーズ */}
            <section className="thinking-report__section">
              <Text variant="subtitle">思考フェーズ</Text>
              <div className="thinking-report__phase">
                <span className="thinking-report__phase-badge">
                  {PHASE_LABELS[report.forest.phase.current]}
                </span>
                {report.forest.phase.transition && (
                  <span className="thinking-report__phase-transition">
                    {report.forest.phase.transition.from && PHASE_LABELS[report.forest.phase.transition.from]}
                    {' → '}
                    {PHASE_LABELS[report.forest.phase.transition.to]}
                  </span>
                )}
              </div>
            </section>

            {/* 偏りアラート */}
            {report.forest.bias && (
              <section className="thinking-report__section thinking-report__section--alert">
                <Text variant="subtitle">偏りアラート</Text>
                <div className="thinking-report__alert">
                  <span className="thinking-report__alert-icon">!</span>
                  <Text>{report.forest.bias.message}</Text>
                </div>
              </section>
            )}

            {/* 視点分布 */}
            {distribution && distribution.hasData && (
              <section className="thinking-report__section">
                <Text variant="subtitle">視点分布</Text>
                <div className="thinking-report__distribution">
                  {distribution.distribution.map((item) => (
                    <div key={item.perspective} className="thinking-report__distribution-item">
                      <div className="thinking-report__distribution-label">
                        <span
                          className="thinking-report__distribution-dot"
                          style={{ backgroundColor: PERSPECTIVE_COLORS[item.perspective] }}
                        />
                        <Text variant="caption">{item.perspectiveLabel}</Text>
                      </div>
                      <div className="thinking-report__distribution-bar-container">
                        <div
                          className="thinking-report__distribution-bar"
                          style={{
                            width: `${item.percentage}%`,
                            backgroundColor: PERSPECTIVE_COLORS[item.perspective],
                          }}
                        />
                      </div>
                      <span className="thinking-report__distribution-value">
                        {item.percentage}%
                      </span>
                    </div>
                  ))}
                </div>
                <div className="thinking-report__distribution-meta">
                  <Text variant="caption">
                    タグ付け率: {distribution.tagRate}% ({distribution.withPerspective}/{distribution.total})
                  </Text>
                </div>
              </section>
            )}

            {/* 空白領域 */}
            {report.forest.blindSpots.length > 0 && (
              <section className="thinking-report__section">
                <Text variant="subtitle">空白領域</Text>
                <div className="thinking-report__blind-spots">
                  {report.forest.blindSpots.map((spot, index) => (
                    <div key={index} className="thinking-report__blind-spot">
                      <Text variant="body">{spot.identityLabel}</Text>
                      <Text variant="caption">{spot.daysSinceLastUpdate}日間未更新</Text>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* メトリクス */}
            <section className="thinking-report__section">
              <Text variant="subtitle">今週のメトリクス</Text>
              <div className="thinking-report__metrics">
                <div className="thinking-report__metric">
                  <Text variant="caption">総ノート数</Text>
                  <Text variant="title">{report.forest.metrics.totalNotes}</Text>
                </div>
                <div className="thinking-report__metric">
                  <Text variant="caption">追加ノート</Text>
                  <Text variant="title">+{report.forest.metrics.notesAdded}</Text>
                </div>
                <div className="thinking-report__metric">
                  <Text variant="caption">平均凝集度</Text>
                  <Text variant="title">
                    {report.forest.metrics.avgCohesion?.toFixed(2) ?? '-'}
                  </Text>
                </div>
              </div>
            </section>

            {/* 週次チャレンジ */}
            {report.weeklyChallenge && (
              <section className="thinking-report__section thinking-report__section--challenge">
                <Text variant="subtitle">今週のチャレンジ</Text>
                <div className="thinking-report__challenge">
                  <div className="thinking-report__challenge-header">
                    <span
                      className="thinking-report__challenge-badge"
                      style={{ backgroundColor: PERSPECTIVE_COLORS[report.weeklyChallenge.perspective] }}
                    >
                      {report.weeklyChallenge.perspectiveLabel}視点
                    </span>
                  </div>
                  <p className="thinking-report__challenge-question">
                    {report.weeklyChallenge.question}
                  </p>
                  <p className="thinking-report__challenge-reason">
                    {report.weeklyChallenge.reason}
                  </p>
                </div>
              </section>
            )}

            {/* 他者視点の問い */}
            {report.perspectiveQuestions.length > 0 && (
              <section className="thinking-report__section">
                <Text variant="subtitle">他者視点からの問い</Text>
                <div className="thinking-report__questions">
                  {report.perspectiveQuestions.map((q, index) => (
                    <div key={index} className="thinking-report__question">
                      <span
                        className="thinking-report__question-badge"
                        style={{ backgroundColor: PERSPECTIVE_COLORS[q.perspective] }}
                      >
                        {q.perspectiveLabel}
                      </span>
                      <Text variant="body">{q.question}</Text>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* 木: 詳細 */}
        {activeTab === 'trees' && (
          <div className="thinking-report__trees">
            {/* 成長クラスタ */}
            {report.trees.topGrowth.length > 0 && (
              <section className="thinking-report__section">
                <Text variant="subtitle">成長したクラスタ</Text>
                <div className="thinking-report__growth-list">
                  {report.trees.topGrowth.map((growth) => {
                    const clusterKey = `growth-${growth.identityId}`
                    const isExpanded = isClusterExpanded(clusterKey)
                    const isLoading = isClusterLoading(clusterKey)
                    const notes = getClusterNotes(clusterKey)

                    return (
                      <div key={growth.identityId} className="thinking-report__growth-item">
                        <button
                          className="thinking-report__expand-btn"
                          onClick={() => toggleClusterExpand(clusterKey, growth.identityId)}
                          aria-expanded={isExpanded}
                        >
                          <span className={`thinking-report__expand-icon ${isExpanded ? 'thinking-report__expand-icon--open' : ''}`}>
                            ▶
                          </span>
                          <div className="thinking-report__growth-header">
                            <Text variant="body">
                              {growth.label ?? `クラスタ ${growth.identityId}`}
                            </Text>
                            <span
                              className={`thinking-report__growth-delta ${growth.notesDelta >= 0 ? 'thinking-report__growth-delta--positive' : 'thinking-report__growth-delta--negative'}`}
                            >
                              {growth.notesDelta >= 0 ? '+' : ''}{growth.notesDelta}
                            </span>
                          </div>
                        </button>
                        <div className="thinking-report__growth-details">
                          <Text variant="caption">
                            現在 {growth.currentSize} ノート
                            {growth.currentCohesion !== null && ` / 凝集度 ${growth.currentCohesion.toFixed(2)}`}
                          </Text>
                        </div>
                        {isExpanded && (
                          <div className="thinking-report__cluster-notes">
                            {isLoading ? (
                              <Text variant="caption">読み込み中...</Text>
                            ) : notes.length > 0 ? (
                              <ul className="thinking-report__notes-list">
                                {notes.map((note) => (
                                  <li key={note.id} className="thinking-report__notes-item">
                                    <a href={`/ui/notes/${note.id}`} className="thinking-report__note-link">
                                      {note.title}
                                    </a>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <Text variant="caption">ノートがありません</Text>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* イベント */}
            {report.trees.events.length > 0 && (
              <section className="thinking-report__section">
                <Text variant="subtitle">クラスタイベント</Text>
                <div className="thinking-report__events">
                  {report.trees.events.map((event, index) => (
                    <div key={index} className="thinking-report__event">
                      <span className={`thinking-report__event-badge thinking-report__event-badge--${event.type}`}>
                        {event.type === 'split' && '分裂'}
                        {event.type === 'merge' && '統合'}
                        {event.type === 'emerge' && '誕生'}
                        {event.type === 'extinct' && '消滅'}
                        {event.type === 'continue' && '継続'}
                      </span>
                      <Text variant="caption">{event.count}件</Text>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 新しい思考 */}
            {report.trees.newThoughts.length > 0 && (
              <section className="thinking-report__section">
                <Text variant="subtitle">新しく生まれた思考</Text>
                <div className="thinking-report__new-thoughts">
                  {report.trees.newThoughts.map((thought) => {
                    const clusterKey = `new-${thought.identityId}`
                    const isExpanded = isClusterExpanded(clusterKey)
                    const isLoading = isClusterLoading(clusterKey)
                    const notes = getClusterNotes(clusterKey)

                    return (
                      <div key={thought.identityId} className="thinking-report__thought thinking-report__thought--expandable">
                        <button
                          className="thinking-report__expand-btn"
                          onClick={() => toggleClusterExpand(clusterKey, thought.identityId)}
                          aria-expanded={isExpanded}
                        >
                          <span className={`thinking-report__expand-icon ${isExpanded ? 'thinking-report__expand-icon--open' : ''}`}>
                            ▶
                          </span>
                          <span className="thinking-report__thought-icon">+</span>
                          <div className="thinking-report__thought-content">
                            <Text variant="body">
                              {thought.label ?? `クラスタ ${thought.identityId}`}
                            </Text>
                            {thought.sampleTitle && (
                              <span className="thinking-report__thought-sample">
                                例: {thought.sampleTitle}
                              </span>
                            )}
                          </div>
                          <Text variant="caption">({thought.size} ノート)</Text>
                        </button>
                        {isExpanded && (
                          <div className="thinking-report__cluster-notes">
                            {isLoading ? (
                              <Text variant="caption">読み込み中...</Text>
                            ) : notes.length > 0 ? (
                              <ul className="thinking-report__notes-list">
                                {notes.map((note) => (
                                  <li key={note.id} className="thinking-report__notes-item">
                                    <a href={`/ui/notes/${note.id}`} className="thinking-report__note-link">
                                      {note.title}
                                    </a>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <Text variant="caption">ノートがありません</Text>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* 消滅した思考 */}
            {report.trees.extinctThoughts.length > 0 && (
              <section className="thinking-report__section">
                <Text variant="subtitle">収束した思考</Text>
                <div className="thinking-report__extinct-thoughts">
                  {report.trees.extinctThoughts.map((thought, index) => (
                    <div key={index} className="thinking-report__thought thinking-report__thought--extinct">
                      <span className="thinking-report__thought-icon">-</span>
                      <div className="thinking-report__thought-content">
                        <Text variant="body">
                          {thought.label ?? '（ラベルなし）'}
                        </Text>
                        {thought.sampleTitle && (
                          <span className="thinking-report__thought-sample">
                            例: {thought.sampleTitle}
                          </span>
                        )}
                      </div>
                      {thought.absorbedBy && (
                        <Text variant="caption">→ {thought.absorbedBy} に吸収</Text>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* 用語解説 */}
        <section className="thinking-report__glossary">
          <Text variant="subtitle">用語解説</Text>
          <dl className="thinking-report__glossary-list">
            <div className="thinking-report__glossary-item">
              <dt>クラスタ</dt>
              <dd>類似したノートの集まり。AIが内容の関連性を分析して自動でグループ化</dd>
            </div>
            <div className="thinking-report__glossary-item">
              <dt>思考フェーズ</dt>
              <dd>
                <strong>探索</strong>: 新規ノートが多い状態 /
                <strong>構造化</strong>: ノート間の関連付けが進行中 /
                <strong>実装</strong>: 特定テーマに集中 /
                <strong>振り返り</strong>: 既存ノートの編集が中心
              </dd>
            </div>
            <div className="thinking-report__glossary-item">
              <dt>凝集度</dt>
              <dd>クラスタ内のノートがどれだけ似ているかの指標。高いほど一貫したテーマ</dd>
            </div>
            <div className="thinking-report__glossary-item">
              <dt>新しく生まれた思考</dt>
              <dd>今週新たに形成されたクラスタ。新しいテーマへの関心を示す</dd>
            </div>
            <div className="thinking-report__glossary-item">
              <dt>収束した思考</dt>
              <dd>消滅したクラスタ。ノートが削除されたか、他のクラスタに統合された</dd>
            </div>
            <div className="thinking-report__glossary-item">
              <dt>空白領域</dt>
              <dd>2週間以上更新がないクラスタ。忘れているテーマの可能性</dd>
            </div>
            <div className="thinking-report__glossary-item">
              <dt>偏りアラート</dt>
              <dd>特定クラスタにノートの50%以上が集中している状態への警告</dd>
            </div>
          </dl>
        </section>
      </div>
    </MainLayout>
  )
}
