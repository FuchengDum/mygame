import { useEffect, useRef, useCallback } from 'react'

export function useViewport() {
  const rafRef = useRef<number | undefined>(undefined)
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

  const scheduleUpdate = useCallback(() => {
    if (rafRef.current !== undefined) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = undefined
      updateViewport()
    })
  }, [updateViewport])

  const immediateUpdate = useCallback(() => {
    if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current)
    rafRef.current = undefined
    updateViewport()
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
      window.visualViewport.addEventListener('resize', scheduleUpdate)
      window.visualViewport.addEventListener('scroll', scheduleUpdate)
    }

    window.addEventListener('resize', scheduleUpdate)
    window.addEventListener('orientationchange', immediateUpdate)
    window.addEventListener('pageshow', immediateUpdate)
    window.addEventListener('visibilitychange', immediateUpdate)

    return () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current)
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', scheduleUpdate)
        window.visualViewport.removeEventListener('scroll', scheduleUpdate)
      }
      window.removeEventListener('resize', scheduleUpdate)
      window.removeEventListener('orientationchange', immediateUpdate)
      window.removeEventListener('pageshow', immediateUpdate)
      window.removeEventListener('visibilitychange', immediateUpdate)
    }
  }, [scheduleUpdate, immediateUpdate, updateViewport])

  return {
    width: lastSizeRef.current.width || window.visualViewport?.width || window.innerWidth,
    height: lastSizeRef.current.height || window.visualViewport?.height || window.innerHeight,
    setResizeCallback
  }
}
