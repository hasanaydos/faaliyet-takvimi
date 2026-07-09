import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { Faaliyet } from '../types'
import { renkForTur, turRenkHaritasi, normalizeTur } from '../utils/renk'

const STORAGE_KEY = 'faaliyet-takvimi-v1'

interface FaaliyetContextValue {
  faaliyetler: Faaliyet[]
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

function loadFromStorage(): Faaliyet[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return [emptyRow()]
    const parsed = JSON.parse(raw) as Faaliyet[]
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [emptyRow()]
  } catch {
    return [emptyRow()]
  }
}

export function FaaliyetProvider({ children }: { children: ReactNode }) {
  const [faaliyetler, setFaaliyetlerState] = useState<Faaliyet[]>(loadFromStorage)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(faaliyetler))
  }, [faaliyetler])

  const setFaaliyetler = useCallback((items: Faaliyet[]) => {
    setFaaliyetlerState(
      items.length > 0 ? items : [emptyRow()],
    )
  }, [])

  const updateFaaliyet = useCallback(
    (id: string, patch: Partial<Omit<Faaliyet, 'id'>>) => {
      setFaaliyetlerState((prev) =>
        prev.map((f) => {
          if (f.id !== id) return f
          const next = { ...f, ...patch }
          // Tür yazılırken: yalnızca mevcut bir türe denk gelirse rengini al
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
      setFaaliyetler,
      updateFaaliyet,
      syncTurRenk,
      addFaaliyet,
      removeFaaliyet,
    }),
    [
      faaliyetler,
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
