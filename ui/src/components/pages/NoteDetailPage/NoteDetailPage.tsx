import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MainLayout } from '../../templates/MainLayout'
import { NoteDetail } from '../../organisms/NoteDetail'
import { EditNoteModal } from '../../organisms/EditNoteModal'
import { ConfirmModal } from '../../organisms/ConfirmModal'
import { Button } from '../../atoms/Button'
import { useNote } from '../../../hooks/useNote'
import { useNoteInfluence } from '../../../hooks/useNoteInfluence'
import { useNoteActions } from '../../../hooks/useNoteActions'
import './NoteDetailPage.css'

export const NoteDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { note, history, loading, historyLoading, error, loadHistory, reload } = useNote(id)
  const { influence, loading: influenceLoading } = useNoteInfluence(id ?? null)
  const {
    bookmarkAdding,
    addingLinkNoteId,
    deleting,
    addBookmark,
    addLink,
    remove,
  } = useNoteActions(note, reload)

  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

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
    try {
      await addBookmark()
      alert('ブックマークに追加しました')
    } catch {
      alert('ブックマークの追加に失敗しました')
    }
  }

  const handleAddLink = async (targetNoteId: string, _targetNoteTitle: string) => {
    try {
      await addLink(targetNoteId)
    } catch {
      alert('リンクの追加に失敗しました')
    }
  }

  const handleDelete = () => {
    setIsDeleteModalOpen(true)
  }

  const handleDeleteCancel = () => {
    setIsDeleteModalOpen(false)
  }

  const handleDeleteConfirm = async () => {
    try {
      await remove()
      setIsDeleteModalOpen(false)
      navigate('/ui/notes')
    } catch {
      alert('削除に失敗しました')
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
