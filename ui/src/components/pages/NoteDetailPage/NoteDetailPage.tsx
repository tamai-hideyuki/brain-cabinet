import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MainLayout } from '../../templates/MainLayout'
import { NoteDetail } from '../../organisms/NoteDetail'
import { EditNoteModal } from '../../organisms/EditNoteModal'
import { ConfirmModal } from '../../organisms/ConfirmModal'
import { Button } from '../../atoms/Button'
import { useNote } from '../../../hooks/useNote'
import { useNoteInfluence } from '../../../hooks/useNoteInfluence'
import { createBookmarkNode } from '../../../api/bookmarkApi'
import { updateNote, deleteNote } from '../../../api/notesApi'
import './NoteDetailPage.css'

export const NoteDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { note, history, loading, historyLoading, error, loadHistory, reload } = useNote(id)
  const { influence, loading: influenceLoading } = useNoteInfluence(id ?? null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
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

  const handleDelete = () => {
    setIsDeleteModalOpen(true)
  }

  const handleDeleteCancel = () => {
    setIsDeleteModalOpen(false)
  }

  const handleDeleteConfirm = async () => {
    if (!note) return
    setDeleting(true)
    try {
      await deleteNote(note.id)
      setIsDeleteModalOpen(false)
      navigate('/ui/notes')
    } catch (e) {
      alert('削除に失敗しました')
      console.error(e)
    } finally {
      setDeleting(false)
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
          onDelete={handleDelete}
          deleting={deleting}
        />
      </div>
      {isEditModalOpen && note && (
        <EditNoteModal
          note={note}
          onClose={handleEditClose}
          onUpdated={handleEditUpdated}
        />
      )}
      {isDeleteModalOpen && note && (
        <ConfirmModal
          title="ノートを削除"
          message={`「${note.title}」を削除しますか？削除後1時間以内であればゴミ箱から復元できます。`}
          confirmLabel="削除"
          cancelLabel="キャンセル"
          variant="danger"
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
          confirming={deleting}
        />
      )}
    </MainLayout>
  )
}
