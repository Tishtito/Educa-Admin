import { Capacitor } from '@capacitor/core'

export type ClientPlatform = 'web' | 'android' | 'ios'

export function clientPlatform(): ClientPlatform {
  const platform = Capacitor.getPlatform()
  return platform === 'android' || platform === 'ios' ? platform : 'web'
}

/**
 * A name people recognise on their list of signed-in devices, such as
 * "Chrome on Windows" or "Android app". Never more precise than the browser and
 * operating system.
 */
export function describeDevice(userAgent: string = navigator.userAgent, platform: ClientPlatform = clientPlatform()): string {
  if (platform === 'android') return 'Android app'
  if (platform === 'ios') return 'iPhone or iPad app'

  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /OPR\//.test(userAgent)
      ? 'Opera'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Chrome\//.test(userAgent)
          ? 'Chrome'
          : /Safari\//.test(userAgent)
            ? 'Safari'
            : 'Browser'

  const os = /Android/.test(userAgent)
    ? 'Android'
    : /iPhone|iPad|iPod/.test(userAgent)
      ? 'iOS'
      : /Windows/.test(userAgent)
        ? 'Windows'
        : /Mac OS X|Macintosh/.test(userAgent)
          ? 'macOS'
          : /CrOS/.test(userAgent)
            ? 'ChromeOS'
            : /Linux/.test(userAgent)
              ? 'Linux'
              : null

  return os ? `${browser} on ${os}` : browser
}
