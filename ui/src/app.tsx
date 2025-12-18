import Router from 'preact-router'
import { NotesPage } from './components/pages/NotesPage'
import { NoteDetailPage } from './components/pages/NoteDetailPage'

export function App() {
  return (
    <Router>
      <NotesPage path="/ui/" />
      <NotesPage path="/ui" />
      <NoteDetailPage path="/ui/notes/:id" />
    </Router>
  )
}
