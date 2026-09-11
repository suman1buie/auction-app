import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import Database from 'better-sqlite3'

const DB_PATH = resolve(process.cwd(), 'server/data/auction.sqlite')
mkdirSync(dirname(DB_PATH), { recursive: true })

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')

db.exec(`
CREATE TABLE IF NOT EXISTS auctions (
    code TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at INTEGER NOT NULL
)
`)

const upsertAuctionStmt = db.prepare(`
INSERT INTO auctions (code, data, updated_at)
VALUES (@code, @data, @updatedAt)
ON CONFLICT(code) DO UPDATE SET
  data = excluded.data,
  updated_at = excluded.updated_at
`)

const getAuctionStmt = db.prepare('SELECT data FROM auctions WHERE code = ?')
const listAuctionsStmt = db.prepare('SELECT data FROM auctions')

function sanitizeAuctionForStorage(auction) {
    const copy = JSON.parse(JSON.stringify(auction))
    for (const user of copy.users || []) {
        user.socketId = null
        user.inVoice = false
        user.muted = false
    }
    return copy
}

function hydrateLoadedAuction(auction) {
    auction.settings = auction.settings || {}
    if (!Object.hasOwn(auction.settings, 'autoCloseOnTimeout')) {
        auction.settings.autoCloseOnTimeout = true
    }
    if (!auction.accessPassword) {
        let seed = 0
        for (const ch of String(auction.code || 'ROOM')) {
            seed = (seed * 31 + ch.charCodeAt(0)) % 900000
        }
        auction.accessPassword = String(seed + 100000)
    }
    for (const player of auction.players || []) {
        if (!player.avatar) {
            const firstChar = String(player.name || 'P').trim().charAt(0)
            player.avatar = {
                tone: 0,
                pulse: 0,
                mark: (firstChar || 'P').toUpperCase(),
            }
        }
    }
    for (const user of auction.users || []) {
        user.socketId = null
        user.inVoice = false
        user.muted = false
    }
    return auction
}

export function saveAuction(auction) {
    const safeCopy = sanitizeAuctionForStorage(auction)
    upsertAuctionStmt.run({
        code: safeCopy.code,
        data: JSON.stringify(safeCopy),
        updatedAt: Date.now(),
    })
}

export function loadAuction(code) {
    const row = getAuctionStmt.get(String(code || '').toUpperCase())
    if (!row) return null
    return hydrateLoadedAuction(JSON.parse(row.data))
}

export function loadAllAuctions() {
    const map = new Map()
    const rows = listAuctionsStmt.all()
    for (const row of rows) {
        const auction = hydrateLoadedAuction(JSON.parse(row.data))
        map.set(auction.code, auction)
    }
    return map
}
