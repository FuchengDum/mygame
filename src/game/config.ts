import Phaser from 'phaser'

export const createGameConfig = (
  parent: HTMLElement,
  scene: typeof Phaser.Scene | Phaser.Types.Scenes.SceneType[],
  width?: number,
  height?: number
): Phaser.Types.Core.GameConfig => {
  const resolvedWidth = Math.max(1, width || parent.clientWidth || 800)
  const resolvedHeight = Math.max(1, height || parent.clientHeight || 600)

  return {
    type: Phaser.AUTO,
    parent,
    width: resolvedWidth,
    height: resolvedHeight,
    backgroundColor: '#1a1a2e',
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: resolvedWidth,
      height: resolvedHeight,
    },
    physics: {
      default: 'arcade',
      arcade: { gravity: { x: 0, y: 300 }, debug: false },
    },
    scene,
  }
}
