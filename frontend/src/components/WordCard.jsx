export default function WordCard({ word, role }) {
  const isBlank = role === 'blank'

  return (
    <div className={`rounded-2xl shadow-lg p-6 text-center ${isBlank ? 'bg-gray-100' : 'bg-white'}`}>
      {isBlank ? (
        <p className="text-gray-400 text-lg font-medium">你是白板，沒有詞彙提示</p>
      ) : (
        <>
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-3 font-medium">你的詞</p>
          <p className="text-4xl font-extrabold text-gray-800">{word}</p>
        </>
      )}
    </div>
  )
}
