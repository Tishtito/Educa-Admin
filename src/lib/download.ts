import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { isNative } from './native'

/**
 * Save a downloaded file. The browser gets a normal download; the native apps
 * cannot download from a WebView, so the file is written to the cache and
 * handed to the share sheet (save to Files, WhatsApp, print, …).
 */
export async function saveBlob(blob: Blob, filename: string): Promise<void> {
  const safeName = sanitizeFilename(filename)

  if (isNative()) {
    const written = await Filesystem.writeFile({
      path: safeName,
      data: await blobToBase64(blob),
      directory: Directory.Cache,
    })
    await Share.share({ title: safeName, url: written.uri, dialogTitle: 'Save or share' })
    return
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = safeName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** Open a PDF in a new tab for viewing or printing (web only; native falls back to sharing). */
export async function openBlob(blob: Blob, filename: string): Promise<void> {
  if (isNative()) return saveBlob(blob, filename)
  const url = URL.createObjectURL(blob)
  const opened = window.open(url, '_blank', 'noopener')
  if (!opened) await saveBlob(blob, filename)
  setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000)
}

export function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return cleaned || 'download'
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.readAsDataURL(blob)
  })
}
