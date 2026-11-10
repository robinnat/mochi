/**
 * Rend les images pre-rendues du site (`src/site/affiches.ts`) avec le VRAI composant, en vraie 3D, en clair et en sombre.
 * Chaque Mochi est monte fige a son instant, on attend sa premiere image 3D (`ready`), puis on lit son canvas en webp.
 * Les pieces d'accessoires passent par `renderThumbnail` (piece seule, cadree), comme dans l'ancien site.
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
    const timer = setTimeout(() => ko(new Error('pas de 3D')), 15000)
    const bot = createBot({ ...props, size: size, interactions: false, label: '' })
    bot.addEventListener(
      'ready',
      () => {
        // une image de plus : la premiere peut partir avant que tous les observateurs aient pose leurs valeurs
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            clearTimeout(timer)
            const cv = host.querySelector('canvas[data-real3d]') as HTMLCanvasElement
            // Pixel : le canvas est la petite grille ; on l'agrandit sans lissage, comme l'affiche le composant
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
    allRender: (prefix?: string) => Promise<{ file: string; data: string }[]>
  }
}

window.allRender = async (prefix = '') => {
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

/** Rend une liste libre de Mochi (planches de controle, hors du manifeste du site). */
window.renderList = async (list) => {
  const out: string[] = []
  for (const it of list) {
    currentTheme.value = it.theme ?? 'light'
    out.push(await renderOne({ theme: it.theme ?? 'light', frozenAt: 1.2, ...it.props }, it.size))
  }
  return out
}
