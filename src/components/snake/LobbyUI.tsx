// 游戏大厅UI - 皮肤选择和昵称输入

import { useState } from 'react'
import type { SkinConfig } from '../../game/games/SnakeGame/config/skins'
import { SKINS } from '../../game/games/SnakeGame/config/skins'

interface Props {
  onStart: (config: { skinId: string; nickname: string }) => void
  highScore?: number
}

export default function LobbyUI({ onStart, highScore = 0 }: Props) {
  const [skinIndex, setSkinIndex] = useState(0)
  const [nickname, setNickname] = useState('')

  const currentSkin = SKINS[skinIndex]

  const prevSkin = () => {
    setSkinIndex((i) => (i - 1 + SKINS.length) % SKINS.length)
  }

  const nextSkin = () => {
    setSkinIndex((i) => (i + 1) % SKINS.length)
  }

  const handleStart = () => {
    onStart({
      skinId: currentSkin.id,
      nickname: nickname.trim() || 'Player'
    })
  }

  return (
    <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-20">
      <div className="bg-gray-900/95 border border-purple-500/50 rounded-2xl p-6 text-center shadow-[0_0_40px_rgba(191,0,255,0.3)] w-80">
        <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 mb-4">
          🐍 贪吃蛇大作战
        </h1>

        {/* 皮肤选择 */}
        <div className="mb-4">
          <p className="text-gray-400 text-sm mb-2">选择皮肤</p>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={prevSkin}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
            >
              ←
            </button>

            {/* 皮肤预览 */}
            <div className="w-24 h-24 relative">
              <SkinPreview skin={currentSkin} />
            </div>

            <button
              onClick={nextSkin}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
            >
              →
            </button>
          </div>
          <p className="text-white text-sm mt-2">{currentSkin.name}</p>
        </div>

        {/* 皮肤指示器 */}
        <div className="flex justify-center gap-1 mb-4">
          {SKINS.map((_, i) => (
            <button
              key={i}
              onClick={() => setSkinIndex(i)}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === skinIndex ? 'bg-cyan-400' : 'bg-white/30'
              }`}
            />
          ))}
        </div>

        {/* 昵称输入 */}
        <div className="mb-4">
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value.slice(0, 12))}
            placeholder="输入昵称"
            className="w-full px-4 py-2 bg-gray-800 border border-purple-500/50 rounded-lg text-white text-center placeholder-gray-500 focus:outline-none focus:border-cyan-400"
            maxLength={12}
          />
        </div>

        {/* 最高分 */}
        {highScore > 0 && (
          <p className="text-gray-500 text-sm mb-4">最高分: {highScore}</p>
        )}

        {/* 开始按钮 */}
        <button
          onClick={handleStart}
          className="w-full px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-xl text-white font-bold text-lg shadow-[0_0_20px_rgba(0,245,255,0.5)] hover:scale-105 transition-transform active:scale-95"
        >
          开始游戏
        </button>
      </div>
    </div>
  )
}

// 皮肤预览组件
function SkinPreview({ skin }: { skin: SkinConfig }) {
  const segments = [
    { x: 48, y: 48, r: 12, isHead: true },
    { x: 36, y: 48, r: 10 },
    { x: 24, y: 48, r: 9 },
    { x: 14, y: 50, r: 8 },
    { x: 6, y: 54, r: 7 },
  ]

  return (
    <svg viewBox="0 0 96 96" className="w-full h-full">
      {segments.map((seg, i) => {
        const color = i === 0 ? skin.headColor : skin.bodyColors[Math.min(i - 1, skin.bodyColors.length - 1)]
        const hexColor = `#${color.toString(16).padStart(6, '0')}`
        return (
          <circle
            key={i}
            cx={seg.x}
            cy={seg.y}
            r={seg.r}
            fill={hexColor}
            opacity={1 - i * 0.1}
            stroke={seg.isHead ? '#ffffff' : 'none'}
            strokeWidth={seg.isHead ? 2 : 0}
          />
        )
      })}
    </svg>
  )
}
