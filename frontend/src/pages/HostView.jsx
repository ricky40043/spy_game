import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { socket } from '../socket.js'
import { getHostId } from '../storage.js'
import { useRoomState } from '../hooks/useRoomState.js'
import QRCodeBox from '../components/QRCodeBox.jsx'
import PlayerList from '../components/PlayerList.jsx'
import GameResult from '../components/GameResult.jsx'

export default function HostView() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const roomId = searchParams.get('room') || ''

  const { roomState, clearError, clearEliminated } = useRoomState()
  const { status, players, round, currentSpeakerId, speakerName, spokenThisRound,
          candidates, tieCandidates, tieReason, winner, voteResults, eliminatedPlayer, error } = roomState

  const [spyCount, setSpyCount] = useState(1)
  const [blankCount, setBlankCount] = useState(0)
  const [votedPlayers, setVotedPlayers] = useState([]) // playerIds who have voted
  const [showEliminated, setShowEliminated] = useState(false)
  const [disconnected, setDisconnected] = useState(false)
  const [toast, setToast] = useState('')

  const joinUrl = `${window.location.origin}/player?room=${roomId}`
  const alivePlayers = players.filter(p => p.isAlive !== false)

  const hostId = getHostId()

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2000)
  }

  function handleShareLink() {
    if (navigator.share) {
      navigator.share({ title: '誰是臥底', url: joinUrl }).catch(() => {})
    } else {
      navigator.clipboard.writeText(joinUrl).then(() => {
        showToast('已複製連結！')
      }).catch(() => {
        showToast('複製失敗，請手動複製')
      })
    }
  }

  function handleCopyRoomId() {
    navigator.clipboard.writeText(roomId).then(() => {
      showToast('房號已複製！')
    }).catch(() => {
      showToast('複製失敗')
    })
  }

  function emitRejoinHost() {
    socket.emit('rejoin_host', { roomId, hostId })
  }

  // Connect socket and listen for host-specific events
  useEffect(() => {
    if (!roomId) return

    socket.connect()

    function onDisconnect() { setDisconnected(true) }
    function onConnect() {
      setDisconnected(false)
      emitRejoinHost()
    }

    function onVoteReceived(data) {
      setVotedPlayers(prev => [...new Set([...prev, data.voterId])])
    }

    if (socket.connected) {
      emitRejoinHost()
    } else {
      socket.on('connect', onConnect)
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

  function handleForceNextRound() {
    if (window.confirm('確定重新開始此輪發言？（保留身分和詞彙）')) {
      socket.emit('force_next_round', { roomId })
    }
  }

  function handleForceEndGame() {
    if (window.confirm('確定直接結束遊戲？將以平局計算。')) {
      socket.emit('force_end_game', { roomId })
    }
  }

  // Determine who has spoken this round
  const spokenSet = new Set(spokenThisRound || [])
  const notSpokenYet = alivePlayers.filter(p => !spokenSet.has(p.playerId))

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-700 via-blue-600 to-blue-500 text-white p-6">
      {/* Disconnection Banner */}
      {disconnected && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-white text-center py-2 text-sm z-50 font-medium">
          連線中斷，嘗試重新連線...
        </div>
      )}

      {/* Error Toast */}
      {error && (
        <div className="fixed top-4 right-4 bg-red-500 text-white px-4 py-3 rounded-xl shadow-lg z-50 max-w-xs">
          {error.message || '發生錯誤'}
        </div>
      )}

      {/* Copy/Share Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-5 py-3 rounded-full shadow-lg z-50 text-sm font-medium">
          {toast}
        </div>
      )}

      {/* Eliminated Modal */}
      {showEliminated && eliminatedPlayer && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-40">
          <div className="bg-white rounded-2xl p-8 text-center max-w-sm mx-4 shadow-2xl">
            <p className="text-4xl mb-3">🚫</p>
            <p className="text-gray-500 mb-1">玩家被淘汰</p>
            <p className="text-2xl font-bold text-white mb-2">{eliminatedPlayer.name}</p>
            <p className={`text-lg font-semibold ${eliminatedPlayer.role === 'spy' ? 'text-red-500' : 'text-blue-500'}`}>
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
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="text-white/80 hover:text-white font-medium text-sm transition-colors"
            >
              ← 返回主頁
            </button>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-white/70 text-sm">房號</p>
            <span className="bg-white/20 text-white text-2xl font-black tracking-widest px-4 py-1.5 rounded-2xl">
              {roomId}
            </span>
          </div>
        </div>

        {/* WAITING */}
        {status === 'waiting' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: QR + settings */}
            <div className="space-y-4">
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4">
                <h2 className="text-white/60 text-sm mb-3 font-medium">掃描加入</h2>
                <QRCodeBox url={joinUrl} />
                {/* Share / Copy buttons */}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleShareLink}
                    className="flex-1 py-2.5 bg-green-500 hover:bg-green-400 text-white font-bold rounded-full transition-colors text-sm"
                  >
                    分享連結
                  </button>
                  <button
                    onClick={handleCopyRoomId}
                    className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-full transition-colors text-sm border border-white/30"
                  >
                    複製房號
                  </button>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5 space-y-4">
                <h2 className="text-white font-semibold">遊戲設定</h2>
                <div className="flex items-center gap-3">
                  <label className="text-white/70 text-sm w-20">臥底人數</label>
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, Math.floor(alivePlayers.length / 2))}
                    value={spyCount}
                    onChange={e => setSpyCount(Number(e.target.value))}
                    className="w-20 px-3 py-2 bg-white/10 border border-white/30 rounded-lg text-white text-center"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-white/70 text-sm w-20">白板人數</label>
                  <input
                    type="number"
                    min={0}
                    max={3}
                    value={blankCount}
                    onChange={e => setBlankCount(Number(e.target.value))}
                    className="w-20 px-3 py-2 bg-white/10 border border-white/30 rounded-lg text-white text-center"
                  />
                </div>
                <button
                  onClick={handleStartGame}
                  disabled={alivePlayers.length < 4}
                  className="w-full py-3 bg-green-500 hover:bg-green-400 text-white font-bold rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {alivePlayers.length < 4 ? `至少需要 4 人（目前 ${alivePlayers.length} 人）` : '開始遊戲'}
                </button>
              </div>
            </div>

            {/* Right: Player list */}
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5">
              <h2 className="text-white font-semibold mb-3">
                已加入玩家（{players.length}）
              </h2>
              {players.length === 0 ? (
                <p className="text-white/50 text-sm">等待玩家加入...</p>
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
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 text-center">
                <p className="text-white/50 text-sm mb-1">第 {round} 輪</p>
                <p className="text-gray-500 mb-2">現在發言</p>
                <p className="text-4xl font-extrabold text-yellow-300">{speakerName || '等待中...'}</p>
              </div>
              {/* Host control buttons */}
              <div className="flex gap-3">
                <button onClick={handleForceNextRound}
                  className="flex-1 py-2.5 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold rounded-full transition-colors border border-white/30">
                  重新開始此輪
                </button>
                <button onClick={handleForceEndGame}
                  className="flex-1 py-2.5 bg-red-500/80 hover:bg-red-500 text-white text-sm font-semibold rounded-full transition-colors">
                  直接結束遊戲
                </button>
              </div>

              {/* Spoken / not spoken */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4">
                  <p className="text-white/50 text-xs mb-2 font-medium">已發言</p>
                  <ul className="space-y-1">
                    {alivePlayers.filter(p => spokenSet.has(p.playerId)).map(p => (
                      <li key={p.playerId} className="text-green-300 text-sm font-medium">{p.name}</li>
                    ))}
                    {alivePlayers.filter(p => spokenSet.has(p.playerId)).length === 0 && (
                      <li className="text-white/50 text-sm">尚無人發言</li>
                    )}
                  </ul>
                </div>
                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4">
                  <p className="text-white/50 text-xs mb-2 font-medium">未發言</p>
                  <ul className="space-y-1">
                    {notSpokenYet.map(p => (
                      <li key={p.playerId} className={`text-sm ${p.playerId === currentSpeakerId ? 'text-purple-600 font-bold' : 'text-white/70'}`}>
                        {p.name}
                        {p.playerId === currentSpeakerId && ' 💬'}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Right: player list with kick */}
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5">
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
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6">
              <p className="text-white/50 text-sm mb-1">第 {round} 輪</p>
              <h2 className="text-2xl font-bold text-white mb-1">投票中</h2>
              <p className="text-white/50 text-sm mb-5">
                已投票：{votedPlayers.length} / {alivePlayers.length}
              </p>

              {/* Before all voted: show who has voted */}
              {!voteResults && (
                <ul className="space-y-2">
                  {alivePlayers.map(p => {
                    const hasVoted = votedPlayers.includes(p.playerId)
                    return (
                      <li key={p.playerId} className="flex items-center justify-between bg-white/10 rounded-xl px-4 py-3 border border-white/15">
                        <span className="font-medium text-white">{p.name}</span>
                        <span className={`text-sm font-semibold ${hasVoted ? 'text-green-300' : 'text-white/30'}`}>
                          {hasVoted ? '已投票 ✓' : '未投票'}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}

              {/* After all voted: reveal vote counts */}
              {voteResults && (
                <div>
                  <p className="text-yellow-300 text-sm font-semibold mb-3">計票結果</p>
                  <ul className="space-y-2">
                    {candidates.map(c => {
                      const votes = voteResults[c.playerId] || 0
                      const total = Object.values(voteResults).reduce((a, b) => a + b, 0)
                      const pct = total > 0 ? Math.round((votes / total) * 100) : 0
                      return (
                        <li key={c.playerId} className="bg-white/10 rounded-xl px-4 py-3 border border-white/15">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-medium text-gray-800">{c.name}</span>
                            <span className="text-yellow-300 font-bold">{votes} 票</span>
                          </div>
                          <div className="w-full bg-white/20 rounded-full h-2">
                            <div className="bg-yellow-400 h-2 rounded-full transition-all"
                              style={{ width: `${pct}%` }} />
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}

              <div className="mt-4 flex gap-3">
                <button onClick={handleForceEndGame}
                  className="w-full py-2.5 bg-red-500 hover:bg-red-400 text-white text-sm font-semibold rounded-full transition-colors">
                  直接結束遊戲
                </button>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5">
              <h2 className="text-white font-semibold mb-3">玩家狀態</h2>
              <PlayerList players={players} isHost={false} currentSpeakerId={null} />
            </div>
          </div>
        )}

        {/* REVOTING */}
        {status === 'revoting' && (
          <div className="space-y-4">
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 text-center">
              <p className="text-3xl font-bold text-orange-500 mb-2">平票！</p>
              <p className="text-gray-500 mb-4">{tieReason || '以下玩家重新發言後再投票'}</p>
              <div className="flex flex-wrap justify-center gap-2">
                {tieCandidates.map(c => (
                  <span key={c.playerId} className="bg-orange-100 text-orange-700 px-4 py-2 rounded-full font-medium border border-orange-200">
                    {c.name}
                  </span>
                ))}
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5">
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
