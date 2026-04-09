import { QRCodeSVG } from 'qrcode.react'

export default function QRCodeBox({ url }) {
  return (
    <div className="flex flex-col items-center gap-3 p-4 bg-white rounded-xl">
      <QRCodeSVG value={url} size={200} />
      <p className="text-gray-700 text-sm text-center break-all max-w-xs">{url}</p>
    </div>
  )
}
