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
import {
  fetchFaaliyetler,
  saveFaaliyetler,
  sortFaaliyetler,
  type ListSort,
  type SortDir,
  type SortKey,
} from '../api/faaliyetApi'

interface FaaliyetContextValue {
  faaliyetler: Faaliyet[]
  sort: ListSort | null
  loading: boolean
  saving: boolean
  error: string | null
  setFaaliyetler: (items: Faaliyet[]) => void
  setSort: (sort: ListSort | null) => void
  applySort: (key: SortKey) => void
  restoreSnapshot: (items: Faaliyet[], nextSort: ListSort | null) => void
  updateFaaliyet: (id: string, patch: Partial<Omit<Faaliyet, 'id'>>) => void
  syncTurRenk: (id: string) => void
  addFaaliyet: () => void
  removeFaaliyet: (id: string) => void
}

const FaaliyetContext = createContext<FaaliyetContextValue | null>(null)
const LEGACY_STORAGE_KEY = 'faaliyet-takvimi-v1'

function loadLegacyLocal(): Faaliyet[] | null {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Faaliyet[]
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null
  } catch {
    return null
  }
}

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

export function FaaliyetProvider({
  children,
  canPersist = true,
}: {
  children: ReactNode
  canPersist?: boolean
}) {
  const [faaliyetler, setFaaliyetlerState] = useState<Faaliyet[]>([])
  const [sort, setSortState] = useState<ListSort | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const skipSave = useRef(true)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const canPersistRef = useRef(canPersist)
  canPersistRef.current = canPersist

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        let payload = await fetchFaaliyetler()
        if (cancelled) return

        // Eski localStorage verisini bir kez sunucuya taşı
        if (payload.faaliyetler.length === 0) {
          const legacy = loadLegacyLocal()
          if (legacy) {
            await saveFaaliyetler(legacy, null)
            payload = { faaliyetler: legacy, sort: null }
            localStorage.removeItem(LEGACY_STORAGE_KEY)
          }
        }

        setFaaliyetlerState(
          payload.faaliyetler.length > 0 ? payload.faaliyetler : [emptyRow()],
        )
        setSortState(payload.sort)
        setError(null)
      } catch (err) {
        if (cancelled) return
        setFaaliyetlerState([emptyRow()])
        setSortState(null)
        setError(err instanceof Error ? err.message : 'Veriler yuklenemedi')
      } finally {
        if (!cancelled) {
          setLoading(false)
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
    if (!canPersist || loading || skipSave.current) return

    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      if (!canPersistRef.current) return
      setSaving(true)
      try {
        await saveFaaliyetler(faaliyetler, sort)
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
  }, [faaliyetler, sort, loading, canPersist])

  const setFaaliyetler = useCallback((items: Faaliyet[]) => {
    setFaaliyetlerState(items.length > 0 ? items : [emptyRow()])
  }, [])

  const setSort = useCallback((next: ListSort | null) => {
    setSortState(next)
    if (next) {
      setFaaliyetlerState((items) => sortFaaliyetler(items, next))
    }
  }, [])

  const applySort = useCallback((key: SortKey) => {
    setSortState((prev) => {
      let next: ListSort | null
      if (!prev || prev.key !== key) {
        next = { key, dir: 'asc' }
      } else if (prev.dir === 'asc') {
        next = { key, dir: 'desc' }
      } else {
        next = null
      }

      if (next) {
        setFaaliyetlerState((items) => sortFaaliyetler(items, next))
      }
      return next
    })
  }, [])

  const restoreSnapshot = useCallback(
    (items: Faaliyet[], nextSort: ListSort | null) => {
      setFaaliyetlerState(items.length > 0 ? items : [emptyRow()])
      setSortState(nextSort)
    },
    [],
  )

  const updateFaaliyet = useCallback(
    (id: string, patch: Partial<Omit<Faaliyet, 'id'>>) => {
      setFaaliyetlerState((prev) =>
        prev.map((f) => {
          if (f.id !== id) return f
          const next = { ...f, ...patch }
          if (patch.tur !== undefined && patch.renk === undefined) {
            const map = turRenkHaritasi(prev, id)
            const nkey = normalizeTur(next.tur)
            if (map.has(nkey)) next.renk = map.get(nkey)!
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
      sort,
      loading,
      saving,
      error,
      setFaaliyetler,
      setSort,
      applySort,
      restoreSnapshot,
      updateFaaliyet,
      syncTurRenk,
      addFaaliyet,
      removeFaaliyet,
    }),
    [
      faaliyetler,
      sort,
      loading,
      saving,
      error,
      setFaaliyetler,
      setSort,
      applySort,
      restoreSnapshot,
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

export type { ListSort, SortDir, SortKey }
