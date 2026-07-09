export interface Faaliyet {
  id: string
  ad: string
  tur: string
  baslangic: string // YYYY-MM-DD
  bitis: string // YYYY-MM-DD
  etiket: string
  renk: string
}

export const FAALIYET_RENKLERI = [
  '#c45c26',
  '#2a6f6f',
  '#3d5a80',
  '#8b4513',
  '#5c6b4a',
  '#7a3e5c',
  '#b8860b',
  '#4a5568',
] as const

export const ORNEK_FAALIYETLER: Omit<Faaliyet, 'id'>[] = [
  {
    ad: 'Kış Kampı Hazırlığı',
    tur: 'Hazırlık',
    baslangic: '2026-01-01',
    bitis: '2026-01-12',
    etiket: 'kamp',
    renk: '#c45c26',
  },
  {
    ad: 'Gönüllü Eğitimi',
    tur: 'Eğitim',
    baslangic: '2026-01-03',
    bitis: '2026-01-15',
    etiket: 'eğitim',
    renk: '#2a6f6f',
  },
  {
    ad: 'Saha Ziyaretleri',
    tur: 'Saha',
    baslangic: '2026-01-20',
    bitis: '2026-02-10',
    etiket: 'saha',
    renk: '#3d5a80',
  },
  {
    ad: 'Raporlama Dönemi',
    tur: 'İdari',
    baslangic: '2026-02-01',
    bitis: '2026-02-28',
    etiket: 'rapor',
    renk: '#8b4513',
  },
  {
    ad: 'Bahar Atölyeleri',
    tur: 'Atölye',
    baslangic: '2026-03-05',
    bitis: '2026-03-22',
    etiket: 'atölye',
    renk: '#5c6b4a',
  },
]
