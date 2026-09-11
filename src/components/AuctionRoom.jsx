import AuctioneerControls from './AuctioneerControls.jsx'
import InviteLinks from './InviteLinks.jsx'
import LiveFloor from './LiveFloor.jsx'
import PlayerDashboard from './PlayerDashboard.jsx'
import ResultsBoard from './ResultsBoard.jsx'
import TeamBoard from './TeamBoard.jsx'
import VoiceBar from './VoiceBar.jsx'
import { ROLES } from '../types.js'

export default function AuctionRoom({
    state,
    user,
    error,
    inVoice,
    muted,
    onAction,
    onLeave,
    onVoiceJoin,
    onVoiceLeave,
    onMute,
}) {
    const isAuctioneer = user.role === 'auctioneer'
    const isPresenter = user.role === 'presenter'
    const isSpectator = user.role === 'spectator'
    const myTeam = state.teams.find((team) => team.presenterId === user.id)

    return (
        <div className="shell room">
            <header className="topbar">
                <div>
                    <p className="eyebrow">{state.code}</p>
                    <h1>{state.name}</h1>
                </div>
                <div className="who">
                    <span>
                        {user.name} · {ROLES[user.role]}
                    </span>
                    <button type="button" className="ghost" onClick={onLeave}>
                        Leave
                    </button>
                </div>
            </header>

            {error ? <p className="banner error">{error}</p> : null}

            <LiveFloor
                state={state}
                user={user}
                onBid={(amount) => onAction('lot:bid', { amount })}
                onSold={() => onAction('lot:sold')}
                onUnsold={() => onAction('lot:unsold')}
            />
            <VoiceBar users={state.users} inVoice={inVoice} muted={muted} onJoin={onVoiceJoin} onLeave={onVoiceLeave} onMute={onMute} />
            <ResultsBoard players={state.players} teams={state.teams} currentLot={state.currentLot} />

            {isAuctioneer ? (
                <>
                    <InviteLinks code={state.code} tokens={state.tokens} teams={state.teams} accessPassword={state.accessPassword} />
                    <AuctioneerControls
                        state={state}
                        onUpdateSettings={(payload) => onAction('settings:update', payload)}
                        onStart={() => onAction('auction:start')}
                        onPause={() => onAction('auction:pause')}
                        onResume={() => onAction('auction:resume')}
                        onCall={() => onAction('lot:call-random')}
                        onSold={() => onAction('lot:sold')}
                        onUnsold={() => onAction('lot:unsold')}
                        onSeed={() => onAction('demo:seed')}
                    />
                    <PlayerDashboard
                        players={state.players}
                        isAuctioneer={true}
                        onAdd={(payload) => onAction('player:add', payload)}
                        onRemove={(playerId) => onAction('player:remove', { playerId })}
                    />
                    <TeamBoard
                        teams={state.teams}
                        user={user}
                        defaultBudget={state.settings.defaultBudget}
                        onAdd={(payload) => onAction('team:add', payload)}
                        onRemove={(teamId) => onAction('team:remove', { teamId })}
                    />
                </>
            ) : null}

            {isPresenter ? (
                <section className="card role-spotlight">
                    <h2>Presenter desk</h2>
                    {myTeam ? (
                        <p>
                            You are presenting <strong>{myTeam.name}</strong>. Bids use this team's remaining purse: <strong>{myTeam.remaining}</strong>.
                        </p>
                    ) : (
                        <p className="banner error">Team mapping missing. Rejoin with your team presenter link.</p>
                    )}
                </section>
            ) : null}

            {!isAuctioneer ? (
                <TeamBoard
                    teams={state.teams}
                    user={user}
                    defaultBudget={state.settings.defaultBudget}
                    onAdd={null}
                    onRemove={null}
                />
            ) : null}

            {isSpectator ? (
                <section className="card role-spotlight">
                    <h2>Spectator mode</h2>
                    <p className="muted">You can watch every sale live and join speaking. Auction controls are intentionally hidden.</p>
                </section>
            ) : null}

            <section className="card">
                <h2>People in the room</h2>
                <ul className="people">
                    {state.users.map((u) => (
                        <li key={u.id}>
                            <span className={u.online ? 'dot live' : 'dot'} />
                            {u.name} · {ROLES[u.role]}
                            {!u.online ? ' (away)' : ''}
                        </li>
                    ))}
                </ul>
            </section>

            <section className="card">
                <h2>Auction log</h2>
                <ul className="log">
                    {state.logs.map((l) => (
                        <li key={l.id}>{l.message}</li>
                    ))}
                </ul>
            </section>
        </div>
    )
}
