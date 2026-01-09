import { create } from 'zustand'

interface UIState {
  isFullscreen: boolean
  isLandscape: boolean
  showToolbar: boolean
  setFullscreen: (value: boolean) => void
  setLandscape: (value: boolean) => void
  setShowToolbar: (value: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  isFullscreen: false,
  isLandscape: window.innerWidth > window.innerHeight,
  showToolbar: true,
  setFullscreen: (value) => set({ isFullscreen: value }),
  setLandscape: (value) => set({ isLandscape: value }),
  setShowToolbar: (value) => set({ showToolbar: value }),
}))
