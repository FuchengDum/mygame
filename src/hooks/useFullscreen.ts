import { useCallback } from 'react'
import { useUIStore } from '../store/uiStore'

export function useFullscreen() {
  const { isFullscreen, setFullscreen } = useUIStore()

  const enterFullscreen = useCallback(async () => {
    const el = document.documentElement
    try {
      if (el.requestFullscreen) await el.requestFullscreen()
      else if ((el as any).webkitRequestFullscreen) await (el as any).webkitRequestFullscreen()
      setFullscreen(true)
    } catch { /* 忽略错误 */ }
  }, [setFullscreen])

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.exitFullscreen) await document.exitFullscreen()
      else if ((document as any).webkitExitFullscreen) await (document as any).webkitExitFullscreen()
      setFullscreen(false)
    } catch { /* 忽略错误 */ }
  }, [setFullscreen])

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) exitFullscreen()
    else enterFullscreen()
  }, [isFullscreen, enterFullscreen, exitFullscreen])

  return { isFullscreen, toggleFullscreen, enterFullscreen, exitFullscreen }
}
