import { route } from 'preact-router'
import type { RoutableProps } from 'preact-router'
import { MainLayout } from '../../templates/MainLayout'
import { NoteDetail } from '../../organisms/NoteDetail'
import { Button } from '../../atoms/Button'
import { useNote } from '../../../hooks/useNote'
import './NoteDetailPage.css'

type NoteDetailPageProps = RoutableProps & {
  id?: string
}

export const NoteDetailPage = ({ id }: NoteDetailPageProps) => {
  const { note, history, loading, historyLoading, error, loadHistory } = useNote(id)

  const handleBack = () => {
    route('/ui/')
  }

  return (
    <MainLayout>
      <div class="note-detail-page">
        <div class="note-detail-page__nav">
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
        />
      </div>
    </MainLayout>
  )
}
