import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { socket } from '../socket.js'
import { getHostId } from '../storage.js'
import { useRoomState } from '../hooks/useRoomState.js'
import QRCodeBox from '../components/QRCodeBox.jsx'
import PlayerList from '../components/PlayerList.jsx'
import GameResult from '../components/GameResult.jsx'

export default function HostView() {
  const [searchParams] = useSearchParams()
  const roomId = searchParams.get('room') || ''

  const { roomState, clearError, clearEliminated } = useRoomState()
  const { status, players, round, currentSpeakerId, speakerName, spokenThisRound,
          candidates, tieCandidates, tieReason, winner, eliminatedPlayer, error } = roomState

  const [spyCount, setSpyCount] = useState(1)
  const [blankCount, setBlankCount] = useState(0)
  const [voteMap, setVoteMap] = useState({}) // { playerId: voteCount }
  const [votedPlayers, setVotedPlayers] = useState([]) // list of playerIds who have voted
  const [showEliminated, setShowEliminated] = useState(false)
  const [disconnected, setDisconnected] = useState(false)

  const joinUrl = `${window.location.origin}/player?room=${roomId}`
  const alivePlayers = players.filter(p => p.isAlive !== false)

  // Connect socket and listen for host-specific events
  useEffect(() => {
    if (!roomId) return

    socket.connect()

    function onDisconnect() { setDisconnected(true) }
    function onConnect() { setDisconnected(false) }

    // Track votes on host side via room_updated or a dedicated vote event
    function onVoteReceived(data) {
      // data: { voterId, targetPlayerId }
      setVotedPlayers(prev => [...new Set([...prev, data.voterId])])
      setVoteMap(prev => ({
        ...prev,
        [data.targetPlayerId]: (prev[data.targetPlayerId] || 0) + 1
      }))
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('vote_received', onVoteReceived)

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('vote_received', onVoteReceived)
    }
  }, [roomId])

  // Reset vote tracking when entering voting phase
  useEffect(() => {
    if (status === 'voting' || status === 'revoting') {
      setVoteMap({})
      setVotedPlayers([])
    }
  }, [status])

  // Show eliminated modal when player eliminated
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

  function handleStartGame() {
    socket.emit('start_game', { roomId, spyCount, blankCount })
  }

  function handleKick(targetPlayerId) {
    socket.emit('kick_player', { roomId, targetPlayerId })
  }

  // Determine who has spoken this round
  const spokenSet = new Set(spokenThisRound || [])
  const notSpokenYet = alivePlayers.filter(p => !spokenSet.has(p.playerId))

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Disconnection Banner */}
      {disconnected && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-600 text-white text-center py-2 text-sm z-50">
          連線中斷，嘗試重新連線...
        </div>
      )}

      {/* Error Toast */}
      {error && (
        <div className="fixed top-4 right-4 bg-red-700 text-white px-4 py-3 rounded-xl shadow-lg z-50 max-w-xs">
          {error.message || '發生錯誤'}
        </div>
      )}

      {/* Eliminated Modal */}
      {showEliminated && eliminatedPlayer && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-40">
          <div className="bg-gray-800 rounded-2xl p-8 text-center max-w-sm mx-4 shadow-2xl">
            <p className="text-4xl mb-3">🚫</p>
            <p className="text-gray-400 mb-1">玩家被淘汰</p>
            <p className="text-2xl font-bold text-white mb-2">{eliminatedPlayer.name}</p>
            <p className={`text-lg font-semibold ${eliminatedPlayer.role === 'spy' ? 'text-red-400' : 'text-blue-400'}`}>
              {eliminatedPlayer.role === 'spy' ? '臥底' : eliminatedPlayer.role === 'blank' ? '白板' : '平民'}
            </p>
            {eliminatedPlayer.word && (
              <p className="text-gray-400 mt-1">詞：{eliminatedPlayer.word}</p>
            )}
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-extrabold">誰是臥底</h1>
            <p className="text-gray-400 text-sm">主持人視角</p>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-xs mb-0.5">房號</p>
            <p className="text-4xl font-black tracking-widest text-yellow-400">{roomId}</p>
          </div>
        </div>

        {/* WAITING */}
        {status === 'waiting' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: QR + settings */}
            <div className="space-y-4">
              <div>
                <h2 className="text-gray-400 text-sm mb-3">掃描加入</h2>
                <QRCodeBox url={joinUrl} />
              </div>

              <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                <h2 className="text-white font-semibold">遊戲設定</h2>
                <div className="flex items-center gap-3">
                  <label className="text-gray-400 text-sm w-20">臥底人數</label>
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, Math.floor(alivePlayers.length / 2))}
                    value={spyCount}
                    onChange={e => setSpyCount(Number(e.target.value))}
                    className="w-20 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-center"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-gray-400 text-sm w-20">白板人數</label>
                  <input
                    type="number"
                    min={0}
                    max={3}
                    value={blankCount}
                    onChange={e => setBlankCount(Number(e.target.value))}
                    className="w-20 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-center"
                  />
                </div>
                <button
                  onClick={handleStartGame}
                  disabled={alivePlayers.length < 4}
                  className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {alivePlayers.length < 4 ? `至少需要 4 人（目前 ${alivePlayers.length} 人）` : '開始遊戲'}
                </button>
              </div>
            </div>

            {/* Right: Player list */}
            <div className="bg-gray-800 rounded-xl p-4">
              <h2 className="text-white font-semibold mb-3">
                已加入玩家（{players.length}）
              </h2>
              {players.length === 0 ? (
                <p className="text-gray-500 text-sm">等待玩家加入...</p>
              ) : (
                <PlayerList
                  players={players}
                  onKick={handleKick}
                  isHost={true}
                  currentSpeakerId={null}
                />
              )}
            </div>
          </div>
        )}

        {/* PLAYING */}
        {status === 'playing' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Center: Speaker highlight */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-gray-800 rounded-2xl p-6 text-center">
                <p className="text-gray-400 text-sm mb-1">第 {round} 輪</p>
                <p className="text-gray-400 mb-2">現在發言</p>
                <p className="text-4xl font-extrabold text-yellow-400">{speakerName || '等待中...'}</p>
              </div>

              {/* Spoken / not spoken */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-800 rounded-xl p-3">
                  <p className="text-gray-400 text-xs mb-2">已發言</p>
                  <ul className="space-y-1">
                    {alivePlayers.filter(p => spokenSet.has(p.playerId)).map(p => (
                      <li key={p.playerId} className="text-green-400 text-sm">{p.name}</li>
                    ))}
                    {alivePlayers.filter(p => spokenSet.has(p.playerId)).length === 0 && (
                      <li className="text-gray-600 text-sm">尚無人發言</li>
                    )}
                  </ul>
                </div>
                <div className="bg-gray-800 rounded-xl p-3">
                  <p className="text-gray-400 text-xs mb-2">未發言</p>
                  <ul className="space-y-1">
                    {notSpokenYet.map(p => (
                      <li key={p.playerId} className={`text-sm ${p.playerId === currentSpeakerId ? 'text-yellow-400 font-bold' : 'text-gray-300'}`}>
                        {p.name}
                        {p.playerId === currentSpeakerId && ' 💬'}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Right: player list with kick */}
            <div className="bg-gray-800 rounded-xl p-4">
              <h2 className="text-white font-semibold mb-3">玩家（{alivePlayers.length} 存活）</h2>
              <PlayerList
                players={players}
                onKick={handleKick}
                isHost={true}
                currentSpeakerId={currentSpeakerId}
              />
            </div>
          </div>
        )}

        {/* VOTING */}
        {status === 'voting' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gray-800 rounded-2xl p-6">
              <p className="text-gray-400 text-sm mb-1">第 {round} 輪</p>
              <h2 className="text-2xl font-bold text-white mb-4">投票中</h2>
              <p className="text-gray-400 text-sm mb-4">
                已投票：{votedPlayers.length} / {alivePlayers.length}
              </p>
              <ul className="space-y-2">
                {candidates.map(c => {
                  const votes = voteMap[c.playerId] || 0
                  const totalVoted = Object.values(voteMap).reduce((a, b) => a + b, 0)
                  const pct = totalVoted > 0 ? Math.round((votes / totalVoted) * 100) : 0
                  return (
                    <li key={c.playerId} className="bg-gray-700 rounded-xl px-4 py-3">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium">{c.name}</span>
                        <span className="text-yellow-400 font-bold">{votes} 票</span>
                      </div>
                      {totalVoted > 0 && (
                        <div className="w-full bg-gray-600 rounded-full h-1.5">
                          <div
                            className="bg-yellow-400 h-1.5 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
            <div className="bg-gray-800 rounded-xl p-4">
              <h2 className="text-white font-semibold mb-3">玩家狀態</h2>
              <PlayerList players={players} isHost={false} currentSpeakerId={null} />
            </div>
          </div>
        )}

        {/* REVOTING */}
        {status === 'revoting' && (
          <div className="space-y-4">
            <div className="bg-orange-900 bg-opacity-40 border border-orange-600 rounded-2xl p-6 text-center">
              <p className="text-3xl font-bold text-orange-400 mb-2">平票！</p>
              <p className="text-gray-300 mb-4">{tieReason || '以下玩家重新發言後再投票'}</p>
              <div className="flex flex-wrap justify-center gap-2">
                {tieCandidates.map(c => (
                  <span key={c.playerId} className="bg-orange-700 text-white px-4 py-2 rounded-full font-medium">
                    {c.name}
                  </span>
                ))}
              </div>
            </div>
            <div className="bg-gray-800 rounded-xl p-4">
              <h2 className="text-white font-semibold mb-3">玩家狀態</h2>
              <PlayerList players={players} isHost={false} currentSpeakerId={currentSpeakerId} />
            </div>
          </div>
        )}

        {/* FINISHED */}
        {status === 'finished' && (
          <GameResult winner={winner} players={players} myPlayerId={null} />
        )}
      </div>
    </div>
  )
}
