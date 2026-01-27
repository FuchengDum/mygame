# 📋 实施计划：贪吃蛇无限进化机制

## 任务类型
- [x] 前端 (→ Gemini)
- [x] 后端 (→ Codex)
- [x] 全栈 (→ 并行)

---

## 🐛 前置 Bug 修复：加速不消耗长度

### 问题分析

**现象**：点击加速按钮后蛇身长度不会缩短

**根因**：`SnakeEntity.ts:194-205` 的 `consumeLength` 方法存在**累积精度丢失**问题

```typescript
// 当前代码 (有 bug)
private consumeLength(amount: number) {
  const toRemove = Math.floor(amount)  // ⚠️ 问题在这里！
  // ...
}
```

| 变量 | 值 | 说明 |
|------|-----|------|
| `BOOST_CONSUME_RATE` | 0.5 | 每秒消耗0.5节 |
| `dt` (60fps) | ~0.016 | 每帧约16ms |
| `amount` | 0.5 × 0.016 = **0.008** | 每帧传入的消耗量 |
| `Math.floor(0.008)` | **0** | 向下取整后为0，永远不消耗 |

### 修复方案

添加累积器 `boostConsumeAccumulator`，累积小数部分，当 ≥1 时才移除节段：

```typescript
// 修复后代码
private boostConsumeAccumulator: number = 0

private consumeLength(amount: number) {
  this.boostConsumeAccumulator += amount
  const toRemove = Math.floor(this.boostConsumeAccumulator)
  if (toRemove > 0 && this.state.segments.length > MIN_LENGTH_FOR_BOOST) {
    const removeCount = Math.min(toRemove, this.state.segments.length - MIN_LENGTH_FOR_BOOST)
    this.state.segments.splice(-removeCount, removeCount)
    this.state.length = this.state.segments.length
    this.boostConsumeAccumulator -= toRemove  // 保留小数部分
  }
  if (!this.canBoost) {
    this.state.isBoosting = false
  }
}

// 重生时重置累积器
respawn(x: number, y: number) {
  // ... 现有逻辑
  this.boostConsumeAccumulator = 0
}
```

---

## 技术方案

综合 Codex（后端架构）+ Gemini（UI/UX设计）分析的最优方案：

### 核心设计决策

1. **架构选择**：Option B 轻量版 - 在 `core/` 下新增能力/进化配置模块，执行逻辑挂在 `SnakeEntity`/`GameWorld`
2. **进化触发**：以 `length` 为主，`score` 为辅（score = 食物value + kills）
3. **穿墙实现**：仅免疫蛇体碰撞，不穿越地图边界（避免离场问题）
4. **UI方案**：固定能力栏（AbilityBar）+ 非阻塞式进化特效
5. **长度消耗**：所有消耗长度的操作（加速、能力）统一使用累积器机制，避免精度丢失

### 进化阶段配置

| 阶段 | 最小长度 | 最小分数 | 解锁能力 |
|------|----------|----------|----------|
| 1 | 5 | 0 | - |
| 2 | 12 | 30 | 瞬间加速 (Instant Boost) |
| 3 | 20 | 60 | 穿墙/无敌 (Phase-through) |
| 4 | 35 | 120 | 分身攻击 (Clone Attack) |
| 5 | 50 | 200 | 能力强化版 (Boost+, Phase+) |

### 能力参数设计

| 能力 | 持续时间 | 冷却时间 | 长度消耗 | 效果 |
|------|----------|----------|----------|------|
| Instant Boost | 1.5s | 8s | 2节 | 速度×2.5 |
| Phase-through | 2s | 15s | 3节 | 免疫蛇体碰撞 |
| Clone Attack | 3s | 20s | 5节 | 生成幻影/发射能量球 |

---

## 实施步骤

### Phase 0: Bug 修复 - 加速长度消耗 (SnakeEntity.ts) ⚠️ 优先

**文件**: `src/game/games/SnakeGame/core/SnakeEntity.ts`

**修改内容**:
1. 添加私有属性 `boostConsumeAccumulator: number = 0`
2. 修改 `consumeLength` 方法，使用累积器机制
3. 在 `respawn` 方法中重置累积器

```typescript
// 新增属性
private boostConsumeAccumulator: number = 0

// 修改方法
private consumeLength(amount: number) {
  this.boostConsumeAccumulator += amount
  const toRemove = Math.floor(this.boostConsumeAccumulator)
  if (toRemove > 0 && this.state.segments.length > MIN_LENGTH_FOR_BOOST) {
    const removeCount = Math.min(toRemove, this.state.segments.length - MIN_LENGTH_FOR_BOOST)
    this.state.segments.splice(-removeCount, removeCount)
    this.state.length = this.state.segments.length
    this.boostConsumeAccumulator -= toRemove  // 保留小数部分继续累积
  }
  if (!this.canBoost) {
    this.state.isBoosting = false
  }
}

// respawn 中添加
respawn(x: number, y: number) {
  // ... 现有逻辑
  this.boostConsumeAccumulator = 0
}
```

**预期产物**: 加速时正确消耗蛇身长度（每2秒消耗1节）

---

### Phase 1: 类型定义与配置 (types.ts + skins.ts)

**文件**: `src/game/games/SnakeGame/core/types.ts`

```typescript
// 新增类型定义
export type AbilityType = 'instantBoost' | 'phaseThrough' | 'cloneAttack'

export interface EvolutionStage {
  stage: number
  minLength: number
  minScore: number
  unlocks: AbilityType[]
}

export interface AbilityState {
  type: AbilityType
  activeUntil: number      // 激活结束时间戳
  cooldownUntil: number    // 冷却结束时间戳
  duration: number         // 持续时间(ms)
  cooldown: number         // 冷却时间(ms)
  lengthCost: number       // 长度消耗
}

// 扩展 SnakeState
export interface SnakeState {
  // ... 现有字段
  score: number                           // 新增：得分
  evolutionStage: number                  // 新增：进化阶段
  unlockedAbilities: AbilityType[]        // 新增：已解锁能力
  abilityCooldowns: Record<AbilityType, number>  // 新增：能力冷却
  activeAbilities: Record<AbilityType, number>   // 新增：激活中能力
}
```

**文件**: `src/game/games/SnakeGame/config/skins.ts`

```typescript
// 扩展皮肤配置
export interface EvolutionVisualConfig {
  stage: number
  headTint?: number           // 蛇头色调变化
  bodyTints?: number[]        // 蛇身渐变色
  glowColor?: number          // 发光颜色
  particleColor?: number      // 粒子颜色
}

export interface SkinConfig {
  // ... 现有字段
  evolutions: EvolutionVisualConfig[]  // 新增：进化阶段视觉
}
```

**预期产物**: 完整的类型定义，支持进化系统和能力系统

---

### Phase 2: 蛇实体能力系统 (SnakeEntity.ts)

**文件**: `src/game/games/SnakeGame/core/SnakeEntity.ts`

```typescript
// 新增常量
const EVOLUTION_STAGES: EvolutionStage[] = [
  { stage: 1, minLength: 5, minScore: 0, unlocks: [] },
  { stage: 2, minLength: 12, minScore: 30, unlocks: ['instantBoost'] },
  { stage: 3, minLength: 20, minScore: 60, unlocks: ['phaseThrough'] },
  { stage: 4, minLength: 35, minScore: 120, unlocks: ['cloneAttack'] },
  { stage: 5, minLength: 50, minScore: 200, unlocks: [] }  // 能力强化
]

const ABILITY_CONFIG: Record<AbilityType, Omit<AbilityState, 'type' | 'activeUntil' | 'cooldownUntil'>> = {
  instantBoost: { duration: 1500, cooldown: 8000, lengthCost: 2 },
  phaseThrough: { duration: 2000, cooldown: 15000, lengthCost: 3 },
  cloneAttack: { duration: 3000, cooldown: 20000, lengthCost: 5 }
}

// 新增方法
class SnakeEntity {
  // 检查并更新进化状态
  checkEvolution(): EvolutionStage | null {
    const currentStage = this.state.evolutionStage
    for (const stage of EVOLUTION_STAGES) {
      if (stage.stage > currentStage &&
          this.state.length >= stage.minLength &&
          this.state.score >= stage.minScore) {
        this.applyEvolution(stage)
        return stage
      }
    }
    return null
  }

  // 应用进化
  applyEvolution(stage: EvolutionStage) {
    this.state.evolutionStage = stage.stage
    this.state.unlockedAbilities.push(...stage.unlocks)
  }

  // 检查能力是否可用
  canUseAbility(type: AbilityType): boolean {
    const now = Date.now()
    return this.state.alive &&
           this.state.unlockedAbilities.includes(type) &&
           now >= (this.state.abilityCooldowns[type] || 0) &&
           this.state.length >= ABILITY_CONFIG[type].lengthCost
  }

  // 激活能力
  activateAbility(type: AbilityType): boolean {
    if (!this.canUseAbility(type)) return false
    const now = Date.now()
    const config = ABILITY_CONFIG[type]
    this.state.activeAbilities[type] = now + config.duration
    this.state.abilityCooldowns[type] = now + config.cooldown
    this.consumeLength(config.lengthCost)
    return true
  }

  // 检查能力是否激活中
  isAbilityActive(type: AbilityType): boolean {
    return Date.now() < (this.state.activeAbilities[type] || 0)
  }

  // Getter: 是否处于穿墙状态
  get isPhasing(): boolean {
    return this.isAbilityActive('phaseThrough')
  }

  // Getter: 是否处于瞬间加速状态
  get isInstantBoosting(): boolean {
    return this.isAbilityActive('instantBoost')
  }
}
```

**预期产物**: 完整的进化检测、能力激活、状态管理逻辑

---

### Phase 3: 游戏世界碰撞与能力实体 (GameWorld.ts)

**文件**: `src/game/games/SnakeGame/core/GameWorld.ts`

```typescript
// 新增类型
interface CloneEntity {
  id: string
  ownerId: string
  segments: Point[]
  createdAt: number
  ttl: number  // 存活时间
}

interface Projectile {
  id: string
  ownerId: string
  x: number
  y: number
  direction: number
  speed: number
  createdAt: number
  ttl: number
}

class GameWorld {
  private clones: CloneEntity[] = []
  private projectiles: Projectile[] = []

  update(deltaMs: number) {
    // ... 现有逻辑

    // 更新克隆体和投射物
    this.updateClones(deltaMs)
    this.updateProjectiles(deltaMs)

    for (const snake of this.snakes) {
      if (!snake.state.alive) continue
      snake.update(deltaMs)

      // 检查进化
      const evolved = snake.checkEvolution()
      if (evolved) {
        this.events.push({ type: 'evolve', data: { snakeId: snake.state.id, stage: evolved.stage } })
      }

      // 边界检测 - 穿墙状态不免疫边界
      if (snake.checkBoundary()) {
        this.killSnake(snake, null)
        continue
      }

      // 蛇与蛇碰撞 - 穿墙状态免疫
      if (!snake.isInvincible && !snake.isPhasing) {
        this.checkSnakeCollision(snake)
      }
    }

    // 检查克隆体/投射物碰撞
    this.checkCloneCollision()
    this.checkProjectileCollision()
  }

  // 创建克隆体
  createClone(snake: SnakeEntity) {
    const clone: CloneEntity = {
      id: `clone_${Date.now()}`,
      ownerId: snake.state.id,
      segments: snake.state.segments.slice(-5).map(s => ({ ...s })),
      createdAt: Date.now(),
      ttl: 3000
    }
    this.clones.push(clone)
  }

  // 发射能量球
  fireProjectile(snake: SnakeEntity) {
    const projectile: Projectile = {
      id: `proj_${Date.now()}`,
      ownerId: snake.state.id,
      x: snake.head.x,
      y: snake.head.y,
      direction: snake.state.direction,
      speed: 400,
      createdAt: Date.now(),
      ttl: 2000
    }
    this.projectiles.push(projectile)
  }

  // 克隆体碰撞检测 - 触发减速
  private checkCloneCollision() {
    for (const clone of this.clones) {
      for (const snake of this.snakes) {
        if (snake.state.id === clone.ownerId || !snake.state.alive) continue
        // 检测碰撞并应用减速
        for (const seg of clone.segments) {
          if (distance(snake.head, seg) < 15) {
            snake.applyBuff('speed', 0.5, 1500)  // 减速50%持续1.5秒
            break
          }
        }
      }
    }
  }
}
```

**预期产物**: 进化事件触发、穿墙碰撞豁免、克隆体/投射物系统

---

### Phase 4: AI策略升级 (AIController.ts)

**文件**: `src/game/games/SnakeGame/ai/AIController.ts`

```typescript
class AIController {
  private updateAI(snake: SnakeEntity) {
    // ... 现有逻辑

    // 能力决策
    this.decideAbilityUsage(snake)

    // 围剿策略
    if (this.shouldAttemptSurround(snake)) {
      this.executeSurroundStrategy(snake)
    }

    // 以小搏大策略
    if (this.isBeingChased(snake)) {
      this.executeEscapeStrategy(snake)
    }
  }

  // 能力使用决策
  private decideAbilityUsage(snake: SnakeEntity) {
    const dangerLevel = this.calculateDangerLevel(snake)
    const nearestTarget = this.findNearestSnake(snake)

    // 高危时使用穿墙
    if (dangerLevel > 0.7 && snake.canUseAbility('phaseThrough')) {
      this.world.activateAbility(snake, 'phaseThrough')
      return
    }

    // 追击时使用瞬间加速
    if (nearestTarget &&
        snake.state.length > nearestTarget.state.length &&
        snake.canUseAbility('instantBoost')) {
      const dist = distance(snake.head, nearestTarget.head)
      if (dist < 150 && dist > 50) {
        this.world.activateAbility(snake, 'instantBoost')
        return
      }
    }

    // 被追击时使用分身
    if (this.isBeingChased(snake) && snake.canUseAbility('cloneAttack')) {
      this.world.activateAbility(snake, 'cloneAttack')
    }
  }

  // 围剿策略 - 大蛇包围小蛇
  private executeSurroundStrategy(snake: SnakeEntity) {
    const target = this.findSmallerTarget(snake)
    if (!target) return

    // 计算切断路线角度
    const predictedPos = this.predictPosition(target, 500)
    const cutoffAngle = Math.atan2(predictedPos.y - snake.head.y, predictedPos.x - snake.head.x)
    snake.setTargetDirection(cutoffAngle)
  }

  // 以小搏大策略 - 诱导对手撞墙/撞体
  private executeEscapeStrategy(snake: SnakeEntity) {
    const chaser = this.findChaser(snake)
    if (!chaser) return

    // 优先逃向边界附近（诱导撞墙）
    const escapeAngle = this.calculateEscapeAngle(snake, chaser)
    snake.setTargetDirection(escapeAngle)

    // 短暂加速诱导
    if (snake.canBoost && Math.random() < 0.3) {
      snake.setBoost(true)
    }
  }
}
```

**预期产物**: AI能力决策、围剿策略、以小搏大策略

---

### Phase 5: 渲染层与UI (SnakeScene.ts + React组件)

**文件**: `src/game/games/SnakeGame/SnakeScene.ts`

```typescript
class SnakeScene {
  // 渲染蛇 - 根据进化阶段和能力状态
  private renderSnake(snake: SnakeEntity, graphics: SnakeGraphics) {
    const skin = getSkinById(snake.state.skinId)
    const evolutionVisual = skin.evolutions?.[snake.state.evolutionStage - 1]

    for (let i = 0; i < snake.state.segments.length; i++) {
      const sprite = graphics.segments[i]

      // 穿墙状态 - 半透明
      if (snake.isPhasing) {
        sprite.setAlpha(0.4)
        sprite.setTint(0x00ffff)
      }

      // 瞬间加速 - 拖尾特效
      if (snake.isInstantBoosting) {
        this.addBoostTrail(snake)
      }

      // 进化外观
      if (evolutionVisual?.bodyTints) {
        const colorIndex = i % evolutionVisual.bodyTints.length
        sprite.setTint(evolutionVisual.bodyTints[colorIndex])
      }
    }
  }

  // 进化特效
  private playEvolutionEffect(snake: SnakeEntity) {
    const particles = this.add.particles(snake.head.x, snake.head.y, 'particle', {
      speed: { min: 100, max: 200 },
      scale: { start: 1, end: 0 },
      lifespan: 500,
      tint: 0x00ffff
    })
    this.time.delayedCall(500, () => particles.destroy())
  }
}
```

**React UI组件** (新建 `src/components/snake/AbilityBar.tsx`)

```typescript
interface AbilityButtonProps {
  type: AbilityType
  status: 'ready' | 'cooldown' | 'locked'
  cooldownPercent?: number
  onClick: () => void
  hotkey: string
}

const AbilityButton: React.FC<AbilityButtonProps> = ({ type, status, cooldownPercent, onClick, hotkey }) => {
  const icons = {
    instantBoost: '⚡',
    phaseThrough: '👻',
    cloneAttack: '🔮'
  }

  return (
    <button
      onClick={onClick}
      disabled={status !== 'ready'}
      className={cn(
        'w-12 h-12 rounded-lg border-2 relative',
        status === 'ready' && 'border-neon-blue shadow-neon-blue bg-dark-card',
        status === 'cooldown' && 'border-gray-600 bg-dark-card opacity-50',
        status === 'locked' && 'border-gray-800 bg-gray-900 opacity-30'
      )}
    >
      <span className="text-2xl">{icons[type]}</span>
      {status === 'cooldown' && (
        <div
          className="absolute inset-0 bg-gray-800 rounded-lg"
          style={{ height: `${cooldownPercent}%`, bottom: 0 }}
        />
      )}
      <span className="absolute bottom-0 right-1 text-xs text-gray-400">{hotkey}</span>
    </button>
  )
}

const AbilityBar: React.FC<{ abilities: AbilityState[] }> = ({ abilities }) => {
  return (
    <div className="fixed right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2">
      {abilities.map(ability => (
        <AbilityButton key={ability.type} {...ability} />
      ))}
    </div>
  )
}
```

**预期产物**: 进化视觉特效、能力状态渲染、React能力栏UI

---

### Phase 6: 状态管理与通信 (gameStore.ts)

**文件**: `src/store/gameStore.ts`

```typescript
interface EvolutionState {
  evolutionLevel: number
  abilities: Record<AbilityType, {
    status: 'ready' | 'cooldown' | 'locked'
    cooldownUntil?: number
  }>
  isFirstEvolution: boolean
}

interface GameStore {
  // ... 现有状态
  evolution: EvolutionState

  // Actions
  evolve: () => void
  activateAbility: (type: AbilityType) => void
  updateCooldowns: () => void
}

// Phaser -> React 通信
window.addEventListener('playerEvolved', (e: CustomEvent) => {
  gameStore.getState().evolve()
})

// React -> Phaser 通信
const activateAbility = (type: AbilityType) => {
  const phaserScene = getPhaserScene()
  phaserScene?.activatePlayerAbility(type)
}
```

**预期产物**: 完整的状态管理、Phaser与React双向通信

---

## 关键文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/game/games/SnakeGame/core/SnakeEntity.ts` | 修改 | **P0**: 修复加速长度消耗 bug + 添加进化检测、能力激活 |
| `src/game/games/SnakeGame/core/types.ts` | 修改 | 新增 EvolutionStage, AbilityType, AbilityState 类型 |
| `src/game/games/SnakeGame/core/GameWorld.ts` | 修改 | 添加进化事件、穿墙碰撞豁免、克隆体/投射物系统 |
| `src/game/games/SnakeGame/ai/AIController.ts` | 修改 | 添加能力决策、围剿策略、以小搏大策略 |
| `src/game/games/SnakeGame/SnakeScene.ts` | 修改 | 添加进化特效、能力视觉效果渲染 |
| `src/game/games/SnakeGame/config/skins.ts` | 修改 | 扩展 SkinConfig 支持进化阶段视觉 |
| `src/components/snake/AbilityBar.tsx` | 新建 | 能力栏UI组件 |
| `src/store/gameStore.ts` | 修改 | 添加进化状态管理 |

---

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| 能力叠加导致速度异常 | 设置速度上限（如 BASE_SPEED × 3），防止无限叠加 |
| 克隆体过多导致性能问题 | 限制同时存在的克隆体数量（如最多3个），设置TTL自动清理 |
| 穿墙状态下离场 | 穿墙仅免疫蛇体碰撞，边界检测仍然生效 |
| 进化阈值与得分计算不一致 | 统一 score 计算公式：食物value + kills × 10 |
| AI能力使用过于频繁/保守 | 为AI设置能力使用概率和条件阈值，可配置调整 |
| 新手不理解进化机制 | 首次进化时显示引导提示，高亮新能力按钮 |

---

## 测试策略

### 单元测试
- 能力冷却计时准确性
- 进化阶段触发条件
- 长度消耗不为负
- 死亡后状态清理

### 集成测试
- Phase 期间不触发蛇体碰撞
- Clone 碰撞触发减速效果
- Instant Boost 不穿越边界
- 进化事件正确触发UI更新

### AI验证
- 小蛇能脱离大蛇追击
- 大蛇更容易围杀小蛇
- 能力触发频率符合配置

---

## SESSION_ID（供 /ccg:execute 使用）

- **CODEX_SESSION**: `019c0002-109a-7b91-abaf-04bd1e6f0cd1`
- **GEMINI_SESSION**: `30223058-91f2-4450-ae9f-35509138523c`

---

## 实施优先级

1. **P0 - Bug修复**: SnakeEntity.ts（修复加速长度消耗 bug）⚠️ 必须首先完成
2. **P1 - 核心框架**: types.ts + SnakeEntity.ts（进化检测+能力状态）
3. **P2 - 游戏逻辑**: GameWorld.ts（碰撞豁免+克隆体系统）
4. **P3 - AI策略**: AIController.ts（能力决策+围剿策略）
5. **P4 - 视觉渲染**: SnakeScene.ts + skins.ts（进化特效+外观变化）
6. **P5 - UI层**: AbilityBar.tsx + gameStore.ts（能力栏+状态管理）
