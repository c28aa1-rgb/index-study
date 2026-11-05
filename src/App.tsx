import { AnimatePresence } from 'framer-motion'
import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Nav } from './components/Nav'
import { Toaster } from './components/Toast'
import Home from './pages/Home'
import Explore from './pages/Explore'
import Editor from './pages/Editor'
import SetView from './pages/SetView'
import Flashcards from './pages/Flashcards'
import { Page, Spinner } from './components/ui'
import { useAuth } from './lib/auth'

const Learn = lazy(() => import('./pages/Learn'))
const Test = lazy(() => import('./pages/Test'))
const Match = lazy(() => import('./pages/Match'))
const Review = lazy(() => import('./pages/Review'))
const Shared = lazy(() => import('./pages/Shared'))
const AuthPage = lazy(() => import('./pages/Auth'))
const Connections = lazy(() => import('./pages/Connections'))
const OAuthConsent = lazy(() => import('./pages/OAuthConsent'))

export default function App() {
  const loc = useLocation()
  const { user, ready } = useAuth()
  if (!ready)
    return (
      <Page>
        <Spinner />
      </Page>
    )
  if (loc.pathname !== '/auth' && !user) {
    return <Navigate to={`/auth?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />
  }
  return (
    <>
      <Nav />
      <Suspense
        fallback={
          <Page>
            <Spinner />
          </Page>
        }
      >
        <AnimatePresence mode="wait" initial={false}>
          <Routes location={loc} key={loc.pathname}>
            <Route path="/" element={<Home />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/create" element={<Editor />} />
            <Route path="/set/:id" element={<SetView />} />
            <Route path="/set/:id/edit" element={<Editor />} />
            <Route path="/set/:id/flashcards" element={<Flashcards />} />
            <Route path="/set/:id/learn" element={<Learn />} />
            <Route path="/set/:id/test" element={<Test />} />
            <Route path="/set/:id/match" element={<Match />} />
            <Route path="/set/:id/review" element={<Review />} />
            <Route path="/shared/:code" element={<Shared />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/connections" element={<Connections />} />
            <Route path="/connect/authorize" element={<OAuthConsent />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </AnimatePresence>
      </Suspense>
      <Toaster />
    </>
  )
}
