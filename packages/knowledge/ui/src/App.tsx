import { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// 開発時と本番時でCabinet UIのURLを切り替え
const cabinetUrl = import.meta.env.DEV
  ? 'http://localhost:5173/ui/'
  : '/ui/'

// API base URL: 開発時は /api、本番時は /knowledge/api
const apiBase = import.meta.env.DEV ? '/api' : '/knowledge/api'

type KnowledgeNote = {
  id: string
  title: string
  content: string
  source: string | null
  sourceType: string | null
  category: string | null
  tags: string | null
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

type SearchResult = {
  id: string
  title: string
  content: string
  source: string | null
  category: string | null
  score: number
  snippet: string
  matchType: 'keyword' | 'semantic' | 'hybrid'
  updatedAt: number
}

type NoteFormData = {
  title: string
  content: string
  source: string
  sourceType: string
  category: string
  tags: string
}

const SOURCE_TYPES = [
  { value: '', label: '選択してください' },
  { value: 'book', label: '書籍' },
  { value: 'work', label: '業務' },
  { value: 'article', label: '記事' },
  { value: 'course', label: '講座・研修' },
  { value: 'other', label: 'その他' },
]

const emptyForm: NoteFormData = {
  title: '',
  content: '',
  source: '',
  sourceType: '',
  category: '',
  tags: '',
}

function App() {
  const [notes, setNotes] = useState<KnowledgeNote[]>([])
  const [deletedNotes, setDeletedNotes] = useState<KnowledgeNote[]>([])
  const [loading, setLoading] = useState(true)
  const [showTrash, setShowTrash] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingNote, setEditingNote] = useState<KnowledgeNote | null>(null)
  const [viewingNote, setViewingNote] = useState<KnowledgeNote | null>(null)
  const [form, setForm] = useState<NoteFormData>(emptyForm)
  const [saving, setSaving] = useState(false)

  // 検索関連
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showSearchResults, setShowSearchResults] = useState(false)

  // 編集画面のプレビュータブ（スマホ用）
  const [editTab, setEditTab] = useState<'edit' | 'preview'>('edit')

  // スクロール連動用
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const isScrolling = useRef<'edit' | 'preview' | null>(null)

  const handleEditorScroll = useCallback(() => {
    if (isScrolling.current === 'preview') return
    isScrolling.current = 'edit'

    const textarea = textareaRef.current
    const preview = previewRef.current
    if (!textarea || !preview) return

    const scrollRatio = textarea.scrollTop / (textarea.scrollHeight - textarea.clientHeight || 1)
    preview.scrollTop = scrollRatio * (preview.scrollHeight - preview.clientHeight)

    requestAnimationFrame(() => {
      isScrolling.current = null
    })
  }, [])

  const handlePreviewScroll = useCallback(() => {
    if (isScrolling.current === 'edit') return
    isScrolling.current = 'preview'

    const textarea = textareaRef.current
    const preview = previewRef.current
    if (!textarea || !preview) return

    const scrollRatio = preview.scrollTop / (preview.scrollHeight - preview.clientHeight || 1)
    textarea.scrollTop = scrollRatio * (textarea.scrollHeight - textarea.clientHeight)

    requestAnimationFrame(() => {
      isScrolling.current = null
    })
  }, [])

  const fetchNotes = () => {
    fetch(`${apiBase}/notes`)
      .then((res) => res.json())
      .then((data) => {
        setNotes(data.notes || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  const fetchDeletedNotes = () => {
    fetch(`${apiBase}/notes/deleted`)
      .then((res) => res.json())
      .then((data) => {
        setDeletedNotes(data.notes || [])
      })
      .catch(() => setDeletedNotes([]))
  }

  // 検索実行
  const handleSearch = async (query: string, pushHistory = true) => {
    if (!query.trim()) {
      setShowSearchResults(false)
      setSearchResults([])
      return
    }

    setIsSearching(true)
    setShowSearchResults(true)
    setShowTrash(false)

    if (pushHistory) {
      window.history.pushState({ view: 'search', query }, '', `?q=${encodeURIComponent(query)}`)
    }

    try {
      const res = await fetch(`${apiBase}/notes/search?q=${encodeURIComponent(query)}&mode=hybrid`)
      const data = await res.json()
      setSearchResults(data.results || [])
    } catch (err) {
      console.error('Search failed:', err)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  // 検索クリア
  const clearSearch = (pushHistory = true) => {
    setSearchQuery('')
    setSearchResults([])
    setShowSearchResults(false)
    if (pushHistory) {
      window.history.pushState({}, '', window.location.pathname)
    }
  }

  useEffect(() => {
    fetchNotes()
    fetchDeletedNotes()
  }, [])

  const openCreateModal = () => {
    setEditingNote(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  const openDetailView = (note: KnowledgeNote, pushHistory = true) => {
    setViewingNote(note)
    if (pushHistory) {
      window.history.pushState({ noteId: note.id }, '', `?note=${note.id}`)
    }
  }

  const closeDetailView = (pushHistory = true) => {
    setViewingNote(null)
    if (pushHistory) {
      window.history.pushState({}, '', window.location.pathname)
    }
  }

  // ブラウザの戻る/進むボタン対応
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state || {}

      // ノート詳細
      if (state.noteId) {
        const note = notes.find((n) => n.id === state.noteId)
        if (note) {
          setViewingNote(note)
        } else {
          fetch(`${apiBase}/notes/${state.noteId}`)
            .then((res) => res.json())
            .then((fetchedNote) => {
              if (fetchedNote?.id) {
                setViewingNote(fetchedNote)
              }
            })
            .catch(() => setViewingNote(null))
        }
      } else {
        setViewingNote(null)
      }

      // ゴミ箱
      setShowTrash(state.view === 'trash')

      // 検索結果
      if (state.view === 'search' && state.query) {
        setSearchQuery(state.query)
        handleSearch(state.query, false)
      } else if (!state.view) {
        clearSearch(false)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [notes])

  // 初期表示時にURLパラメータから状態を復元
  useEffect(() => {
    if (!loading) {
      const params = new URLSearchParams(window.location.search)

      // ノート詳細
      const noteId = params.get('note')
      if (noteId && !viewingNote) {
        const note = notes.find((n) => n.id === noteId)
        if (note) {
          setViewingNote(note)
        }
      }

      // ゴミ箱
      if (params.get('view') === 'trash') {
        setShowTrash(true)
      }

      // 検索
      const query = params.get('q')
      if (query) {
        setSearchQuery(query)
        handleSearch(query, false)
      }
    }
  }, [loading])

  const openEditModal = (note: KnowledgeNote) => {
    setEditingNote(note)
    setForm({
      title: note.title,
      content: note.content,
      source: note.source || '',
      sourceType: note.sourceType || '',
      category: note.category || '',
      tags: note.tags ? JSON.parse(note.tags).join(', ') : '',
    })
    setViewingNote(null)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingNote(null)
    setForm(emptyForm)
    setEditTab('edit')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.content.trim()) return

    setSaving(true)

    const payload = {
      title: form.title.trim(),
      content: form.content.trim(),
      source: form.source.trim() || null,
      sourceType: form.sourceType || null,
      category: form.category.trim() || null,
      tags: form.tags
        ? form.tags.split(',').map((t) => t.trim()).filter(Boolean)
        : null,
    }

    try {
      if (editingNote) {
        await fetch(`${apiBase}/notes/${editingNote.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        await fetch(`${apiBase}/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }
      closeModal()
      fetchNotes()
    } catch (err) {
      console.error('Failed to save note:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (noteId: string) => {
    if (!confirm('この知識ノートをゴミ箱に移動しますか？')) return

    try {
      await fetch(`${apiBase}/notes/${noteId}`, { method: 'DELETE' })
      fetchNotes()
      fetchDeletedNotes()
    } catch (err) {
      console.error('Failed to delete note:', err)
    }
  }

  const handleRestore = async (noteId: string) => {
    try {
      await fetch(`${apiBase}/notes/${noteId}/restore`, { method: 'POST' })
      fetchNotes()
      fetchDeletedNotes()
    } catch (err) {
      console.error('Failed to restore note:', err)
    }
  }

  const handlePermanentDelete = async (noteId: string) => {
    if (!confirm('このノートを完全に削除しますか？この操作は取り消せません。')) return

    try {
      await fetch(`${apiBase}/notes/${noteId}/permanent`, { method: 'DELETE' })
      fetchDeletedNotes()
    } catch (err) {
      console.error('Failed to permanently delete note:', err)
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  // UUID形式かどうかを判定
  const isNoteId = (href: string) => /^[a-f0-9-]{36}$/.test(href)

  const handleLinkClick = (noteId: string) => {
    const linkedNote = notes.find((n) => n.id === noteId)
    if (linkedNote) {
      openDetailView(linkedNote)
    } else {
      // ノートが一覧にない場合はAPIから取得
      fetch(`${apiBase}/notes/${noteId}`)
        .then((res) => res.json())
        .then((note) => {
          if (note && note.id) {
            openDetailView(note)
          } else {
            alert('リンク先のノートが見つかりません')
          }
        })
        .catch(() => alert('リンク先のノートが見つかりません'))
    }
  }

  const renderContent = (content: string) => {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            if (href && isNoteId(href)) {
              return (
                <button
                  className="note-link"
                  onClick={() => handleLinkClick(href)}
                  title={`ノートを開く: ${href}`}
                >
                  {children || '関連ノート'}
                </button>
              )
            }
            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header__app-switcher">
          <a href={cabinetUrl} className="header__app-link" title="Brain Cabinet（判断）">
            <span className="header__app-link-full">Cabinet</span>
            <span className="header__app-link-short">BC</span>
          </a>
          <span className="header__app-separator">/</span>
          <a href="/knowledge/" className="header__app-link header__app-link--active" title="Brain Knowledge（知識）">
            <span className="header__app-link-full">Knowledge</span>
            <span className="header__app-link-short">BK</span>
          </a>
        </div>
        <div className="header__search">
          <input
            type="text"
            className="header__search-input"
            placeholder="知識を検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch(searchQuery)
              } else if (e.key === 'Escape') {
                clearSearch()
              }
            }}
          />
          {searchQuery && (
            <button className="header__search-clear" onClick={() => clearSearch()} title="クリア">
              ×
            </button>
          )}
        </div>
        <nav className="header__nav">
          <button
            className={`header__trash-btn ${showTrash ? 'header__trash-btn--active' : ''}`}
            onClick={() => {
              if (!showTrash) {
                // ゴミ箱を開く
                setShowTrash(true)
                setShowSearchResults(false)
                setSearchQuery('')
                window.history.pushState({ view: 'trash' }, '', '?view=trash')
              } else {
                // ゴミ箱を閉じる
                setShowTrash(false)
                window.history.pushState({}, '', window.location.pathname)
              }
            }}
            title="ゴミ箱"
          >
            🗑 {deletedNotes.length > 0 && <span className="header__trash-count">{deletedNotes.length}</span>}
          </button>
          {!showTrash && !showSearchResults && (
            <button className="btn btn--primary btn--small" onClick={openCreateModal}>
              + 新規作成
            </button>
          )}
        </nav>
      </header>

      <main className="main">
        {showSearchResults ? (
          <>
            <div className="search-header">
              <h1>検索結果</h1>
              <button className="btn btn--secondary btn--small" onClick={() => clearSearch()}>
                検索をクリア
              </button>
            </div>
            <p className="subtitle">
              「{searchQuery}」の検索結果: {searchResults.length}件
            </p>

            {isSearching ? (
              <p>検索中...</p>
            ) : searchResults.length === 0 ? (
              <div className="empty-state">
                <p>検索結果が見つかりませんでした</p>
              </div>
            ) : (
              <div className="notes-grid">
                {searchResults.map((result) => (
                  <div
                    key={result.id}
                    className="note-card note-card--search"
                    onClick={() => {
                      const note = notes.find((n) => n.id === result.id)
                      if (note) {
                        openDetailView(note)
                      } else {
                        // ノートが一覧にない場合はAPIから取得
                        fetch(`${apiBase}/notes/${result.id}`)
                          .then((res) => res.json())
                          .then((fetchedNote) => {
                            if (fetchedNote?.id) {
                              openDetailView(fetchedNote)
                            }
                          })
                      }
                    }}
                  >
                    <div className="note-card__header">
                      <h3>{result.title}</h3>
                      <span className="note-card__score" title={`スコア: ${result.score.toFixed(2)}`}>
                        {Math.round(result.score * 100)}%
                      </span>
                    </div>
                    {result.source && (
                      <span className="note-card__source">{result.source}</span>
                    )}
                    <p
                      className="note-card__excerpt"
                      dangerouslySetInnerHTML={{ __html: result.snippet }}
                    />
                    <span className="note-card__date">{formatDate(result.updatedAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : showTrash ? (
          <>
            <h1>ゴミ箱</h1>
            <p className="subtitle">削除したノートは1時間後に自動で完全削除されます</p>

            {deletedNotes.length === 0 ? (
              <div className="empty-state">
                <p>ゴミ箱は空です</p>
              </div>
            ) : (
              <div className="notes-grid">
                {deletedNotes.map((note) => (
                  <div key={note.id} className="note-card note-card--deleted">
                    <div className="note-card__header">
                      <h3>{note.title}</h3>
                    </div>
                    <p className="note-card__excerpt">
                      {note.content.length > 100 ? note.content.slice(0, 100) + '...' : note.content}
                    </p>
                    <span className="note-card__date">
                      削除: {note.deletedAt ? formatDate(note.deletedAt) : ''}
                    </span>
                    <div className="note-card__trash-actions">
                      <button
                        className="btn btn--small btn--secondary"
                        onClick={() => handleRestore(note.id)}
                      >
                        復元
                      </button>
                      <button
                        className="btn btn--small btn--danger"
                        onClick={() => handlePermanentDelete(note.id)}
                      >
                        完全削除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <h1>Brain Knowledge</h1>
            <p className="subtitle">学んだ知識を記録</p>

            {loading ? (
              <p>Loading...</p>
            ) : notes.length === 0 ? (
              <div className="empty-state">
                <p>まだ知識ノートがありません</p>
                <button className="btn btn--primary" onClick={openCreateModal}>
                  最初のノートを作成
                </button>
              </div>
            ) : (
              <div className="notes-grid">
                {notes.map((note) => (
                  <div key={note.id} className="note-card" onClick={() => openDetailView(note)}>
                    <div className="note-card__header">
                      <h3>{note.title}</h3>
                      <button
                        className="note-card__delete"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(note.id)
                        }}
                        title="削除"
                      >
                        ×
                      </button>
                    </div>
                    {note.source && (
                      <span className="note-card__source">
                        {note.sourceType && `[${SOURCE_TYPES.find(s => s.value === note.sourceType)?.label || note.sourceType}] `}
                        {note.source}
                      </span>
                    )}
                    <p className="note-card__excerpt">
                      {note.content.length > 100 ? note.content.slice(0, 100) + '...' : note.content}
                    </p>
                    <span className="note-card__date">{formatDate(note.updatedAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {viewingNote && (
        <div className="detail-overlay" onClick={() => closeDetailView()}>
          <div className="detail-view" onClick={(e) => e.stopPropagation()}>
            <div className="detail-view__header">
              <button className="detail-view__back" onClick={() => closeDetailView()}>
                ← 戻る
              </button>
              <div className="detail-view__actions">
                <button
                  className="btn btn--primary btn--small"
                  onClick={() => openEditModal(viewingNote)}
                >
                  編集
                </button>
                <button
                  className="btn btn--danger btn--small"
                  onClick={() => {
                    handleDelete(viewingNote.id)
                    closeDetailView()
                  }}
                >
                  削除
                </button>
              </div>
            </div>

            <article className="detail-view__content">
              <h1>{viewingNote.title}</h1>

              <div className="detail-view__id">
                <code>{viewingNote.id}</code>
                <button
                  className="detail-view__copy"
                  onClick={() => {
                    navigator.clipboard.writeText(`[](${viewingNote.id})`)
                    alert('リンク形式でコピーしました')
                  }}
                  title="リンク形式でコピー"
                >
                  コピー
                </button>
              </div>

              <div className="detail-view__meta">
                {viewingNote.sourceType && (
                  <span className="detail-view__tag detail-view__tag--type">
                    {SOURCE_TYPES.find(s => s.value === viewingNote.sourceType)?.label || viewingNote.sourceType}
                  </span>
                )}
                {viewingNote.category && (
                  <span className="detail-view__tag detail-view__tag--category">
                    {viewingNote.category}
                  </span>
                )}
                {viewingNote.tags && JSON.parse(viewingNote.tags).map((tag: string) => (
                  <span key={tag} className="detail-view__tag">
                    {tag}
                  </span>
                ))}
              </div>

              {viewingNote.source && (
                <p className="detail-view__source">
                  ソース: {viewingNote.source}
                </p>
              )}

              <div className="detail-view__body">
                {renderContent(viewingNote.content)}
              </div>

              <div className="detail-view__footer">
                <span>作成: {formatDate(viewingNote.createdAt)}</span>
                <span>更新: {formatDate(viewingNote.updatedAt)}</span>
              </div>
            </article>
          </div>
        </div>
      )}

      {showModal && (
        <div className="editor-fullscreen">
          <div className="editor-fullscreen__header">
            <button className="editor-fullscreen__back" onClick={closeModal}>
              ← キャンセル
            </button>
            <h2>{editingNote ? '知識ノートを編集' : '新しい知識ノート'}</h2>
            <button
              className="btn btn--primary btn--small"
              onClick={handleSubmit}
              disabled={saving || !form.title.trim() || !form.content.trim()}
            >
              {saving ? '保存中...' : editingNote ? '更新' : '作成'}
            </button>
          </div>

          {/* スマホ用タブ切り替え */}
          <div className="editor-fullscreen__tabs">
            <button
              className={`editor-fullscreen__tab ${editTab === 'edit' ? 'editor-fullscreen__tab--active' : ''}`}
              onClick={() => setEditTab('edit')}
            >
              編集
            </button>
            <button
              className={`editor-fullscreen__tab ${editTab === 'preview' ? 'editor-fullscreen__tab--active' : ''}`}
              onClick={() => setEditTab('preview')}
            >
              プレビュー
            </button>
          </div>

          <div className="editor-fullscreen__body">
            {/* 編集パネル */}
            <div className={`editor-fullscreen__edit ${editTab === 'edit' ? 'editor-fullscreen__edit--active' : ''}`}>
              <div className="editor-fullscreen__meta">
                <div className="form-group">
                  <label htmlFor="title">タイトル *</label>
                  <input
                    id="title"
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="学んだことのタイトル"
                    required
                  />
                </div>

                <div className="editor-fullscreen__meta-row">
                  <div className="form-group">
                    <label htmlFor="sourceType">ソース種別</label>
                    <select
                      id="sourceType"
                      value={form.sourceType}
                      onChange={(e) => setForm({ ...form, sourceType: e.target.value })}
                    >
                      {SOURCE_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="source">ソース名</label>
                    <input
                      id="source"
                      type="text"
                      value={form.source}
                      onChange={(e) => setForm({ ...form, source: e.target.value })}
                      placeholder="書籍名、プロジェクト名など"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="category">カテゴリ</label>
                    <input
                      id="category"
                      type="text"
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      placeholder="技術、ビジネス、思考法など"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="tags">タグ（カンマ区切り）</label>
                    <input
                      id="tags"
                      type="text"
                      value={form.tags}
                      onChange={(e) => setForm({ ...form, tags: e.target.value })}
                      placeholder="React, TypeScript, 設計"
                    />
                  </div>
                </div>
              </div>

              <div className="form-group editor-fullscreen__content-group">
                <label htmlFor="content">内容 *（Markdown対応）</label>
                <textarea
                  id="content"
                  ref={textareaRef}
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  onScroll={handleEditorScroll}
                  placeholder="学んだ内容を記録...

# 見出し
## 小見出し

- リスト項目
- リスト項目

**太字** や *斜体* も使えます

> 引用

`コード`"
                  required
                />
              </div>
            </div>

            {/* プレビューパネル */}
            <div
              ref={previewRef}
              className={`editor-fullscreen__preview ${editTab === 'preview' ? 'editor-fullscreen__preview--active' : ''}`}
              onScroll={handlePreviewScroll}
            >
              <div className="editor-fullscreen__preview-content">
                <h1>{form.title || 'タイトル未入力'}</h1>

                <div className="detail-view__meta">
                  {form.sourceType && (
                    <span className="detail-view__tag detail-view__tag--type">
                      {SOURCE_TYPES.find(s => s.value === form.sourceType)?.label || form.sourceType}
                    </span>
                  )}
                  {form.category && (
                    <span className="detail-view__tag detail-view__tag--category">
                      {form.category}
                    </span>
                  )}
                  {form.tags && form.tags.split(',').map((tag) => tag.trim()).filter(Boolean).map((tag) => (
                    <span key={tag} className="detail-view__tag">
                      {tag}
                    </span>
                  ))}
                </div>

                {form.source && (
                  <p className="detail-view__source">
                    ソース: {form.source}
                  </p>
                )}

                <div className="detail-view__body">
                  {form.content ? renderContent(form.content) : (
                    <p className="editor-fullscreen__preview-placeholder">内容を入力するとプレビューが表示されます</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
