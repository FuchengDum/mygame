import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import type { Game } from '../types/game'

export default function HomePage() {
  const navigate = useNavigate()
  const { games, setGames, searchQuery, setSearchQuery, category, setCategory } = useGameStore()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/data/games.json')
      .then((res) => res.json())
      .then((data) => {
        setGames(data)
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
      {/* 搜索栏 */}
      <div className="p-4 pt-safe">
        <input
          type="text"
          placeholder="搜索游戏..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-dark-card neon-border text-white placeholder-gray-500 outline-none"
        />
      </div>

      {/* 分类筛选 */}
      <div className="px-4 pb-2 flex gap-2 overflow-x-auto">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition-all ${
              category === cat
                ? 'btn-neon text-white'
                : 'bg-dark-card text-gray-400'
            }`}
          >
            {cat === 'all' ? '全部' : cat}
          </button>
        ))}
      </div>

      {/* 游戏列表 */}
      <div className="flex-1 overflow-y-auto p-4 pt-2">
        {loading ? (
          <div className="text-center text-gray-500 mt-10">加载中...</div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {filtered.map((game) => (
              <GameCard key={game.id} game={game} onClick={() => navigate(`/game/${game.id}`)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function GameCard({ game, onClick }: { game: Game; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="bg-dark-card rounded-xl overflow-hidden neon-border active:neon-glow transition-all"
    >
      <div className="aspect-[4/3] bg-dark-border flex items-center justify-center">
        <span className="text-4xl">🎮</span>
      </div>
      <div className="p-3">
        <h3 className="font-medium text-white truncate">{game.name}</h3>
        <span className="text-xs text-gray-500">{game.category}</span>
      </div>
    </div>
  )
}
