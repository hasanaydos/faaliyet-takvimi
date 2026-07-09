import { format } from 'date-fns'
import { Link } from 'react-router-dom'
import { isFaaliyetValid, useFaaliyetler } from '../context/FaaliyetContext'
import { useViewMode } from '../context/ViewModeContext'
import {
  assignLanes,
  buildHaftalar,
  getAyAraligi,
  HAFTA_GUNLERI,
  maxLaneInWeeks,
} from '../utils/calendar'
import './Takvim.css'

const LANE_H = 22
const LANE_GAP = 3
const STRIP_TOP = 28

const MOBILE_LANE_H = 18
const MOBILE_LANE_GAP = 2
const MOBILE_STRIP_TOP = 22

export default function Takvim() {
  const { faaliyetler } = useFaaliyetler()
  const { mode } = useViewMode()
  const gecerli = faaliyetler.filter(isFaaliyetValid)
  const aylar = getAyAraligi(gecerli)
  const laneMap = assignLanes(gecerli)
  const isMobile = mode === 'mobile'

  const laneH = isMobile ? MOBILE_LANE_H : LANE_H
  const laneGap = isMobile ? MOBILE_LANE_GAP : LANE_GAP
  const stripTop = isMobile ? MOBILE_STRIP_TOP : STRIP_TOP

  return (
    <div className={isMobile ? 'takvim takvim--mobile' : 'takvim'}>
      <header className="takvim__header">
        <div>
          <p className="takvim__eyebrow">Faaliyet Takvimi</p>
          <h1>Takvim görünümü</h1>
          <p className="takvim__lead">
            {gecerli.length === 0
              ? 'Henüz geçerli faaliyet yok. Giriş ekranından ekleyin.'
              : `${gecerli.length} faaliyet · ${aylar.length} ay · şeritler örtüşen günlerde üst üste biner`}
          </p>
        </div>
        <Link to="/" className="btn btn--secondary">
          ← Girişe dön
        </Link>
      </header>

      {gecerli.length === 0 ? (
        <div className="takvim__empty">
          <p>Gösterilecek faaliyet bulunamadı.</p>
          <Link to="/" className="btn btn--primary">
            Faaliyet gir
          </Link>
        </div>
      ) : (
        <div className="takvim__scroll">
          <div className="takvim__paper">
            {aylar.map((ay, ayIndex) => {
              const weeks = buildHaftalar(ay, gecerli, laneMap)
              const maxLane = maxLaneInWeeks(weeks)
              const stripAreaH =
                (maxLane + 1) * (laneH + laneGap) + laneGap

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
                    {weeks.map((week, wi) => {
                      const hasDays = week.days.some((d) => d !== null)
                      if (!hasDays) return null

                      return (
                        <div
                          key={wi}
                          className="takvim__hafta"
                          style={{
                            minHeight: stripTop + stripAreaH + 8,
                          }}
                        >
                          <div className="takvim__gunler">
                            {week.days.map((day, di) => (
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
                              const top =
                                seg.lane * (laneH + laneGap) + laneGap
                              const label = [
                                seg.faaliyet.ad,
                                seg.faaliyet.tur,
                                seg.faaliyet.etiket,
                              ]
                                .filter(Boolean)
                                .join(' · ')

                              return (
                                <div
                                  key={`${seg.faaliyet.id}-${wi}`}
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
                                >
                                  <span className="takvim__serit-text">
                                    {isMobile ? seg.faaliyet.ad : label}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
