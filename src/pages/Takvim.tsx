import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'
import { Link } from 'react-router-dom'
import type { Faaliyet } from '../types'
import { isFaaliyetValid, useFaaliyetler } from '../context/FaaliyetContext'
import { useViewMode } from '../context/ViewModeContext'
import {
  assignLanes,
  buildHaftalar,
  buildKesintisizHaftalar,
  getAyAraligi,
  HAFTA_GUNLERI,
  maxLaneInWeeks,
  type KesintisizHafta,
  type HaftaSatiri,
} from '../utils/calendar'
import './Takvim.css'

const LANE_H = 22
const LANE_GAP = 3
const STRIP_TOP = 28

const MOBILE_LANE_H = 18
const MOBILE_LANE_GAP = 2
const MOBILE_STRIP_TOP = 22

const LAYOUT_KEY = 'faaliyet-takvimi-calendar-layout'
type CalendarLayout = 'aylik' | 'kesintisiz'

function loadLayout(): CalendarLayout {
  try {
    const saved = localStorage.getItem(LAYOUT_KEY)
    if (saved === 'aylik' || saved === 'kesintisiz') return saved
  } catch {
    /* ignore */
  }
  return 'aylik'
}

function formatTarih(value: string): string {
  try {
    return format(parseISO(value), 'd MMMM yyyy', { locale: tr })
  } catch {
    return value
  }
}

function SeritPopup({
  faaliyet,
  onClose,
}: {
  faaliyet: Faaliyet
  onClose: () => void
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="takvim__popup-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="takvim__popup"
        role="dialog"
        aria-modal="true"
        aria-labelledby="takvim-popup-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="takvim__popup-head">
          <span
            className="takvim__popup-renk"
            style={{ backgroundColor: faaliyet.renk }}
            aria-hidden="true"
          />
          <h2 id="takvim-popup-title">{faaliyet.ad || 'İsimsiz faaliyet'}</h2>
          <button
            type="button"
            className="takvim__popup-close"
            onClick={onClose}
            aria-label="Kapat"
          >
            ×
          </button>
        </div>
        <dl className="takvim__popup-meta">
          <div>
            <dt>Tür</dt>
            <dd>{faaliyet.tur || '—'}</dd>
          </div>
          <div>
            <dt>Başlangıç</dt>
            <dd>{formatTarih(faaliyet.baslangic)}</dd>
          </div>
          <div>
            <dt>Bitiş</dt>
            <dd>{formatTarih(faaliyet.bitis)}</dd>
          </div>
          <div>
            <dt>Etiket</dt>
            <dd>{faaliyet.etiket || '—'}</dd>
          </div>
          <div>
            <dt>Renk</dt>
            <dd>
              <span className="takvim__popup-hex">{faaliyet.renk}</span>
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}

function WeekRows({
  weeks,
  laneH,
  laneGap,
  stripTop,
  isMobile,
  continuous,
  onSeritClick,
}: {
  weeks: Array<HaftaSatiri | KesintisizHafta>
  laneH: number
  laneGap: number
  stripTop: number
  isMobile: boolean
  continuous: boolean
  onSeritClick: (faaliyet: Faaliyet) => void
}) {
  const maxLane = maxLaneInWeeks(weeks)
  const stripAreaH = (maxLane + 1) * (laneH + laneGap) + laneGap

  return (
    <>
      {weeks.map((week, wi) => {
        if (continuous) {
          const cw = week as KesintisizHafta
          if (!cw.days.some((d) => !d.bos)) return null
        } else {
          const aw = week as HaftaSatiri
          if (!aw.days.some((d) => d !== null)) return null
        }

        return (
          <div
            key={wi}
            className="takvim__hafta"
            style={{ minHeight: stripTop + stripAreaH + 8 }}
          >
            <div className="takvim__gunler">
              {continuous
                ? (week as KesintisizHafta).days.map((day, di) => {
                    if (day.bos || !day.date) {
                      return (
                        <div
                          key={di}
                          className="takvim__gun takvim__gun--bos"
                        />
                      )
                    }
                    const tone =
                      day.ayIndex % 2 === 0
                        ? 'takvim__gun--ay-a'
                        : 'takvim__gun--ay-b'
                    return (
                      <div
                        key={di}
                        className={[
                          'takvim__gun',
                          tone,
                          day.ayBaslangici ? 'takvim__gun--ay-baslangic' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        {day.ayBaslangici && day.ayEtiketi ? (
                          <span className="takvim__ay-chip">
                            {day.ayEtiketi}
                          </span>
                        ) : null}
                        <span className="takvim__gun-no">
                          {format(day.date, 'd')}
                        </span>
                      </div>
                    )
                  })
                : (week as HaftaSatiri).days.map((day, di) => (
                    <div
                      key={di}
                      className={
                        day
                          ? 'takvim__gun'
                          : 'takvim__gun takvim__gun--bos'
                      }
                    >
                      {day ? (
                        <span className="takvim__gun-no">
                          {format(day, 'd')}
                        </span>
                      ) : null}
                    </div>
                  ))}
            </div>

            <div
              className="takvim__seritler"
              style={{ top: stripTop, height: stripAreaH }}
            >
              {week.segments.map((seg) => {
                const left = `${(seg.startCol / 7) * 100}%`
                const width = `${(seg.span / 7) * 100}%`
                const top = seg.lane * (laneH + laneGap) + laneGap
                const label = [
                  seg.faaliyet.ad,
                  seg.faaliyet.tur,
                  seg.faaliyet.etiket,
                ]
                  .filter(Boolean)
                  .join(' · ')

                return (
                  <button
                    key={`${seg.faaliyet.id}-${wi}`}
                    type="button"
                    className={[
                      'takvim__serit',
                      seg.isStart ? 'takvim__serit--start' : '',
                      seg.isEnd ? 'takvim__serit--end' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={{
                      left,
                      width,
                      top,
                      height: laneH,
                      backgroundColor: seg.faaliyet.renk,
                    }}
                    title={label}
                    onClick={() => onSeritClick(seg.faaliyet)}
                  >
                    <span className="takvim__serit-text">
                      {isMobile ? seg.faaliyet.ad : label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </>
  )
}

export default function Takvim() {
  const { faaliyetler } = useFaaliyetler()
  const { mode } = useViewMode()
  const [layout, setLayout] = useState<CalendarLayout>(loadLayout)
  const [secili, setSecili] = useState<Faaliyet | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(LAYOUT_KEY, layout)
    } catch {
      /* ignore */
    }
  }, [layout])

  const gecerli = faaliyetler.filter(isFaaliyetValid)
  const aylar = getAyAraligi(gecerli)
  const laneMap = assignLanes(gecerli)
  const isMobile = mode === 'mobile'
  const continuous = layout === 'kesintisiz'

  const laneH = isMobile ? MOBILE_LANE_H : LANE_H
  const laneGap = isMobile ? MOBILE_LANE_GAP : LANE_GAP
  const stripTop = continuous
    ? isMobile
      ? 34
      : 42
    : isMobile
      ? MOBILE_STRIP_TOP
      : STRIP_TOP

  const kesintisizWeeks = continuous
    ? buildKesintisizHaftalar(aylar, gecerli, laneMap)
    : []

  return (
    <div
      className={[
        'takvim',
        isMobile ? 'takvim--mobile' : '',
        continuous ? 'takvim--kesintisiz' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <header className="takvim__header">
        <div>
          <p className="takvim__eyebrow">Faaliyet Takvimi</p>
          <h1>Takvim görünümü</h1>
          <p className="takvim__lead">
            {gecerli.length === 0
              ? 'Henüz geçerli faaliyet yok. Giriş ekranından ekleyin.'
              : continuous
                ? `${gecerli.length} faaliyet · ${aylar.length} ay · aylar kesintisiz akar`
                : `${gecerli.length} faaliyet · ${aylar.length} ay · şeritler örtüşen günlerde üst üste biner`}
          </p>
        </div>
        <div className="takvim__header-actions">
          <div className="takvim__layout" role="group" aria-label="Takvim düzeni">
            <button
              type="button"
              className={
                layout === 'aylik'
                  ? 'takvim__layout-btn takvim__layout-btn--active'
                  : 'takvim__layout-btn'
              }
              onClick={() => setLayout('aylik')}
            >
              Aylık
            </button>
            <button
              type="button"
              className={
                layout === 'kesintisiz'
                  ? 'takvim__layout-btn takvim__layout-btn--active'
                  : 'takvim__layout-btn'
              }
              onClick={() => setLayout('kesintisiz')}
            >
              Kesintisiz
            </button>
          </div>
          <Link to="/" className="btn btn--secondary">
            ← Girişe dön
          </Link>
        </div>
      </header>

      {gecerli.length === 0 ? (
        <div className="takvim__empty">
          <p>Gösterilecek faaliyet bulunamadı.</p>
          <Link to="/" className="btn btn--primary">
            Faaliyet gir
          </Link>
        </div>
      ) : continuous ? (
        <div className="takvim__scroll">
          <div className="takvim__paper takvim__paper--kesintisiz">
            <div className="takvim__gun-basliklari">
              {HAFTA_GUNLERI.map((g) => (
                <div key={g} className="takvim__gun-baslik">
                  {isMobile ? g.slice(0, 1) : g}
                </div>
              ))}
            </div>
            <div className="takvim__haftalar">
              <WeekRows
                weeks={kesintisizWeeks}
                laneH={laneH}
                laneGap={laneGap}
                stripTop={stripTop}
                isMobile={isMobile}
                continuous
                onSeritClick={setSecili}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="takvim__scroll">
          <div className="takvim__paper">
            {aylar.map((ay, ayIndex) => {
              const weeks = buildHaftalar(ay, gecerli, laneMap)

              return (
                <section
                  key={`${ay.year}-${ay.month}`}
                  className={
                    ayIndex % 2 === 0
                      ? 'takvim__ay takvim__ay--light'
                      : 'takvim__ay takvim__ay--dark'
                  }
                >
                  <div className="takvim__ay-baslik">
                    <h2>{ay.label}</h2>
                    <span className="takvim__ay-index">
                      {ayIndex + 1} / {aylar.length}
                    </span>
                  </div>

                  <div className="takvim__gun-basliklari">
                    {HAFTA_GUNLERI.map((g) => (
                      <div key={g} className="takvim__gun-baslik">
                        {isMobile ? g.slice(0, 1) : g}
                      </div>
                    ))}
                  </div>

                  <div className="takvim__haftalar">
                    <WeekRows
                      weeks={weeks}
                      laneH={laneH}
                      laneGap={laneGap}
                      stripTop={stripTop}
                      isMobile={isMobile}
                      continuous={false}
                      onSeritClick={setSecili}
                    />
                  </div>
                </section>
              )
            })}
          </div>
        </div>
      )}

      {secili ? (
        <SeritPopup faaliyet={secili} onClose={() => setSecili(null)} />
      ) : null}
    </div>
  )
}
