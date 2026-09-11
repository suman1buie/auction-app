import { useMemo, useState } from 'react'
import { ROLES } from '../types.js'

function parseInvite(raw) {
    const text = (raw || '').trim()
    if (!text) return { code: '', token: '', roleHint: '', teamId: '', teamName: '' }
    try {
        const url = new URL(text, window.location.origin)
        return {
            code: (url.searchParams.get('code') || '').toUpperCase(),
            token: url.searchParams.get('token') || '',
            roleHint: url.searchParams.get('role') || '',
            teamId: url.searchParams.get('teamId') || '',
            teamName: url.searchParams.get('team') || '',
        }
    } catch {
        return { code: text.toUpperCase(), token: '', roleHint: '', teamId: '', teamName: '' }
    }
}

export default function Lobby({ error, busy, onCreate, onJoin }) {
    const [tab, setTab] = useState(() => (window.location.search ? 'join' : 'create'))
    const [name, setName] = useState('')
    const [displayName, setDisplayName] = useState('')
    const [accessPassword, setAccessPassword] = useState('')
    const [joinPassword, setJoinPassword] = useState('')
    const [invite, setInvite] = useState(() => window.location.search || '')
    const parsed = useMemo(() => parseInvite(invite), [invite])

    return (
        <div className="shell lobby">
            <header className="hero">
                <p className="eyebrow">Realtime virtual auction room</p>
                <h1>Live Auction Floor</h1>
                <p className="lede">
                    Create a room, share role-based links, list players, assign team presenters, then run a live bid with voice.
                </p>
            </header>

            <div className="tabs">
                <button className={tab === 'create' ? 'tab on' : 'tab'} onClick={() => setTab('create')} type="button">
                    Create auction
                </button>
                <button className={tab === 'join' ? 'tab on' : 'tab'} onClick={() => setTab('join')} type="button">
                    Join with link
                </button>
            </div>

            {error ? <p className="banner error">{error}</p> : null}

            {tab === 'create' ? (
                <form
                    className="card form"
                    onSubmit={(e) => {
                        e.preventDefault()
                        onCreate({ name, creatorName: displayName, accessPassword })
                    }}
                >
                    <label>
                        Auction name
                        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Friday Night Auction" required />
                    </label>
                    <label>
                        Your name (auctioneer)
                        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Host" required />
                    </label>
                    <label>
                        Shared room password (optional)
                        <input
                            value={accessPassword}
                            onChange={(e) => setAccessPassword(e.target.value)}
                            placeholder="Leave empty to auto-generate"
                        />
                    </label>
                    <button className="primary" disabled={busy} type="submit">
                        {busy ? 'Opening room…' : 'Create virtual room'}
                    </button>
                </form>
            ) : (
                <form
                    className="card form"
                    onSubmit={(e) => {
                        e.preventDefault()
                        onJoin({ ...parsed, name: displayName, password: joinPassword })
                    }}
                >
                    <label>
                        Invite link or room code
                        <input
                            value={invite}
                            onChange={(e) => setInvite(e.target.value)}
                            placeholder="Paste auctioneer / presenter / spectator link"
                            required
                        />
                    </label>
                    <label>
                        Your name
                        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your display name" required />
                    </label>
                    <label>
                        Shared room password
                        <input
                            value={joinPassword}
                            onChange={(e) => setJoinPassword(e.target.value)}
                            placeholder="Enter password from auctioneer"
                            required
                        />
                    </label>
                    {parsed.roleHint ? (
                        <p className="hint">
                            Joining as <strong>{ROLES[parsed.roleHint] || parsed.roleHint}</strong>
                            {parsed.roleHint === 'presenter' && parsed.teamName ? ` for ${parsed.teamName}` : ''}
                            {parsed.code ? ` · room ${parsed.code}` : ''}
                        </p>
                    ) : (
                        <p className="hint">Use a role-based invite link so the app knows if you are auctioneer, presenter, or spectator.</p>
                    )}
                    <button
                        className="primary"
                        disabled={busy || !joinPassword.trim() || !parsed.code || !parsed.token || (parsed.roleHint === 'presenter' && !parsed.teamId)}
                        type="submit"
                    >
                        {busy ? 'Joining…' : 'Enter auction room'}
                    </button>
                </form>
            )}
        </div>
    )
}
