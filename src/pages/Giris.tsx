import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FAALIYET_RENKLERI } from '../types'
import { useFaaliyetler } from '../context/FaaliyetContext'
import { downloadSablon, parseFaaliyetExcel } from '../utils/excel'
import './Giris.css'

export default function Giris() {
  const {
    faaliyetler,
    setFaaliyetler,
    updateFaaliyet,
    syncTurRenk,
    addFaaliyet,
    removeFaaliyet,
  } = useFaaliyetler()

  const fileRef = useRef<HTMLInputElement>(null)
  const [yukleniyor, setYukleniyor] = useState(false)
  const [mesaj, setMesaj] = useState<{ tip: 'ok' | 'hata'; metin: string } | null>(
    null,
  )

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
    <div className="giris">
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
          <code>#c45c26</code> gibi hex kullanın.
        </p>
      )}

      <div className="giris__table-wrap">
        <table className="giris__table">
          <thead>
            <tr>
              <th>Faaliyet adı</th>
              <th>Tür</th>
              <th>Başlangıç</th>
              <th>Bitiş</th>
              <th>Etiket</th>
              <th>Renk</th>
              <th aria-label="Sil" />
            </tr>
          </thead>
          <tbody>
            {faaliyetler.map((f) => (
              <tr key={f.id}>
                <td>
                  <input
                    type="text"
                    value={f.ad}
                    placeholder="Örn. Kış Kampı"
                    onChange={(e) => updateFaaliyet(f.id, { ad: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={f.tur}
                    placeholder="Eğitim, Saha…"
                    onChange={(e) => updateFaaliyet(f.id, { tur: e.target.value })}
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
                  <div className="giris__renk">
                    <input
                      type="color"
                      value={f.renk}
                      onChange={(e) =>
                        updateFaaliyet(f.id, { renk: e.target.value })
                      }
                      aria-label="Renk seç"
                    />
                    <div className="giris__renk-swatches">
                      {FAALIYET_RENKLERI.map((r) => (
                        <button
                          key={r}
                          type="button"
                          className={
                            f.renk === r
                              ? 'giris__swatch giris__swatch--active'
                              : 'giris__swatch'
                          }
                          style={{ background: r }}
                          onClick={() => updateFaaliyet(f.id, { renk: r })}
                          aria-label={`Renk ${r}`}
                        />
                      ))}
                    </div>
                  </div>
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
