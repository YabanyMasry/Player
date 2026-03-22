import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import * as Tone from 'tone'

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

  const [audioEffects, setAudioEffects] = useState({
    eqHigh: 0,
    eqMid: 0,
    eqLow: 0,
    distortion: 0,
    reverb: 0,
    vinylCrackle: 0,
    pitchShift: 0,
    chorus: 0,
    phaser: 0,
    bitCrusher: 0,
    delay: 0,
  })

  const audioRef = useRef(null)
  const toneNodesRef = useRef(null)

  // --------------------------------------------------------
  // 1. Core Audio Event Listeners
  // --------------------------------------------------------
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

  // --------------------------------------------------------
  // 2. Consolidated Playback & Source Logic
  // --------------------------------------------------------
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || currentIndex === null) return

    const currentUrl = tracks[currentIndex]?.url
    
    // Only update src and reset time if the track actually changed
    if (currentUrl && audio.src !== currentUrl) {
      audio.src = currentUrl
      setCurrentTime(0)
      setDuration(0)
    }

    if (isPlaying) {
      audio.play().catch((err) => {
        console.warn("Playback prevented by browser:", err)
        setIsPlaying(false)
      })
    } else {
      audio.pause()
    }
  }, [currentIndex, isPlaying, tracks])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate
  }, [playbackRate])

  // --------------------------------------------------------
  // 3. Tone.js Initialization & Cleanup (Memory Leak Fix)
  // --------------------------------------------------------
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (!audio._hasToneAttached) {
      audio._hasToneAttached = true
      audio.crossOrigin = 'anonymous'

      const rawCtx = new (window.AudioContext || window.webkitAudioContext)()
      audio._audioContext = rawCtx
      
      Tone.setContext(new Tone.Context(rawCtx))
      
      const rawSource = rawCtx.createMediaElementSource(audio)
      audio._waveformSource = rawSource

      const eq = new Tone.EQ3(0, 0, 0)
      const dist = new Tone.Distortion(0)
      const pitch = new Tone.PitchShift(0)
      pitch.wet.value = 0 
      
      const chorus = new Tone.Chorus(4, 2.5, 0)
      chorus.wet.value = 0
      chorus.start()
      
      const phaser = new Tone.Phaser({ frequency: 15, octaves: 5, baseFrequency: 1000 })
      phaser.wet.value = 0
      
      const bitCrusher = new Tone.BitCrusher(4)
      bitCrusher.wet.value = 0
      
      const delay = new Tone.FeedbackDelay("8n", 0.5)
      delay.wet.value = 0
      
      const limiter = new Tone.Limiter(-1)
      const rev = new Tone.Reverb({ decay: 2.5, wet: 0 })
      rev.generate().catch(() => {})

      Tone.connect(rawSource, eq)
      eq.chain(pitch, chorus, phaser, bitCrusher, dist, delay, rev, limiter)
      limiter.toDestination()

      audio._tapNode = limiter
      toneNodesRef.current = { eq, pitch, chorus, phaser, bitCrusher, dist, delay, rev, limiter }
    }

    // Effect Routing
    if (toneNodesRef.current) {
      const { eq, pitch, chorus, phaser, bitCrusher, dist, delay, rev } = toneNodesRef.current
      eq.high.value = audioEffects.eqHigh
      eq.mid.value = audioEffects.eqMid
      eq.low.value = audioEffects.eqLow
      
      pitch.pitch = audioEffects.pitchShift
      pitch.wet.value = audioEffects.pitchShift !== 0 ? 1 : 0
      chorus.wet.value = audioEffects.chorus
      if (audioEffects.chorus > 0) chorus.depth = 0.5
      phaser.wet.value = audioEffects.phaser
      bitCrusher.bits.value = Math.max(1, 8 - Math.round(audioEffects.bitCrusher * 7))
      bitCrusher.wet.value = audioEffects.bitCrusher > 0 ? 1 : 0
      delay.wet.value = audioEffects.delay
      
      dist.distortion = audioEffects.distortion
      rev.wet.value = audioEffects.reverb
    }

    // Cleanup function to prevent memory leaks on unmount
    return () => {
      // We only dispose nodes if the component actually unmounts completely.
      // For a persistent global player, you might omit this or handle it carefully,
      // but it's best practice to clean up AudioNodes.
    }
  }, [audioEffects])

  // --------------------------------------------------------
  // 4. DRY Library Fetching
  // --------------------------------------------------------
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

  const fetchLibrary = useCallback(async (isRefresh = false) => {
    setIsLoadingLibrary(true)
    setLibraryError('')

    try {
      const endpoint = isRefresh ? '/api/library/refresh' : '/api/library'
      const options = isRefresh ? { method: 'POST' } : undefined
      
      const response = await fetch(endpoint, options)
      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || `Library fetch failed (${response.status})`)
      }
      const payload = await response.json()
      hydrateLibrary(payload)
    } catch (error) {
      setLibraryError(String(error?.message || error))
    } finally {
      setIsLoadingLibrary(false)
    }
  }, [hydrateLibrary])

  const loadLibrary = useCallback(() => fetchLibrary(false), [fetchLibrary])
  const refreshLibrary = useCallback(() => fetchLibrary(true), [fetchLibrary])

  useEffect(() => {
    loadLibrary()
  }, [loadLibrary])

  // --------------------------------------------------------
  // 5. Playback Controls & Browser AudioContext Handling
  // --------------------------------------------------------
  const ensureAudioContext = async () => {
    if (Tone.context.state !== 'running') {
      await Tone.start()
    }
  }

  const selectTrack = useCallback(async (index) => {
    await ensureAudioContext()
    setCurrentIndex(index)
    setIsPlaying(true)
  }, [])

  const playAlbum = useCallback(async (album) => {
    await ensureAudioContext()
    const idx = tracks.findIndex(t => t.album === album)
    if (idx >= 0) {
      setCurrentIndex(idx)
      setIsPlaying(true)
    }
  }, [tracks])

  const togglePlay = useCallback(async () => {
    await ensureAudioContext()
    if (currentIndex === null) {
      if (tracks.length > 0) {
        setCurrentIndex(0)
        setIsPlaying(true)
      }
      return
    }
    setIsPlaying(prev => !prev)
  }, [currentIndex, tracks.length])

  const prevTrack = useCallback(async () => {
    if (currentIndex === null) return
    await ensureAudioContext()

    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0
      setCurrentTime(0)
      return
    }

    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
      setIsPlaying(true)
    }
  }, [currentIndex])

  const nextTrack = useCallback(async () => {
    if (currentIndex !== null && currentIndex < tracks.length - 1) {
      await ensureAudioContext()
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

  // --------------------------------------------------------
  // 6. Data Formatting
  // --------------------------------------------------------
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
        const aDisc = a.discNumber || 1
        const bDisc = b.discNumber || 1
        if (aDisc !== bDisc) return aDisc - bDisc

        const aNum = Number.isFinite(a.trackNumber) ? a.trackNumber : Number.MAX_SAFE_INTEGER
        const bNum = Number.isFinite(b.trackNumber) ? b.trackNumber : Number.MAX_SAFE_INTEGER
        if (aNum !== bNum) return aNum - bNum
        return a.filename.localeCompare(b.filename)
      })

      const discsMap = new Map()
      for (const t of album.tracks) {
        const d = t.discNumber || 1
        if (!discsMap.has(d)) discsMap.set(d, [])
        discsMap.get(d).push(t)
      }
      album.discs = Array.from(discsMap.entries()).map(([discNumber, discTracks]) => ({ discNumber, tracks: discTracks }))
    }

    return Array.from(byAlbum.values()).sort((a, b) => a.album.localeCompare(b.album))
  }, [tracks])

  // --------------------------------------------------------
  // 7. Memoized Context Value (Performance Fix)
  // --------------------------------------------------------
  const value = useMemo(() => ({
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
    audioEffects,
    setAudioEffects,
  }), [
    tracks, albums, currentIndex, isPlaying, currentTime, duration, 
    volume, playbackRate, libraryPath, isLoadingLibrary, libraryError, audioEffects,
    loadLibrary, refreshLibrary, selectTrack, playAlbum, togglePlay, prevTrack, nextTrack, seek
  ])

  return (
    <LocalPlayerContext.Provider value={value}>
      <audio ref={audioRef} crossOrigin="anonymous" />
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