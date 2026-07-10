import type { Faaliyet } from '../types'
import { getAdminAuthHeader } from '../context/AuthContext'

export type SortKey = 'ad' | 'tur' | 'baslangic' | 'bitis' | 'etiket' | 'renk'
export type SortDir = 'asc' | 'desc'

export interface ListSort {
  key: SortKey
  dir: SortDir
}

export interface FaaliyetPayload {
  faaliyetler: Faaliyet[]
  sort: ListSort | null
}

function isSortKey(value: unknown): value is SortKey {
  return (
    value === 'ad' ||
    value === 'tur' ||
    value === 'baslangic' ||
    value === 'bitis' ||
    value === 'etiket' ||
    value === 'renk'
  )
}

function parseSort(value: unknown): ListSort | null {
  if (!value || typeof value !== 'object') return null
  const sort = value as { key?: unknown; dir?: unknown }
  if (!isSortKey(sort.key)) return null
  if (sort.dir !== 'asc' && sort.dir !== 'desc') return null
  return { key: sort.key, dir: sort.dir }
}

export async function fetchFaaliyetler(): Promise<FaaliyetPayload> {
  const res = await fetch('/api/faaliyetler')
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error || `Yukleme hatasi (${res.status})`)
  }
  const data = (await res.json()) as {
    faaliyetler?: Faaliyet[]
    sort?: unknown
  }
  return {
    faaliyetler: Array.isArray(data.faaliyetler) ? data.faaliyetler : [],
    sort: parseSort(data.sort),
  }
}

export async function saveFaaliyetler(
  faaliyetler: Faaliyet[],
  sort: ListSort | null,
): Promise<void> {
  const res = await fetch('/api/faaliyetler', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAdminAuthHeader(),
    },
    body: JSON.stringify({ faaliyetler, sort }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error || `Kaydetme hatasi (${res.status})`)
  }
}

export function compareFaaliyet(
  a: Faaliyet,
  b: Faaliyet,
  key: SortKey,
): number {
  return a[key].localeCompare(b[key], 'tr', {
    sensitivity: 'base',
    numeric: true,
  })
}

export function sortFaaliyetler(
  items: Faaliyet[],
  sort: ListSort | null,
): Faaliyet[] {
  if (!sort) return items
  return [...items].sort((a, b) => {
    const cmp = compareFaaliyet(a, b, sort.key)
    return sort.dir === 'asc' ? cmp : -cmp
  })
}
