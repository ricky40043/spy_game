export default function VotePanel({ candidates = [], onVote, disabled = false, myVote = null }) {
  const votedCandidate = candidates.find(c => c.playerId === myVote)

  return (
    <div className="space-y-3">
      {myVote ? (
        <div className="text-center py-3 px-4 bg-blue-50 rounded-xl border border-blue-200">
          <p className="text-gray-400 text-sm">你已投票給</p>
          <p className="text-blue-600 text-xl font-bold mt-1">
            {votedCandidate ? votedCandidate.name : '（已離開）'}
          </p>
        </div>
      ) : (
        <p className="text-gray-400 text-sm text-center mb-2">選擇你認為是臥底的玩家</p>
      )}
      <ul className="space-y-2">
        {candidates.map(candidate => (
          <li key={candidate.playerId}>
            <button
              onClick={() => !disabled && !myVote && onVote && onVote(candidate.playerId)}
              disabled={disabled || !!myVote}
              className={`w-full text-left px-4 py-3 rounded-xl font-medium transition-colors border ${
                myVote === candidate.playerId
                  ? 'bg-blue-500 text-white border-blue-500 cursor-default'
                  : disabled || myVote
                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                  : 'bg-gray-50 text-gray-800 border-gray-200 hover:bg-blue-50 hover:border-blue-300 active:bg-blue-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>{candidate.name}</span>
                {myVote === candidate.playerId && <span className="text-sm text-blue-100">✓ 已投票</span>}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
