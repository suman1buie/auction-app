import cors from 'cors'
import express from 'express'
import { existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Server } from 'socket.io'
import {
    addPlayer,
    addTeam,
    callRandomPlayer,
    createAuction,
    getUser,
    joinAuction,
    leaveSocket,
    markUnsold,
    pauseAuction,
    placeBid,
    publicState,
    removePlayer,
    removeTeam,
    resolveInvite,
    resumeAuction,
    seedDemo,
    sellNow,
    startAuction,
    tickLot,
    updateSettings,
    verifyAccessPassword,
} from './auction.js'
import {
    buildExpressBasicAuthMiddleware,
    createBasicAuthConfig,
    isAuthorizedRequest,
} from './basicAuth.js'
import { loadAllAuctions, loadAuction, saveAuction } from './db.js'

const PORT = Number(process.env.PORT) || 3001
const auctions = loadAllAuctions()
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const DIST_DIR = resolve(__dirname, '../dist')
const HAS_DIST = existsSync(DIST_DIR)
const basicAuth = createBasicAuthConfig(process.env)

const app = express()
app.use(cors())
app.use(express.json())
app.use(buildExpressBasicAuthMiddleware(basicAuth))

if (HAS_DIST) {
    app.use(express.static(DIST_DIR))
}

app.get('/health', (_req, res) => {
    res.json({ ok: true })
})

if (HAS_DIST) {
    app.get(/^(?!\/socket\.io).*/, (req, res, next) => {
        if (req.path === '/health') return next()
        res.sendFile(resolve(DIST_DIR, 'index.html'))
    })
}

const httpServer = createServer(app)
const io = new Server(httpServer, {
    cors: { origin: true, methods: ['GET', 'POST'] },
})

io.engine.use((req, _res, next) => {
    if (isAuthorizedRequest(req, basicAuth)) return next()
    const err = new Error('Unauthorized')
    err.data = { status: 401 }
    return next(err)
})

setInterval(() => {
    for (const auction of auctions.values()) {
        const result = tickLot(auction)
        if (result.changed) emitState(auction)
    }
}, 1000)

io.on('connection', (socket) => {
    socket.on('auction:create', (payload, cb) => safe(cb, () => {
        const { auction, creatorId } = createAuction(payload || {})
        auctions.set(auction.code, auction)
        persistAuction(auction)
        const user = getUser(auction, creatorId)
        user.socketId = socket.id
        bindSocket(socket, auction, user)
        return { user, state: publicState(auction, { includeTokens: true }) }
    }))

    socket.on('auction:join', (payload, cb) => safe(cb, () => {
        const { code, token, name, userId, teamId, password } = payload || {}
        const auction = getAuctionByCode(code)
        if (!auction) throw new Error('Auction room not found')
        if (!verifyAccessPassword(auction, password)) throw new Error('Invalid room access password')
        const invite = resolveInvite(auction, { token, teamId })
        if (!invite) throw new Error('Invalid role invite link')
        const user = joinAuction(auction, {
            userId,
            name,
            role: invite.role,
            teamId: invite.teamId,
            socketId: socket.id,
        })
        bindSocket(socket, auction, user)
        emitState(auction)
        return {
            user,
            state: publicState(auction, { includeTokens: user.role === 'auctioneer' }),
        }
    }))

    socket.on('auction:rejoin', (payload, cb) => safe(cb, () => {
        const { code, userId } = payload || {}
        const auction = getAuctionByCode(code)
        if (!auction) throw new Error('Auction room not found')
        const user = getUser(auction, userId)
        if (!user) throw new Error('Session expired, join with your invite link')
        user.socketId = socket.id
        bindSocket(socket, auction, user)
        emitState(auction)
        return {
            user,
            state: publicState(auction, { includeTokens: user.role === 'auctioneer' }),
        }
    }))

    socket.on('player:add', (payload, cb) => withActor(socket, cb, (auction, user) => {
        addPlayer(auction, payload || {}, user)
        emitState(auction)
        return { ok: true }
    }))

    socket.on('player:remove', (payload, cb) => withActor(socket, cb, (auction, user) => {
        removePlayer(auction, payload?.playerId, user)
        emitState(auction)
        return { ok: true }
    }))

    socket.on('team:add', (payload, cb) => withActor(socket, cb, (auction, user) => {
        addTeam(auction, payload || {}, user)
        emitState(auction)
        return { ok: true }
    }))

    socket.on('team:remove', (payload, cb) => withActor(socket, cb, (auction, user) => {
        removeTeam(auction, payload?.teamId, user)
        emitState(auction)
        return { ok: true }
    }))

    socket.on('settings:update', (payload, cb) => withActor(socket, cb, (auction, user) => {
        updateSettings(auction, payload || {}, user)
        emitState(auction)
        return { ok: true }
    }))

    socket.on('auction:start', (_payload, cb) => withActor(socket, cb, (auction, user) => {
        startAuction(auction, user)
        emitState(auction)
        return { ok: true }
    }))

    socket.on('auction:pause', (_payload, cb) => withActor(socket, cb, (auction, user) => {
        pauseAuction(auction, user)
        emitState(auction)
        return { ok: true }
    }))

    socket.on('auction:resume', (_payload, cb) => withActor(socket, cb, (auction, user) => {
        resumeAuction(auction, user)
        emitState(auction)
        return { ok: true }
    }))

    socket.on('lot:call-random', (_payload, cb) => withActor(socket, cb, (auction, user) => {
        callRandomPlayer(auction, user)
        emitState(auction)
        return { ok: true }
    }))

    socket.on('lot:bid', (payload, cb) => withActor(socket, cb, (auction, user) => {
        placeBid(auction, user, payload?.amount)
        emitState(auction)
        return { ok: true }
    }))

    socket.on('lot:sold', (_payload, cb) => withActor(socket, cb, (auction, user) => {
        sellNow(auction, user)
        emitState(auction)
        return { ok: true }
    }))

    socket.on('lot:unsold', (_payload, cb) => withActor(socket, cb, (auction, user) => {
        markUnsold(auction, user)
        emitState(auction)
        return { ok: true }
    }))

    socket.on('demo:seed', (_payload, cb) => withActor(socket, cb, (auction, user) => {
        seedDemo(auction, user)
        emitState(auction)
        return { ok: true }
    }))

    socket.on('voice:join', (_payload, cb) => withActor(socket, cb, (auction, user) => {
        user.inVoice = true
        emitState(auction)
        return {
            peers: auction.users.filter((u) => u.inVoice && u.id !== user.id).map((u) => u.id),
        }
    }))

    socket.on('voice:leave', () => {
        const ctx = socket.data.ctx
        if (!ctx) return
        const { auction, user } = ctx
        user.inVoice = false
        socket.to(auction.code).emit('voice:peer-left', { userId: user.id })
        emitState(auction)
    })

    socket.on('voice:muted', (payload) => {
        const ctx = socket.data.ctx
        if (!ctx) return
        ctx.user.muted = Boolean(payload?.muted)
        emitState(ctx.auction)
    })

    socket.on('voice:signal', (payload) => {
        const ctx = socket.data.ctx
        if (!ctx || !payload?.to || !payload?.data) return
        const target = ctx.auction.users.find((u) => u.id === payload.to)
        if (!target?.socketId) return
        io.to(target.socketId).emit('voice:signal', {
            from: ctx.user.id,
            data: payload.data,
        })
    })

    socket.on('disconnect', () => {
        const ctx = socket.data.ctx
        if (!ctx) return
        const { auction, user } = ctx
        leaveSocket(auction, socket.id)
        socket.to(auction.code).emit('voice:peer-left', { userId: user.id })
        emitState(auction)
    })
})

function bindSocket(socket, auction, user) {
    if (socket.data.ctx?.auction?.code && socket.data.ctx.auction.code !== auction.code) {
        socket.leave(socket.data.ctx.auction.code)
    }
    socket.join(auction.code)
    socket.data.ctx = { auction, user }
}

function emitState(auction) {
    persistAuction(auction)
    const sockets = io.sockets.adapter.rooms.get(auction.code)
    if (!sockets) return
    for (const socketId of sockets) {
        const s = io.sockets.sockets.get(socketId)
        const user = s?.data?.ctx?.user
        s?.emit('auction:state', publicState(auction, { includeTokens: user?.role === 'auctioneer' }))
    }
}

function withActor(socket, cb, fn) {
    safe(cb, () => {
        const ctx = socket.data.ctx
        if (!ctx) throw new Error('Join an auction room first')
        return fn(ctx.auction, ctx.user)
    })
}

function safe(cb, fn) {
    try {
        const result = fn()
        cb?.({ ok: true, ...result })
    } catch (err) {
        cb?.({ ok: false, error: err.message || 'Request failed' })
    }
}

function getAuctionByCode(code) {
    const roomCode = String(code || '').toUpperCase()
    let auction = auctions.get(roomCode)
    if (auction) return auction
    auction = loadAuction(roomCode)
    if (auction) auctions.set(roomCode, auction)
    return auction
}

function persistAuction(auction) {
    saveAuction(auction)
}

httpServer.listen(PORT, () => {
    console.log(`Auction server listening on http://localhost:${PORT}`)
})
