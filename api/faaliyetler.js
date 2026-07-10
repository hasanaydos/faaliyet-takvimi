import { createClient } from '@libsql/client'

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
  return db
}

function rowToFaaliyet(row) {
  return {
    id: String(row.id ?? ''),
    ad: String(row.ad ?? ''),
    tur: String(row.tur ?? ''),
    baslangic: String(row.baslangic ?? ''),
    bitis: String(row.bitis ?? ''),
    etiket: String(row.etiket ?? ''),
    renk: String(row.renk ?? ''),
  }
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
  const key = value.key
  const dir = value.dir
  if (!SORT_KEYS.has(key) || !SORT_DIRS.has(dir)) return null
  return { key, dir }
}

async function readSort(db) {
  const result = await db.execute(
    "SELECT anahtar, deger FROM ayarlar WHERE anahtar IN ('sort_key', 'sort_dir')",
  )
  const map = Object.fromEntries(
    result.rows.map((row) => [String(row.anahtar), String(row.deger ?? '')]),
  )
  return normalizeSort({ key: map.sort_key, dir: map.sort_dir })
}

async function writeSort(db, sort) {
  if (!sort) {
    await db.execute("DELETE FROM ayarlar WHERE anahtar IN ('sort_key', 'sort_dir')")
    return
  }
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  try {
    const db = await ensureSchema()

    if (req.method === 'GET') {
      const result = await db.execute(
        'SELECT id, ad, tur, baslangic, bitis, etiket, renk FROM faaliyetler ORDER BY sira ASC, id ASC',
      )
      const items = result.rows.map((row) => rowToFaaliyet(row))
      const sort = await readSort(db)
      return res.status(200).json({ faaliyetler: items, sort })
    }

    if (req.method === 'PUT') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
      const list = Array.isArray(body?.faaliyetler) ? body.faaliyetler : null
      if (!list || !list.every(isFaaliyet)) {
        return res.status(400).json({ error: 'Gecersiz veri' })
      }

      const sortProvided = Object.prototype.hasOwnProperty.call(body ?? {}, 'sort')
      let sort = undefined
      if (sortProvided) {
        if (body.sort === null) {
          sort = null
        } else {
          sort = normalizeSort(body.sort)
          if (!sort) {
            return res.status(400).json({ error: 'Gecersiz siralama' })
          }
        }
      }

      await db.execute('DELETE FROM faaliyetler')
      if (list.length > 0) {
        const stmts = list.map((f, index) => ({
          sql: `INSERT INTO faaliyetler (id, ad, tur, baslangic, bitis, etiket, renk, sira)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [f.id, f.ad, f.tur, f.baslangic, f.bitis, f.etiket, f.renk, index],
        }))
        await db.batch(stmts, 'write')
      }

      if (sortProvided) {
        await writeSort(db, sort)
      }

      return res.status(200).json({
        ok: true,
        count: list.length,
        sort: sortProvided ? sort : await readSort(db),
      })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sunucu hatasi'
    return res.status(500).json({ error: message })
  }
}
