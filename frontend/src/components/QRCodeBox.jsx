import { QRCodeSVG } from 'qrcode.react'

export default function QRCodeBox({ url }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="bg-white p-3 rounded-xl shadow-sm inline-block">
        <QRCodeSVG value={url} size={200} />
      </div>
      <p className="text-gray-400 text-xs text-center break-all max-w-xs px-2">{url}</p>
    </div>
  )
}
