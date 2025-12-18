import Router from 'preact-router'
import { NotesPage } from './components/pages/NotesPage'
import { NoteDetailPage } from './components/pages/NoteDetailPage'
import { ReviewsPage } from './components/pages/ReviewsPage'

export function App() {
  return (
    <Router>
      <NotesPage path="/ui/" />
      <NotesPage path="/ui" />
      <NoteDetailPage path="/ui/notes/:id" />
      <ReviewsPage path="/ui/reviews" />
    </Router>
  )
}
