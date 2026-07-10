import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Faaliyet } from '../types'
import { FAALIYET_RENKLERI } from '../types'
import { useAuth } from '../context/AuthContext'
import {
  useFaaliyetler,
  type ListSort,
  type SortDir,
  type SortKey,
} from '../context/FaaliyetContext'
import { useViewMode } from '../context/ViewModeContext'
import { sortFaaliyetler } from '../api/faaliyetApi'
import YedekPanel from '../components/YedekPanel'
import { downloadSablon, parseFaaliyetExcel } from '../utils/excel'
import './Giris.css'

const SORT_COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'ad', label: 'Faaliyet adı' },
  { key: 'tur', label: 'Tür' },
  { key: 'baslangic', label: 'Başlangıç' },
  { key: 'bitis', label: 'Bitiş' },
  { key: 'etiket', label: 'Etiket' },
  { key: 'renk', label: 'Renk' },
]

function SortHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string
  active: boolean
  dir: SortDir | null
  onClick: () => void
}) {
  const marker = !active ? '↕' : dir === 'asc' ? '↑' : '↓'
  return (
    <th
      className={active ? 'giris__th--sorted' : undefined}
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button type="button" className="giris__sort-btn" onClick={onClick}>
        <span>{label}</span>
        <span
          className={
            active ? 'giris__sort-icon giris__sort-icon--active' : 'giris__sort-icon'
          }
          aria-hidden="true"
        >
          {marker}
        </span>
      </button>
    </th>
  )
}

function RenkPicker({
  f,
  onUpdate,
  readOnly,
}: {
  f: Faaliyet
  onUpdate: (id: string, patch: Partial<Omit<Faaliyet, 'id'>>) => void
  readOnly?: boolean
}) {
  return (
    <div className="giris__renk">
      <input
        type="color"
        value={f.renk}
        disabled={readOnly}
        onChange={(e) => onUpdate(f.id, { renk: e.target.value })}
        aria-label="Renk seç"
      />
      {!readOnly ? (
        <div className="giris__renk-swatches">
          {FAALIYET_RENKLERI.map((r) => (
            <button
              key={r}
              type="button"
              className={
                f.renk === r ? 'giris__swatch giris__swatch--active' : 'giris__swatch'
              }
              style={{ background: r }}
              onClick={() => onUpdate(f.id, { renk: r })}
              aria-label={`Renk ${r}`}
            />
          ))}
        </div>
      ) : (
        <span className="giris__renk-hex">{f.renk}</span>
      )}
    </div>
  )
}

function cellClass(active: boolean): string | undefined {
  return active ? 'giris__td--sorted' : undefined
}

function nextLocalSort(prev: ListSort | null, key: SortKey): ListSort | null {
  if (!prev || prev.key !== key) return { key, dir: 'asc' }
  if (prev.dir === 'asc') return { key, dir: 'desc' }
  return null
}

export default function Giris() {
  const { isAdmin } = useAuth()
  const {
    faaliyetler,
    sort,
    setFaaliyetler,
    setSort,
    applySort,
    updateFaaliyet,
    syncTurRenk,
    addFaaliyet,
    removeFaaliyet,
  } = useFaaliyetler()
  const { mode } = useViewMode()

  const fileRef = useRef<HTMLInputElement>(null)
  const [yukleniyor, setYukleniyor] = useState(false)
  const [mesaj, setMesaj] = useState<{ tip: 'ok' | 'hata'; metin: string } | null>(
    null,
  )
  const [localSort, setLocalSort] = useState<ListSort | null>(null)

  const activeSort = isAdmin ? sort : localSort
  const sortKey = activeSort?.key ?? null
  const sortDir = activeSort?.dir ?? null

  const gorunenFaaliyetler = useMemo(() => {
    if (isAdmin) return faaliyetler
    return sortFaaliyetler(faaliyetler, localSort)
  }, [faaliyetler, isAdmin, localSort])

  function handleSortClick(key: SortKey) {
    if (isAdmin) {
      applySort(key)
      return
    }
    setLocalSort((prev) => nextLocalSort(prev, key))
  }

  function handleMobileSortChange(value: string) {
    if (!value) {
      if (isAdmin) setSort(null)
      else setLocalSort(null)
      return
    }
    const [key, dir] = value.split(':') as [SortKey, SortDir]
    if (isAdmin) setSort({ key, dir })
    else setLocalSort({ key, dir })
  }

  async function handleHizliYukle(file: File | undefined) {
    if (!isAdmin || !file) return
    setYukleniyor(true)
    setMesaj(null)

    try {
      const buffer = await file.arrayBuffer()
      const { faaliyetler: parsed, skipped } = parseFaaliyetExcel(buffer)
      setFaaliyetler(parsed)
      setSort(null)

      const skipNotu =
        skipped > 0 ? ` (${skipped} boş/geçersiz satır atlandı)` : ''
      setMesaj({
        tip: 'ok',
        metin: `${parsed.length} faaliyet yüklendi${skipNotu}.`,
      })
    } catch (err) {
      setMesaj({
        tip: 'hata',
        metin:
          err instanceof Error
            ? err.message
            : 'Dosya okunamadı. Şablonu kullanıp tekrar deneyin.',
      })
    } finally {
      setYukleniyor(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div
      className={[
        'giris',
        mode === 'mobile' ? 'giris--mobile' : '',
        !isAdmin ? 'giris--readonly' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <header className="giris__header">
        <div>
          <p className="giris__eyebrow">Faaliyet Takvimi</p>
          <h1>{isAdmin ? 'Faaliyetleri gir' : 'Faaliyet listesi'}</h1>
          <p className="giris__lead">
            {isAdmin
              ? 'Her satır bir faaliyet. Ad, tür, tarih aralığı, etiket ve renk girin; takvim ekranı bu verilere göre ayları ve şeritleri üretir. Excel şablonuyla da toplu yükleyebilirsiniz.'
              : 'Listeyi inceleyebilir, sütunlara göre geçici sıralama yapabilirsiniz. Değişiklikler kaydedilmez; sayfa yenilenince adminin son hali gelir.'}
          </p>
        </div>
        <div className="giris__actions">
          {isAdmin ? (
            <>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={downloadSablon}
              >
                Hızlı yükleme şablonu
              </button>
              <button
                type="button"
                className="btn btn--secondary"
                disabled={yukleniyor}
                onClick={() => fileRef.current?.click()}
              >
                {yukleniyor ? 'Yükleniyor…' : 'Hızlı yükle'}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="giris__file-input"
                onChange={(e) => handleHizliYukle(e.target.files?.[0])}
              />
            </>
          ) : null}
          <Link to="/takvim" className="btn btn--primary">
            Takvimi gör
          </Link>
        </div>
      </header>

      {mesaj ? (
        <p
          className={
            mesaj.tip === 'ok'
              ? 'giris__mesaj giris__mesaj--ok'
              : 'giris__mesaj giris__mesaj--hata'
          }
          role="status"
        >
          {mesaj.metin}
        </p>
      ) : isAdmin ? (
        <p className="giris__excel-hint">
          Excel ile toplu giriş: önce <strong>Hızlı yükleme şablonu</strong>nu
          indirip doldurun, sonra <strong>Hızlı yükle</strong> ile seçin.
          Tarihler <code>YYYY-MM-DD</code> veya <code>GG.AA.YYYY</code>. Renk
          boş bırakılırsa her <strong>tür</strong> için ayrı bir renk atanır;
          aynı türdeki faaliyetler aynı rengi paylaşır. Doluysa{' '}
          <code>#c45c26</code> gibi hex kullanın. Sütun başlığına tıklayarak
          sıralayabilirsiniz; sıra tüm cihazlarda kalıcıdır.
        </p>
      ) : (
        <p className="giris__excel-hint">
          Görüntüleme modundasınız. Sıralama yalnızca bu oturumda geçerlidir.
        </p>
      )}

      {isAdmin ? <YedekPanel /> : null}

      {mode === 'mobile' ? (
        <>
          <label className="giris__mobile-sort">
            <span>Sırala{!isAdmin ? ' (geçici)' : ''}</span>
            <select
              value={sortKey && sortDir ? `${sortKey}:${sortDir}` : ''}
              onChange={(e) => handleMobileSortChange(e.target.value)}
            >
              <option value="">Sıralama yok</option>
              {SORT_COLUMNS.flatMap((col) => [
                <option key={`${col.key}-asc`} value={`${col.key}:asc`}>
                  {col.label} ↑
                </option>,
                <option key={`${col.key}-desc`} value={`${col.key}:desc`}>
                  {col.label} ↓
                </option>,
              ])}
            </select>
          </label>
          <div className="giris__cards">
            {gorunenFaaliyetler.map((f, index) => (
              <article key={f.id} className="giris__card">
                <div className="giris__card-head">
                  <span className="giris__card-index">#{index + 1}</span>
                  {isAdmin ? (
                    <button
                      type="button"
                      className="btn btn--icon"
                      onClick={() => removeFaaliyet(f.id)}
                      aria-label="Satırı sil"
                      title="Sil"
                    >
                      ×
                    </button>
                  ) : null}
                </div>
                <div className="giris__card-grid">
                  <label
                    className={
                      sortKey === 'ad'
                        ? 'giris__field giris__field--sorted'
                        : 'giris__field'
                    }
                  >
                    <span>Faaliyet adı</span>
                    <input
                      type="text"
                      value={f.ad}
                      readOnly={!isAdmin}
                      placeholder="Örn. Kış Kampı"
                      onChange={(e) =>
                        updateFaaliyet(f.id, { ad: e.target.value })
                      }
                    />
                  </label>
                  <label
                    className={
                      sortKey === 'tur'
                        ? 'giris__field giris__field--sorted'
                        : 'giris__field'
                    }
                  >
                    <span>Tür</span>
                    <input
                      type="text"
                      value={f.tur}
                      readOnly={!isAdmin}
                      placeholder="Eğitim, Saha…"
                      onChange={(e) =>
                        updateFaaliyet(f.id, { tur: e.target.value })
                      }
                      onBlur={() => {
                        if (isAdmin) syncTurRenk(f.id)
                      }}
                    />
                  </label>
                  <label
                    className={
                      sortKey === 'baslangic'
                        ? 'giris__field giris__field--sorted'
                        : 'giris__field'
                    }
                  >
                    <span>Başlangıç</span>
                    <input
                      type="date"
                      value={f.baslangic}
                      readOnly={!isAdmin}
                      disabled={!isAdmin}
                      onChange={(e) =>
                        updateFaaliyet(f.id, { baslangic: e.target.value })
                      }
                    />
                  </label>
                  <label
                    className={
                      sortKey === 'bitis'
                        ? 'giris__field giris__field--sorted'
                        : 'giris__field'
                    }
                  >
                    <span>Bitiş</span>
                    <input
                      type="date"
                      value={f.bitis}
                      min={f.baslangic}
                      readOnly={!isAdmin}
                      disabled={!isAdmin}
                      onChange={(e) =>
                        updateFaaliyet(f.id, { bitis: e.target.value })
                      }
                    />
                  </label>
                  <label
                    className={
                      sortKey === 'etiket'
                        ? 'giris__field giris__field--sorted'
                        : 'giris__field'
                    }
                  >
                    <span>Etiket</span>
                    <input
                      type="text"
                      value={f.etiket}
                      readOnly={!isAdmin}
                      placeholder="etiket"
                      onChange={(e) =>
                        updateFaaliyet(f.id, { etiket: e.target.value })
                      }
                    />
                  </label>
                  <div
                    className={
                      sortKey === 'renk'
                        ? 'giris__field giris__field--renk giris__field--sorted'
                        : 'giris__field giris__field--renk'
                    }
                  >
                    <span>Renk</span>
                    <RenkPicker
                      f={f}
                      onUpdate={updateFaaliyet}
                      readOnly={!isAdmin}
                    />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className="giris__table-wrap">
          <table className="giris__table">
            <thead>
              <tr>
                {SORT_COLUMNS.map((col) => (
                  <SortHeader
                    key={col.key}
                    label={col.label}
                    active={sortKey === col.key}
                    dir={sortKey === col.key ? sortDir : null}
                    onClick={() => handleSortClick(col.key)}
                  />
                ))}
                {isAdmin ? <th aria-label="Sil" /> : null}
              </tr>
            </thead>
            <tbody>
              {gorunenFaaliyetler.map((f) => (
                <tr key={f.id}>
                  <td className={cellClass(sortKey === 'ad')}>
                    <input
                      type="text"
                      value={f.ad}
                      readOnly={!isAdmin}
                      placeholder="Örn. Kış Kampı"
                      onChange={(e) =>
                        updateFaaliyet(f.id, { ad: e.target.value })
                      }
                    />
                  </td>
                  <td className={cellClass(sortKey === 'tur')}>
                    <input
                      type="text"
                      value={f.tur}
                      readOnly={!isAdmin}
                      placeholder="Eğitim, Saha…"
                      onChange={(e) =>
                        updateFaaliyet(f.id, { tur: e.target.value })
                      }
                      onBlur={() => {
                        if (isAdmin) syncTurRenk(f.id)
                      }}
                    />
                  </td>
                  <td className={cellClass(sortKey === 'baslangic')}>
                    <input
                      type="date"
                      value={f.baslangic}
                      readOnly={!isAdmin}
                      disabled={!isAdmin}
                      onChange={(e) =>
                        updateFaaliyet(f.id, { baslangic: e.target.value })
                      }
                    />
                  </td>
                  <td className={cellClass(sortKey === 'bitis')}>
                    <input
                      type="date"
                      value={f.bitis}
                      min={f.baslangic}
                      readOnly={!isAdmin}
                      disabled={!isAdmin}
                      onChange={(e) =>
                        updateFaaliyet(f.id, { bitis: e.target.value })
                      }
                    />
                  </td>
                  <td className={cellClass(sortKey === 'etiket')}>
                    <input
                      type="text"
                      value={f.etiket}
                      readOnly={!isAdmin}
                      placeholder="etiket"
                      onChange={(e) =>
                        updateFaaliyet(f.id, { etiket: e.target.value })
                      }
                    />
                  </td>
                  <td className={cellClass(sortKey === 'renk')}>
                    <RenkPicker
                      f={f}
                      onUpdate={updateFaaliyet}
                      readOnly={!isAdmin}
                    />
                  </td>
                  {isAdmin ? (
                    <td>
                      <button
                        type="button"
                        className="btn btn--icon"
                        onClick={() => removeFaaliyet(f.id)}
                        aria-label="Satırı sil"
                        title="Sil"
                      >
                        ×
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="giris__footer">
        {isAdmin ? (
          <button
            type="button"
            className="btn btn--secondary"
            onClick={addFaaliyet}
          >
            + Satır ekle
          </button>
        ) : (
          <span />
        )}
        <Link to="/takvim" className="btn btn--primary">
          Takvimi gör
        </Link>
      </div>
    </div>
  )
}
