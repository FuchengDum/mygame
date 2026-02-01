# 📋 实施计划：贪吃蛇无限进化机制（修订版）

## 任务类型
- [x] 前端 (→ Gemini)
- [x] 后端 (→ Codex)
- [x] 全栈 (→ 并行)

---

## 🎯 设计原则（基于提案文档）

> **核心约束**：以下原则不可违背

1. **保持核心规则不可破坏**："头撞身体即死"是游戏的灵魂
2. **UI 极简**：维持单一加速按钮，能力以道具形式呈现，避免多按钮
3. **公平竞技**：AI 与玩家采用同一规则，无"AI 作弊感"
4. **渐进式引入**：先验证简单机制，再考虑复杂系统
5. **长度 = 实力**：被动增益控制在 5-10% 以内，保持直觉规则

---

## 📊 分阶段实施路径

| 阶段 | 内容 | 风险等级 | 优先级 | 状态 |
|------|------|----------|--------|------|
| **Phase A** | 外观进化 + 被动增益 | 低 | P0 | 本次实施 |
| **Phase B** | 场地道具系统（拾取即生效） | 中 | P1 | 本次实施 |
| **Phase C** | 主动能力系统（需验证 A/B 后决定） | 高 | P2 | 延迟实施 |

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

## Phase A：外观进化 + 被动增益（P0）

### 进化阶段配置（仅基于长度）

| 阶段 | 最小长度 | 外观变化 | 被动增益 |
|------|----------|----------|----------|
| 1 | 0 | 基础外观 | - |
| 2 | 10 | 蛇头发光 + 身体色调变化 | 转向速度 +5% |
| 3 | 25 | 蛇身渐变 + 粒子拖尾 | 加速效率 +10%（消耗更少长度） |
| 4 | 50 | 蛇头皇冠/角 + 发光光环 | 视野范围 +10% |
| 5 | 100 | 全身特效 + 独特纹理 | 基础速度 +5% |

### 被动增益参数（严格限制 5-10%）

```typescript
const EVOLUTION_PASSIVE_BUFFS = {
  stage2: { turnSpeedMultiplier: 1.05 },      // 转向速度 +5%
  stage3: { boostEfficiency: 0.9 },           // 加速消耗 -10%（即效率 +10%）
  stage4: { viewRangeMultiplier: 1.10 },      // 视野范围 +10%
  stage5: { baseSpeedMultiplier: 1.05 }       // 基础速度 +5%
}
```

### 技术方案

**文件**: `src/game/games/SnakeGame/core/types.ts`

```typescript
// 新增类型定义
export interface EvolutionStage {
  stage: number
  minLength: number
  passiveBuffs: Partial<PassiveBuffs>
}

export interface PassiveBuffs {
  turnSpeedMultiplier: number
  boostEfficiency: number      // 加速消耗倍率（<1 表示更高效）
  viewRangeMultiplier: number
  baseSpeedMultiplier: number
}

// 扩展 SnakeState
export interface SnakeState {
  // ... 现有字段
  evolutionStage: number       // 新增：进化阶段 (1-5)
}
```

**文件**: `src/game/games/SnakeGame/core/SnakeEntity.ts`

```typescript
// 进化阶段配置
const EVOLUTION_STAGES: EvolutionStage[] = [
  { stage: 1, minLength: 0, passiveBuffs: {} },
  { stage: 2, minLength: 10, passiveBuffs: { turnSpeedMultiplier: 1.05 } },
  { stage: 3, minLength: 25, passiveBuffs: { boostEfficiency: 0.9 } },
  { stage: 4, minLength: 50, passiveBuffs: { viewRangeMultiplier: 1.10 } },
  { stage: 5, minLength: 100, passiveBuffs: { baseSpeedMultiplier: 1.05 } }
]

class SnakeEntity {
  // 检查并更新进化状态
  checkEvolution(): EvolutionStage | null {
    const currentStage = this.state.evolutionStage || 1
    for (const stage of EVOLUTION_STAGES) {
      if (stage.stage > currentStage && this.state.length >= stage.minLength) {
        this.state.evolutionStage = stage.stage
        return stage
      }
    }
    return null
  }

  // 获取当前被动增益
  getPassiveBuffs(): PassiveBuffs {
    const defaults: PassiveBuffs = {
      turnSpeedMultiplier: 1,
      boostEfficiency: 1,
      viewRangeMultiplier: 1,
      baseSpeedMultiplier: 1
    }
    const stage = this.state.evolutionStage || 1
    // 累积所有已解锁阶段的增益
    for (const s of EVOLUTION_STAGES) {
      if (s.stage <= stage) {
        Object.assign(defaults, s.passiveBuffs)
      }
    }
    return defaults
  }
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
  glowIntensity?: number      // 发光强度
  particleColor?: number      // 粒子颜色
  crownVisible?: boolean      // 是否显示皇冠
}

export interface SkinConfig {
  // ... 现有字段
  evolutions?: EvolutionVisualConfig[]  // 新增：进化阶段视觉
}
```

### 进化视觉反馈

**文件**: `src/game/games/SnakeGame/SnakeScene.ts`

```typescript
// 进化特效（非阻塞式）
private playEvolutionEffect(snake: SnakeEntity, stage: number) {
  // 1. 粒子爆发效果
  const particles = this.add.particles(snake.head.x, snake.head.y, 'particle', {
    speed: { min: 100, max: 200 },
    scale: { start: 1.5, end: 0 },
    lifespan: 600,
    tint: this.getEvolutionColor(stage),
    quantity: 20
  })
  this.time.delayedCall(600, () => particles.destroy())

  // 2. 闪光效果
  this.cameras.main.flash(200, 255, 255, 255, false, (_, progress) => {
    if (progress === 1) {
      // 闪光结束
    }
  })

  // 3. 音效
  this.sound.play('evolve', { volume: 0.5 })
}

// 根据进化阶段渲染蛇
private renderSnakeEvolution(snake: SnakeEntity, graphics: SnakeGraphics) {
  const skin = getSkinById(snake.state.skinId)
  const stage = snake.state.evolutionStage || 1
  const evolutionVisual = skin.evolutions?.[stage - 1]

  if (!evolutionVisual) return

  // 应用蛇头色调
  if (evolutionVisual.headTint) {
    graphics.head.setTint(evolutionVisual.headTint)
  }

  // 应用蛇身渐变
  if (evolutionVisual.bodyTints) {
    for (let i = 0; i < graphics.segments.length; i++) {
      const colorIndex = i % evolutionVisual.bodyTints.length
      graphics.segments[i].setTint(evolutionVisual.bodyTints[colorIndex])
    }
  }

  // 发光效果
  if (evolutionVisual.glowColor && evolutionVisual.glowIntensity) {
    // 使用 Phaser 的 postFX 或自定义 shader
    graphics.head.setPostPipeline('GlowPostFX')
  }
}
```

### 新手引导（首次进化）

**文件**: `src/components/snake/EvolutionNotification.tsx`

```typescript
interface EvolutionNotificationProps {
  stage: number
  buffDescription: string
  onDismiss: () => void
}

const EvolutionNotification: React.FC<EvolutionNotificationProps> = ({
  stage,
  buffDescription,
  onDismiss
}) => {
  // 3秒后自动消失
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div className="fixed top-1/4 left-1/2 -translate-x-1/2 z-50 animate-bounce-in">
      <div className="bg-gradient-to-r from-purple-600 to-blue-500 rounded-lg p-4 shadow-lg">
        <div className="text-center">
          <div className="text-2xl font-bold text-white mb-2">
            进化！阶段 {stage}
          </div>
          <div className="text-sm text-white/80">
            {buffDescription}
          </div>
        </div>
      </div>
    </div>
  )
}

// 增益描述映射
const BUFF_DESCRIPTIONS: Record<number, string> = {
  2: '转向速度 +5%',
  3: '加速效率 +10%',
  4: '视野范围 +10%',
  5: '基础速度 +5%'
}
```

---

## Phase B：场地道具系统（P1）

### 道具类型设计

| 道具 | 效果 | 持续时间 | 视觉 | 复用现有系统 |
|------|------|----------|------|--------------|
| 速度箭头 | 加速 ×1.5，不消耗长度 | 2s | 黄色箭头图标 | 扩展 `FoodType` |
| 磁铁 | 自动吸引附近食物 | 5s | 红色 U 形磁铁 | 已实现 `magnet` |
| 护盾 | 免疫一次碰撞 | 单次触发 | 蓝色气泡 | 新增 `shield` |

### 技术方案

**文件**: `src/game/games/SnakeGame/core/types.ts`

```typescript
// 扩展 FoodType
export type FoodType = 'pellet' | 'big' | 'speed' | 'slow' | 'double' | 'magnet' | 'drop'
  | 'speedArrow'  // 新增：速度箭头
  | 'shield'      // 新增：护盾

// 新增护盾状态
export interface SnakeState {
  // ... 现有字段
  shieldActive: boolean        // 新增：护盾是否激活
}
```

**文件**: `src/game/games/SnakeGame/core/GameWorld.ts`

```typescript
// 扩展食物效果处理
private applyFoodEffect(snake: SnakeEntity, food: Food) {
  switch (food.type) {
    // ... 现有 case

    case 'speedArrow':
      // 2秒加速，不消耗长度
      snake.applyBuff('speedBoost', 1.5, 2000)
      this.events.push({ type: 'eat', data: { snakeId: snake.state.id, foodId: food.id } })
      break

    case 'shield':
      // 激活护盾（单次免疫）
      snake.state.shieldActive = true
      this.events.push({ type: 'eat', data: { snakeId: snake.state.id, foodId: food.id } })
      break
  }
}

// 修改碰撞检测，支持护盾
private checkSnakeCollision(snake: SnakeEntity) {
  // ... 现有碰撞检测逻辑

  if (collision) {
    if (snake.state.shieldActive) {
      // 护盾抵消一次碰撞
      snake.state.shieldActive = false
      this.events.push({ type: 'shieldBreak', data: { snakeId: snake.state.id } })
      // 不执行死亡
    } else {
      this.killSnake(snake, killer)
    }
  }
}

// 道具生成（低概率）
private spawnPowerUp() {
  const rand = Math.random()
  let type: FoodType
  if (rand < 0.02) {
    type = 'speedArrow'  // 2% 概率
  } else if (rand < 0.04) {
    type = 'shield'      // 2% 概率
  } else if (rand < 0.06) {
    type = 'magnet'      // 2% 概率
  } else {
    return // 不生成道具
  }
  // 生成道具...
}
```

### 道具视觉反馈

**文件**: `src/game/games/SnakeGame/SnakeScene.ts`

```typescript
// 护盾激活视觉
private renderShieldEffect(snake: SnakeEntity, graphics: SnakeGraphics) {
  if (!snake.state.shieldActive) return

  // 在蛇头周围绘制半透明气泡
  if (!graphics.shieldBubble) {
    graphics.shieldBubble = this.add.circle(0, 0, 25, 0x00ffff, 0.3)
    graphics.shieldBubble.setStrokeStyle(2, 0x00ffff)
  }
  graphics.shieldBubble.setPosition(snake.head.x, snake.head.y)
  graphics.shieldBubble.setVisible(true)
}

// 护盾破碎特效
private playShieldBreakEffect(snake: SnakeEntity) {
  const particles = this.add.particles(snake.head.x, snake.head.y, 'particle', {
    speed: { min: 50, max: 150 },
    scale: { start: 0.8, end: 0 },
    lifespan: 400,
    tint: 0x00ffff,
    quantity: 15
  })
  this.time.delayedCall(400, () => particles.destroy())
  this.sound.play('shieldBreak', { volume: 0.4 })
}

// 速度箭头激活视觉
private renderSpeedBoostEffect(snake: SnakeEntity) {
  if (!snake.hasSpeedBoost) return

  // 添加速度线拖尾
  this.addSpeedTrail(snake, 0xffff00)
}
```

### 道具 UI 提示（非按钮式）

```typescript
// 当前激活的道具状态显示（屏幕角落小图标）
const ActiveBuffIndicator: React.FC<{ buffs: ActiveBuff[] }> = ({ buffs }) => {
  return (
    <div className="fixed left-4 top-20 flex flex-col gap-1">
      {buffs.map(buff => (
        <div key={buff.type} className="flex items-center gap-2 bg-black/50 rounded px-2 py-1">
          <span className="text-lg">{BUFF_ICONS[buff.type]}</span>
          <div className="w-12 h-1 bg-gray-600 rounded overflow-hidden">
            <div
              className="h-full bg-yellow-400 transition-all"
              style={{ width: `${buff.remainingPercent}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

const BUFF_ICONS: Record<string, string> = {
  speedBoost: '⚡',
  magnet: '🧲',
  shield: '🛡️'
}
```

---

## Phase C：主动能力系统（P2 - 延迟实施）

> ⚠️ **警告**：以下内容需在 Phase A/B 验证成功后再考虑实施。
>
> **验证指标**：
> - 平均存活时间不显著下降
> - 新手首局时长 > 60 秒
> - 道具使用率 30-50%
> - 进化达成率：阶段 2 > 60%，阶段 3 > 30%

### 能力设计（严格约束版）

| 能力 | 效果 | 持续时间 | 冷却 | 代价 | 约束 |
|------|------|----------|------|------|------|
| 闪避 | 免疫一次碰撞 | 0.5s | 15s | 10% 长度 | 仅免疫一次，明显视觉提示 |
| 能量球 | 命中减速 50% | 0.5s | 20s | 5 节 | 不造成死亡，仅减速 |

### 架构预留（不实施）

```typescript
// 类型定义预留（Phase C 时启用）
export type AbilityType = 'dodge' | 'energyBall'

export interface AbilityConfig {
  type: AbilityType
  duration: number
  cooldown: number
  lengthCost: number | ((length: number) => number)  // 支持百分比
}

// 能力配置（Phase C 时启用）
const ABILITY_CONFIG: Record<AbilityType, AbilityConfig> = {
  dodge: {
    type: 'dodge',
    duration: 500,      // 0.5秒
    cooldown: 15000,    // 15秒
    lengthCost: (length) => Math.floor(length * 0.1)  // 10% 长度
  },
  energyBall: {
    type: 'energyBall',
    duration: 500,      // 减速持续0.5秒
    cooldown: 20000,    // 20秒
    lengthCost: 5       // 固定5节
  }
}
```

---

## 关键文件

| 文件 | 操作 | 阶段 | 说明 |
|------|------|------|------|
| `src/game/games/SnakeGame/core/SnakeEntity.ts` | 修改 | P0 | 修复加速 bug + 进化检测 + 被动增益 |
| `src/game/games/SnakeGame/core/types.ts` | 修改 | P0 | 新增 EvolutionStage, PassiveBuffs, shieldActive |
| `src/game/games/SnakeGame/core/GameWorld.ts` | 修改 | P1 | 道具效果 + 护盾碰撞豁免 |
| `src/game/games/SnakeGame/SnakeScene.ts` | 修改 | P0/P1 | 进化特效 + 道具视觉 |
| `src/game/games/SnakeGame/config/skins.ts` | 修改 | P0 | 扩展 SkinConfig 支持进化视觉 |
| `src/components/snake/EvolutionNotification.tsx` | 新建 | P0 | 进化通知组件 |
| `src/store/gameStore.ts` | 修改 | P0/P1 | 进化状态 + 道具状态管理 |

---

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 被动增益破坏平衡 | 长度≠实力 | 严格限制 5-10%，可配置调整 |
| 护盾破坏核心规则 | 玩家困惑 | 单次免疫 + 明显视觉提示 + 低概率获取 |
| 进化视觉不明显 | 反馈不足 | 粒子特效 + 闪光 + 音效 |
| 新手不理解机制 | 流失 | 首次进化引导 + 简洁描述 |
| 道具过于强力 | 公平性下降 | 低生成概率 + 短持续时间 |

---

## 测试策略

### Phase A 测试
- 进化阶段触发条件（长度 10/25/50/100）
- 被动增益数值准确性（5-10% 范围）
- 进化视觉效果正确渲染
- 首次进化引导显示

### Phase B 测试
- 道具拾取效果正确应用
- 护盾单次免疫逻辑
- 速度箭头不消耗长度
- 磁铁效果与现有实现一致
- 道具生成概率符合配置

### 验证指标监控
- 平均存活时间
- 新手首局时长
- 各阶段进化达成率
- 道具使用率

---

## SESSION_ID（供 /ccg:execute 使用）

- **CODEX_SESSION**: `019c0552-731b-7fb3-a705-d86e7e289fdb`
- **GEMINI_SESSION**: `2b5c495a-ec81-435a-a3ee-67e4b5b3648f`

---

## 实施优先级

1. ✅ **P0 - Bug 修复**: SnakeEntity.ts（修复加速长度消耗 bug）
2. ✅ **P0 - Phase A 核心**: types.ts + SnakeEntity.ts（进化检测 + 被动增益）
3. ✅ **P0 - Phase A 视觉**: SnakeScene.ts + skins.ts（进化特效 + 外观变化）
4. ✅ **P0 - Phase A 引导**: EvolutionNotification.tsx（首次进化通知）
5. ✅ **P1 - Phase B 道具**: GameWorld.ts + types.ts（速度箭头 + 护盾）
6. ✅ **P1 - Phase B 视觉**: SnakeScene.ts（道具特效 + 状态指示）
7. ⏸️ **P2 - Phase C**: 延迟至验证指标达标后实施

---

## 实施完成记录

### 2026-02-01 完成项

- ✅ 创建 `EvolutionNotification.tsx` - 进化通知组件
- ✅ 创建 `ActiveBuffIndicator.tsx` - 激活道具状态指示器
- ✅ 更新 `types.ts` - 添加 `ActiveBuff`, `PlayerStats` 类型和 `onEvolution` 回调
- ✅ 更新 `GameWorld.ts` - 发送完整玩家状态（含 activeBuffs）和进化回调
- ✅ 更新 `SnakeScene.ts` - 添加速度加成视觉效果
- ✅ 更新 `SnakeEntity.ts` - 添加 `hasSpeedBuff` getter
- ✅ 更新 `SnakeGamePage.tsx` - 集成新组件和状态管理
