// 游戏结算弹窗

import type { GameResult } from '../../game/games/SnakeGame/core/types'

interface Props {
  result: GameResult
  onRestart: () => void
  onBackToLobby: () => void
}

export default function ResultModal({ result, onRestart, onBackToLobby }: Props) {
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-30">
      <div className="bg-gray-900/95 border border-red-500/50 rounded-2xl p-6 text-center shadow-[0_0_40px_rgba(255,0,68,0.3)] w-80 animate-fade-in">
        {/* 标题 */}
        <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-500 mb-6">
          游戏结束
        </h2>

        {/* 数据卡片 */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <StatCard icon="📏" label="最终长度" value={result.length} />
          <StatCard icon="⚔️" label="击杀数" value={result.kills} />
          <StatCard icon="⏱️" label="存活时间" value={formatTime(result.survivalTime)} />
          <StatCard icon="🏆" label="最佳排名" value={`#${result.bestRank}`} />
        </div>

        {/* 操作按钮 */}
        <div className="space-y-3">
          <button
            onClick={onRestart}
            className="w-full px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-xl text-white font-bold shadow-[0_0_20px_rgba(0,245,255,0.5)] hover:scale-105 transition-transform active:scale-95"
          >
            再来一局
          </button>

          <button
            onClick={onBackToLobby}
            className="w-full px-6 py-2 bg-gray-700/50 border border-gray-600 rounded-xl text-gray-300 hover:bg-gray-700 transition-colors"
          >
            返回大厅
          </button>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: string; label: string; value: string | number }) {
  return (
    <div className="bg-black/30 rounded-lg p-3">
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-white font-bold text-lg">{value}</div>
      <div className="text-gray-500 text-xs">{label}</div>
    </div>
  )
}
