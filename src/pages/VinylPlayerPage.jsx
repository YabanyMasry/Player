import { useCallback } from 'react'
import { useLocalPlayer } from '../state/LocalPlayerContext'
import VinylPlayer from '../components/VinylPlayer'
import './VinylPlayerPage.css'

/* ── helpers ─────────────────────────────────────────────────── */

function formatTime(s) {
  if (!Number.isFinite(s) || s < 0) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec < 10 ? '0' : ''}${sec}`
}

/* ── main page ───────────────────────────────────────────────── */

export default function VinylPlayerPage() {
  const {
    albums,
    tracks,
    currentTrack,
    currentIndex,
    isPlaying,
    currentTime,
    audioRef,
    duration,
    volume,
    playbackRate,
    hasPrev,
    hasNext,
    selectTrack,
    togglePlay,
    prevTrack,
    nextTrack,
    seek,
    setVolume,
    setPlaybackRate,
    playAlbum,
    audioEffects,
    setAudioEffects,
  } = useLocalPlayer()

  const handleEffectChange = useCallback((key, value) => {
    setAudioEffects(prev => ({ ...prev, [key]: value }))
  }, [setAudioEffects])



  /* ── current album info ────────────────────────────────────── */

  const currentAlbum = albums.find(a =>
    a.tracks.some(t => t.index === currentIndex)
  )

  const relativeTrackNum = currentAlbum && currentTrack 
    ? currentAlbum.tracks.findIndex(t => t.id === currentTrack.id) + 1 
    : 1

  /* ── progress ──────────────────────────────────────────────── */

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="vp-page">
      {/* ── center stage ─────────────────────────────────────── */}
      <div className="vp-stage">
        <VinylPlayer 
          isPlaying={isPlaying} 
          coverUrl={currentTrack?.coverUrl || currentAlbum?.coverUrl} 
          audioElement={audioRef?.current}
          trackNumber={relativeTrackNum}
          songName={currentTrack?.title || currentTrack?.filename || 'Unknown'}
          albumName={currentAlbum?.album || ''}
          volume={volume}
          onVolumeChange={setVolume}
          playbackRate={playbackRate}
          onPlaybackRateChange={setPlaybackRate}
          audioEffects={audioEffects}
          onEffectChange={handleEffectChange}
        />

        {/* ── right tracklist ── */}
        {currentAlbum && (
           <aside className="vp-tracklist-panel">
             <h3>{currentAlbum.album}</h3>
             <p>{currentAlbum.artist}</p>
             <ul className="vp-tracklist">
               {currentAlbum.tracks.map((track, i) => {
                 const isActive = currentTrack?.id === track.id
                 return (
                   <li 
                     key={track.id || i} 
                     className={`vp-track-item ${isActive ? 'vp-track-item--active' : ''}`}
                     onClick={() => selectTrack(track.index)}
                   >
                     <span className="vp-track-num">{i + 1}</span>
                     <span className="vp-track-name">{track.title || track.filename || 'Unknown Track'}</span>
                   </li>
                 )
               })}
             </ul>
           </aside>
        )}
      </div>

      {/* ── footer player ────────────────────────────────────── */}
      <footer className="vp-footer">
        {/* left: track info */}
        <div className="vp-footer-info">
          <span className="vp-footer-title">
            {currentTrack?.title || '—'}
          </span>
          <span className="vp-footer-artist">
            {currentTrack?.artist || '\u00A0'}
          </span>
        </div>

        {/* center: controls + progress */}
        <div className="vp-footer-center">
          <div className="vp-footer-controls">
            <button
              type="button"
              className="vp-ctrl-btn"
              onClick={prevTrack}
              disabled={!hasPrev}
              aria-label="Previous"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
              </svg>
            </button>
            <button
              type="button"
              className="vp-ctrl-btn vp-ctrl-btn--play"
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                  <path d="M8 5.14v14l11-7-11-7z" />
                </svg>
              )}
            </button>
            <button
              type="button"
              className="vp-ctrl-btn"
              onClick={nextTrack}
              disabled={!hasNext}
              aria-label="Next"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                <path d="M6 18l8.5-6L6 6v12zm10-12v12h2V6h-2z" />
              </svg>
            </button>
          </div>

          <div className="vp-footer-progress-row">
            <span className="vp-footer-time">{formatTime(currentTime)}</span>
            <input
              type="range"
              className="vp-footer-progress"
              min={0}
              max={duration || 0}
              step={0.25}
              value={currentTime}
              style={{ '--vp-pct': `${pct}%` }}
              onChange={e => seek(Number(e.target.value))}
              disabled={!duration}
              aria-label="Seek"
            />
            <span className="vp-footer-time">{formatTime(duration)}</span>
          </div>
        </div>

        {/* right: volume */}
        <div className="vp-footer-volume">
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" className="vp-vol-icon">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 8.14v7.72c1.48-.73 2.5-2.25 2.5-3.86zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
          </svg>
          <input
            type="range"
            className="vp-footer-vol-slider"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            style={{ '--vp-vol': `${volume * 100}%` }}
            onChange={e => setVolume(Number(e.target.value))}
            aria-label="Volume"
          />
        </div>
      </footer>
    </div>
  )
}
