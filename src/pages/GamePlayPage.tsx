import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useUIStore } from '../store/uiStore'
import VirtualController from '../components/VirtualController'
import OrientationGuard from '../components/OrientationGuard'
import PhaserGame from '../game/PhaserGame'
import { DemoScene } from '../game/games/DemoGame/DemoScene'
import { useFullscreen } from '../hooks/useFullscreen'

export default function GamePlayPage() {
  const { id: _id } = useParams()
  const navigate = useNavigate()
  const { showToolbar, setShowToolbar } = useUIStore()
  const [isPaused, setIsPaused] = useState(false)
  const sceneRef = useRef<DemoScene | null>(null)
  const { isFullscreen, toggleFullscreen } = useFullscreen()

  const handleGameReady = useCallback((game: Phaser.Game) => {
    sceneRef.current = game.scene.getScene('DemoScene') as DemoScene
  }, [])

  const handleInput = useCallback((input: { direction?: string; action?: string }) => {
    sceneRef.current?.setInput(input)
  }, [])

  useEffect(() => {
    let timer: number
    if (showToolbar) {
      timer = window.setTimeout(() => setShowToolbar(false), 3000)
    }
    return () => clearTimeout(timer)
  }, [showToolbar, setShowToolbar])

  useEffect(() => {
    if (sceneRef.current) {
      if (isPaused) sceneRef.current.scene.pause()
      else sceneRef.current.scene.resume()
    }
  }, [isPaused])

  return (
    <OrientationGuard>
      <div className="h-full bg-black relative" onClick={() => setShowToolbar(true)}>
        {/* Phaser 游戏 */}
        <div className="absolute inset-0">
          <PhaserGame scene={DemoScene} onReady={handleGameReady} />
        </div>

        {/* 顶部工具栏 */}
        <div
          className={`absolute top-0 left-0 right-0 p-4 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent transition-opacity z-20 ${
            showToolbar ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <button
            onClick={(e) => { e.stopPropagation(); navigate(-1) }}
            className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"
          >
            ✕
          </button>
          <div className="flex gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); toggleFullscreen() }}
              className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"
            >
              {isFullscreen ? '⊙' : '⛶'}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setIsPaused(!isPaused) }}
              className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"
            >
              {isPaused ? '▶' : '⏸'}
            </button>
          </div>
        </div>

        {/* 暂停遮罩 */}
        {isPaused && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-30">
            <div className="text-center">
              <p className="text-2xl mb-4">游戏暂停</p>
              <button onClick={() => setIsPaused(false)} className="px-6 py-2 btn-neon rounded-full">
                继续
              </button>
            </div>
          </div>
        )}

        {/* 虚拟控制器 */}
        {!isPaused && <VirtualController onInput={handleInput} />}
      </div>
    </OrientationGuard>
  )
}
