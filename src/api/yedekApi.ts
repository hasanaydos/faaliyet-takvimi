import type { Faaliyet } from '../types'
import type { ListSort } from './faaliyetApi'

export interface YedekMeta {
  id: string
  aciklama: string
  olusturma: string
  adet: number
}

export interface YedekDosyasi {
  version: 1
  id?: string
  aciklama: string
  olusturma: string
  adet?: number
  faaliyetler: Faaliyet[]
  sort: ListSort | null
}

function errorMessage(res: Response, body: { error?: string } | null): string {
  return body?.error || `Islem hatasi (${res.status})`
}

export async function listYedekler(): Promise<YedekMeta[]> {
  const res = await fetch('/api/yedekler')
  const body = (await res.json().catch(() => null)) as {
    yedekler?: YedekMeta[]
    error?: string
  } | null
  if (!res.ok) throw new Error(errorMessage(res, body))
  return Array.isArray(body?.yedekler) ? body.yedekler : []
}

export async function createYedek(input: {
  aciklama: string
  email?: string
  faaliyetler: Faaliyet[]
  sort: ListSort | null
}): Promise<{
  yedek: YedekDosyasi
  email: { sent: boolean; reason?: string | null }
  emailConfigured: boolean
}> {
  const res = await fetch('/api/yedekler', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const body = (await res.json().catch(() => null)) as {
    yedek?: YedekDosyasi
    email?: { sent: boolean; reason?: string | null }
    emailConfigured?: boolean
    error?: string
  } | null
  if (!res.ok) throw new Error(errorMessage(res, body))
  if (!body?.yedek) throw new Error('Yedek olusturulamadi')
  return {
    yedek: body.yedek,
    email: body.email ?? { sent: false },
    emailConfigured: Boolean(body.emailConfigured),
  }
}

export async function fetchYedek(id: string): Promise<YedekDosyasi> {
  const res = await fetch(`/api/yedekler?id=${encodeURIComponent(id)}`)
  const body = (await res.json().catch(() => null)) as {
    yedek?: YedekDosyasi
    error?: string
  } | null
  if (!res.ok) throw new Error(errorMessage(res, body))
  if (!body?.yedek) throw new Error('Yedek bulunamadi')
  return body.yedek
}

export async function restoreYedekById(id: string): Promise<{
  faaliyetler: Faaliyet[]
  sort: ListSort | null
}> {
  const res = await fetch('/api/yedekler', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  })
  const body = (await res.json().catch(() => null)) as {
    faaliyetler?: Faaliyet[]
    sort?: ListSort | null
    error?: string
  } | null
  if (!res.ok) throw new Error(errorMessage(res, body))
  return {
    faaliyetler: Array.isArray(body?.faaliyetler) ? body.faaliyetler : [],
    sort: body?.sort ?? null,
  }
}

export async function restoreYedekFromFile(snapshot: {
  faaliyetler: Faaliyet[]
  sort: ListSort | null
}): Promise<{
  faaliyetler: Faaliyet[]
  sort: ListSort | null
}> {
  const res = await fetch('/api/yedekler', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(snapshot),
  })
  const body = (await res.json().catch(() => null)) as {
    faaliyetler?: Faaliyet[]
    sort?: ListSort | null
    error?: string
  } | null
  if (!res.ok) throw new Error(errorMessage(res, body))
  return {
    faaliyetler: Array.isArray(body?.faaliyetler) ? body.faaliyetler : [],
    sort: body?.sort ?? null,
  }
}

export function downloadYedekDosyasi(yedek: YedekDosyasi): void {
  const payload: YedekDosyasi = {
    version: 1,
    id: yedek.id,
    aciklama: yedek.aciklama,
    olusturma: yedek.olusturma,
    adet: yedek.faaliyetler.length,
    faaliyetler: yedek.faaliyetler,
    sort: yedek.sort,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  })
  const stamp = yedek.olusturma.slice(0, 19).replace(/[:T]/g, '-')
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `faaliyet-yedek-${stamp}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function parseYedekDosyasi(raw: unknown): YedekDosyasi {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Geçersiz yedek dosyası')
  }
  const data = raw as Record<string, unknown>
  if (!Array.isArray(data.faaliyetler)) {
    throw new Error('Yedek dosyasında faaliyet listesi yok')
  }
  for (const item of data.faaliyetler) {
    if (!item || typeof item !== 'object') {
      throw new Error('Yedek dosyası bozuk faaliyet satırı içeriyor')
    }
    const f = item as Record<string, unknown>
    for (const key of ['id', 'ad', 'tur', 'baslangic', 'bitis', 'etiket', 'renk']) {
      if (typeof f[key] !== 'string') {
        throw new Error('Yedek dosyası geçersiz faaliyet alanları içeriyor')
      }
    }
  }
  return {
    version: 1,
    id: typeof data.id === 'string' ? data.id : undefined,
    aciklama: typeof data.aciklama === 'string' ? data.aciklama : 'Dosya yedeği',
    olusturma:
      typeof data.olusturma === 'string'
        ? data.olusturma
        : new Date().toISOString(),
    adet: data.faaliyetler.length,
    faaliyetler: data.faaliyetler as Faaliyet[],
    sort: (data.sort as ListSort | null) ?? null,
  }
}
