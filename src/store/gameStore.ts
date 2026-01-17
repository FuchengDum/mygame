import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Game } from '../types/game'

interface GameState {
  games: Game[]
  currentGame: Game | null
  searchQuery: string
  category: string
  setGames: (games: Game[]) => void
  setCurrentGame: (game: Game | null) => void
  setSearchQuery: (query: string) => void
  setCategory: (category: string) => void
  saveProgress: (gameId: string, data: unknown) => void
  getProgress: (gameId: string) => unknown
}

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      games: [],
      currentGame: null,
      searchQuery: '',
      category: 'all',
      setGames: (games) => set({ games }),
      setCurrentGame: (game) => set({ currentGame: game }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setCategory: (category) => set({ category }),
      saveProgress: (gameId, data) => {
        try {
          localStorage.setItem(`game_progress_${gameId}`, JSON.stringify(data))
        } catch {
          // 存储不可用，忽略
        }
      },
      getProgress: (gameId) => {
        try {
          const data = localStorage.getItem(`game_progress_${gameId}`)
          return data ? JSON.parse(data) : null
        } catch {
          return null
        }
      },
    }),
    { name: 'game-store', partialize: (state) => ({ category: state.category }) }
  )
)
