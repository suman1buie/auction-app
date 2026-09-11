const ICE = [{ urls: 'stun:stun.l.google.com:19302' }]

export function createVoiceMesh({ socket, selfId, onRemoteStream, onPeerGone }) {
    const peers = new Map()
    let localStream = null
    let joined = false

    async function ensureStream() {
        if (localStream) return localStream
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
            video: false,
        })
        return localStream
    }

    function pcFor(peerId) {
        let entry = peers.get(peerId)
        if (entry) return entry
        const pc = new RTCPeerConnection({ iceServers: ICE })
        entry = { pc, makingOffer: false }
        peers.set(peerId, entry)

        if (localStream) {
            for (const track of localStream.getTracks()) pc.addTrack(track, localStream)
        }

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('voice:signal', { to: peerId, data: { type: 'ice', candidate: event.candidate } })
            }
        }

        pc.ontrack = (event) => {
            const stream = event.streams[0] || new MediaStream([event.track])
            onRemoteStream?.(peerId, stream)
        }

        pc.onconnectionstatechange = () => {
            if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
                closePeer(peerId)
            }
        }

        return entry
    }

    async function call(peerId) {
        const entry = pcFor(peerId)
        try {
            entry.makingOffer = true
            const offer = await entry.pc.createOffer()
            await entry.pc.setLocalDescription(offer)
            socket.emit('voice:signal', { to: peerId, data: { type: 'offer', sdp: entry.pc.localDescription } })
        } finally {
            entry.makingOffer = false
        }
    }

    async function handleSignal({ from, data }) {
        if (!joined || from === selfId) return
        const entry = pcFor(from)
        const pc = entry.pc
        if (data.type === 'offer') {
            await pc.setRemoteDescription(data.sdp)
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            socket.emit('voice:signal', { to: from, data: { type: 'answer', sdp: pc.localDescription } })
        } else if (data.type === 'answer') {
            await pc.setRemoteDescription(data.sdp)
        } else if (data.type === 'ice' && data.candidate) {
            try {
                await pc.addIceCandidate(data.candidate)
            } catch {
                /* ignore late ICE */
            }
        }
    }

    function closePeer(peerId) {
        const entry = peers.get(peerId)
        if (!entry) return
        entry.pc.close()
        peers.delete(peerId)
        onPeerGone?.(peerId)
    }

    async function join() {
        await ensureStream()
        joined = true
        const res = await new Promise((resolve, reject) => {
            socket.timeout(8000).emit('voice:join', {}, (err, data) => {
                if (err || !data?.ok) reject(new Error(data?.error || 'Could not join voice'))
                else resolve(data)
            })
        })
        for (const peerId of res.peers || []) await call(peerId)
        return localStream
    }

    function setMuted(muted) {
        if (!localStream) return
        for (const track of localStream.getAudioTracks()) track.enabled = !muted
        socket.emit('voice:muted', { muted })
    }

    function leave() {
        joined = false
        socket.emit('voice:leave')
        for (const peerId of [...peers.keys()]) closePeer(peerId)
        if (localStream) {
            for (const track of localStream.getTracks()) track.stop()
            localStream = null
        }
    }

    return { join, leave, setMuted, handleSignal, closePeer, call }
}
