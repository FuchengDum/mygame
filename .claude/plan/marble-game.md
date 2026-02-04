# 📋 实施计划：打玻璃珠（弹珠）小游戏

## 任务类型
- [x] 前端 (→ Gemini)
- [x] 后端 (→ Codex)
- [x] 全栈 (→ 并行)

---

## 需求概述

创建一个打玻璃珠（弹珠）小游戏，灵感来源于中国农村传统的打玻璃珠游戏。

### 核心玩法
- 双方轮流用自己的弹珠击打对方的弹珠
- **胜负条件**：收集对方所有弹珠获胜
- **初始弹珠**：每方 5 颗弹珠
- **计分规则**：
  - 击中对方弹珠：己方得分（收集该弹珠）
  - 弹珠出界：对方得分（失去该弹珠）
- 需要瞄准和控制力度
- 地面有摩擦力，弹珠会滚动减速

### 游戏模式
- **练习模式**：无对手，自由练习
- **AI 对战**：与 AI 对战（简单/中等/困难）
- **双人本地对战**：两人轮流在同一设备上对战
- **联网对战**：通过网络与其他玩家实时对战

### 目标平台
- 手机浏览器（Safari、Chrome、微信内置浏览器）
- 触摸屏虚拟控制器

---

## 技术方案

### 技术选型
| 类别 | 选型 | 理由 |
|------|------|------|
| 物理引擎 | Arcade Physics | 与现有配置兼容，实现快，性能好 |
| 控制方式 | Joystick + 蓄力条 | 复用现有 Joystick 组件，直观易用 |
| 架构模式 | 参照 SnakeGame | 复用 PhaserGame.tsx、createGameConfig 模式 |
| 视觉风格 | 深色背景 + 霓虹渐变 | 与现有游戏风格统一 |
| **联网方案** | **Supabase Realtime** | 免费额度宽松（2M消息/月），接入简单，适合回合制 |

### 联网对战技术方案

#### 方案对比分析

| 方案 | 优点 | 缺点 | 推荐度 |
|------|------|------|--------|
| **Supabase Realtime** | 免费2M消息/月+200峰值连接；前端SDK完整；接入快 | 免费项目1周不活跃会暂停 | ⭐⭐⭐⭐⭐ |
| Firebase Realtime | 成熟稳定；文档丰富 | 免费档仅100并发连接 | ⭐⭐⭐⭐ |
| WebRTC P2P | 延迟低；无服务器成本 | 需信令服务器；移动端可靠性差 | ⭐⭐ |
| 自建 WebSocket | 完全可控；可扩展 | 需部署后端；运维成本 | ⭐⭐⭐ |

#### 推荐方案：Supabase Realtime

**理由**：
- 回合制游戏对延迟要求不高，Supabase 完全满足
- 免费额度足够 MVP 阶段使用
- 纯前端接入，无需部署后端
- 内置房间（Channel）概念，适合游戏场景

**数据同步模型**：
```typescript
// 房间状态
interface RoomState {
  roomId: string
  hostId: string
  guestId: string | null
  status: 'waiting' | 'playing' | 'finished'
  gameState: GameState
}

// 游戏状态（每回合同步）
interface GameState {
  currentTurn: 'host' | 'guest'
  hostMarbles: MarbleState[]
  guestMarbles: MarbleState[]
  turnNumber: number
  lastAction: ShotAction | null
}

// 发射动作
interface ShotAction {
  playerId: string
  marbleId: string
  direction: { x: number, y: number }
  power: number
  timestamp: number
}
```

### 物理参数设计
```typescript
const PHYSICS_CONFIG = {
  gravity: { x: 0, y: 0 },        // 俯视角度，无重力
  bounce: 0.8,                     // 弹性系数
  drag: 100,                       // 摩擦阻力
  maxSpeed: 800,                   // 最大速度
  minStopSpeed: 5,                 // 停止判定阈值
  marbleRadius: 20,                // 弹珠半径
}
```

### 数据流设计
```
Joystick 输入 → InputController → PhysicsController.applyShot()
    ↓
Arcade Physics 碰撞检测 → CollisionResolver
    ↓
TurnResolver 检测停止 → TurnManager 切换回合
    ↓
React HUD 更新 → Zustand 持久化进度
```

---

## 实施步骤

### 阶段 1：基础架构搭建

#### 步骤 1.1：创建游戏场景文件结构
- **目标**：建立 MarbleGame 的文件结构
- **涉及文件**：
  | 文件 | 操作 | 说明 |
  |------|------|------|
  | `src/game/games/MarbleGame/MarbleScene.ts` | 新建 | 主游戏场景 |
  | `src/game/games/MarbleGame/core/types.ts` | 新建 | 类型定义 |
  | `src/game/games/MarbleGame/core/constants.ts` | 新建 | 游戏常量 |
- **验收标准**：文件结构创建完成，无 TypeScript 编译错误

#### 步骤 1.2：实现基础场景
- **目标**：创建可运行的空白游戏场景
- **涉及文件**：
  | 文件 | 操作 | 说明 |
  |------|------|------|
  | `src/game/games/MarbleGame/MarbleScene.ts` | 修改 | 实现 create/update |
- **关键逻辑**：
  ```typescript
  class MarbleScene extends Phaser.Scene {
    create() {
      // 设置物理世界（无重力）
      this.physics.world.setBounds(0, 0, ARENA_WIDTH, ARENA_HEIGHT)
      // 创建背景和边界
      this.createBackground()
      this.createBorder()
    }
  }
  ```
- **验收标准**：场景可加载，显示背景和边界

---

### 阶段 2：核心游戏逻辑

#### 步骤 2.1：实现弹珠实体
- **目标**：创建弹珠的物理实体和渲染
- **涉及文件**：
  | 文件 | 操作 | 说明 |
  |------|------|------|
  | `src/game/games/MarbleGame/core/MarbleEntity.ts` | 新建 | 弹珠实体类 |
- **关键逻辑**：
  ```typescript
  class MarbleEntity {
    sprite: Phaser.Physics.Arcade.Sprite
    owner: 'player' | 'ai'

    constructor(scene, x, y, owner) {
      this.sprite = scene.physics.add.sprite(x, y, 'marble')
      this.sprite.setCircle(MARBLE_RADIUS)
      this.sprite.setBounce(BOUNCE)
      this.sprite.setDrag(DRAG)
      this.sprite.setMaxVelocity(MAX_SPEED)
    }

    get isStopped(): boolean {
      return this.sprite.body.speed < MIN_STOP_SPEED
    }

    applyForce(direction: Vector2, power: number) {
      const velocity = direction.scale(power)
      this.sprite.setVelocity(velocity.x, velocity.y)
    }
  }
  ```
- **验收标准**：弹珠可创建，具有正确的物理属性

#### 步骤 2.2：实现回合管理器
- **目标**：管理玩家回合切换（支持 AI 对战和双人本地对战）
- **涉及文件**：
  | 文件 | 操作 | 说明 |
  |------|------|------|
  | `src/game/games/MarbleGame/core/TurnManager.ts` | 新建 | 回合管理 |
- **关键逻辑**：
  ```typescript
  type GameMode = 'practice' | 'ai' | 'local-pvp'
  type Player = 'player1' | 'player2' | 'ai'
  enum TurnState { Idle, Aiming, Charging, Launched, Resolving, GameOver }

  class TurnManager {
    gameMode: GameMode = 'ai'
    currentTurn: Player = 'player1'
    state: TurnState = TurnState.Idle
    player1Marbles: number = 5  // 初始 5 颗
    player2Marbles: number = 5  // AI 或玩家2

    startTurn(who: Player) {
      this.currentTurn = who
      this.state = TurnState.Aiming
      this.emit('turnStart', who)
    }

    onShotFired() {
      this.state = TurnState.Launched
    }

    onAllStopped() {
      this.state = TurnState.Resolving
      // 检查胜负条件
      if (this.checkGameOver()) {
        this.state = TurnState.GameOver
        return
      }
      this.nextTurn()
    }

    // 击中对方弹珠：收集该弹珠
    onHit(attacker: Player, target: Player) {
      if (target === 'player1') this.player1Marbles--
      else this.player2Marbles--
      this.emit('marbleCaptured', { attacker, target })
    }

    // 弹珠出界：失去该弹珠
    onOutOfBounds(owner: Player) {
      if (owner === 'player1') this.player1Marbles--
      else this.player2Marbles--
      this.emit('marbleLost', { owner })
    }

    checkGameOver(): boolean {
      if (this.player1Marbles <= 0) {
        this.emit('gameOver', { winner: this.gameMode === 'ai' ? 'ai' : 'player2' })
        return true
      }
      if (this.player2Marbles <= 0) {
        this.emit('gameOver', { winner: 'player1' })
        return true
      }
      return false
    }

    nextTurn() {
      if (this.gameMode === 'practice') {
        this.startTurn('player1')
      } else {
        const next = this.currentTurn === 'player1'
          ? (this.gameMode === 'ai' ? 'ai' : 'player2')
          : 'player1'
        this.startTurn(next)
      }
    }
  }
  ```
- **验收标准**：回合正确切换，支持三种游戏模式，胜负判定正确

#### 步骤 2.3：实现碰撞与出界检测
- **目标**：检测弹珠碰撞和出界，触发得分逻辑
- **涉及文件**：
  | 文件 | 操作 | 说明 |
  |------|------|------|
  | `src/game/games/MarbleGame/core/CollisionResolver.ts` | 新建 | 碰撞处理 |
  | `src/game/games/MarbleGame/core/BoundsChecker.ts` | 新建 | 出界检测 |
- **关键逻辑**：
  ```typescript
  class CollisionResolver {
    private hitRecords: Set<string> = new Set() // 防止同帧重复计分

    setup(scene: MarbleScene) {
      scene.physics.add.collider(
        player1Marbles,
        player2Marbles,
        this.onMarbleCollide.bind(this)
      )
    }

    onMarbleCollide(a: MarbleEntity, b: MarbleEntity) {
      const key = `${a.id}-${b.id}`
      if (this.hitRecords.has(key)) return
      this.hitRecords.add(key)

      // 击中对方弹珠 = 收集该弹珠
      // 判断谁是攻击方（当前回合的玩家）
      const attacker = this.turnManager.currentTurn
      const target = a.owner === attacker ? b : a

      this.emit('hit', { attacker, target: target.owner, marble: target })
    }

    resetHitRecords() {
      this.hitRecords.clear()
    }
  }

  class BoundsChecker {
    check(marbles: MarbleEntity[]) {
      for (const marble of marbles) {
        if (this.isOutOfBounds(marble)) {
          this.emit('outOfBounds', { owner: marble.owner, marble })
          marble.disable() // 移除出界弹珠
        }
      }
    }

    isOutOfBounds(marble: MarbleEntity): boolean {
      const { x, y } = marble.position
      return x < 0 || x > ARENA_WIDTH || y < 0 || y > ARENA_HEIGHT
    }
  }
  ```
- **验收标准**：
  - 击中对方弹珠正确触发收集逻辑
  - 弹珠出界正确触发失去逻辑
  - 不重复计分

---

### 阶段 3：输入控制

#### 步骤 3.1：实现瞄准和蓄力控制
- **目标**：使用 Joystick 控制瞄准方向，蓄力条控制力度
- **涉及文件**：
  | 文件 | 操作 | 说明 |
  |------|------|------|
  | `src/game/games/MarbleGame/input/InputController.ts` | 新建 | 输入控制器 |
  | `src/components/marble/ChargeBar.tsx` | 新建 | 蓄力条组件 |
- **关键逻辑**：
  ```typescript
  class InputController {
    direction: Vector2 = new Vector2(1, 0)
    chargePower: number = 0
    isCharging: boolean = false

    onJoystickMove(angle: number) {
      this.direction = new Vector2(Math.cos(angle), Math.sin(angle))
    }

    startCharge() {
      this.isCharging = true
      this.chargePower = 0
    }

    updateCharge(delta: number) {
      if (this.isCharging) {
        this.chargePower = Math.min(1, this.chargePower + delta * CHARGE_RATE)
      }
    }

    releaseCharge(): { direction: Vector2, power: number } {
      this.isCharging = false
      const power = lerp(MIN_POWER, MAX_POWER, this.chargePower)
      return { direction: this.direction, power }
    }
  }
  ```
- **UI/UX 设计要点**：
  - 瞄准线：从弹珠中心延伸，显示发射方向
  - 蓄力条：底部显示，填充动画表示力度
  - 触觉反馈：蓄力时轻微震动（如支持）
- **验收标准**：可瞄准、蓄力、发射，视觉反馈清晰

---

### 阶段 4：AI 对手

#### 步骤 4.1：实现简单 AI
- **目标**：AI 能够自动瞄准并发射
- **涉及文件**：
  | 文件 | 操作 | 说明 |
  |------|------|------|
  | `src/game/games/MarbleGame/ai/SimpleAI.ts` | 新建 | AI 控制器 |
- **关键逻辑**：
  ```typescript
  class SimpleAI {
    calculateShot(aiMarble: MarbleEntity, targets: MarbleEntity[]): Shot {
      // 选择最近的目标
      const target = this.findNearestTarget(aiMarble, targets)

      // 计算瞄准方向（加入随机偏差模拟人类）
      const direction = target.position.subtract(aiMarble.position).normalize()
      const noise = (Math.random() - 0.5) * ACCURACY_NOISE
      direction.rotate(noise)

      // 根据距离计算力度
      const distance = aiMarble.position.distance(target.position)
      const power = this.calculatePower(distance)

      return { direction, power }
    }
  }
  ```
- **验收标准**：AI 能合理瞄准并发射，有一定随机性

---

### 阶段 5：UI 界面

#### 步骤 5.1：创建游戏页面
- **目标**：创建 MarbleGamePage，集成 Phaser 和 React UI
- **涉及文件**：
  | 文件 | 操作 | 说明 |
  |------|------|------|
  | `src/pages/MarbleGamePage.tsx` | 新建 | 游戏页面 |
- **UI/UX 设计要点**：
  - 参照 `SnakeGamePage.tsx` 的布局模式
  - 顶部：回合指示器、分数显示
  - 底部：Joystick（左）+ 蓄力按钮（右）
  - 游戏结束：结果弹窗
- **验收标准**：页面可访问，UI 布局正确

#### 步骤 5.2：实现 HUD 组件
- **目标**：显示游戏状态信息
- **涉及文件**：
  | 文件 | 操作 | 说明 |
  |------|------|------|
  | `src/components/marble/TurnIndicator.tsx` | 新建 | 回合指示器 |
  | `src/components/marble/ScoreBoard.tsx` | 新建 | 分数面板 |
  | `src/components/marble/ResultModal.tsx` | 新建 | 结果弹窗 |
- **视觉设计**：
  - 霓虹渐变文字（与贪吃蛇风格统一）
  - 回合切换动画
  - 得分动画（数字跳动）
- **验收标准**：HUD 正确显示，动画流畅

#### 步骤 5.3：实现游戏大厅
- **目标**：游戏开始前的模式选择界面
- **涉及文件**：
  | 文件 | 操作 | 说明 |
  |------|------|------|
  | `src/components/marble/LobbyUI.tsx` | 新建 | 大厅界面 |
- **游戏模式**：
  - **练习模式**：无对手，自由练习瞄准和力度
  - **AI 对战**：与 AI 对战
    - 难度选择：简单/中等/困难
  - **双人本地对战**：两人轮流在同一设备上对战
- **UI 设计**：
  ```
  ┌─────────────────────────────┐
  │      🎱 打玻璃珠            │
  │                             │
  │   ┌─────────────────────┐   │
  │   │   🎯 练习模式       │   │
  │   └─────────────────────┘   │
  │                             │
  │   ┌─────────────────────┐   │
  │   │   🤖 AI 对战        │   │
  │   │   [简单][中等][困难] │   │
  │   └─────────────────────┘   │
  │                             │
  │   ┌─────────────────────┐   │
  │   │   👥 双人对战       │   │
  │   └─────────────────────┘   │
  │                             │
  └─────────────────────────────┘
  ```
- **验收标准**：可选择三种模式并开始游戏

---

### 阶段 6：集成与完善

#### 步骤 6.1：注册游戏到平台
- **目标**：将弹珠游戏添加到游戏列表
- **涉及文件**：
  | 文件 | 操作 | 说明 |
  |------|------|------|
  | `public/data/games.json` | 修改 | 添加游戏条目 |
  | `src/App.tsx` | 修改 | 添加路由 |
- **验收标准**：游戏出现在首页列表，可正常进入

#### 步骤 6.2：视觉特效
- **目标**：添加游戏特效提升体验
- **涉及文件**：
  | 文件 | 操作 | 说明 |
  |------|------|------|
  | `src/game/games/MarbleGame/effects/` | 新建 | 特效模块 |
- **特效列表**：
  - 弹珠碰撞火花
  - 发射轨迹线
  - 得分数字飘动
  - 回合切换过渡
- **验收标准**：特效流畅，不影响性能

---

### 阶段 7：联网对战功能

#### 步骤 7.1：集成 Supabase
- **目标**：配置 Supabase 客户端，建立实时连接
- **涉及文件**：
  | 文件 | 操作 | 说明 |
  |------|------|------|
  | `src/lib/supabase.ts` | 新建 | Supabase 客户端配置 |
  | `src/services/realtimeService.ts` | 新建 | 实时通信服务 |
  | `.env` | 修改 | 添加 Supabase 配置 |
- **关键逻辑**：
  ```typescript
  // src/lib/supabase.ts
  import { createClient } from '@supabase/supabase-js'

  export const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  )

  // src/services/realtimeService.ts
  class RealtimeService {
    private channel: RealtimeChannel | null = null

    // 创建/加入房间
    async joinRoom(roomId: string, playerId: string) {
      this.channel = supabase.channel(`room:${roomId}`)

      this.channel
        .on('broadcast', { event: 'game_action' }, (payload) => {
          this.handleGameAction(payload)
        })
        .on('presence', { event: 'sync' }, () => {
          this.handlePresenceSync()
        })
        .subscribe()
    }

    // 发送游戏动作
    async sendAction(action: ShotAction) {
      await this.channel?.send({
        type: 'broadcast',
        event: 'game_action',
        payload: action
      })
    }

    // 离开房间
    async leaveRoom() {
      await this.channel?.unsubscribe()
      this.channel = null
    }
  }
  ```
- **验收标准**：Supabase 连接成功，可发送/接收消息

#### 步骤 7.2：实现房间系统
- **目标**：创建房间、加入房间、房间匹配
- **涉及文件**：
  | 文件 | 操作 | 说明 |
  |------|------|------|
  | `src/services/roomService.ts` | 新建 | 房间管理服务 |
  | `src/components/marble/OnlineLobby.tsx` | 新建 | 联网大厅界面 |
  | `src/components/marble/RoomWaiting.tsx` | 新建 | 等待界面 |
- **关键逻辑**：
  ```typescript
  class RoomService {
    // 生成 6 位房间码
    generateRoomCode(): string {
      return Math.random().toString(36).substring(2, 8).toUpperCase()
    }

    // 创建房间
    async createRoom(hostId: string): Promise<Room> {
      const roomCode = this.generateRoomCode()
      const room: Room = {
        id: roomCode,
        hostId,
        guestId: null,
        status: 'waiting',
        createdAt: Date.now()
      }
      // 存储到 Supabase（可选，用于房间列表）
      await supabase.from('rooms').insert(room)
      return room
    }

    // 加入房间
    async joinRoom(roomCode: string, guestId: string): Promise<Room | null> {
      const { data: room } = await supabase
        .from('rooms')
        .select()
        .eq('id', roomCode)
        .single()

      if (!room || room.status !== 'waiting') return null

      await supabase
        .from('rooms')
        .update({ guestId, status: 'playing' })
        .eq('id', roomCode)

      return { ...room, guestId, status: 'playing' }
    }
  }
  ```
- **UI 设计**：
  ```
  ┌─────────────────────────────┐
  │      🌐 联网对战            │
  │                             │
  │   ┌─────────────────────┐   │
  │   │   创建房间          │   │
  │   │   生成房间码等待    │   │
  │   └─────────────────────┘   │
  │                             │
  │   ┌─────────────────────┐   │
  │   │   加入房间          │   │
  │   │   [______] 输入房间码│   │
  │   │   [加入]            │   │
  │   └─────────────────────┘   │
  │                             │
  │   ┌─────────────────────┐   │
  │   │   快速匹配          │   │
  │   │   自动寻找对手      │   │
  │   └─────────────────────┘   │
  │                             │
  └─────────────────────────────┘
  ```
- **验收标准**：可创建房间、输入房间码加入、显示等待界面

#### 步骤 7.3：实现联网游戏同步
- **目标**：同步双方游戏状态，确保一致性
- **涉及文件**：
  | 文件 | 操作 | 说明 |
  |------|------|------|
  | `src/game/games/MarbleGame/network/NetworkSync.ts` | 新建 | 网络同步逻辑 |
  | `src/game/games/MarbleGame/core/TurnManager.ts` | 修改 | 支持联网模式 |
- **关键逻辑**：
  ```typescript
  class NetworkSync {
    private isHost: boolean
    private realtimeService: RealtimeService

    // 发送发射动作
    async sendShot(shot: ShotAction) {
      await this.realtimeService.sendAction({
        type: 'shot',
        ...shot
      })
    }

    // 接收对方动作
    onReceiveAction(action: GameAction) {
      if (action.type === 'shot') {
        // 在本地重放对方的发射
        this.scene.replayShot(action)
      }
    }

    // 同步回合结束状态
    async syncTurnEnd(result: TurnResult) {
      await this.realtimeService.sendAction({
        type: 'turn_end',
        result
      })
    }

    // 处理断线重连
    async handleReconnect() {
      // 请求当前游戏状态
      const state = await this.realtimeService.requestState()
      this.scene.restoreState(state)
    }
  }
  ```
- **同步策略**（回合制优化）：
  - 发射时：发送方向 + 力度，双方本地模拟物理
  - 回合结束：同步最终弹珠位置，校正偏差
  - 断线：保存游戏状态，支持重连恢复
- **验收标准**：双方游戏状态同步，回合正确切换

#### 步骤 7.4：实现联网 UI 组件
- **目标**：显示对手信息、网络状态、断线提示
- **涉及文件**：
  | 文件 | 操作 | 说明 |
  |------|------|------|
  | `src/components/marble/OpponentInfo.tsx` | 新建 | 对手信息显示 |
  | `src/components/marble/NetworkStatus.tsx` | 新建 | 网络状态指示 |
  | `src/components/marble/DisconnectModal.tsx` | 新建 | 断线提示弹窗 |
- **UI 设计要点**：
  - 对手信息：头像（可选）、昵称、弹珠数量
  - 网络状态：绿色/黄色/红色指示灯
  - 断线提示：倒计时重连 / 返回大厅选项
- **验收标准**：UI 正确显示，断线有明确提示

#### 步骤 7.5：实现快速匹配（可选）
- **目标**：自动匹配在线玩家
- **涉及文件**：
  | 文件 | 操作 | 说明 |
  |------|------|------|
  | `src/services/matchmakingService.ts` | 新建 | 匹配服务 |
- **关键逻辑**：
  ```typescript
  class MatchmakingService {
    // 加入匹配队列
    async joinQueue(playerId: string) {
      // 监听匹配频道
      const channel = supabase.channel('matchmaking')

      channel
        .on('presence', { event: 'sync' }, () => {
          const players = channel.presenceState()
          this.tryMatch(players, playerId)
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({ playerId, joinedAt: Date.now() })
          }
        })
    }

    // 尝试匹配
    private tryMatch(players: PresenceState, myId: string) {
      const waiting = Object.values(players)
        .flat()
        .filter(p => p.playerId !== myId)
        .sort((a, b) => a.joinedAt - b.joinedAt)

      if (waiting.length > 0) {
        // 与最早等待的玩家匹配
        this.createMatch(myId, waiting[0].playerId)
      }
    }
  }
  ```
- **验收标准**：可自动匹配到其他在线玩家

---

## 文件结构总览

```
src/
├── lib/
│   └── supabase.ts                     # Supabase 客户端配置
├── services/
│   ├── realtimeService.ts              # 实时通信服务
│   ├── roomService.ts                  # 房间管理服务
│   └── matchmakingService.ts           # 匹配服务
├── game/
│   └── games/
│       └── MarbleGame/
│           ├── MarbleScene.ts          # 主场景
│           ├── core/
│           │   ├── types.ts            # 类型定义
│           │   ├── constants.ts        # 游戏常量
│           │   ├── MarbleEntity.ts     # 弹珠实体
│           │   ├── TurnManager.ts      # 回合管理
│           │   ├── CollisionResolver.ts # 碰撞处理
│           │   └── BoundsChecker.ts    # 出界检测
│           ├── input/
│           │   └── InputController.ts  # 输入控制
│           ├── ai/
│           │   └── SimpleAI.ts         # AI 控制器
│           ├── network/
│           │   └── NetworkSync.ts      # 网络同步
│           └── effects/
│               └── ParticleEffects.ts  # 粒子特效
├── pages/
│   └── MarbleGamePage.tsx              # 游戏页面
└── components/
    └── marble/
        ├── ChargeBar.tsx               # 蓄力条
        ├── TurnIndicator.tsx           # 回合指示器
        ├── ScoreBoard.tsx              # 分数面板
        ├── ResultModal.tsx             # 结果弹窗
        ├── LobbyUI.tsx                 # 大厅界面
        ├── OnlineLobby.tsx             # 联网大厅
        ├── RoomWaiting.tsx             # 等待界面
        ├── OpponentInfo.tsx            # 对手信息
        ├── NetworkStatus.tsx           # 网络状态
        └── DisconnectModal.tsx         # 断线提示
```

---

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| Arcade Physics 碰撞不够真实 | 调整 bounce/drag 参数；必要时升级到 Matter.js |
| 触摸控制不够精准 | 增大触摸区域；添加辅助瞄准线 |
| AI 太强或太弱 | 通过难度参数调整 AI 精准度和力度 |
| 弹珠长时间微动不停止 | 设置速度阈值，低于阈值强制停止 |
| 回合超时卡死 | 添加回合超时机制，强制结束回合 |
| **联网延迟导致状态不同步** | 回合结束时同步最终位置，校正偏差 |
| **玩家断线** | 保存游戏状态，支持 30 秒内重连；超时判负 |
| **Supabase 免费额度用尽** | 监控使用量；预留升级到付费计划或自建后端的路径 |
| **作弊（修改发射参数）** | 回合制降低作弊影响；可选：服务端校验发射参数合理性 |

---

## SESSION_ID（供 /ccg:execute 使用）

- CODEX_SESSION: `019c1906-4797-75c1-898a-63aa356c3558`
- GEMINI_SESSION: `dcafa54a-0f5b-4467-bf03-14ca3ada9b92`

---

## 依赖安装

联网功能需要安装 Supabase 客户端：

```bash
npm install @supabase/supabase-js
```

## 环境变量配置

在 `.env` 文件中添加：

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Supabase 项目设置

1. 在 [supabase.com](https://supabase.com) 创建免费项目
2. 获取项目 URL 和 anon key
3. （可选）创建 `rooms` 表用于房间持久化：
   ```sql
   CREATE TABLE rooms (
     id TEXT PRIMARY KEY,
     host_id TEXT NOT NULL,
     guest_id TEXT,
     status TEXT DEFAULT 'waiting',
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```
