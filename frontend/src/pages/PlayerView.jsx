import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { socket } from '../socket.js'
import { getPlayerId } from '../storage.js'
import { useRoomState } from '../hooks/useRoomState.js'
import WordCard from '../components/WordCard.jsx'
import VotePanel from '../components/VotePanel.jsx'
import GameResult from '../components/GameResult.jsx'

export default function PlayerView() {
  const [searchParams] = useSearchParams()
  const roomIdFromURL = searchParams.get('room') || ''
  const nameFromURL = searchParams.get('name') || ''

  const [roomId, setRoomId] = useState(roomIdFromURL)
  const [name, setName] = useState(nameFromURL)
  const [nameInput, setNameInput] = useState(nameFromURL)
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

  // Connect + join on mount (if room and name are provided via URL)
  useEffect(() => {
    if (!roomId || !nameFromURL) return

    socket.connect()
    const pId = getPlayerId(roomId)

    function onConnect() {
      setDisconnected(false)
      emitJoin(roomId, pId, nameFromURL)
    }

    function onDisconnect() {
      setDisconnected(true)
    }

    function onRoomUpdated() {
      setJoined(true)
    }

    function onError(data) {
      setJoinError(data.message || '加入失敗')
    }

    if (socket.connected) {
      emitJoin(roomId, pId, nameFromURL)
      setJoined(true)
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
  }, [roomId, nameFromURL])

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
    const rId = roomInput.trim().toUpperCase()
    const pName = nameInput.trim()
    if (!rId) { setJoinError('請輸入房號'); return }
    if (!pName) { setJoinError('請輸入暱稱'); return }
    setJoinError('')
    setRoomId(rId)
    setName(pName)

    const pId = getPlayerId(rId)
    socket.connect()

    function onConnect() {
      socket.off('connect', onConnect)
      emitJoin(rId, pId, pName)
    }

    function onRoomUpdated() {
      setJoined(true)
    }

    if (socket.connected) {
      emitJoin(rId, pId, pName)
      setJoined(true)
    } else {
      socket.on('connect', onConnect)
      socket.once('room_updated', onRoomUpdated)
    }
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

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Disconnection Banner */}
      {disconnected && (
        <div className="bg-yellow-600 text-white text-center py-2 text-sm">
          連線中斷，嘗試重新連線...
        </div>
      )}

      {/* Error Toast */}
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-red-700 text-white px-4 py-3 rounded-xl shadow-lg z-50 max-w-xs text-center text-sm">
          {error.message || '發生錯誤'}
        </div>
      )}

      {/* Eliminated Modal */}
      {showEliminated && eliminatedPlayer && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-40 px-4">
          <div className="bg-gray-800 rounded-2xl p-8 text-center max-w-sm w-full shadow-2xl">
            <p className="text-4xl mb-3">{eliminatedPlayer.playerId === playerId ? '😢' : '🚫'}</p>
            {eliminatedPlayer.playerId === playerId ? (
              <>
                <p className="text-2xl font-bold text-red-400 mb-2">你被淘汰了！</p>
                <p className="text-gray-300">身分：{eliminatedPlayer.role === 'spy' ? '臥底' : '平民'}</p>
                {eliminatedPlayer.word && <p className="text-gray-400">詞：{eliminatedPlayer.word}</p>}
              </>
            ) : (
              <>
                <p className="text-gray-400 mb-1">玩家被淘汰</p>
                <p className="text-2xl font-bold text-white mb-2">{eliminatedPlayer.name}</p>
                <p className={`text-lg ${eliminatedPlayer.role === 'spy' ? 'text-red-400' : 'text-blue-400'}`}>
                  {eliminatedPlayer.role === 'spy' ? '臥底' : eliminatedPlayer.role === 'blank' ? '白板' : '平民'}
                </p>
              </>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 max-w-sm mx-auto w-full px-4 py-6 space-y-5">
        {/* PRE-JOIN: No room in URL → manual input */}
        {!joined && !roomIdFromURL && (
          <div className="space-y-4 pt-10">
            <div className="text-center mb-6">
              <h1 className="text-3xl font-extrabold">🕵️ 誰是臥底</h1>
              <p className="text-gray-400 text-sm mt-1">輸入房號加入遊戲</p>
            </div>
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
                onKeyDown={e => e.key === 'Enter' && handleManualJoin()}
              />
            </div>
            {joinError && <p className="text-red-400 text-sm text-center">{joinError}</p>}
            <button
              onClick={handleManualJoin}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg rounded-2xl transition-colors"
            >
              加入遊戲
            </button>
          </div>
        )}

        {/* PRE-JOIN: Has room in URL but waiting for socket to connect + join */}
        {!joined && roomIdFromURL && (
          <div className="flex flex-col items-center justify-center pt-20 space-y-4">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400">等待加入房間 {roomIdFromURL}...</p>
            {joinError && <p className="text-red-400 text-sm">{joinError}</p>}
          </div>
        )}

        {/* JOINED — WAITING */}
        {joined && status === 'waiting' && (
          <div className="text-center pt-8 space-y-4">
            <p className="text-5xl">⏳</p>
            <div>
              <p className="text-gray-400 mb-1">房號</p>
              <p className="text-3xl font-black tracking-widest text-yellow-400">{roomId}</p>
            </div>
            <p className="text-gray-300">已加入 {alivePlayers.length} 名玩家</p>
            <p className="text-gray-500">等待房主開始遊戲...</p>

            <div className="mt-4">
              <p className="text-gray-500 text-xs mb-2">已加入玩家</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {players.map(p => (
                  <span
                    key={p.playerId}
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      p.playerId === playerId ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    {p.name}
                    {p.playerId === playerId && ' (你)'}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PLAYING (normal or revoting re-speak phase) */}
        {joined && (status === 'playing' || (status === 'revoting' && currentSpeakerId)) && (
          <div className="space-y-4">
            {/* Word card — only show if alive */}
            {isAlive && role && (
              <WordCard word={word} role={role} />
            )}

            {/* Eliminated player info */}
            {!isAlive && (
              <div className="bg-gray-800 rounded-2xl p-4 text-center">
                <p className="text-red-400 font-bold text-lg">你已被淘汰</p>
                <p className="text-gray-500 text-sm mt-1">繼續觀戰</p>
              </div>
            )}

            {/* Round info */}
            <div className="bg-gray-800 rounded-xl px-4 py-3 text-center">
              <p className="text-gray-400 text-xs">第 {round} 輪</p>
              {status === 'revoting' && (
                <p className="text-orange-400 text-sm font-semibold mt-1">平票重新發言</p>
              )}
            </div>

            {/* Speaking UI */}
            {isAlive && isMyTurn ? (
              <div className="bg-yellow-900 bg-opacity-40 border border-yellow-500 rounded-2xl p-6 text-center space-y-4">
                <p className="text-yellow-400 text-2xl font-extrabold">輪到你發言了！</p>
                <p className="text-gray-400 text-sm">描述你的詞，但不能直說</p>
                <button
                  onClick={handleFinishSpeaking}
                  className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold text-lg rounded-xl transition-colors"
                >
                  發言完畢
                </button>
              </div>
            ) : (
              <div className="bg-gray-800 rounded-xl px-4 py-4 text-center">
                {speakerName ? (
                  <p className="text-gray-300">
                    <span className="text-white font-bold">{speakerName}</span> 正在發言中...
                  </p>
                ) : (
                  <p className="text-gray-500">等待發言人...</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* REVOTING announcement (waiting for re-speak to begin) */}
        {joined && status === 'revoting' && !currentSpeakerId && (
          <div className="space-y-4">
            {isAlive && role && <WordCard word={word} role={role} />}
            <div className="bg-orange-900 bg-opacity-40 border border-orange-600 rounded-2xl p-6 text-center space-y-3">
              <p className="text-3xl font-bold text-orange-400">平票！</p>
              <p className="text-gray-300 text-sm">
                {roomState.tieReason || '以下玩家將重新發言後再投票'}
              </p>
              <div className="flex flex-wrap justify-center gap-2 mt-2">
                {tieCandidates.map(c => (
                  <span key={c.playerId} className="bg-orange-700 text-white px-3 py-1 rounded-full text-sm font-medium">
                    {c.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* VOTING */}
        {joined && status === 'voting' && (
          <div className="space-y-4">
            {/* Word card */}
            {isAlive && role && (
              <WordCard word={word} role={role} />
            )}

            <div className="bg-gray-800 rounded-2xl p-4">
              <h2 className="text-white font-bold text-lg mb-1">投票</h2>
              <p className="text-gray-400 text-sm mb-4">選出你認為是臥底的玩家</p>

              {isAlive ? (
                <VotePanel
                  candidates={candidates.filter(c => c.playerId !== playerId)}
                  onVote={handleVote}
                  disabled={!isAlive}
                  myVote={myVote}
                />
              ) : (
                <div className="text-center text-gray-500 py-4">
                  你已被淘汰，無法投票
                </div>
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
