import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Native shells for Android and iOS. The web build in dist/ is bundled into
 * the app; the API URL is baked in at build time from VITE_API_URL.
 *
 * Development against a laptop on the LAN:
 *   CAP_SERVER_URL=http://192.168.1.20:5173 npx cap run android   (live reload)
 * Release builds must point VITE_API_URL at an https:// API.
 */
const devServer = process.env.CAP_SERVER_URL

const config: CapacitorConfig = {
  appId: 'ke.codepass.educa.admin',
  appName: 'Educa Admin',
  webDir: 'dist',
  server: devServer
    ? {
        url: devServer,
        // Live reload serves the app over http, so http API calls are same-kind requests.
        cleartext: devServer.startsWith('http://'),
      }
    : undefined,
  android: {
    // Only for pointing a debug build at an http:// API on the LAN. Never in release.
    allowMixedContent: process.env.CAP_ALLOW_MIXED_CONTENT === '1',
  },
  ios: {
    contentInset: 'never',
  },
  plugins: {
    SystemBars: {
      // The app pads itself with env(safe-area-inset-*) (index.html sets viewport-fit=cover).
      insetsHandling: 'native',
      initialViewportFitValueHint: 'cover',
    },
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: false,
      backgroundColor: '#1e3a8a',
      showSpinner: false,
    },
  },
}

export default config
