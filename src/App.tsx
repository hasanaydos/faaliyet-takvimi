import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { FaaliyetProvider, useFaaliyetler } from './context/FaaliyetContext'
import { ViewModeProvider, useViewMode } from './context/ViewModeContext'
import AdminGate from './components/AdminGate'
import Giris from './pages/Giris'
import Takvim from './pages/Takvim'
import './App.css'

function SyncStatus() {
  const { isAdmin } = useAuth()
  const { loading, saving, error } = useFaaliyetler()
  if (!isAdmin) return null

  let text = 'Hazır'
  if (loading) text = 'Yükleniyor…'
  else if (saving) text = 'Kaydediliyor…'
  else if (error) text = 'Senkron hatası'

  return (
    <span
      className={error ? 'app__sync app__sync--error' : 'app__sync'}
      title={error ?? undefined}
    >
      {text}
    </span>
  )
}

function ViewModeToggle() {
  const { mode, setMode } = useViewMode()

  return (
    <div className="app__mode" role="group" aria-label="Görünüm modu">
      <button
        type="button"
        className={
          mode === 'scroll'
            ? 'app__mode-btn app__mode-btn--active'
            : 'app__mode-btn'
        }
        onClick={() => setMode('scroll')}
      >
        Kaydırmalı
      </button>
      <button
        type="button"
        className={
          mode === 'mobile'
            ? 'app__mode-btn app__mode-btn--active'
            : 'app__mode-btn'
        }
        onClick={() => setMode('mobile')}
      >
        Tam mobil
      </button>
    </div>
  )
}

function AppShell() {
  const { isAdmin } = useAuth()

  return (
    <div className="app">
      <nav className="app__nav">
        <div className="app__nav-top">
          <span className="app__brand">Faaliyet Takvimi</span>
          <div className="app__nav-right">
            <SyncStatus />
            <AdminGate />
            <div className="app__links">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  isActive ? 'app__link app__link--active' : 'app__link'
                }
              >
                Liste
              </NavLink>
              <NavLink
                to="/takvim"
                className={({ isActive }) =>
                  isActive ? 'app__link app__link--active' : 'app__link'
                }
              >
                Takvim
              </NavLink>
            </div>
          </div>
        </div>
        <div className="app__nav-bottom">
          <ViewModeToggle />
          {!isAdmin ? (
            <span className="app__viewer-note">Görüntüleme modu</span>
          ) : null}
        </div>
      </nav>
      <main className="app__main">
        <Routes>
          <Route path="/" element={<Giris />} />
          <Route path="/takvim" element={<Takvim />} />
        </Routes>
      </main>
    </div>
  )
}

function AuthedApp() {
  const { isAdmin } = useAuth()
  return (
    <FaaliyetProvider canPersist={isAdmin}>
      <ViewModeProvider>
        <BrowserRouter>
          <AppShell />
        </BrowserRouter>
      </ViewModeProvider>
    </FaaliyetProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AuthedApp />
    </AuthProvider>
  )
}
