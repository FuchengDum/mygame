import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Phaser from 'phaser'
import { useGameStore } from '../store/gameStore'
import { createGameConfig } from '../game/config'
import { SnakeScene, type BattleCallbacks } from '../game/games/SnakeGame/SnakeScene'
import type { GameConfig, GameResult, LeaderboardEntry } from '../game/games/SnakeGame/core/types'
import Joystick from '../components/VirtualController/Joystick'
import LobbyUI from '../components/snake/LobbyUI'
import Leaderboard from '../components/snake/Leaderboard'
import BoostButton from '../components/snake/BoostButton'
import ResultModal from '../components/snake/ResultModal'
import { useOrientation } from '../hooks/useOrientation'
import { useViewport } from '../hooks/useViewport'

type GameState = 'lobby' | 'playing' | 'paused' | 'gameover'

export default function SnakeGamePage() {
  const navigate = useNavigate()
  const { saveProgress, getProgress } = useGameStore()
  const isLandscape = useOrientation()
  const { setResizeCallback } = useViewport()

  const [gameState, setGameState] = useState<GameState>('lobby')
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [stats, setStats] = useState({ length: 5, kills: 0, canBoost: false })
  const [gameResult, setGameResult] = useState<GameResult | null>(null)
  const [isBoosting, setIsBoosting] = useState(false)
  const [killNotification, setKillNotification] = useState<string | null>(null)
  const [playerId, setPlayerId] = useState<string>('')

  const [highScore, setHighScore] = useState(() => {
    const saved = getProgress('snake') as { highScore?: number } | null
    return saved?.highScore || 0
  })

  // UI动态透明度状态
  const [uiOpacity, setUiOpacity] = useState({
    leaderboard: 0.75,
    pause: 1,
    minimap: 0.7,
    stats: 0.75
  })

  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const sceneRef = useRef<SnakeScene | null>(null)
  const pendingStartConfigRef = useRef<GameConfig | null>(null)
  const timeoutIdsRef = useRef<Set<number>>(new Set())

  // 回调引用
  const callbacksRef = useRef<BattleCallbacks>({
    onLeaderboardUpdate: () => {},
    onStatsUpdate: () => {},
    onGameOver: () => {},
    onKill: () => {}
  })

  // 更新回调属性（不替换对象）
  callbacksRef.current.onLeaderboardUpdate = (data) => {
    setLeaderboard(data)
  }
  callbacksRef.current.onStatsUpdate = (s) => {
    setStats(s)
  }
  callbacksRef.current.onGameOver = (result) => {
    setGameResult(result)
    setGameState('gameover')
    if (result.length > highScore) {
      setHighScore(result.length)
      saveProgress('snake', { highScore: result.length })
    }
  }
  callbacksRef.current.onKill = (victimName) => {
    setKillNotification(`击杀 ${victimName}!`)
    const timeoutId = window.setTimeout(() => setKillNotification(null), 2000)
    timeoutIdsRef.current.add(timeoutId)
  }

  // 初始化Phaser
  useEffect(() => {
    if (!containerRef.current || gameRef.current) return

    const parentEl = containerRef.current
    let rafId = 0
    let resizeRafId = 0
    let initRafId = 0
    let resizeObserver: ResizeObserver | null = null
    let lastW = 0
    let lastH = 0
    let lastRoW = 0
    let lastRoH = 0

    const syncScaleToParent = () => {
      const game = gameRef.current
      if (!game) return
      const w = parentEl.clientWidth
      const h = parentEl.clientHeight
      if (w === 0 || h === 0 || (w === lastW && h === lastH)) return
      lastW = w
      lastH = h
      game.scale.resize(w, h)
      game.scale.refresh()
    }

    const maybeInitGame = () => {
      if (gameRef.current) return

      const { clientWidth, clientHeight } = parentEl
      if (clientWidth === 0 || clientHeight === 0) return

      const callbacks = callbacksRef.current

      class GameSnakeScene extends SnakeScene {
        init() {
          super.init({ callbacks })
        }
      }

      const config = createGameConfig(parentEl, GameSnakeScene, clientWidth, clientHeight)
      config.physics = { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } }
      const game = new Phaser.Game(config)
      gameRef.current = game

      game.events.once(Phaser.Core.Events.READY, () => {
        const scene = game.scene.getScene('SnakeScene') as SnakeScene | null
        if (!scene) return
        sceneRef.current = scene
        if (pendingStartConfigRef.current) {
          scene.startGame(pendingStartConfigRef.current)
          pendingStartConfigRef.current = null
        }
      })

      setResizeCallback(() => {
        syncScaleToParent()
      })

      syncScaleToParent()
      initRafId = window.requestAnimationFrame(syncScaleToParent)
    }

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        maybeInitGame()
        if (resizeRafId) return
        resizeRafId = requestAnimationFrame(() => {
          resizeRafId = 0
          const w = parentEl.clientWidth
          const h = parentEl.clientHeight
          if (w !== lastRoW || h !== lastRoH) {
            lastRoW = w
            lastRoH = h
            syncScaleToParent()
          }
        })
      })
      resizeObserver.observe(parentEl)
    }

    const tick = () => {
      maybeInitGame()
      syncScaleToParent()
      if (!gameRef.current) {
        rafId = window.requestAnimationFrame(tick)
      }
    }
    tick()

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId)
      if (resizeRafId) window.cancelAnimationFrame(resizeRafId)
      if (initRafId) window.cancelAnimationFrame(initRafId)
      timeoutIdsRef.current.forEach(id => window.clearTimeout(id))
      timeoutIdsRef.current.clear()
      resizeObserver?.disconnect()
      gameRef.current?.destroy(true)
      gameRef.current = null
      sceneRef.current = null
    }
  }, [setResizeCallback])

  // UI动态透明度检测
  useEffect(() => {
    if (gameState !== 'playing') return

    const checkProximity = () => {
      const scene = sceneRef.current
      if (!scene) return

      const playerPos = scene['world']?.getPlayerPosition?.()
      if (!playerPos) return

      const camera = scene.cameras.main
      if (!camera) return

      // 转换为屏幕坐标
      const screenX = (playerPos.x - camera.scrollX) * camera.zoom
      const screenY = (playerPos.y - camera.scrollY) * camera.zoom

      const viewportWidth = camera.width
      const viewportHeight = camera.height

      // 计算各UI元素的透明度（提高最低阈值保证可读性）
      const newOpacity = {
        // 左上角状态和排行榜区域 (150px宽 x 300px高)
        stats: screenX < 150 && screenY < 100 ? 0.95 : 0.75,
        leaderboard: screenX < 150 && screenY > 80 && screenY < 300 ? 0.95 : 0.75,
        // 顶部暂停按钮 (居中，80px高) - 保持最低可见度
        pause: screenY < 80 && screenX > viewportWidth / 2 - 100 && screenX < viewportWidth / 2 + 100 ? 0.3 : 1,
        // 右下角小地图区域 (150px宽 x 200px高)
        minimap: screenX > viewportWidth - 150 && screenY > viewportHeight - 200 ? 0.9 : 0.7
      }

      // 仅在值变化时更新，避免不必要的重渲染
      setUiOpacity(prev => {
        if (prev.stats === newOpacity.stats &&
            prev.leaderboard === newOpacity.leaderboard &&
            prev.pause === newOpacity.pause &&
            prev.minimap === newOpacity.minimap) {
          return prev
        }
        return newOpacity
      })
    }

    const interval = setInterval(checkProximity, 100)
    return () => clearInterval(interval)
  }, [gameState])

  // 开始游戏
  const startGame = useCallback((lobbyConfig: { skinId: string; nickname: string }) => {
    const config: GameConfig = {
      skinId: lobbyConfig.skinId,
      nickname: lobbyConfig.nickname,
      aiCount: 15,
      difficulty: 'medium'
    }

    setGameState('playing')
    setLeaderboard([])
    setStats({ length: 5, kills: 0, canBoost: false })
    setGameResult(null)
    setIsBoosting(false)
    setPlayerId(`snake_1`)

    const scene = sceneRef.current
    if (scene) {
      scene.startGame(config)
    } else {
      pendingStartConfigRef.current = config
    }
  }, [])

  // 重新开始
  const restartGame = useCallback(() => {
    if (gameResult) {
      startGame({ skinId: 'cyan', nickname: 'Player' })
    }
  }, [gameResult, startGame])

  // 返回大厅
  const backToLobby = useCallback(() => {
    setGameState('lobby')
    setGameResult(null)
  }, [])

  // 暂停/继续
  const togglePause = useCallback(() => {
    if (gameState === 'playing') {
      setGameState('paused')
      sceneRef.current?.pauseGame()
    } else if (gameState === 'paused') {
      setGameState('playing')
      sceneRef.current?.resumeGame()
    }
  }, [gameState])

  // 摇杆输入
  const handleInput = useCallback((input: { angle?: number; vector?: { x: number; y: number } }) => {
    if (gameState === 'playing') {
      sceneRef.current?.setInput(input)
    }
  }, [gameState])

  // 加速控制
  const handleBoostStart = useCallback(() => {
    if (gameState === 'playing' && stats.canBoost) {
      setIsBoosting(true)
      sceneRef.current?.setBoost(true)
    }
  }, [gameState, stats.canBoost])

  const handleBoostEnd = useCallback(() => {
    setIsBoosting(false)
    sceneRef.current?.setBoost(false)
  }, [])

  return (
    <div className="h-full bg-black relative overflow-hidden">
      {/* Phaser 游戏 */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* 游戏中HUD */}
      {gameState === 'playing' && (
        <>
          {/* 左上角状态 */}
          <div
            className="absolute top-4 left-4 bg-black/60 backdrop-blur px-3 py-2 rounded-lg border border-cyan-400/30 shadow-lg shadow-cyan-500/20 z-10 transition-opacity duration-200"
            style={{ opacity: uiOpacity.stats }}
          >
            <div className="text-cyan-400 font-mono text-lg font-bold">长度: {stats.length}</div>
            <div className="text-red-400 text-sm font-semibold">击杀: {stats.kills}</div>
          </div>

          {/* 排行榜 */}
          <div style={{ opacity: uiOpacity.leaderboard, transition: 'opacity 0.2s' }}>
            <Leaderboard
              data={leaderboard}
              playerId={playerId}
              isLandscape={isLandscape}
            />
          </div>

          {/* 暂停按钮 */}
          <button
            onClick={togglePause}
            className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur px-4 py-2 rounded-lg border border-purple-400/30 shadow-lg shadow-purple-500/20 text-white z-10 transition-all duration-200 hover:bg-purple-500/20 hover:border-purple-400/50 active:scale-95"
            style={{ opacity: uiOpacity.pause }}
            aria-label="暂停"
          >
            ⏸️
          </button>

          {/* 击杀通知 */}
          {killNotification && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-red-500/80 px-4 py-2 rounded-lg text-white font-bold animate-bounce z-20">
              {killNotification}
            </div>
          )}
        </>
      )}

      {/* 虚拟摇杆 */}
      {gameState === 'playing' && (
        <Joystick onInput={handleInput} isLandscape={isLandscape} />
      )}

      {/* 加速按钮 */}
      {gameState === 'playing' && (
        <BoostButton
          onBoostStart={handleBoostStart}
          onBoostEnd={handleBoostEnd}
          disabled={!stats.canBoost}
          isBoosting={isBoosting}
          isLandscape={isLandscape}
        />
      )}

      {/* 大厅界面 */}
      {gameState === 'lobby' && (
        <LobbyUI onStart={startGame} highScore={highScore} />
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

      {/* 结算界面 */}
      {gameState === 'gameover' && gameResult && (
        <ResultModal
          result={gameResult}
          onRestart={restartGame}
          onBackToLobby={backToLobby}
        />
      )}
    </div>
  )
}
