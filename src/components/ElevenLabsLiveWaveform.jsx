import React, { useEffect, useRef, useState } from 'react'
import './ElevenLabsLiveWaveform.css'

export function LiveWaveform({
  active = false,
  amplitude = 1,
  barWidth = 3,
  barGap = 4,
  maxBarHeight = 1,
  minBarHeight = 1.5,
  color = 'rgba(255, 255, 255, 0.8)',
  mirror = true,
  fftSize = 256,
  mode = 'static',
  audioElement,
  onError,
  onStream,
  onStop
}) {
  const canvasRef = useRef(null)
  const [error, setError] = useState(null)
  
  // Audio references
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const sourceRef = useRef(null)
  const streamRef = useRef(null)
  const dataArrayRef = useRef(null)
  const animationFrameRef = useRef(null)
  
  // Scrolling mode history
  const historyRef = useRef([])

  // Setup / Teardown microphone
  useEffect(() => {
    if (!active) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {})
        audioContextRef.current = null
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (onStop) onStop()
      return
    }

    let isMounted = true

    async function initAudio() {
      try {
        if (audioElement) {
          // Hook into the provided audio element instead of Mic
          if (!audioElement._audioContext) {
            const AudioContext = window.AudioContext || window.webkitAudioContext
            audioElement._audioContext = new AudioContext()
            audioElement.crossOrigin = 'anonymous'
            audioElement._waveformSource = audioElement._audioContext.createMediaElementSource(audioElement)
          }

          const ctx = audioElement._audioContext
          audioContextRef.current = ctx

          if (ctx.state === 'suspended') {
            await ctx.resume()
          }

          const analyser = ctx.createAnalyser()
          analyser.fftSize = fftSize
          analyser.smoothingTimeConstant = 0.8
          analyserRef.current = analyser

          const source = audioElement._waveformSource
          source.disconnect() // prevent multi routing bugs
          source.connect(analyser)
          analyser.connect(ctx.destination) // Connect back to speakers
          sourceRef.current = source

          const bufferLength = analyser.frequencyBinCount
          dataArrayRef.current = new Uint8Array(bufferLength)

          draw()
          return
        }

        // Default to Microphone Audio setup
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        if (!isMounted) {
          stream.getTracks().forEach(t => t.stop())
          return
        }
        
        streamRef.current = stream
        if (onStream) onStream(stream)

        const AudioContext = window.AudioContext || window.webkitAudioContext
        const ctx = new AudioContext()
        audioContextRef.current = ctx

        const analyser = ctx.createAnalyser()
        analyser.fftSize = fftSize
        analyser.smoothingTimeConstant = 0.8
        analyserRef.current = analyser

        const source = ctx.createMediaStreamSource(stream)
        source.connect(analyser)
        sourceRef.current = source

        const bufferLength = analyser.frequencyBinCount
        dataArrayRef.current = new Uint8Array(bufferLength)
        
        draw()
      } catch (err) {
        console.error('Audio hook error:', err)
        setError(err.message)
        if (onError) onError(err)
      }
    }

    initAudio()

    return () => {
      isMounted = false
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
      if (audioContextRef.current) audioContextRef.current.close().catch(() => {})
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
    }
  }, [active, fftSize])

  // Resize canvas handler
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      const parent = canvas.parentElement
      if (parent) {
        canvas.width = parent.clientWidth
        canvas.height = parent.clientHeight
      }
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  // Drawing loop
  const draw = () => {
    if (!canvasRef.current || !analyserRef.current || !dataArrayRef.current) {
      animationFrameRef.current = requestAnimationFrame(draw)
      return
    }

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const width = canvas.width
    const height = canvas.height

    ctx.clearRect(0, 0, width, height)

    // active but waiting for stream or playback (fallback animation)
    // If we're using audio element, animation continues regardless of stream!
    if (!audioElement && !streamRef.current) {
      drawLoadingState(ctx, width, height)
      animationFrameRef.current = requestAnimationFrame(draw)
      return
    }

    analyserRef.current.getByteFrequencyData(dataArrayRef.current)

    if (mode === 'static') {
      drawStatic(ctx, width, height)
    } else {
      drawScrolling(ctx, width, height)
    }

    animationFrameRef.current = requestAnimationFrame(draw)
  }

  const drawStatic = (ctx, width, height) => {
    const data = dataArrayRef.current
    const totalBars = Math.floor(width / (barWidth + barGap))
    // We only take a portion of the frequencies so it looks better
    const step = Math.max(1, Math.floor(data.length / (totalBars / 2)))

    const center = width / 2
    
    ctx.fillStyle = color
    ctx.beginPath()

    // Left side (mirrored)
    for (let i = 0; i < totalBars / 2; i++) {
      const idx = Math.floor(i * step)
      const val = data[idx] || 0
      const pct = val / 255
      
      let h = Math.max(minBarHeight, (pct * height * maxBarHeight * amplitude))
      const x = center - (i * (barWidth + barGap)) - barWidth
      const y = (height - h) / 2
      
      ctx.roundRect(x, y, barWidth, h, 2)
      
      if (!mirror) {
        // if not mirrored, we just draw standard? The elevenlabs comp mirrors statically from center.
      }
    }

    // Right side
    for (let i = 0; i < totalBars / 2; i++) {
      const idx = Math.floor(i * step)
      const val = data[idx] || 0
      const pct = val / 255
      
      let h = Math.max(minBarHeight, (pct * height * maxBarHeight * amplitude))
      const x = center + (i * (barWidth + barGap))
      const y = (height - h) / 2
      
      ctx.roundRect(x, y, barWidth, h, 2)
    }

    ctx.fill()
  }

  const drawScrolling = (ctx, width, height) => {
    // calculate average volume for this frame
    const data = dataArrayRef.current
    let sum = 0
    for(let i = 0; i < data.length; i++) sum += data[i]
    const avg = sum / data.length
    const pct = avg / 255

    // push to history
    historyRef.current.unshift(pct)
    
    const maxBars = Math.ceil(width / (barWidth + barGap))
    if (historyRef.current.length > maxBars) {
      historyRef.current.pop()
    }

    ctx.fillStyle = color
    ctx.beginPath()

    for(let i = 0; i < historyRef.current.length; i++) {
      const pointPct = historyRef.current[i]
      let h = Math.max(minBarHeight, (pointPct * height * maxBarHeight * amplitude * 2))
      const x = width - (i * (barWidth + barGap)) - barWidth
      const y = (height - h) / 2
      ctx.roundRect(x, y, barWidth, h, 2)
    }
    
    ctx.fill()
  }

  const drawLoadingState = (ctx, width, height) => {
    const time = Date.now() / 300
    const totalBars = Math.floor(width / (barWidth + barGap))
    const center = width / 2
    
    ctx.fillStyle = color
    ctx.globalAlpha = 0.5
    ctx.beginPath()

    for(let i = 0; i < totalBars / 2; i++) {
      const wave = Math.sin(time + i * 0.5) * 0.5 + 0.5
      let h = Math.max(minBarHeight, (wave * height * 0.3))
      const x = center - (i * (barWidth + barGap)) - barWidth
      const y = (height - h) / 2
      ctx.roundRect(x, y, barWidth, h, 2)
    }
    for(let i = 0; i < totalBars / 2; i++) {
      const wave = Math.sin(time + i * 0.5) * 0.5 + 0.5
      let h = Math.max(minBarHeight, (wave * height * 0.3))
      const x = center + (i * (barWidth + barGap))
      const y = (height - h) / 2
      ctx.roundRect(x, y, barWidth, h, 2)
    }

    ctx.fill()
    ctx.globalAlpha = 1.0
  }

  if (error) {
    return (
      <div className="el-live-waveform-error">
        Mic error: {error}
      </div>
    )
  }

  return (
    <div className="el-live-waveform-wrapper">
      <canvas ref={canvasRef} className="el-live-waveform-canvas" />
    </div>
  )
}
