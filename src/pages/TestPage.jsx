import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import AlbumRecordCard from '../components/AlbumRecordCard'
import './TestPage.css'

const ALBUMS = [
  { id: 1, title: 'Northern Drive', artist: 'Atlas Youth', colorA: '#213a5f', colorB: '#1b2438' },
  { id: 2, title: 'After Image', artist: 'Neon Hill', colorA: '#4f2d65', colorB: '#2f173d' },
  { id: 3, title: 'Late Metro', artist: 'Night Lines', colorA: '#225441', colorB: '#153429' },
]

const GRID_ITEMS = [
  { id: 1, color: '#35577a' },
  { id: 2, color: '#6a3f78' },
  { id: 3, color: '#3d7a6a' },
  { id: 4, color: '#7a5a35' },
  { id: 5, color: '#2d6c8a' },
  { id: 6, color: '#7a355a' },
  { id: 7, color: '#4b4f8f' },
  { id: 8, color: '#5f7a35' },
  { id: 9, color: '#7a3c3c' },
]

const COMBO_ITEMS = [
  { id: 1, title: 'Pulse One', color: '#35577a' },
  { id: 2, title: 'Pulse Two', color: '#6a3f78' },
  { id: 3, title: 'Pulse Three', color: '#3d7a6a' },
  { id: 4, title: 'Pulse Four', color: '#7a5a35' },
  { id: 5, title: 'Pulse Five', color: '#2d6c8a' },
  { id: 6, title: 'Pulse Six', color: '#7a355a' },
]

export default function TestPage() {
  const [index, setIndex] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [carouselIndex, setCarouselIndex] = useState(1)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [centeredGridId, setCenteredGridId] = useState(null)
  const [comboMode, setComboMode] = useState('grid')
  const [comboCarouselIndex, setComboCarouselIndex] = useState(0)
  const [isRecordRevealOpen, setIsRecordRevealOpen] = useState(false)
  const trackRef = useRef(null)
  const squareRef = useRef(null)
  const panelRef = useRef(null)
  const gridStageRef = useRef(null)
  const gridRefs = useRef({})
  const comboStageRef = useRef(null)
  const comboGridWrapRef = useRef(null)
  const comboCarouselWrapRef = useRef(null)
  const comboMorphRef = useRef(null)
  const comboGridRefs = useRef({})
  const comboTrackRef = useRef(null)
  const isCarouselAnimatingRef = useRef(false)
  const isComboTransitioningRef = useRef(false)
  const recordRevealCardWrapRef = useRef(null)
  const recordRevealListRef = useRef(null)

  const goNext = () => {
    setIndex(prev => (prev + 1) % ALBUMS.length)
    setIsOpen(true)
  }

  const goPrev = () => {
    setIndex(prev => (prev - 1 + ALBUMS.length) % ALBUMS.length)
    setIsOpen(true)
  }

  const goCarouselNext = () => {
    if (isCarouselAnimatingRef.current) return
    setCarouselIndex(prev => prev + 1)
  }

  const goCarouselPrev = () => {
    if (isCarouselAnimatingRef.current) return
    setCarouselIndex(prev => prev - 1)
  }

  useEffect(() => {
    if (!trackRef.current) return

    isCarouselAnimatingRef.current = true
    gsap.to(trackRef.current, {
      xPercent: -carouselIndex * 100,
      duration: 0.55,
      ease: 'power3.out',
      onComplete: () => {
        isCarouselAnimatingRef.current = false

        if (carouselIndex === 0) {
          const jumpIndex = ALBUMS.length
          gsap.set(trackRef.current, { xPercent: -jumpIndex * 100 })
          setCarouselIndex(jumpIndex)
        } else if (carouselIndex === ALBUMS.length + 1) {
          gsap.set(trackRef.current, { xPercent: -100 })
          setCarouselIndex(1)
        }
      },
    })
  }, [carouselIndex])

  useEffect(() => {
    if (!trackRef.current) return
    gsap.set(trackRef.current, { xPercent: -100 })
  }, [])

  useEffect(() => {
    const onKeyDown = (event) => {
      // For Top Carousel
      if (document.activeElement.tagName !== 'INPUT' && comboMode === 'grid') {
        if (event.key === 'ArrowRight') goCarouselNext()
        if (event.key === 'ArrowLeft') goCarouselPrev()
      }
      
      // For Combo Carousel
      if (comboMode === 'carousel') {
        if (event.key === 'ArrowRight') setComboCarouselIndex(prev => Math.min(COMBO_ITEMS.length - 1, prev + 1))
        if (event.key === 'ArrowLeft') setComboCarouselIndex(prev => Math.max(0, prev - 1))
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [comboMode])

  useEffect(() => {
    if (!squareRef.current || !panelRef.current) return

    gsap.to(squareRef.current, {
      x: isPanelOpen ? -30 : 0,
      duration: 0.35,
      ease: 'power2.out',
    })

    gsap.to(panelRef.current, {
      opacity: isPanelOpen ? 1 : 0,
      pointerEvents: isPanelOpen ? 'auto' : 'none',
      duration: 0.35,
      ease: 'power2.out',
    })
  }, [isPanelOpen])

  useEffect(() => {
    if (!recordRevealCardWrapRef.current || !recordRevealListRef.current) return

    gsap.to(recordRevealCardWrapRef.current, {
      x: isRecordRevealOpen ? -180 : 0,
      duration: 0.9,
      ease: 'power3.out',
    })

    gsap.to(recordRevealListRef.current, {
      opacity: isRecordRevealOpen ? 1 : 0,
      pointerEvents: isRecordRevealOpen ? 'auto' : 'none',
      duration: 0.85,
      ease: 'power3.out',
    })
  }, [isRecordRevealOpen])

  useEffect(() => {
    if (!gridStageRef.current) return

    const stageRect = gridStageRef.current.getBoundingClientRect()
    const stageCenterX = stageRect.left + stageRect.width / 2
    const stageCenterY = stageRect.top + stageRect.height / 2

    GRID_ITEMS.forEach(item => {
      const el = gridRefs.current[item.id]
      if (!el) return

      if (centeredGridId === null) {
        gsap.to(el, {
          x: 0,
          y: 0,
          scale: 1,
          opacity: 1,
          zIndex: 1,
          duration: 0.35,
          ease: 'power2.out',
        })
        return
      }

      if (item.id === centeredGridId) {
        const rect = el.getBoundingClientRect()
        const elCenterX = rect.left + rect.width / 2
        const elCenterY = rect.top + rect.height / 2

        gsap.to(el, {
          x: stageCenterX - elCenterX,
          y: stageCenterY - elCenterY,
          scale: 1.35,
          opacity: 1,
          zIndex: 20,
          duration: 0.45,
          ease: 'power3.out',
        })
      } else {
        gsap.to(el, {
          x: 0,
          y: 0,
          scale: 0.82,
          opacity: 0.22,
          zIndex: 1,
          duration: 0.35,
          ease: 'power2.out',
        })
      }
    })
  }, [centeredGridId])

  useEffect(() => {
    if (!comboTrackRef.current) return

    gsap.to(comboTrackRef.current, {
      xPercent: -comboCarouselIndex * 100,
      duration: 0.5,
      ease: 'power3.out',
    })
  }, [comboCarouselIndex])

  useEffect(() => {
    if (!comboCarouselWrapRef.current || !comboGridWrapRef.current || !comboTrackRef.current || !comboMorphRef.current) return

    gsap.set(comboGridWrapRef.current, { opacity: 1, pointerEvents: 'auto' })
    gsap.set(comboCarouselWrapRef.current, { opacity: 0, pointerEvents: 'none' })
    gsap.set(comboTrackRef.current, { xPercent: 0 })
    gsap.set(comboMorphRef.current, { opacity: 0, pointerEvents: 'none' })
  }, [])

  const handleComboPick = (pickedId, pickedIndex) => {
    if (isComboTransitioningRef.current) return
    if (!comboStageRef.current || !comboGridWrapRef.current || !comboCarouselWrapRef.current || !comboTrackRef.current || !comboMorphRef.current) return

    const pickedGridEl = comboGridRefs.current[pickedId]
    const pickedData = COMBO_ITEMS.find(item => item.id === pickedId)
    if (!pickedGridEl || !pickedData) return

    isComboTransitioningRef.current = true

    // Reset morph to base state (keep position:absolute/top:0/left:0 from CSS)
    gsap.set(comboMorphRef.current, {
      clearProps: 'transform,width,height,background,border,borderRadius,scale',
    })
    gsap.set(comboMorphRef.current, { opacity: 0, pointerEvents: 'none', zIndex: 40 })

    const stageRect = comboStageRef.current.getBoundingClientRect()
    const sourceRect = pickedGridEl.getBoundingClientRect()

    // Pre-position carousel track to the picked slide
    gsap.set(comboTrackRef.current, { xPercent: -pickedIndex * 100 })

    // Temporarily flash the carousel wrap (invisible) so we can measure the viewport
    gsap.set(comboCarouselWrapRef.current, { opacity: 0, pointerEvents: 'none' })
    const viewportRect = comboCarouselWrapRef.current.getBoundingClientRect()

    const targetSize = 96
    const targetX = viewportRect.left - stageRect.left + (viewportRect.width - targetSize) / 2
    const targetY = viewportRect.top - stageRect.top + (viewportRect.height - targetSize) / 2

    // Position morph exactly over the picked grid tile
    gsap.set(comboMorphRef.current, {
      x: sourceRect.left - stageRect.left,
      y: sourceRect.top - stageRect.top,
      width: sourceRect.width,
      height: sourceRect.height,
      background: pickedData.color,
      borderRadius: 12,
      border: '1px solid rgba(255, 255, 255, 0.24)',
      opacity: 1,
      zIndex: 40,
    })

    // Immediately hide the picked tile so morph replaces it visually
    gsap.set(pickedGridEl, { opacity: 0 })

    const tl = gsap.timeline()

    // Phase 1: Fade & shrink non-picked tiles while morph pulses subtly
    tl.to(
      COMBO_ITEMS.filter((_, i) => i !== pickedIndex).map(item => comboGridRefs.current[item.id]).filter(Boolean),
      {
        scale: 0.7,
        opacity: 0,
        duration: 0.3,
        ease: 'power2.in',
        stagger: 0.03,
      },
      0
    )

    // Morph: subtle lift on the picked item
    tl.to(comboMorphRef.current, {
      scale: 1.08,
      duration: 0.2,
      ease: 'power2.out',
    }, 0)

    // Phase 2: Move morph from grid position to carousel center
    tl.to(comboMorphRef.current, {
      x: targetX,
      y: targetY,
      width: targetSize,
      height: targetSize,
      scale: 1,
      duration: 0.5,
      ease: 'power3.inOut',
    }, 0.2)

    // Phase 3: Fade grid out fully during morph move
    tl.to(comboGridWrapRef.current, {
      opacity: 0,
      duration: 0.25,
      ease: 'power2.in',
    }, 0.15)

    // Phase 4: Fade carousel in as morph arrives, morph fades out
    tl.to(comboCarouselWrapRef.current, {
      opacity: 1,
      duration: 0.3,
      ease: 'power2.out',
    }, 0.55)

    tl.to(comboMorphRef.current, {
      opacity: 0,
      duration: 0.2,
      ease: 'power2.in',
    }, 0.6)

    // Cleanup
    tl.call(() => {
      setComboMode('carousel')
      setComboCarouselIndex(pickedIndex)
      gsap.set(comboGridWrapRef.current, { opacity: 0, pointerEvents: 'none' })
      gsap.set(comboCarouselWrapRef.current, { opacity: 1, pointerEvents: 'auto' })
      gsap.set(comboMorphRef.current, { opacity: 0 })

      // Reset all grid tiles for when we come back (don't clear 'all' — it strips React inline styles)
      COMBO_ITEMS.forEach(item => {
        const el = comboGridRefs.current[item.id]
        if (el) gsap.set(el, { clearProps: 'transform,opacity,zIndex' })
      })

      isComboTransitioningRef.current = false
    })
  }

  const handleComboBackToGrid = () => {
    if (!comboGridWrapRef.current || !comboCarouselWrapRef.current || !comboMorphRef.current || !comboStageRef.current) return
    if (isComboTransitioningRef.current) return

    isComboTransitioningRef.current = true

    const currentIndex = comboCarouselIndex
    const currentData = COMBO_ITEMS[currentIndex]
    if (!currentData) {
      isComboTransitioningRef.current = false
      return
    }

    const stageRect = comboStageRef.current.getBoundingClientRect()
    const viewportRect = comboCarouselWrapRef.current.getBoundingClientRect()

    // Reset morph to base state (keep position:absolute/top:0/left:0 from CSS)
    gsap.set(comboMorphRef.current, {
      clearProps: 'transform,width,height,background,border,borderRadius,scale',
    })

    // Position morph exactly over the carousel card — start FULLY VISIBLE
    // so there's no gap when the carousel fades out behind it
    const morphSize = 96
    gsap.set(comboMorphRef.current, {
      x: viewportRect.left - stageRect.left + (viewportRect.width - morphSize) / 2,
      y: viewportRect.top - stageRect.top + (viewportRect.height - morphSize) / 2,
      width: morphSize,
      height: morphSize,
      background: currentData.color,
      borderRadius: 12,
      border: '1px solid rgba(255, 255, 255, 0.24)',
      opacity: 1,
      zIndex: 40,
      pointerEvents: 'none',
    })

    // Make grid visible (but tiles transparent) so we can measure positions
    gsap.set(comboGridWrapRef.current, { opacity: 1, pointerEvents: 'none' })

    // Temporarily reset grid tiles to natural state for accurate measurement
    COMBO_ITEMS.forEach(item => {
      const el = comboGridRefs.current[item.id]
      if (el) gsap.set(el, { opacity: 0, scale: 1, x: 0, y: 0 })
    })

    // Measure the target tile position while it's at scale:1
    const targetGridEl = comboGridRefs.current[currentData.id]
    let targetX = stageRect.width / 2 - 48
    let targetY = stageRect.height / 2 - 48

    if (targetGridEl) {
      const targetRect = targetGridEl.getBoundingClientRect()
      targetX = targetRect.left - stageRect.left
      targetY = targetRect.top - stageRect.top
    }

    // Now set the tiles to their pre-animation state (scaled down, invisible)
    COMBO_ITEMS.forEach(item => {
      const el = comboGridRefs.current[item.id]
      if (el) gsap.set(el, { opacity: 0, scale: 0.7 })
    })

    const tl = gsap.timeline()

    // Phase 1: Carousel fades out silently behind the morph (morph is already visible on top)
    tl.to(comboCarouselWrapRef.current, {
      opacity: 0,
      duration: 0.3,
      ease: 'power2.inOut',
    }, 0)

    // Phase 2: Morph lifts slightly then glides to the grid tile position
    tl.to(comboMorphRef.current, {
      scale: 1.1,
      duration: 0.18,
      ease: 'power2.out',
    }, 0.05)

    tl.to(comboMorphRef.current, {
      x: targetX,
      y: targetY,
      scale: 1,
      duration: 0.5,
      ease: 'power3.inOut',
    }, 0.2)

    // Phase 3: As morph arrives, fade it out and reveal the grid tiles underneath
    // Sort tiles so the target tile appears first, then radiate outward
    const sortedTiles = COMBO_ITEMS
      .map((item, idx) => ({ item, idx, el: comboGridRefs.current[item.id] }))
      .filter(({ el }) => Boolean(el))
      .sort((a, b) => {
        const distA = Math.abs(a.idx - currentIndex)
        const distB = Math.abs(b.idx - currentIndex)
        return distA - distB
      })
      .map(({ el }) => el)

    tl.to(comboMorphRef.current, {
      opacity: 0,
      duration: 0.25,
      ease: 'power2.in',
    }, 0.55)

    tl.to(sortedTiles, {
      opacity: 1,
      scale: 1,
      duration: 0.35,
      ease: 'back.out(1.4)',
      stagger: 0.05,
    }, 0.5)

    // Cleanup
    tl.call(() => {
      setComboMode('grid')
      gsap.set(comboCarouselWrapRef.current, { opacity: 0, pointerEvents: 'none' })
      gsap.set(comboGridWrapRef.current, { opacity: 1, pointerEvents: 'auto' })
      gsap.set(comboMorphRef.current, { opacity: 0 })

      COMBO_ITEMS.forEach(item => {
        const el = comboGridRefs.current[item.id]
        if (el) gsap.set(el, { clearProps: 'transform,opacity,zIndex' })
      })

      isComboTransitioningRef.current = false
    })
  }

  const current = ALBUMS[index]
  const loopedAlbums = [ALBUMS[ALBUMS.length - 1], ...ALBUMS, ALBUMS[0]]

  return (
    <main className="test-page">
      <section className="test-section">
        <h3>Album Carousel Demo</h3>
        <div className="test-stage">
          <AlbumRecordCard
            title={current.title}
            artist={current.artist}
            colorA={current.colorA}
            colorB={current.colorB}
            isOpen={isOpen}
            onToggle={() => setIsOpen(prev => !prev)}
          />

          <div className="carousel-controls">
            <button type="button" onClick={goPrev}>Prev</button>
            <button type="button" onClick={goNext}>Next</button>
            <button type="button" onClick={() => setIsOpen(false)}>Close</button>
            <button type="button" onClick={() => setIsOpen(true)}>Open</button>
          </div>
        </div>
      </section>

      <section className="test-section">
        <h3>Arrow Key Carousel</h3>
        <p className="test-hint">Use keyboard arrow keys: Right moves slides from right to left, Left reverses. Loop is seamless.</p>

        <div className="test-stage test-stage--carousel">
          <div className="carousel-viewport">
            <div className="carousel-track" ref={trackRef}>
              {loopedAlbums.map((album, idx) => (
                <article key={`${album.id}-${idx}`} className="carousel-slide">
                  <div
                    className="carousel-card"
                    style={{
                      background: `linear-gradient(135deg, ${album.colorA}, ${album.colorB})`,
                    }}
                  >
                    <span className="carousel-card__title">{album.title}</span>
                    <span className="carousel-card__artist">{album.artist}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="carousel-controls">
            <button type="button" onClick={goCarouselPrev}>Prev</button>
            <button type="button" onClick={goCarouselNext}>Next</button>
          </div>
        </div>
      </section>

      <section className="test-section">
        <h3>Square + Right List Reveal</h3>
        <p className="test-hint">Press the square to shift it left and reveal the list on the right.</p>

        <div className="test-stage test-stage--reveal">
          <div className="reveal-layout">
            <button
              type="button"
              ref={squareRef}
              className="reveal-square"
              onClick={() => setIsPanelOpen(prev => !prev)}
              aria-expanded={isPanelOpen}
            >
              {isPanelOpen ? 'Close' : 'Open'}
            </button>

            <aside className="reveal-panel" ref={panelRef}>
              <h4>Options</h4>
              <ul>
                <li>Play Album</li>
                <li>Queue Next</li>
                <li>Show Details</li>
                <li>Add Favorite</li>
              </ul>
            </aside>
          </div>
        </div>
      </section>

      <section className="test-section">
        <h3>Grid To Center Stage</h3>
        <p className="test-hint">Click a square to bring it to center focus. Click again to reset.</p>

        <div className="test-stage test-stage--grid" ref={gridStageRef}>
          <div className="grid-stage">
            {GRID_ITEMS.map(item => (
              <button
                key={item.id}
                type="button"
                ref={el => {
                  gridRefs.current[item.id] = el
                }}
                className={`grid-square${centeredGridId === item.id ? ' grid-square--active' : ''}`}
                style={{ background: item.color }}
                onClick={() => setCenteredGridId(prev => (prev === item.id ? null : item.id))}
              >
                {item.id}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="test-section">
        <h3>Grid To Carousel Flow</h3>
        <p className="test-hint">Click a square: it centers first, then stage transitions from grid to carousel mode.</p>

        <div 
          className="test-stage test-stage--combo" 
          ref={comboStageRef}
          onClick={(e) => {
            // If in carousel mode and clicking anywhere outside the actual card, go back to grid
            if (comboMode === 'carousel' && !e.target.closest('.combo-carousel-card')) {
              handleComboBackToGrid()
            }
          }}
        >
          <div className="combo-grid-wrap" ref={comboGridWrapRef}>
            <div className="combo-grid">
              {COMBO_ITEMS.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  ref={el => {
                    comboGridRefs.current[item.id] = el
                  }}
                  className="combo-square"
                  style={{ background: item.color }}
                  onClick={() => handleComboPick(item.id, idx)}
                >
                </button>
              ))}
            </div>
          </div>

          <div className="combo-morph" ref={comboMorphRef} aria-hidden="true" />

          <div className="combo-carousel-wrap" ref={comboCarouselWrapRef} aria-hidden={comboMode !== 'carousel'}>
            <div className="combo-carousel-track" ref={comboTrackRef}>
              {COMBO_ITEMS.map(item => (
                <article key={`combo-slide-${item.id}`} className="combo-carousel-slide">
                  <div
                    className="combo-carousel-card"
                    style={{ background: item.color }}
                  >
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="test-section">
        <h3>Record & Tracklist Reveal</h3>
        <p className="test-hint">Click the album cover to spin out the record and reveal the tracklist options.</p>

        <div className="test-stage test-stage--record-reveal">
          <div className="record-reveal-layout">
            <div className="record-reveal-card-wrap" ref={recordRevealCardWrapRef}>
              <AlbumRecordCard
                title={ALBUMS[1].title}
                artist={ALBUMS[1].artist}
                colorA={ALBUMS[1].colorA}
                colorB={ALBUMS[1].colorB}
                isOpen={isRecordRevealOpen}
                onToggle={() => setIsRecordRevealOpen(prev => !prev)}
              />
            </div>

            <aside className="reveal-panel record-reveal-panel" ref={recordRevealListRef}>
              <h4>{ALBUMS[1].title} Tracks</h4>
              <ul>
                <li>1. Neon Overture</li>
                <li>2. Midnight Drive</li>
                <li>3. City Lights</li>
                <li>4. Synth Wave</li>
                <li>5. Fade Out</li>
              </ul>
            </aside>
          </div>
        </div>
      </section>
    </main>
  )
}
