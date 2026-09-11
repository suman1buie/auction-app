import { useState } from 'react'

export default function TeamBoard({ teams, user, defaultBudget, onAdd, onRemove }) {
    const [form, setForm] = useState({ name: '', budget: defaultBudget })
    const isAuctioneer = user.role === 'auctioneer'

    return (
        <section className="card">
            <h2>Teams</h2>
            <p className="muted">Define teams before going live. Presenter links map one presenter to one team.</p>

            {isAuctioneer ? (
                <form
                    className="grid-form"
                    onSubmit={(e) => {
                        e.preventDefault()
                        onAdd(form)
                        setForm({ name: '', budget: defaultBudget })
                    }}
                >
                    <input
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="Team name"
                        required
                    />
                    <input
                        type="number"
                        min="1"
                        value={form.budget}
                        onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
                        placeholder="Purse"
                    />
                    <button className="primary" type="submit">
                        Add team
                    </button>
                </form>
            ) : null}

            <div className="team-grid">
                {teams.length === 0 ? <p className="muted">No teams yet.</p> : null}
                {teams.map((team) => (
                    <article key={team.id} className={team.presenterId === user.id ? 'team mine' : 'team'} style={{ '--team': team.color }}>
                        <header>
                            <h3>{team.name}</h3>
                            <span>
                                {team.remaining} / {team.budget}
                            </span>
                        </header>
                        <p className="tiny">Presenter: {team.presenterName || 'unclaimed'}</p>
                        <ul>
                            {team.squad.length === 0 ? <li className="muted">Empty squad</li> : null}
                            {team.squad.map((s) => (
                                <li key={s.playerId}>
                                    {s.playerName} · {s.amount}
                                </li>
                            ))}
                        </ul>
                        {isAuctioneer ? (
                            <button type="button" className="ghost danger" onClick={() => onRemove(team.id)}>
                                Remove team
                            </button>
                        ) : null}
                    </article>
                ))}
            </div>
        </section>
    )
}
