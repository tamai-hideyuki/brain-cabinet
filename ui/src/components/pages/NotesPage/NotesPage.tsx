import { route } from 'preact-router'
import type { RoutableProps } from 'preact-router'
import { MainLayout } from '../../templates/MainLayout'
import { NoteList } from '../../organisms/NoteList'
import { SearchBox } from '../../molecules/SearchBox'
import { useNotes } from '../../../hooks/useNotes'
import { Text } from '../../atoms/Text'
import './NotesPage.css'

type NotesPageProps = RoutableProps

export const NotesPage = (_props: NotesPageProps) => {
  const { notes, loading, error, search, setSearch, executeSearch } = useNotes()

  const handleNoteClick = (id: string) => {
    route(`/ui/notes/${id}`)
  }

  return (
    <MainLayout>
      <div class="notes-page">
        <div class="notes-page__header">
          <Text variant="title">ノート一覧</Text>
          <Text variant="caption">{notes.length} 件</Text>
        </div>
        <div class="notes-page__search">
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
        />
      </div>
    </MainLayout>
  )
}
