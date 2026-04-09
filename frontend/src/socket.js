import { io } from 'socket.io-client'

// 開發時連 localhost:3001，production 時同源
const URL = import.meta.env.DEV ? 'http://localhost:3001' : '/'

export const socket = io(URL, { autoConnect: false })
