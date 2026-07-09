import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { Faaliyet } from '../types'
import { renkForTur, turRenkHaritasi, normalizeTur } from '../utils/renk'
import { fetchFaaliyetler, saveFaaliyetler } from '../api/faaliyetApi'

interface FaaliyetContextValue {
  faaliyetler: Faaliyet[]
  loading: boolean
  saving: boolean
  error: string | null
  setFaaliyetler: (items: Faaliyet[]) => void
  updateFaaliyet: (id: string, patch: Partial<Omit<Faaliyet, 'id'>>) => void
  syncTurRenk: (id: string) => void
  addFaaliyet: () => void
  removeFaaliyet: (id: string) => void
}

const FaaliyetContext = createContext<FaaliyetContextValue | null>(null)

function emptyRow(mevcut: Faaliyet[] = []): Faaliyet {
  const today = new Date().toISOString().slice(0, 10)
  return {
    id: uuidv4(),
    ad: '',
    tur: '',
    baslangic: today,
    bitis: today,
    etiket: '',
    renk: renkForTur('', mevcut),
  }
}

export function FaaliyetProvider({ children }: { children: ReactNode }) {
  const [faaliyetler, setFaaliyetlerState] = useState<Faaliyet[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const skipSave = useRef(true)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const items = await fetchFaaliyetler()
        if (cancelled) return
        setFaaliyetlerState(items.length > 0 ? items : [emptyRow()])
        setError(null)
      } catch (err) {
        if (cancelled) return
        setFaaliyetlerState([emptyRow()])
        setError(err instanceof Error ? err.message : 'Veriler yuklenemedi')
      } finally {
        if (!cancelled) {
          setLoading(false)
          // İlk yüklemeden sonra kaydı aç
          setTimeout(() => {
            skipSave.current = false
          }, 0)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (loading || skipSave.current) return

    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      try {
        await saveFaaliyetler(faaliyetler)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Kaydetme basarisiz')
      } finally {
        setSaving(false)
      }
    }, 500)

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [faaliyetler, loading])

  const setFaaliyetler = useCallback((items: Faaliyet[]) => {
    setFaaliyetlerState(items.length > 0 ? items : [emptyRow()])
  }, [])

  const updateFaaliyet = useCallback(
    (id: string, patch: Partial<Omit<Faaliyet, 'id'>>) => {
      setFaaliyetlerState((prev) =>
        prev.map((f) => {
          if (f.id !== id) return f
          const next = { ...f, ...patch }
          if (patch.tur !== undefined && patch.renk === undefined) {
            const map = turRenkHaritasi(prev, id)
            const key = normalizeTur(next.tur)
            if (map.has(key)) next.renk = map.get(key)!
          }
          return next
        }),
      )
    },
    [],
  )

  const syncTurRenk = useCallback((id: string) => {
    setFaaliyetlerState((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f
        return { ...f, renk: renkForTur(f.tur, prev, id) }
      }),
    )
  }, [])

  const addFaaliyet = useCallback(() => {
    setFaaliyetlerState((prev) => [...prev, emptyRow(prev)])
  }, [])

  const removeFaaliyet = useCallback((id: string) => {
    setFaaliyetlerState((prev) => {
      const next = prev.filter((f) => f.id !== id)
      return next.length > 0 ? next : [emptyRow()]
    })
  }, [])

  const value = useMemo(
    () => ({
      faaliyetler,
      loading,
      saving,
      error,
      setFaaliyetler,
      updateFaaliyet,
      syncTurRenk,
      addFaaliyet,
      removeFaaliyet,
    }),
    [
      faaliyetler,
      loading,
      saving,
      error,
      setFaaliyetler,
      updateFaaliyet,
      syncTurRenk,
      addFaaliyet,
      removeFaaliyet,
    ],
  )

  return (
    <FaaliyetContext.Provider value={value}>{children}</FaaliyetContext.Provider>
  )
}

export function useFaaliyetler() {
  const ctx = useContext(FaaliyetContext)
  if (!ctx) throw new Error('useFaaliyetler FaaliyetProvider içinde kullanılmalı')
  return ctx
}

export function isFaaliyetValid(f: Faaliyet): boolean {
  return (
    f.ad.trim().length > 0 &&
    f.baslangic.length > 0 &&
    f.bitis.length > 0 &&
    f.baslangic <= f.bitis
  )
}
