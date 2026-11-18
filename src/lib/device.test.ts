import { describeDevice } from './device'

describe('describeDevice', () => {
  it('names the browser and operating system', () => {
    expect(describeDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36', 'web')).toBe('Chrome on Windows')
    expect(describeDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 Edg/126.0', 'web')).toBe('Edge on Windows')
    expect(describeDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15', 'web')).toBe('Safari on macOS')
    expect(describeDevice('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36', 'web')).toBe('Chrome on Android')
    expect(describeDevice('Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0', 'web')).toBe('Firefox on Linux')
    expect(describeDevice('curl/8.0', 'web')).toBe('Browser')
  })

  it('names the native apps by platform', () => {
    expect(describeDevice('anything', 'android')).toBe('Android app')
    expect(describeDevice('anything', 'ios')).toBe('iPhone or iPad app')
  })
})
