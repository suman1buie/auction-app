function parseBoolean(value) {
    const text = String(value || '').trim().toLowerCase()
    if (!text) return null
    if (['1', 'true', 'yes', 'on'].includes(text)) return true
    if (['0', 'false', 'no', 'off'].includes(text)) return false
    return null
}

export function createBasicAuthConfig(env = process.env) {
    const configured = parseBoolean(env.BASIC_AUTH_ENABLED)
    const enabled = configured === null ? String(env.NODE_ENV || '').toLowerCase() === 'production' : configured
    return {
        enabled,
        realm: 'Live Auction Floor',
        username: String(env.BASIC_AUTH_USER || 'admin'),
        password: String(env.BASIC_AUTH_PASS || 'change-me'),
    }
}

export function parseAuthorizationHeader(header) {
    if (!header || typeof header !== 'string') return null
    if (!header.toLowerCase().startsWith('basic ')) return null
    const base64 = header.slice(6).trim()
    if (!base64) return null
    let decoded = ''
    try {
        decoded = Buffer.from(base64, 'base64').toString('utf8')
    } catch {
        return null
    }
    const splitAt = decoded.indexOf(':')
    if (splitAt < 0) return null
    return {
        username: decoded.slice(0, splitAt),
        password: decoded.slice(splitAt + 1),
    }
}

export function isAuthorizedRequest(req, config) {
    if (!config.enabled) return true
    const creds = parseAuthorizationHeader(req?.headers?.authorization)
    if (!creds) return false
    return creds.username === config.username && creds.password === config.password
}

export function sendBasicAuthChallenge(res, config) {
    res.setHeader('WWW-Authenticate', `Basic realm="${config.realm}", charset="UTF-8"`)
    res.status(401).send('Authentication required')
}

export function buildExpressBasicAuthMiddleware(config) {
    return (req, res, next) => {
        if (!config.enabled) return next()
        if (req.path === '/health') return next()
        if (isAuthorizedRequest(req, config)) return next()
        return sendBasicAuthChallenge(res, config)
    }
}
