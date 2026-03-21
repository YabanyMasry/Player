import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { useLocalPlayer } from './state/LocalPlayerContext'
import AlbumsPage from './pages/AlbumsPage'
import PlayerPage from './pages/PlayerPage'
import TestPage from './pages/TestPage'
import './App.css'

export default function App() {
  const { libraryPath, isLoadingLibrary, libraryError, refreshLibrary } = useLocalPlayer()

  return (
    <div className="app">
      <header className="topbar">
        <h1>Player</h1>
        <div className="topbar__actions">
          <NavLink to="/albums" className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}>
            Albums
          </NavLink>
          <NavLink to="/player" className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}>
            Player
          </NavLink>
          <NavLink to="/test" className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}>
            Test
          </NavLink>
          <button type="button" className="primary" onClick={refreshLibrary} disabled={isLoadingLibrary}>
            {isLoadingLibrary ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </header>

      <Routes>
        <Route path="/" element={<Navigate to="/albums" replace />} />
        <Route path="/albums" element={<AlbumsPage />} />
        <Route path="/player" element={<PlayerPage />} />
        <Route path="/test" element={<TestPage />} />
      </Routes>

      <footer className="status">
        {libraryError
          ? `Library error: ${libraryError}`
          : libraryPath
            ? `Library: ${libraryPath}`
            : 'Waiting for backend library scan...'}
      </footer>
    </div>
  )
}
