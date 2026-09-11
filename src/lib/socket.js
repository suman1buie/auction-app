import { io } from 'socket.io-client'

const URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'

export const socket = io(URL, {
    autoConnect: false,
    transports: ['websocket', 'polling'],
})

export function emitAck(event, payload) {
    return new Promise((resolve, reject) => {
        socket.timeout(8000).emit(event, payload, (err, res) => {
            if (err) {
                reject(new Error('Server did not respond'))
                return
            }
            if (!res?.ok) {
                reject(new Error(res?.error || 'Request failed'))
                return
            }
            resolve(res)
        })
    })
}
