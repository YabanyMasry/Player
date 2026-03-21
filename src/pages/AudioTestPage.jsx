import { useLocalPlayer } from '../state/LocalPlayerContext'
import { useState } from 'react'
import {
  ELPlayerProvider,
  ELPlayButton,
  ELProgress,
  ELTime,
  ELDuration,
  ELSpeedControl,
  useELPlayer,
  useELPlayerTime,
  exampleTracks,
} from '../components/ElevenLabsPlayer'
import { Matrix, digits, wave, loader, pulse, snake, vu } from '../components/ElevenLabsMatrix'
import { Orb } from '../components/ElevenLabsOrb'
import { LiveWaveform } from '../components/ElevenLabsLiveWaveform'
import './AudioTestPage.css'

/* ── custom hook demo (must be inside provider) ──────────────── */

function HookDemo() {
  const player = useELPlayer()
  const time = useELPlayerTime()
  const pct = player.duration ? ((time / player.duration) * 100).toFixed(1) : '0.0'

  return (
    <div className="at-hook-demo">
      <div className="at-hook-row">
        <span className="at-hook-label">Active</span>
        <span className="at-hook-value">
          {player.activeItem?.data?.title || player.activeItem?.id || '—'}
        </span>
      </div>
      <div className="at-hook-row">
        <span className="at-hook-label">Playing</span>
        <span className="at-hook-value">{player.isPlaying ? 'Yes' : 'No'}</span>
      </div>
      <div className="at-hook-row">
        <span className="at-hook-label">Buffering</span>
        <span className="at-hook-value">{player.isBuffering ? 'Yes' : 'No'}</span>
      </div>
      <div className="at-hook-row">
        <span className="at-hook-label">Speed</span>
        <span className="at-hook-value">{player.playbackRate}×</span>
      </div>
      <div className="at-hook-row">
        <span className="at-hook-label">Progress</span>
        <span className="at-hook-value">{pct}%</span>
      </div>
    </div>
  )
}

/* ── playlist section ────────────────────────────────────────── */

function PlaylistSection({ tracks }) {
  return (
    <div className="at-playlist">
      {tracks.map((track) => (
        <div key={track.id} className="at-playlist-row">
          <ELPlayButton item={track} />
          <span className="at-playlist-title">{track.data?.title || track.id}</span>
        </div>
      ))}
      <div className="el-row el-row--wide" style={{ marginTop: 12 }}>
        <ELProgress className="el-flex-1" />
      </div>
      <div className="el-row" style={{ marginTop: 4 }}>
        <ELTime />
        <span className="el-time">/</span>
        <ELDuration />
      </div>
    </div>
  )
}

/* ── live waveform demo ──────────────────────────────────────── */

function LiveWaveformDemo() {
  const [active, setActive] = useState(false)
  const [mode, setMode] = useState('static')
  const player = useELPlayer()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <LiveWaveform 
        active={active} 
        mode={mode} 
        color="#38bdf8" 
        audioElement={player.ref?.current}
      />
      <div className="at-orb-controls">
        <button
          type="button"
          className={`at-orb-btn ${active ? 'at-orb-btn--active' : ''}`}
          onClick={() => setActive(!active)}
        >
          {active ? 'Stop Visualizer' : 'Start Visualizer'}
        </button>
        <button
          type="button"
          className="at-orb-btn"
          onClick={() => setMode(mode === 'static' ? 'scrolling' : 'static')}
        >
          Mode: {mode}
        </button>
      </div>
    </div>
  )
}

/* ── main page ───────────────────────────────────────────────── */

export default function AudioTestPage() {
  const { tracks } = useLocalPlayer()
  const [orbState, setOrbState] = useState(null)

  /* Build items from user's library (first 20) */
  const libraryItems = tracks.slice(0, 20).map((t, i) => ({
    id: `lib-${i}`,
    src: t.url,
    data: { title: t.title || t.filename || `Track ${i + 1}` },
  }))

  return (
    <main className="panel at-page">
      <h2>Audio Player Test</h2>
      <p className="at-subtitle">
        Ported from the <a href="https://ui.elevenlabs.io/docs/components/audio-player" target="_blank" rel="noopener noreferrer">ElevenLabs Audio Player</a> component — no Tailwind / shadcn required.
      </p>

      <ELPlayerProvider>
        {/* ── Section 1: Basic Player ──────────────────────────── */}
        <section className="at-section">
          <h3>Basic Player</h3>
          <p className="at-hint">Single-track playback with progress and time.</p>

          <div className="at-card">
            <div className="el-row el-row--wide">
              <ELPlayButton item={exampleTracks[0]} />
              <ELProgress className="el-flex-1" />
              <ELTime />
              <span className="el-time">/</span>
              <ELDuration />
            </div>
          </div>
        </section>

        {/* ── Section 2: Multi-Track Playlist ──────────────────── */}
        <section className="at-section">
          <h3>ElevenLabs Demo Tracks</h3>
          <p className="at-hint">Click play on any track. Progress and time update globally.</p>

          <div className="at-card">
            <PlaylistSection tracks={exampleTracks} />
          </div>
        </section>

        {/* ── Section 3: Library Tracks ────────────────────────── */}
        {libraryItems.length > 0 && (
          <section className="at-section">
            <h3>Your Library</h3>
            <p className="at-hint">Tracks from your local music library (first 20).</p>

            <div className="at-card">
              <PlaylistSection tracks={libraryItems} />
            </div>
          </section>
        )}

        {/* ── Section 4: Speed Control ────────────────────────── */}
        <section className="at-section">
          <h3>Speed Control</h3>
          <p className="at-hint">Change playback speed. Persists across track switches.</p>

          <div className="at-card">
            <ELSpeedControl />
          </div>
        </section>

        {/* ── Section 5: Hook Demo ────────────────────────────── */}
        <section className="at-section">
          <h3>useELPlayer / useELPlayerTime</h3>
          <p className="at-hint">Live values from the custom hooks, updating via requestAnimationFrame.</p>

          <div className="at-card">
            <HookDemo />
          </div>
        </section>
      <section className="at-section">
        <h3>Matrix — Dot Matrix Display</h3>
        <p className="at-hint">Retro dot-matrix with SVG rendering. Includes digits, animations, and a VU meter.</p>

        <div className="at-card">
          <div className="at-matrix-row">
            <div className="at-matrix-item">
              <span className="at-matrix-label">Digits</span>
              <div className="at-matrix-digits">
                {[1, 2, 3, 4, 5].map(d => (
                  <Matrix key={d} rows={7} cols={5} pattern={digits[d]} size={6} gap={2}
                    palette={{ on: '#00ff88', off: 'rgba(0,255,136,0.08)' }} />
                ))}
              </div>
            </div>
            <div className="at-matrix-item">
              <span className="at-matrix-label">Wave</span>
              <Matrix rows={7} cols={7} frames={wave} fps={20} loop size={8} gap={2}
                palette={{ on: '#00bfff', off: 'rgba(0,191,255,0.08)' }} />
            </div>
            <div className="at-matrix-item">
              <span className="at-matrix-label">Loader</span>
              <Matrix rows={7} cols={7} frames={loader} fps={12} loop size={8} gap={2}
                palette={{ on: '#ff9f43', off: 'rgba(255,159,67,0.08)' }} />
            </div>
          </div>
          <div className="at-matrix-row" style={{ marginTop: 16 }}>
            <div className="at-matrix-item">
              <span className="at-matrix-label">Pulse</span>
              <Matrix rows={7} cols={7} frames={pulse} fps={16} loop size={8} gap={2}
                palette={{ on: '#a855f7', off: 'rgba(168,85,247,0.08)' }} />
            </div>
            <div className="at-matrix-item">
              <span className="at-matrix-label">Snake</span>
              <Matrix rows={7} cols={7} frames={snake} fps={15} loop size={8} gap={2}
                palette={{ on: '#ef4444', off: 'rgba(239,68,68,0.08)' }} />
            </div>
            <div className="at-matrix-item">
              <span className="at-matrix-label">VU Meter</span>
              <Matrix rows={7} cols={12} mode="vu"
                levels={[0.1, 0.6, 0.9, 0.7, 0.4, 0.8, 0.5, 0.3, 0.6, 0.9, 0.5, 0.2]}
                size={8} gap={2}
                palette={{ on: '#22c55e', off: 'rgba(34,197,94,0.08)' }} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 7: Orb — 3D WebGL Orb ────────────────────── */}
      <section className="at-section">
        <h3>Orb — 3D WebGL Visualization</h3>
        <p className="at-hint">Audio-reactive 3D orb with shader effects. Click the buttons to change agent state.</p>

        <div className="at-card">
          <div className="at-orb-row">
            <div className="at-orb-container">
              <Orb colors={['#6c8aff', '#38bdf8']} agentState={orbState} seed={42} />
            </div>
            <div className="at-orb-container">
              <Orb colors={['#FF6B6B', '#4ECDC4']} agentState={orbState} seed={99} />
            </div>
            <div className="at-orb-container">
              <Orb colors={['#a855f7', '#ec4899']} agentState={orbState} seed={7} />
            </div>
          </div>
          <div className="at-orb-controls">
            <button type="button" className={`at-orb-btn ${orbState === null ? 'at-orb-btn--active' : ''}`}
              onClick={() => setOrbState(null)}>Idle</button>
            <button type="button" className={`at-orb-btn ${orbState === 'listening' ? 'at-orb-btn--active' : ''}`}
              onClick={() => setOrbState('listening')}>Listening</button>
            <button type="button" className={`at-orb-btn ${orbState === 'thinking' ? 'at-orb-btn--active' : ''}`}
              onClick={() => setOrbState('thinking')}>Thinking</button>
            <button type="button" className={`at-orb-btn ${orbState === 'talking' ? 'at-orb-btn--active' : ''}`}
              onClick={() => setOrbState('talking')}>Talking</button>
          </div>
        </div>
      </section>

      {/* ── Section 8: Live Waveform ─────────────────────────── */}
      <section className="at-section">
        <h3>Live Waveform</h3>
        <p className="at-hint">Real-time canvas-based audio waveform visualizer (Attached to Player playback).</p>

        <div className="at-card">
          <LiveWaveformDemo />
        </div>
      </section>
      </ELPlayerProvider>
    </main>
  )
}
