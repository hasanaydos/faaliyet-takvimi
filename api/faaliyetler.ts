import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@libsql/client'
import type { Faaliyet } from '../src/types'

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
  return db
}

function rowToFaaliyet(row: Record<string, unknown>): Faaliyet {
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

function isFaaliyet(value: unknown): value is Faaliyet {
  if (!value || typeof value !== 'object') return false
  const f = value as Record<string, unknown>
  return (
    typeof f.id === 'string' &&
    typeof f.ad === 'string' &&
    typeof f.tur === 'string' &&
    typeof f.baslangic === 'string' &&
    typeof f.bitis === 'string' &&
    typeof f.etiket === 'string' &&
    typeof f.renk === 'string'
  )
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
      const items = result.rows.map((row) =>
        rowToFaaliyet(row as Record<string, unknown>),
      )
      return res.status(200).json({ faaliyetler: items })
    }

    if (req.method === 'PUT') {
      const body = req.body
      const list = Array.isArray(body?.faaliyetler) ? body.faaliyetler : null
      if (!list || !list.every(isFaaliyet)) {
        return res.status(400).json({ error: 'Gecersiz veri' })
      }

      await db.execute('DELETE FROM faaliyetler')
      if (list.length > 0) {
        const stmts = list.map((f: Faaliyet, index: number) => ({
          sql: `INSERT INTO faaliyetler (id, ad, tur, baslangic, bitis, etiket, renk, sira)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [f.id, f.ad, f.tur, f.baslangic, f.bitis, f.etiket, f.renk, index],
        }))
        await db.batch(stmts, 'write')
      }

      return res.status(200).json({ ok: true, count: list.length })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sunucu hatasi'
    return res.status(500).json({ error: message })
  }
}
