import { useNavigate } from 'react-router-dom'
import { MainLayout } from '../../templates/MainLayout'
import { Dashboard } from '../../organisms/Dashboard'
import { Text } from '../../atoms/Text'
import './DashboardPage.css'

export const DashboardPage = () => {
  const navigate = useNavigate()

  const handleNoteClick = (noteId: string) => {
    navigate(`/ui/notes/${noteId}`)
  }

  const handleReviewClick = () => {
    navigate('/ui/reviews')
  }

  return (
    <MainLayout>
      <div className="dashboard-page">
        <div className="dashboard-page__header">
          <Text variant="title">ダッシュボード</Text>
          <Text variant="caption">今日の状態と活動の概要</Text>
        </div>
        <div className="dashboard-page__content">
          <Dashboard onNoteClick={handleNoteClick} onReviewClick={handleReviewClick} />
        </div>
      </div>
    </MainLayout>
  )
}
