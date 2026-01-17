import { usePWAInstall } from '../hooks/usePWAInstall'

export default function PWAInstallPrompt() {
  const { showPrompt, isInstalled, install, dismiss, isIOS } = usePWAInstall()

  if (!showPrompt || isInstalled) return null

  return (
    <div className="fixed bottom-0 left-4 right-4 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-lg p-4 pb-safe shadow-lg z-50 animate-slide-up">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <h3 className="font-bold text-white mb-1">安装游戏</h3>
          {isIOS ? (
            <p className="text-sm text-white/90">点击分享 → 添加到主屏幕</p>
          ) : (
            <p className="text-sm text-white/90">添加到主屏幕，随时随地玩游戏</p>
          )}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {!isIOS && (
            <button
              onClick={install}
              className="px-4 py-2 bg-white text-cyan-600 font-bold rounded-lg hover:bg-gray-100 transition-colors"
            >
              安装
            </button>
          )}
          <button
            onClick={dismiss}
            className="px-4 py-2 bg-white/20 text-white font-bold rounded-lg hover:bg-white/30 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
