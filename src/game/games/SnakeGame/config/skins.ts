// 皮肤配置

export interface SkinConfig {
  id: string
  name: string
  headColor: number
  bodyColors: number[]  // 渐变色
  strokeColor: number
}

export const SKINS: SkinConfig[] = [
  {
    id: 'cyan',
    name: '青蓝',
    headColor: 0x00f5ff,
    bodyColors: [0x00f5ff, 0x00bfff, 0x0080ff],
    strokeColor: 0xffffff
  },
  {
    id: 'purple',
    name: '紫霞',
    headColor: 0xbf00ff,
    bodyColors: [0xbf00ff, 0x8000ff, 0x4000ff],
    strokeColor: 0xffffff
  },
  {
    id: 'green',
    name: '翠绿',
    headColor: 0x00ff88,
    bodyColors: [0x00ff88, 0x00cc66, 0x009944],
    strokeColor: 0xffffff
  },
  {
    id: 'orange',
    name: '烈焰',
    headColor: 0xff8800,
    bodyColors: [0xff8800, 0xff4400, 0xff0000],
    strokeColor: 0xffffff
  },
  {
    id: 'pink',
    name: '粉樱',
    headColor: 0xff69b4,
    bodyColors: [0xff69b4, 0xff1493, 0xdc143c],
    strokeColor: 0xffffff
  },
  {
    id: 'gold',
    name: '金龙',
    headColor: 0xffd700,
    bodyColors: [0xffd700, 0xffa500, 0xff8c00],
    strokeColor: 0xffffff
  }
]

export const DEFAULT_SKIN_ID = 'cyan'

export function getSkinById(id: string): SkinConfig {
  return SKINS.find(s => s.id === id) || SKINS[0]
}
