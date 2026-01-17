import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import { useOrientation } from '../hooks/useOrientation'
import PWAInstallPrompt from '../components/PWAInstallPrompt'
import type { Game } from '../types/game'

export default function HomePage() {
  const navigate = useNavigate()
  const { games, setGames, searchQuery, setSearchQuery, category, setCategory } = useGameStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const isLandscape = useOrientation()

  useEffect(() => {
    fetch('/data/games.json')
      .then((res) => {
        if (!res.ok) throw new Error('加载失败')
        return res.json()
      })
      .then((data) => {
        setGames(data)
        setLoading(false)
      })
      .catch(() => {
        setError('游戏列表加载失败')
        setLoading(false)
      })
  }, [setGames])

  const categories = ['all', ...new Set(games.map((g) => g.category))]

  const filtered = games.filter((g) => {
    const matchSearch = g.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchCategory = category === 'all' || g.category === category
    return matchSearch && matchCategory
  })

  return (
    <div className="h-full flex flex-col bg-dark-bg">
      <PWAInstallPrompt />
      {/* 搜索栏 + 分类筛选 - 横屏时合并为一行 */}
      {isLandscape ? (
        <div className="p-2 flex gap-3 items-center">
          <input
            type="text"
            placeholder="搜索..."
            aria-label="搜索游戏"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-40 px-3 py-1.5 rounded-lg bg-dark-card neon-border text-white text-sm placeholder-gray-500 outline-none"
          />
          <div className="flex-1 flex gap-2 overflow-x-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs whitespace-nowrap transition-all ${
                  category === cat ? 'btn-neon text-white' : 'bg-dark-card text-gray-400'
                }`}
              >
                {cat === 'all' ? '全部' : cat}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="p-4 pt-safe">
            <input
              type="text"
              placeholder="搜索游戏..."
              aria-label="搜索游戏"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-dark-card neon-border text-white placeholder-gray-500 outline-none"
            />
          </div>
          <div className="px-4 pb-2 flex gap-2 overflow-x-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition-all ${
                  category === cat ? 'btn-neon text-white' : 'bg-dark-card text-gray-400'
                }`}
              >
                {cat === 'all' ? '全部' : cat}
              </button>
            ))}
          </div>
        </>
      )}

      {/* 游戏列表 */}
      <div className={`flex-1 overflow-y-auto ${isLandscape ? 'p-2' : 'p-4 pt-2'}`}>
        {loading ? (
          <div className="text-center text-gray-500 mt-10">加载中...</div>
        ) : error ? (
          <div className="text-center text-red-400 mt-10">{error}</div>
        ) : (
          <div className={`grid gap-3 ${isLandscape ? 'grid-cols-4' : 'grid-cols-2 gap-4'}`}>
            {filtered.map((game) => (
              <GameCard key={game.id} game={game} onClick={() => navigate(`/game/${game.id}`)} isLandscape={isLandscape} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function GameCard({ game, onClick, isLandscape }: { game: Game; onClick: () => void; isLandscape: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label={`${game.name} - ${game.category}`}
      className="bg-dark-card rounded-xl overflow-hidden neon-border active:neon-glow transition-all text-left focus:outline-none focus:ring-2 focus:ring-neon-blue"
    >
      <div className={`${isLandscape ? 'aspect-[2/1]' : 'aspect-[4/3]'} bg-dark-border flex items-center justify-center`}>
        <span className={isLandscape ? 'text-2xl' : 'text-4xl'}>🎮</span>
      </div>
      <div className={isLandscape ? 'p-1.5' : 'p-3'}>
        <h3 className={`font-medium text-white truncate ${isLandscape ? 'text-xs' : ''}`}>{game.name}</h3>
        {!isLandscape && <span className="text-xs text-gray-500">{game.category}</span>}
      </div>
    </button>
  )
}
