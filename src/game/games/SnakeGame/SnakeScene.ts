import Phaser from 'phaser'

interface SnakeSegment {
  x: number
  y: number
  graphics: Phaser.GameObjects.Arc
}

interface Food {
  x: number
  y: number
  graphics: Phaser.GameObjects.Arc
  value: number
  isLarge: boolean
}

export class SnakeScene extends Phaser.Scene {
  private snake: SnakeSegment[] = []
  private foods: Food[] = []
  private direction: number = 0 // 角度（弧度）
  private targetDirection: number = 0
  private speed: number = 150
  private segmentSpacing: number = 12
  private score: number = 0
  private highScore: number = 0
  private isPlaying: boolean = false
  private scoreCallback?: (score: number) => void
  private gameOverCallback?: (score: number, highScore: number) => void

  // 颜色配置
  private readonly HEAD_COLOR = 0x00f5ff
  private readonly BODY_START = 0xbf00ff
  private readonly BODY_END = 0xff00aa
  private readonly FOOD_COLOR = 0x00ff88
  private readonly FOOD_LARGE_COLOR = 0xffff00

  constructor() {
    super('SnakeScene')
  }

  init(data: { highScore?: number; onScore?: (score: number) => void; onGameOver?: (score: number, highScore: number) => void }) {
    this.highScore = data.highScore || 0
    this.scoreCallback = data.onScore
    this.gameOverCallback = data.onGameOver
  }

  create() {
    // 绘制网格背景
    this.drawGrid()

    // 绘制边界
    this.drawBorder()
  }

  private drawGrid() {
    const graphics = this.add.graphics()
    graphics.lineStyle(1, 0x1a1a2e, 0.5)

    for (let x = 0; x <= 800; x += 20) {
      graphics.moveTo(x, 0)
      graphics.lineTo(x, 600)
    }
    for (let y = 0; y <= 600; y += 20) {
      graphics.moveTo(0, y)
      graphics.lineTo(800, y)
    }
    graphics.strokePath()
  }

  private drawBorder() {
    const graphics = this.add.graphics()
    graphics.lineStyle(3, 0xff0044, 0.8)
    graphics.strokeRect(2, 2, 796, 596)
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

    // 创建初始蛇
    const startX = 400
    const startY = 300
    for (let i = 0; i < 5; i++) {
      this.addSegment(startX - i * this.segmentSpacing, startY)
    }

    // 生成初始食物
    for (let i = 0; i < 8; i++) {
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

  private spawnFood() {
    const margin = 30
    const x = Phaser.Math.Between(margin, 800 - margin)
    const y = Phaser.Math.Between(margin, 600 - margin)
    const isLarge = Math.random() < 0.15
    const radius = isLarge ? 10 : 6
    const color = isLarge ? this.FOOD_LARGE_COLOR : this.FOOD_COLOR
    const value = isLarge ? 30 : 10

    const graphics = this.add.circle(x, y, radius, color)
    graphics.setStrokeStyle(2, color, 0.5)

    // 脉冲动画
    this.tweens.add({
      targets: graphics,
      scale: { from: 0.8, to: 1.2 },
      alpha: { from: 0.7, to: 1 },
      duration: 600,
      yoyo: true,
      repeat: -1
    })

    this.foods.push({ x, y, graphics, value, isLarge })
  }

  update(_time: number, delta: number) {
    if (!this.isPlaying || this.snake.length === 0) return

    // 平滑转向
    const turnSpeed = 0.18
    let angleDiff = this.targetDirection - this.direction
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2
    this.direction += angleDiff * turnSpeed

    // 移动蛇头
    const head = this.snake[0]
    const moveDistance = (this.speed * delta) / 1000
    const newX = head.x + Math.cos(this.direction) * moveDistance
    const newY = head.y + Math.sin(this.direction) * moveDistance

    // 边界检测
    if (newX < 10 || newX > 790 || newY < 10 || newY > 590) {
      this.gameOver()
      return
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
  }

  private eatFood(index: number) {
    const food = this.foods[index]
    this.score += food.value
    this.scoreCallback?.(this.score)

    // 增长蛇身
    const tail = this.snake[this.snake.length - 1]
    this.addSegment(tail.x, tail.y)
    if (food.isLarge) {
      this.addSegment(tail.x, tail.y)
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
