import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import { FaaliyetProvider } from './context/FaaliyetContext'
import Giris from './pages/Giris'
import Takvim from './pages/Takvim'
import './App.css'

export default function App() {
  return (
    <FaaliyetProvider>
      <BrowserRouter>
        <div className="app">
          <nav className="app__nav">
            <span className="app__brand">Faaliyet Takvimi</span>
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
