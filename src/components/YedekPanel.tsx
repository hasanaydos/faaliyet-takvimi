import { useEffect, useRef, useState } from 'react'
import { useFaaliyetler } from '../context/FaaliyetContext'
import {
  createYedek,
  downloadYedekDosyasi,
  fetchYedek,
  listYedekler,
  parseYedekDosyasi,
  restoreYedekById,
  restoreYedekFromFile,
  type YedekMeta,
} from '../api/yedekApi'
import './YedekPanel.css'

function formatTarih(iso: string): string {
  try {
    return new Date(iso).toLocaleString('tr-TR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

export default function YedekPanel() {
  const { faaliyetler, sort, restoreSnapshot } = useFaaliyetler()
  const fileRef = useRef<HTMLInputElement>(null)

  const [yedekModal, setYedekModal] = useState(false)
  const [geriModal, setGeriModal] = useState(false)
  const [aciklama, setAciklama] = useState('')
  const [liste, setListe] = useState<YedekMeta[]>([])
  const [seciliId, setSeciliId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [mesaj, setMesaj] = useState<{ tip: 'ok' | 'hata'; metin: string } | null>(
    null,
  )

  useEffect(() => {
    if (!geriModal) return
    let cancelled = false
    ;(async () => {
      try {
        const items = await listYedekler()
        if (!cancelled) {
          setListe(items)
          setSeciliId(items[0]?.id ?? null)
        }
      } catch (err) {
        if (!cancelled) {
          setMesaj({
            tip: 'hata',
            metin: err instanceof Error ? err.message : 'Yedekler yüklenemedi',
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [geriModal])

  async function handleYedekle() {
    const text = aciklama.trim()
    if (!text) {
      setMesaj({ tip: 'hata', metin: 'Lütfen bir açıklama girin.' })
      return
    }
    setBusy(true)
    setMesaj(null)
    try {
      const yedek = await createYedek({
        aciklama: text,
        faaliyetler,
        sort,
      })
      downloadYedekDosyasi(yedek)
      setYedekModal(false)
      setAciklama('')
      setMesaj({
        tip: 'ok',
        metin:
          'Yedek alındı: sistem içine kaydedildi ve JSON dosyası indirildi (son 10 yedek tutulur).',
      })
    } catch (err) {
      setMesaj({
        tip: 'hata',
        metin: err instanceof Error ? err.message : 'Yedekleme başarısız',
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleGeriYukle() {
    if (!seciliId) {
      setMesaj({ tip: 'hata', metin: 'Lütfen bir yedek seçin.' })
      return
    }
    const onay = window.confirm(
      'Seçilen yedek mevcut verinin üzerine yazılacak. Devam edilsin mi?',
    )
    if (!onay) return

    setBusy(true)
    setMesaj(null)
    try {
      const data = await restoreYedekById(seciliId)
      restoreSnapshot(data.faaliyetler, data.sort)
      setGeriModal(false)
      setMesaj({
        tip: 'ok',
        metin: 'Yedek başarıyla geri yüklendi.',
      })
    } catch (err) {
      setMesaj({
        tip: 'hata',
        metin: err instanceof Error ? err.message : 'Geri yükleme başarısız',
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleIndir(id: string) {
    setBusy(true)
    setMesaj(null)
    try {
      const yedek = await fetchYedek(id)
      downloadYedekDosyasi(yedek)
      setMesaj({ tip: 'ok', metin: 'Yedek dosyası indirildi.' })
    } catch (err) {
      setMesaj({
        tip: 'hata',
        metin: err instanceof Error ? err.message : 'İndirme başarısız',
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleDosyadan(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setMesaj(null)
    try {
      const text = await file.text()
      const parsed = parseYedekDosyasi(JSON.parse(text))
      const onay = window.confirm(
        `"${parsed.aciklama}" yedeği mevcut verinin üzerine yazılacak. Devam edilsin mi?`,
      )
      if (!onay) return

      const data = await restoreYedekFromFile({
        faaliyetler: parsed.faaliyetler,
        sort: parsed.sort,
      })
      restoreSnapshot(data.faaliyetler, data.sort)
      setGeriModal(false)
      setMesaj({
        tip: 'ok',
        metin: 'Dış yedek dosyasından geri yükleme tamamlandı.',
      })
    } catch (err) {
      setMesaj({
        tip: 'hata',
        metin: err instanceof Error ? err.message : 'Dosya okunamadı',
      })
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <section className="yedek">
      <div className="yedek__actions">
        <button
          type="button"
          className="btn btn--secondary"
          onClick={() => {
            setMesaj(null)
            setAciklama('')
            setYedekModal(true)
          }}
        >
          Sistemi yedekle
        </button>
        <button
          type="button"
          className="btn btn--secondary"
          onClick={() => {
            setMesaj(null)
            setGeriModal(true)
          }}
        >
          Yedekten geri yükle
        </button>
      </div>

      {mesaj ? (
        <p
          className={
            mesaj.tip === 'ok' ? 'yedek__mesaj yedek__mesaj--ok' : 'yedek__mesaj yedek__mesaj--hata'
          }
          role="status"
        >
          {mesaj.metin}
        </p>
      ) : (
        <p className="yedek__hint">
          Yedek hem sisteme kaydedilir hem JSON olarak cihazınıza iner. Sistem
          son 10 yedeği tutar; arıza durumunda indirilen dosyadan da geri
          yükleyebilirsiniz.
        </p>
      )}

      {yedekModal ? (
        <div
          className="yedek__backdrop"
          role="presentation"
          onClick={() => !busy && setYedekModal(false)}
        >
          <div
            className="yedek__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="yedek-create-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="yedek__dialog-head">
              <h2 id="yedek-create-title">Sistemi yedekle</h2>
              <button
                type="button"
                className="yedek__close"
                onClick={() => setYedekModal(false)}
                aria-label="Kapat"
                disabled={busy}
              >
                ×
              </button>
            </div>
            <label className="yedek__field">
              <span>Açıklama</span>
              <textarea
                value={aciklama}
                onChange={(e) => setAciklama(e.target.value)}
                rows={3}
                placeholder="Örn. Mart ayı sonu yedeği"
                disabled={busy}
              />
            </label>
            <div className="yedek__dialog-actions">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => setYedekModal(false)}
                disabled={busy}
              >
                Vazgeç
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleYedekle}
                disabled={busy}
              >
                {busy ? 'Yedekleniyor…' : 'Yedekle'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {geriModal ? (
        <div
          className="yedek__backdrop"
          role="presentation"
          onClick={() => !busy && setGeriModal(false)}
        >
          <div
            className="yedek__dialog yedek__dialog--wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="yedek-restore-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="yedek__dialog-head">
              <h2 id="yedek-restore-title">Yedekten geri yükle</h2>
              <button
                type="button"
                className="yedek__close"
                onClick={() => setGeriModal(false)}
                aria-label="Kapat"
                disabled={busy}
              >
                ×
              </button>
            </div>

            {liste.length === 0 ? (
              <p className="yedek__empty">Henüz sistem içi yedek yok.</p>
            ) : (
              <ul className="yedek__list">
                {liste.map((y) => (
                  <li key={y.id}>
                    <label className="yedek__item">
                      <input
                        type="radio"
                        name="yedek"
                        checked={seciliId === y.id}
                        onChange={() => setSeciliId(y.id)}
                        disabled={busy}
                      />
                      <span className="yedek__item-body">
                        <strong>{y.aciklama}</strong>
                        <small>
                          {formatTarih(y.olusturma)} · {y.adet} faaliyet
                        </small>
                      </span>
                      <button
                        type="button"
                        className="btn btn--secondary yedek__indir"
                        onClick={() => handleIndir(y.id)}
                        disabled={busy}
                      >
                        İndir
                      </button>
                    </label>
                  </li>
                ))}
              </ul>
            )}

            <div className="yedek__dialog-actions yedek__dialog-actions--split">
              <div className="yedek__file-actions">
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                >
                  Dosyadan yükle
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  className="yedek__file-input"
                  onChange={(e) => handleDosyadan(e.target.files?.[0])}
                />
              </div>
              <div className="yedek__dialog-actions">
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => setGeriModal(false)}
                  disabled={busy}
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={handleGeriYukle}
                  disabled={busy || !seciliId}
                >
                  {busy ? 'Yükleniyor…' : 'Geri yükle'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
