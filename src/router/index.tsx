import { createBrowserRouter } from 'react-router-dom'
import HomePage from '../pages/HomePage'
import GameDetailPage from '../pages/GameDetailPage'
import GamePlayPage from '../pages/GamePlayPage'

export const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/game/:id', element: <GameDetailPage /> },
  { path: '/play/:id', element: <GamePlayPage /> },
])
