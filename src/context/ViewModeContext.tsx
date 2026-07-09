import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type ViewMode = 'scroll' | 'mobile'

const STORAGE_KEY = 'faaliyet-takvimi-view-mode'

interface ViewModeContextValue {
  mode: ViewMode
  setMode: (mode: ViewMode) => void
}

const ViewModeContext = createContext<ViewModeContextValue | null>(null)

function detectDefault(): ViewMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'scroll' || saved === 'mobile') return saved
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches) {
    return 'mobile'
  }
  return 'scroll'
}

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ViewMode>(detectDefault)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      /* ignore */
    }
    document.documentElement.dataset.viewMode = mode
  }, [mode])

  const setMode = useCallback((next: ViewMode) => setModeState(next), [])

  const value = useMemo(() => ({ mode, setMode }), [mode, setMode])

  return (
    <ViewModeContext.Provider value={value}>{children}</ViewModeContext.Provider>
  )
}

export function useViewMode() {
  const ctx = useContext(ViewModeContext)
  if (!ctx) throw new Error('useViewMode ViewModeProvider içinde kullanılmalı')
  return ctx
}
