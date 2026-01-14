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

type GameState = 'lobby' | 'playing' | 'paused' | 'gameover'

export default function SnakeGamePage() {
  const navigate = useNavigate()
  const { saveProgress, getProgress } = useGameStore()
  const isLandscape = useOrientation()

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

  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const sceneRef = useRef<SnakeScene | null>(null)

  // 回调引用
  const callbacksRef = useRef<BattleCallbacks>({})

  // 更新回调
  callbacksRef.current = {
    onLeaderboardUpdate: (data) => {
      setLeaderboard(data)
    },
    onStatsUpdate: (s) => {
      setStats(s)
    },
    onGameOver: (result) => {
      setGameResult(result)
      setGameState('gameover')
      if (result.length > highScore) {
        setHighScore(result.length)
        saveProgress('snake', { highScore: result.length })
      }
    },
    onKill: (victimName) => {
      setKillNotification(`击杀 ${victimName}!`)
      setTimeout(() => setKillNotification(null), 2000)
    }
  }

  // 初始化Phaser
  useEffect(() => {
    if (!containerRef.current || gameRef.current) return

    const callbacks = callbacksRef.current

    class GameSnakeScene extends SnakeScene {
      init() {
        super.init({ callbacks })
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
  }, [])

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
    setPlayerId(`snake_1`) // 玩家总是第一个创建

    sceneRef.current?.startGame(config)
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
          <div className="absolute top-4 left-4 bg-black/60 backdrop-blur px-3 py-2 rounded-lg border border-cyan-400/30 z-10">
            <div className="text-cyan-400 font-mono text-lg">长度: {stats.length}</div>
            <div className="text-red-400 text-sm">击杀: {stats.kills}</div>
          </div>

          {/* 排行榜 */}
          <Leaderboard
            data={leaderboard}
            playerId={playerId}
            isLandscape={isLandscape}
          />

          {/* 暂停按钮 */}
          <button
            onClick={togglePause}
            className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur px-4 py-2 rounded-lg border border-purple-400/30 text-white z-10"
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
