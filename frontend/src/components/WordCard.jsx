export default function WordCard({ word, role }) {
  const isBlank = role === 'blank'

  return (
    <div className="rounded-2xl border-2 border-gray-600 p-6 text-center text-white">
      {isBlank ? (
        <p className="text-gray-400 text-lg">你是白板，沒有詞彙提示</p>
      ) : (
        <>
          <p className="text-sm uppercase tracking-widest mb-3 opacity-50">你的詞</p>
          <p className="text-4xl font-extrabold">{word}</p>
        </>
      )}
    </div>
  )
}
