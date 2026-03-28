import { useCallback, useState, useEffect, useRef } from 'react'
import { useLocalPlayer } from '../state/LocalPlayerContext'
import VinylPlayer from '../components/VinylPlayer'
import StudioFooter from '../components/StudioFooter'
import './VinylPlayerPage.css'

/* ── helpers ─────────────────────────────────────────────────── */


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

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0

  /* ── Scaling Logic ── */
  const [scale, setScale] = useState(1)
  const stageRef = useRef(null)

  useEffect(() => {
    const updateScale = () => {
      if (!stageRef.current) return

      const stage = stageRef.current
      const containerWidth = stage.clientWidth
      const containerHeight = stage.clientHeight

      // Estimated space for the tracklist panel (typically 380px + gap)
      // On small screens, the tracklist might hide or change, so we measure it if possible
      const tracklist = stage.querySelector('.vp-tracklist-panel')
      const tracklistWidth = tracklist ? tracklist.offsetWidth : 0
      const gap = 80
      const paddingH = 80 // 40px each side

      const availableWidth = containerWidth - tracklistWidth - gap - paddingH
      const availableHeight = containerHeight - 40 // some buffer for vertical padding

      const targetWidth = 1048
      const targetHeight = 618

      const scaleX = availableWidth / targetWidth
      const scaleY = availableHeight / targetHeight

      // Set scale, capped at 1.0 (don't upscale beyond native size unless desired)
      // Actually, for "same on all browsers", scaling up might be okay, but let's cap at 1.1 or so
      const newScale = Math.min(scaleX, scaleY)
      setScale(Math.min(newScale, 1.1))
    }

    const observer = new ResizeObserver(updateScale)
    if (stageRef.current) observer.observe(stageRef.current)

    updateScale()
    window.addEventListener('resize', updateScale)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateScale)
    }
  }, [])

  return (
    <div className="vp-page">
      {/* ── center stage ─────────────────────────────────────── */}
      <div className="vp-stage" ref={stageRef}>
        <div 
          className="vp-player-scaler"
          style={{ transform: `scale(${scale})` }}
        >
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
            onPrevAlbum={onPrevAlbum}
            onNextAlbum={onNextAlbum}
            onTogglePlay={togglePlay}
            lyrics={currentTrack?.lyrics}
            currentTime={currentTime}
            onSeek={seek}
          />
        </div>

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
    </div>
  )
}
