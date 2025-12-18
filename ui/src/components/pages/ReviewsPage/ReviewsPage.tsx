import { useNavigate } from 'react-router-dom'
import { MainLayout } from '../../templates/MainLayout'
import { ReviewList } from '../../organisms/ReviewList'
import { useReviews } from '../../../hooks/useReviews'
import { Text } from '../../atoms/Text'
import { Button } from '../../atoms/Button'
import './ReviewsPage.css'

export const ReviewsPage = () => {
  const { data, loading, error, reload } = useReviews()
  const navigate = useNavigate()

  const handleItemClick = (noteId: string) => {
    navigate(`/ui/notes/${noteId}`)
  }

  return (
    <MainLayout>
      <div className="reviews-page">
        <div className="reviews-page__header">
          <div className="reviews-page__title">
            <Text variant="title">レビュー予定</Text>
            {data && <Text variant="caption">{data.total} 件</Text>}
          </div>
          <Button variant="secondary" size="sm" onClick={reload} disabled={loading}>
            更新
          </Button>
        </div>
        <ReviewList
          data={data}
          loading={loading}
          error={error}
          onItemClick={handleItemClick}
        />
      </div>
    </MainLayout>
  )
}
