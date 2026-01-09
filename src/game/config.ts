import Phaser from 'phaser'

export const createGameConfig = (
  parent: HTMLElement,
  scene: typeof Phaser.Scene | Phaser.Types.Scenes.SceneType[],
  width = 800,
  height = 600
): Phaser.Types.Core.GameConfig => ({
  type: Phaser.AUTO,
  parent,
  width,
  height,
  backgroundColor: '#1a1a2e',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 300 }, debug: false },
  },
  scene,
})
