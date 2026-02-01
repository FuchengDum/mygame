// 进化通知组件 - 首次进化时显示

import { useEffect, useState, useRef } from 'react'

interface Props {
  stage: number
  onDismiss: () => void
}

const BUFF_DESCRIPTIONS: Record<number, string> = {
  2: '转向速度 +5%',
  3: '加速效率 +10%',
  4: '视野范围 +10%',
  5: '基础速度 +5%'
}

const STAGE_COLORS: Record<number, string> = {
  2: 'from-cyan-500 to-blue-500',
  3: 'from-green-500 to-emerald-500',
  4: 'from-yellow-500 to-orange-500',
  5: 'from-purple-500 to-pink-500'
}

export default function EvolutionNotification({ stage, onDismiss }: Props) {
  const [isVisible, setIsVisible] = useState(true)
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(() => onDismissRef.current(), 300) // 等待淡出动画
    }, 2500)
    return () => clearTimeout(timer)
  }, []) // 空依赖数组，只在挂载时执行一次

  const colorClass = STAGE_COLORS[stage] || 'from-purple-600 to-blue-500'
  const buffDesc = BUFF_DESCRIPTIONS[stage] || ''

  return (
    <div
      className={`
        fixed top-1/4 left-1/2 -translate-x-1/2 z-50
        transition-all duration-300 pointer-events-none
        ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
      `}
    >
      <div className={`bg-gradient-to-r ${colorClass} rounded-xl p-4 shadow-2xl border border-white/20`}>
        <div className="text-center">
          <div className="text-2xl font-bold text-white mb-1 drop-shadow-lg">
            Stage {stage}
          </div>
          {buffDesc && (
            <div className="text-sm text-white/90 font-medium">
              {buffDesc}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
