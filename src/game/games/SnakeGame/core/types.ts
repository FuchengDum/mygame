// 贪吃蛇大作战 - 核心类型定义

export const WORLD_WIDTH = 4000 as const
export const WORLD_HEIGHT = 3000
export const GRID_SIZE = 20

export interface PassiveBuffs {
  turnSpeedMultiplier: number
  boostEfficiency: number
  baseSpeedMultiplier: number
}

export interface EvolutionStage {
  stage: number
  minLength: number
  passiveBuffs: PassiveBuffs
}

// 蛇的状态
export interface SnakeState {
  id: string
  name: string
  isPlayer: boolean
  segments: Point[]
  direction: number
  targetDirection: number
  speed: number
  length: number
  kills: number
  skinId: string
  alive: boolean
  invincibleUntil: number
  isBoosting: boolean
  evolutionStage: number
  shieldActive: boolean
  shieldUntil: number
}

export interface Point {
  x: number
  y: number
}

// 食物类型
export type FoodType =
  | 'pellet'
  | 'big'
  | 'speed'
  | 'slow'
  | 'double'
  | 'magnet'
  | 'drop'
  | 'speedArrow'
  | 'shield'

export interface Food {
  id: string
  type: FoodType
  x: number
  y: number
  radius: number
  value: number
  growth: number
}

// 游戏事件
export type GameEventType = 'kill' | 'death' | 'eat' | 'boost' | 'spawn' | 'evolve' | 'shieldBreak'

export interface GameEvent {
  type: GameEventType
  data: {
    snakeId?: string
    victimId?: string
    killerId?: string
    foodId?: string
    position?: Point
    stage?: number
  }
}

// 排行榜条目
export interface LeaderboardEntry {
  id: string
  name: string
  length: number
  kills: number
  rank: number
}

// 游戏配置
export interface GameConfig {
  skinId: string
  nickname: string
  aiCount: number
  difficulty: 'easy' | 'medium' | 'hard'
}

// 游戏结果
export interface GameResult {
  length: number
  kills: number
  survivalTime: number
  bestRank: number
}

// 回调接口
export interface GameCallbacks {
  onLeaderboardUpdate?: (data: LeaderboardEntry[]) => void
  onStatsUpdate?: (stats: { length: number; kills: number; canBoost: boolean }) => void
  onGameOver?: (result: GameResult) => void
  onKill?: (victimName: string) => void
}
