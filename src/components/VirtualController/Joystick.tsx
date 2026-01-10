import { useCallback, useRef, useState } from 'react'

interface Props {
  onInput: (input: { angle?: number; vector?: { x: number; y: number } }) => void
  size?: number
}

export default function Joystick({ onInput, size = 120 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const isDragging = useRef(false)
  const maxDistance = size / 2 - 25

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current || !isDragging.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    let dx = clientX - centerX
    let dy = clientY - centerY
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (distance > maxDistance) {
      dx = (dx / distance) * maxDistance
      dy = (dy / distance) * maxDistance
    }

    setOffset({ x: dx, y: dy })

    const normalizedX = dx / maxDistance
    const normalizedY = dy / maxDistance
    const angle = Math.atan2(dy, dx)

    onInput({ angle, vector: { x: normalizedX, y: normalizedY } })
  }, [maxDistance, onInput])

  const handleStart = useCallback((e: React.PointerEvent) => {
    isDragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    handleMove(e.clientX, e.clientY)
  }, [handleMove])

  const handleEnd = useCallback(() => {
    isDragging.current = false
    setOffset({ x: 0, y: 0 })
    onInput({ angle: undefined, vector: undefined })
  }, [onInput])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    handleMove(e.clientX, e.clientY)
  }, [handleMove])

  return (
    <div
      ref={containerRef}
      className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 touch-none"
      style={{ width: size, height: size }}
      onPointerDown={handleStart}
      onPointerMove={handlePointerMove}
      onPointerUp={handleEnd}
      onPointerCancel={handleEnd}
    >
      {/* 外圈 */}
      <div
        className="absolute inset-0 rounded-full bg-white/10 border-2 border-neon-purple/50"
      />
      {/* 内圈（摇杆） */}
      <div
        className="absolute w-[50px] h-[50px] rounded-full bg-neon-cyan/80 shadow-[0_0_20px_#00f5ff] left-1/2 top-1/2"
        style={{
          transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`
        }}
      />
    </div>
  )
}
