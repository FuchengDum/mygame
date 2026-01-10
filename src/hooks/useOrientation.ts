import { useEffect } from 'react'
import { useUIStore } from '../store/uiStore'

export function useOrientation() {
  const { isLandscape, setLandscape } = useUIStore()

  useEffect(() => {
    const handleResize = () => {
      const viewportWidth = window.visualViewport?.width ?? window.innerWidth
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight
      setLandscape(viewportWidth > viewportHeight)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleResize)
    }
  }, [setLandscape])

  return isLandscape
}
