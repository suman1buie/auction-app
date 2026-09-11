import PlayerAvatar from './PlayerAvatar.jsx'

function teamNameById(teams, id) {
    const team = teams.find((t) => t.id === id)
    return team ? team.name : 'Unknown team'
}

export default function ResultsBoard({ players, teams, currentLot }) {
    const sold = players.filter((p) => p.status === 'sold')
    const unsold = players.filter((p) => p.status === 'unsold')

    return (
        <section className="card">
            <h2>Live details board</h2>
            <p className="muted">Track who gets sold to which team as bids close in real time.</p>

            {currentLot ? (
                <p className="banner">
                    On the block: <strong>{currentLot.player.name}</strong>
                    {currentLot.leadingTeamName ? ` · leading ${currentLot.leadingTeamName} at ${currentLot.currentBid}` : ' · waiting for first bid'}
                </p>
            ) : null}

            <div className="results-grid">
                <article>
                    <h3>Sold players ({sold.length})</h3>
                    <ul className="results-list">
                        {sold.length === 0 ? <li className="muted">No sold players yet.</li> : null}
                        {sold.map((p) => (
                            <li key={p.id}>
                                <strong className="result-player"><PlayerAvatar player={p} size="sm" />{p.name}</strong>
                                <span>{teamNameById(teams, p.soldToTeamId)} · {p.soldFor}</span>
                            </li>
                        ))}
                    </ul>
                </article>
                <article>
                    <h3>Unsold players ({unsold.length})</h3>
                    <ul className="results-list">
                        {unsold.length === 0 ? <li className="muted">No unsold players yet.</li> : null}
                        {unsold.map((p) => (
                            <li key={p.id}>
                                <strong className="result-player"><PlayerAvatar player={p} size="sm" />{p.name}</strong>
                                <span>{p.position}</span>
                            </li>
                        ))}
                    </ul>
                </article>
            </div>
        </section>
    )
}
