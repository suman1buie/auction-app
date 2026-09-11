import { useEffect, useRef, useState } from 'react'
import AuctionRoom from './components/AuctionRoom.jsx'
import Lobby from './components/Lobby.jsx'
import { emitAck, socket } from './lib/socket.js'
import { createVoiceMesh } from './lib/voice.js'

const SESSION_KEY = 'auction-session'

type Session = { code: string; userId: string }
type User = {
  id: string
  name: string
  role: 'auctioneer' | 'presenter' | 'spectator'
}
type AuctionState = {
  code: string
  name: string
  status: string
  settings: { bidTimerSeconds: number; minIncrement: number; defaultBudget: number; autoCloseOnTimeout: boolean }
  players: unknown[]
  teams: unknown[]
  users: unknown[]
  currentLot: unknown
  logs: unknown[]
  minBid: number
  tokens?: Record<string, string>
  accessPassword?: string
}

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

function hasInviteInUrl() {
  const params = new URLSearchParams(window.location.search)
  return Boolean(params.get('code') && params.get('token'))
}

function App() {
  const [state, setState] = useState<AuctionState | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [inVoice, setInVoice] = useState(false)
  const [muted, setMuted] = useState(false)
  const voiceRef = useRef<ReturnType<typeof createVoiceMesh> | null>(null)
  const audioNodes = useRef(new Map<string, HTMLAudioElement>())
  const rejoined = useRef(false)

  useEffect(() => {
    function onState(next: AuctionState) {
      setState(next)
    }
    function onPeerLeft({ userId }: { userId: string }) {
      voiceRef.current?.closePeer(userId)
      const el = audioNodes.current.get(userId)
      if (el) {
        el.srcObject = null
        el.remove()
        audioNodes.current.delete(userId)
      }
    }
    function onSignal(payload: { from: string; data: { type: string } }) {
      voiceRef.current?.handleSignal(payload)
    }

    socket.on('auction:state', onState)
    socket.on('voice:peer-left', onPeerLeft)
    socket.on('voice:signal', onSignal)
    socket.connect()

    return () => {
      socket.off('auction:state', onState)
      socket.off('voice:peer-left', onPeerLeft)
      socket.off('voice:signal', onSignal)
      socket.disconnect()
    }
  }, [])

  useEffect(() => {
    if (rejoined.current || user) return
    if (hasInviteInUrl()) return
    const session = readSession()
    if (!session) return
    rejoined.current = true
    emitAck('auction:rejoin', session)
      .then((res) => {
        setUser(res.user)
        setState(res.state)
      })
      .catch(() => localStorage.removeItem(SESSION_KEY))
  }, [user])

  function persist(nextUser: User, nextState: AuctionState) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ code: nextState.code, userId: nextUser.id }))
    setUser(nextUser)
    setState(nextState)
    setError('')
  }

  async function handleCreate(payload: { name: string; creatorName: string; accessPassword?: string }) {
    setBusy(true)
    setError('')
    try {
      const res = await emitAck('auction:create', payload)
      persist(res.user, res.state)
      window.history.replaceState({}, '', `?code=${res.state.code}&role=auctioneer&token=${res.state.tokens.auctioneer}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create room')
    } finally {
      setBusy(false)
    }
  }

  async function handleJoin(payload: { code: string; token: string; name: string; teamId?: string; password: string }) {
    setBusy(true)
    setError('')
    try {
      const res = await emitAck('auction:join', payload)
      persist(res.user, res.state)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join room')
    } finally {
      setBusy(false)
    }
  }

  async function handleAction(event: string, payload = {}) {
    setError('')
    try {
      await emitAck(event, payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    }
  }

  async function handleVoiceJoin() {
    if (!user) return
    setError('')
    try {
      const mesh = createVoiceMesh({
        socket,
        selfId: user.id,
        onRemoteStream(peerId: string, stream: MediaStream) {
          let el = audioNodes.current.get(peerId)
          if (!el) {
            el = new Audio()
            el.autoplay = true
            audioNodes.current.set(peerId, el)
          }
          el.srcObject = stream
        },
        onPeerGone(peerId: string) {
          const el = audioNodes.current.get(peerId)
          if (el) {
            el.srcObject = null
            audioNodes.current.delete(peerId)
          }
        },
      })
      voiceRef.current = mesh
      await mesh.join()
      setInVoice(true)
      setMuted(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Microphone permission is required for speaking')
    }
  }

  function handleVoiceLeave() {
    voiceRef.current?.leave()
    voiceRef.current = null
    for (const el of audioNodes.current.values()) el.srcObject = null
    audioNodes.current.clear()
    setInVoice(false)
    setMuted(false)
  }

  function handleMute(next: boolean) {
    voiceRef.current?.setMuted(next)
    setMuted(next)
  }

  function handleLeave() {
    handleVoiceLeave()
    localStorage.removeItem(SESSION_KEY)
    setState(null)
    setUser(null)
    window.history.replaceState({}, '', window.location.pathname)
  }

  if (!state || !user) {
    return <Lobby error={error} busy={busy} onCreate={handleCreate} onJoin={handleJoin} />
  }

  return (
    <AuctionRoom
      state={state}
      user={user}
      error={error}
      inVoice={inVoice}
      muted={muted}
      onAction={handleAction}
      onLeave={handleLeave}
      onVoiceJoin={handleVoiceJoin}
      onVoiceLeave={handleVoiceLeave}
      onMute={handleMute}
    />
  )
}

export default App
