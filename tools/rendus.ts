/**
 * Rend les images pre-rendues du site (`src/site/affiches.ts`) avec le VRAI composant, en vraie 3D, en clair et en sombre.
 * Chaque Mochi est monte fige a son instant, on attend sa premiere image 3D (`pret`), puis on lit son canvas en webp.
 * Les pieces d'accessoires passent par `rendreVignette` (piece seule, cadree), comme dans l'ancien site.
 */
import { creerBot } from '../src/ui/capture'
import { themeCourant } from '../src/ui/trois/themeCourant'
import { AFFICHES, PIECES, TAILLE_PIECE, urlAffiche, urlPiece, type ThemeSite } from '../src/site/affiches'
import { itemPiece } from '../src/site/bandes'
import { rendreVignette } from '../src/site/vignettes'

const THEMES: ThemeSite[] = ['light', 'dark']
const QUALITE = 0.9

function rendreUn(props: Record<string, unknown>, taille: number): Promise<string> {
  return new Promise((ok, ko) => {
    const hote = document.createElement('div')
    document.getElementById('scene')!.appendChild(hote)
    const minuteur = setTimeout(() => ko(new Error('pas de 3D')), 15000)
    const bot = creerBot({ ...props, size: taille, interactions: false, label: '' })
    bot.addEventListener(
      'pret',
      () => {
        // une image de plus : la premiere peut partir avant que tous les observateurs aient pose leurs valeurs
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            clearTimeout(minuteur)
            const cv = hote.querySelector('canvas[data-vraie3d]') as HTMLCanvasElement
            // Pixel : le canvas est la petite grille ; on l'agrandit sans lissage, comme l'affiche le composant
            const cote = taille * 2
            let source = cv
            if (cv.width < cote) {
              source = document.createElement('canvas')
              source.width = source.height = cote
              const c = source.getContext('2d')!
              c.imageSmoothingEnabled = false
              c.drawImage(cv, 0, 0, cote, cote)
            }
            const data = source.toDataURL('image/webp', QUALITE)
            bot.remove()
            hote.remove()
            ok(data)
          })
        )
      },
      { once: true }
    )
    hote.appendChild(bot)
  })
}

async function enWebp(url: string, cote: number): Promise<string> {
  const im = new Image()
  im.src = url
  await im.decode()
  const cv = document.createElement('canvas')
  cv.width = cv.height = cote
  cv.getContext('2d')!.drawImage(im, 0, 0, cote, cote)
  return cv.toDataURL('image/webp', QUALITE)
}

declare global {
  interface Window {
    rendreListe: (liste: { props: Record<string, unknown>; taille: number; theme?: ThemeSite }[]) => Promise<string[]>
    toutRendre: (prefixe?: string) => Promise<{ fichier: string; data: string }[]>
  }
}

window.toutRendre = async (prefixe = '') => {
  const out: { fichier: string; data: string }[] = []
  for (const theme of THEMES) {
    themeCourant.value = theme
    for (const a of AFFICHES) {
      if (!a.nom.startsWith(prefixe)) continue
      const data = await rendreUn({ ...a.props, theme: a.props.theme ?? theme, frozenAt: a.t }, a.taille)
      out.push({ fichier: urlAffiche(a.nom, theme), data })
    }
    for (const p of PIECES) {
      if (prefixe) break
      const item = itemPiece(p.emplacement, p.id)
      if (!item) continue
      const u = await rendreVignette(item, theme)
      if (!u) throw new Error('piece ' + p.id)
      out.push({ fichier: urlPiece(p.emplacement, p.id, theme), data: await enWebp(u, TAILLE_PIECE) })
      URL.revokeObjectURL(u)
    }
  }
  return out
}

/** Rend une liste libre de Mochi (planches de controle, hors du manifeste du site). */
window.rendreListe = async (liste) => {
  const out: string[] = []
  for (const it of liste) {
    themeCourant.value = it.theme ?? 'light'
    out.push(await rendreUn({ theme: it.theme ?? 'light', frozenAt: 1.2, ...it.props }, it.taille))
  }
  return out
}
