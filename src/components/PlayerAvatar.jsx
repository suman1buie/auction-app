function fallbackAvatar(name) {
    const firstChar = String(name || 'P').trim().charAt(0)
    return {
        tone: 0,
        pulse: 0,
        mark: (firstChar || 'P').toUpperCase(),
    }
}

export default function PlayerAvatar({ player, size = 'md' }) {
    const avatar = player?.avatar || fallbackAvatar(player?.name)
    const sizeClass = size === 'lg' ? 'avatar lg' : size === 'sm' ? 'avatar sm' : 'avatar'

    return (
        <div className={`${sizeClass} tone-${avatar.tone ?? 0} pulse-${avatar.pulse ?? 0}`} aria-hidden="true">
            <span className="avatar-mark">{avatar.mark || 'P'}</span>
            <span className="avatar-orbit" />
        </div>
    )
}
