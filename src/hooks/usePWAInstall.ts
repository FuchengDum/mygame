import { useEffect, useState, useCallback } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShowPrompt(true)
    }

    const handleAppInstalled = () => {
      setIsInstalled(true)
      setShowPrompt(false)
      setDeferredPrompt(null)
    }

    const checkIOS = () => {
      const ua = navigator.userAgent.toLowerCase()
      const isIPhone = /iphone|ipod/.test(ua)
      const isIPad = /ipad/.test(ua) || (ua.includes('macintosh') && navigator.maxTouchPoints > 4)
      const isWebKit = /safari|crios|fxios/.test(ua) && !/chrome|firefox/.test(ua.split('safari')[0])
      return (isIPhone || isIPad) && isWebKit
    }

    const checkInstalled = () => {
      return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true
    }

    const ios = checkIOS()
    setIsIOS(ios)

    const installed = checkInstalled()
    setIsInstalled(installed)

    // iOS 用户且未安装时，显示安装提示（仅首次）
    if (ios && !installed) {
      try {
        const dismissed = localStorage.getItem('pwa-install-dismissed')
        if (!dismissed) {
          setShowPrompt(true)
        }
      } catch {
        // Safari 隐私模式或存储禁用，直接显示提示
        setShowPrompt(true)
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const install = useCallback(async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setIsInstalled(true)
    }
    setShowPrompt(false)
    setDeferredPrompt(null)
  }, [deferredPrompt])

  const dismiss = useCallback(() => {
    setShowPrompt(false)
    try {
      localStorage.setItem('pwa-install-dismissed', 'true')
    } catch {
      // 存储不可用，忽略
    }
  }, [])

  return { showPrompt, isInstalled, install, dismiss, isIOS }
}

