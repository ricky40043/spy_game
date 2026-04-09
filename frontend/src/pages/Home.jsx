import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { socket } from '../socket.js'
import { getHostId } from '../storage.js'

export default function Home() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const prefilledRoom = searchParams.get('room') || ''

  const [mode, setMode] = useState(null) // null | 'join'
  const [roomInput, setRoomInput] = useState(prefilledRoom)
  const [nameInput, setNameInput] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // 若 URL 已帶 ?room= 直接進入加入模式
  useEffect(() => {
    if (prefilledRoom) {
      setMode('join')
    }
  }, [prefilledRoom])

  function handleCreateRoom() {
    setLoading(true)
    setError('')

    const hostId = getHostId()
    socket.connect()

    function onRoomCreated({ roomId }) {
      socket.off('room_created', onRoomCreated)
      socket.off('error', onError)
      navigate(`/host?room=${roomId}`)
    }

    function onError(data) {
      socket.off('room_created', onRoomCreated)
      socket.off('error', onError)
      setError(data.message || '建立房間失敗')
      setLoading(false)
    }

    socket.on('room_created', onRoomCreated)
    socket.on('error', onError)
    socket.emit('create_room', { hostId })
  }

  function handleJoin() {
    const room = roomInput.trim().toUpperCase()
    const name = nameInput.trim()
    if (!room) {
      setError('請輸入房號')
      return
    }
    if (!name) {
      setError('請輸入暱稱')
      return
    }
    setError('')
    navigate(`/player?room=${room}&name=${encodeURIComponent(name)}`)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Title */}
        <div className="text-center">
          <h1 className="text-5xl font-extrabold mb-2">🕵️</h1>
          <h1 className="text-3xl font-extrabold text-white">誰是臥底</h1>
          <p className="text-gray-400 mt-1 text-sm">多人派對遊戲</p>
        </div>

        {/* Main menu */}
        {!mode && (
          <div className="space-y-3">
            <button
              onClick={handleCreateRoom}
              disabled={loading}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-lg rounded-2xl transition-colors disabled:opacity-50"
            >
              {loading ? '建立中...' : '建立房間（主持人）'}
            </button>
            <button
              onClick={() => setMode('join')}
              className="w-full py-4 bg-gray-700 hover:bg-gray-600 active:bg-gray-800 text-white font-bold text-lg rounded-2xl transition-colors"
            >
              加入房間（玩家）
            </button>
          </div>
        )}

        {/* Join mode */}
        {mode === 'join' && (
          <div className="space-y-3">
            <div>
              <label className="block text-gray-400 text-sm mb-1">4 碼房號</label>
              <input
                type="text"
                value={roomInput}
                onChange={e => setRoomInput(e.target.value.toUpperCase())}
                maxLength={4}
                placeholder="XXXX"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-xl text-white text-center text-2xl font-mono tracking-widest focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1">你的暱稱</label>
              <input
                type="text"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                maxLength={12}
                placeholder="輸入暱稱"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-500"
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
              />
            </div>
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <button
              onClick={handleJoin}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg rounded-2xl transition-colors"
            >
              加入遊戲
            </button>
            {!prefilledRoom && (
              <button
                onClick={() => { setMode(null); setError('') }}
                className="w-full py-3 text-gray-400 hover:text-white transition-colors"
              >
                返回
              </button>
            )}
          </div>
        )}

        {error && mode !== 'join' && (
          <p className="text-red-400 text-sm text-center">{error}</p>
        )}
      </div>
    </div>
  )
}
