export default function PlayerList({ players = [], onKick, isHost = false, currentSpeakerId = null }) {
  return (
    <ul className="space-y-2">
      {players.map(player => (
        <li
          key={player.playerId}
          className={`flex items-center justify-between px-3 py-2 rounded-lg ${
            player.isAlive === false ? 'opacity-40' : 'bg-gray-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {/* 在線狀態指示點 */}
            <span
              className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                player.isOnline !== false ? 'bg-green-500' : 'bg-gray-500'
              }`}
            />
            {/* 發言人標記 */}
            {player.playerId === currentSpeakerId && (
              <span className="text-base">💬</span>
            )}
            {/* 玩家名稱 */}
            <span
              className={`text-sm font-medium ${
                player.isAlive === false ? 'line-through text-gray-500' : 'text-white'
              }`}
            >
              {player.name}
            </span>
          </div>

          {/* 踢除按鈕：僅 Host 且玩家離線時顯示 */}
          {isHost && player.isOnline === false && player.isAlive !== false && (
            <button
              onClick={() => onKick && onKick(player.playerId)}
              className="text-xs text-red-400 border border-red-400 rounded px-2 py-0.5 hover:bg-red-400 hover:text-white transition-colors"
            >
              踢除
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}
