import { MainLayout } from '../../templates/MainLayout'
import { DeletedNoteCard } from '../../molecules/DeletedNoteCard'
import { useDeletedNotes } from '../../../hooks/useDeletedNotes'
import { Text } from '../../atoms/Text'
import { Button } from '../../atoms/Button'
import { Spinner } from '../../atoms/Spinner'
import './TrashPage.css'

export const TrashPage = () => {
  const { notes, loading, error, restoring, reload, restore } = useDeletedNotes()

  return (
    <MainLayout>
      <div className="trash-page">
        <header className="trash-page__header">
          <div className="trash-page__title">
            <Text variant="title">ゴミ箱</Text>
            {notes.length > 0 && (
              <Text variant="caption">{notes.length}件の削除済みノート</Text>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={reload} disabled={loading}>
            更新
          </Button>
        </header>

        <div className="trash-page__info">
          <Text variant="caption">
            削除されたノートは1時間後に完全に削除されます。それまでは復元できます。
          </Text>
        </div>

        {loading && (
          <div className="trash-page__loading">
            <Spinner />
          </div>
        )}

        {error && (
          <div className="trash-page__error">
            <Text variant="body">{error}</Text>
            <Button variant="ghost" size="sm" onClick={reload}>
              再試行
            </Button>
          </div>
        )}

        {!loading && !error && notes.length === 0 && (
          <div className="trash-page__empty">
            <Text variant="body">ゴミ箱は空です</Text>
          </div>
        )}

        {!loading && !error && notes.length > 0 && (
          <div className="trash-page__list">
            {notes.map((note) => (
              <DeletedNoteCard
                key={note.id}
                note={note}
                onRestore={restore}
                restoring={restoring === note.id}
              />
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  )
}
