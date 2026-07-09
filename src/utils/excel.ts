import * as XLSX from 'xlsx'
import { v4 as uuidv4 } from 'uuid'
import { ORNEK_FAALIYETLER, type Faaliyet } from '../types'
import { parseRenk, renkForTur, turRenkKaydet } from './renk'

export const SABLON_KOLONLARI = [
  'Faaliyet adı',
  'Tür',
  'Başlangıç',
  'Bitiş',
  'Etiket',
  'Renk',
] as const

const HEADER_ALIASES: Record<string, (typeof SABLON_KOLONLARI)[number]> = {
  'faaliyet adı': 'Faaliyet adı',
  'faaliyet adi': 'Faaliyet adı',
  ad: 'Faaliyet adı',
  isim: 'Faaliyet adı',
  name: 'Faaliyet adı',
  tür: 'Tür',
  tur: 'Tür',
  type: 'Tür',
  başlangıç: 'Başlangıç',
  baslangic: 'Başlangıç',
  start: 'Başlangıç',
  'start date': 'Başlangıç',
  bitiş: 'Bitiş',
  bitis: 'Bitiş',
  end: 'Bitiş',
  'end date': 'Bitiş',
  etiket: 'Etiket',
  tag: 'Etiket',
  label: 'Etiket',
  renk: 'Renk',
  color: 'Renk',
  colour: 'Renk',
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('tr')
    .replace(/\s+/g, ' ')
}

function excelSerialToDate(serial: number): Date | null {
  if (!Number.isFinite(serial)) return null
  // Excel epoch: 1899-12-30 (with Lotus 1900 leap-year bug)
  const utc = Math.round((serial - 25569) * 86400 * 1000)
  const d = new Date(utc)
  return Number.isNaN(d.getTime()) ? null : d
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** Excel hücre değerini YYYY-MM-DD'ye çevirir */
export function parseExcelDate(value: unknown): string | null {
  if (value == null || value === '') return null

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toIsoDate(value)
  }

  if (typeof value === 'number') {
    const d = excelSerialToDate(value)
    return d ? toIsoDate(d) : null
  }

  const raw = String(value).trim()
  if (!raw) return null

  // YYYY-MM-DD veya YYYY/MM/DD
  const iso = raw.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/)
  if (iso) {
    return `${iso[1]}-${pad2(Number(iso[2]))}-${pad2(Number(iso[3]))}`
  }

  // DD.MM.YYYY / DD/MM/YYYY / DD-MM-YYYY
  const tr = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/)
  if (tr) {
    return `${tr[3]}-${pad2(Number(tr[2]))}-${pad2(Number(tr[1]))}`
  }

  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) return toIsoDate(parsed)

  return null
}

function cell(row: Record<string, unknown>, key: string): unknown {
  return row[key]
}

export function downloadSablon(): void {
  const ornekSatirlar = ORNEK_FAALIYETLER.map((f) => ({
    'Faaliyet adı': f.ad,
    Tür: f.tur,
    Başlangıç: f.baslangic,
    Bitiş: f.bitis,
    Etiket: f.etiket,
    Renk: f.renk,
  }))

  const bosSatir = {
    'Faaliyet adı': '',
    Tür: '',
    Başlangıç: '',
    Bitiş: '',
    Etiket: '',
    Renk: '',
  }

  const ws = XLSX.utils.json_to_sheet(
    ornekSatirlar.length > 0 ? ornekSatirlar : [bosSatir],
    { header: [...SABLON_KOLONLARI] },
  )

  ws['!cols'] = [
    { wch: 28 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 10 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Faaliyetler')
  XLSX.writeFile(wb, 'faaliyet-yukleme-sablonu.xlsx')
}

export interface ExcelParseResult {
  faaliyetler: Faaliyet[]
  skipped: number
}

export function parseFaaliyetExcel(data: ArrayBuffer): ExcelParseResult {
  const wb = XLSX.read(data, { type: 'array', cellDates: true })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) throw new Error('Excel dosyasında sayfa bulunamadı.')

  const ws = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: '',
    raw: true,
  })

  if (rows.length === 0) {
    throw new Error('Excel dosyası boş görünüyor.')
  }

  const firstRow = rows[0]
  const keyMap = new Map<string, string>()
  for (const originalKey of Object.keys(firstRow)) {
    const normalized = normalizeHeader(originalKey)
    const canonical = HEADER_ALIASES[normalized]
    if (canonical) keyMap.set(canonical, originalKey)
  }

  const required: (typeof SABLON_KOLONLARI)[number][] = [
    'Faaliyet adı',
    'Başlangıç',
    'Bitiş',
  ]
  const missing = required.filter((k) => !keyMap.has(k))
  if (missing.length > 0) {
    throw new Error(
      `Eksik sütun(lar): ${missing.join(', ')}. Şablonu indirip kullanın.`,
    )
  }

  const faaliyetler: Faaliyet[] = []
  let skipped = 0
  const turRenkMap = new Map<string, string>()

  for (const row of rows) {
    const ad = String(cell(row, keyMap.get('Faaliyet adı')!) ?? '').trim()
    if (!ad) {
      skipped += 1
      continue
    }

    const baslangic = parseExcelDate(cell(row, keyMap.get('Başlangıç')!))
    const bitis = parseExcelDate(cell(row, keyMap.get('Bitiş')!))

    if (!baslangic || !bitis) {
      skipped += 1
      continue
    }

    const turKey = keyMap.get('Tür')
    const etiketKey = keyMap.get('Etiket')
    const renkKey = keyMap.get('Renk')
    const tur = turKey ? String(cell(row, turKey) ?? '').trim() : ''
    const verilenRenk = renkKey ? parseRenk(cell(row, renkKey)) : null

    let renk: string
    if (verilenRenk) {
      renk = verilenRenk
      turRenkKaydet(turRenkMap, tur, renk)
    } else {
      const mevcut = [...turRenkMap.entries()].map(([t, r]) => ({
        tur: t,
        renk: r,
      }))
      renk = renkForTur(tur, mevcut)
      turRenkKaydet(turRenkMap, tur, renk)
    }

    faaliyetler.push({
      id: uuidv4(),
      ad,
      tur,
      baslangic,
      bitis: bitis < baslangic ? baslangic : bitis,
      etiket: etiketKey ? String(cell(row, etiketKey) ?? '').trim() : '',
      renk,
    })
  }

  if (faaliyetler.length === 0) {
    throw new Error(
      'Geçerli faaliyet satırı bulunamadı. Ad ve tarihleri kontrol edin.',
    )
  }

  return { faaliyetler, skipped }
}
