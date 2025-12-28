import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MainLayout } from '../../templates/MainLayout'
import { NoteDetail } from '../../organisms/NoteDetail'
import { EditNoteModal } from '../../organisms/EditNoteModal'
import { Button } from '../../atoms/Button'
import { useNote } from '../../../hooks/useNote'
import { useNoteInfluence } from '../../../hooks/useNoteInfluence'
import { createBookmarkNode } from '../../../api/bookmarkApi'
import { updateNote } from '../../../api/notesApi'
import './NoteDetailPage.css'

export const NoteDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { note, history, loading, historyLoading, error, loadHistory, reload } = useNote(id)
  const { influence, loading: influenceLoading } = useNoteInfluence(id ?? null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [bookmarkAdding, setBookmarkAdding] = useState(false)
  const [addingLinkNoteId, setAddingLinkNoteId] = useState<string | null>(null)

  const handleBack = () => {
    navigate('/ui/notes')
  }

  const handleNoteClick = (noteId: string) => {
    navigate(`/ui/notes/${noteId}`)
  }

  const handleEdit = () => {
    setIsEditModalOpen(true)
  }

  const handleEditClose = () => {
    setIsEditModalOpen(false)
  }

  const handleEditUpdated = () => {
    reload()
  }

  const handleAddBookmark = async () => {
    if (!note) return
    setBookmarkAdding(true)
    try {
      await createBookmarkNode({
        type: 'note',
        name: note.title,
        noteId: note.id,
      })
      alert('ブックマークに追加しました')
    } catch (e) {
      alert('ブックマークの追加に失敗しました')
      console.error(e)
    } finally {
      setBookmarkAdding(false)
    }
  }

  const handleAddLink = async (targetNoteId: string, _targetNoteTitle: string) => {
    if (!note) return
    setAddingLinkNoteId(targetNoteId)
    try {
      const linkText = `\n\n[[${targetNoteId}]]`
      const newContent = note.content + linkText
      await updateNote(note.id, note.title, newContent)
      reload()
    } catch (e) {
      alert('リンクの追加に失敗しました')
      console.error(e)
    } finally {
      setAddingLinkNoteId(null)
    }
  }

  return (
    <MainLayout>
      <div className="note-detail-page">
        <div className="note-detail-page__nav">
          <Button variant="ghost" onClick={handleBack}>
            ← 一覧に戻る
          </Button>
        </div>
        <NoteDetail
          note={note}
          history={history}
          loading={loading}
          historyLoading={historyLoading}
          error={error}
          onLoadHistory={loadHistory}
          influence={influence}
          influenceLoading={influenceLoading}
          onInfluenceNoteClick={handleNoteClick}
          onEdit={handleEdit}
          onAddBookmark={handleAddBookmark}
          bookmarkAdding={bookmarkAdding}
          onAddLink={handleAddLink}
          addingLinkNoteId={addingLinkNoteId}
        />
      </div>
      {isEditModalOpen && note && (
        <EditNoteModal
          note={note}
          onClose={handleEditClose}
          onUpdated={handleEditUpdated}
        />
      )}
    </MainLayout>
  )
}
