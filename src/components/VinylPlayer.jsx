import { useEffect, useRef, useState, useMemo } from 'react'
import gsap from 'gsap'
import { Matrix, digits } from './ElevenLabsMatrix'
import { LiveWaveform } from './ElevenLabsLiveWaveform'
import ImageDotMatrix from './ImageDotMatrix'
import vinylImage from '../assets/Vinyl.png'
import './VinylPlayer.css'

const VINYL_COLORS = [
  ['#8B0000', '#B22222'],
  ['#1a1a5e', '#2a2a8e'],
  ['#0d3b2e', '#145c47'],
  ['#4a1942', '#6b2d6b'],
  ['#2e1503', '#5c2a06'],
  ['#1a3a4a', '#2a5a7a'],
  ['#3d0c02', '#6e1c0a'],
  ['#0a2e0a', '#145c14'],
  ['#2d2d2d', '#4a4a4a'],
  ['#3b1f2b', '#5c3044'],
]

function hashStr(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

const FONT = {
  A: '01110,10001,10001,11111,10001,10001,10001',
  B: '11110,10001,10001,11110,10001,10001,11110',
  C: '01111,10000,10000,10000,10000,10000,01111',
  D: '11110,10001,10001,10001,10001,10001,11110',
  E: '11111,10000,10000,11110,10000,10000,11111',
  F: '11111,10000,10000,11110,10000,10000,10000',
  G: '01111,10000,10000,10011,10001,10001,01111',
  H: '10001,10001,10001,11111,10001,10001,10001',
  I: '01110,00100,00100,00100,00100,00100,01110',
  J: '00111,00010,00010,00010,10010,10010,01100',
  K: '10001,10010,10100,11000,10100,10010,10001',
  L: '10000,10000,10000,10000,10000,10000,11111',
  M: '10001,11011,10101,10101,10001,10001,10001',
  N: '10001,11001,11001,10101,10011,10011,10001',
  O: '01110,10001,10001,10001,10001,10001,01110',
  P: '11110,10001,10001,11110,10000,10000,10000',
  Q: '01110,10001,10001,10001,10101,10010,01101',
  R: '11110,10001,10001,11110,10100,10010,10001',
  S: '01111,10000,10000,01110,00001,00001,11110',
  T: '11111,00100,00100,00100,00100,00100,00100',
  U: '10001,10001,10001,10001,10001,10001,01110',
  V: '10001,10001,10001,10001,10001,01010,00100',
  W: '10001,10001,10001,10101,10101,11011,10001',
  X: '10001,10001,01010,00100,01010,10001,10001',
  Y: '10001,10001,10001,01010,00100,00100,00100',
  Z: '11111,00001,00010,00100,01000,10000,11111',
  ' ': '00000,00000,00000,00000,00000,00000,00000',
  '-': '00000,00000,00000,11111,00000,00000,00000',
  '?': '01110,10001,00010,00100,00100,00000,00100',
  '.': '00000,00000,00000,00000,00000,01100,01100',
};

const STR_CACHE = {};
function getCharMatrix(char) {
  const upper = char.toUpperCase();
  if (/[0-9]/.test(upper)) return digits[parseInt(upper)];
  if (STR_CACHE[upper]) return STR_CACHE[upper];
  const raw = FONT[upper] || FONT['?'];
  const mat = raw.split(',').map(r => r.split('').map(Number));
  STR_CACHE[upper] = mat;
  return mat;
}

function createTextFrames(text, viewCols) {
  const chars = text.split('').map(getCharMatrix);
  const rows = 7;
  const textCols = chars.length === 0 ? 0 : chars.length * 6 - 1;
  const totalCols = viewCols + textCols + viewCols;
  const fullPattern = Array.from({ length: rows }, () => Array(totalCols).fill(0));
  chars.forEach((mat, i) => {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < 5; c++) {
        fullPattern[r][viewCols + i * 6 + c] = mat[r][c] || 0;
      }
    }
  });

  const frames = [];
  const shiftCount = viewCols + textCols;
  for (let shift = 0; shift < shiftCount; shift++) {
    const frame = [];
    for (let r = 0; r < rows; r++) {
      frame.push(fullPattern[r].slice(shift, shift + viewCols));
    }
    frames.push(frame);
  }
  return frames.length ? frames : [Array.from({ length: rows }, () => Array(viewCols).fill(0))];
}

function cleanTitle(title) {
  if (!title) return 'UNKNOWN';
  let cleaned = title.replace(/[\(\[]\s*(feat|ft)\.?\s+[^()\[\]]*[\)\]]/gi, '');
  cleaned = cleaned.replace(/\s+(feat|ft)\.?\s+.*$/gi, '');
  cleaned = cleaned.replace(/\(\s*\)/g, '').replace(/\[\s*\]/g, '').trim();
  return cleaned.substring(0, 30);
}

// ============================================================================
// PERFORMANCE FIX 1: Isolate the 1-second interval so it doesn't re-render the whole player
// ============================================================================
const StatusPulse = ({ isPlaying }) => {
  const [pulse, setPulse] = useState(1);
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => setPulse(p => p === 1 ? 0.2 : 1), 1000);
    return () => clearInterval(interval);
  }, [isPlaying]);

  return (
    <Matrix
      rows={1} cols={1} pattern={isPlaying ? [[pulse]] : [[0.1]]}
      size={6} gap={0}
      palette={{ on: '#ffffff', off: 'rgba(255, 255, 255, 0.15)' }}
    />
  );
};

export default function VinylPlayer({ isPlaying, coverUrl, className = '', audioElement, trackNumber = 1, songName = '', albumName = '', volume = 0.8, onVolumeChange, playbackRate = 1, onPlaybackRateChange, audioEffects = {}, onEffectChange, onPrevAlbum, onNextAlbum, onTogglePlay, lyrics = [], currentTime = 0, onSeek }) {
  const [showLyrics, setShowLyrics] = useState(false);
  const lyricsContainerRef = useRef(null);

  const vinylColor = useMemo(() => {
    const idx = hashStr(albumName || songName || 'default') % VINYL_COLORS.length
    return VINYL_COLORS[idx]
  }, [albumName, songName])

  // Calculate active lyric index
  const activeIndex = useMemo(() => {
    if (!lyrics || lyrics.length === 0) return -1;
    let index = -1;
    for (let i = 0; i < lyrics.length; i++) {
      if (currentTime >= lyrics[i].time) {
        index = i;
      } else {
        break;
      }
    }
    return index;
  }, [lyrics, currentTime]);

  // ============================================================================
  // PERFORMANCE FIX 2: Spotify-style smooth GSAP scrolling (No clunky native jumps)
  // ============================================================================
  useEffect(() => {
    if (showLyrics && lyricsContainerRef.current && activeIndex !== -1) {
      const container = lyricsContainerRef.current;
      const activeEl = container.children[activeIndex];

      if (activeEl) {
        // Calculate exact center position
        const targetScrollTop = activeEl.offsetTop - (container.clientHeight / 2) + (activeEl.clientHeight / 2);

        // Use GSAP for buttery smooth scrolling that doesn't stutter on React renders
        gsap.to(container, {
          scrollTop: targetScrollTop,
          duration: 0.6,
          ease: 'power2.out',
          overwrite: 'auto'
        });
      }
    }
  }, [activeIndex, showLyrics]);

  const vinylRef = useRef(null)
  const vinylWrapperRef = useRef(null)
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
    if (!vinylWrapperRef.current) return
    gsap.fromTo(vinylWrapperRef.current, {
      y: -400,
      rotation: -150,
      opacity: 0,
    }, {
      y: 0,
      rotation: 0,
      opacity: 1,
      duration: 1.8,
      ease: 'power3.out',
      overwrite: 'auto'
    })
  }, [])

  useEffect(() => {
    if (!tonearmRef.current) return
    gsap.to(tonearmRef.current, {
      rotation: isPlaying ? 30 : 0,
      duration: 0.6,
      ease: 'power2.out',
    })
  }, [isPlaying])

  const countDigits = trackNumber
    .toString()
    .padStart(2, "0")
    .split("")
    .map(Number);

  const viewCols = 48;
  const txtFrames = useMemo(() => createTextFrames(cleanTitle(songName), viewCols), [songName]);

  // ============================================================================
  // PERFORMANCE FIX 3: Memoize heavy Canvas/Matrix components to stop lag spikes
  // ============================================================================
  const MemoizedCoverMatrix = useMemo(() => (
    coverUrl ? (
      <ImageDotMatrix
        src={coverUrl}
        cols={8} rows={8} dotSize={10} gap={1.5} opacity={0.9} width="100%" height="100%"
      />
    ) : (
      <div style={{ color: 'rgba(255,255,255,0.05)', fontSize: '24px' }}>🎵</div>
    )
  ), [coverUrl]);

  const MemoizedScrollingTitle = useMemo(() => (
    <Matrix
      className="vp-scrolling-matrix"
      rows={7} cols={viewCols} frames={txtFrames}
      fps={15} size={3.5} gap={1}
      palette={{ on: '#ffffff', off: 'rgba(255,255,255,0.15)' }}
    />
  ), [txtFrames]);

  return (
    <div className={`vp-turntable ${className}`}>
      {/* decorative corner screws */}
      <div className="vp-screw vp-screw--tl" />
      <div className="vp-screw vp-screw--tr" />
      <div className="vp-screw vp-screw--bl" />
      <div className="vp-screw vp-screw--br" />

      {/* power indicator */}
      <div className={`vp-power-dot ${isPlaying ? 'vp-power-dot--on' : 'vp-power-dot--off'}`} />

      {/* platter base */}
      <div className="vp-platter">
        <div className="vp-vinyl-wrapper" ref={vinylWrapperRef}>
          <div className="vp-vinyl" ref={vinylRef}>
            <img src={vinylImage} alt="Vinyl Record" className="vp-vinyl-bg" />
            <div className="vp-label" style={{ background: `linear-gradient(135deg, ${vinylColor[0]}, ${vinylColor[1]})` }}>
              <div className="vp-spindle" />
            </div>
          </div>
        </div>
      </div>

      {/* tonearm */}
      <div className="vp-tonearm-pivot">
        <div className="vp-pivot-ring" />
        <div className="vp-tonearm" ref={tonearmRef}>
          <div className="vp-tonearm-wand"></div>
          <div className="vp-tonearm-bend">
            <div className="vp-tonearm-head"></div>
          </div>
        </div>
      </div>

      {/* digital interface bottom right */}
      <div className="vp-digital-displays">
        {/* Unified Album Navigation Control (Top) */}
        <div style={{ display: 'flex', gap: '18px', marginBottom: '0px', marginRight: '55px', justifyContent: 'center', position: 'relative', zIndex: 50 }}>
          <button
            className="vp-retro-btn"
            onClick={(e) => { e.stopPropagation(); onPrevAlbum?.(); }}
            title="Previous Album"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>

          <button
            className="vp-retro-btn"
            onClick={(e) => { e.stopPropagation(); onTogglePlay?.(); }}
            title="Play/Pause"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
              <line x1="12" y1="2" x2="12" y2="12"></line>
            </svg>
          </button>

          <button
            className="vp-retro-btn"
            onClick={(e) => { e.stopPropagation(); onNextAlbum?.(); }}
            title="Next Album"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>

          <button
            className="vp-retro-btn"
            style={{ color: showLyrics ? '#fff' : '' }}
            onClick={(e) => { e.stopPropagation(); setShowLyrics(!showLyrics); }}
            title="Toggle Lyrics"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
          </button>
        </div>

        {/* Scrolling Track Matrix (Top-most) - ALWAYS VISIBLE */}
        <div className="vp-digital-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', width: '260px', height: 'auto', minHeight: '62px', boxSizing: 'border-box', overflow: 'hidden', marginTop: '12px', alignSelf: 'flex-end' }}>
          <div style={{ display: 'flex' }}>
            {MemoizedScrollingTitle}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end', marginTop: '12px', height: '450px' }}>

          {/* Left Column: Permanent Cover Monitor */}
          <div className="vp-digital-panel" style={{ flexDirection: 'column', gap: '16px', padding: '14px', height: 'auto', width: '108px', boxSizing: 'border-box', alignItems: 'center', justifyContent: 'center' }}>

            <div style={{ width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {MemoizedCoverMatrix}
            </div>

            {/* The new rectangular album navigation buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '085px', marginTop: '2px' }}>
              <button
                className='vp-retro-btn-rect'
                onClick={(e) => { e.stopPropagation(); onPrevAlbum?.(); }}
                title="Previous Album"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
              </button>

              <button
                className='vp-retro-btn-rect'
                onClick={(e) => { e.stopPropagation(); onNextAlbum?.(); }}
                title="Next Album"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>
            </div>

          </div>


          {/* Right Column: Switching Control/Display Area */}
          <div style={{ width: '260px', height: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {showLyrics ? (
              <div
                ref={lyricsContainerRef}
                className="vp-digital-panel vp-lyrics-container"
                style={{
                  padding: '45px 20px', width: '100%', height: '100%', boxSizing: 'border-box',
                  display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto'
                }}
              >
                {lyrics.length > 0 ? (
                  lyrics.map((line, idx) => {
                    const isCurrent = idx === activeIndex;
                    return (
                      <div
                        key={idx}
                        onClick={() => onSeek?.(line.time)}
                        style={{
                          color: isCurrent ? '#fff' : 'rgba(255,255,255,0.25)',
                          fontSize: '18px',
                          lineHeight: '1.4',
                          fontFamily: "'Doto', sans-serif",
                          fontWeight: isCurrent ? 600 : 400,
                          letterSpacing: '0.01em',
                          transition: 'color 0.4s ease, font-weight 0.4s ease', // Stripped heavy transitions for extreme smoothness
                          cursor: 'pointer',
                          textAlign: 'center',
                          padding: '12px 0'
                        }}
                      >
                        {line.text}
                      </div>
                    );
                  })
                ) : (
                  <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '14px', fontFamily: "'Doto', sans-serif", textAlign: 'center', padding: '20px' }}>No lyrics found.</div>
                )}
              </div>
            ) : (
              <>
                {/* Audio Mixing Sliders Panel */}
                <div className="vp-digital-panel vp-sliders-container" style={{ height: '200px', flexShrink: 0 }}>
                  <div className="vp-slider-group">
                    <span className="vp-slider-label">VOL</span>
                    <div className="vp-slider-wrapper">
                      <div className="vp-slider-ticks" />
                      <input type="range" className="vp-slider" min="0" max="100" step="10"
                        value={Math.round(volume * 100)} onChange={e => onVolumeChange?.(Number(e.target.value) / 100)}
                      />
                    </div>
                  </div>
                  <div className="vp-slider-group">
                    <span className="vp-slider-label">BASS</span>
                    <div className="vp-slider-wrapper">
                      <div className="vp-slider-ticks" />
                      <input type="range" className="vp-slider" min="-12" max="12" step="1"
                        value={audioEffects.eqLow ?? 0} onChange={e => onEffectChange?.('eqLow', Number(e.target.value))}
                      />
                    </div>
                  </div>
                  <div className="vp-slider-group">
                    <span className="vp-slider-label">MID</span>
                    <div className="vp-slider-wrapper">
                      <div className="vp-slider-ticks" />
                      <input type="range" className="vp-slider" min="-12" max="12" step="1"
                        value={audioEffects.eqMid ?? 0} onChange={e => onEffectChange?.('eqMid', Number(e.target.value))}
                      />
                    </div>
                  </div>
                  <div className="vp-slider-group">
                    <span className="vp-slider-label">TRE</span>
                    <div className="vp-slider-wrapper">
                      <div className="vp-slider-ticks" />
                      <input type="range" className="vp-slider" min="-12" max="12" step="1"
                        value={audioEffects.eqHigh ?? 0} onChange={e => onEffectChange?.('eqHigh', Number(e.target.value))}
                      />
                    </div>
                  </div>
                </div>

                {/* Horizontal FX Sliders Panel */}
                <div className="vp-digital-panel" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', width: '100%', height: '70px', flexShrink: 0, boxSizing: 'border-box' }}>
                  <div className="vp-fx-container">
                    <div className="vp-fx-group">
                      <span className="vp-fx-label">REV</span>
                      <div className="vp-slider-wrapper-hz">
                        <div className="vp-slider-ticks-hz" />
                        <input type="range" className="vp-slider-hz" min="0" max="1" step="0.1"
                          value={audioEffects.reverb ?? 0} onChange={e => onEffectChange?.('reverb', Number(e.target.value))}
                        />
                      </div>
                    </div>
                    <div className="vp-fx-group">
                      <span className="vp-fx-label">DLY</span>
                      <div className="vp-slider-wrapper-hz">
                        <div className="vp-slider-ticks-hz" />
                        <input type="range" className="vp-slider-hz" min="0" max="1" step="0.1"
                          value={audioEffects.delay ?? 0} onChange={e => onEffectChange?.('delay', Number(e.target.value))}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status/Waveform Panel (Bottom) */}
                <div className="vp-digital-panel" style={{ flexDirection: 'column', gap: '16px', padding: '16px 20px', minHeight: '160px', flexShrink: 0, width: '100%', boxSizing: 'border-box' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                    {/* Status readouts */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <span style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                        Status
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <StatusPulse isPlaying={isPlaying} />
                        <span style={{ color: '#e0e0e0', fontFamily: 'monospace', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                          {isPlaying ? 'Playing' : 'Paused'}
                        </span>
                      </div>
                    </div>

                    {/* Track readouts */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                        Track
                      </div>
                      <div className="vp-digital-matrix" style={{ transform: 'none', gap: '4px', display: 'flex' }}>
                        {countDigits.map((digit, index) => (
                          <Matrix key={index} rows={7} cols={5} pattern={digits[digit]} size={5} gap={1.5} />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="vp-digital-wave" style={{ width: '100%', height: '50px' }}>
                    <LiveWaveform
                      active={isPlaying} mode="scrolling" audioElement={audioElement} color="#ffffff" barWidth={2} barGap={2}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}