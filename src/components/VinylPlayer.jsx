import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { Matrix, digits } from './ElevenLabsMatrix'
import { LiveWaveform } from './ElevenLabsLiveWaveform'
import './VinylPlayer.css'

export default function VinylPlayer({ isPlaying, coverUrl, className = '', audioElement, trackNumber = 1 }) {
  const vinylRef = useRef(null)
  const tonearmRef = useRef(null)
  const spinTweenRef = useRef(null)

  useEffect(() => {
    if (!vinylRef.current) return

    if (!spinTweenRef.current) {
      spinTweenRef.current = gsap.to(vinylRef.current, {
        rotation: '+=360',
        duration: 2.4,
        ease: 'none',
        repeat: -1,
        paused: true,
      })
    }

    if (isPlaying) {
      spinTweenRef.current.play()
    } else {
      spinTweenRef.current.pause()
    }
  }, [isPlaying])

  useEffect(() => {
    if (!tonearmRef.current) return
    gsap.to(tonearmRef.current, {
      rotation: isPlaying ? 30 : 0,
      duration: 0.6,
      ease: 'power2.out',
    })
  }, [isPlaying])

  const tens = Math.floor((trackNumber % 100) / 10)
  const ones = trackNumber % 10

  return (
    <div className={`vp-turntable ${className}`}>
      {/* platter base */}
      <div className="vp-platter">
        {/* spinning vinyl */}
        <div className="vp-vinyl" ref={vinylRef}>
          <div className="vp-groove vp-groove--1" />
          <div className="vp-groove vp-groove--2" />
          <div className="vp-groove vp-groove--3" />
          <div className="vp-groove vp-groove--4" />
          {/* album label */}
          <div
            className="vp-label"
            style={{
              backgroundImage: coverUrl ? `url(${coverUrl})` : undefined,
              background: !coverUrl
                ? 'linear-gradient(135deg, #2a2a5a, #1a1a3a)'
                : undefined,
            }}
          >
            <div className="vp-spindle" />
          </div>
        </div>
      </div>

      {/* tonearm */}
      <div className="vp-tonearm-pivot">
        <div className="vp-pivot-ring" />
        <div className="vp-tonearm" ref={tonearmRef}>
          <div className="vp-tonearm-wand" />
          <div className="vp-tonearm-bend">
            <div className="vp-tonearm-head">
              <div className="vp-tonearm-head-detail" />
              <div className="vp-tonearm-head-detail right" />
            </div>
          </div>
        </div>
      </div>

      {/* digital interface bottom right */}
      <div className="vp-digital-displays">
        <div className="vp-digital-panel">
          <div className="vp-digital-matrix">
             <Matrix rows={7} cols={5} pattern={digits[tens]} size={4} gap={1}
               palette={{ on: '#38bdf8', off: 'rgba(56,189,248,0.08)' }} />
             <Matrix rows={7} cols={5} pattern={digits[ones]} size={4} gap={1}
               palette={{ on: '#38bdf8', off: 'rgba(56,189,248,0.08)' }} />
          </div>
        </div>
        <div className="vp-digital-panel">
          <div className="vp-digital-wave">
             <LiveWaveform 
                active={isPlaying} 
                mode="scrolling" 
                audioElement={audioElement} 
                color="#38bdf8"
                barWidth={2}
                barGap={2}
             />
          </div>
        </div>
      </div>
    </div>
  )
}
