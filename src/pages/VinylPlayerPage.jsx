import { useCallback, useMemo, useEffect, useState } from 'react'
import { usePlayer } from '../state/PlayerContext'
import { usePlayerScale } from '../hooks/usePlayerScale'
import VinylPlayer from '../components/VinylPlayer'
import StudioFooter from '../components/StudioFooter'
import ContextMenu from '../components/ContextMenu'
import './VinylPlayerPage.css'

/* ── main page ───────────────────────────────────────────────── */

export default function VinylPlayerPage() {
  const {
    albums,
    tracks,
    activePlaylist,
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
    playNext,
    addToQueue,
    prevTrack,
    nextTrack,
    seek,
    setVolume,
    setPlaybackRate,
    playAlbum,
    audioEffects,
    setAudioEffects,
    handleResetDefaults,
  } = usePlayer()

  // 1. Define the hardcoded CSS dimensions of your VinylPlayer
  const PLAYER_WIDTH = 1048;  // Change to your actual fixed width
  const PLAYER_HEIGHT = 650; // Change to your actual fixed height
  
  // 2. Get the current scale factor
  const playerScale = usePlayerScale(PLAYER_WIDTH, PLAYER_HEIGHT);

  const [contextMenu, setContextMenu] = useState({ x: 0, y: 0, options: [] });
  const [playlists, setPlaylists] = useState([]);

  useEffect(() => {
    fetch('/api/playlists').then(r => r.json()).then(setPlaylists).catch(()=>{})
  }, []);

  const handleContextMenu = (e, track, onPlay) => {
    e.preventDefault()
    e.stopPropagation()

    const subOptions = playlists.map(pl => ({
      label: pl.name,
      onClick: async () => {
        try {
          await fetch(`/api/playlists/${encodeURIComponent(pl.filename)}/add-track`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ trackPath: track.absolutePath || track.spotifyUri || track.id })
          })
        } catch (err) {
          console.error('Failed to add to playlist:', err)
        }
      }
    }))

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      options: [
        { label: 'Play Now', onClick: onPlay },
        { label: 'Play Next', onClick: () => playNext && playNext(track), disabled: !playNext },
        { label: 'Add to Queue', onClick: () => addToQueue && addToQueue(track), disabled: !addToQueue },
        { divider: true },
        { label: 'Add to Playlist...', submenu: subOptions }
      ]
    })
  }

  const handleEffectChange = useCallback((key, value) => {
    setAudioEffects(prev => ({ ...prev, [key]: value }))
  }, [setAudioEffects])

  /* ── current album info ────────────────────────────────────── */

  const currentAlbum = useMemo(() => {
    if (!currentTrack) return null;
    return albums.find(a => a.album === currentTrack.album && a.artist === (currentTrack.albumArtist || currentTrack.artist || 'Unknown Artist')) || null;
  }, [albums, currentTrack]);

  const relativeTrackNum = currentAlbum && currentTrack
    ? currentAlbum.tracks.findIndex(t => t.id === currentTrack.id || t.filename === currentTrack.filename) + 1
    : 1

  /* ── progress ──────────────────────────────────────────────── */

  const onPrevAlbum = useCallback(() => {
    if (!currentAlbum || albums.length === 0) return;
    const currentIdx = albums.findIndex(a => a.album === currentAlbum.album);
    const prevIdx = (currentIdx - 1 + albums.length) % albums.length;
    playAlbum(albums[prevIdx].album);
  }, [albums, currentAlbum, playAlbum]);

  const onNextAlbum = useCallback(() => {
    if (!currentAlbum || albums.length === 0) return;
    const currentIdx = albums.findIndex(a => a.album === currentAlbum.album);
    const nextIdx = (currentIdx + 1) % albums.length;
    playAlbum(albums[nextIdx].album);
  }, [albums, currentAlbum, playAlbum]);

  return (
    <div className="vp-page">
      {/* ── center stage ─────────────────────────────────────── */}
      <div className="vp-stage" style={{ display: 'flex', gap: '2rem' }}>
        
        {/* ── THE SCALED WRAPPER ── */}
        {/* This div dynamically changes its actual DOM size so the tracklist stays hugged against it */}
        <div 
          className="vp-scaled-container"
          style={{ 
            width: `${PLAYER_WIDTH * playerScale}px`, 
            height: `${PLAYER_HEIGHT * playerScale}px`,
            position: 'relative',
            flexShrink: 0 // Prevents the flex parent from crushing it
          }}
        >
          {/* This inner div applies the visual zoom from the top-left corner */}
          <div style={{
            width: `${PLAYER_WIDTH}px`,
            height: `${PLAYER_HEIGHT}px`,
            transform: `scale(${playerScale})`,
            transformOrigin: 'top left',
            position: 'absolute',
            top: 0,
            left: 0
          }}>
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
              onResetDefaults={handleResetDefaults}
              onPrevAlbum={onPrevAlbum}
              onNextAlbum={onNextAlbum}
              onTogglePlay={togglePlay}
              lyrics={currentTrack?.lyrics}
              currentTime={currentTime}
              onSeek={seek}
            />
          </div>
        </div>

        {/* ── right tracklist (conditional rendering based on playlist vs album) ── */}
        {activePlaylist ? (
          <aside className="vp-tracklist-panel">
            <h3>{activePlaylist.name.toUpperCase()}</h3>
            <p>PLAYLIST • {tracks.length} TRACKS</p>
            <ul className="vp-tracklist">
              {tracks.map((track, i) => {
                const isActive = currentIndex === i
                return (
                  <li
                    key={track.id || i}
                    className={`vp-track-item ${isActive ? 'vp-track-item--active' : ''}`}
                    onClick={() => selectTrack(i)}
                    onContextMenu={(e) => handleContextMenu(e, track, () => selectTrack(i))}
                  >
                    <span className="vp-track-num">{i + 1}</span>
                    <span className="vp-track-name">{track.title || track.filename || 'Unknown Track'}</span>
                  </li>
                )
              })}
            </ul>
          </aside>
        ) : currentAlbum ? (
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
                    onContextMenu={(e) => handleContextMenu(e, track, () => selectTrack(track.index))}
                  >
                    <span className="vp-track-num">{i + 1}</span>
                    <span className="vp-track-name">{track.title || track.filename || 'Unknown Track'}</span>
                  </li>
                )
              })}
            </ul>
          </aside>
        ) : null}
      </div>

      <StudioFooter
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        volume={volume}
        hasPrev={hasPrev}
        hasNext={hasNext}
        onPrev={prevTrack}
        onNext={nextTrack}
        onTogglePlay={togglePlay}
        onSeek={seek}
        onVolumeChange={setVolume}
      />
      <ContextMenu 
        x={contextMenu.x} 
        y={contextMenu.y} 
        options={contextMenu.options} 
        onClose={() => setContextMenu({ x: 0, y: 0, options: [] })} 
      />
    </div>
  )
}