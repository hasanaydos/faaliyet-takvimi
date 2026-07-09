import { FAALIYET_RENKLERI } from '../types'

function normalizeHex(value: string): string {
  const raw = value.trim()
  if (!raw) return ''
  const hex = raw.startsWith('#') ? raw : `#${raw}`
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return hex.toLowerCase()
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    const [, r, g, b] = hex
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  return ''
}

export function normalizeTur(tur: string): string {
  return tur.trim().toLocaleLowerCase('tr')
}

/** Geçerli hex ise normalize eder; değilse null */
export function parseRenk(value: unknown): string | null {
  if (value == null) return null
  const normalized = normalizeHex(String(value))
  return normalized || null
}

/**
 * Türlere atanmış renkler dışındaki paletten rastgele seçer.
 * Hepsi kullanıldıysa paletten yine rastgele verir.
 */
export function rastgeleKullanilmayanRenk(kullanilan: Iterable<string>): string {
  const used = new Set(
    [...kullanilan]
      .map((c) => normalizeHex(c))
      .filter(Boolean),
  )

  const uygun = FAALIYET_RENKLERI.filter((r) => !used.has(r.toLowerCase()))
  const havuz = uygun.length > 0 ? uygun : [...FAALIYET_RENKLERI]
  return havuz[Math.floor(Math.random() * havuz.length)]
}

export type TurRenkKayit = {
  id?: string
  tur: string
  renk: string
}

/** Mevcut faaliyetlerden tür → renk eşlemesi (ilk görülen kazanır) */
export function turRenkHaritasi(
  mevcut: TurRenkKayit[],
  excludeId?: string,
): Map<string, string> {
  const map = new Map<string, string>()
  for (const f of mevcut) {
    if (excludeId && f.id === excludeId) continue
    const key = normalizeTur(f.tur)
    const renk = normalizeHex(f.renk)
    if (!renk || map.has(key)) continue
    map.set(key, renk)
  }
  return map
}

/**
 * Otomatik renk: aynı tür aynı rengi alır; yeni tür için
 * diğer türlerde kullanılmayan bir renk seçilir.
 */
export function renkForTur(
  tur: string,
  mevcut: TurRenkKayit[],
  excludeId?: string,
): string {
  const key = normalizeTur(tur)
  const map = turRenkHaritasi(mevcut, excludeId)

  if (map.has(key)) return map.get(key)!

  return rastgeleKullanilmayanRenk(map.values())
}

/** Haritaya tür→renk kaydı ekler (tür boşsa yine kaydeder) */
export function turRenkKaydet(
  map: Map<string, string>,
  tur: string,
  renk: string,
): void {
  const key = normalizeTur(tur)
  const hex = normalizeHex(renk)
  if (!hex) return
  if (!map.has(key)) map.set(key, hex)
}
