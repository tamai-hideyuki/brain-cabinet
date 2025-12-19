import { useNavigate } from 'react-router-dom'
import { MainLayout } from '../../templates/MainLayout'
import { NoteTimeline } from '../../organisms/NoteTimeline'
import { Text } from '../../atoms/Text'
import './TimelinePage.css'

export const TimelinePage = () => {
  const navigate = useNavigate()

  const handleNoteClick = (noteId: string) => {
    navigate(`/ui/notes/${noteId}`)
  }

  return (
    <MainLayout>
      <div className="timeline-page">
        <div className="timeline-page__header">
          <Text variant="title">タイムライン</Text>
          <Text variant="caption">ノートの更新履歴を時系列で表示</Text>
        </div>
        <div className="timeline-page__content">
          <NoteTimeline onNoteClick={handleNoteClick} />
        </div>
      </div>
    </MainLayout>
  )
}
