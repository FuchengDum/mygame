# 📋 实施计划：贪吃蛇视觉特效优化

## 任务类型
- [x] 前端 (→ Gemini)
- [x] 后端 (→ Codex)
- [x] 全栈 (→ 并行)

## 问题概述

| 问题 | 现状 | 影响 |
|------|------|------|
| 闪光特效 | `camera.flash()` 全屏闪光 | 遮蔽游戏信息，视觉刺激强烈 |
| 磁铁特效 | `PULL_RADIUS = 260px` 固定值 | 移动端超出屏幕，看不完全 |

## 技术方案

### 方案 1：闪光特效优化

**策略**：移除全屏 `camera.flash()`，改为局部扩散光圈

**原理**：
- 使用 `this.add.circle()` 在蛇头位置创建局部光圈
- 通过 Tween 动画实现扩散淡出效果
- 保留粒子特效作为主要视觉反馈

**伪代码**：
```typescript
private playEvolutionEffect(snake: SnakeEntity, stage: number) {
  const head = snake.head
  const color = colors[Math.min(stage - 1, colors.length - 1)]

  // 保留粒子效果（不变）
  const particles = this.add.particles(...)

  // 替换 camera.flash() 为局部光圈
  const glow = this.add.circle(head.x, head.y, 20, color, 0.5)
  glow.setDepth(1)

  this.tweens.add({
    targets: glow,
    radius: 150,
    alpha: 0,
    duration: 400,
    ease: 'Cubic.out',
    onComplete: () => glow.destroy()
  })
}
```

### 方案 2：磁铁特效优化

**策略**：将固定像素值改为视口相对值

**计算公式**：
```typescript
PULL_RADIUS = Math.min(260, Math.min(viewportWidth, viewportHeight) * 0.4)
```

**约束**：
- 最大值：260px（桌面端保持原有体验）
- 最小值：120px（确保特效可见）
- 比例：视口短边的 40%

**伪代码**：
```typescript
// 添加缓存变量
private magnetRadiusPx: number = 180

// 在 create() 和 resize 时更新
private updateViewportDerivedValues() {
  const vw = this.cameras.main.width
  const vh = this.cameras.main.height
  const base = Math.min(vw, vh)
  this.magnetRadiusPx = Phaser.Math.Clamp(base * 0.4, 120, 260)
}

private renderMagnetEffects() {
  const PULL_RADIUS = this.magnetRadiusPx
  // 使用响应式半径绘制圆环...
}
```

## 实施步骤

### 步骤 1：添加视口响应式配置
- **文件**：`src/game/games/SnakeGame/SnakeScene.ts`
- **操作**：添加 `magnetRadiusPx` 成员变量和 `updateViewportDerivedValues()` 方法
- **预期产物**：响应式半径计算逻辑

### 步骤 2：修改闪光特效
- **文件**：`src/game/games/SnakeGame/SnakeScene.ts:400-424`
- **操作**：移除 `camera.flash()` 调用，替换为局部光圈 + Tween
- **预期产物**：局部扩散光圈效果

### 步骤 3：修改磁铁特效
- **文件**：`src/game/games/SnakeGame/SnakeScene.ts:438-470`
- **操作**：将 `const PULL_RADIUS = 260` 改为 `const PULL_RADIUS = this.magnetRadiusPx`
- **预期产物**：响应式磁铁圆环

### 步骤 4：绑定 resize 事件
- **文件**：`src/game/games/SnakeGame/SnakeScene.ts`
- **操作**：在 `create()` 和 `handleResize()` 中调用 `updateViewportDerivedValues()`
- **预期产物**：窗口大小变化时自动更新半径

## 关键文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/game/games/SnakeGame/SnakeScene.ts:36-58` | 修改 | 添加 `magnetRadiusPx` 成员变量 |
| `src/game/games/SnakeGame/SnakeScene.ts:65-84` | 修改 | 在 `create()` 中初始化响应式配置 |
| `src/game/games/SnakeGame/SnakeScene.ts:105-125` | 修改 | 在 `handleResize()` 中更新配置 |
| `src/game/games/SnakeGame/SnakeScene.ts:400-424` | 修改 | 替换闪光特效为局部光圈 |
| `src/game/games/SnakeGame/SnakeScene.ts:438-470` | 修改 | 使用响应式半径 |

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| 局部光圈视觉反馈不够强烈 | 可调整光圈初始大小(20→30)和最终大小(150→180) |
| 磁铁半径变小影响游戏平衡 | 仅修改视觉效果，不改变实际吸引半径(260px) |
| Tween 动画性能问题 | 使用 `onComplete` 及时销毁，避免内存泄漏 |
| 极小屏幕(< 300px)显示异常 | 设置最小半径 120px 保底 |

## 验收标准

1. [ ] 进化时不再出现全屏闪光
2. [ ] 进化时蛇头位置出现扩散光圈效果
3. [ ] 移动端（360px 宽度）磁铁圆环完整显示在屏幕内
4. [ ] 桌面端磁铁圆环保持原有大小（260px）
5. [ ] 窗口大小变化时磁铁圆环自动调整

## SESSION_ID（供 /ccg:execute 使用）

- CODEX_SESSION: `019c1892-ca2b-70f1-bc47-d2e779183df9`
- GEMINI_SESSION: `cd075d39-932a-4eae-89ea-1dd929a50ad4`
