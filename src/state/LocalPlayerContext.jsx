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
    djFilter: 0,
    autoWah: 0,
    stereoWidth: 0.5,
    autoPan: 0,
    wowFlutter: 0,
    tapeSaturation: 0,
    sidechainPump: 0,
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
  // 2. Track Source Management
  // --------------------------------------------------------
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || currentIndex === null) return

    const currentUrl = tracks[currentIndex]?.url
    if (currentUrl && audio.src !== new URL(currentUrl, window.location.origin).toString()) {
      audio.src = currentUrl
      setCurrentTime(0)
      setDuration(0)
    }
  }, [currentIndex, tracks])

  // --------------------------------------------------------
  // 3. Playback Control
  // --------------------------------------------------------
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || currentIndex === null) return

    if (isPlaying) {
      audio.play().catch((err) => {
        console.warn("Playback prevented by browser:", err)
        setIsPlaying(false)
      })
    } else {
      audio.pause()
    }
  }, [isPlaying, currentIndex])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate
  }, [playbackRate])

  // --------------------------------------------------------
  // 4. Tone.js Initialization & Master Chain (TRUE BYPASS FIX)
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

      // EVERY effect is strictly initialized with wet.value = 0 (True Bypass)
      // so it physically does not process the audio unless activated.
      const eq = new Tone.EQ3(0, 0, 0)

      const dist = new Tone.Distortion(0)
      dist.wet.value = 0

      const pitch = new Tone.PitchShift(0)
      pitch.wet.value = 0

      const chorus = new Tone.Chorus(4, 2.5, 0).start()
      chorus.wet.value = 0

      const phaser = new Tone.Phaser({ frequency: 15, octaves: 5, baseFrequency: 1000 })
      phaser.wet.value = 0

      const bitCrusher = new Tone.BitCrusher(4)
      bitCrusher.wet.value = 0

      const delay = new Tone.FeedbackDelay("8n", 0.5)
      delay.wet.value = 0

      const widener = new Tone.StereoWidener(1)
      widener.wet.value = 0 // Bypassed by default

      const autoPanner = new Tone.AutoPanner("4n").start()
      autoPanner.wet.value = 0

      const sidechain = new Tone.Tremolo("4n", 1).start()
      sidechain.type = "sine"
      sidechain.wet.value = 0

      const autoWah = new Tone.AutoWah(50, 6, -30)
      autoWah.Q.value = 6
      autoWah.wet.value = 0

      // A 20kHz filter still causes phase shift. We set Q to 0 and push it to 22kHz to make it invisible.
      const djFilter = new Tone.Filter(22000, "lowpass", -12)
      djFilter.Q.value = 0

      const vibrato = new Tone.Vibrato(1.5, 0)
      vibrato.wet.value = 0

      const saturation = new Tone.Chebyshev(50)
      saturation.wet.value = 0

      // FIXED: Limiter was set to -1dB, squashing the raw audio. Now set to 0dB.
      const limiter = new Tone.Limiter(0)

      // Independent Noise Engine
      const vinylHiss = new Tone.Noise("pink").start()
      const hissFilter = new Tone.Filter(3500, "lowpass")
      const crackleGain = new Tone.Gain(0)
      vinylHiss.chain(hissFilter, crackleGain, limiter)

      const rev = new Tone.Reverb({ decay: 2.5, wet: 0 })
      rev.generate().catch(() => { })

      // Build Graph
      Tone.connect(rawSource, widener)
      widener.chain(
        autoPanner, sidechain, autoWah, djFilter, vibrato,
        eq, saturation, pitch, chorus, phaser, bitCrusher, dist,
        delay, rev, limiter
      )

      limiter.toDestination()
      audio._tapNode = limiter

      toneNodesRef.current = {
        eq, pitch, chorus, phaser, bitCrusher, dist, delay, rev, limiter, crackleGain,
        widener, autoPanner, sidechain, autoWah, djFilter, vibrato, saturation
      }
    }

    // --- REAL-TIME EFFECT ROUTING ---
    if (toneNodesRef.current) {
      const nodes = toneNodesRef.current

      // EQ (Since EQ3 has no wet property, it runs purely on the value)
      nodes.eq.high.value = audioEffects.eqHigh
      nodes.eq.mid.value = audioEffects.eqMid
      nodes.eq.low.value = audioEffects.eqLow

      // Distortion
      nodes.dist.distortion = audioEffects.distortion
      nodes.dist.wet.value = audioEffects.distortion > 0 ? 1 : 0 // True Bypass if 0

      // Reverb & Crackle
      nodes.rev.wet.value = audioEffects.reverb
      nodes.crackleGain.gain.value = audioEffects.vinylCrackle * 0.05

      // Pitch
      nodes.pitch.pitch = audioEffects.pitchShift
      nodes.pitch.wet.value = audioEffects.pitchShift !== 0 ? 1 : 0 // True Bypass if 0

      // Delay
      nodes.delay.wet.value = audioEffects.delay

      // Modulation
      nodes.chorus.wet.value = audioEffects.chorus
      nodes.phaser.wet.value = audioEffects.phaser

      // Bitcrusher
      nodes.bitCrusher.bits.value = Math.max(1, 8 - Math.round(audioEffects.bitCrusher * 7))
      nodes.bitCrusher.wet.value = audioEffects.bitCrusher > 0 ? 1 : 0 // True Bypass if 0

      // Stereo Imaging
      if (audioEffects.stereoWidth === 0.5) {
        nodes.widener.wet.value = 0 // True Bypass if normal
      } else {
        nodes.widener.wet.value = 1
        nodes.widener.width.value = audioEffects.stereoWidth * 2
      }

      nodes.autoPanner.wet.value = audioEffects.autoPan

      // Dynamics & Tape Emulation
      nodes.sidechain.wet.value = audioEffects.sidechainPump
      nodes.autoWah.wet.value = audioEffects.autoWah

      nodes.vibrato.depth.value = audioEffects.wowFlutter
      nodes.vibrato.wet.value = audioEffects.wowFlutter > 0 ? 1 : 0 // True Bypass if 0

      nodes.saturation.wet.value = audioEffects.tapeSaturation

      // 1-Knob DJ Filter Logic
      const filterVal = audioEffects.djFilter
      const minLog = Math.log10(20)
      const maxLog = Math.log10(20000)

      if (filterVal < 0) {
        nodes.djFilter.type = "lowpass"
        nodes.djFilter.frequency.value = Math.pow(10, maxLog - Math.abs(filterVal) * (maxLog - minLog))
      } else if (filterVal > 0) {
        nodes.djFilter.type = "highpass"
        nodes.djFilter.frequency.value = Math.pow(10, minLog + filterVal * (maxLog - minLog))
      } else {
        // Flat Bypass settings so it doesn't color the highs
        nodes.djFilter.type = "lowpass"
        nodes.djFilter.frequency.value = 22000
      }
    }
  }, [audioEffects])


  // --------------------------------------------------------
  // 5. Native DJ Performance Actions
  // --------------------------------------------------------
  const triggerTapeStop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !isPlaying) return;

    const startRate = audio.playbackRate;
    const durationMs = 1500;
    const startTime = performance.now();

    const animateStop = (time) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / durationMs, 1);

      const easeProgress = 1 - Math.pow(1 - progress, 3);
      audio.playbackRate = Math.max(startRate * (1 - easeProgress), 0.01);

      if (progress < 1) {
        requestAnimationFrame(animateStop);
      } else {
        audio.pause();
        setIsPlaying(false);
        audio.playbackRate = playbackRate;
      }
    };
    requestAnimationFrame(animateStop);
  }, [isPlaying, playbackRate]);


  // --------------------------------------------------------
  // 6. Library Fetching & Navigation
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
  // 7. Context Provider Export
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
    triggerTapeStop,
  }), [
    tracks, albums, currentIndex, isPlaying, currentTime, duration,
    volume, playbackRate, libraryPath, isLoadingLibrary, libraryError, audioEffects,
    loadLibrary, refreshLibrary, selectTrack, playAlbum, togglePlay, prevTrack, nextTrack, seek, triggerTapeStop
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