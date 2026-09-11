import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
    addPlayer,
    addTeam,
    callRandomPlayer,
    completeLot,
    createAuction,
    joinAuction,
    minimumBid,
    placeBid,
    resolveInvite,
    sellNow,
    roleFromToken,
    startAuction,
    tickLot,
    verifyAccessPassword,
} from './auction.js'

test('role tokens and team presenter tokens map to invite roles', () => {
    const { auction, creatorId } = createAuction({ name: 'IPL Night', creatorName: 'Host' })
    const host = auction.users.find((u) => u.id === creatorId)
    const team = addTeam(auction, { name: 'Falcons', budget: 100 }, host)

    assert.equal(roleFromToken(auction, auction.tokens.auctioneer), 'auctioneer')
    assert.equal(roleFromToken(auction, auction.tokens.spectator), 'spectator')
    assert.equal(roleFromToken(auction, 'nope'), null)

    assert.deepEqual(resolveInvite(auction, { token: team.presenterToken, teamId: team.id }), {
        role: 'presenter',
        teamId: team.id,
    })
    assert.equal(resolveInvite(auction, { token: team.presenterToken }), null)
})

test('highest presenter bid wins the player', () => {
    const { auction, creatorId } = createAuction({ name: 'Cup', creatorName: 'Host' })
    const host = auction.users.find((u) => u.id === creatorId)
    addPlayer(auction, { name: 'Star', position: 'Batter', basePrice: 10, details: '' }, host)
    addTeam(auction, { name: 'Red', budget: 100 }, host)
    addTeam(auction, { name: 'Blue', budget: 100 }, host)

    const p1 = joinAuction(auction, { name: 'Ann', role: 'presenter', teamId: auction.teams[0].id, socketId: 's1' })
    const p2 = joinAuction(auction, { name: 'Ben', role: 'presenter', teamId: auction.teams[1].id, socketId: 's2' })

    startAuction(auction, host)
    callRandomPlayer(auction, host)
    assert.equal(auction.currentLot.player.name, 'Star')
    assert.equal(minimumBid(auction), 10)

    placeBid(auction, p1, 20)
    placeBid(auction, p2, 35)
    completeLot(auction)

    const sold = auction.players[0]
    assert.equal(sold.status, 'sold')
    assert.equal(sold.soldToTeamId, auction.teams[1].id)
    assert.equal(sold.soldFor, 35)
    assert.equal(auction.teams[1].remaining, 65)
    assert.equal(auction.teams[1].squad.length, 1)
    assert.equal(auction.status, 'completed')
})

test('rejects bids below increment, over purse, or after start team changes', () => {
    const { auction, creatorId } = createAuction({
        name: 'Cup',
        creatorName: 'Host',
        settings: { minIncrement: 5, bidTimerSeconds: 15 },
    })
    const host = auction.users.find((u) => u.id === creatorId)
    addPlayer(auction, { name: 'Ace', position: 'Bowler', basePrice: 10, details: '' }, host)
    addTeam(auction, { name: 'Green', budget: 30 }, host)
    addTeam(auction, { name: 'Gold', budget: 12 }, host)
    const p1 = joinAuction(auction, { name: 'Cara', role: 'presenter', teamId: auction.teams[0].id, socketId: 's1' })
    const p2 = joinAuction(auction, { name: 'Drew', role: 'presenter', teamId: auction.teams[1].id, socketId: 's2' })
    startAuction(auction, host)
    assert.throws(
        () => joinAuction(auction, { name: 'Late captain', role: 'presenter', teamId: auction.teams[0].id, socketId: 's3' }),
        /only spectators can join now/,
    )
    callRandomPlayer(auction, host)
    placeBid(auction, p1, 10)
    assert.throws(() => placeBid(auction, p1, 20), /already leading/)
    assert.throws(() => placeBid(auction, p2, 12), /Minimum bid/)
    assert.throws(() => placeBid(auction, p2, 40), /Not enough purse/)
    assert.throws(() => addTeam(auction, { name: 'Too late', budget: 100 }, host), /after the auction has started/)
})

test('new players get random avatar metadata', () => {
    const { auction, creatorId } = createAuction({ name: 'Avatar Cup', creatorName: 'Host' })
    const host = auction.users.find((u) => u.id === creatorId)
    const player = addPlayer(auction, { name: 'Avatar Test', position: 'Batter', basePrice: 10, details: '' }, host)

    assert.equal(typeof player.avatar?.tone, 'number')
    assert.equal(typeof player.avatar?.pulse, 'number')
    assert.equal(typeof player.avatar?.mark, 'string')
    assert.ok(player.avatar.mark.length >= 1)
})

test('auctioneer can close manually when auto timeout is disabled', () => {
    const { auction, creatorId } = createAuction({
        name: 'Manual Close Cup',
        creatorName: 'Host',
        settings: { bidTimerSeconds: 1, autoCloseOnTimeout: false },
    })
    const host = auction.users.find((u) => u.id === creatorId)
    addPlayer(auction, { name: 'Closer', position: 'Bowler', basePrice: 10, details: '' }, host)
    addTeam(auction, { name: 'Falcons', budget: 100 }, host)
    const presenter = joinAuction(auction, {
        name: 'Presenter',
        role: 'presenter',
        teamId: auction.teams[0].id,
        socketId: 's1',
    })

    startAuction(auction, host)
    callRandomPlayer(auction, host)
    placeBid(auction, presenter, 10)

    const tick = tickLot(auction)
    assert.equal(tick.completed, false)
    assert.equal(auction.currentLot.remainingSeconds, 0)
    assert.ok(auction.currentLot)

    sellNow(auction, host)
    assert.equal(auction.players[0].status, 'sold')
})

test('room access password is generated and validated', () => {
    const { auction } = createAuction({ name: 'Pwd Cup', creatorName: 'Host' })
    assert.equal(typeof auction.accessPassword, 'string')
    assert.ok(auction.accessPassword.length >= 4)
    assert.equal(verifyAccessPassword(auction, auction.accessPassword), true)
    assert.equal(verifyAccessPassword(auction, ` ${auction.accessPassword} `), true)
    assert.equal(verifyAccessPassword(auction, 'wrong-pass'), false)
})

test('auctioneer can set a custom room password', () => {
    const { auction } = createAuction({ name: 'Custom Pass', creatorName: 'Host', accessPassword: 'my123pass' })
    assert.equal(auction.accessPassword, 'my123pass')
    assert.equal(verifyAccessPassword(auction, 'my123pass'), true)
})
