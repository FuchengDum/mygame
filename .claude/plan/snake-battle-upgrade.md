# 贪吃蛇大作战改造计划

## 确认的规则
- 架构：方案B（模拟层分离）
- 头碰头：长度大者胜
- 出生无敌：3秒
- 自撞惩罚：对战模式关闭

---

## 一、后端架构

### 1. 文件结构
```
src/game/games/SnakeGame/
├── SnakeScene.ts          # 改造：仅负责渲染和输入
├── core/
│   ├── GameWorld.ts       # 新增：游戏世界（纯逻辑）
│   ├── SnakeEntity.ts     # 新增：蛇实体基类
│   ├── SpatialHash.ts     # 新增：空间哈希碰撞检测
│   └── types.ts           # 新增：核心类型定义
├── ai/
│   └── AIController.ts    # 新增：AI行为控制
└── config/
    └── skins.ts           # 新增：皮肤配置
```

### 2. 核心类型
```typescript
interface SnakeState {
  id: string
  name: string
  isPlayer: boolean
  segments: { x: number; y: number }[]
  direction: number
  speed: number
  length: number
  kills: number
  skinId: string
  alive: boolean
  invincibleUntil: number
  isBoosting: boolean
}

interface GameEvent {
  type: 'kill' | 'death' | 'eat' | 'boost'
  data: any
}
```

### 3. 空间哈希碰撞
- cellSize = 60（碰撞半径2-3倍）
- 只对蛇头做精确碰撞检测
- 查询邻近 cell 的身体段

---

## 二、前端UI架构

### 1. 组件结构
| 组件 | 职责 | 阶段 |
|------|------|------|
| LobbyUI | 皮肤选择 + 昵称输入 | Ready |
| BattleHUD | 战斗中HUD容器 | Playing |
| Leaderboard | Top10排行榜 | Playing |
| BoostButton | 加速按钮 | Playing |
| ResultModal | 死亡结算弹窗 | GameOver |

### 2. 通信接口
**React → Phaser**:
- startGame(config)
- setBoostState(bool)
- setJoystickInput(angle, force)

**Phaser → React** (节流):
- onLeaderboardUpdate (1Hz)
- onBattleStatsUpdate (5Hz)
- onGameOver

### 3. 响应式适配
| 组件 | 竖屏 | 横屏 |
|------|------|------|
| 排行榜 | 顶部居中，仅前5 | 右上角，前10 |
| 摇杆 | 底部居中/靠左 | 底部靠左 |
| 加速按钮 | 底部靠右 | 底部靠右 |

---

## 三、实现计划

### 阶段1：基础架构（后端）
| 序号 | 任务 | 文件 |
|------|------|------|
| 1.1 | 核心类型定义 | core/types.ts |
| 1.2 | 皮肤配置 | config/skins.ts |
| 1.3 | 空间哈希实现 | core/SpatialHash.ts |
| 1.4 | SnakeEntity基类 | core/SnakeEntity.ts |
| 1.5 | GameWorld实现 | core/GameWorld.ts |

### 阶段2：对战机制（后端）
| 序号 | 任务 | 文件 |
|------|------|------|
| 2.1 | 碰撞检测（头撞身体） | GameWorld.ts |
| 2.2 | 死亡掉落食物 | GameWorld.ts |
| 2.3 | 加速冲刺 | SnakeEntity.ts |
| 2.4 | 出生无敌 | SnakeEntity.ts |

### 阶段3：AI系统（后端）
| 序号 | 任务 | 文件 |
|------|------|------|
| 3.1 | AI基础行为（觅食、避障） | ai/AIController.ts |
| 3.2 | AI难度分级 | ai/AIController.ts |

### 阶段4：渲染层改造（后端）
| 序号 | 任务 | 文件 |
|------|------|------|
| 4.1 | Scene改为纯渲染 | SnakeScene.ts |
| 4.2 | 多蛇渲染 | SnakeScene.ts |
| 4.3 | 击杀特效 | SnakeScene.ts |

### 阶段5：UI组件（前端）
| 序号 | 任务 | 文件 |
|------|------|------|
| 5.1 | 类型扩展 | types/game.ts |
| 5.2 | LobbyUI（皮肤选择） | components/snake/LobbyUI.tsx |
| 5.3 | Leaderboard | components/snake/Leaderboard.tsx |
| 5.4 | BoostButton | components/snake/BoostButton.tsx |
| 5.5 | ResultModal | components/snake/ResultModal.tsx |

### 阶段6：集成（前端）
| 序号 | 任务 | 文件 |
|------|------|------|
| 6.1 | 页面状态管理 | SnakeGamePage.tsx |
| 6.2 | 通信接口对接 | SnakeGamePage.tsx |
| 6.3 | 响应式适配 | SnakeGamePage.tsx |

---

## 四、依赖关系

```
阶段1 → 阶段2 → 阶段3
           ↓
        阶段4 → 阶段6
           ↑
        阶段5
```

阶段5（UI组件）可与阶段2-4并行开发（使用Mock数据）
