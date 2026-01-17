import { useEffect, useRef, useCallback } from 'react'

export function useViewport() {
  const timeoutRef = useRef<NodeJS.Timeout>()
  const lastSizeRef = useRef({ width: 0, height: 0 })
  const callbackRef = useRef<((width: number, height: number) => void) | null>(null)

  const readViewportSize = useCallback(() => {
    const width = window.visualViewport?.width ?? window.innerWidth
    const height = window.visualViewport?.height ?? window.innerHeight
    return { width, height }
  }, [])

  const updateViewport = useCallback(() => {
    const { width, height } = readViewportSize()

    if (
      Math.abs(width - lastSizeRef.current.width) > 1 ||
      Math.abs(height - lastSizeRef.current.height) > 1
    ) {
      lastSizeRef.current = { width, height }
      callbackRef.current?.(width, height)

      document.documentElement.style.setProperty('--app-height', `${height}px`)
      document.documentElement.style.setProperty('--app-width', `${width}px`)
    }
  }, [readViewportSize])

  const throttledUpdate = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(updateViewport, 50)
  }, [updateViewport])

  const setResizeCallback = useCallback((callback: (width: number, height: number) => void) => {
    callbackRef.current = callback
    const { width, height } = readViewportSize()
    lastSizeRef.current = { width, height }
    callback(width, height)
    document.documentElement.style.setProperty('--app-height', `${height}px`)
    document.documentElement.style.setProperty('--app-width', `${width}px`)
  }, [readViewportSize])

  useEffect(() => {
    updateViewport()

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', throttledUpdate)
      window.visualViewport.addEventListener('scroll', throttledUpdate)
    }

    window.addEventListener('resize', throttledUpdate)
    window.addEventListener('orientationchange', throttledUpdate)
    window.addEventListener('pageshow', throttledUpdate)
    window.addEventListener('visibilitychange', throttledUpdate)

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', throttledUpdate)
        window.visualViewport.removeEventListener('scroll', throttledUpdate)
      }
      window.removeEventListener('resize', throttledUpdate)
      window.removeEventListener('orientationchange', throttledUpdate)
      window.removeEventListener('pageshow', throttledUpdate)
      window.removeEventListener('visibilitychange', throttledUpdate)
    }
  }, [throttledUpdate, updateViewport])

  return {
    width: lastSizeRef.current.width || window.visualViewport?.width || window.innerWidth,
    height: lastSizeRef.current.height || window.visualViewport?.height || window.innerHeight,
    setResizeCallback
  }
}
