import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Faaliyet } from '../types'
import { FAALIYET_RENKLERI } from '../types'
import { useFaaliyetler } from '../context/FaaliyetContext'
import { useViewMode } from '../context/ViewModeContext'
import { downloadSablon, parseFaaliyetExcel } from '../utils/excel'
import './Giris.css'

type SortKey = 'ad' | 'tur' | 'baslangic' | 'bitis' | 'etiket' | 'renk'
type SortDir = 'asc' | 'desc'

const SORT_COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'ad', label: 'Faaliyet adı' },
  { key: 'tur', label: 'Tür' },
  { key: 'baslangic', label: 'Başlangıç' },
  { key: 'bitis', label: 'Bitiş' },
  { key: 'etiket', label: 'Etiket' },
  { key: 'renk', label: 'Renk' },
]

function compareFaaliyet(a: Faaliyet, b: Faaliyet, key: SortKey): number {
  return a[key].localeCompare(b[key], 'tr', {
    sensitivity: 'base',
    numeric: true,
  })
}

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
    <th aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
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
}: {
  f: Faaliyet
  onUpdate: (id: string, patch: Partial<Omit<Faaliyet, 'id'>>) => void
}) {
  return (
    <div className="giris__renk">
      <input
        type="color"
        value={f.renk}
        onChange={(e) => onUpdate(f.id, { renk: e.target.value })}
        aria-label="Renk seç"
      />
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
    </div>
  )
}

export default function Giris() {
  const {
    faaliyetler,
    setFaaliyetler,
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
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  function toggleSort(key: SortKey) {
    if (sortKey !== key) {
      setSortKey(key)
      setSortDir('asc')
      return
    }
    if (sortDir === 'asc') {
      setSortDir('desc')
      return
    }
    setSortKey(null)
  }

  const siraliFaaliyetler = useMemo(() => {
    if (!sortKey) return faaliyetler
    return [...faaliyetler].sort((a, b) => {
      const cmp = compareFaaliyet(a, b, sortKey)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [faaliyetler, sortKey, sortDir])

  async function handleHizliYukle(file: File | undefined) {
    if (!file) return
    setYukleniyor(true)
    setMesaj(null)

    try {
      const buffer = await file.arrayBuffer()
      const { faaliyetler: parsed, skipped } = parseFaaliyetExcel(buffer)
      setFaaliyetler(parsed)

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
    <div className={mode === 'mobile' ? 'giris giris--mobile' : 'giris'}>
      <header className="giris__header">
        <div>
          <p className="giris__eyebrow">Faaliyet Takvimi</p>
          <h1>Faaliyetleri gir</h1>
          <p className="giris__lead">
            Her satır bir faaliyet. Ad, tür, tarih aralığı, etiket ve renk
            girin; takvim ekranı bu verilere göre ayları ve şeritleri üretir.
            Excel şablonuyla da toplu yükleyebilirsiniz.
          </p>
        </div>
        <div className="giris__actions">
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
      ) : (
        <p className="giris__excel-hint">
          Excel ile toplu giriş: önce <strong>Hızlı yükleme şablonu</strong>nu
          indirip doldurun, sonra <strong>Hızlı yükle</strong> ile seçin.
          Tarihler <code>YYYY-MM-DD</code> veya <code>GG.AA.YYYY</code>. Renk
          boş bırakılırsa her <strong>tür</strong> için ayrı bir renk atanır;
          aynı türdeki faaliyetler aynı rengi paylaşır. Doluysa{' '}
          <code>#c45c26</code> gibi hex kullanın. Sütun başlığına tıklayarak
          sıralayabilirsiniz.
        </p>
      )}

      {mode === 'mobile' ? (
        <>
          <label className="giris__mobile-sort">
            <span>Sırala</span>
            <select
              value={sortKey ? `${sortKey}:${sortDir}` : ''}
              onChange={(e) => {
                const value = e.target.value
                if (!value) {
                  setSortKey(null)
                  return
                }
                const [key, dir] = value.split(':') as [SortKey, SortDir]
                setSortKey(key)
                setSortDir(dir)
              }}
            >
              <option value="">Varsayılan sıra</option>
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
            {siraliFaaliyetler.map((f, index) => (
              <article key={f.id} className="giris__card">
                <div className="giris__card-head">
                  <span className="giris__card-index">#{index + 1}</span>
                  <button
                    type="button"
                    className="btn btn--icon"
                    onClick={() => removeFaaliyet(f.id)}
                    aria-label="Satırı sil"
                    title="Sil"
                  >
                    ×
                  </button>
                </div>
                <div className="giris__card-grid">
                  <label className="giris__field">
                    <span>Faaliyet adı</span>
                    <input
                      type="text"
                      value={f.ad}
                      placeholder="Örn. Kış Kampı"
                      onChange={(e) =>
                        updateFaaliyet(f.id, { ad: e.target.value })
                      }
                    />
                  </label>
                  <label className="giris__field">
                    <span>Tür</span>
                    <input
                      type="text"
                      value={f.tur}
                      placeholder="Eğitim, Saha…"
                      onChange={(e) =>
                        updateFaaliyet(f.id, { tur: e.target.value })
                      }
                      onBlur={() => syncTurRenk(f.id)}
                    />
                  </label>
                  <label className="giris__field">
                    <span>Başlangıç</span>
                    <input
                      type="date"
                      value={f.baslangic}
                      onChange={(e) =>
                        updateFaaliyet(f.id, { baslangic: e.target.value })
                      }
                    />
                  </label>
                  <label className="giris__field">
                    <span>Bitiş</span>
                    <input
                      type="date"
                      value={f.bitis}
                      min={f.baslangic}
                      onChange={(e) =>
                        updateFaaliyet(f.id, { bitis: e.target.value })
                      }
                    />
                  </label>
                  <label className="giris__field">
                    <span>Etiket</span>
                    <input
                      type="text"
                      value={f.etiket}
                      placeholder="etiket"
                      onChange={(e) =>
                        updateFaaliyet(f.id, { etiket: e.target.value })
                      }
                    />
                  </label>
                  <div className="giris__field giris__field--renk">
                    <span>Renk</span>
                    <RenkPicker f={f} onUpdate={updateFaaliyet} />
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
                    onClick={() => toggleSort(col.key)}
                  />
                ))}
                <th aria-label="Sil" />
              </tr>
            </thead>
            <tbody>
              {siraliFaaliyetler.map((f) => (
                <tr key={f.id}>
                  <td>
                    <input
                      type="text"
                      value={f.ad}
                      placeholder="Örn. Kış Kampı"
                      onChange={(e) =>
                        updateFaaliyet(f.id, { ad: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={f.tur}
                      placeholder="Eğitim, Saha…"
                      onChange={(e) =>
                        updateFaaliyet(f.id, { tur: e.target.value })
                      }
                      onBlur={() => syncTurRenk(f.id)}
                    />
                  </td>
                  <td>
                    <input
                      type="date"
                      value={f.baslangic}
                      onChange={(e) =>
                        updateFaaliyet(f.id, { baslangic: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="date"
                      value={f.bitis}
                      min={f.baslangic}
                      onChange={(e) =>
                        updateFaaliyet(f.id, { bitis: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={f.etiket}
                      placeholder="etiket"
                      onChange={(e) =>
                        updateFaaliyet(f.id, { etiket: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <RenkPicker f={f} onUpdate={updateFaaliyet} />
                  </td>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="giris__footer">
        <button type="button" className="btn btn--secondary" onClick={addFaaliyet}>
          + Satır ekle
        </button>
        <Link to="/takvim" className="btn btn--primary">
          Takvimi gör
        </Link>
      </div>
    </div>
  )
}
