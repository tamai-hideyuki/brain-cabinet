import { useState, useEffect, useRef, useCallback, useId } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import mermaid from 'mermaid'

// Mermaid初期化
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
})

// Mermaidダイアグラムコンポーネント
const MermaidDiagram = ({ chart }: { chart: string }) => {
  const [svg, setSvg] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const id = useId().replace(/:/g, '-')

  useEffect(() => {
    const renderChart = async () => {
      try {
        const { svg } = await mermaid.render(`mermaid${id}`, chart)
        setSvg(svg)
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to render diagram')
      }
    }
    renderChart()
  }, [chart, id])

  if (error) {
    return <div className="mermaid-error">{error}</div>
  }

  return (
    <div
      className="mermaid-diagram"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

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

type BookmarkNode = {
  id: string
  parentId: string | null
  type: 'folder' | 'note' | 'link'
  name: string
  noteId: string | null
  url: string | null
  position: number
  isExpanded: boolean
  createdAt: number | null
  updatedAt: number | null
  note?: {
    id: string
    title: string
    category: string | null
  }
  children?: BookmarkNode[]
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

// ブックマークツリーノードコンポーネント
type BookmarkTreeNodeProps = {
  node: BookmarkNode
  depth: number
  onNodeClick: (node: BookmarkNode) => void
  onToggleExpand: (id: string, isExpanded: boolean) => void
  onDelete: (id: string) => void
  onRename: (id: string, name: string) => void
  editingId: string | null
  editingName: string
  onEditingNameChange: (name: string) => void
  onSaveRename: (id: string, name: string) => void
  onCancelRename: () => void
  // ドラッグ＆ドロップ
  draggingId: string | null
  dragOverId: string | null
  onDragStart: (id: string) => void
  onDragEnd: () => void
  onDragOver: (id: string) => void
  onDragLeave: () => void
  onDrop: (targetId: string) => void
}

const BookmarkTreeNode = ({
  node,
  depth,
  onNodeClick,
  onToggleExpand,
  onDelete,
  onRename,
  editingId,
  editingName,
  onEditingNameChange,
  onSaveRename,
  onCancelRename,
  draggingId,
  dragOverId,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: BookmarkTreeNodeProps) => {
  const isEditing = editingId === node.id
  const hasChildren = node.children && node.children.length > 0
  const isDragging = draggingId === node.id
  const isDragOver = dragOverId === node.id && node.type === 'folder' && draggingId !== node.id

  const getIcon = () => {
    if (node.type === 'folder') {
      return node.isExpanded ? '📂' : '📁'
    }
    if (node.type === 'link') return '🔗'
    return '📄'
  }

  return (
    <div className="bookmark-node">
      <div
        className={`bookmark-node__row ${node.type === 'note' ? 'bookmark-node__row--clickable' : ''} ${isDragging ? 'bookmark-node__row--dragging' : ''} ${isDragOver ? 'bookmark-node__row--drag-over' : ''}`}
        style={{ paddingLeft: `${depth * 1.25}rem` }}
        draggable={!isEditing}
        onDragStart={(e) => {
          e.stopPropagation()
          onDragStart(node.id)
        }}
        onDragEnd={(e) => {
          e.stopPropagation()
          onDragEnd()
        }}
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (node.type === 'folder' && draggingId !== node.id) {
            onDragOver(node.id)
          }
        }}
        onDragLeave={(e) => {
          e.stopPropagation()
          onDragLeave()
        }}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (node.type === 'folder' && draggingId !== node.id) {
            onDrop(node.id)
          }
        }}
      >
        {node.type === 'folder' && (
          <button
            className="bookmark-node__toggle"
            onClick={() => onToggleExpand(node.id, !node.isExpanded)}
          >
            {node.isExpanded ? '▼' : '▶'}
          </button>
        )}
        <span className="bookmark-node__icon">{getIcon()}</span>

        {isEditing ? (
          <input
            type="text"
            className="bookmark-node__edit-input"
            value={editingName}
            onChange={(e) => onEditingNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSaveRename(node.id, editingName)
              if (e.key === 'Escape') onCancelRename()
            }}
            onBlur={() => onSaveRename(node.id, editingName)}
            autoFocus
          />
        ) : (
          <span
            className="bookmark-node__name"
            onClick={() => node.type === 'note' && onNodeClick(node)}
          >
            {node.name}
          </span>
        )}

        {node.note?.category && (
          <span className="bookmark-node__category">{node.note.category}</span>
        )}

        <div className="bookmark-node__actions">
          <button
            className="bookmark-node__action"
            onClick={() => onRename(node.id, node.name)}
            title="名前変更"
          >
            ✏️
          </button>
          <button
            className="bookmark-node__action bookmark-node__action--danger"
            onClick={() => {
              if (confirm(`「${node.name}」を削除しますか？`)) {
                onDelete(node.id)
              }
            }}
            title="削除"
          >
            🗑️
          </button>
        </div>
      </div>

      {node.type === 'folder' && node.isExpanded && hasChildren && (
        <div className="bookmark-node__children">
          {node.children!.map((child) => (
            <BookmarkTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              onNodeClick={onNodeClick}
              onToggleExpand={onToggleExpand}
              onDelete={onDelete}
              onRename={onRename}
              editingId={editingId}
              editingName={editingName}
              onEditingNameChange={onEditingNameChange}
              onSaveRename={onSaveRename}
              onCancelRename={onCancelRename}
              draggingId={draggingId}
              dragOverId={dragOverId}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// カウントダウン関連
const EXPIRATION_MS = 3600 * 1000 // 1時間（ミリ秒）

const calculateRemainingSeconds = (deletedAt: number): number => {
  const now = Date.now() // ミリ秒
  const expiresAt = deletedAt + EXPIRATION_MS // ミリ秒
  return Math.max(0, Math.floor((expiresAt - now) / 1000)) // 秒に変換
}

const formatCountdown = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hours > 0) {
    return `${hours}時間${minutes}分${secs}秒`
  }
  if (minutes > 0) {
    return `${minutes}分${secs}秒`
  }
  return `${secs}秒`
}

function App() {
  const [notes, setNotes] = useState<KnowledgeNote[]>([])
  const [deletedNotes, setDeletedNotes] = useState<KnowledgeNote[]>([])
  const [loading, setLoading] = useState(true)
  const [showTrash, setShowTrash] = useState(false)

  // ページネーション
  const [currentPage, setCurrentPage] = useState(1)
  const [totalNotes, setTotalNotes] = useState(0)
  const NOTES_PER_PAGE = 30
  const totalPages = Math.ceil(totalNotes / NOTES_PER_PAGE)
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

  // カウントダウン更新用のトリガー
  const [countdownTick, setCountdownTick] = useState(0)

  // 削除確認モーダル
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeNote | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ブックマーク関連
  const [showBookmarks, setShowBookmarks] = useState(false)
  const [bookmarkTree, setBookmarkTree] = useState<BookmarkNode[]>([])
  const [bookmarkLoading, setBookmarkLoading] = useState(false)
  const [addingBookmark, setAddingBookmark] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [editingBookmark, setEditingBookmark] = useState<string | null>(null)
  const [editingBookmarkName, setEditingBookmarkName] = useState('')
  const [draggingBookmarkId, setDraggingBookmarkId] = useState<string | null>(null)
  const [dragOverBookmarkId, setDragOverBookmarkId] = useState<string | null>(null)

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

  const fetchNotes = (page = 1) => {
    const offset = (page - 1) * NOTES_PER_PAGE
    fetch(`${apiBase}/notes?limit=${NOTES_PER_PAGE}&offset=${offset}`)
      .then((res) => res.json())
      .then((data) => {
        setNotes(data.notes || [])
        setTotalNotes(data.total || 0)
        setCurrentPage(page)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return
    setLoading(true)
    fetchNotes(page)
  }

  const fetchDeletedNotes = () => {
    fetch(`${apiBase}/notes/deleted`)
      .then((res) => res.json())
      .then((data) => {
        setDeletedNotes(data.notes || [])
      })
      .catch(() => setDeletedNotes([]))
  }

  // ブックマーク取得
  const fetchBookmarks = async () => {
    setBookmarkLoading(true)
    try {
      const res = await fetch(`${apiBase}/bookmarks`)
      const data = await res.json()
      setBookmarkTree(data.tree || [])
    } catch (err) {
      console.error('Failed to fetch bookmarks:', err)
    } finally {
      setBookmarkLoading(false)
    }
  }

  // ブックマークにノートを追加
  const addNoteToBookmark = async (note: KnowledgeNote) => {
    setAddingBookmark(true)
    try {
      await fetch(`${apiBase}/bookmarks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'note',
          name: note.title,
          noteId: note.id,
        }),
      })
      await fetchBookmarks()
    } catch (err) {
      console.error('Failed to add bookmark:', err)
    } finally {
      setAddingBookmark(false)
    }
  }

  // フォルダ作成
  const createFolder = async () => {
    if (!newFolderName.trim()) return
    setCreatingFolder(true)
    try {
      await fetch(`${apiBase}/bookmarks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'folder',
          name: newFolderName.trim(),
        }),
      })
      setNewFolderName('')
      await fetchBookmarks()
    } catch (err) {
      console.error('Failed to create folder:', err)
    } finally {
      setCreatingFolder(false)
    }
  }

  // ブックマーク削除
  const deleteBookmark = async (id: string) => {
    try {
      await fetch(`${apiBase}/bookmarks/${id}`, { method: 'DELETE' })
      await fetchBookmarks()
    } catch (err) {
      console.error('Failed to delete bookmark:', err)
    }
  }

  // ブックマーク名更新
  const updateBookmarkName = async (id: string, name: string) => {
    try {
      await fetch(`${apiBase}/bookmarks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      setEditingBookmark(null)
      setEditingBookmarkName('')
      await fetchBookmarks()
    } catch (err) {
      console.error('Failed to update bookmark:', err)
    }
  }

  // フォルダ展開/折りたたみ
  const toggleBookmarkExpand = async (id: string, isExpanded: boolean) => {
    try {
      await fetch(`${apiBase}/bookmarks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isExpanded }),
      })
      // ローカルで即座に更新
      const updateTreeExpand = (nodes: BookmarkNode[]): BookmarkNode[] => {
        return nodes.map((node) => {
          if (node.id === id) {
            return { ...node, isExpanded }
          }
          if (node.children) {
            return { ...node, children: updateTreeExpand(node.children) }
          }
          return node
        })
      }
      setBookmarkTree(updateTreeExpand(bookmarkTree))
    } catch (err) {
      console.error('Failed to toggle expand:', err)
    }
  }

  // ノートがブックマーク済みかどうかをチェック
  const isNoteBookmarked = (noteId: string): boolean => {
    const checkInTree = (nodes: BookmarkNode[]): boolean => {
      for (const node of nodes) {
        if (node.type === 'note' && node.noteId === noteId) return true
        if (node.children && checkInTree(node.children)) return true
      }
      return false
    }
    return checkInTree(bookmarkTree)
  }

  // ブックマーク移動（ドラッグ＆ドロップ）
  const moveBookmark = async (bookmarkId: string, newParentId: string | null) => {
    try {
      await fetch(`${apiBase}/bookmarks/${bookmarkId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newParentId }),
      })
      await fetchBookmarks()
    } catch (err) {
      console.error('Failed to move bookmark:', err)
    }
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
    fetchBookmarks()
  }, [])

  // ゴミ箱表示時のカウントダウン更新（1秒ごと）
  useEffect(() => {
    if (!showTrash || deletedNotes.length === 0) return

    const interval = setInterval(() => {
      setCountdownTick((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [showTrash, deletedNotes.length])

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

      // ブックマーク
      setShowBookmarks(state.view === 'bookmarks')

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

      // ブックマーク
      if (params.get('view') === 'bookmarks') {
        setShowBookmarks(true)
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

  const handleDelete = (note: KnowledgeNote) => {
    setDeleteTarget(note)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return

    setDeleting(true)
    try {
      await fetch(`${apiBase}/notes/${deleteTarget.id}`, { method: 'DELETE' })
      setDeleteTarget(null)
      if (viewingNote?.id === deleteTarget.id) {
        closeDetailView()
      }
      fetchNotes(currentPage)
      fetchDeletedNotes()
    } catch (err) {
      console.error('Failed to delete note:', err)
    } finally {
      setDeleting(false)
    }
  }

  const cancelDelete = () => {
    setDeleteTarget(null)
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
    // まずゴミ箱にあるかチェック
    const trashedNote = deletedNotes.find((n) => n.id === noteId)
    if (trashedNote) {
      alert('このノートはゴミ箱にあります')
      return
    }

    const linkedNote = notes.find((n) => n.id === noteId)
    if (linkedNote) {
      openDetailView(linkedNote)
    } else {
      // ノートが一覧にない場合はAPIから取得
      fetch(`${apiBase}/notes/${noteId}`)
        .then((res) => res.json())
        .then((note) => {
          if (note && note.id) {
            // deletedAtがあればゴミ箱にある
            if (note.deletedAt) {
              alert('このノートはゴミ箱にあります')
              return
            }
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
          code: ({ className, children }) => {
            const match = /language-(\w+)/.exec(className || '')
            const language = match ? match[1] : ''
            const codeString = String(children).replace(/\n$/, '')

            // インラインコードの場合
            if (!match) {
              return <code className={className}>{children}</code>
            }

            // Mermaid記法の場合
            if (language === 'mermaid') {
              return <MermaidDiagram chart={codeString} />
            }

            // コードブロック
            return (
              <SyntaxHighlighter
                style={oneDark}
                language={language}
                PreTag="div"
              >
                {codeString}
              </SyntaxHighlighter>
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
            className={`header__bookmark-btn ${showBookmarks ? 'header__bookmark-btn--active' : ''}`}
            onClick={() => {
              if (!showBookmarks) {
                setShowBookmarks(true)
                setShowTrash(false)
                setShowSearchResults(false)
                setSearchQuery('')
                window.history.pushState({ view: 'bookmarks' }, '', '?view=bookmarks')
              } else {
                setShowBookmarks(false)
                window.history.pushState({}, '', window.location.pathname)
              }
            }}
            title="ブックマーク"
          >
            ★ {bookmarkTree.length > 0 && <span className="header__bookmark-count">{bookmarkTree.length}</span>}
          </button>
          <button
            className={`header__trash-btn ${showTrash ? 'header__trash-btn--active' : ''}`}
            onClick={() => {
              if (!showTrash) {
                // ゴミ箱を開く
                setShowTrash(true)
                setShowBookmarks(false)
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
        ) : showBookmarks ? (
          <>
            <div className="bookmark-header">
              <h1>ブックマーク</h1>
            </div>
            <p className="subtitle">よく参照するノートを整理</p>

            <div className="bookmark-folder-form">
              <input
                type="text"
                className="bookmark-folder-form__input"
                placeholder="新しいフォルダ名..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
              />
              <button
                type="button"
                className="btn btn--primary btn--small"
                onClick={createFolder}
                disabled={creatingFolder || !newFolderName.trim()}
              >
                {creatingFolder ? '作成中...' : '+ フォルダ作成'}
              </button>
            </div>

            {bookmarkLoading ? (
              <p>読み込み中...</p>
            ) : bookmarkTree.length === 0 ? (
              <div className="empty-state">
                <p>ブックマークがありません</p>
                <p className="empty-state__hint">ノート詳細画面から ★ ボタンで追加できます</p>
              </div>
            ) : (
              <div className="bookmark-tree">
                {bookmarkTree.map((node) => (
                  <BookmarkTreeNode
                    key={node.id}
                    node={node}
                    depth={0}
                    onNodeClick={(n) => {
                      if (n.type === 'note' && n.noteId) {
                        const note = notes.find((note) => note.id === n.noteId)
                        if (note) {
                          openDetailView(note)
                        } else {
                          fetch(`${apiBase}/notes/${n.noteId}`)
                            .then((res) => res.json())
                            .then((fetchedNote) => {
                              if (fetchedNote?.id) {
                                openDetailView(fetchedNote)
                              }
                            })
                        }
                      }
                    }}
                    onToggleExpand={toggleBookmarkExpand}
                    onDelete={deleteBookmark}
                    onRename={(id, name) => {
                      setEditingBookmark(id)
                      setEditingBookmarkName(name)
                    }}
                    editingId={editingBookmark}
                    editingName={editingBookmarkName}
                    onEditingNameChange={setEditingBookmarkName}
                    onSaveRename={updateBookmarkName}
                    onCancelRename={() => {
                      setEditingBookmark(null)
                      setEditingBookmarkName('')
                    }}
                    draggingId={draggingBookmarkId}
                    dragOverId={dragOverBookmarkId}
                    onDragStart={(id) => setDraggingBookmarkId(id)}
                    onDragEnd={() => {
                      setDraggingBookmarkId(null)
                      setDragOverBookmarkId(null)
                    }}
                    onDragOver={(id) => setDragOverBookmarkId(id)}
                    onDragLeave={() => setDragOverBookmarkId(null)}
                    onDrop={(targetId) => {
                      if (draggingBookmarkId && draggingBookmarkId !== targetId) {
                        moveBookmark(draggingBookmarkId, targetId)
                      }
                      setDraggingBookmarkId(null)
                      setDragOverBookmarkId(null)
                    }}
                  />
                ))}
                {draggingBookmarkId && (
                  <div
                    className={`bookmark-root-drop ${dragOverBookmarkId === 'root' ? 'bookmark-root-drop--active' : ''}`}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setDragOverBookmarkId('root')
                    }}
                    onDragLeave={() => setDragOverBookmarkId(null)}
                    onDrop={(e) => {
                      e.preventDefault()
                      if (draggingBookmarkId) {
                        moveBookmark(draggingBookmarkId, null)
                      }
                      setDraggingBookmarkId(null)
                      setDragOverBookmarkId(null)
                    }}
                  >
                    ルートに移動
                  </div>
                )}
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
                {deletedNotes.map((note) => {
                  const remainingSeconds = note.deletedAt ? calculateRemainingSeconds(note.deletedAt) : 0
                  const isExpiringSoon = remainingSeconds <= 300 // 5分以内
                  // countdownTickを参照して再レンダリングをトリガー
                  void countdownTick

                  return (
                    <div key={note.id} className={`note-card note-card--deleted ${isExpiringSoon ? 'note-card--expiring' : ''}`}>
                      <div className="note-card__header">
                        <h3>{note.title}</h3>
                      </div>
                      <p className="note-card__excerpt">
                        {note.content.length > 100 ? note.content.slice(0, 100) + '...' : note.content}
                      </p>
                      <div className="note-card__countdown">
                        <span className="note-card__countdown-label">完全削除まで</span>
                        <span className={`note-card__countdown-time ${isExpiringSoon ? 'note-card__countdown-time--warning' : ''}`}>
                          {formatCountdown(remainingSeconds)}
                        </span>
                      </div>
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
                  )
                })}
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
              <>
                <div className="notes-grid">
                  {notes.map((note) => (
                    <div key={note.id} className="note-card" onClick={() => openDetailView(note)}>
                      <div className="note-card__header">
                        <h3>{note.title}</h3>
                        <button
                          className="note-card__delete"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(note)
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

                {/* ページネーション */}
                {totalPages > 1 && (
                  <div className="pagination">
                    <button
                      className="btn btn--small btn--secondary"
                      onClick={() => goToPage(1)}
                      disabled={currentPage === 1}
                    >
                      ⏮ 最初
                    </button>
                    <button
                      className="btn btn--small btn--secondary"
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      ← 前へ
                    </button>
                    <span className="pagination__info">
                      {currentPage} / {totalPages} ページ（{totalNotes}件）
                    </span>
                    <button
                      className="btn btn--small btn--secondary"
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      次へ →
                    </button>
                    <button
                      className="btn btn--small btn--secondary"
                      onClick={() => goToPage(totalPages)}
                      disabled={currentPage === totalPages}
                    >
                      最後 ⏭
                    </button>
                  </div>
                )}
              </>
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
                  className={`btn btn--small ${isNoteBookmarked(viewingNote.id) ? 'btn--secondary' : 'btn--ghost'}`}
                  onClick={() => addNoteToBookmark(viewingNote)}
                  disabled={addingBookmark || isNoteBookmarked(viewingNote.id)}
                  title={isNoteBookmarked(viewingNote.id) ? 'ブックマーク済み' : 'ブックマークに追加'}
                >
                  {addingBookmark ? '追加中...' : isNoteBookmarked(viewingNote.id) ? '★ ブックマーク済み' : '☆ ブックマーク'}
                </button>
                <button
                  className="btn btn--primary btn--small"
                  onClick={() => openEditModal(viewingNote)}
                >
                  編集
                </button>
                <button
                  className="btn btn--danger btn--small"
                  onClick={() => handleDelete(viewingNote)}
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

      {/* 削除確認モーダル */}
      {deleteTarget && (
        <div className="confirm-modal__backdrop" onClick={cancelDelete}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-modal__header">
              <h3>ノートを削除</h3>
            </div>
            <div className="confirm-modal__body">
              <p>「{deleteTarget.title}」を削除しますか？削除後1時間以内であればゴミ箱から復元できます。</p>
            </div>
            <div className="confirm-modal__actions">
              <button className="btn btn--secondary" onClick={cancelDelete} disabled={deleting}>
                キャンセル
              </button>
              <button className="btn btn--danger" onClick={confirmDelete} disabled={deleting}>
                {deleting ? '削除中...' : '削除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
