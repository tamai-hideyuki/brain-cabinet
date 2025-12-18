import { useNavigate } from 'react-router-dom'
import { MainLayout } from '../../templates/MainLayout'
import { NoteList } from '../../organisms/NoteList'
import { SearchBox } from '../../molecules/SearchBox'
import { useNotes } from '../../../hooks/useNotes'
import { Text } from '../../atoms/Text'
import './NotesPage.css'

export const NotesPage = () => {
  const { notes, loading, error, search, setSearch, executeSearch } = useNotes()
  const navigate = useNavigate()

  const handleNoteClick = (id: string) => {
    navigate(`/ui/notes/${id}`)
  }

  return (
    <MainLayout>
      <div className="notes-page">
        <div className="notes-page__header">
          <Text variant="title">ノート一覧</Text>
          <Text variant="caption">{notes.length} 件</Text>
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
        />
      </div>
    </MainLayout>
  )
}
