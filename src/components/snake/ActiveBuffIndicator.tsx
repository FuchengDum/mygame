// 激活道具状态指示器 - 显示当前激活的增益效果

import { memo } from 'react'
import type { ActiveBuff } from '../../game/games/SnakeGame/core/types'

interface Props {
  buffs: ActiveBuff[]
}

const BUFF_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  speed: { icon: '⚡', color: 'bg-yellow-500', label: '加速' },
  magnet: { icon: '🧲', color: 'bg-cyan-500', label: '磁铁' },
  shield: { icon: '🛡️', color: 'bg-blue-500', label: '护盾' },
  double: { icon: '2x', color: 'bg-purple-500', label: '双倍' }
}

export default memo(function ActiveBuffIndicator({ buffs }: Props) {
  if (buffs.length === 0) return null

  return (
    <div className="absolute left-4 top-44 flex flex-col gap-1.5 z-10">
      {buffs.map(buff => {
        const config = BUFF_CONFIG[buff.type]
        if (!config) return null

        const percent = Math.max(0, Math.min(100, (buff.remainingMs / buff.totalMs) * 100))

        return (
          <div
            key={buff.type}
            className="flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1.5 border border-white/10"
          >
            <span className="text-base w-5 text-center">{config.icon}</span>
            <div className="w-14 h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full ${config.color} transition-all duration-100`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
})
