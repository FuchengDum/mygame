// 实时排行榜组件

import type { LeaderboardEntry } from '../../game/games/SnakeGame/core/types'

interface Props {
  data: LeaderboardEntry[]
  playerId?: string
  isLandscape?: boolean
}

export default function Leaderboard({ data, playerId, isLandscape = false }: Props) {
  // 竖屏只显示前5，横屏显示前10
  const displayCount = isLandscape ? 10 : 5
  const displayData = data.slice(0, displayCount)

  // 找到玩家排名
  const playerEntry = data.find(e => e.id === playerId)
  const playerRank = playerEntry?.rank || 0

  // 如果玩家不在显示列表中，添加到底部
  const showPlayerSeparately = playerEntry && playerRank > displayCount

  return (
    <div className={`
      absolute z-10 bg-black/50 backdrop-blur-sm rounded-lg p-2
      left-4 top-24 w-28
    `}>
      <div className="text-xs text-gray-400 mb-1 text-center border-b border-white/10 pb-1">
        排行榜
      </div>

      <div className="space-y-0.5">
        {displayData.map((entry) => (
          <LeaderboardRow
            key={entry.id}
            entry={entry}
            isPlayer={entry.id === playerId}
          />
        ))}

        {showPlayerSeparately && (
          <>
            <div className="text-center text-gray-500 text-xs">···</div>
            <LeaderboardRow
              entry={playerEntry}
              isPlayer={true}
            />
          </>
        )}
      </div>
    </div>
  )
}

function LeaderboardRow({
  entry,
  isPlayer,
}: {
  entry: LeaderboardEntry
  isPlayer: boolean
}) {
  return (
    <div className={`
      flex items-center text-xs gap-1 px-1 py-0.5 rounded
      ${isPlayer ? 'bg-cyan-500/20 text-cyan-400 font-bold' : 'text-gray-300'}
    `}>
      <span className="w-4 text-right">{entry.rank}</span>
      <span className="flex-1 truncate max-w-12">
        {entry.name}
      </span>
      <span className="w-8 text-right">{entry.length}</span>
    </div>
  )
}
