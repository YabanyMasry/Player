import { useMemo } from 'react'
import { useLocalPlayer } from '../state/LocalPlayerContext'

function formatTime(totalSeconds) {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export default function PlayerPage() {
  const {
    albums,
    tracks,
    currentTrack,
    currentIndex,
    isPlaying,
    currentTime,
    duration,
    volume,
    hasPrev,
    hasNext,
    selectTrack,
    togglePlay,
    prevTrack,
    nextTrack,
    seek,
    setVolume,
  } = useLocalPlayer()

  const canPlay = currentIndex !== null || tracks.length > 0

  const selectedAlbum = useMemo(() => {
    if (!currentTrack) return null
    return albums.find(
      album =>
        album.album === currentTrack.album &&
        album.artist === (currentTrack.albumArtist || currentTrack.artist)
    ) || null
  }, [albums, currentTrack])

  return (
    <main className="panel">
      <h2>Player</h2>
      {currentTrack ? (
        <>
          <p className="now-playing">{currentTrack.title}</p>
          <p className="muted">{currentTrack.artist} • {currentTrack.album}</p>

          <div className="controls">
            <button type="button" onClick={prevTrack} disabled={!hasPrev}>Prev</button>
            <button type="button" onClick={togglePlay} disabled={!canPlay}>{isPlaying ? 'Pause' : 'Play'}</button>
            <button type="button" onClick={nextTrack} disabled={!hasNext}>Next</button>
          </div>

          <label className="field" htmlFor="seek">Progress</label>
          <input
            id="seek"
            type="range"
            min="0"
            max={duration || 0}
            step="0.1"
            value={Math.min(currentTime, duration || 0)}
            onChange={e => seek(Number(e.target.value))}
            disabled={!duration}
          />
          <p className="muted">{formatTime(currentTime)} / {formatTime(duration)}</p>

          <label className="field" htmlFor="volume">Volume</label>
          <input
            id="volume"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={e => setVolume(Number(e.target.value))}
          />

          {selectedAlbum && (
            <section className="tracklist">
              <h3>Tracks</h3>
              <ul>
                {selectedAlbum.tracks.map(track => (
                  <li key={track.id}>
                    <button type="button" onClick={() => selectTrack(track.index)}>
                      {track.title}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      ) : (
        <p className="muted">Select an album to start playing.</p>
      )}
    </main>
  )
}
