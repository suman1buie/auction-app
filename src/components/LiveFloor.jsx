import { useState } from 'react'
import PlayerAvatar from './PlayerAvatar.jsx'

export default function LiveFloor({ state, user, onBid, onSold, onUnsold }) {
    const lot = state.currentLot
    const myTeam = state.teams.find((t) => t.presenterId === user.id)
    const canBid = user.role === 'presenter' && state.status === 'live' && lot && myTeam && myTeam.id !== lot.leadingTeamId
    const manualCloseActive = lot && lot.remainingSeconds <= 0 && !state.settings.autoCloseOnTimeout
    const [amount, setAmount] = useState('')

    const suggested = state.minBid || 0
    const currentValue = lot ? lot.currentBid || lot.player.basePrice : 0
    const valueLift = lot ? currentValue - lot.player.basePrice : 0
    const valueLiftPct = lot && lot.player.basePrice > 0 ? Math.round((valueLift / lot.player.basePrice) * 100) : 0
    const quickSteps = lot ? [0, 1, 2].map((step) => suggested + step * state.settings.minIncrement) : []

    return (
        <section className="card floor">
            <div className="floor-head">
                <h2>Live floor</h2>
                <span className={`pill ${state.status}`}>{state.status}</span>
            </div>

            {!lot ? (
                <p className="muted">
                    {state.status === 'completed'
                        ? 'Auction complete. Every listed player has been through the block.'
                        : 'Waiting for the auctioneer to call a random player onto the block.'}
                </p>
            ) : (
                <div className="lot" key={lot.player.id}>
                    <div>
                        <p className="eyebrow">On the block</p>
                        <div className="lot-player">
                            <PlayerAvatar player={lot.player} size="lg" />
                            <h3>{lot.player.name}</h3>
                        </div>
                        <p>
                            {lot.player.position} · base {lot.player.basePrice}
                        </p>
                        {lot.player.details ? <p className="tiny">{lot.player.details}</p> : null}
                    </div>
                    <div className="clock">
                        <strong>{lot.remainingSeconds}s</strong>
                        <span>bid clock</span>
                    </div>
                    <div className="bid-now">
                        <p className="eyebrow">Current bid</p>
                        <h3>{lot.currentBid || '—'}</h3>
                        <p>{lot.leadingTeamName ? `Leading: ${lot.leadingTeamName}` : 'No bids yet'}</p>
                    </div>
                    <div className="value-card">
                        <p className="eyebrow">Player Value</p>
                        <h3>{currentValue}</h3>
                        <div className="value-row">
                            <span>Base</span>
                            <strong>{lot.player.basePrice}</strong>
                        </div>
                        <div className="value-row">
                            <span>Lift</span>
                            <strong className={valueLift > 0 ? 'up' : ''}>{valueLift > 0 ? `+${valueLift}` : valueLift}</strong>
                        </div>
                        <div className="value-row">
                            <span>Growth</span>
                            <strong className={valueLiftPct > 0 ? 'up' : ''}>{valueLiftPct > 0 ? `+${valueLiftPct}%` : `${valueLiftPct}%`}</strong>
                        </div>
                    </div>
                </div>
            )}

            {user.role === 'presenter' && !myTeam ? (
                <p className="banner">Your presenter invite is not linked to a team. Ask the auctioneer for a valid team presenter link.</p>
            ) : null}

            {manualCloseActive ? (
                <p className="banner">
                    Timer reached zero. Auctioneer can now close this lot with Sold or Unsold.
                </p>
            ) : null}

            {user.role === 'auctioneer' && lot ? (
                <div className="actions lot-actions">
                    <button type="button" className="primary" onClick={onSold}>
                        Sold now
                    </button>
                    <button type="button" className="danger" onClick={onUnsold}>
                        Unsold now
                    </button>
                </div>
            ) : null}

            {canBid ? (
                <form
                    className="bid-bar"
                    onSubmit={(e) => {
                        e.preventDefault()
                        onBid(Number(amount || suggested))
                        setAmount('')
                    }}
                >
                    <input
                        type="number"
                        min={suggested}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder={`Min ${suggested}`}
                    />
                    <button className="primary" type="submit">
                        Bid {amount || suggested}
                    </button>
                    <button type="button" onClick={() => onBid(suggested)}>
                        Quick bid {suggested}
                    </button>
                </form>
            ) : null}

            {canBid ? (
                <div className="bid-quick-row">
                    {quickSteps.map((quickAmount) => (
                        <button key={quickAmount} type="button" className="chip" onClick={() => onBid(quickAmount)}>
                            Jump to {quickAmount}
                        </button>
                    ))}
                </div>
            ) : null}

            {lot?.bids?.length ? (
                <ul className="bids">
                    {lot.bids.map((b) => (
                        <li key={b.id}>
                            <strong>{b.teamName}</strong> {b.amount} <span className="muted">by {b.presenterName}</span>
                        </li>
                    ))}
                </ul>
            ) : null}
        </section>
    )
}
