import { useNavigate } from 'react-router-dom'

export default function GameResult({ winner, players = [], myPlayerId = null }) {
  const navigate = useNavigate()
  const isCivilian = winner === 'civilian'
  const isDraw = winner === 'draw'

  const winnerEmoji = isDraw ? '🤝' : isCivilian ? '🎉' : '🕵️'
  const winnerLabel = isDraw ? '平局' : isCivilian ? '平民勝利！' : '臥底獲勝！'
  const winnerColor = isDraw ? 'text-gray-500' : isCivilian ? 'text-blue-600' : 'text-red-500'
  const winnerSub = isDraw ? '由房主結束遊戲' : isCivilian ? '所有臥底已被淘汰' : '臥底成功存活到最後'

  return (
    <div className="space-y-4 pt-2">
      {/* Result banner */}
      <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
        <p className="text-5xl mb-3">{winnerEmoji}</p>
        <p className={`text-3xl font-extrabold ${winnerColor}`}>{winnerLabel}</p>
        <p className="text-gray-400 text-sm mt-1">{winnerSub}</p>
      </div>

      {/* Identity reveal */}
      <div className="bg-white rounded-2xl shadow-lg p-5">
        <h3 className="text-gray-400 text-xs uppercase tracking-widest mb-3 font-medium">身分揭露</h3>
        <div className="space-y-2">
          {players.map(player => {
            const isMe = player.playerId === myPlayerId
            const isSpy = player.role === 'spy'
            const isBlank = player.role === 'blank'
            const alive = player.isAlive !== false
            return (
              <div key={player.playerId}
                className={`flex items-center justify-between px-4 py-3 rounded-xl ${
                  isMe ? 'ring-2 ring-blue-400 bg-blue-50' : 'bg-gray-50'
                } ${!alive ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-2">
                  {isMe && <span className="text-blue-500 text-xs font-bold">你</span>}
                  <span className={`font-medium text-gray-800 ${!alive ? 'line-through text-gray-400' : ''}`}>
                    {player.name}
                  </span>
                  {!alive && <span className="text-xs text-gray-400">（已淘汰）</span>}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className={`px-2 py-0.5 rounded-full font-medium text-xs ${
                    isBlank ? 'bg-gray-200 text-gray-600'
                    : isSpy ? 'bg-red-100 text-red-600'
                    : 'bg-blue-100 text-blue-600'
                  }`}>
                    {isBlank ? '白板' : isSpy ? '臥底' : '平民'}
                  </span>
                  {!isBlank && <span className="text-gray-500 font-medium">{player.word ?? '—'}</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <button onClick={() => navigate('/')}
        className="w-full py-3.5 bg-white text-blue-600 font-bold rounded-full shadow-lg hover:bg-blue-50 transition-colors">
        返回主頁
      </button>
    </div>
  )
}
