import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { socket } from '../socket.js'
import { getHostId } from '../storage.js'
import QRScanner from '../components/QRScanner.jsx'

export default function Home() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const prefilledRoom = searchParams.get('room') || ''

  const [mode, setMode] = useState(null) // null | 'join'
  const [showScanner, setShowScanner] = useState(false)
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

  function handleScanResult(text) {
    setShowScanner(false)
    try {
      const url = new URL(text)
      const room = url.searchParams.get('room')
      if (room) {
        // URL contains room code — go to player join page
        navigate(`/player?room=${room.toUpperCase()}`)
      } else {
        // Might be just a room code text
        setRoomInput(text.trim().toUpperCase())
        setMode('join')
      }
    } catch {
      // Not a URL, treat as room code
      setRoomInput(text.trim().toUpperCase())
      setMode('join')
    }
  }

  function handleScanClose(errMsg) {
    setShowScanner(false)
    if (errMsg) setError(errMsg)
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
    <div className="min-h-screen bg-gradient-to-br from-purple-700 via-blue-600 to-blue-500 flex flex-col items-center justify-center px-4">
      {showScanner && <QRScanner onResult={handleScanResult} onClose={handleScanClose} />}
      <div className="w-full max-w-sm space-y-6">
        {/* Title */}
        <div className="text-center mb-2">
          <div className="text-6xl mb-2">🕵️</div>
          <h1 className="text-4xl font-extrabold text-white">誰是臥底</h1>
          <p className="text-white/70 mt-1 text-sm">多人推理派對遊戲</p>
        </div>

        {/* Main menu */}
        {!mode && (
          <div className="space-y-3">
            {/* 創建房間 */}
            <div className="bg-white rounded-2xl shadow-lg px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🏠</span>
                <div>
                  <p className="font-bold text-gray-800 text-base">創建房間</p>
                  <p className="text-gray-500 text-xs">成為主持人，開始新遊戲</p>
                </div>
              </div>
              <button
                onClick={handleCreateRoom}
                disabled={loading}
                className="px-5 py-2 bg-green-500 hover:bg-green-400 active:bg-green-600 text-white font-bold rounded-full transition-colors disabled:opacity-50 text-sm whitespace-nowrap"
              >
                {loading ? '建立中...' : '創建'}
              </button>
            </div>

            {/* 加入房間 */}
            <div className="bg-white rounded-2xl shadow-lg px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">👥</span>
                <div>
                  <p className="font-bold text-gray-800 text-base">加入房間</p>
                  <p className="text-gray-500 text-xs">輸入房間代碼參與遊戲</p>
                </div>
              </div>
              <button
                onClick={() => setMode('join')}
                className="px-5 py-2 bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-800 font-bold rounded-full transition-colors text-sm border border-gray-300 whitespace-nowrap"
              >
                加入
              </button>
            </div>

            {/* 掃描加入 */}
            <div className="bg-white rounded-2xl shadow-lg px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📷</span>
                <div>
                  <p className="font-bold text-gray-800 text-base">掃描加入</p>
                  <p className="text-gray-500 text-xs">使用相機掃描 QR Code</p>
                </div>
              </div>
              <button
                onClick={() => setShowScanner(true)}
                className="px-5 py-2 bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-800 font-bold rounded-full transition-colors text-sm border border-gray-300 whitespace-nowrap"
              >
                掃描
              </button>
            </div>

            {error && <p className="text-red-200 text-sm text-center">{error}</p>}
          </div>
        )}

        {/* Join mode */}
        {mode === 'join' && (
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => { setMode(null); setError('') }}
                className="text-gray-500 hover:text-gray-700 font-medium text-sm transition-colors"
              >
                ← 返回
              </button>
              <h2 className="text-gray-800 font-bold text-lg ml-auto mr-auto pr-10">加入房間</h2>
            </div>
            <div>
              <label className="block text-gray-500 text-sm mb-1">4 碼房號</label>
              <input
                type="text"
                value={roomInput}
                onChange={e => setRoomInput(e.target.value.toUpperCase())}
                maxLength={4}
                placeholder="XXXX"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 text-center text-2xl font-mono tracking-widest focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="block text-gray-500 text-sm mb-1">你的暱稱</label>
              <input
                type="text"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                maxLength={12}
                placeholder="輸入暱稱"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
              />
            </div>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button
              onClick={handleJoin}
              className="w-full py-3 bg-green-500 hover:bg-green-400 text-white font-bold text-base rounded-full transition-colors"
            >
              加入遊戲
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
