import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home.jsx'
import HostView from './pages/HostView.jsx'
import PlayerView from './pages/PlayerView.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-900 text-white">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/host" element={<HostView />} />
          <Route path="/player" element={<PlayerView />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
