// 蛇实体类 - 管理单条蛇的状态和行为

import type { SnakeState, Point } from './types'
import { WORLD_WIDTH, WORLD_HEIGHT } from './types'

const SEGMENT_SPACING = 12
const BASE_SPEED = 150
const BOOST_SPEED_MULTIPLIER = 1.8
const BOOST_CONSUME_RATE = 0.5 // 每秒消耗的节数
const MIN_LENGTH_FOR_BOOST = 10
const INVINCIBLE_DURATION = 3000 // 3秒无敌

let entityIdCounter = 0

export type BuffType = 'speed' | 'score' | 'magnet'

export interface Buffs {
  speedMultiplier: number
  speedUntil: number
  scoreMultiplier: number
  scoreUntil: number
  magnetUntil: number
}

// 拖延检测状态
interface StallState {
  startPos: Point | null      // 检测窗口起始位置
  startTime: number           // 检测窗口起始时间
  totalDistance: number       // 累计路程
  totalTurn: number           // 累计转角
  stallValue: number          // 拖延值 (0-1)
}

export class SnakeEntity {
  public state: SnakeState
  public buffs: Buffs = {
    speedMultiplier: 1,
    speedUntil: 0,
    scoreMultiplier: 1,
    scoreUntil: 0,
    magnetUntil: 0
  }
  // 拖延检测
  private stallState: StallState = {
    startPos: null,
    startTime: 0,
    totalDistance: 0,
    totalTurn: 0,
    stallValue: 0
  }

  constructor(
    name: string,
    isPlayer: boolean,
    skinId: string,
    spawnX: number = WORLD_WIDTH / 2,
    spawnY: number = WORLD_HEIGHT / 2
  ) {
    const id = `snake_${++entityIdCounter}`
    const segments: Point[] = []

    // 初始5节
    for (let i = 0; i < 5; i++) {
      segments.push({ x: spawnX - i * SEGMENT_SPACING, y: spawnY })
    }

    this.state = {
      id,
      name,
      isPlayer,
      segments,
      direction: 0,
      targetDirection: 0,
      speed: BASE_SPEED,
      length: 5,
      kills: 0,
      skinId,
      alive: true,
      invincibleUntil: Date.now() + INVINCIBLE_DURATION,
      isBoosting: false
    }
  }

  get head(): Point {
    return this.state.segments[0]
  }

  get isInvincible(): boolean {
    return Date.now() < this.state.invincibleUntil
  }

  get canBoost(): boolean {
    return this.state.length >= MIN_LENGTH_FOR_BOOST
  }

  setTargetDirection(angle: number) {
    this.state.targetDirection = angle
  }

  setBoost(boosting: boolean) {
    if (boosting && !this.canBoost) {
      this.state.isBoosting = false
      return
    }
    this.state.isBoosting = boosting
  }

  // 更新蛇的位置
  update(deltaMs: number) {
    if (!this.state.alive) return

    const dt = deltaMs / 1000
    const now = Date.now()

    // 更新buff状态
    this.updateBuffs(now)

    // 计算速度（考虑buff）
    let speedMult = this.buffs.speedMultiplier
    if (this.state.isBoosting && this.canBoost) {
      speedMult *= BOOST_SPEED_MULTIPLIER
      // 消耗长度
      this.consumeLength(BOOST_CONSUME_RATE * dt)
    }

    // 移动蛇头
    const safeDt = Math.max(0.001, Math.min(dt, 0.1)) // 限制 dt 范围防止异常
    const moveDistance = this.state.speed * speedMult * safeDt

    // 更新拖延检测
    this.updateStallDetection(now, moveDistance)

    // 平滑转向 - 最小转弯半径约束防止原地转圈
    const turnSpeed = 0.18
    // 根据拖延值动态调整最小转弯半径: 25 -> 80
    const minTurnRadius = 25 + this.stallState.stallValue * 55
    const maxTurnPerSecond = Math.PI * 2.5 // 每秒最大转450度
    // 动态限制：取时间约束和半径约束的较小值
    const maxTurnByTime = maxTurnPerSecond * safeDt
    const maxTurnByRadius = moveDistance > 0 ? moveDistance / minTurnRadius : 0
    const maxTurnPerFrame = Math.max(0, Math.min(maxTurnByTime, maxTurnByRadius))
    let angleDiff = this.state.targetDirection - this.state.direction
    // 角度归一化（使用取模避免循环）
    angleDiff = ((angleDiff + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI
    // 累计转角用于拖延检测
    this.stallState.totalTurn += Math.abs(angleDiff) * turnSpeed
    const turnAmount = Math.max(-maxTurnPerFrame, Math.min(maxTurnPerFrame, angleDiff * turnSpeed))
    this.state.direction += turnAmount
    const head = this.state.segments[0]
    const newX = head.x + Math.cos(this.state.direction) * moveDistance
    const newY = head.y + Math.sin(this.state.direction) * moveDistance

    // 更新蛇身位置（从尾到头）
    for (let i = this.state.segments.length - 1; i > 0; i--) {
      const current = this.state.segments[i]
      const target = this.state.segments[i - 1]
      const dist = Math.hypot(current.x - target.x, current.y - target.y)

      if (dist > SEGMENT_SPACING) {
        const angle = Math.atan2(target.y - current.y, target.x - current.x)
        current.x += Math.cos(angle) * (dist - SEGMENT_SPACING)
        current.y += Math.sin(angle) * (dist - SEGMENT_SPACING)
      }
    }

    // 更新蛇头
    head.x = newX
    head.y = newY

    return { newX, newY }
  }

  // 检查是否撞墙
  checkBoundary(): boolean {
    const head = this.head
    return head.x < 10 || head.x > WORLD_WIDTH - 10 ||
           head.y < 10 || head.y > WORLD_HEIGHT - 10
  }

  // 增长
  grow(amount: number) {
    const tail = this.state.segments[this.state.segments.length - 1]
    for (let i = 0; i < amount; i++) {
      this.state.segments.push({ x: tail.x, y: tail.y })
    }
    this.state.length = this.state.segments.length
  }

  // 消耗长度（加速时）
  private consumeLength(amount: number) {
    const toRemove = Math.floor(amount)
    if (toRemove > 0 && this.state.segments.length > MIN_LENGTH_FOR_BOOST) {
      const removeCount = Math.min(toRemove, this.state.segments.length - MIN_LENGTH_FOR_BOOST)
      this.state.segments.splice(-removeCount, removeCount)
      this.state.length = this.state.segments.length
    }

    if (!this.canBoost) {
      this.state.isBoosting = false
    }
  }

  // 死亡
  die() {
    this.state.alive = false
  }

  // 重生
  respawn(x: number, y: number) {
    this.state.segments = []
    for (let i = 0; i < 5; i++) {
      this.state.segments.push({ x: x - i * SEGMENT_SPACING, y })
    }
    this.state.direction = 0
    this.state.targetDirection = 0
    this.state.length = 5
    this.state.alive = true
    this.state.invincibleUntil = Date.now() + INVINCIBLE_DURATION
    this.state.isBoosting = false
  }

  // 获取身体段（排除头部，用于碰撞检测）
  getBodySegments(): Point[] {
    return this.state.segments.slice(3) // 跳过前3节避免误判
  }

  // 应用buff
  applyBuff(type: BuffType, value: number, durationMs: number) {
    const until = Date.now() + durationMs
    switch (type) {
      case 'speed':
        this.buffs.speedMultiplier = value
        this.buffs.speedUntil = until
        break
      case 'score':
        this.buffs.scoreMultiplier = value
        this.buffs.scoreUntil = until
        break
      case 'magnet':
        this.buffs.magnetUntil = until
        break
    }
  }

  // 更新buff状态
  private updateBuffs(now: number) {
    if (this.buffs.speedUntil > 0 && now >= this.buffs.speedUntil) {
      this.buffs.speedMultiplier = 1
      this.buffs.speedUntil = 0
    }
    if (this.buffs.scoreUntil > 0 && now >= this.buffs.scoreUntil) {
      this.buffs.scoreMultiplier = 1
      this.buffs.scoreUntil = 0
    }
    if (this.buffs.magnetUntil > 0 && now >= this.buffs.magnetUntil) {
      this.buffs.magnetUntil = 0
    }
  }

  // 检查磁铁是否激活
  get hasMagnet(): boolean {
    return Date.now() < this.buffs.magnetUntil
  }

  // 获取当前拖延值 (0-1)
  get stallValue(): number {
    return this.stallState.stallValue
  }

  // 更新拖延检测
  private updateStallDetection(now: number, moveDistance: number) {
    const WINDOW_MS = 2500        // 检测窗口2.5秒
    const DISPLACEMENT_THRESHOLD = 60  // 净位移阈值
    const TURN_THRESHOLD = Math.PI * 3 // 累计转角阈值(约540度)
    const DECAY_RATE = 0.3        // 拖延值衰减速率/秒

    const head = this.state.segments[0]
    this.stallState.totalDistance += moveDistance

    // 初始化或重置窗口
    if (!this.stallState.startPos || now - this.stallState.startTime > WINDOW_MS) {
      // 计算上一窗口的拖延判定
      if (this.stallState.startPos) {
        const displacement = Math.hypot(
          head.x - this.stallState.startPos.x,
          head.y - this.stallState.startPos.y
        )
        // 路程大但位移小 + 转角大 = 拖延
        const isStalling = displacement < DISPLACEMENT_THRESHOLD &&
                          this.stallState.totalTurn > TURN_THRESHOLD &&
                          this.stallState.totalDistance > 150

        if (isStalling) {
          // 增加拖延值
          this.stallState.stallValue = Math.min(1, this.stallState.stallValue + 0.25)
        } else {
          // 衰减拖延值
          this.stallState.stallValue = Math.max(0, this.stallState.stallValue - DECAY_RATE)
        }
      }
      // 重置窗口
      this.stallState.startPos = { x: head.x, y: head.y }
      this.stallState.startTime = now
      this.stallState.totalDistance = 0
      this.stallState.totalTurn = 0
    }
  }
}
