import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'

export default function GameDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { games, currentGame, setCurrentGame } = useGameStore()

  useEffect(() => {
    const game = games.find((g) => g.id === id)
    if (game) setCurrentGame(game)
    else if (games.length === 0) {
      fetch('/data/games.json')
        .then((res) => res.json())
        .then((data) => {
          const found = data.find((g: { id: string }) => g.id === id)
          if (found) setCurrentGame(found)
        })
    }
  }, [id, games, setCurrentGame])

  if (!currentGame) {
    return <div className="h-full flex items-center justify-center text-gray-500">加载中...</div>
  }

  return (
    <div className="h-full flex flex-col bg-dark-bg">
      {/* 顶部图片 */}
      <div className="relative aspect-video bg-dark-card flex items-center justify-center">
        <span className="text-8xl">🎮</span>
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center"
        >
          ←
        </button>
      </div>

      {/* 游戏信息 */}
      <div className="flex-1 overflow-y-auto p-4">
        <h1 className="text-2xl font-bold mb-2">{currentGame.name}</h1>
        <span className="inline-block px-3 py-1 rounded-full bg-dark-card text-sm text-neon-pink mb-4">
          {currentGame.category}
        </span>
        <p className="text-gray-400 mb-4">{currentGame.description}</p>

        {currentGame.controls && (
          <div className="bg-dark-card rounded-xl p-4 neon-border">
            <h3 className="text-sm text-gray-500 mb-2">操作说明</h3>
            <p className="text-white">{currentGame.controls}</p>
          </div>
        )}
      </div>

      {/* 开始游戏按钮 */}
      <div className="p-4 pb-safe">
        <button
          onClick={() => navigate(`/play/${id}`)}
          className="w-full py-4 rounded-xl btn-neon text-white font-bold text-lg"
        >
          开始游戏
        </button>
      </div>
    </div>
  )
}
