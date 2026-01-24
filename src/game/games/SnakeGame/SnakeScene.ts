import Phaser from 'phaser'
import { GameWorld } from './core/GameWorld'
import { AIController } from './ai/AIController'
import { SnakeEntity } from './core/SnakeEntity'
import type { Food, GameConfig, GameResult, LeaderboardEntry } from './core/types'
import { WORLD_WIDTH, WORLD_HEIGHT, GRID_SIZE } from './core/types'
import type { SkinConfig } from './config/skins'
import { getSkinById } from './config/skins'

// 渲染用的蛇段
interface SnakeGraphics {
  snakeId: string
  segments: Phaser.GameObjects.Sprite[]
  nameText?: Phaser.GameObjects.Text
}

// 渲染用的食物
interface FoodGraphics {
  foodId: string
  graphics: Phaser.GameObjects.GameObject
}

export interface BattleCallbacks {
  onLeaderboardUpdate?: (data: LeaderboardEntry[]) => void
  onStatsUpdate?: (stats: { length: number; kills: number; canBoost: boolean }) => void
  onGameOver?: (result: GameResult) => void
  onKill?: (victimName: string) => void
}

type SceneInitData = {
  config?: GameConfig
  callbacks?: BattleCallbacks
}

export class SnakeScene extends Phaser.Scene {
  private world: GameWorld = new GameWorld()
  private aiController: AIController | null = null

  // 渲染对象
  private snakeGraphicsMap: Map<string, SnakeGraphics> = new Map()
  private foodGraphicsMap: Map<string, FoodGraphics> = new Map()
  private segmentPool: Phaser.GameObjects.Sprite[] = []

  private gridGraphics?: Phaser.GameObjects.Graphics
  private magnetGraphics?: Phaser.GameObjects.Graphics
  private minimapBg?: Phaser.GameObjects.Graphics
  private minimapOverlay?: Phaser.GameObjects.Graphics
  private minimapDots: Map<string, Phaser.GameObjects.Arc> = new Map()
  private minimapLastDrawAtMs: number = 0

  private isPlaying: boolean = false
  private config: GameConfig | null = null
  private callbacks: BattleCallbacks = {}

  constructor() {
    super('SnakeScene')
  }

  init(data: SceneInitData) {
    this.config = data.config || null
    this.callbacks = data.callbacks || {}
  }

  create() {
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT)
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT)

    this.generateFoodTextures()

    // 创建静态渐变背景
    this.createBackground()

    this.gridGraphics = this.add.graphics()
    this.magnetGraphics = this.add.graphics()
    this.magnetGraphics.setDepth(1)
    this.drawGrid()
    this.drawBorder()
    this.createMinimap()

    // 监听 resize 事件
    this.scale.on('resize', this.handleResize, this)
    this.handleResize(this.scale.gameSize)
  }

  // 计算小地图位置（根据屏幕方向动态调整）
  private getMinimapPosition(viewportWidth: number, viewportHeight: number) {
    const mapWidth = 120
    const mapHeight = 90
    const padding = 10
    const bottomOffset = 80

    // 横屏：放在左下角（避开右侧加速按钮）
    // 竖屏：放在右下角（加速按钮在左侧）
    const isLandscape = viewportWidth > viewportHeight

    return {
      x: isLandscape ? padding : viewportWidth - mapWidth - padding,
      y: viewportHeight - mapHeight - padding - bottomOffset,
      width: mapWidth,
      height: mapHeight
    }
  }

  private handleResize(gameSize: Phaser.Structs.Size) {
    const width = gameSize.width
    const height = gameSize.height

    this.cameras.resize(width, height)

    // 重新绘制小地图
    if (this.minimapBg) {
      this.minimapBg.clear()
      const pos = this.getMinimapPosition(width, height)
      this.minimapBg.fillStyle(0x000000, 0.6)
      this.minimapBg.fillRect(pos.x, pos.y, pos.width, pos.height)
      this.minimapBg.lineStyle(1, 0x00f5ff, 0.5)
      this.minimapBg.strokeRect(pos.x, pos.y, pos.width, pos.height)
    }

    if (this.isPlaying) {
      const playerPos = this.world.getPlayerPosition()
      if (playerPos) this.cameras.main.centerOn(playerPos.x, playerPos.y)
    }
  }

  private generateFoodTextures() {
    const size = 24
    const r = size / 2

    // 蛇段圆形纹理（用于Sprite化）
    const segmentG = this.make.graphics({ x: 0, y: 0 })
    segmentG.fillStyle(0xffffff)
    segmentG.fillCircle(r, r, r)
    segmentG.generateTexture('snake_segment', size, size)
    segmentG.destroy()

    // speed - 闪电
    const speedG = this.make.graphics({ x: 0, y: 0 })
    speedG.fillStyle(0x00f5ff)
    speedG.fillCircle(r, r, 9)
    speedG.lineStyle(2, 0xffffff, 0.8)
    speedG.strokeCircle(r, r, 9)
    speedG.fillStyle(0xffffff)
    speedG.fillTriangle(r + 2, r - 5, r - 3, r + 1, r + 1, r + 1)
    speedG.fillTriangle(r - 2, r + 5, r + 3, r - 1, r - 1, r - 1)
    speedG.generateTexture('food_speed', size, size)
    speedG.destroy()

    // slow - 沙漏
    const slowG = this.make.graphics({ x: 0, y: 0 })
    slowG.fillStyle(0xbf00ff)
    slowG.fillCircle(r, r, 9)
    slowG.lineStyle(2, 0xffffff, 0.8)
    slowG.strokeCircle(r, r, 9)
    slowG.fillStyle(0xffffff)
    slowG.fillTriangle(r - 4, r - 4, r + 4, r - 4, r, r)
    slowG.fillTriangle(r - 4, r + 4, r + 4, r + 4, r, r)
    slowG.generateTexture('food_slow', size, size)
    slowG.destroy()

    // double - 2x
    const doubleG = this.make.graphics({ x: 0, y: 0 })
    doubleG.fillStyle(0xff00aa)
    doubleG.fillCircle(r, r, 9)
    doubleG.lineStyle(2, 0xffffff, 0.8)
    doubleG.strokeCircle(r, r, 9)
    doubleG.generateTexture('food_double', size, size)
    doubleG.destroy()

    // magnet - U形磁铁
    const magnetG = this.make.graphics({ x: 0, y: 0 })
    magnetG.fillStyle(0x00aaff)
    magnetG.fillCircle(r, r, 9)
    magnetG.lineStyle(2, 0xffffff, 0.8)
    magnetG.strokeCircle(r, r, 9)
    magnetG.lineStyle(3, 0xffffff, 1)
    magnetG.beginPath()
    magnetG.arc(r, r + 1, 4, Math.PI, 0, true)
    magnetG.strokePath()
    magnetG.lineBetween(r - 4, r + 1, r - 4, r - 3)
    magnetG.lineBetween(r + 4, r + 1, r + 4, r - 3)
    magnetG.generateTexture('food_magnet', size, size)
    magnetG.destroy()

    // drop - 死亡掉落
    const dropG = this.make.graphics({ x: 0, y: 0 })
    dropG.fillStyle(0xffaa00)
    dropG.fillCircle(r, r, 6)
    dropG.generateTexture('food_drop', size, size)
    dropG.destroy()
  }

  private createMinimap() {
    const viewportWidth = this.cameras.main.width
    const viewportHeight = this.cameras.main.height
    const pos = this.getMinimapPosition(viewportWidth, viewportHeight)

    // 小地图根据屏幕方向动态定位
    this.minimapBg = this.add.graphics()
    this.minimapBg.setScrollFactor(0)
    this.minimapBg.setDepth(100)
    this.minimapBg.fillStyle(0x000000, 0.6)
    this.minimapBg.fillRect(pos.x, pos.y, pos.width, pos.height)
    this.minimapBg.lineStyle(1, 0x00f5ff, 0.5)
    this.minimapBg.strokeRect(pos.x, pos.y, pos.width, pos.height)

    this.minimapOverlay = this.add.graphics()
    this.minimapOverlay.setScrollFactor(0)
    this.minimapOverlay.setDepth(101)
  }

  private createBackground() {
    // 创建静态渐变背景（深蓝到黑色）
    const bg = this.add.graphics()
    bg.fillGradientStyle(0x0a0a1e, 0x0a0a1e, 0x000000, 0x000000, 1)
    bg.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT)
    bg.setDepth(-2) // 确保在最底层
  }

  private drawGrid() {
    if (!this.gridGraphics) return
    this.gridGraphics.clear()
    this.gridGraphics.lineStyle(1, 0x1a1a2e, 0.5)

    for (let x = 0; x <= WORLD_WIDTH; x += GRID_SIZE) {
      this.gridGraphics.moveTo(x, 0)
      this.gridGraphics.lineTo(x, WORLD_HEIGHT)
    }
    for (let y = 0; y <= WORLD_HEIGHT; y += GRID_SIZE) {
      this.gridGraphics.moveTo(0, y)
      this.gridGraphics.lineTo(WORLD_WIDTH, y)
    }
    this.gridGraphics.strokePath()
  }

  private drawBorder() {
    const graphics = this.add.graphics()
    graphics.lineStyle(4, 0xff0044, 0.8)
    graphics.strokeRect(2, 2, WORLD_WIDTH - 4, WORLD_HEIGHT - 4)
  }

  // 开始游戏
  startGame(config?: GameConfig) {
    const gameConfig = config || this.config || {
      skinId: 'cyan',
      nickname: 'Player',
      aiCount: 15,
      difficulty: 'medium' as const
    }

    // 清理旧渲染对象
    this.clearAllGraphics()

    // 初始化游戏世界
    this.world.init(gameConfig, {
      onLeaderboardUpdate: this.callbacks.onLeaderboardUpdate,
      onStatsUpdate: this.callbacks.onStatsUpdate,
      onGameOver: (result) => {
        this.isPlaying = false
        this.callbacks.onGameOver?.(result)
      },
      onKill: this.callbacks.onKill
    })

    // 初始化AI控制器
    this.aiController = new AIController(this.world, gameConfig.difficulty)

    this.isPlaying = true

    // 相机跟随玩家
    this.cameras.main.setZoom(1)
    const playerPos = this.world.getPlayerPosition()
    if (playerPos) {
      this.cameras.main.centerOn(playerPos.x, playerPos.y)
    }
  }

  private clearAllGraphics() {
    // 清理蛇渲染
    for (const sg of this.snakeGraphicsMap.values()) {
      sg.segments.forEach(s => s.destroy())
      sg.nameText?.destroy()
    }
    this.snakeGraphicsMap.clear()

    // 清理食物渲染
    for (const fg of this.foodGraphicsMap.values()) {
      fg.graphics.destroy()
    }
    this.foodGraphicsMap.clear()

    // 清理小地图点
    for (const dot of this.minimapDots.values()) {
      dot.destroy()
    }
    this.minimapDots.clear()
    this.magnetGraphics?.clear()
  }

  update(_time: number, delta: number) {
    if (!this.isPlaying) return

    // 更新游戏逻辑
    this.world.update(delta)
    this.aiController?.update(delta)

    // 渲染所有蛇
    this.renderSnakes()

    // 渲染所有食物
    this.renderFoods()

    // 渲染磁铁特效
    this.renderMagnetEffects()

    // 更新相机跟随（智能偏移避免UI遮挡）
    const playerPos = this.world.getPlayerPosition()
    if (playerPos) {
      this.updateCameraFollow(playerPos)
    }

    // 更新小地图
    this.updateMinimap()
  }

  private updateCameraFollow(playerPos: { x: number; y: number }) {
    const viewport = { w: this.cameras.main.width, h: this.cameras.main.height }
    const isLandscape = viewport.w > viewport.h

    // UI安全边距（根据屏幕方向动态调整）
    const safeMargin = {
      left: isLandscape ? 150 : 150,   // 横屏：小地图在左侧；竖屏：排行榜在左侧
      top: 80,     // 暂停按钮高度
      right: isLandscape ? 80 : 140,   // 横屏：加速按钮在右侧；竖屏：小地图+加速按钮在右侧
      bottom: 200  // 摇杆区域
    }

    // 计算蛇头在屏幕上的相对位置
    const screenX = playerPos.x - this.cameras.main.scrollX
    const screenY = playerPos.y - this.cameras.main.scrollY

    // 智能偏移
    let offsetX = 0
    let offsetY = 0

    if (screenX < safeMargin.left) offsetX = 30
    if (screenX > viewport.w - safeMargin.right) offsetX = -30
    if (screenY < safeMargin.top) offsetY = 30
    if (screenY > viewport.h - safeMargin.bottom) offsetY = -30

    this.cameras.main.centerOn(playerPos.x + offsetX, playerPos.y + offsetY)
  }

  private renderMagnetEffects() {
    if (!this.magnetGraphics) return
    this.magnetGraphics.clear()

    const aliveSnakes = this.world.getAliveSnakes()
    const PULL_RADIUS = 260

    for (const snake of aliveSnakes) {
      if (!snake.hasMagnet) continue

      const head = snake.head

      // 脉冲效果：基于时间的动态透明度和半径
      const pulsePhase = (this.time.now / 800) % 1
      const pulseAlpha = 0.15 + Math.sin(pulsePhase * Math.PI * 2) * 0.1

      // 外圈光环（脉冲效果）
      this.magnetGraphics.lineStyle(4, 0x00f5ff, pulseAlpha)
      this.magnetGraphics.strokeCircle(head.x, head.y, PULL_RADIUS)

      // 中圈光环
      this.magnetGraphics.lineStyle(3, 0x00f5ff, 0.2)
      this.magnetGraphics.strokeCircle(head.x, head.y, PULL_RADIUS * 0.7)

      // 内圈光环（更明显）
      this.magnetGraphics.lineStyle(2, 0x00f5ff, 0.3)
      this.magnetGraphics.strokeCircle(head.x, head.y, PULL_RADIUS * 0.4)

      // 蛇头周围的光晕效果
      this.magnetGraphics.fillStyle(0x00f5ff, 0.15)
      this.magnetGraphics.fillCircle(head.x, head.y, 25)
    }
  }

  private renderSnakes() {
    const aliveSnakes = this.world.getAliveSnakes()
    const aliveIds = new Set(aliveSnakes.map(s => s.state.id))

    // 移除已死亡蛇的渲染（回收到对象池）
    for (const [id, sg] of this.snakeGraphicsMap) {
      if (!aliveIds.has(id)) {
        sg.segments.forEach(s => {
          s.setVisible(false)
          this.segmentPool.push(s)
        })
        sg.nameText?.destroy()
        this.snakeGraphicsMap.delete(id)
      }
    }

    // 渲染存活的蛇
    for (const snake of aliveSnakes) {
      this.renderSnake(snake)
    }
  }

  private renderSnake(snake: SnakeEntity) {
    const state = snake.state
    const skin = getSkinById(state.skinId)
    let sg = this.snakeGraphicsMap.get(state.id)

    if (!sg) {
      sg = { snakeId: state.id, segments: [] }
      this.snakeGraphicsMap.set(state.id, sg)
    }

    // 同步段数（使用对象池）
    while (sg.segments.length < state.segments.length) {
      const sprite = this.segmentPool.pop() || this.add.sprite(0, 0, 'snake_segment')
      sprite.setVisible(true)
      sg.segments.push(sprite)
    }
    while (sg.segments.length > state.segments.length) {
      const sprite = sg.segments.pop()
      if (sprite) {
        sprite.setVisible(false)
        this.segmentPool.push(sprite)
      }
    }

    // 优化：每蛇每帧计算一次无敌闪烁alpha
    const invincibleAlpha = snake.isInvincible ? 0.5 + Math.sin(this.time.now / 100) * 0.3 : 1

    // 更新每个段的位置和样式
    for (let i = 0; i < state.segments.length; i++) {
      const seg = state.segments[i]
      const sprite = sg.segments[i]
      const isHead = i === 0

      sprite.setPosition(seg.x, seg.y)

      const radius = isHead ? 12 : 10 - Math.min(i * 0.3, 4)
      sprite.setScale(radius / 12) // 纹理半径是12

      const color = this.getSegmentColor(skin, i)
      sprite.setTint(color)

      const baseAlpha = Math.max(0.6, 1 - i * 0.02)
      sprite.setAlpha(baseAlpha * invincibleAlpha)

      if (isHead) {
        // 蛇头脉冲效果
        const pulseScale = 1 + Math.sin(this.time.now / 200) * 0.1
        sprite.setScale((radius / 12) * pulseScale)

        // 加速时发光（更明显的黄色）
        if (state.isBoosting) {
          sprite.setTint(0xffff00)
          sprite.setAlpha(1) // 加速时完全不透明
        } else {
          // 蛇头稍微亮一些
          sprite.setAlpha(1)
        }
      }
    }

    // 渲染名字（在蛇头上方）
    if (!sg.nameText) {
      sg.nameText = this.add.text(0, 0, state.name, {
        fontSize: '12px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2
      }).setOrigin(0.5)
    }
    const head = state.segments[0]
    sg.nameText.setPosition(head.x, head.y - 25)
    sg.nameText.setText(state.name)
  }

  private getSegmentColor(skin: SkinConfig, index: number): number {
    if (index === 0) return skin.headColor
    const colors = skin.bodyColors
    const t = Math.min(index / 20, 1)
    const colorIndex = Math.floor(t * (colors.length - 1))
    return colors[Math.min(colorIndex, colors.length - 1)]
  }

  private renderFoods() {
    const foods = this.world.foods
    const foodIds = new Set(foods.map(f => f.id))

    // 移除已消失食物的渲染
    for (const [id, fg] of this.foodGraphicsMap) {
      if (!foodIds.has(id)) {
        fg.graphics.destroy()
        this.foodGraphicsMap.delete(id)
      }
    }

    // 渲染食物（新建或更新位置）
    for (const food of foods) {
      const fg = this.foodGraphicsMap.get(food.id)
      if (!fg) {
        this.createFoodGraphics(food)
      } else {
        // 更新被吸引食物的位置
        const gfx = fg.graphics as unknown as { x: number; y: number; setPosition: (x: number, y: number) => void }
        if (gfx.x !== food.x || gfx.y !== food.y) {
          gfx.setPosition(food.x, food.y)
        }
      }
    }
  }

  private createFoodGraphics(food: Food) {
    let graphics: Phaser.GameObjects.GameObject

    const textureKey = `food_${food.type}`
    if (this.textures.exists(textureKey)) {
      const img = this.add.image(food.x, food.y, textureKey)
      if (food.type === 'double') {
        const txt = this.add.text(food.x, food.y, '2x', { fontSize: '9px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5)
        const container = this.add.container(food.x, food.y, [img.setPosition(0, 0), txt.setPosition(0, 0)])
        graphics = container
      } else {
        graphics = img
      }
      // 脉冲动画
      this.tweens.add({
        targets: graphics,
        scale: { from: 0.85, to: 1.2 },
        alpha: { from: 0.75, to: 1 },
        duration: 550,
        yoyo: true,
        repeat: -1
      })
    } else {
      const colors: Record<string, number> = {
        pellet: 0x00ff88,
        big: 0xffff00,
        drop: 0xffaa00
      }
      const circle = this.add.circle(food.x, food.y, food.radius, colors[food.type] || 0x00ff88)
      if (food.type === 'big') {
        this.tweens.add({
          targets: circle,
          scale: { from: 0.85, to: 1.2 },
          duration: 550,
          yoyo: true,
          repeat: -1
        })
      }
      graphics = circle
    }

    this.foodGraphicsMap.set(food.id, { foodId: food.id, graphics })
  }

  private updateMinimap() {
    if (!this.minimapOverlay || !this.minimapBg) return

    const viewportWidth = this.cameras.main.width
    const viewportHeight = this.cameras.main.height
    const pos = this.getMinimapPosition(viewportWidth, viewportHeight)
    const mapX0 = pos.x
    const mapY0 = pos.y
    const mapWidth = pos.width
    const mapHeight = pos.height
    const now = this.time.now

    // 动态透明度：根据玩家位置调整
    const playerPos = this.world.getPlayerPosition()
    if (playerPos) {
      const screenX = (playerPos.x - this.cameras.main.scrollX) * this.cameras.main.zoom
      const screenY = (playerPos.y - this.cameras.main.scrollY) * this.cameras.main.zoom

      // 判断玩家是否接近小地图区域（根据小地图位置动态判断）
      const isLandscape = viewportWidth > viewportHeight
      const isNearMinimap = isLandscape
        ? screenX < 150 && screenY > viewportHeight - 200
        : screenX > viewportWidth - 150 && screenY > viewportHeight - 200
      const targetAlpha = isNearMinimap ? 0.9 : 0.6

      this.minimapBg.setAlpha(targetAlpha)
      this.minimapOverlay.setAlpha(targetAlpha)
    }

    // 降频绘制
    if (now - this.minimapLastDrawAtMs < 100) return
    this.minimapLastDrawAtMs = now

    this.minimapOverlay.clear()

    // 绘制视野框
    const view = this.cameras.main.worldView
    const viewX = mapX0 + (view.x / WORLD_WIDTH) * mapWidth
    const viewY = mapY0 + (view.y / WORLD_HEIGHT) * mapHeight
    const viewW = (view.width / WORLD_WIDTH) * mapWidth
    const viewH = (view.height / WORLD_HEIGHT) * mapHeight
    this.minimapOverlay.lineStyle(1, 0xffffff, 0.45)
    this.minimapOverlay.strokeRect(viewX, viewY, viewW, viewH)

    // 绘制所有蛇的位置
    for (const snake of this.world.getAliveSnakes()) {
      const head = snake.head
      const fx = mapX0 + (head.x / WORLD_WIDTH) * mapWidth
      const fy = mapY0 + (head.y / WORLD_HEIGHT) * mapHeight
      const color = snake.state.isPlayer ? 0x00f5ff : 0xff6666
      this.minimapOverlay.fillStyle(color, 1)
      this.minimapOverlay.fillCircle(fx, fy, snake.state.isPlayer ? 3 : 2)
    }
  }

  // 玩家输入
  setInput(input: { angle?: number; vector?: { x: number; y: number } }) {
    if (input.angle !== undefined) {
      this.world.setPlayerDirection(input.angle)
    }
  }

  setBoost(boosting: boolean) {
    this.world.setPlayerBoost(boosting)
  }

  // 暂停/恢复
  pauseGame() {
    this.isPlaying = false
    // 暂停场景的时间系统和 Tween
    this.scene.pause()
  }

  resumeGame() {
    this.isPlaying = true
    // 恢复场景
    this.scene.resume()
  }
}
