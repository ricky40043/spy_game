export default function GameResult({ winner, players = [], myPlayerId = null }) {
  const isCivilian = winner === 'civilians'

  return (
    <div className="space-y-6">
      {/* 勝利方標題 */}
      <div className="text-center py-6">
        <p className="text-lg text-gray-400 mb-2">遊戲結束</p>
        <p
          className={`text-4xl font-extrabold ${
            isCivilian ? 'text-blue-400' : 'text-red-400'
          }`}
        >
          {isCivilian ? '平民勝利！' : '臥底獲勝！'}
        </p>
        <p className="text-gray-500 mt-2 text-sm">
          {isCivilian ? '所有臥底已被淘汰' : '臥底成功存活到最後'}
        </p>
      </div>

      {/* 身分揭露表格 */}
      <div>
        <h3 className="text-gray-400 text-sm uppercase tracking-widest mb-3">身分揭露</h3>
        <div className="space-y-2">
          {players.map(player => {
            const isMe = player.playerId === myPlayerId
            const isSpy = player.role === 'spy'
            const isBlank = player.role === 'blank'
            const isAlive = player.isAlive !== false

            return (
              <div
                key={player.playerId}
                className={`flex items-center justify-between px-4 py-3 rounded-xl ${
                  isMe ? 'ring-2 ring-yellow-500 bg-gray-700' : 'bg-gray-800'
                } ${!isAlive ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center gap-2">
                  {isMe && <span className="text-yellow-400 text-xs font-bold">你</span>}
                  <span className={`font-medium ${!isAlive ? 'line-through text-gray-500' : 'text-white'}`}>
                    {player.name}
                  </span>
                  {!isAlive && <span className="text-xs text-gray-500">（已淘汰）</span>}
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span
                    className={`px-2 py-0.5 rounded font-medium ${
                      isBlank
                        ? 'bg-gray-600 text-gray-300'
                        : isSpy
                        ? 'bg-red-900 text-red-300'
                        : 'bg-blue-900 text-blue-300'
                    }`}
                  >
                    {isBlank ? '白板' : isSpy ? '臥底' : '平民'}
                  </span>
                  {!isBlank && (
                    <span className="text-gray-400">{player.word ?? '—'}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
