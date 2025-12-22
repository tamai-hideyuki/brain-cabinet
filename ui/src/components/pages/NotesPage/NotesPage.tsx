import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { MainLayout } from '../../templates/MainLayout'
import { NoteList } from '../../organisms/NoteList'
import { SearchBox } from '../../molecules/SearchBox'
import { FilterDrawer, type FilterState } from '../../organisms/FilterDrawer'
import { CreateNoteModal } from '../../organisms/CreateNoteModal'
import { useNotes } from '../../../hooks/useNotes'
import { usePromotionCandidates } from '../../../hooks/usePromotionCandidates'
import { Text } from '../../atoms/Text'
import { Badge } from '../../atoms/Badge'
import { Button } from '../../atoms/Button'
import './NotesPage.css'

export const NotesPage = () => {
  const { notes, loading, error, search, setSearch, executeSearch, reload } = useNotes()
  const { candidates: promotionCandidates } = usePromotionCandidates()
  const navigate = useNavigate()
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [filter, setFilter] = useState<FilterState>({
    tags: [],
    categories: [],
    mode: 'AND',
  })

  // フィルタリングされたノート
  const filteredNotes = useMemo(() => {
    if (filter.tags.length === 0 && filter.categories.length === 0) {
      return notes
    }

    return notes.filter((note) => {
      const tagMatches = filter.tags.length === 0 ? true :
        filter.mode === 'AND'
          ? filter.tags.every((tag) => note.tags?.includes(tag))
          : filter.tags.some((tag) => note.tags?.includes(tag))

      const categoryMatches = filter.categories.length === 0 ? true :
        filter.categories.includes(note.category || '')

      if (filter.mode === 'AND') {
        return tagMatches && categoryMatches
      }
      return tagMatches || categoryMatches
    })
  }, [notes, filter])

  const activeFilterCount = filter.tags.length + filter.categories.length

  const handleNoteClick = (id: string) => {
    navigate(`/ui/notes/${id}`)
  }

  return (
    <MainLayout>
      <div className="notes-page">
        <div className="notes-page__header">
          <div className="notes-page__title-row">
            <Text variant="title">ノート一覧</Text>
            <Text variant="caption">
              {activeFilterCount > 0 ? `${filteredNotes.length} / ${notes.length}` : notes.length} 件
            </Text>
          </div>
          <div className="notes-page__actions">
            {promotionCandidates.length > 0 && (
              <Badge variant="promotion">昇格候補 {promotionCandidates.length} 件</Badge>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateOpen(true)}
            >
              + 新規作成
            </Button>
            <Button
              variant={activeFilterCount > 0 ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setIsFilterOpen(true)}
            >
              フィルター{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </Button>
          </div>
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
          notes={filteredNotes}
          loading={loading}
          error={error}
          onNoteClick={handleNoteClick}
          promotionCandidates={promotionCandidates}
        />
      </div>
      <FilterDrawer
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        notes={notes}
        filter={filter}
        onFilterChange={setFilter}
      />
      {isCreateOpen && (
        <CreateNoteModal
          onClose={() => setIsCreateOpen(false)}
          onCreated={reload}
        />
      )}
    </MainLayout>
  )
}
