import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import './AdminGate.css'

export default function AdminGate() {
  const { isAdmin, login, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin() {
    if (!password.trim()) {
      setError('Şifre girin.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await login(password)
      setPassword('')
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Giriş başarısız')
    } finally {
      setBusy(false)
    }
  }

  if (isAdmin) {
    return (
      <div className="admin-gate">
        <span className="admin-gate__badge">Admin</span>
        <button type="button" className="app__mode-btn" onClick={logout}>
          Çıkış
        </button>
      </div>
    )
  }

  return (
    <>
      <button
        type="button"
        className="app__mode-btn"
        onClick={() => {
          setError(null)
          setPassword('')
          setOpen(true)
        }}
      >
        Admin
      </button>

      {open ? (
        <div
          className="admin-gate__backdrop"
          role="presentation"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="admin-gate__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-login-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-gate__head">
              <h2 id="admin-login-title">Admin girişi</h2>
              <button
                type="button"
                className="admin-gate__close"
                onClick={() => setOpen(false)}
                aria-label="Kapat"
                disabled={busy}
              >
                ×
              </button>
            </div>
            <p className="admin-gate__lead">
              Düzenleme, yedekleme ve kalıcı sıralama için şifre girin.
            </p>
            <label className="admin-gate__field">
              <span>Şifre</span>
              <input
                type="password"
                value={password}
                autoFocus
                disabled={busy}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleLogin()
                }}
              />
            </label>
            {error ? <p className="admin-gate__error">{error}</p> : null}
            <div className="admin-gate__actions">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => setOpen(false)}
                disabled={busy}
              >
                Vazgeç
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => void handleLogin()}
                disabled={busy}
              >
                {busy ? 'Kontrol…' : 'Giriş yap'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
