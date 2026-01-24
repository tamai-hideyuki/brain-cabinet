import { useState, useEffect } from 'react'

// 開発時と本番時でCabinet UIのURLを切り替え
const cabinetUrl = import.meta.env.DEV
  ? 'http://localhost:5173/ui/'
  : '/ui/'

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
}

function App() {
  const [notes, setNotes] = useState<KnowledgeNote[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/notes')
      .then((res) => res.json())
      .then((data) => {
        setNotes(data.notes || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

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
        <nav className="header__nav">
          <a href="/knowledge/" className="header__nav-link">ホーム</a>
          <a href="/knowledge/notes" className="header__nav-link">ノート</a>
        </nav>
      </header>

      <main className="main">
        <h1>Brain Knowledge</h1>
        <p className="subtitle">読書や業務から学んだ知識を記録</p>

        {loading ? (
          <p>Loading...</p>
        ) : notes.length === 0 ? (
          <div className="empty-state">
            <p>まだ知識ノートがありません</p>
            <button className="btn btn--primary">最初のノートを作成</button>
          </div>
        ) : (
          <div className="notes-grid">
            {notes.map((note) => (
              <div key={note.id} className="note-card">
                <h3>{note.title}</h3>
                {note.source && (
                  <span className="note-card__source">{note.source}</span>
                )}
                <p className="note-card__excerpt">
                  {note.content.slice(0, 100)}...
                </p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default App
