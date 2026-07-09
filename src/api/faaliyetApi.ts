import type { Faaliyet } from '../types'

export async function fetchFaaliyetler(): Promise<Faaliyet[]> {
  const res = await fetch('/api/faaliyetler')
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error || `Yukleme hatasi (${res.status})`)
  }
  const data = (await res.json()) as { faaliyetler?: Faaliyet[] }
  return Array.isArray(data.faaliyetler) ? data.faaliyetler : []
}

export async function saveFaaliyetler(faaliyetler: Faaliyet[]): Promise<void> {
  const res = await fetch('/api/faaliyetler', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ faaliyetler }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error || `Kaydetme hatasi (${res.status})`)
  }
}
