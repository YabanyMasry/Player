import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import './AlbumGridCarousel.css'

export default function AlbumGridCarousel({ albums = [], onPlayAlbum }) {
  const [comboMode, setComboMode] = useState('grid')
  const [comboCarouselIndex, setComboCarouselIndex] = useState(0)
  
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
        if (event.key === 'ArrowRight') setComboCarouselIndex(prev => Math.min(albums.length - 1, prev + 1))
        if (event.key === 'ArrowLeft') setComboCarouselIndex(prev => Math.max(0, prev - 1))
        if (event.key === 'Escape') handleComboBackToGrid()
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
        duration: 0.3,
        ease: 'power2.inOut',
        stagger: 0.01,
      },
      0
    )
    
    tl.to(comboGridWrapRef.current, {
      opacity: 0,
      duration: 0.3,
      ease: 'power2.in',
    }, 0.1)

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
      backgroundColor: currentData.coverUrl ? 'transparent' : 'transparent',
      borderRadius: 0,
      opacity: 1,
      zIndex: 1000,
    })

    gsap.set(comboGridWrapRef.current, { opacity: 1, pointerEvents: 'none' })

    albums.forEach(item => {
      const el = comboGridRefs.current[item.key]
      if (el) gsap.set(el, { opacity: 0, scale: 1, x: 0, y: 0 })
    })

    const targetGridEl = comboGridRefs.current[currentData.key]
    let destX = document.documentElement.clientWidth / 2 - 110
    let destY = window.innerHeight / 2 - 110
    let destWidth = 220
    let destHeight = 220

    if (targetGridEl) {
      const targetCoverEl = targetGridEl.querySelector('.agc-cover, .agc-placeholder') || targetGridEl
      const targetRect = targetCoverEl.getBoundingClientRect()
      destX = targetRect.left
      destY = targetRect.top
      destWidth = targetRect.width
      destHeight = targetRect.height
    }

    const tl = gsap.timeline()

    tl.to(comboCarouselWrapRef.current, {
      opacity: 0,
      duration: 0.3,
      ease: 'power2.inOut',
    }, 0)

    tl.to(comboMorphRef.current, {
      scale: 1.05,
      duration: 0.18,
      ease: 'power2.out',
    }, 0.05)

    tl.to(comboMorphRef.current, {
      x: destX,
      y: destY,
      width: destWidth,
      height: destHeight,
      borderRadius: 0,
      scale: 1,
      duration: 0.5,
      ease: 'power3.inOut',
    }, 0.2)

    const sortedEls = albums
      .map((item, idx) => ({ item, idx, el: comboGridRefs.current[item.key] }))
      .filter(({ el }) => Boolean(el))
      .sort((a, b) => Math.abs(a.idx - currentIndex) - Math.abs(b.idx - currentIndex))
      .map(({ el }) => el)

    tl.to(comboMorphRef.current, {
      opacity: 0,
      duration: 0.25,
      ease: 'power2.in',
    }, 0.55)

    tl.to(sortedEls, {
      opacity: 1,
      duration: 0.35,
      ease: 'power2.out',
      stagger: 0.02,
    }, 0.5)

    tl.call(() => {
      setComboMode('grid')
      gsap.set(comboCarouselWrapRef.current, { opacity: 0, pointerEvents: 'none' })
      gsap.set(comboGridWrapRef.current, { opacity: 1, pointerEvents: 'auto' })
      gsap.set(comboMorphRef.current, { opacity: 0 })

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
          if (comboMode === 'carousel' && !e.target.closest('.agc-carousel-card')) {
            handleComboBackToGrid()
          }
        }}
      >
        <div className="agc-carousel-track" ref={comboTrackRef}>
          {albums.map(album => (
            <article key={`agc-slide-${album.key}`} className="agc-slide">
              <div
                className="agc-carousel-card"
                style={{
                  width: targetSize,
                  height: targetSize,
                  backgroundImage: album.coverUrl ? `url("${album.coverUrl}")` : 'none',
                  backgroundColor: album.coverUrl ? 'transparent' : 'transparent'
                }}
              >
                {!album.coverUrl && (
                  <div className="agc-placeholder" style={{ margin:0, height:'100%' }}>
                    <span>🎵</span>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </>
  )
}
