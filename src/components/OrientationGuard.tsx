import { useOrientation } from '../hooks/useOrientation'

export default function OrientationGuard({ children }: { children: React.ReactNode }) {
  const isLandscape = useOrientation()

  if (!isLandscape) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-dark-bg text-center p-8">
        <div className="text-6xl mb-4">📱</div>
        <p className="text-xl mb-2">请旋转设备</p>
        <p className="text-gray-500">横屏模式获得最佳游戏体验</p>
      </div>
    )
  }

  return <>{children}</>
}
