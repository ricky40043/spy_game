import { useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

export default function QRScanner({ onResult, onClose }) {
  const scannerRef = useRef(null)
  const startedRef = useRef(false)

  useEffect(() => {
    const scannerId = 'qr-scanner-container'
    const scanner = new Html5Qrcode(scannerId)
    scannerRef.current = scanner

    Html5Qrcode.getCameras()
      .then(cameras => {
        if (!cameras || cameras.length === 0) {
          onClose('找不到相機')
          return
        }
        // Prefer back camera
        const cam = cameras.find(c => /back|rear|environment/i.test(c.label)) || cameras[cameras.length - 1]
        startedRef.current = true
        return scanner.start(
          cam.id,
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            // Stop and return result
            scanner.stop().catch(() => {})
            onResult(decodedText)
          },
          () => {} // ignore frame errors
        )
      })
      .catch(() => onClose('無法存取相機，請確認已授予相機權限'))

    return () => {
      if (startedRef.current && scanner.isScanning) {
        scanner.stop().catch(() => {})
      }
    }
  }, [])

  return (
    <div className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-gray-800 font-bold text-lg">掃描 QR Code</h2>
          <button onClick={() => onClose()} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {/* Camera area */}
        <div className="relative bg-gray-900">
          <div id="qr-scanner-container" className="w-full" />
          {/* Overlay frame */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-52 h-52 border-2 border-white/60 rounded-xl">
              <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-green-400 rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-green-400 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-green-400 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-green-400 rounded-br-lg" />
            </div>
          </div>
        </div>

        <p className="text-gray-400 text-sm text-center py-4 px-4">
          將相機對準主持人螢幕上的 QR Code
        </p>
      </div>
    </div>
  )
}
