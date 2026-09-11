export default function AuctioneerControls({ state, onUpdateSettings, onStart, onPause, onResume, onCall, onSold, onUnsold, onSeed }) {
    const lot = state.currentLot
    const available = state.players.filter((p) => p.status === 'available').length
    const teams = state.teams.length
    const assignedTeams = state.teams.filter((team) => team.presenterId).length
    const needsPresenters = teams > 0 && assignedTeams < teams

    return (
        <section className="card console">
            <div className="console-head">
                <div>
                    <p className="eyebrow">Control deck</p>
                    <h2>Auctioneer Console</h2>
                    <p className="muted">Manage rules, launch the floor, and control each lot from one place.</p>
                </div>
                <div className="console-stats">
                    <div className="console-stat">
                        <span>Status</span>
                        <strong>{state.status}</strong>
                    </div>
                    <div className="console-stat">
                        <span>Available players</span>
                        <strong>{available}</strong>
                    </div>
                    <div className="console-stat">
                        <span>Presenters ready</span>
                        <strong>{assignedTeams}/{teams || 0}</strong>
                    </div>
                </div>
            </div>

            <div className="console-grid">
                <form
                    className="console-rules"
                    onSubmit={(e) => {
                        e.preventDefault()
                        const data = new FormData(e.currentTarget)
                        onUpdateSettings({
                            bidTimerSeconds: Number(data.get('bidTimerSeconds')),
                            minIncrement: Number(data.get('minIncrement')),
                            defaultBudget: Number(data.get('defaultBudget')),
                            autoCloseOnTimeout: Boolean(data.get('autoCloseOnTimeout')),
                        })
                    }}
                >
                    <h3>Auction Rules</h3>
                    <div className="console-fields">
                        <label>
                            Bid clock (sec)
                            <input name="bidTimerSeconds" type="number" min="5" defaultValue={state.settings.bidTimerSeconds} />
                        </label>
                        <label>
                            Min increment
                            <input name="minIncrement" type="number" min="1" defaultValue={state.settings.minIncrement} />
                        </label>
                        <label>
                            Default purse
                            <input name="defaultBudget" type="number" min="1" defaultValue={state.settings.defaultBudget} />
                        </label>
                    </div>

                    <div className="console-rules-footer">
                        <label className="checkbox-row">
                            <input
                                name="autoCloseOnTimeout"
                                type="checkbox"
                                defaultChecked={state.settings.autoCloseOnTimeout !== false}
                            />
                            Auto complete lot on timeout
                        </label>
                        <button type="submit">Save rules</button>
                    </div>
                </form>

                <div className="console-actions-panel">
                    <h3>Live Controls</h3>
                    <div className="console-action-grid">
                        {state.status === 'setup' || state.status === 'paused' ? (
                            <button className="primary" type="button" onClick={state.status === 'paused' ? onResume : onStart}>
                                {state.status === 'paused' ? 'Resume auction' : 'Start live auction'}
                            </button>
                        ) : null}
                        {state.status === 'live' ? (
                            <button type="button" onClick={onPause}>
                                Pause auction
                            </button>
                        ) : null}
                        <button type="button" disabled={state.status !== 'live' || Boolean(lot) || available === 0} onClick={onCall}>
                            Call random player
                        </button>
                        <button type="button" disabled={!lot} onClick={onSold}>
                            Hammer sold
                        </button>
                        <button type="button" className="danger" disabled={!lot} onClick={onUnsold}>
                            Mark unsold
                        </button>
                        <button type="button" className="ghost" onClick={onSeed}>
                            Load demo data
                        </button>
                    </div>

                    {needsPresenters ? (
                        <p className="tiny console-note">Assign a presenter to every team before starting the auction.</p>
                    ) : (
                        <p className="tiny console-note">All teams are presenter-ready.</p>
                    )}
                </div>
            </div>
        </section>
    )
}
