// 游戏世界 - 核心模拟层

import { SnakeEntity } from './SnakeEntity'
import { SpatialHash, distance } from './SpatialHash'
import type { Food, FoodType, Point, GameCallbacks, GameConfig, GameResult, GameEvent } from './types'
import { WORLD_WIDTH, WORLD_HEIGHT } from './types'

const FOOD_DEFINITIONS: Record<FoodType, { radius: number; value: number; growth: number; spawnWeight: number }> = {
  pellet: { radius: 5, value: 5, growth: 1, spawnWeight: 80 },
  big: { radius: 10, value: 25, growth: 3, spawnWeight: 10 },
  speed: { radius: 9, value: 12, growth: 2, spawnWeight: 4 },
  slow: { radius: 9, value: 12, growth: 2, spawnWeight: 3 },
  double: { radius: 9, value: 0, growth: 0, spawnWeight: 2 },
  magnet: { radius: 9, value: 0, growth: 0, spawnWeight: 1 },
  drop: { radius: 6, value: 8, growth: 1, spawnWeight: 0 } // 死亡掉落
}

let foodIdCounter = 0

export class GameWorld {
  public snakes: SnakeEntity[] = []
  public foods: Food[] = []
  public player: SnakeEntity | null = null
  public events: GameEvent[] = []

  private bodyHash: SpatialHash<Point & { snakeId: string; index: number }> = new SpatialHash(60)
  private foodHash: SpatialHash<Food> = new SpatialHash(60)
  private callbacks: GameCallbacks = {}
  private startTime: number = 0
  private bestRank: number = 999

  private leaderboardThrottle = 0
  private statsThrottle = 0

  init(config: GameConfig, callbacks: GameCallbacks) {
    this.callbacks = callbacks
    this.snakes = []
    this.foods = []
    this.events = []
    this.startTime = Date.now()
    this.bestRank = 999

    // 创建玩家
    const spawnPos = this.getRandomSpawnPosition()
    this.player = new SnakeEntity(config.nickname, true, config.skinId, spawnPos.x, spawnPos.y)
    this.snakes.push(this.player)

    // 创建AI蛇
    const aiNames = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta']
    const aiSkins = ['cyan', 'purple', 'green', 'orange', 'pink', 'gold']
    for (let i = 0; i < config.aiCount; i++) {
      const pos = this.getRandomSpawnPosition()
      const ai = new SnakeEntity(
        aiNames[i % aiNames.length],
        false,
        aiSkins[i % aiSkins.length],
        pos.x,
        pos.y
      )
      this.snakes.push(ai)
    }

    // 生成初始食物
    for (let i = 0; i < 150; i++) {
      this.spawnFood()
    }
  }

  private getRandomSpawnPosition(): Point {
    const margin = 200
    return {
      x: margin + Math.random() * (WORLD_WIDTH - margin * 2),
      y: margin + Math.random() * (WORLD_HEIGHT - margin * 2)
    }
  }

  private rollFoodType(): FoodType {
    const totalWeight = Object.values(FOOD_DEFINITIONS)
      .filter(d => d.spawnWeight > 0)
      .reduce((sum, d) => sum + d.spawnWeight, 0)
    let roll = Math.random() * totalWeight
    for (const [type, def] of Object.entries(FOOD_DEFINITIONS)) {
      if (def.spawnWeight === 0) continue
      roll -= def.spawnWeight
      if (roll <= 0) return type as FoodType
    }
    return 'pellet'
  }

  spawnFood(type?: FoodType, x?: number, y?: number): Food {
    const t = type || this.rollFoodType()
    const def = FOOD_DEFINITIONS[t]
    const food: Food = {
      id: `food_${++foodIdCounter}`,
      type: t,
      x: x ?? 30 + Math.random() * (WORLD_WIDTH - 60),
      y: y ?? 30 + Math.random() * (WORLD_HEIGHT - 60),
      radius: def.radius,
      value: def.value,
      growth: def.growth
    }
    this.foods.push(food)
    return food
  }

  // 死亡时掉落食物
  private dropFoodsFromSnake(snake: SnakeEntity) {
    const segments = snake.state.segments
    // 每隔几节掉落一个食物
    for (let i = 0; i < segments.length; i += 3) {
      const seg = segments[i]
      this.spawnFood('drop', seg.x + (Math.random() - 0.5) * 20, seg.y + (Math.random() - 0.5) * 20)
    }
  }

  // 主更新循环
  update(deltaMs: number) {
    this.events = []

    // 更新空间哈希
    this.rebuildSpatialHash()

    // 更新所有蛇
    for (const snake of this.snakes) {
      if (!snake.state.alive) continue
      snake.update(deltaMs)

      // 边界检测
      if (snake.checkBoundary()) {
        this.killSnake(snake, null)
        continue
      }

      // 磁铁效果：吸引附近食物
      if (snake.hasMagnet) {
        this.applyMagnetEffect(snake, deltaMs)
      }

      // 食物碰撞
      this.checkFoodCollision(snake)

      // 蛇与蛇碰撞（头撞身体）
      if (!snake.isInvincible) {
        this.checkSnakeCollision(snake)
      }
    }

    // 维持食物数量
    while (this.foods.length < 150) {
      this.spawnFood()
    }

    // 节流回调
    this.leaderboardThrottle += deltaMs
    this.statsThrottle += deltaMs

    if (this.leaderboardThrottle >= 1000) {
      this.leaderboardThrottle = 0
      this.emitLeaderboard()
    }

    if (this.statsThrottle >= 200 && this.player) {
      this.statsThrottle = 0
      this.callbacks.onStatsUpdate?.({
        length: this.player.state.length,
        kills: this.player.state.kills,
        canBoost: this.player.canBoost
      })
    }
  }

  private rebuildSpatialHash() {
    this.bodyHash.clear()
    this.foodHash.clear()

    for (const snake of this.snakes) {
      if (!snake.state.alive) continue
      const body = snake.getBodySegments()
      for (let i = 0; i < body.length; i++) {
        this.bodyHash.insert({
          ...body[i],
          snakeId: snake.state.id,
          index: i
        })
      }
    }

    for (const food of this.foods) {
      this.foodHash.insert(food)
    }
  }

  private checkFoodCollision(snake: SnakeEntity) {
    const head = snake.head
    const nearFoods = this.foodHash.queryNear(head.x, head.y, 25)

    for (const food of nearFoods) {
      const dist = distance(head, food)
      if (dist < 20) {
        snake.grow(food.growth)

        // 应用道具效果
        this.applyFoodEffect(snake, food.type)

        this.events.push({ type: 'eat', data: { snakeId: snake.state.id, foodId: food.id } })

        // 移除食物
        const idx = this.foods.findIndex(f => f.id === food.id)
        if (idx !== -1) this.foods.splice(idx, 1)
      }
    }
  }

  private applyFoodEffect(snake: SnakeEntity, type: FoodType) {
    switch (type) {
      case 'speed':
        snake.applyBuff('speed', 1.45, 5000)
        break
      case 'slow':
        snake.applyBuff('speed', 0.75, 5000)
        break
      case 'double':
        snake.applyBuff('score', 2, 8000)
        break
      case 'magnet':
        snake.applyBuff('magnet', 1, 8000)
        break
    }
  }

  private applyMagnetEffect(snake: SnakeEntity, deltaMs: number) {
    const head = snake.head
    const pullRadius = 260
    const pullSpeed = 260 // px/s
    const step = (pullSpeed * deltaMs) / 1000

    for (const food of this.foods) {
      const dx = head.x - food.x
      const dy = head.y - food.y
      const dist = Math.hypot(dx, dy)
      if (dist === 0 || dist > pullRadius) continue
      const s = Math.min(step, dist)
      food.x += (dx / dist) * s
      food.y += (dy / dist) * s
    }
  }

  private checkSnakeCollision(snake: SnakeEntity) {
    const head = snake.head
    const nearSegments = this.bodyHash.queryNear(head.x, head.y, 15)

    for (const seg of nearSegments) {
      if (seg.snakeId === snake.state.id) continue // 跳过自己

      const dist = distance(head, seg)
      if (dist < 12) {
        // 找到被撞的蛇
        const victim = this.snakes.find(s => s.state.id === seg.snakeId)
        if (victim && victim.state.alive) {
          // 头碰头判定
          const headDist = distance(head, victim.head)
          if (headDist < 15) {
            // 长度大者胜
            if (snake.state.length > victim.state.length) {
              this.killSnake(victim, snake)
            } else if (snake.state.length < victim.state.length) {
              this.killSnake(snake, victim)
            } else {
              // 长度相等，双死
              this.killSnake(snake, victim)
              this.killSnake(victim, snake)
            }
          } else {
            // 头撞身体，撞的人死
            this.killSnake(snake, victim)
          }
          return
        }
      }
    }
  }

  private killSnake(snake: SnakeEntity, killer: SnakeEntity | null) {
    if (!snake.state.alive) return

    snake.die()
    this.dropFoodsFromSnake(snake)

    if (killer) {
      killer.state.kills++
      this.events.push({
        type: 'kill',
        data: { killerId: killer.state.id, victimId: snake.state.id }
      })

      if (killer.state.isPlayer) {
        this.callbacks.onKill?.(snake.state.name)
      }
    }

    this.events.push({
      type: 'death',
      data: { snakeId: snake.state.id, position: { ...snake.head } }
    })

    // 玩家死亡
    if (snake.state.isPlayer) {
      const result: GameResult = {
        length: snake.state.length,
        kills: snake.state.kills,
        survivalTime: Math.floor((Date.now() - this.startTime) / 1000),
        bestRank: this.bestRank
      }
      this.callbacks.onGameOver?.(result)
    } else {
      // AI死亡后重生
      setTimeout(() => {
        if (!snake.state.alive) {
          const pos = this.getRandomSpawnPosition()
          snake.respawn(pos.x, pos.y)
        }
      }, 3000)
    }
  }

  private emitLeaderboard() {
    const sorted = this.snakes
      .filter(s => s.state.alive)
      .sort((a, b) => b.state.length - a.state.length)
      .slice(0, 10)
      .map((s, i) => ({
        id: s.state.id,
        name: s.state.name,
        length: s.state.length,
        kills: s.state.kills,
        rank: i + 1
      }))

    // 更新玩家最佳排名
    if (this.player?.state.alive) {
      const playerRank = sorted.findIndex(e => e.id === this.player!.state.id) + 1
      if (playerRank > 0 && playerRank < this.bestRank) {
        this.bestRank = playerRank
      }
    }

    this.callbacks.onLeaderboardUpdate?.(sorted)
  }

  // 玩家输入
  setPlayerDirection(angle: number) {
    this.player?.setTargetDirection(angle)
  }

  setPlayerBoost(boosting: boolean) {
    this.player?.setBoost(boosting)
  }

  // 获取所有存活的蛇（用于渲染）
  getAliveSnakes(): SnakeEntity[] {
    return this.snakes.filter(s => s.state.alive)
  }

  // 获取玩家位置（用于相机跟随）
  getPlayerPosition(): Point | null {
    return this.player?.state.alive ? this.player.head : null
  }
}
