import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

const LocalPlayerContext = createContext(null)

export function LocalPlayerProvider({ children }) {
  const [tracks, setTracks] = useState([])
  const [currentIndex, setCurrentIndex] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [libraryPath, setLibraryPath] = useState('')
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false)
  const [libraryError, setLibraryError] = useState('')

  const audioRef = useRef(null)
  const pendingPlayRef = useRef(false)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onDurationChange = () => setDuration(isFinite(audio.duration) ? audio.duration : 0)
    const onEnded = () => {
      setCurrentIndex(prev => {
        if (prev !== null && prev < tracks.length - 1) return prev + 1
        setIsPlaying(false)
        return prev
      })
    }

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('durationchange', onDurationChange)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('durationchange', onDurationChange)
      audio.removeEventListener('ended', onEnded)
    }
  }, [tracks.length])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || currentIndex === null) return

    audio.src = tracks[currentIndex].url
    setCurrentTime(0)
    setDuration(0)

    if (pendingPlayRef.current) {
      audio.play().catch(() => {})
    }
  }, [currentIndex, tracks])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || currentIndex === null) return

    if (isPlaying) {
      audio.play().catch(() => setIsPlaying(false))
    } else {
      audio.pause()
    }
  }, [isPlaying, currentIndex])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
    }
  }, [volume])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate
    }
  }, [playbackRate])

  const hydrateLibrary = useCallback((payload) => {
    const nextTracks = Array.isArray(payload?.tracks) ? payload.tracks : []
    setTracks(nextTracks)
    setLibraryPath(payload?.rootPath || '')

    if (nextTracks.length === 0) {
      setCurrentIndex(null)
      setIsPlaying(false)
      return
    }

    setCurrentIndex(prev => {
      if (prev === null) return 0
      return Math.min(prev, nextTracks.length - 1)
    })
  }, [])

  const loadLibrary = useCallback(async () => {
    setIsLoadingLibrary(true)
    setLibraryError('')

    try {
      const response = await fetch('/api/library')
      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || `Library load failed (${response.status})`)
      }
      const payload = await response.json()
      hydrateLibrary(payload)
    } catch (error) {
      setLibraryError(String(error?.message || error))
    } finally {
      setIsLoadingLibrary(false)
    }
  }, [hydrateLibrary])

  const refreshLibrary = useCallback(async () => {
    setIsLoadingLibrary(true)
    setLibraryError('')

    try {
      const response = await fetch('/api/library/refresh', { method: 'POST' })
      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || `Library refresh failed (${response.status})`)
      }
      const payload = await response.json()
      hydrateLibrary(payload)
    } catch (error) {
      setLibraryError(String(error?.message || error))
    } finally {
      setIsLoadingLibrary(false)
    }
  }, [hydrateLibrary])

  useEffect(() => {
    loadLibrary()
  }, [loadLibrary])

  const selectTrack = useCallback((index) => {
    pendingPlayRef.current = true
    setCurrentIndex(index)
    setIsPlaying(true)
  }, [])

  const playAlbum = useCallback((album) => {
    const idx = tracks.findIndex(t => t.album === album)
    if (idx >= 0) {
      pendingPlayRef.current = true
      setCurrentIndex(idx)
      setIsPlaying(true)
    }
  }, [tracks])

  const togglePlay = useCallback(() => {
    if (currentIndex === null) {
      if (tracks.length > 0) selectTrack(0)
      return
    }
    setIsPlaying(prev => !prev)
  }, [currentIndex, tracks.length, selectTrack])

  const prevTrack = useCallback(() => {
    if (currentIndex === null) return

    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0
      setCurrentTime(0)
      return
    }

    if (currentIndex > 0) {
      pendingPlayRef.current = true
      setCurrentIndex(currentIndex - 1)
      setIsPlaying(true)
    }
  }, [currentIndex])

  const nextTrack = useCallback(() => {
    if (currentIndex !== null && currentIndex < tracks.length - 1) {
      pendingPlayRef.current = true
      setCurrentIndex(currentIndex + 1)
      setIsPlaying(true)
    }
  }, [currentIndex, tracks.length])

  const seek = useCallback((seconds) => {
    if (audioRef.current) {
      audioRef.current.currentTime = seconds
      setCurrentTime(seconds)
    }
  }, [])

  const albums = useMemo(() => {
    const byAlbum = new Map()

    for (let i = 0; i < tracks.length; i += 1) {
      const track = tracks[i]
      const albumArtist = track.albumArtist || track.artist || 'Unknown Artist'
      const key = `${albumArtist}__${track.album}`

      if (!byAlbum.has(key)) {
        byAlbum.set(key, {
          key,
          album: track.album,
          artist: albumArtist,
          coverUrl: track.coverUrl || null,
          tracks: [],
        })
      }

      if (!byAlbum.get(key).coverUrl && track.coverUrl) {
        byAlbum.get(key).coverUrl = track.coverUrl
      }

      byAlbum.get(key).tracks.push({ ...track, index: i })
    }

    for (const album of byAlbum.values()) {
      album.tracks.sort((a, b) => {
        const aNum = Number.isFinite(a.trackNumber) ? a.trackNumber : Number.MAX_SAFE_INTEGER
        const bNum = Number.isFinite(b.trackNumber) ? b.trackNumber : Number.MAX_SAFE_INTEGER
        if (aNum !== bNum) return aNum - bNum
        return a.filename.localeCompare(b.filename)
      })
    }

    return Array.from(byAlbum.values()).sort((a, b) => a.album.localeCompare(b.album))
  }, [tracks])

  const value = {
    audioRef,
    tracks,
    albums,
    currentIndex,
    currentTrack: currentIndex !== null ? tracks[currentIndex] : null,
    isPlaying,
    currentTime,
    duration,
    volume,
    playbackRate,
    hasPrev: currentIndex !== null && currentIndex > 0,
    hasNext: currentIndex !== null && currentIndex < tracks.length - 1,
    libraryPath,
    isLoadingLibrary,
    libraryError,
    loadLibrary,
    refreshLibrary,
    selectTrack,
    playAlbum,
    togglePlay,
    prevTrack,
    nextTrack,
    seek,
    setVolume,
    setPlaybackRate,
  }

  return (
    <LocalPlayerContext.Provider value={value}>
      <audio ref={audioRef} />
      {children}
    </LocalPlayerContext.Provider>
  )
}

export function useLocalPlayer() {
  const context = useContext(LocalPlayerContext)
  if (!context) {
    throw new Error('useLocalPlayer must be used inside LocalPlayerProvider')
  }
  return context
}
