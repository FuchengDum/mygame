// 空间哈希网格 - 用于高效碰撞检测

import type { Point } from './types'

export class SpatialHash<T extends { x: number; y: number }> {
  private cellSize: number
  private cells: Map<string, T[]> = new Map()

  constructor(cellSize: number = 60) {
    this.cellSize = cellSize
  }

  private getKey(x: number, y: number): string {
    const cx = Math.floor(x / this.cellSize)
    const cy = Math.floor(y / this.cellSize)
    return `${cx},${cy}`
  }

  clear() {
    this.cells.clear()
  }

  insert(item: T) {
    const key = this.getKey(item.x, item.y)
    if (!this.cells.has(key)) {
      this.cells.set(key, [])
    }
    this.cells.get(key)!.push(item)
  }

  remove(item: T) {
    const key = this.getKey(item.x, item.y)
    const cell = this.cells.get(key)
    if (cell) {
      const idx = cell.indexOf(item)
      if (idx !== -1) {
        cell.splice(idx, 1)
      }
    }
  }

  // 批量插入
  insertAll(items: T[]) {
    for (const item of items) {
      this.insert(item)
    }
  }

  // 查询点附近的所有对象
  queryNear(x: number, y: number, radius: number): T[] {
    const results: T[] = []
    const cellRadius = Math.ceil(radius / this.cellSize)
    const cx = Math.floor(x / this.cellSize)
    const cy = Math.floor(y / this.cellSize)

    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      for (let dy = -cellRadius; dy <= cellRadius; dy++) {
        const key = `${cx + dx},${cy + dy}`
        const cell = this.cells.get(key)
        if (cell) {
          for (const item of cell) {
            const dist = Math.hypot(item.x - x, item.y - y)
            if (dist <= radius) {
              results.push(item)
            }
          }
        }
      }
    }
    return results
  }

  // 查询点附近的所有对象（不检查距离，只返回邻近cell的对象）
  queryNearCells(x: number, y: number): T[] {
    const results: T[] = []
    const cx = Math.floor(x / this.cellSize)
    const cy = Math.floor(y / this.cellSize)

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const key = `${cx + dx},${cy + dy}`
        const cell = this.cells.get(key)
        if (cell) {
          results.push(...cell)
        }
      }
    }
    return results
  }
}

// 距离计算工具
export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function distanceSq(a: Point, b: Point): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}
