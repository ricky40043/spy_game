export default function WordCard({ word, role }) {
  const isBlank = role === 'blank'
  const isSpy = role === 'spy'

  const roleLabel = isBlank ? '白板' : isSpy ? '臥底' : '平民'
  const roleColor = isBlank
    ? 'text-gray-400 border-gray-500'
    : isSpy
    ? 'text-red-400 border-red-500'
    : 'text-blue-400 border-blue-500'

  return (
    <div className={`rounded-2xl border-2 p-6 text-center ${roleColor}`}>
      <p className="text-sm uppercase tracking-widest mb-2 opacity-70">你的角色</p>
      <p className={`text-2xl font-bold mb-4 ${roleColor.split(' ')[0]}`}>{roleLabel}</p>

      <div className="border-t border-current opacity-20 mb-4" />

      {isBlank ? (
        <p className="text-gray-400 text-lg">你是白板，沒有詞彙提示</p>
      ) : (
        <>
          <p className="text-sm uppercase tracking-widest mb-2 opacity-70">你的詞</p>
          <p className="text-4xl font-extrabold">{word}</p>
        </>
      )}
    </div>
  )
}
