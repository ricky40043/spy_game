import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { socket } from '../socket.js'
import { getPlayerId, savePlayerName, getPlayerName } from '../storage.js'
import { useRoomState } from '../hooks/useRoomState.js'
import WordCard from '../components/WordCard.jsx'
import VotePanel from '../components/VotePanel.jsx'
import GameResult from '../components/GameResult.jsx'

export default function PlayerView() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const roomIdFromURL = searchParams.get('room') || ''
  const nameFromURL = searchParams.get('name') || ''

  const [roomId, setRoomId] = useState(roomIdFromURL)
  const savedName = roomIdFromURL ? getPlayerName(roomIdFromURL) : ''
  const [name, setName] = useState(nameFromURL || savedName)
  const [nameInput, setNameInput] = useState(nameFromURL || savedName)
  const [roomInput, setRoomInput] = useState(roomIdFromURL)
  const [joined, setJoined] = useState(false)
  const [myVote, setMyVote] = useState(null) // playerId voted for
  const [disconnected, setDisconnected] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [showEliminated, setShowEliminated] = useState(false)

  const { roomState, clearError, clearEliminated } = useRoomState()
  const {
    status, players, round, currentSpeakerId, speakerName,
    candidates, tieCandidates, winner, role, word,
    eliminatedPlayer, error
  } = roomState

  const playerId = roomId ? getPlayerId(roomId) : null
  const isMyTurn = joined && currentSpeakerId && currentSpeakerId === playerId
  const myPlayer = players.find(p => p.playerId === playerId)
  const isAlive = myPlayer ? myPlayer.isAlive !== false : true

  // Emit join_room
  function emitJoin(rId, pId, pName) {
    socket.emit('join_room', { roomId: rId, playerId: pId, name: pName })
  }

  // Connect + join on mount (if room and name are both available)
  useEffect(() => {
    if (!roomId || !name) return

    const pId = getPlayerId(roomId)

    function onConnect() {
      setDisconnected(false)
      emitJoin(roomId, pId, name)
    }

    function onDisconnect() {
      setDisconnected(true)
    }

    function onRoomUpdated() {
      setJoined(true)
      savePlayerName(roomId, name)
    }

    function onError(data) {
      setJoinError(data.message || '加入失敗')
    }

    socket.connect()

    if (socket.connected) {
      emitJoin(roomId, pId, name)
    } else {
      socket.on('connect', onConnect)
    }

    socket.on('disconnect', onDisconnect)
    socket.once('room_updated', onRoomUpdated)
    socket.on('error', onError)

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('error', onError)
    }
  }, [roomId, name])

  // Reconnect: re-emit join_room when socket reconnects
  useEffect(() => {
    if (!joined) return

    function onReconnect() {
      setDisconnected(false)
      const pId = getPlayerId(roomId)
      emitJoin(roomId, pId, name || nameFromURL)
    }

    socket.on('connect', onReconnect)
    return () => socket.off('connect', onReconnect)
  }, [joined, roomId, name, nameFromURL])

  // Reset myVote when new voting phase starts
  useEffect(() => {
    if (status === 'voting' || status === 'revoting') {
      setMyVote(null)
    }
  }, [status])

  // Show eliminated modal
  useEffect(() => {
    if (eliminatedPlayer) {
      setShowEliminated(true)
      const timer = setTimeout(() => {
        setShowEliminated(false)
        clearEliminated()
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [eliminatedPlayer, clearEliminated])

  // Auto-dismiss error
  useEffect(() => {
    if (error) {
      const timer = setTimeout(clearError, 4000)
      return () => clearTimeout(timer)
    }
  }, [error, clearError])

  function handleManualJoin() {
    const rId = (roomIdFromURL || roomInput).trim().toUpperCase()
    const pName = nameInput.trim()
    if (!rId) { setJoinError('請輸入房號'); return }
    if (!pName) { setJoinError('請輸入暱稱'); return }
    setJoinError('')
    setRoomId(rId)
    setName(pName)
    // state updates are async; useEffect [roomId, name] will trigger connect+join
  }

  function handleFinishSpeaking() {
    socket.emit('finish_speaking', { roomId })
  }

  function handleVote(targetPlayerId) {
    setMyVote(targetPlayerId)
    socket.emit('vote', { roomId, targetPlayerId })
  }

  // Determine vote candidates for revoting
  const voteCandidates = status === 'revoting' ? tieCandidates : candidates

  const alivePlayers = players.filter(p => p.isAlive !== false)

  function handleLeaveRoom() {
    socket.disconnect()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-700 via-blue-600 to-blue-500 flex flex-col">
      {/* Disconnection Banner */}
      {disconnected && (
        <div className="bg-yellow-500 text-white text-center py-2 text-sm font-medium">
          連線中斷，嘗試重新連線...
        </div>
      )}

      {/* Error Toast */}
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-3 rounded-full shadow-lg z-50 max-w-xs text-center text-sm font-medium">
          {error.message || '發生錯誤'}
        </div>
      )}

      {/* Eliminated Modal */}
      {showEliminated && eliminatedPlayer && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40 px-4">
          <div className="bg-white rounded-2xl p-8 text-center max-w-sm w-full shadow-2xl">
            <p className="text-4xl mb-3">{eliminatedPlayer.playerId === playerId ? '😢' : '🚫'}</p>
            {eliminatedPlayer.playerId === playerId ? (
              <>
                <p className="text-2xl font-bold text-red-500 mb-2">你被淘汰了！</p>
                {eliminatedPlayer.word && <p className="text-gray-400 mt-1">詞：{eliminatedPlayer.word}</p>}
              </>
            ) : (
              <>
                <p className="text-gray-400 mb-1">玩家被淘汰</p>
                <p className="text-2xl font-bold text-gray-800 mb-2">{eliminatedPlayer.name}</p>
                <p className={`text-lg font-semibold ${eliminatedPlayer.role === 'spy' ? 'text-red-500' : 'text-blue-500'}`}>
                  {eliminatedPlayer.role === 'spy' ? '臥底' : eliminatedPlayer.role === 'blank' ? '白板' : '平民'}
                </p>
              </>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 max-w-sm mx-auto w-full px-4 py-6 space-y-4">

        {/* PRE-JOIN: Need to enter name */}
        {!joined && !name && (
          <div className="space-y-4 pt-6">
            <button onClick={() => navigate('/')} className="text-white/80 hover:text-white text-sm font-medium">
              ← 返回主頁
            </button>
            <div className="text-center py-4">
              <p className="text-5xl mb-3">🕵️</p>
              <h1 className="text-3xl font-extrabold text-white">誰是臥底</h1>
              <p className="text-white/70 text-sm mt-1">
                {roomIdFromURL ? `加入房間 ${roomIdFromURL}` : '輸入房號加入遊戲'}
              </p>
            </div>
            <div className="bg-white rounded-2xl shadow-lg p-5 space-y-4">
              {!roomIdFromURL && (
                <div>
                  <label className="block text-gray-500 text-sm mb-1.5 font-medium">4 碼房號</label>
                  <input
                    type="text"
                    value={roomInput}
                    onChange={e => setRoomInput(e.target.value.toUpperCase())}
                    maxLength={4}
                    placeholder="XXXX"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 text-center text-2xl font-mono tracking-widest focus:outline-none focus:border-blue-400"
                  />
                </div>
              )}
              <div>
                <label className="block text-gray-500 text-sm mb-1.5 font-medium">你的暱稱</label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  maxLength={12}
                  placeholder="輸入暱稱"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-blue-400"
                  onKeyDown={e => e.key === 'Enter' && handleManualJoin()}
                  autoFocus
                />
              </div>
              {joinError && <p className="text-red-500 text-sm text-center">{joinError}</p>}
              <button
                onClick={handleManualJoin}
                className="w-full py-3.5 bg-green-500 hover:bg-green-400 text-white font-bold text-lg rounded-full transition-colors"
              >
                加入遊戲
              </button>
            </div>
          </div>
        )}

        {/* PRE-JOIN: Name entered, connecting */}
        {!joined && name && (
          <div className="flex flex-col items-center justify-center pt-32 space-y-4">
            {!joinError && <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin" />}
            {joinError ? (
              <>
                <p className="text-5xl">😕</p>
                <p className="text-red-300 font-semibold">{joinError}</p>
                <button onClick={() => navigate('/')}
                  className="mt-2 px-6 py-3 bg-white text-blue-600 font-bold rounded-full shadow hover:bg-blue-50 transition-colors">
                  返回大廳
                </button>
              </>
            ) : (
              <p className="text-white/80">正在加入房間 {roomId}...</p>
            )}
          </div>
        )}

        {/* JOINED — WAITING */}
        {joined && status === 'waiting' && (
          <div className="space-y-4 pt-4">
            <div className="text-center py-4">
              <p className="text-5xl mb-3">⏳</p>
              <p className="text-white/70 text-sm mb-1">房號</p>
              <span className="bg-white/20 text-white text-2xl font-black tracking-widest px-5 py-2 rounded-2xl inline-block">
                {roomId}
              </span>
              <p className="text-white/80 mt-3">等待房主開始遊戲...</p>
            </div>
            <div className="bg-white rounded-2xl shadow-lg p-4">
              <p className="text-gray-400 text-xs mb-3 font-medium">已加入玩家 ({alivePlayers.length})</p>
              <div className="flex flex-wrap gap-2">
                {players.map(p => (
                  <span key={p.playerId}
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      p.playerId === playerId ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'bg-gray-100 text-gray-600'
                    }`}>
                    {p.name}{p.playerId === playerId && ' (你)'}
                  </span>
                ))}
              </div>
            </div>
            <button onClick={handleLeaveRoom}
              className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-full transition-colors border border-white/20">
              離開房間
            </button>
          </div>
        )}

        {/* PLAYING */}
        {joined && (status === 'playing' || (status === 'revoting' && currentSpeakerId)) && (
          <div className="space-y-4 pt-2">
            {isAlive && role && <WordCard word={word} role={role} />}
            {!isAlive && (
              <div className="bg-white/10 rounded-2xl p-4 text-center border border-white/20">
                <p className="text-white font-bold text-lg">你已被淘汰</p>
                <p className="text-white/60 text-sm mt-1">繼續觀戰</p>
              </div>
            )}
            <div className="bg-white/10 rounded-xl px-4 py-3 text-center border border-white/20">
              <p className="text-white/60 text-xs">第 {round} 輪</p>
              {status === 'revoting' && (
                <p className="text-orange-300 text-sm font-semibold mt-1">平票重新發言</p>
              )}
            </div>
            {isAlive && isMyTurn ? (
              <div className="bg-yellow-400/20 border-2 border-yellow-400 rounded-2xl p-6 text-center space-y-4">
                <p className="text-yellow-300 text-2xl font-extrabold">輪到你發言了！</p>
                <p className="text-white/70 text-sm">描述你的詞，但不能直說</p>
                <button onClick={handleFinishSpeaking}
                  className="w-full py-3 bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold text-lg rounded-full transition-colors">
                  發言完畢
                </button>
              </div>
            ) : (
              <div className="bg-white/10 rounded-xl px-4 py-4 text-center border border-white/20">
                {speakerName
                  ? <p className="text-white/80"><span className="text-white font-bold">{speakerName}</span> 正在發言中...</p>
                  : <p className="text-white/50">等待發言人...</p>}
              </div>
            )}
          </div>
        )}

        {/* REVOTING announcement */}
        {joined && status === 'revoting' && !currentSpeakerId && (
          <div className="space-y-4 pt-2">
            {isAlive && role && <WordCard word={word} role={role} />}
            <div className="bg-orange-400/20 border-2 border-orange-400 rounded-2xl p-6 text-center space-y-3">
              <p className="text-3xl font-bold text-orange-300">平票！</p>
              <p className="text-white/70 text-sm">{roomState.tieReason || '以下玩家將重新發言後再投票'}</p>
              <div className="flex flex-wrap justify-center gap-2 mt-2">
                {tieCandidates.map(c => (
                  <span key={c.playerId} className="bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                    {c.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* VOTING */}
        {joined && status === 'voting' && (
          <div className="space-y-4 pt-2">
            {isAlive && role && <WordCard word={word} role={role} />}
            <div className="bg-white rounded-2xl shadow-lg p-5">
              <h2 className="text-gray-800 font-bold text-lg mb-1">投票</h2>
              <p className="text-gray-400 text-sm mb-4">選出你認為是臥底的玩家</p>
              {isAlive ? (
                <VotePanel
                  candidates={candidates.filter(c => c.playerId !== playerId)}
                  onVote={handleVote}
                  disabled={!isAlive}
                  myVote={myVote}
                />
              ) : (
                <div className="text-center text-gray-400 py-4">你已被淘汰，無法投票</div>
              )}
            </div>
          </div>
        )}

        {/* FINISHED */}
        {joined && status === 'finished' && (
          <GameResult winner={winner} players={players} myPlayerId={playerId} />
        )}
      </div>
    </div>
  )
}
