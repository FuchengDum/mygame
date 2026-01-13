// AI控制器 - 管理AI蛇的行为决策

import { SnakeEntity } from '../core/SnakeEntity'
import { GameWorld } from '../core/GameWorld'
import type { Point } from '../core/types'
import { WORLD_WIDTH, WORLD_HEIGHT } from '../core/types'
import { distance } from '../core/SpatialHash'

export type AIDifficulty = 'easy' | 'medium' | 'hard'

interface AIConfig {
  reactionDelay: number      // 反应延迟(ms)
  visionRange: number        // 视野范围
  dangerAvoidance: number    // 危险回避权重
  foodAttraction: number     // 食物吸引权重
  boostFrequency: number     // 加速频率 (0-1)
}

const DIFFICULTY_CONFIGS: Record<AIDifficulty, AIConfig> = {
  easy: {
    reactionDelay: 300,
    visionRange: 200,
    dangerAvoidance: 0.3,
    foodAttraction: 0.8,
    boostFrequency: 0.05
  },
  medium: {
    reactionDelay: 150,
    visionRange: 350,
    dangerAvoidance: 0.6,
    foodAttraction: 0.7,
    boostFrequency: 0.15
  },
  hard: {
    reactionDelay: 50,
    visionRange: 500,
    dangerAvoidance: 0.9,
    foodAttraction: 0.6,
    boostFrequency: 0.25
  }
}

export class AIController {
  private world: GameWorld
  private config: AIConfig
  private lastUpdateTime: Map<string, number> = new Map()

  constructor(world: GameWorld, difficulty: AIDifficulty = 'medium') {
    this.world = world
    this.config = DIFFICULTY_CONFIGS[difficulty]
  }

  update(_deltaMs: number) {
    const now = Date.now()

    for (const snake of this.world.snakes) {
      if (snake.state.isPlayer || !snake.state.alive) continue

      // 反应延迟
      const lastUpdate = this.lastUpdateTime.get(snake.state.id) || 0
      if (now - lastUpdate < this.config.reactionDelay) continue
      this.lastUpdateTime.set(snake.state.id, now)

      this.updateAI(snake)
    }
  }

  private updateAI(snake: SnakeEntity) {
    const head = snake.head
    let targetAngle = snake.state.direction

    // 1. 寻找最近的食物
    const foodTarget = this.findNearestFood(head)

    // 2. 检测危险（其他蛇的身体、边界）
    const dangerVector = this.calculateDangerVector(snake)

    // 3. 计算目标方向
    if (foodTarget) {
      const foodAngle = Math.atan2(foodTarget.y - head.y, foodTarget.x - head.x)
      targetAngle = foodAngle
    }

    // 4. 应用危险回避
    if (dangerVector.magnitude > 0) {
      const avoidAngle = Math.atan2(dangerVector.y, dangerVector.x)
      // 混合食物方向和回避方向
      const avoidWeight = this.config.dangerAvoidance * dangerVector.magnitude
      targetAngle = this.blendAngles(targetAngle, avoidAngle, avoidWeight)
    }

    // 5. 边界回避
    const boundaryAngle = this.getBoundaryAvoidanceAngle(head)
    if (boundaryAngle !== null) {
      targetAngle = this.blendAngles(targetAngle, boundaryAngle, 0.8)
    }

    snake.setTargetDirection(targetAngle)

    // 6. 决定是否加速
    const shouldBoost = this.shouldBoost(snake, foodTarget)
    snake.setBoost(shouldBoost)
  }

  private findNearestFood(pos: Point): Point | null {
    let nearest: Point | null = null
    let minDist = this.config.visionRange

    for (const food of this.world.foods) {
      const dist = distance(pos, food)
      if (dist < minDist) {
        minDist = dist
        nearest = food
      }
    }

    return nearest
  }

  private calculateDangerVector(snake: SnakeEntity): { x: number; y: number; magnitude: number } {
    const head = snake.head
    let dx = 0, dy = 0

    for (const other of this.world.snakes) {
      if (other.state.id === snake.state.id || !other.state.alive) continue

      // 检测其他蛇的身体
      for (const seg of other.state.segments) {
        const dist = distance(head, seg)
        if (dist < this.config.visionRange && dist > 0) {
          // 远离危险
          const repelStrength = 1 - dist / this.config.visionRange
          dx -= (seg.x - head.x) / dist * repelStrength
          dy -= (seg.y - head.y) / dist * repelStrength
        }
      }

      // 特别注意其他蛇头（可能的威胁）
      const headDist = distance(head, other.head)
      if (headDist < this.config.visionRange * 0.5) {
        // 如果对方更长，更需要躲避
        if (other.state.length >= snake.state.length) {
          const repelStrength = 2 * (1 - headDist / (this.config.visionRange * 0.5))
          dx -= (other.head.x - head.x) / headDist * repelStrength
          dy -= (other.head.y - head.y) / headDist * repelStrength
        }
      }
    }

    const magnitude = Math.hypot(dx, dy)
    if (magnitude > 0) {
      dx /= magnitude
      dy /= magnitude
    }

    return { x: dx, y: dy, magnitude: Math.min(magnitude, 1) }
  }

  private getBoundaryAvoidanceAngle(pos: Point): number | null {
    const margin = 150
    let needAvoid = false
    let targetX = pos.x
    let targetY = pos.y

    if (pos.x < margin) {
      targetX = WORLD_WIDTH / 2
      needAvoid = true
    } else if (pos.x > WORLD_WIDTH - margin) {
      targetX = WORLD_WIDTH / 2
      needAvoid = true
    }

    if (pos.y < margin) {
      targetY = WORLD_HEIGHT / 2
      needAvoid = true
    } else if (pos.y > WORLD_HEIGHT - margin) {
      targetY = WORLD_HEIGHT / 2
      needAvoid = true
    }

    if (needAvoid) {
      return Math.atan2(targetY - pos.y, targetX - pos.x)
    }
    return null
  }

  private blendAngles(a1: number, a2: number, weight: number): number {
    // 将角度转换为向量后混合
    const x = Math.cos(a1) * (1 - weight) + Math.cos(a2) * weight
    const y = Math.sin(a1) * (1 - weight) + Math.sin(a2) * weight
    return Math.atan2(y, x)
  }

  private shouldBoost(snake: SnakeEntity, foodTarget: Point | null): boolean {
    if (!snake.canBoost) return false

    // 随机加速
    if (Math.random() < this.config.boostFrequency * 0.1) {
      return true
    }

    // 追逐食物时加速
    if (foodTarget) {
      const dist = distance(snake.head, foodTarget)
      if (dist < 100 && Math.random() < this.config.boostFrequency) {
        return true
      }
    }

    return false
  }
}
