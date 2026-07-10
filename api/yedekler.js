import { createClient } from '@libsql/client'
import { randomUUID } from 'node:crypto'

const MAX_YEDEK = 10
const SORT_KEYS = new Set(['ad', 'tur', 'baslangic', 'bitis', 'etiket', 'renk'])
const SORT_DIRS = new Set(['asc', 'desc'])

function getClient() {
  const url = process.env.TURSO_DATABASE_URL
  const authToken = process.env.TURSO_AUTH_TOKEN
  if (!url || !authToken) {
    throw new Error('TURSO_DATABASE_URL veya TURSO_AUTH_TOKEN eksik')
  }
  return createClient({ url, authToken })
}

async function ensureSchema() {
  const db = getClient()
  await db.execute(`
    CREATE TABLE IF NOT EXISTS faaliyetler (
      id TEXT PRIMARY KEY,
      ad TEXT NOT NULL DEFAULT '',
      tur TEXT NOT NULL DEFAULT '',
      baslangic TEXT NOT NULL DEFAULT '',
      bitis TEXT NOT NULL DEFAULT '',
      etiket TEXT NOT NULL DEFAULT '',
      renk TEXT NOT NULL DEFAULT '',
      sira INTEGER NOT NULL DEFAULT 0
    )
  `)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS ayarlar (
      anahtar TEXT PRIMARY KEY,
      deger TEXT NOT NULL DEFAULT ''
    )
  `)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS yedekler (
      id TEXT PRIMARY KEY,
      aciklama TEXT NOT NULL DEFAULT '',
      olusturma TEXT NOT NULL,
      veri TEXT NOT NULL
    )
  `)
  return db
}

function isFaaliyet(value) {
  if (!value || typeof value !== 'object') return false
  return (
    typeof value.id === 'string' &&
    typeof value.ad === 'string' &&
    typeof value.tur === 'string' &&
    typeof value.baslangic === 'string' &&
    typeof value.bitis === 'string' &&
    typeof value.etiket === 'string' &&
    typeof value.renk === 'string'
  )
}

function normalizeSort(value) {
  if (!value || typeof value !== 'object') return null
  if (!SORT_KEYS.has(value.key) || !SORT_DIRS.has(value.dir)) return null
  return { key: value.key, dir: value.dir }
}

function parseSnapshot(value) {
  if (!value || typeof value !== 'object') return null
  const list = Array.isArray(value.faaliyetler) ? value.faaliyetler : null
  if (!list || !list.every(isFaaliyet)) return null
  const sort =
    value.sort === null || value.sort === undefined
      ? null
      : normalizeSort(value.sort)
  if (value.sort != null && sort === null) return null
  return { faaliyetler: list, sort }
}

async function writeLiveData(db, faaliyetler, sort) {
  await db.execute('DELETE FROM faaliyetler')
  if (faaliyetler.length > 0) {
    await db.batch(
      faaliyetler.map((f, index) => ({
        sql: `INSERT INTO faaliyetler (id, ad, tur, baslangic, bitis, etiket, renk, sira)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [f.id, f.ad, f.tur, f.baslangic, f.bitis, f.etiket, f.renk, index],
      })),
      'write',
    )
  }

  await db.execute("DELETE FROM ayarlar WHERE anahtar IN ('sort_key', 'sort_dir')")
  if (sort) {
    await db.batch(
      [
        {
          sql: `INSERT INTO ayarlar (anahtar, deger) VALUES ('sort_key', ?)
                ON CONFLICT(anahtar) DO UPDATE SET deger = excluded.deger`,
          args: [sort.key],
        },
        {
          sql: `INSERT INTO ayarlar (anahtar, deger) VALUES ('sort_dir', ?)
                ON CONFLICT(anahtar) DO UPDATE SET deger = excluded.deger`,
          args: [sort.dir],
        },
      ],
      'write',
    )
  }
}

async function pruneYedekler(db) {
  const result = await db.execute(
    'SELECT id FROM yedekler ORDER BY olusturma DESC',
  )
  if (result.rows.length <= MAX_YEDEK) return
  const excess = result.rows.slice(MAX_YEDEK)
  for (const row of excess) {
    await db.execute({
      sql: 'DELETE FROM yedekler WHERE id = ?',
      args: [String(row.id)],
    })
  }
}

function toMeta(row, veri) {
  let adet = 0
  try {
    const parsed = JSON.parse(String(veri ?? '{}'))
    adet = Array.isArray(parsed.faaliyetler) ? parsed.faaliyetler.length : 0
  } catch {
    adet = 0
  }
  return {
    id: String(row.id),
    aciklama: String(row.aciklama ?? ''),
    olusturma: String(row.olusturma ?? ''),
    adet,
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  try {
    const db = await ensureSchema()
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}

    if (req.method === 'GET') {
      const id = typeof req.query?.id === 'string' ? req.query.id : null
      if (id) {
        const result = await db.execute({
          sql: 'SELECT id, aciklama, olusturma, veri FROM yedekler WHERE id = ?',
          args: [id],
        })
        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Yedek bulunamadi' })
        }
        const row = result.rows[0]
        const veri = JSON.parse(String(row.veri))
        return res.status(200).json({
          yedek: {
            ...toMeta(row, row.veri),
            faaliyetler: veri.faaliyetler,
            sort: veri.sort ?? null,
            version: 1,
          },
        })
      }

      const result = await db.execute({
        sql: 'SELECT id, aciklama, olusturma, veri FROM yedekler ORDER BY olusturma DESC LIMIT ?',
        args: [MAX_YEDEK],
      })
      const yedekler = result.rows.map((row) => toMeta(row, row.veri))
      return res.status(200).json({ yedekler, max: MAX_YEDEK })
    }

    if (req.method === 'POST') {
      const aciklama = String(body.aciklama ?? '').trim()
      if (!aciklama) {
        return res.status(400).json({ error: 'Aciklama gerekli' })
      }
      const snapshot = parseSnapshot(body)
      if (!snapshot) {
        return res.status(400).json({ error: 'Gecersiz yedek verisi' })
      }

      const id = randomUUID()
      const olusturma = new Date().toISOString()
      const veri = JSON.stringify({
        version: 1,
        faaliyetler: snapshot.faaliyetler,
        sort: snapshot.sort,
      })

      await db.execute({
        sql: 'INSERT INTO yedekler (id, aciklama, olusturma, veri) VALUES (?, ?, ?, ?)',
        args: [id, aciklama, olusturma, veri],
      })
      await pruneYedekler(db)

      return res.status(201).json({
        yedek: {
          id,
          aciklama,
          olusturma,
          adet: snapshot.faaliyetler.length,
          faaliyetler: snapshot.faaliyetler,
          sort: snapshot.sort,
          version: 1,
        },
      })
    }

    if (req.method === 'PUT') {
      // id ile iç yedekten veya dosya snapshot'ından geri yükle
      let snapshot = null
      let kaynak = 'dosya'

      if (typeof body.id === 'string' && body.id) {
        const result = await db.execute({
          sql: 'SELECT veri FROM yedekler WHERE id = ?',
          args: [body.id],
        })
        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Yedek bulunamadi' })
        }
        snapshot = parseSnapshot(JSON.parse(String(result.rows[0].veri)))
        kaynak = 'sistem'
      } else {
        snapshot = parseSnapshot(body)
      }

      if (!snapshot) {
        return res.status(400).json({ error: 'Gecersiz yedek' })
      }

      await writeLiveData(db, snapshot.faaliyetler, snapshot.sort)
      return res.status(200).json({
        ok: true,
        kaynak,
        faaliyetler: snapshot.faaliyetler,
        sort: snapshot.sort,
      })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sunucu hatasi'
    return res.status(500).json({ error: message })
  }
}
