import { useEffect, useState } from 'react'

export default function useScale(designWidth, designHeight) {
  const computeScale = () => {
    if (typeof window === 'undefined') return 1
    const ratioW = window.innerWidth / designWidth
    const ratioH = window.innerHeight / designHeight
    return Math.min(ratioW, ratioH)
  }

  const [scale, setScale] = useState(() => computeScale())

  useEffect(() => {
    const handleResize = () => setScale(computeScale())
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [designWidth, designHeight])

  return scale
}
