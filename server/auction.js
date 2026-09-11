import { randomBytes } from 'node:crypto'

const TEAM_COLORS = ['#e11d48', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#4f46e5']
const AVATAR_TONES = 8
const AVATAR_PULSES = 3

export function uid(len = 10) {
    return randomBytes(12).toString('base64url').replace(/[^a-zA-Z0-9]/g, 'x').slice(0, len)
}

export function roomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const bytes = randomBytes(6)
    let code = ''
    for (const b of bytes) code += chars[b % chars.length]
    return code
}

export function now() {
    return Date.now()
}

function randomInt(max) {
    return randomBytes(1)[0] % max
}

function generateRoomPassword() {
    return String(100000 + (randomBytes(3).readUIntBE(0, 3) % 900000))
}

function normalizePassword(raw) {
    const value = String(raw || '').trim()
    return value.replace(/\s+/g, '')
}

function buildAvatar(name) {
    const firstChar = String(name || 'P').trim().charAt(0)
    return {
        tone: randomInt(AVATAR_TONES),
        pulse: randomInt(AVATAR_PULSES),
        mark: (firstChar || 'P').toUpperCase(),
    }
}

export function logEvent(auction, message) {
    auction.logs.unshift({ id: uid(8), message, at: now() })
    auction.logs = auction.logs.slice(0, 80)
}

export function createAuction({ name, creatorName, settings = {}, accessPassword }) {
    const code = roomCode()
    const auctioneerToken = uid(12)
    const spectatorToken = uid(12)
    const creatorId = uid(10)

    const requestedPassword = normalizePassword(accessPassword)
    const roomAccessPassword = requestedPassword.length >= 4 ? requestedPassword : generateRoomPassword()

    const auction = {
        id: uid(12),
        name: (name || 'Live Auction').trim(),
        code,
        status: 'setup',
        createdAt: now(),
        tokens: {
            auctioneer: auctioneerToken,
            spectator: spectatorToken,
        },
        settings: {
            bidTimerSeconds: Number(settings.bidTimerSeconds) || 20,
            minIncrement: Number(settings.minIncrement) || 5,
            defaultBudget: Number(settings.defaultBudget) || 1000,
            autoCloseOnTimeout: settings.autoCloseOnTimeout !== false,
        },
        accessPassword: roomAccessPassword,
        players: [],
        teams: [],
        users: [
            {
                id: creatorId,
                name: (creatorName || 'Auctioneer').trim(),
                role: 'auctioneer',
                socketId: null,
                inVoice: false,
                muted: false,
            },
        ],
        currentLot: null,
        logs: [],
    }

    logEvent(auction, `${auction.users[0].name} created the auction room`)
    return { auction, creatorId }
}

export function roleFromToken(auction, token) {
    if (!token) return null
    if (token === auction.tokens.auctioneer) return 'auctioneer'
    if (token === auction.tokens.spectator) return 'spectator'
    return null
}

export function verifyAccessPassword(auction, password) {
    return normalizePassword(password) === normalizePassword(auction.accessPassword)
}

export function resolveInvite(auction, { token, teamId }) {
    const fixedRole = roleFromToken(auction, token)
    if (fixedRole) return { role: fixedRole, teamId: null }
    if (!teamId) return null
    const team = auction.teams.find((t) => t.id === teamId)
    if (!team) return null
    if (token !== team.presenterToken) return null
    return { role: 'presenter', teamId: team.id }
}

export function getUser(auction, userId) {
    return auction.users.find((u) => u.id === userId)
}

export function joinAuction(auction, { userId, name, role, socketId, teamId }) {
    if (userId) {
        const existing = getUser(auction, userId)
        if (existing) {
            existing.socketId = socketId
            existing.name = name?.trim() || existing.name
            if (role && existing.role !== role && role !== 'spectator') {
                // keep original elevated role on reconnect
            }
            if (existing.role === 'presenter' && existing.teamId) {
                const team = auction.teams.find((t) => t.id === existing.teamId)
                if (team && (!team.presenterId || team.presenterId === existing.id)) {
                    team.presenterId = existing.id
                    team.presenterName = existing.name
                }
            }
            return existing
        }
    }

    if (auction.status !== 'setup' && role !== 'spectator') {
        throw new Error('Auction started: only spectators can join now')
    }

    if (role === 'auctioneer' && auction.users.some((u) => u.role === 'auctioneer' && u.socketId)) {
        const extra = {
            id: uid(10),
            name: (name || 'Co-auctioneer').trim(),
            role: 'auctioneer',
            socketId,
            inVoice: false,
            muted: false,
        }
        auction.users.push(extra)
        logEvent(auction, `${extra.name} joined as auctioneer`)
        return extra
    }

    const joinedName = (name || role || 'Guest').trim()
    const user = {
        id: uid(10),
        name: joinedName,
        role: role || 'spectator',
        socketId,
        inVoice: false,
        muted: false,
        teamId: null,
    }

    if (role === 'presenter') {
        if (!teamId) throw new Error('Presenter invite is missing team information')
        const team = auction.teams.find((t) => t.id === teamId)
        if (!team) throw new Error('Team not found for this presenter invite')
        if (team.presenterId && team.presenterId !== user.id) {
            throw new Error(`${team.name} already has a presenter`)
        }
        user.teamId = team.id
        team.presenterId = user.id
        team.presenterName = user.name
        auction.users.push(user)
        logEvent(auction, `${user.name} joined as presenter for ${team.name}`)
        return user
    }

    auction.users.push(user)
    logEvent(auction, `${user.name} joined as ${user.role}`)
    return user
}

export function leaveSocket(auction, socketId) {
    const user = auction.users.find((u) => u.socketId === socketId)
    if (!user) return null
    user.socketId = null
    user.inVoice = false
    return user
}

export function addPlayer(auction, { name, position, basePrice, details }, actor) {
    assertAuctioneer(auction, actor)
    if (auction.status === 'completed') throw new Error('Auction already completed')
    const player = {
        id: uid(10),
        name: String(name || '').trim(),
        position: String(position || 'Player').trim(),
        basePrice: Math.max(0, Number(basePrice) || 0),
        details: String(details || '').trim(),
        avatar: buildAvatar(name),
        status: 'available',
    }
    if (!player.name) throw new Error('Player name is required')
    auction.players.push(player)
    logEvent(auction, `${actor.name} added player ${player.name}`)
    return player
}

export function removePlayer(auction, playerId, actor) {
    assertAuctioneer(auction, actor)
    const player = auction.players.find((p) => p.id === playerId)
    if (!player) throw new Error('Player not found')
    if (player.status === 'on_block') throw new Error('Cannot remove a player currently on the block')
    if (player.status === 'sold') throw new Error('Cannot remove a sold player')
    auction.players = auction.players.filter((p) => p.id !== playerId)
    logEvent(auction, `${actor.name} removed player ${player.name}`)
}

export function addTeam(auction, { name, budget }, actor) {
    assertAuctioneer(auction, actor)
    if (auction.status === 'live' || auction.status === 'completed') {
        throw new Error('Cannot add teams after the auction has started')
    }
    const teamName = String(name || '').trim()
    if (!teamName) throw new Error('Team name is required')
    if (auction.teams.some((t) => t.name.toLowerCase() === teamName.toLowerCase())) {
        throw new Error('Team name already exists')
    }
    const funds = Math.max(1, Number(budget) || auction.settings.defaultBudget)
    const team = {
        id: uid(10),
        name: teamName,
        color: TEAM_COLORS[auction.teams.length % TEAM_COLORS.length],
        budget: funds,
        remaining: funds,
        presenterToken: uid(14),
        presenterId: null,
        presenterName: null,
        squad: [],
    }
    auction.teams.push(team)
    logEvent(auction, `${actor.name} added team ${team.name} with purse ${funds}`)
    return team
}

export function removeTeam(auction, teamId, actor) {
    assertAuctioneer(auction, actor)
    if (auction.status === 'live' || auction.status === 'completed') {
        throw new Error('Cannot remove teams after the auction has started')
    }
    const team = auction.teams.find((t) => t.id === teamId)
    if (!team) throw new Error('Team not found')
    auction.teams = auction.teams.filter((t) => t.id !== teamId)
    logEvent(auction, `${actor.name} removed team ${team.name}`)
}

export function claimTeam(auction, teamId, actor) {
    if (actor.role !== 'presenter') throw new Error('Only presenters can represent a team')
    const team = auction.teams.find((t) => t.id === teamId)
    if (!team) throw new Error('Team not found')
    if (team.presenterId && team.presenterId !== actor.id) {
        throw new Error('This team already has a presenter')
    }
    for (const other of auction.teams) {
        if (other.presenterId === actor.id) {
            other.presenterId = null
            other.presenterName = null
        }
    }
    team.presenterId = actor.id
    team.presenterName = actor.name
    actor.teamId = team.id
    logEvent(auction, `${actor.name} will present for ${team.name}`)
    return team
}

export function updateSettings(auction, patch, actor) {
    assertAuctioneer(auction, actor)
    if (auction.status === 'live' && auction.currentLot) {
        throw new Error('Cannot change rules while a player is on the block')
    }
    if (patch.bidTimerSeconds) auction.settings.bidTimerSeconds = Math.max(5, Number(patch.bidTimerSeconds))
    if (patch.minIncrement) auction.settings.minIncrement = Math.max(1, Number(patch.minIncrement))
    if (patch.defaultBudget) auction.settings.defaultBudget = Math.max(1, Number(patch.defaultBudget))
    if (Object.hasOwn(patch, 'autoCloseOnTimeout')) {
        auction.settings.autoCloseOnTimeout = Boolean(patch.autoCloseOnTimeout)
    }
    logEvent(auction, `${actor.name} updated auction rules`)
}

export function startAuction(auction, actor) {
    assertAuctioneer(auction, actor)
    if (auction.players.filter((p) => p.status === 'available').length === 0) {
        throw new Error('Add at least one player before starting')
    }
    if (auction.teams.length < 1) throw new Error('Add at least one team before starting')
    if (auction.teams.some((team) => !team.presenterId)) {
        throw new Error('Each team needs one presenter before starting the auction')
    }
    auction.status = 'live'
    logEvent(auction, `${actor.name} started the live auction`)
}

export function pauseAuction(auction, actor) {
    assertAuctioneer(auction, actor)
    if (auction.status !== 'live') throw new Error('Auction is not live')
    auction.status = 'paused'
    logEvent(auction, `${actor.name} paused the auction`)
}

export function resumeAuction(auction, actor) {
    assertAuctioneer(auction, actor)
    if (auction.status !== 'paused') throw new Error('Auction is not paused')
    auction.status = 'live'
    logEvent(auction, `${actor.name} resumed the auction`)
}

export function callRandomPlayer(auction, actor) {
    assertAuctioneer(auction, actor)
    if (auction.status !== 'live') throw new Error('Start the auction first')
    if (auction.currentLot) throw new Error('Finish the current bid first')
    const available = auction.players.filter((p) => p.status === 'available')
    if (available.length === 0) throw new Error('No players left to auction')
    const player = available[Math.floor(Math.random() * available.length)]
    player.status = 'on_block'
    auction.currentLot = {
        player: { ...player },
        currentBid: 0,
        leadingTeamId: null,
        leadingTeamName: null,
        leadingPresenterName: null,
        remainingSeconds: auction.settings.bidTimerSeconds,
        timerSeconds: auction.settings.bidTimerSeconds,
        bids: [],
    }
    logEvent(auction, `${player.name} is on the block`)
    return auction.currentLot
}

export function minimumBid(auction) {
    const lot = auction.currentLot
    if (!lot) return 0
    if (lot.currentBid > 0) return lot.currentBid + auction.settings.minIncrement
    return Math.max(lot.player.basePrice || 0, auction.settings.minIncrement)
}

export function placeBid(auction, actor, amount) {
    if (auction.status !== 'live') throw new Error('Auction is not live')
    if (!auction.currentLot) throw new Error('No player is on the block')
    if (actor.role !== 'presenter') throw new Error('Only team presenters can bid')
    const team = auction.teams.find((t) => t.presenterId === actor.id)
    if (!team) throw new Error('Your presenter invite is not linked to any team')
    const bid = Number(amount)
    if (!Number.isFinite(bid) || bid <= 0) throw new Error('Invalid bid amount')
    const min = minimumBid(auction)
    if (bid < min) throw new Error(`Minimum bid is ${min}`)
    if (bid > team.remaining) throw new Error('Not enough purse remaining')
    if (auction.currentLot.leadingTeamId === team.id) throw new Error('Your team is already leading')

    auction.currentLot.currentBid = bid
    auction.currentLot.leadingTeamId = team.id
    auction.currentLot.leadingTeamName = team.name
    auction.currentLot.leadingPresenterName = actor.name
    auction.currentLot.remainingSeconds = auction.settings.bidTimerSeconds
    auction.currentLot.bids.unshift({
        id: uid(8),
        teamId: team.id,
        teamName: team.name,
        presenterName: actor.name,
        amount: bid,
        at: now(),
    })
    logEvent(auction, `${actor.name} (${team.name}) bid ${bid} for ${auction.currentLot.player.name}`)
    return auction.currentLot
}

export function tickLot(auction) {
    if (auction.status !== 'live' || !auction.currentLot) return { changed: false }

    if (!auction.settings.autoCloseOnTimeout && auction.currentLot.remainingSeconds <= 0) {
        return { changed: false, completed: false }
    }

    auction.currentLot.remainingSeconds -= 1
    if (auction.currentLot.remainingSeconds > 0) return { changed: true, completed: false }

    if (!auction.settings.autoCloseOnTimeout) {
        auction.currentLot.remainingSeconds = 0
        return { changed: true, completed: false }
    }

    completeLot(auction, { auto: true })
    return { changed: true, completed: true }
}

export function completeLot(auction, { auto = false, unsold = false, actor = null } = {}) {
    const lot = auction.currentLot
    if (!lot) throw new Error('No player is on the block')
    const player = auction.players.find((p) => p.id === lot.player.id)
    if (!player) throw new Error('Player missing')

    const forceUnsold = unsold || !lot.leadingTeamId
    if (forceUnsold) {
        player.status = 'unsold'
        logEvent(
            auction,
            `${player.name} went unsold${auto ? ' (timer)' : actor ? ` by ${actor.name}` : ''}`,
        )
    } else {
        const team = auction.teams.find((t) => t.id === lot.leadingTeamId)
        player.status = 'sold'
        player.soldToTeamId = team.id
        player.soldFor = lot.currentBid
        team.remaining -= lot.currentBid
        team.squad.push({ playerId: player.id, playerName: player.name, amount: lot.currentBid })
        logEvent(auction, `${player.name} SOLD to ${team.name} for ${lot.currentBid}`)
    }

    auction.currentLot = null
    const remaining = auction.players.some((p) => p.status === 'available')
    if (!remaining) auction.status = 'completed'
    return { player, unsold: forceUnsold }
}

export function sellNow(auction, actor) {
    assertAuctioneer(auction, actor)
    return completeLot(auction, { actor })
}

export function markUnsold(auction, actor) {
    assertAuctioneer(auction, actor)
    return completeLot(auction, { unsold: true, actor })
}

export function seedDemo(auction, actor) {
    assertAuctioneer(auction, actor)
    if (auction.players.length || auction.teams.length) {
        throw new Error('Demo data can only be added to an empty auction')
    }
    const players = [
        ['Aria Sen', 'Batter', 20, 'Right-hand opener, strong in powerplay'],
        ['Kabir Rao', 'All-rounder', 25, 'Seam bowling all-rounder'],
        ['Maya Iyer', 'Bowler', 18, 'Left-arm orthodox, death overs'],
        ['Leo Fernandes', 'Wicketkeeper', 22, 'Keeper-batter, finishing specialist'],
        ['Noor Khan', 'Batter', 15, 'Middle-order anchor'],
        ['Zara Mehta', 'Bowler', 16, 'Express pace, new-ball specialist'],
    ]
    for (const [name, position, basePrice, details] of players) {
        addPlayer(auction, { name, position, basePrice, details }, actor)
    }
    for (const [name, budget] of [
        ['Falcons', 500],
        ['Titans', 500],
        ['Royals', 500],
    ]) {
        addTeam(auction, { name, budget }, actor)
    }
}

export function publicState(auction, { includeTokens = false } = {}) {
    return {
        id: auction.id,
        name: auction.name,
        code: auction.code,
        status: auction.status,
        settings: auction.settings,
        players: auction.players,
        teams: auction.teams.map((team) => ({
            id: team.id,
            name: team.name,
            color: team.color,
            budget: team.budget,
            remaining: team.remaining,
            presenterId: team.presenterId,
            presenterName: team.presenterName,
            presenterToken: includeTokens ? team.presenterToken : undefined,
            squad: team.squad,
        })),
        users: auction.users.map((u) => ({
            id: u.id,
            name: u.name,
            role: u.role,
            teamId: u.teamId || null,
            online: Boolean(u.socketId),
            inVoice: Boolean(u.inVoice),
            muted: Boolean(u.muted),
        })),
        currentLot: auction.currentLot,
        logs: auction.logs,
        minBid: auction.currentLot ? minimumBid(auction) : 0,
        tokens: includeTokens ? auction.tokens : undefined,
        accessPassword: includeTokens ? auction.accessPassword : undefined,
    }
}

function assertAuctioneer(auction, actor) {
    if (!actor || actor.role !== 'auctioneer') {
        throw new Error('Only the auctioneer can do this')
    }
}
