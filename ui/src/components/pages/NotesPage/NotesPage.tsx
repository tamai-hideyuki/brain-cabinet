import { useNavigate } from 'react-router-dom'
import { MainLayout } from '../../templates/MainLayout'
import { NoteList } from '../../organisms/NoteList'
import { SearchBox } from '../../molecules/SearchBox'
import { useNotes } from '../../../hooks/useNotes'
import { usePromotionCandidates } from '../../../hooks/usePromotionCandidates'
import { Text } from '../../atoms/Text'
import { Badge } from '../../atoms/Badge'
import './NotesPage.css'

export const NotesPage = () => {
  const { notes, loading, error, search, setSearch, executeSearch } = useNotes()
  const { candidates: promotionCandidates } = usePromotionCandidates()
  const navigate = useNavigate()

  const handleNoteClick = (id: string) => {
    navigate(`/ui/notes/${id}`)
  }

  return (
    <MainLayout>
      <div className="notes-page">
        <div className="notes-page__header">
          <div className="notes-page__title-row">
            <Text variant="title">ノート一覧</Text>
            <Text variant="caption">{notes.length} 件</Text>
          </div>
          {promotionCandidates.length > 0 && (
            <div className="notes-page__promotion-notice">
              <Badge variant="promotion">昇格候補 {promotionCandidates.length} 件</Badge>
            </div>
          )}
        </div>
        <div className="notes-page__search">
          <SearchBox
            value={search}
            onChange={setSearch}
            onSearch={executeSearch}
            placeholder="ノートを検索..."
          />
        </div>
        <NoteList
          notes={notes}
          loading={loading}
          error={error}
          onNoteClick={handleNoteClick}
          promotionCandidates={promotionCandidates}
        />
      </div>
    </MainLayout>
  )
}
