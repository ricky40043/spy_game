export default function PlayerList({ players = [], onKick, isHost = false, currentSpeakerId = null }) {
  return (
    <ul className="space-y-2">
      {players.map(player => (
        <li
          key={player.playerId}
          className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${
            player.isAlive === false
              ? 'opacity-40 bg-white/5 border-white/10'
              : 'bg-white/10 border-white/20'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {/* 在線狀態 */}
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
              player.isOnline !== false ? 'bg-green-400' : 'bg-white/30'
            }`} />
            {/* 發言人標記 */}
            {player.playerId === currentSpeakerId && (
              <span className="text-sm">💬</span>
            )}
            {/* 名稱 */}
            <span className={`text-sm font-medium ${
              player.isAlive === false ? 'line-through text-white/30' : 'text-white'
            }`}>
              {player.name}
            </span>
          </div>

          {/* 踢除按鈕 */}
          {isHost && player.isOnline === false && player.isAlive !== false && (
            <button
              onClick={() => onKick && onKick(player.playerId)}
              className="text-xs text-red-300 border border-red-400/50 rounded-full px-2.5 py-0.5 hover:bg-red-400 hover:text-white transition-colors"
            >
              踢除
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}
