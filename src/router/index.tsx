import { createBrowserRouter } from 'react-router-dom'
import HomePage from '../pages/HomePage'
import GameDetailPage from '../pages/GameDetailPage'
import GamePlayPage from '../pages/GamePlayPage'
import SnakeGamePage from '../pages/SnakeGamePage'

export const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/game/:id', element: <GameDetailPage /> },
  { path: '/play/snake', element: <SnakeGamePage /> },
  { path: '/play/:id', element: <GamePlayPage /> },
])
