import { useState } from 'react'
import { ROLES } from '../types.js'

export default function InviteLinks({ code, tokens, teams, accessPassword }) {
    const [copied, setCopied] = useState('')
    if (!tokens) return null

    const links = [
        ['auctioneer', tokens.auctioneer],
        ['spectator', tokens.spectator],
    ].map(([role, token]) => ({
        role: role,
        key: role,
        label: ROLES[role],
        href: `${window.location.origin}${window.location.pathname}?code=${code}&role=${role}&token=${token}`,
    }))

    const presenterLinks = (teams || [])
        .filter((team) => team.presenterToken)
        .map((team) => ({
            role: 'presenter',
            key: `presenter-${team.id}`,
            label: `${ROLES.presenter} · ${team.name}`,
            href:
                `${window.location.origin}${window.location.pathname}` +
                `?code=${code}&role=presenter&teamId=${team.id}&team=${encodeURIComponent(team.name)}&token=${team.presenterToken}`,
        }))

    const allLinks = [...links, ...presenterLinks]

    async function copy(role, href) {
        await navigator.clipboard.writeText(href)
        setCopied(role)
        setTimeout(() => setCopied(''), 1600)
    }

    async function copyPassword() {
        await navigator.clipboard.writeText(String(accessPassword || ''))
        setCopied('password')
        setTimeout(() => setCopied(''), 1600)
    }

    return (
        <section className="card">
            <h2>Role-based invite links</h2>
            <p className="muted">Share these links. Presenter links are team-bound, so users join directly for that team.</p>
            <div className="password-share">
                <div>
                    <strong>Shared room password</strong>
                    <code>{accessPassword || 'not available'}</code>
                </div>
                <button type="button" onClick={copyPassword}>
                    {copied === 'password' ? 'Copied' : 'Copy password'}
                </button>
            </div>
            {presenterLinks.length === 0 ? (
                <p className="hint">Add teams first to generate presenter links.</p>
            ) : null}
            <ul className="links">
                {allLinks.map((item) => (
                    <li key={item.key}>
                        <div>
                            <strong>{item.label}</strong>
                            <code>{item.href}</code>
                        </div>
                        <button type="button" onClick={() => copy(item.key, item.href)}>
                            {copied === item.key ? 'Copied' : 'Copy'}
                        </button>
                    </li>
                ))}
            </ul>
        </section>
    )
}
