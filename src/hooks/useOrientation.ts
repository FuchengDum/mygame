import { useEffect } from 'react'
import { useUIStore } from '../store/uiStore'

export function useOrientation() {
  const { isLandscape, setLandscape } = useUIStore()

  useEffect(() => {
    const handleResize = () => {
      setLandscape(window.innerWidth > window.innerHeight)
    }
    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleResize)
    }
  }, [setLandscape])

  return isLandscape
}
