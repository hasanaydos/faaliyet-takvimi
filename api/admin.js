const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || ''
const ADMIN_SESSION_TOKEN = process.env.ADMIN_SESSION_TOKEN || ''

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    if (!ADMIN_PASSWORD || !ADMIN_SESSION_TOKEN) {
      return res.status(500).json({
        error: 'Admin sifresi sunucuda yapilandirilmamis',
      })
    }

    const body =
      typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const password = String(body.password ?? '')

    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Sifre hatali' })
    }

    return res.status(200).json({
      ok: true,
      token: ADMIN_SESSION_TOKEN,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sunucu hatasi'
    return res.status(500).json({ error: message })
  }
}
