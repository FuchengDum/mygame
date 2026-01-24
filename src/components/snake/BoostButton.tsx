// 加速按钮组件

import { useCallback, useRef } from 'react'

interface Props {
  onBoostStart: () => void
  onBoostEnd: () => void
  disabled?: boolean
  isBoosting?: boolean
  isLandscape?: boolean
}

export default function BoostButton({ onBoostStart, onBoostEnd, disabled = false, isBoosting = false, isLandscape = false }: Props) {
  const isActiveRef = useRef(false)

  const handleStart = useCallback((e: React.PointerEvent | React.TouchEvent) => {
    e.preventDefault()
    if (disabled || isActiveRef.current) return
    isActiveRef.current = true
    onBoostStart()
  }, [disabled, onBoostStart])

  const handleEnd = useCallback((e: React.PointerEvent | React.TouchEvent) => {
    e.preventDefault()
    if (!isActiveRef.current) return
    isActiveRef.current = false
    onBoostEnd()
  }, [onBoostEnd])

  return (
    <button
      className={`
        absolute bottom-20 z-50
        ${isLandscape ? 'right-8' : 'left-8'}
        w-16 h-16 rounded-full
        flex items-center justify-center
        select-none touch-none
        transition-all duration-100
        ${disabled
          ? 'bg-gray-600/30 border-2 border-gray-500/50 opacity-50'
          : isBoosting
            ? 'bg-yellow-400/40 border-3 border-yellow-400 scale-95 shadow-[0_0_20px_rgba(250,204,21,0.6)]'
            : 'bg-yellow-400/20 border-2 border-yellow-400/60 hover:bg-yellow-400/30'
        }
      `}
      onPointerDown={handleStart}
      onPointerUp={handleEnd}
      onPointerLeave={handleEnd}
      onPointerCancel={handleEnd}
      onTouchStart={handleStart}
      onTouchEnd={handleEnd}
      onTouchCancel={handleEnd}
      disabled={disabled}
    >
      {/* 闪电图标 */}
      <svg
        viewBox="0 0 24 24"
        className={`w-8 h-8 ${disabled ? 'text-gray-500' : 'text-yellow-400'}`}
        fill="currentColor"
      >
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>

      {/* 加速时的光环效果 */}
      {isBoosting && !disabled && (
        <div className="absolute inset-0 rounded-full animate-ping bg-yellow-400/30" />
      )}
    </button>
  )
}
