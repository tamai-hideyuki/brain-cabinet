import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { SignedIn, SignedOut, SignInButton } from '@clerk/clerk-react'
import { NotesPage } from './components/pages/NotesPage'
import { NoteDetailPage } from './components/pages/NoteDetailPage'
import { ReviewsPage } from './components/pages/ReviewsPage'
import { GraphPage } from './components/pages/GraphPage'
import { TimelinePage } from './components/pages/TimelinePage'

export function App() {
  return (
    <BrowserRouter>
      <SignedOut>
        <div className="auth-container">
          <h1>Brain Cabinet</h1>
          <p>ログインが必要です</p>
          <SignInButton mode="modal" />
        </div>
      </SignedOut>
      <SignedIn>
        <Routes>
          <Route path="/ui" element={<NotesPage />} />
          <Route path="/ui/" element={<NotesPage />} />
          <Route path="/ui/notes/:id" element={<NoteDetailPage />} />
          <Route path="/ui/reviews" element={<ReviewsPage />} />
          <Route path="/ui/graph" element={<GraphPage />} />
          <Route path="/ui/timeline" element={<TimelinePage />} />
        </Routes>
      </SignedIn>
    </BrowserRouter>
  )
}
