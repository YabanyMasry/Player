import { useCallback } from 'react'
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
          onPrevAlbum={onPrevAlbum}
          onNextAlbum={onNextAlbum}
          onTogglePlay={togglePlay}
          lyrics={currentTrack?.lyrics}
          currentTime={currentTime}
          onSeek={seek}
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
