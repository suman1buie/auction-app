import { useState } from 'react'
import PlayerAvatar from './PlayerAvatar.jsx'

export default function PlayerDashboard({ players, isAuctioneer, onAdd, onRemove }) {
    const [form, setForm] = useState({ name: '', position: '', basePrice: 10, details: '' })

    return (
        <section className="card">
            <h2>Player pool</h2>
            <p className="muted">Add names and details before the live round. A random available player is called onto the block.</p>

            {isAuctioneer ? (
                <form
                    className="grid-form"
                    onSubmit={(e) => {
                        e.preventDefault()
                        onAdd(form)
                        setForm({ name: '', position: form.position, basePrice: form.basePrice, details: '' })
                    }}
                >
                    <input
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="Player name"
                        required
                    />
                    <input
                        value={form.position}
                        onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
                        placeholder="Role / position"
                    />
                    <input
                        type="number"
                        min="0"
                        value={form.basePrice}
                        onChange={(e) => setForm((f) => ({ ...f, basePrice: e.target.value }))}
                        placeholder="Base price"
                    />
                    <input
                        value={form.details}
                        onChange={(e) => setForm((f) => ({ ...f, details: e.target.value }))}
                        placeholder="Notes / stats"
                    />
                    <button className="primary" type="submit">
                        Add player
                    </button>
                </form>
            ) : null}

            <div className="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Player</th>
                            <th>Role</th>
                            <th>Base</th>
                            <th>Status</th>
                            {isAuctioneer ? <th></th> : null}
                        </tr>
                    </thead>
                    <tbody>
                        {players.length === 0 ? (
                            <tr>
                                <td colSpan={isAuctioneer ? 5 : 4} className="muted table-empty">
                                    No players listed yet.
                                </td>
                            </tr>
                        ) : (
                            players.map((p) => (
                                <tr key={p.id}>
                                    <td data-label="Player">
                                        <div className="player-cell">
                                            <PlayerAvatar player={p} size="sm" />
                                            <div>
                                                <strong>{p.name}</strong>
                                                {p.details ? <div className="tiny">{p.details}</div> : null}
                                            </div>
                                        </div>
                                    </td>
                                    <td data-label="Role">{p.position}</td>
                                    <td data-label="Base">{p.basePrice}</td>
                                    <td data-label="Status">
                                        <span className={`pill ${p.status}`}>{p.status.replace('_', ' ')}</span>
                                    </td>
                                    {isAuctioneer ? (
                                        <td data-label="Action">
                                            {p.status === 'available' ? (
                                                <button type="button" className="ghost danger" onClick={() => onRemove(p.id)}>
                                                    Remove
                                                </button>
                                            ) : null}
                                        </td>
                                    ) : null}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    )
}
