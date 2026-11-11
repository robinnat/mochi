/**
 * Renders the site's pre-rendered images (`src/site/posters.ts`) with the REAL component, in real 3D, in light and
 * dark. Each Mochi is mounted frozen at its instant, we wait for its first 3D frame (`ready`), then read its canvas
 * as webp. Accessory pieces go through `renderThumbnail` (piece alone, framed).
 */
import { createBot } from '../src/ui/capture'
import { currentTheme } from '../src/ui/3d/currentTheme'
import { POSTERS, PIECES, SIZE_PIECE, urlPoster, urlPiece, type ThemeSite } from '../src/site/posters'
import { itemPiece } from '../src/site/strips'
import { renderThumbnail } from '../src/site/thumbnails'

const THEMES: ThemeSite[] = ['light', 'dark']
const QUALITY = 0.9

function renderOne(props: Record<string, unknown>, size: number): Promise<string> {
  return new Promise((ok, ko) => {
    const host = document.createElement('div')
    document.getElementById('scene')!.appendChild(host)
    const timer = setTimeout(() => ko(new Error('no 3D')), 15000)
    const bot = createBot({ ...props, size: size, interactions: false, label: '' })
    bot.addEventListener(
      'ready',
      () => {
        // one more frame: the first can leave before every watcher has set its values
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            clearTimeout(timer)
            const cv = host.querySelector('canvas[data-real3d]') as HTMLCanvasElement
            // Pixel: the canvas is the small grid; scale it up without smoothing, as the component shows it
            const side = size * 2
            let source = cv
            if (cv.width < side) {
              source = document.createElement('canvas')
              source.width = source.height = side
              const c = source.getContext('2d')!
              c.imageSmoothingEnabled = false
              c.drawImage(cv, 0, 0, side, side)
            }
            const data = source.toDataURL('image/webp', QUALITY)
            bot.remove()
            host.remove()
            ok(data)
          })
        )
      },
      { once: true }
    )
    host.appendChild(bot)
  })
}

async function asWebp(url: string, side: number): Promise<string> {
  const im = new Image()
  im.src = url
  await im.decode()
  const cv = document.createElement('canvas')
  cv.width = cv.height = side
  cv.getContext('2d')!.drawImage(im, 0, 0, side, side)
  return cv.toDataURL('image/webp', QUALITY)
}

declare global {
  interface Window {
    renderList: (list: { props: Record<string, unknown>; size: number; theme?: ThemeSite }[]) => Promise<string[]>
    renderAll: (prefix?: string) => Promise<{ file: string; data: string }[]>
  }
}

window.renderAll = async (prefix = '') => {
  const out: { file: string; data: string }[] = []
  for (const theme of THEMES) {
    currentTheme.value = theme
    for (const a of POSTERS) {
      if (!a.name.startsWith(prefix)) continue
      const data = await renderOne({ ...a.props, theme: a.props.theme ?? theme, frozenAt: a.t }, a.size)
      out.push({ file: urlPoster(a.name, theme), data })
    }
    for (const p of PIECES) {
      if (prefix) break
      const item = itemPiece(p.slot, p.id)
      if (!item) continue
      const u = await renderThumbnail(item, theme)
      if (!u) throw new Error('piece' + p.id)
      out.push({ file: urlPiece(p.slot, p.id, theme), data: await asWebp(u, SIZE_PIECE) })
      URL.revokeObjectURL(u)
    }
  }
  return out
}

/** Renders a free list of Mochiz (check sheets, outside the site's manifest). */
window.renderList = async (list) => {
  const out: string[] = []
  for (const it of list) {
    currentTheme.value = it.theme ?? 'light'
    out.push(await renderOne({ theme: it.theme ?? 'light', frozenAt: 1.2, ...it.props }, it.size))
  }
  return out
}
