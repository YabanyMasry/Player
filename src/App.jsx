import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useLocalPlayer } from './state/LocalPlayerContext'
import PillNav from './components/PillNav'
import AlbumsPage from './pages/AlbumsPage'
import PlayerPage from './pages/PlayerPage'
import VinylPlayerPage from './pages/VinylPlayerPage'
import SettingsPage from './pages/SettingsPage'
import './App.css'

const navItems = [
  { href: '/albums', label: 'Albums' },
  { href: '/vinyl-player', label: 'Vinyl' },
  { href: '/settings', label: 'Settings' },
]

export default function App() {
  const { libraryPath, isLoadingLibrary, libraryError, refreshLibrary } = useLocalPlayer()
  const location = useLocation()

  return (
    <div className="app">
      <PillNav 
        logo="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='50' fill='%23222' /><path d='M35 25 L75 50 L35 75 Z' fill='%23fff' /></svg>"
        logoAlt="Player Logo"
        items={navItems}
        activeHref={location.pathname}
        className="app-pill-nav"
      />

      <Routes>
        <Route path="/" element={<Navigate to="/albums" replace />} />
        <Route path="/albums" element={<AlbumsPage />} />
        <Route path="/vinyl-player" element={<VinylPlayerPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>

      <footer className="status" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          {libraryError
            ? `Library error: ${libraryError}`
            : libraryPath
              ? `Library: ${libraryPath}`
              : 'Waiting for backend library scan...'}
        </div>
        <button type="button" className="primary" onClick={refreshLibrary} disabled={isLoadingLibrary} style={{ padding: '4px 12px', fontSize: '0.85rem' }}>
          {isLoadingLibrary ? 'Refreshing...' : 'Refresh'}
        </button>
      </footer>
    </div>
  )
}
