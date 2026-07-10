function getAdminToken() {
  return process.env.ADMIN_SESSION_TOKEN || ''
}

export function getBearerToken(req) {
  const header = String(req.headers?.authorization || '')
  if (header.toLowerCase().startsWith('bearer ')) {
    return header.slice(7).trim()
  }
  return ''
}

export function requireAdmin(req, res) {
  const expected = getAdminToken()
  if (!expected) {
    res.status(500).json({ error: 'Admin oturumu sunucuda yapilandirilmamis' })
    return false
  }
  const token = getBearerToken(req)
  if (!token || token !== expected) {
    res.status(401).json({ error: 'Admin yetkisi gerekli' })
    return false
  }
  return true
}
