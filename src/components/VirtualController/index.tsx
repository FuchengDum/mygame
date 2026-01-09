import { useCallback, useRef } from 'react'

interface Props {
  onInput: (input: { direction?: string; action?: string }) => void
}

export default function VirtualController({ onInput }: Props) {
  return (
    <>
      <DPad onDirection={(dir) => onInput({ direction: dir })} />
      <ActionButtons onAction={(action) => onInput({ action })} />
    </>
  )
}

function DPad({ onDirection }: { onDirection: (dir: string | undefined) => void }) {
  const activeRef = useRef<string | undefined>(undefined)

  const handleStart = useCallback((dir: string) => () => {
    activeRef.current = dir
    onDirection(dir)
  }, [onDirection])

  const handleEnd = useCallback(() => {
    activeRef.current = undefined
    onDirection(undefined)
  }, [onDirection])

  const btnClass = (dir: string) =>
    `w-12 h-12 rounded-lg flex items-center justify-center text-xl select-none ${
      activeRef.current === dir ? 'bg-white/40 scale-110' : 'bg-white/20'
    }`

  return (
    <div className="absolute bottom-20 left-6 grid grid-cols-3 gap-1 z-50 touch-none">
      <div />
      <button className={btnClass('up')} onPointerDown={handleStart('up')} onPointerUp={handleEnd} onPointerLeave={handleEnd}>↑</button>
      <div />
      <button className={btnClass('left')} onPointerDown={handleStart('left')} onPointerUp={handleEnd} onPointerLeave={handleEnd}>←</button>
      <div className="w-12 h-12" />
      <button className={btnClass('right')} onPointerDown={handleStart('right')} onPointerUp={handleEnd} onPointerLeave={handleEnd}>→</button>
      <div />
      <button className={btnClass('down')} onPointerDown={handleStart('down')} onPointerUp={handleEnd} onPointerLeave={handleEnd}>↓</button>
      <div />
    </div>
  )
}

function ActionButtons({ onAction }: { onAction: (action: string | undefined) => void }) {
  const handleStart = useCallback((action: string) => () => {
    onAction(action)
  }, [onAction])

  const handleEnd = useCallback(() => {
    onAction(undefined)
  }, [onAction])

  return (
    <div className="absolute bottom-20 right-6 flex gap-3 z-50 touch-none">
      <button
        className="w-14 h-14 rounded-full bg-neon-blue/30 border-2 border-neon-blue flex items-center justify-center text-lg font-bold select-none active:scale-95 active:bg-neon-blue/50"
        onPointerDown={handleStart('B')}
        onPointerUp={handleEnd}
        onPointerLeave={handleEnd}
      >
        B
      </button>
      <button
        className="w-14 h-14 rounded-full bg-neon-pink/30 border-2 border-neon-pink flex items-center justify-center text-lg font-bold select-none active:scale-95 active:bg-neon-pink/50 -mt-8"
        onPointerDown={handleStart('A')}
        onPointerUp={handleEnd}
        onPointerLeave={handleEnd}
      >
        A
      </button>
    </div>
  )
}
