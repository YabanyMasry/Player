import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { LocalPlayerProvider } from './state/LocalPlayerContext'
import { SpotifyPlayerProvider } from './state/SpotifyPlayerContext'
import './index.css'

const PlayerProvider = import.meta.env.VITE_PLAYER_MODE === 'spotify'
  ? SpotifyPlayerProvider
  : LocalPlayerProvider

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <PlayerProvider>
        <App />
      </PlayerProvider>
    </BrowserRouter>
  </StrictMode>
)
