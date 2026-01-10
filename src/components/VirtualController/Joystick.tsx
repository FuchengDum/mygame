import { useCallback, useEffect, useRef, useState } from 'react'

interface Props {
  onInput: (input: { angle?: number; vector?: { x: number; y: number } }) => void
  isLandscape?: boolean
}

export default function Joystick({ onInput, isLandscape = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null)
  const originRef = useRef<{ x: number; y: number } | null>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const isDragging = useRef(false)
  const activePointerIdRef = useRef<number | null>(null)
  const maxDistance = 50
  const deadZone = 0.1

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging.current) return

    let centerX: number, centerY: number
    if (isLandscape && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      centerX = rect.left + rect.width / 2
      centerY = rect.top + rect.height / 2
    } else if (originRef.current) {
      centerX = originRef.current.x
      centerY = originRef.current.y
    } else {
      return
    }

    let dx = clientX - centerX
    let dy = clientY - centerY
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (distance > maxDistance) {
      dx = (dx / distance) * maxDistance
      dy = (dy / distance) * maxDistance
    }

    setOffset({ x: dx, y: dy })

    const magnitude = distance / maxDistance
    if (magnitude < deadZone) return

    const angle = Math.atan2(dy, dx)
    onInput({ angle, vector: { x: dx / maxDistance, y: dy / maxDistance } })
  }, [isLandscape, maxDistance, deadZone, onInput])

  const moveHandlerRef = useRef(handleMove)
  moveHandlerRef.current = handleMove

  const stopDragging = useCallback(() => {
    isDragging.current = false
    activePointerIdRef.current = null
    setOrigin(null)
    originRef.current = null
    setOffset({ x: 0, y: 0 })
    onInput({ angle: undefined, vector: undefined })
  }, [onInput])

  const stopDraggingRef = useRef(stopDragging)
  stopDraggingRef.current = stopDragging

  const handleWindowPointerMove = useCallback((e: PointerEvent) => {
    if (!isDragging.current) return
    if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) return
    e.preventDefault()
    moveHandlerRef.current(e.clientX, e.clientY)
  }, [])

  const handleWindowPointerEnd = useCallback((e: PointerEvent) => {
    if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) return
    e.preventDefault()
    stopDraggingRef.current()
    window.removeEventListener('pointermove', handleWindowPointerMove)
    window.removeEventListener('pointerup', handleWindowPointerEnd)
    window.removeEventListener('pointercancel', handleWindowPointerEnd)
  }, [handleWindowPointerMove])

  const handleStart = useCallback((e: React.PointerEvent) => {
    isDragging.current = true
    activePointerIdRef.current = e.pointerId
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // ignore (some browsers/devices do not support pointer capture reliably)
    }
    if (!isLandscape) {
      const nextOrigin = { x: e.clientX, y: e.clientY }
      originRef.current = nextOrigin
      setOrigin(nextOrigin)
    }
    setOffset({ x: 0, y: 0 })

    // Don’t rely solely on pointer capture: keep tracking on window so movement
    // remains responsive even when the finger leaves the joystick area.
    window.addEventListener('pointermove', handleWindowPointerMove, { passive: false })
    window.addEventListener('pointerup', handleWindowPointerEnd, { passive: false })
    window.addEventListener('pointercancel', handleWindowPointerEnd, { passive: false })
  }, [isLandscape, handleWindowPointerMove, handleWindowPointerEnd])

  const handleEnd = useCallback(() => {
    stopDragging()
    window.removeEventListener('pointermove', handleWindowPointerMove)
    window.removeEventListener('pointerup', handleWindowPointerEnd)
    window.removeEventListener('pointercancel', handleWindowPointerEnd)
  }, [stopDragging, handleWindowPointerMove, handleWindowPointerEnd])

  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove)
      window.removeEventListener('pointerup', handleWindowPointerEnd)
      window.removeEventListener('pointercancel', handleWindowPointerEnd)
    }
  }, [handleWindowPointerMove, handleWindowPointerEnd])

  // 横屏：固定位置摇杆
  if (isLandscape) {
    return (
      <div
        ref={containerRef}
        className="absolute bottom-8 left-8 w-[120px] h-[120px] z-50 touch-none"
        onPointerDown={handleStart}
        onPointerUp={handleEnd}
        onPointerCancel={handleEnd}
      >
        <div className="absolute inset-0 rounded-full bg-white/10 border-2 border-neon-purple/50" />
        <div
          className="absolute w-[50px] h-[50px] rounded-full bg-neon-cyan/80 shadow-[0_0_20px_#00f5ff] left-1/2 top-1/2"
          style={{ transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))` }}
        />
      </div>
    )
  }

  // 竖屏：浮动摇杆
  return (
    <div
      className="absolute bottom-0 left-0 right-0 h-[200px] z-50 touch-none"
      onPointerDown={handleStart}
      onPointerUp={handleEnd}
      onPointerCancel={handleEnd}
    >
      {origin && (
        <>
          <div
            className="absolute w-[100px] h-[100px] rounded-full bg-white/10 border-2 border-neon-purple/50"
            style={{
              left: origin.x - 50,
              top: origin.y - 50 - window.innerHeight + 200,
            }}
          />
          <div
            className="absolute w-[40px] h-[40px] rounded-full bg-neon-cyan/80 shadow-[0_0_20px_#00f5ff]"
            style={{
              left: origin.x - 20 + offset.x,
              top: origin.y - 20 - window.innerHeight + 200 + offset.y,
            }}
          />
        </>
      )}
    </div>
  )
}
