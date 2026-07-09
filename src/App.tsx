import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import { FaaliyetProvider, useFaaliyetler } from './context/FaaliyetContext'
import Giris from './pages/Giris'
import Takvim from './pages/Takvim'
import './App.css'

function SyncStatus() {
  const { loading, saving, error } = useFaaliyetler()
  let text = 'Hazır'
  if (loading) text = 'Yükleniyor…'
  else if (saving) text = 'Kaydediliyor…'
  else if (error) text = 'Senkron hatası'

  return (
    <span
      className={
        error ? 'app__sync app__sync--error' : 'app__sync'
      }
      title={error ?? undefined}
    >
      {text}
    </span>
  )
}

export default function App() {
  return (
    <FaaliyetProvider>
      <BrowserRouter>
        <div className="app">
          <nav className="app__nav">
            <span className="app__brand">Faaliyet Takvimi</span>
            <div className="app__nav-right">
              <SyncStatus />
              <div className="app__links">
                <NavLink
                  to="/"
                  end
                  className={({ isActive }) =>
                    isActive ? 'app__link app__link--active' : 'app__link'
                  }
                >
                  Giriş
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
          </nav>
          <main className="app__main">
            <Routes>
              <Route path="/" element={<Giris />} />
              <Route path="/takvim" element={<Takvim />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </FaaliyetProvider>
  )
}
