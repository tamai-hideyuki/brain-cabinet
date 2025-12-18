import { route } from 'preact-router'
import type { RoutableProps } from 'preact-router'
import { MainLayout } from '../../templates/MainLayout'
import { ReviewList } from '../../organisms/ReviewList'
import { useReviews } from '../../../hooks/useReviews'
import { Text } from '../../atoms/Text'
import { Button } from '../../atoms/Button'
import './ReviewsPage.css'

type ReviewsPageProps = RoutableProps

export const ReviewsPage = (_props: ReviewsPageProps) => {
  const { data, loading, error, reload } = useReviews()

  const handleItemClick = (noteId: string) => {
    route(`/ui/notes/${noteId}`)
  }

  return (
    <MainLayout>
      <div class="reviews-page">
        <div class="reviews-page__header">
          <div class="reviews-page__title">
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
