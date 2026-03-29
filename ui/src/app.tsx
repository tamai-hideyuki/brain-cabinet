import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { SignedIn, SignedOut, SignInButton, useAuth } from '@clerk/clerk-react'
import { setTokenGetter } from './api/client'
import { NotesPage } from './components/pages/NotesPage'
import { NoteDetailPage } from './components/pages/NoteDetailPage'
import { ReviewsPage } from './components/pages/ReviewsPage'
import { GraphPage } from './components/pages/GraphPage'
import { TimelinePage } from './components/pages/TimelinePage'
import { ClusterEvolutionPage } from './components/pages/ClusterEvolutionPage'
import { DashboardPage } from './components/pages/DashboardPage'
import { BookmarkPage } from './components/pages/BookmarkPage'
import { SecretBoxPage } from './components/pages/SecretBoxPage'
import { SystemPage } from './components/pages/SystemPage'
import { IsolationPage } from './components/pages/IsolationPage'
import { LibraryPage } from './components/pages/LibraryPage'
import { Timeline3DPage } from './components/pages/Timeline3DPage'
import { TrashPage } from './components/pages/TrashPage'
import { ThinkingReportPage } from './components/pages/ThinkingReportPage'

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth()

  useEffect(() => {
    setTokenGetter(getToken)
  }, [getToken])

  return <>{children}</>
}

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
        <AuthInitializer>
          <Routes>
            <Route path="/ui" element={<DashboardPage />} />
            <Route path="/ui/" element={<DashboardPage />} />
            <Route path="/ui/notes" element={<NotesPage />} />
            <Route path="/ui/notes/:id" element={<NoteDetailPage />} />
            <Route path="/ui/reviews" element={<ReviewsPage />} />
            <Route path="/ui/graph" element={<GraphPage />} />
            <Route path="/ui/timeline" element={<TimelinePage />} />
            <Route path="/ui/evolution" element={<ClusterEvolutionPage />} />
            <Route path="/ui/bookmarks" element={<BookmarkPage />} />
            <Route path="/ui/secret-box" element={<SecretBoxPage />} />
            <Route path="/ui/system" element={<SystemPage />} />
            <Route path="/ui/isolation" element={<IsolationPage />} />
            <Route path="/ui/library" element={<LibraryPage />} />
            <Route path="/ui/timeline-3d" element={<Timeline3DPage />} />
            <Route path="/ui/trash" element={<TrashPage />} />
            <Route path="/ui/thinking-report" element={<ThinkingReportPage />} />
          </Routes>
        </AuthInitializer>
      </SignedIn>
    </BrowserRouter>
  )
}
