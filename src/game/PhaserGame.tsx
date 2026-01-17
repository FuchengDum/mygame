import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { createGameConfig } from './config'

interface Props {
  scene: typeof Phaser.Scene | Phaser.Types.Scenes.SceneType[]
  onReady?: (game: Phaser.Game) => void
}

export default function PhaserGame({ scene, onReady }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return

    const config = createGameConfig(containerRef.current, scene)
    const game = new Phaser.Game(config)
    gameRef.current = game

    // 等待场景创建完成后再调用 onReady
    game.events.once(Phaser.Core.Events.READY, () => {
      setTimeout(() => onReady?.(game), 100)
    })

    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      const resizeObserver = new ResizeObserver(() => {
        if (gameRef.current && containerRef.current) {
          const w = containerRef.current.clientWidth
          const h = containerRef.current.clientHeight
          if (w > 0 && h > 0) {
            gameRef.current.scale.resize(w, h)
            gameRef.current.scale.refresh()
          }
        }
      })
      resizeObserver.observe(containerRef.current)

      return () => {
        resizeObserver.disconnect()
        gameRef.current?.destroy(true)
        gameRef.current = null
      }
    }

    return () => {
      gameRef.current?.destroy(true)
      gameRef.current = null
    }
  }, [scene, onReady])

  return <div ref={containerRef} className="w-full h-full" />
}
