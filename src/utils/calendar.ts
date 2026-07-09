import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isWithinInterval,
  max,
  min,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { tr } from 'date-fns/locale'
import type { Faaliyet } from '../types'

export interface AyAraligi {
  year: number
  month: number // 0-11
  label: string
  start: Date
  end: Date
}

export interface SeritSegment {
  faaliyet: Faaliyet
  lane: number
  startCol: number // 0-6 (Pazar=0 ... Cumartesi=6) — Pazartesi başlangıç için 0=Pzt
  span: number
  isStart: boolean
  isEnd: boolean
}

export interface HaftaSatiri {
  days: (Date | null)[]
  segments: SeritSegment[]
}

/** Faaliyetlerin kapsadığı ayları (ilk → son) üretir */
export function getAyAraligi(faaliyetler: Faaliyet[]): AyAraligi[] {
  if (faaliyetler.length === 0) return []

  const starts = faaliyetler.map((f) => parseISO(f.baslangic))
  const ends = faaliyetler.map((f) => parseISO(f.bitis))
  const first = startOfMonth(min(starts))
  const last = startOfMonth(max(ends))

  const aylar: AyAraligi[] = []
  let cursor = first
  while (cursor <= last) {
    aylar.push({
      year: cursor.getFullYear(),
      month: cursor.getMonth(),
      label: format(cursor, 'MMMM yyyy', { locale: tr }),
      start: startOfMonth(cursor),
      end: endOfMonth(cursor),
    })
    cursor = addMonths(cursor, 1)
  }
  return aylar
}

function overlapsDay(faaliyet: Faaliyet, day: Date): boolean {
  const start = parseISO(faaliyet.baslangic)
  const end = parseISO(faaliyet.bitis)
  return isWithinInterval(day, { start, end })
}

/** Aynı anda örtüşen faaliyetlere şerit şeridi (lane) ata */
export function assignLanes(faaliyetler: Faaliyet[]): Map<string, number> {
  const sorted = [...faaliyetler].sort((a, b) => {
    const d = a.baslangic.localeCompare(b.baslangic)
    if (d !== 0) return d
    return b.bitis.localeCompare(a.bitis)
  })

  const laneEnds: string[] = [] // her lane'in bitiş tarihi
  const map = new Map<string, number>()

  for (const f of sorted) {
    let lane = laneEnds.findIndex((end) => end < f.baslangic)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(f.bitis)
    } else {
      laneEnds[lane] = f.bitis
    }
    map.set(f.id, lane)
  }
  return map
}

export function buildHaftalar(
  ay: AyAraligi,
  faaliyetler: Faaliyet[],
  laneMap: Map<string, number>,
): HaftaSatiri[] {
  const monthStart = ay.start
  const monthEnd = ay.end
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd })

  const weeks: HaftaSatiri[] = []
  for (let i = 0; i < allDays.length; i += 7) {
    const weekDays = allDays.slice(i, i + 7)
    const days: (Date | null)[] = weekDays.map((d) =>
      d.getMonth() === ay.month ? d : null,
    )

    const relevant = faaliyetler.filter((f) => {
      const fStart = parseISO(f.baslangic)
      const fEnd = parseISO(f.bitis)
      return fStart <= weekDays[6] && fEnd >= weekDays[0]
    })

    const segments: SeritSegment[] = []

    for (const f of relevant) {
      const fStart = parseISO(f.baslangic)
      const fEnd = parseISO(f.bitis)
      let startCol = -1
      let endCol = -1

      for (let c = 0; c < 7; c++) {
        const day = weekDays[c]
        if (day.getMonth() !== ay.month) continue
        if (overlapsDay(f, day)) {
          if (startCol === -1) startCol = c
          endCol = c
        }
      }

      if (startCol === -1) continue

      const segStart = weekDays[startCol]
      const segEnd = weekDays[endCol]

      segments.push({
        faaliyet: f,
        lane: laneMap.get(f.id) ?? 0,
        startCol,
        span: endCol - startCol + 1,
        isStart: fStart >= segStart && fStart <= segEnd,
        isEnd: fEnd >= segStart && fEnd <= segEnd,
      })
    }

    weeks.push({ days, segments })
  }

  return weeks
}

export function maxLaneInWeeks(weeks: HaftaSatiri[]): number {
  let maxL = 0
  for (const w of weeks) {
    for (const s of w.segments) {
      if (s.lane > maxL) maxL = s.lane
    }
  }
  return maxL
}

export const HAFTA_GUNLERI = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
