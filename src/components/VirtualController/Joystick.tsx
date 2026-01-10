import { useCallback, useEffect, useRef, useState } from 'react'

interface Props {
  onInput: (input: { angle?: number; vector?: { x: number; y: number } }) => void
  isLandscape?: boolean
}

export default function Joystick({ onInput, isLandscape = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null) // portrait: local (container) coords
  const originRef = useRef<{ x: number; y: number } | null>(null) // portrait: local (container) coords
  const landscapeKnobRef = useRef<HTMLDivElement>(null)
  const portraitKnobRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const activePointerIdRef = useRef<number | null>(null)
  const activeTouchIdRef = useRef<number | null>(null)
  const containerRectRef = useRef<DOMRect | null>(null)
  const centerRef = useRef<{ x: number; y: number } | null>(null) // local (container) coords
  const pendingClientRef = useRef<{ x: number; y: number } | null>(null)
  const rafIdRef = useRef<number | null>(null)
  const applyMoveFrameRef = useRef<() => void>(() => {})
  const windowListenersRef = useRef<{
    pointerMove?: (e: PointerEvent) => void
    pointerEnd?: (e: PointerEvent) => void
    touchMove?: (e: TouchEvent) => void
    touchEnd?: (e: TouchEvent) => void
  }>({})
  const maxDistance = 50
  const deadZone = 0.1

  const applyMoveFrame = useCallback(() => {
    rafIdRef.current = null
    if (!isDragging.current) return
    const point = pendingClientRef.current
    const rect = containerRectRef.current
    const center = centerRef.current
    if (!point || !rect || !center) return

    const localX = point.x - rect.left
    const localY = point.y - rect.top
    let dx = localX - center.x
    let dy = localY - center.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (distance > maxDistance) {
      dx = (dx / distance) * maxDistance
      dy = (dy / distance) * maxDistance
    }

    if (isLandscape) {
      const knob = landscapeKnobRef.current
      if (knob) {
        knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`
      }
    } else {
      const knob = portraitKnobRef.current
      const originLocal = originRef.current
      if (knob && originLocal) {
        knob.style.left = `${originLocal.x - 20 + dx}px`
        knob.style.top = `${originLocal.y - 20 + dy}px`
      }
    }

    const magnitude = distance / maxDistance
    if (magnitude < deadZone) return

    const angle = Math.atan2(dy, dx)
    onInput({ angle, vector: { x: dx / maxDistance, y: dy / maxDistance } })
  }, [deadZone, isLandscape, maxDistance, onInput])

  applyMoveFrameRef.current = applyMoveFrame

  const stopDragging = useCallback(() => {
    const originLocal = originRef.current
    isDragging.current = false
    activePointerIdRef.current = null
    activeTouchIdRef.current = null
    setOrigin(null)
    originRef.current = null
    centerRef.current = null
    pendingClientRef.current = null
    containerRectRef.current = null
    if (rafIdRef.current !== null) {
      window.cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
    const listeners = windowListenersRef.current
    if (listeners.pointerMove) window.removeEventListener('pointermove', listeners.pointerMove)
    if (listeners.pointerEnd) window.removeEventListener('pointerup', listeners.pointerEnd)
    if (listeners.pointerEnd) window.removeEventListener('pointercancel', listeners.pointerEnd)
    if (listeners.touchMove) window.removeEventListener('touchmove', listeners.touchMove)
    if (listeners.touchEnd) window.removeEventListener('touchend', listeners.touchEnd)
    if (listeners.touchEnd) window.removeEventListener('touchcancel', listeners.touchEnd)
    if (landscapeKnobRef.current) {
      landscapeKnobRef.current.style.transform = 'translate(-50%, -50%)'
    }
    if (portraitKnobRef.current && originLocal) {
      portraitKnobRef.current.style.left = `${originLocal.x - 20}px`
      portraitKnobRef.current.style.top = `${originLocal.y - 20}px`
    }
    onInput({ angle: undefined, vector: undefined })
  }, [onInput])

  const stopDraggingRef = useRef(stopDragging)
  stopDraggingRef.current = stopDragging

  const handleWindowPointerMove = useCallback((e: PointerEvent) => {
    if (!isDragging.current) return
    if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) return
    e.preventDefault()
    pendingClientRef.current = { x: e.clientX, y: e.clientY }
    if (rafIdRef.current === null) {
      rafIdRef.current = window.requestAnimationFrame(() => applyMoveFrameRef.current())
    }
  }, [])

  const handleWindowPointerEnd = useCallback((e: PointerEvent) => {
    if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) return
    e.preventDefault()
    stopDraggingRef.current()
    window.removeEventListener('pointermove', handleWindowPointerMove)
    window.removeEventListener('pointerup', handleWindowPointerEnd)
    window.removeEventListener('pointercancel', handleWindowPointerEnd)
  }, [handleWindowPointerMove])

  windowListenersRef.current.pointerMove = handleWindowPointerMove
  windowListenersRef.current.pointerEnd = handleWindowPointerEnd

  const handleWindowTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging.current) return
    const activeId = activeTouchIdRef.current
    if (activeId === null) return

    let touch: Touch | null = null
    for (let i = 0; i < e.touches.length; i++) {
      const t = e.touches.item(i)
      if (t && t.identifier === activeId) {
        touch = t
        break
      }
    }
    if (!touch) return

    e.preventDefault()
    pendingClientRef.current = { x: touch.clientX, y: touch.clientY }
    if (rafIdRef.current === null) {
      rafIdRef.current = window.requestAnimationFrame(() => applyMoveFrameRef.current())
    }
  }, [])

  const handleWindowTouchEnd = useCallback((e: TouchEvent) => {
    const activeId = activeTouchIdRef.current
    if (activeId === null) return

    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches.item(i)
      if (t && t.identifier === activeId) {
        e.preventDefault()
        stopDraggingRef.current()
        window.removeEventListener('touchmove', handleWindowTouchMove)
        window.removeEventListener('touchend', handleWindowTouchEnd)
        window.removeEventListener('touchcancel', handleWindowTouchEnd)
        break
      }
    }
  }, [handleWindowTouchMove])

  windowListenersRef.current.touchMove = handleWindowTouchMove
  windowListenersRef.current.touchEnd = handleWindowTouchEnd

  const handleStart = useCallback((e: React.PointerEvent) => {
    // In Chrome device emulation and many mobile WebViews, touch Pointer Events can be
    // unreliable (e.g. frequent pointercancel). Prefer the native touch fallback.
    if (e.pointerType === 'touch') return
    // Some mobile WebViews do not reliably support Pointer Events for touch; ignore pointer path if touch is active.
    if (activeTouchIdRef.current !== null) return
    isDragging.current = true
    activePointerIdRef.current = e.pointerId
    pendingClientRef.current = { x: e.clientX, y: e.clientY }
    e.preventDefault()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // ignore (some browsers/devices do not support pointer capture reliably)
    }
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      containerRectRef.current = rect
      if (isLandscape) {
        centerRef.current = { x: rect.width / 2, y: rect.height / 2 }
      } else {
        const localOrigin = { x: e.clientX - rect.left, y: e.clientY - rect.top }
        originRef.current = localOrigin
        setOrigin(localOrigin)
        centerRef.current = localOrigin
        if (portraitKnobRef.current) {
          portraitKnobRef.current.style.left = `${localOrigin.x - 20}px`
          portraitKnobRef.current.style.top = `${localOrigin.y - 20}px`
        }
      }
    }
    if (rafIdRef.current === null) {
      rafIdRef.current = window.requestAnimationFrame(() => applyMoveFrameRef.current())
    }

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
    const el = containerRef.current
    if (!el) return

    const onTouchStart = (e: TouchEvent) => {
      if (isDragging.current) return
      if (activePointerIdRef.current !== null) return
      if (e.changedTouches.length === 0) return

      const t = e.changedTouches.item(0)
      if (!t) return
      e.preventDefault()

      activeTouchIdRef.current = t.identifier
      isDragging.current = true
      pendingClientRef.current = { x: t.clientX, y: t.clientY }

      const rect = el.getBoundingClientRect()
      containerRectRef.current = rect
      if (isLandscape) {
        centerRef.current = { x: rect.width / 2, y: rect.height / 2 }
      } else {
        const localOrigin = { x: t.clientX - rect.left, y: t.clientY - rect.top }
        originRef.current = localOrigin
        setOrigin(localOrigin)
        centerRef.current = localOrigin
        if (portraitKnobRef.current) {
          portraitKnobRef.current.style.left = `${localOrigin.x - 20}px`
          portraitKnobRef.current.style.top = `${localOrigin.y - 20}px`
        }
      }

      if (rafIdRef.current === null) {
        rafIdRef.current = window.requestAnimationFrame(() => applyMoveFrameRef.current())
      }

      window.addEventListener('touchmove', handleWindowTouchMove, { passive: false })
      window.addEventListener('touchend', handleWindowTouchEnd, { passive: false })
      window.addEventListener('touchcancel', handleWindowTouchEnd, { passive: false })
    }

    el.addEventListener('touchstart', onTouchStart, { passive: false })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
    }
  }, [isLandscape, handleWindowTouchMove, handleWindowTouchEnd])

  useEffect(() => {
    if (!isDragging.current) return
    stopDragging()
  }, [isLandscape, stopDragging])

  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove)
      window.removeEventListener('pointerup', handleWindowPointerEnd)
      window.removeEventListener('pointercancel', handleWindowPointerEnd)
      if (rafIdRef.current !== null) window.cancelAnimationFrame(rafIdRef.current)
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
          ref={landscapeKnobRef}
          className="absolute w-[50px] h-[50px] rounded-full bg-neon-cyan/80 shadow-[0_0_20px_#00f5ff] left-1/2 top-1/2"
          style={{ transform: 'translate(-50%, -50%)' }}
        />
      </div>
    )
  }

  // 竖屏：浮动摇杆
  return (
    <div
      ref={containerRef}
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
              top: origin.y - 50,
            }}
          />
          <div
            ref={portraitKnobRef}
            className="absolute w-[40px] h-[40px] rounded-full bg-neon-cyan/80 shadow-[0_0_20px_#00f5ff]"
            style={{
              left: origin.x - 20,
              top: origin.y - 20,
            }}
          />
        </>
      )}
    </div>
  )
}
