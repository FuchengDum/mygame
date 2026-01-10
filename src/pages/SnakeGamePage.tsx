import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Phaser from 'phaser'
import { useGameStore } from '../store/gameStore'
import { createGameConfig } from '../game/config'
import { SnakeScene } from '../game/games/SnakeGame/SnakeScene'
import Joystick from '../components/VirtualController/Joystick'
import { useOrientation } from '../hooks/useOrientation'

type GameState = 'ready' | 'playing' | 'paused' | 'gameover'

export default function SnakeGamePage() {
  const navigate = useNavigate()
  const { saveProgress, getProgress } = useGameStore()
  const isLandscape = useOrientation()
  const [gameState, setGameState] = useState<GameState>('ready')
  const [score, setScore] = useState(0)
  const [finalScore, setFinalScore] = useState(0)
  const [highScore, setHighScore] = useState(() => {
    const saved = getProgress('snake') as { highScore?: number } | null
    return saved?.highScore || 0
  })
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const sceneRef = useRef<SnakeScene | null>(null)
  const callbacksRef = useRef({ onScore: setScore, onGameOver: (_s: number, _h: number) => {} })

  // 更新回调引用
  callbacksRef.current.onGameOver = useCallback((finalScore: number, newHighScore: number) => {
    setFinalScore(finalScore)
    setHighScore(newHighScore)
    setGameState('gameover')
    saveProgress('snake', { highScore: newHighScore })
  }, [saveProgress])

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return

    const callbacks = callbacksRef.current
    const savedHighScore = highScore

    // 创建自定义场景类，注入回调
    class GameSnakeScene extends SnakeScene {
      init() {
        super.init({
          highScore: savedHighScore,
          onScore: (s: number) => callbacks.onScore(s),
          onGameOver: (s: number, h: number) => callbacks.onGameOver(s, h)
        })
      }
    }

    const config = createGameConfig(containerRef.current, GameSnakeScene)
    config.physics = { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } }
    const game = new Phaser.Game(config)
    gameRef.current = game

    game.events.once(Phaser.Core.Events.READY, () => {
      setTimeout(() => {
        const scene = game.scene.getScene('SnakeScene') as SnakeScene
        sceneRef.current = scene
      }, 100)
    })

    return () => {
      gameRef.current?.destroy(true)
      gameRef.current = null
      sceneRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startGame = useCallback(() => {
    setGameState('playing')
    setScore(0)
    sceneRef.current?.startGame()
  }, [])

  const togglePause = useCallback(() => {
    if (gameState === 'playing') {
      setGameState('paused')
      sceneRef.current?.scene.pause()
    } else if (gameState === 'paused') {
      setGameState('playing')
      sceneRef.current?.scene.resume()
    }
  }, [gameState])

  const handleInput = useCallback((input: { angle?: number; vector?: { x: number; y: number } }) => {
    if (gameState === 'playing') {
      sceneRef.current?.setInput(input)
    }
  }, [gameState])

  return (
    <div className="h-full bg-black relative overflow-hidden">
      {/* Phaser 游戏 */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* HUD */}
      {gameState === 'playing' && (
        <>
          <div className="absolute top-4 left-4 bg-black/60 backdrop-blur px-4 py-2 rounded-lg border border-cyan-400/30 z-10">
            <div className="text-cyan-400 font-mono text-xl">{score}</div>
            <div className="text-gray-500 text-xs">最高: {highScore}</div>
          </div>
          <button
            onClick={togglePause}
            className="absolute top-4 right-4 bg-black/60 backdrop-blur px-4 py-2 rounded-lg border border-purple-400/30 text-white z-10"
          >
            ⏸️
          </button>
        </>
      )}

      {/* 虚拟摇杆 */}
      {gameState === 'playing' && <Joystick onInput={handleInput} isLandscape={isLandscape} />}

      {/* 开始界面 */}
      {gameState === 'ready' && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-20">
          <div className="bg-gray-900/95 border border-purple-500/50 rounded-2xl p-8 text-center shadow-[0_0_40px_rgba(191,0,255,0.3)]">
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 mb-6">
              🐍 贪吃蛇大作战
            </h1>
            <p className="text-gray-400 mb-4">使用摇杆控制蛇的方向</p>
            <p className="text-gray-500 text-sm mb-6">最高分: {highScore}</p>
            <button
              onClick={startGame}
              className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-xl text-white font-bold text-lg shadow-[0_0_20px_rgba(0,245,255,0.5)] hover:scale-105 transition-transform"
            >
              开始游戏
            </button>
          </div>
        </div>
      )}

      {/* 暂停界面 */}
      {gameState === 'paused' && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-20">
          <div className="bg-gray-900/95 border border-purple-500/50 rounded-2xl p-8 text-center">
            <h2 className="text-2xl font-bold text-white mb-6">游戏暂停</h2>
            <div className="flex gap-4">
              <button
                onClick={togglePause}
                className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-xl text-white font-bold"
              >
                继续
              </button>
              <button
                onClick={() => navigate('/')}
                className="px-6 py-3 bg-gray-700 rounded-xl text-white font-bold"
              >
                返回
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 结束界面 */}
      {gameState === 'gameover' && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-20">
          <div className="bg-gray-900/95 border border-red-500/50 rounded-2xl p-8 text-center shadow-[0_0_40px_rgba(255,0,68,0.3)]">
            <h2 className="text-2xl font-bold text-red-400 mb-4">💀 游戏结束</h2>
            <div className="text-white mb-2">本次得分: <span className="text-cyan-400 font-mono text-xl">{finalScore}</span></div>
            <div className="text-gray-400 mb-6">最高记录: <span className="text-yellow-400 font-mono">{highScore}</span></div>
            <div className="flex gap-4">
              <button
                onClick={startGame}
                className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-xl text-white font-bold"
              >
                🔄 重玩
              </button>
              <button
                onClick={() => navigate('/')}
                className="px-6 py-3 bg-gray-700 rounded-xl text-white font-bold"
              >
                🏠 返回
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
