import Phaser from 'phaser'

// 世界地图常量
const WORLD_WIDTH = 4000
const WORLD_HEIGHT = 3000
const GRID_SIZE = 20

type FoodType = 'pellet' | 'big' | 'speed' | 'slow' | 'double' | 'magnet' | 'poison'

interface FoodDefinition {
  type: FoodType
  radius: number
  color: number
  strokeColor?: number
  baseScore: number
  growth: number
  spawnWeight: number
  pulse?: boolean
  effect?: 'speed' | 'slow' | 'double' | 'magnet'
  effectDurationMs?: number
}

const FOOD_DEFINITIONS: Record<FoodType, FoodDefinition> = {
  pellet: { type: 'pellet', radius: 5, color: 0x00ff88, baseScore: 5, growth: 1, spawnWeight: 80 },
  big: { type: 'big', radius: 10, color: 0xffff00, baseScore: 25, growth: 3, spawnWeight: 10, pulse: true },
  speed: { type: 'speed', radius: 9, color: 0x00f5ff, strokeColor: 0xffffff, baseScore: 12, growth: 2, spawnWeight: 4, pulse: true, effect: 'speed', effectDurationMs: 5000 },
  slow: { type: 'slow', radius: 9, color: 0xbf00ff, strokeColor: 0xffffff, baseScore: 12, growth: 2, spawnWeight: 3, pulse: true, effect: 'slow', effectDurationMs: 5000 },
  double: { type: 'double', radius: 9, color: 0xff00aa, strokeColor: 0xffffff, baseScore: 0, growth: 0, spawnWeight: 2, pulse: true, effect: 'double', effectDurationMs: 8000 },
  magnet: { type: 'magnet', radius: 9, color: 0x00aaff, strokeColor: 0xffffff, baseScore: 0, growth: 0, spawnWeight: 1, pulse: true, effect: 'magnet', effectDurationMs: 8000 },
  poison: { type: 'poison', radius: 9, color: 0xff0044, strokeColor: 0xffffff, baseScore: -20, growth: 0, spawnWeight: 2, pulse: true },
}

interface SnakeSegment {
  x: number
  y: number
  graphics: Phaser.GameObjects.Arc
}

interface Food {
  x: number
  y: number
  graphics: Phaser.GameObjects.Arc
  type: FoodType
  baseScore: number
  growth: number
}

export interface SnakeBuffs {
  speedMultiplier: number
  speedRemainingMs: number
  scoreMultiplier: number
  scoreRemainingMs: number
  magnetRemainingMs: number
}

type SnakeInitData = {
  highScore?: number
  onScore?: (score: number) => void
  onGameOver?: (score: number, highScore: number) => void
  onBuffs?: (buffs: SnakeBuffs) => void
}

export class SnakeScene extends Phaser.Scene {
  private snake: SnakeSegment[] = []
  private foods: Food[] = []
  private direction: number = 0
  private targetDirection: number = 0
  private readonly baseSpeed: number = 150
  private speedMultiplier: number = 1
  private speedBuffUntilMs: number = 0
  private scoreMultiplier: number = 1
  private scoreBuffUntilMs: number = 0
  private magnetUntilMs: number = 0
  private segmentSpacing: number = 12
  private score: number = 0
  private highScore: number = 0
  private isPlaying: boolean = false
  private scoreCallback?: (score: number) => void
  private gameOverCallback?: (score: number, highScore: number) => void
  private buffsCallback?: (buffs: SnakeBuffs) => void
  private gridGraphics?: Phaser.GameObjects.Graphics
  private minimapBg?: Phaser.GameObjects.Graphics
  private minimapOverlay?: Phaser.GameObjects.Graphics
  private minimapDot?: Phaser.GameObjects.Arc
  private minimapLastDrawAtMs: number = 0
  private mapMode: boolean = false

  // 颜色配置
  private readonly HEAD_COLOR = 0x00f5ff
  private readonly BODY_START = 0xbf00ff
  private readonly BODY_END = 0xff00aa

  constructor() {
    super('SnakeScene')
  }

  init(data: SnakeInitData) {
    this.highScore = data.highScore || 0
    this.scoreCallback = data.onScore
    this.gameOverCallback = data.onGameOver
    this.buffsCallback = data.onBuffs
  }

  create() {
    // 设置世界边界
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT)

    // 设置相机边界
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT)

    // 绘制网格背景
    this.gridGraphics = this.add.graphics()
    this.drawGrid()

    // 绘制世界边界
    this.drawBorder()

    // 创建小地图（固定在屏幕右上角）
    this.createMinimap()

    // 初始 buffs 同步
    this.emitBuffs()
  }

  private createMinimap() {
    const mapWidth = 120
    const mapHeight = 90
    const padding = 10
    const viewportWidth = this.cameras.main.width

    // 小地图背景
    this.minimapBg = this.add.graphics()
    this.minimapBg.setScrollFactor(0)
    this.minimapBg.setDepth(100)
    this.minimapBg.fillStyle(0x000000, 0.6)
    this.minimapBg.fillRect(viewportWidth - mapWidth - padding, padding, mapWidth, mapHeight)
    this.minimapBg.lineStyle(1, 0x00f5ff, 0.5)
    this.minimapBg.strokeRect(viewportWidth - mapWidth - padding, padding, mapWidth, mapHeight)

    // 小地图动态层（视野框 + 特殊食物点位）
    this.minimapOverlay = this.add.graphics()
    this.minimapOverlay.setScrollFactor(0)
    this.minimapOverlay.setDepth(101)

    // 玩家位置点
    this.minimapDot = this.add.circle(0, 0, 3, this.HEAD_COLOR)
    this.minimapDot.setScrollFactor(0)
    this.minimapDot.setDepth(102)
  }

  private updateMinimap() {
    if (!this.minimapDot || !this.minimapOverlay || this.snake.length === 0) return

    const mapWidth = 120
    const mapHeight = 90
    const padding = 10
    const viewportWidth = this.cameras.main.width
    const mapX0 = viewportWidth - mapWidth - padding
    const now = this.time.now

    const head = this.snake[0]
    const mapX = mapX0 + (head.x / WORLD_WIDTH) * mapWidth
    const mapY = padding + (head.y / WORLD_HEIGHT) * mapHeight

    this.minimapDot.setPosition(mapX, mapY)

    // 降频绘制：避免每帧都重画 minimap overlay
    if (now - this.minimapLastDrawAtMs < 80) return
    this.minimapLastDrawAtMs = now

    this.minimapOverlay.clear()

    // 绘制主相机视野框（世界坐标 -> 小地图坐标）
    const view = this.cameras.main.worldView
    const viewX = mapX0 + (view.x / WORLD_WIDTH) * mapWidth
    const viewY = padding + (view.y / WORLD_HEIGHT) * mapHeight
    const viewW = (view.width / WORLD_WIDTH) * mapWidth
    const viewH = (view.height / WORLD_HEIGHT) * mapHeight
    this.minimapOverlay.lineStyle(1, 0xffffff, 0.45)
    this.minimapOverlay.strokeRect(viewX, viewY, viewW, viewH)

    // 仅绘制“特殊食物”的点位，避免信息过载
    for (const food of this.foods) {
      if (food.type === 'pellet') continue
      const def = FOOD_DEFINITIONS[food.type]
      const fx = mapX0 + (food.x / WORLD_WIDTH) * mapWidth
      const fy = padding + (food.y / WORLD_HEIGHT) * mapHeight
      this.minimapOverlay.fillStyle(def.color, 0.9)
      this.minimapOverlay.fillCircle(fx, fy, 1.4)
    }
  }

  private drawGrid() {
    if (!this.gridGraphics) return
    this.gridGraphics.clear()
    this.gridGraphics.lineStyle(1, 0x1a1a2e, 0.5)

    // 绘制整个世界的网格
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

  startGame() {
    // 清理旧游戏
    this.snake.forEach(s => s.graphics.destroy())
    this.foods.forEach(f => f.graphics.destroy())
    this.snake = []
    this.foods = []
    this.score = 0
    this.direction = 0
    this.targetDirection = 0
    this.isPlaying = true
    this.speedMultiplier = 1
    this.speedBuffUntilMs = 0
    this.scoreMultiplier = 1
    this.scoreBuffUntilMs = 0
    this.magnetUntilMs = 0
    this.mapMode = false
    this.emitBuffs()

    // 创建初始蛇（在世界中心）
    const startX = WORLD_WIDTH / 2
    const startY = WORLD_HEIGHT / 2
    for (let i = 0; i < 5; i++) {
      this.addSegment(startX - i * this.segmentSpacing, startY)
    }

    // 相机跟随蛇头
    this.cameras.main.setZoom(1)
    this.cameras.main.startFollow(this.snake[0].graphics, true, 0.1, 0.1)

    // 生成初始食物（更多食物分布在大地图上）
    for (let i = 0; i < 120; i++) {
      this.spawnFood()
    }

    this.scoreCallback?.(0)
  }

  private addSegment(x: number, y: number) {
    const index = this.snake.length
    const isHead = index === 0
    const radius = isHead ? 12 : 10 - Math.min(index * 0.3, 4)
    const color = this.getSegmentColor(index)
    const alpha = Math.max(0.6, 1 - index * 0.02)

    const graphics = this.add.circle(x, y, radius, color, alpha)
    if (isHead) {
      graphics.setStrokeStyle(2, 0xffffff, 0.5)
    }

    this.snake.push({ x, y, graphics })
  }

  private getSegmentColor(index: number): number {
    if (index === 0) return this.HEAD_COLOR
    const t = Math.min(index / 20, 1)
    return Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(this.BODY_START),
      Phaser.Display.Color.ValueToColor(this.BODY_END),
      1, t
    ).color
  }

  private rollFoodType(): FoodType {
    const totalWeight = Object.values(FOOD_DEFINITIONS).reduce((sum, d) => sum + d.spawnWeight, 0)
    let r = Math.random() * totalWeight
    for (const def of Object.values(FOOD_DEFINITIONS)) {
      r -= def.spawnWeight
      if (r <= 0) return def.type
    }
    return 'pellet'
  }

  private spawnFood() {
    const margin = 30
    const head = this.snake[0]
    const type = this.rollFoodType()
    const def = FOOD_DEFINITIONS[type]

    let x = 0
    let y = 0
    let attempts = 0
    while (attempts < 30) {
      x = Phaser.Math.Between(margin, WORLD_WIDTH - margin)
      y = Phaser.Math.Between(margin, WORLD_HEIGHT - margin)
      attempts++

      if (!head) break
      const distToHead = Phaser.Math.Distance.Between(x, y, head.x, head.y)
      if (distToHead < 120) continue

      let tooCloseToBody = false
      for (let i = 0; i < this.snake.length; i += 6) {
        const seg = this.snake[i]
        if (Phaser.Math.Distance.Between(x, y, seg.x, seg.y) < 40) {
          tooCloseToBody = true
          break
        }
      }
      if (tooCloseToBody) continue
      break
    }

    const graphics = this.add.circle(x, y, def.radius, def.color)
    graphics.setStrokeStyle(2, def.strokeColor ?? def.color, 0.6)

    if (def.pulse) {
      this.tweens.add({
        targets: graphics,
        scale: { from: 0.85, to: 1.2 },
        alpha: { from: 0.75, to: 1 },
        duration: 550,
        yoyo: true,
        repeat: -1
      })
    }

    this.foods.push({ x, y, graphics, type, baseScore: def.baseScore, growth: def.growth })
  }

  toggleMapMode() {
    return this.setMapMode(!this.mapMode)
  }

  setMapMode(enabled: boolean) {
    this.mapMode = enabled
    const cam = this.cameras.main
    if (enabled) {
      cam.stopFollow()
      const zoom = Math.min(cam.width / WORLD_WIDTH, cam.height / WORLD_HEIGHT)
      cam.setZoom(zoom)
      cam.centerOn(WORLD_WIDTH / 2, WORLD_HEIGHT / 2)
    } else {
      cam.setZoom(1)
      if (this.snake.length > 0) {
        cam.startFollow(this.snake[0].graphics, true, 0.1, 0.1)
      }
    }
    return this.mapMode
  }

  private isMagnetActive(nowMs: number) {
    return this.magnetUntilMs > nowMs
  }

  private updateBuffs(nowMs: number) {
    let changed = false

    if (this.speedBuffUntilMs !== 0 && nowMs >= this.speedBuffUntilMs) {
      this.speedBuffUntilMs = 0
      this.speedMultiplier = 1
      changed = true
    }
    if (this.scoreBuffUntilMs !== 0 && nowMs >= this.scoreBuffUntilMs) {
      this.scoreBuffUntilMs = 0
      this.scoreMultiplier = 1
      changed = true
    }
    if (this.magnetUntilMs !== 0 && nowMs >= this.magnetUntilMs) {
      this.magnetUntilMs = 0
      changed = true
    }

    if (changed) this.emitBuffs()
  }

  private emitBuffs() {
    if (!this.buffsCallback) return
    const now = this.time?.now ?? 0
    this.buffsCallback({
      speedMultiplier: this.speedMultiplier,
      speedRemainingMs: Math.max(0, this.speedBuffUntilMs - now),
      scoreMultiplier: this.scoreMultiplier,
      scoreRemainingMs: Math.max(0, this.scoreBuffUntilMs - now),
      magnetRemainingMs: Math.max(0, this.magnetUntilMs - now),
    })
  }

  private shrinkSnake(segmentsToRemove: number) {
    const minSegments = 5
    const removable = Math.max(0, this.snake.length - minSegments)
    const count = Math.min(removable, segmentsToRemove)
    for (let i = 0; i < count; i++) {
      const seg = this.snake.pop()
      seg?.graphics.destroy()
    }
  }

  update(_time: number, delta: number) {
    if (!this.isPlaying || this.snake.length === 0) return
    const now = this.time.now
    this.updateBuffs(now)

    // 平滑转向
    const turnSpeed = 0.18
    let angleDiff = this.targetDirection - this.direction
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2
    this.direction += angleDiff * turnSpeed

    // 移动蛇头
    const head = this.snake[0]
    const moveDistance = (this.baseSpeed * this.speedMultiplier * delta) / 1000
    const newX = head.x + Math.cos(this.direction) * moveDistance
    const newY = head.y + Math.sin(this.direction) * moveDistance

    // 边界检测
    if (newX < 10 || newX > WORLD_WIDTH - 10 || newY < 10 || newY > WORLD_HEIGHT - 10) {
      this.gameOver()
      return
    }

    // 磁铁效果：将附近食物轻微吸向蛇头
    if (this.isMagnetActive(now)) {
      const pullRadius = 260
      const pullSpeed = 260 // px/s
      const step = (pullSpeed * delta) / 1000
      for (const food of this.foods) {
        const dx = newX - food.x
        const dy = newY - food.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist === 0 || dist > pullRadius) continue
        const s = Math.min(step, dist)
        food.x += (dx / dist) * s
        food.y += (dy / dist) * s
        food.graphics.setPosition(food.x, food.y)
      }
    }

    // 自身碰撞检测（跳过前几节）
    for (let i = 10; i < this.snake.length; i++) {
      const seg = this.snake[i]
      const dist = Phaser.Math.Distance.Between(newX, newY, seg.x, seg.y)
      if (dist < 15) {
        this.gameOver()
        return
      }
    }

    // 更新蛇身位置（从尾到头）
    for (let i = this.snake.length - 1; i > 0; i--) {
      const current = this.snake[i]
      const target = this.snake[i - 1]
      const dist = Phaser.Math.Distance.Between(current.x, current.y, target.x, target.y)

      if (dist > this.segmentSpacing) {
        const angle = Math.atan2(target.y - current.y, target.x - current.x)
        current.x += Math.cos(angle) * (dist - this.segmentSpacing)
        current.y += Math.sin(angle) * (dist - this.segmentSpacing)
      }
      current.graphics.setPosition(current.x, current.y)
    }

    // 更新蛇头
    head.x = newX
    head.y = newY
    head.graphics.setPosition(newX, newY)

    // 食物碰撞检测
    for (let i = this.foods.length - 1; i >= 0; i--) {
      const food = this.foods[i]
      const dist = Phaser.Math.Distance.Between(newX, newY, food.x, food.y)
      if (dist < 20) {
        this.eatFood(i)
      }
    }

    // 更新小地图
    this.updateMinimap()
  }

  private eatFood(index: number) {
    const food = this.foods[index]
    const gained = Math.round(food.baseScore * this.scoreMultiplier)
    this.score = Math.max(0, this.score + gained)
    this.scoreCallback?.(this.score)

    // 增长蛇身
    const tail = this.snake[this.snake.length - 1]
    for (let i = 0; i < food.growth; i++) {
      this.addSegment(tail.x, tail.y)
    }

    // 食物效果
    const def = FOOD_DEFINITIONS[food.type]
    if (def.effect && def.effectDurationMs) {
      const until = this.time.now + def.effectDurationMs
      if (def.effect === 'speed') {
        this.speedMultiplier = 1.45
        this.speedBuffUntilMs = until
      } else if (def.effect === 'slow') {
        this.speedMultiplier = 0.75
        this.speedBuffUntilMs = until
      } else if (def.effect === 'double') {
        this.scoreMultiplier = 2
        this.scoreBuffUntilMs = until
      } else if (def.effect === 'magnet') {
        this.magnetUntilMs = until
      }
      this.emitBuffs()
    } else if (food.type === 'poison') {
      this.shrinkSnake(4)
    }

    // 移除食物并生成新的
    food.graphics.destroy()
    this.foods.splice(index, 1)
    this.spawnFood()
  }

  private gameOver() {
    this.isPlaying = false
    if (this.score > this.highScore) {
      this.highScore = this.score
    }
    this.gameOverCallback?.(this.score, this.highScore)
  }

  setInput(input: { angle?: number; vector?: { x: number; y: number } }) {
    if (input.angle !== undefined) {
      this.targetDirection = input.angle
    }
  }

  getScore() {
    return this.score
  }

  getHighScore() {
    return this.highScore
  }
}
