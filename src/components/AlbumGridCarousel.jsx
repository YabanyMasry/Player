import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import './AlbumGridCarousel.css'

export default function AlbumGridCarousel({ albums = [], onPlayAlbum }) {
  const [comboMode, setComboMode] = useState('grid')
  const [comboCarouselIndex, setComboCarouselIndex] = useState(0)
  const [revealedAlbumKey, setRevealedAlbumKey] = useState(null)
  
  const [targetSize, setTargetSize] = useState(() => 
    Math.min(window.innerWidth * 0.85, window.innerHeight * 0.85)
  )

  const comboGridWrapRef = useRef(null)
  const comboCarouselWrapRef = useRef(null)
  const comboMorphRef = useRef(null)
  const comboGridRefs = useRef({})
  const comboTrackRef = useRef(null)
  const isComboTransitioningRef = useRef(false)

  useEffect(() => {
    const onResize = () => setTargetSize(Math.min(window.innerWidth * 0.85, window.innerHeight * 0.85))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (comboMode === 'carousel') {
        if (event.key === 'ArrowRight') {
          setComboCarouselIndex(prev => Math.min(albums.length - 1, prev + 1))
          setRevealedAlbumKey(null)
        }
        if (event.key === 'ArrowLeft') {
          setComboCarouselIndex(prev => Math.max(0, prev - 1))
          setRevealedAlbumKey(null)
        }
        if (event.key === 'Escape') {
          if (revealedAlbumKey) setRevealedAlbumKey(null)
          else handleComboBackToGrid()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [comboMode, albums.length])

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

  const handleComboPick = (pickedKey, pickedIndex) => {
    if (isComboTransitioningRef.current) return
    if (!comboGridWrapRef.current || !comboCarouselWrapRef.current || !comboTrackRef.current || !comboMorphRef.current) return

    const pickedGridEl = comboGridRefs.current[pickedKey]
    const pickedData = albums[pickedIndex]
    if (!pickedGridEl || !pickedData) return

    isComboTransitioningRef.current = true

    gsap.set(comboMorphRef.current, {
      clearProps: 'transform,width,height,background,border,borderRadius,scale',
    })
    gsap.set(comboMorphRef.current, { opacity: 0, pointerEvents: 'none', zIndex: 1000 })

    const coverEl = pickedGridEl.querySelector('.agc-cover, .agc-placeholder') || pickedGridEl
    const sourceRect = coverEl.getBoundingClientRect()

    gsap.set(comboTrackRef.current, { xPercent: -pickedIndex * 100 })

    const carouselCards = comboTrackRef.current.querySelectorAll('.agc-carousel-card')
    const destCardEl = carouselCards[pickedIndex]
    
    // Safety fallback in case the DOM card isn't queryable
    let tX = (document.documentElement.clientWidth - targetSize) / 2
    let tY = (window.innerHeight - targetSize) / 2
    let tWidth = targetSize
    let tHeight = targetSize
    
    if (destCardEl) {
      const destRect = destCardEl.getBoundingClientRect()
      tX = destRect.left
      tY = destRect.top
      tWidth = destRect.width
      tHeight = destRect.height
    }

    gsap.set(comboMorphRef.current, {
      x: sourceRect.left,
      y: sourceRect.top,
      width: sourceRect.width,
      height: sourceRect.height,
      backgroundImage: pickedData.coverUrl ? `url("${pickedData.coverUrl}")` : 'none',
      backgroundColor: pickedData.coverUrl ? 'transparent' : 'transparent',
      borderRadius: 0,
      opacity: 1,
    })

    gsap.set(pickedGridEl, { opacity: 0 })

    const tl = gsap.timeline()

    const otherGridEls = albums
      .filter((_, i) => i !== pickedIndex)
      .map(item => comboGridRefs.current[item.key])
      .filter(Boolean)

    tl.to(
      otherGridEls,
      {
        opacity: 0,
        scale: 0.8,
        duration: 0.2,
        ease: 'power2.in',
        stagger: 0.005,
      },
      0
    )
    
    tl.to(comboGridWrapRef.current, {
      opacity: 0,
      duration: 0.2,
      ease: 'linear',
    }, 0)

    tl.to(comboMorphRef.current, {
      scale: 1.05,
      duration: 0.2,
      ease: 'power2.out',
    }, 0)

    tl.to(comboMorphRef.current, {
      x: tX,
      y: tY,
      width: tWidth,
      height: tHeight,
      borderRadius: 0,
      scale: 1,
      duration: 0.5,
      ease: 'power3.inOut',
    }, 0.2)

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

    tl.call(() => {
      setComboMode('carousel')
      setComboCarouselIndex(pickedIndex)
      gsap.set(comboGridWrapRef.current, { opacity: 0, pointerEvents: 'none' })
      gsap.set(comboCarouselWrapRef.current, { opacity: 1, pointerEvents: 'auto' })
      gsap.set(comboMorphRef.current, { opacity: 0 })

      albums.forEach(item => {
        const el = comboGridRefs.current[item.key]
        if (el) gsap.set(el, { clearProps: 'transform,opacity,zIndex,scale' })
      })

      isComboTransitioningRef.current = false
    })
  }

  const handleComboBackToGrid = () => {
    if (!comboGridWrapRef.current || !comboCarouselWrapRef.current || !comboMorphRef.current) return
    if (isComboTransitioningRef.current) return

    isComboTransitioningRef.current = true
    setRevealedAlbumKey(null)

    const currentIndex = comboCarouselIndex
    const currentData = albums[currentIndex]
    if (!currentData) {
      isComboTransitioningRef.current = false
      return
    }

    gsap.set(comboMorphRef.current, {
      clearProps: 'transform,width,height,background,border,borderRadius,scale',
    })

    const carouselCards = comboTrackRef.current.querySelectorAll('.agc-carousel-card')
    const sourceCardEl = carouselCards[currentIndex]
    
    let startX = (document.documentElement.clientWidth - targetSize) / 2
    let startY = (window.innerHeight - targetSize) / 2
    let startWidth = targetSize
    let startHeight = targetSize

    if (sourceCardEl) {
      const sourceRect = sourceCardEl.getBoundingClientRect()
      startX = sourceRect.left
      startY = sourceRect.top
      startWidth = sourceRect.width
      startHeight = sourceRect.height
    }

    gsap.set(comboMorphRef.current, {
      x: startX,
      y: startY,
      width: startWidth,
      height: startHeight,
      backgroundImage: currentData.coverUrl ? `url("${currentData.coverUrl}")` : 'none',
      backgroundColor: 'transparent',
      borderRadius: 0,
      opacity: currentData.coverUrl ? 1 : 0, // don't show ghost morph if no cover (placeholder)
      zIndex: 1000,
    })

    const targetGridEl = comboGridRefs.current[currentData.key]
    let destX = document.documentElement.clientWidth / 2 - 110
    let destY = window.innerHeight / 2 - 110
    let destWidth = 220
    let destHeight = 220
    let targetCoverEl = null

    if (targetGridEl) {
      targetCoverEl = targetGridEl.querySelector('.agc-cover, .agc-placeholder') || targetGridEl
      const targetRect = targetCoverEl.getBoundingClientRect()
      destX = targetRect.left
      destY = targetRect.top
      destWidth = targetRect.width
      destHeight = targetRect.height
    }

    // Reset grid elements to full size/opacity instantly (within the invisible wrapper)
    albums.forEach(item => {
      const el = comboGridRefs.current[item.key]
      if (el) gsap.set(el, { opacity: 1, scale: 1, x: 0, y: 0 })
    })

    // Hide target cover only if it's an image so morph doesn't overlap weirdly
    if (targetCoverEl && currentData.coverUrl) {
       gsap.set(targetCoverEl, { opacity: 0 })
    }

    // Prepare wrapper for fade in
    gsap.set(comboGridWrapRef.current, { opacity: 0, pointerEvents: 'none' })

    const tl = gsap.timeline()

    tl.to(comboCarouselWrapRef.current, {
      opacity: 0,
      duration: 0.3,
      ease: 'power2.inOut',
    }, 0)

    tl.to(comboMorphRef.current, {
      x: destX,
      y: destY,
      width: destWidth,
      height: destHeight,
      borderRadius: 0,
      scale: 1,
      duration: 0.5,
      ease: 'power3.inOut',
    }, 0)

    // Fade in the grid (seamlessly replacing the outgoing carousel + morph)
    tl.to(comboGridWrapRef.current, {
      opacity: 1,
      duration: 0.3,
      ease: 'power2.inOut',
    }, 0.2)

    tl.call(() => {
      setComboMode('grid')
      gsap.set(comboCarouselWrapRef.current, { opacity: 0, pointerEvents: 'none' })
      gsap.set(comboGridWrapRef.current, { opacity: 1, pointerEvents: 'auto' })
      gsap.set(comboMorphRef.current, { opacity: 0 })

      if (targetCoverEl) gsap.set(targetCoverEl, { clearProps: 'opacity' })

      albums.forEach(item => {
        const el = comboGridRefs.current[item.key]
        if (el) gsap.set(el, { clearProps: 'transform,opacity,zIndex,scale' })
      })

      isComboTransitioningRef.current = false
    })
  }

  return (
    <>
      <div className="agc-grid-wrap" ref={comboGridWrapRef}>
        <ul className="agc-grid">
          {albums.map((album, idx) => (
            <li key={album.key} className="agc-item">
              <button 
                type="button" 
                className="agc-card" 
                ref={el => {
                  comboGridRefs.current[album.key] = el
                }}
                onClick={() => handleComboPick(album.key, idx)}
                title={`View ${album.album} by ${album.artist}`}
              >
                {album.coverUrl ? (
                  <img src={album.coverUrl} alt={`${album.album} cover`} className="agc-cover" loading="lazy" />
                ) : (
                  <div className="agc-placeholder">
                    <span>🎵</span>
                  </div>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="agc-morph" ref={comboMorphRef} aria-hidden="true" />

      <div 
        className="agc-carousel-wrap" 
        ref={comboCarouselWrapRef} 
        aria-hidden={comboMode !== 'carousel'}
        onClick={(e) => {
          if (comboMode === 'carousel') {
            if (e.target.closest('.agc-tracklist-panel')) {
              return
            }
            if (revealedAlbumKey) {
              setRevealedAlbumKey(null)
              return
            }
            if (!e.target.closest('.agc-carousel-card')) {
              handleComboBackToGrid()
            }
          }
        }}
      >
        <div className="agc-carousel-track" ref={comboTrackRef}>
          {albums.map(album => (
            <article key={`agc-slide-${album.key}`} className={`agc-slide ${revealedAlbumKey === album.key ? 'agc-slide--revealed' : ''}`}>
              <div className="agc-carousel-card-wrap">
                <div className="agc-record-wrap" aria-hidden="true">
                  <div className="agc-record-visual" />
                </div>
                <div
                  className="agc-carousel-card"
                  style={{
                    width: targetSize,
                    height: targetSize,
                    backgroundImage: album.coverUrl ? `url("${album.coverUrl}")` : 'none',
                    backgroundColor: album.coverUrl ? 'transparent' : 'transparent'
                  }}
                  onClick={() => {
                    setRevealedAlbumKey(prev => prev === album.key ? null : album.key)
                  }}
                >
                  {!album.coverUrl && (
                    <div className="agc-placeholder" style={{ margin:0, height:'100%' }}>
                      <span>🎵</span>
                    </div>
                  )}
                </div>
                
                <aside className="agc-tracklist-panel">
                  <h3>{album.album}</h3>
                  <p>{album.artist}</p>
                  <ul className="agc-tracklist">
                    {album.tracks && album.tracks.map((track, i) => (
                      <li 
                        key={track.id || i} 
                        className="agc-track-item"
                        onClick={() => onPlayAlbum && onPlayAlbum(album.album)}
                      >
                        <span className="agc-track-num">{i + 1}</span>
                        <span className="agc-track-name">{track.title || track.filename || 'Unknown Track'}</span>
                      </li>
                    ))}
                  </ul>
                </aside>
              </div>
            </article>
          ))}
        </div>
      </div>
    </>
  )
}
