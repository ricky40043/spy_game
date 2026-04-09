export default function VotePanel({ candidates = [], onVote, disabled = false, myVote = null }) {
  const votedCandidate = candidates.find(c => c.playerId === myVote)

  return (
    <div className="space-y-3">
      {myVote ? (
        <div className="text-center py-3 px-4 bg-gray-800 rounded-xl">
          <p className="text-gray-400 text-sm">你已投票給</p>
          <p className="text-white text-xl font-bold mt-1">
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
              className={`w-full text-left px-4 py-3 rounded-xl font-medium transition-colors ${
                myVote === candidate.playerId
                  ? 'bg-blue-600 text-white cursor-default'
                  : disabled || myVote
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-gray-700 text-white hover:bg-gray-600 active:bg-gray-500'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>{candidate.name}</span>
                {myVote === candidate.playerId && (
                  <span className="text-sm text-blue-200">已投票</span>
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
