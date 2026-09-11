export default function VoiceBar({ users, inVoice, muted, onJoin, onLeave, onMute }) {
    const talking = users.filter((u) => u.inVoice)

    return (
        <section className="card voice">
            <div className="voice-row">
                <div>
                    <h2>Room voice</h2>
                    <p className="muted">Speak with everyone in this auction room. Mic stays in the browser.</p>
                </div>
                <div className="actions">
                    {inVoice ? (
                        <>
                            <button type="button" onClick={() => onMute(!muted)}>
                                {muted ? 'Unmute' : 'Mute'}
                            </button>
                            <button type="button" className="danger" onClick={onLeave}>
                                Leave voice
                            </button>
                        </>
                    ) : (
                        <button type="button" className="primary" onClick={onJoin}>
                            Join speaking
                        </button>
                    )}
                </div>
            </div>
            <ul className="voice-people">
                {talking.length === 0 ? <li className="muted">Nobody in voice yet</li> : null}
                {talking.map((u) => (
                    <li key={u.id}>
                        <span className={u.muted ? 'dot muted' : 'dot live'} />
                        {u.name} {u.muted ? '(muted)' : ''}
                    </li>
                ))}
            </ul>
        </section>
    )
}
