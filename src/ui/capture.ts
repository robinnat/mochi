/**
 * Capture de l'avatar en image. C'est la couche DOM de l'export : elle a besoin
 * d'un canvas et du presse-papiers, donc rien ici n'est testable en `node` — le
 * cadrage et le nommage, eux, vivent dans `export.ts` et le sont.
 *
 * Tout export part de la 3D : l'image fixe est le noeud de l'ECRAN, recadre, dont le
 * canvas WebGL est fige en image (`freezeCanvases`) ; les animations (GIF, video) sont
 * rejouees image par image sur une instance hors ecran, elle aussi en 3D. Il n'y a
 * pas d'autre source de dessin.
 */

import { nextTick } from '@/ui/dom/reactive'
import { MochiBotElement } from '@/components/mochi-bot'
import type { Block } from '@/bot/cycles'
import { gifAnimate, gifIndexed, indexed, newPalette, listed } from './animate'
import { stops, HALF_SCREEN, withoutComments, viewBoxExport } from './export'
import type { RenderStyleId, PixelSizeId } from './renderStyle'

/**
 * Serialise le SVG affiche en un document autonome, recadre sur la boule.
 *
 * `width`/`height` sont poses explicitement et ce n'est pas cosmetique : sans
 * dimension intrinseque, Firefox refuse de rasteriser un SVG charge dans une
 * `<img>`, et le canvas ressort vide.
 */
export function svgStandalone(svg: SVGSVGElement, size: number, viewBox = viewBoxExport()) {
  const clone = svg.cloneNode(true) as SVGSVGElement
  freezeCanvases(svg, clone)
  // Les classes Tailwind de la page n'existent pas dans le fichier livre.
  clone.removeAttribute('class')
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('viewBox', viewBox)
  clone.setAttribute('width', String(size))
  clone.setAttribute('height', String(size))
  return withoutComments(new XMLSerializer().serializeToString(clone))
}

const SVG_NS = 'http://www.w3.org/2000/svg'

/**
 * Remplace, dans le CLONE, chaque `<foreignObject>` qui porte un canvas par une `<image>` en `data:` URL de ce
 * qu'affiche le canvas d'origine.
 *
 * C'est le cas de la vraie 3D : le corps et les yeux sont rendus par WebGL dans un canvas pose dans un
 * `<foreignObject>`. Laisse tel quel, il casse les deux exports :
 * - en PNG, un SVG qui contient un `<foreignObject>` souille le canvas de rasterisation (Chrome, Safari) et
 *   `toBlob` echoue en `SecurityError`, d'ou « Export failed » sur le style par defaut ;
 * - en SVG, `cloneNode` ne copie pas les pixels d'un canvas : le fichier livre aurait un canvas vide.
 *
 * Une `<image>` en `data:` URL est autonome et ne souille pas le canvas : le fichier SVG garde le corps, et le
 * PNG se rasterise. On lit le canvas VIVANT (le clone n'a pas de pixels), apparie par ordre du document.
 */
export function freezeCanvases(source: SVGSVGElement, clone: SVGSVGElement) {
  const origins = [...source.querySelectorAll('foreignObject')]
  const copies = [...clone.querySelectorAll('foreignObject')]
  copies.forEach((fo, i) => {
    const canvas = origins[i]?.querySelector('canvas')
    let href = ''
    try {
      // un canvas de largeur nulle (pas encore rendu) donne « data:, » : pas d'image plutot qu'une image cassee
      if (canvas && canvas.width > 0 && canvas.height > 0) href = canvas.toDataURL('image/png')
    } catch {
      href = ''
    }
    if (!href.startsWith('data:image/')) {
      fo.remove()
      return
    }
    const img = clone.ownerDocument.createElementNS(SVG_NS, 'image')
    for (const k of ['x', 'y', 'width', 'height']) {
      const v = fo.getAttribute(k)
      if (v !== null) img.setAttribute(k, v)
    }
    img.setAttribute('href', href)
    img.setAttribute('preserveAspectRatio', 'none')
    // pixel art : garder les cases nettes a l'agrandissement
    if (canvas?.style.imageRendering === 'pixelated') img.setAttribute('style', 'image-rendering: pixelated')
    fo.replaceWith(img)
  })
}

/**
 * Rasterise un SVG dans un canvas et rend son contexte.
 *
 * Passe par un blob et non par une `data:` URL : `btoa` casse sur les accents de
 * l'`aria-label`, et l'encodage en pourcents d'un SVG entier est inutilement
 * long. L'URL est relachee dans un `finally` — un objet non revoque tient le blob
 * en memoire jusqu'au rechargement de la page.
 *
 * Le canvas n'est jamais souille : `svgStandalone` a remplace le `<foreignObject>` de la
 * vraie 3D par une `<image>` en `data:` URL (voir `freezeCanvases`). Un `<foreignObject>`
 * restant ferait echouer `toBlob` ; une `data:` URL, elle, est sure.
 */
async function draws(
  markup: string,
  size: number,
  canvas: HTMLCanvasElement,
  background: string | null = null
) {
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    img.src = url
    await img.decode()

    canvas.width = size
    canvas.height = size
    // `alpha` par defaut : c'est ce qui laisse le fond transparent quand aucune
    // couleur n'est demandee. Le bot s'exporte alors en vignette detachee.
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas indisponible')
    // Le canvas est reutilise d'une image a l'autre pour l'export anime : sans
    // effacement, une image aux yeux fermes garderait les yeux ouverts dessous.
    ctx.clearRect(0, 0, size, size)
    if (background) {
      ctx.fillStyle = background
      ctx.fillRect(0, 0, size, size)
    }
    ctx.drawImage(img, 0, 0, size, size)
    return ctx
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Rasterise un SVG en PNG. Le PNG est sans perte, il n'a pas de qualite a regler. */
export async function toPng(markup: string, size: number): Promise<Blob> {
  const canvas = document.createElement('canvas')
  await draws(markup, size, canvas)
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('encodage png impossible'))),
      'image/png'
    )
  })
}

/** Declenche le telechargement d'un blob sous le nom donne. */
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
  } finally {
    // Differe : Safari lit encore l'URL apres le clic sur un gros blob.
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
}

/** Le presse-papiers sait-il ecrire une image ici ? */
export function copyPossible() {
  return (
    typeof ClipboardItem !== 'undefined' &&
    !!navigator.clipboard?.write &&
    // `supports` est recent : son absence n'est pas un refus.
    (ClipboardItem.supports?.('image/png') ?? true)
  )
}

/**
 * Copie une image dans le presse-papiers.
 *
 * Le blob est passe en PROMESSE et non attendu avant l'appel : Safari exige que
 * `write` part du geste de l'utilisateur, or tout `await` glisse entre les deux
 * perd ce geste et la copie est refusee.
 */
export async function copy(blob: Promise<Blob>) {
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
}

/**
 * Copie le SVG en TEXTE et non comme image : c'est sous cette forme que Figma,
 * Illustrator et un editeur de code le collent en vectoriel modifiable. Colle en
 * `image/svg+xml`, il ressortirait aplati la ou il ressort editable ici.
 */
export async function copyText(text: string) {
  await navigator.clipboard.writeText(text)
}

/** Combien d'images faites sur combien, pour la barre de progression. */
export type Progress = (done: number, total: number) => void

/**
 * Exporte le cycle en MP4.
 *
 * Le fond est OBLIGATOIRE et non optionnel : la video n'a pas d'alpha (verifie,
 * `VideoEncoder` refuse `alpha: 'keep'`). Sans fond, le bot serait compose sur du
 * noir.
 */
export async function cycleToMp4(
  settings: SettingsBot,
  blocks: Block[],
  size: number,
  images: number,
  step: number,
  background: string,
  advance?: Progress,
  signal?: AbortSignal
): Promise<Blob> {
  const { toMp4 } = await import('./video')
  const canvas = document.createElement('canvas')
  const player = await opensCycle(settings, blocks, size, background)
  try {
    return await toMp4(
      canvas,
      images,
      Math.round(1 / step),
      async (i) => {
        const svg = await player.render(i * step)
        await draws(svgStandalone(svg, size, viewBoxExport(HALF_SCREEN)), size, canvas, background)
      },
      advance,
      signal
    )
  } finally {
    player.closed()
  }
}

/**
 * Exporte le cycle en GIF.
 *
 * DEUX passes sur la sequence, et c'est pour la memoire : un GIF a besoin d'une
 * palette commune a toutes les images, donc de les avoir toutes recensees avant d'en
 * encoder une seule. Les garder en pixels bruts couterait 255 Mo sur un cycle de
 * trente secondes. La premiere passe ne retient que les couleurs, la seconde
 * encode — le rendu est deterministe, donc rejouer la sequence redonne exactement
 * les memes images.
 *
 * Ce determinisme repose sur le fait que le LECTEUR est idempotent : rejouer l'image 0
 * apres une passe complete doit redonner exactement l'image 0. Ca n'a pas toujours ete le
 * cas — le moteur garde l'etat precedent pour ses fondus, si bien que le premier etat se
 * melangeait avec le DERNIER et que le GIF par defaut s'ouvrait sur une boule sans yeux,
 * `sleep` ayant un `eyeAlpha` nul. La palette, elle, avait ete comptee sur des images
 * qui n'etaient pas celles encodees. C'est `renderAt` qui rembobine desormais, et
 * `capture.test.ts` le verrouille — sans quoi ce module devrait ouvrir un lecteur par
 * passe pour s'en sortir.
 */
export async function cycleToGif(
  settings: SettingsBot,
  blocks: Block[],
  size: number,
  images: number,
  step: number,
  background: string | null,
  advance?: Progress,
  signal?: AbortSignal
): Promise<Blob> {
  // Un seul canvas et un seul lecteur pour les deux passes : le canvas est reinitialise a
  // chaque image, et le lecteur sait rembobiner.
  const canvas = document.createElement('canvas')
  const box = viewBoxExport(HALF_SCREEN)
  const player = await opensCycle(settings, blocks, size, background ?? undefined)

  /** Une passe complete sur la sequence. */
  const passe = async (read: (index: number, pixels: Uint8ClampedArray) => void) => {
    for (let i = 0; i < images; i++) {
      // teste a chaque image : un cycle de trente secondes fait deux fois six cents
      // images, et l'abandon ne doit pas attendre la fin d'une passe
      stops(signal)
      const svg = await player.render(i * step)
      const ctx = await draws(svgStandalone(svg, size, box), size, canvas, background)
      read(i, ctx.getImageData(0, 0, size, size).data)
    }
  }

  try {
    const palette = newPalette()
    await passe((i, pixels) => {
      listed(palette, pixels)
      advance?.(i + 1, images * 2)
    })

    const chunks: Uint8Array[] = []
    await passe((i, pixels) => {
      chunks.push(indexed(palette, pixels))
      advance?.(images + i + 1, images * 2)
    })

    return new Blob([gifIndexed(palette, chunks, size, size, Math.round(step * 1000))], {
      type: 'image/gif'
    })
  } finally {
    player.closed()
  }
}

/**
 * Attend la premiere image 3D d'un Mochi hors ecran (`ready`). Sans WebGL (`no3d`) ou si
 * rien ne vient, l'export echoue proprement : il n'y a pas de dessin 2D de secours.
 */
export function wait3d(bot: MochiBotElement, delay = 15000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (bot.querySelector('canvas[data-vraie3d]') && bot.dataset.ready === '1') return resolve()
    const end = (ok: boolean) => {
      clearTimeout(timer)
      bot.removeEventListener('ready', good)
      bot.removeEventListener('no3d', bad)
      if (ok) resolve()
      else reject(new Error('3D indisponible'))
    }
    const good = () => end(true)
    const bad = () => end(false)
    const timer = setTimeout(bad, delay)
    bot.addEventListener('ready', good)
    bot.addEventListener('no3d', bad)
  })
}

/** Laisse passer le dessin du moteur PUIS celui de la 3D (file `post`). */
async function image() {
  await nextTick()
  await nextTick()
}

/** Ce que le bot doit porter sur l'animation exportee. */
export interface SettingsBot {
  shape: string
  color: string
  expression: string
  /** style de rendu ; absent, le style courant de l'ecran */
  renderStyle?: RenderStyleId
  pixel?: PixelSizeId
}

/**
 * Rend la sequence image par image, sur une instance HORS ECRAN.
 *
 * Pas de capture de l'avatar affiche, et c'est deliberé : a l'ecran le bot est
 * a une date d'horloge quelconque, alors qu'ici on veut une sequence
 * reproductible qui commence au debut. C'est possible parce que `engine.sample(t)`
 * est une fonction pure du temps — la meme date redonne toujours la meme image —
 * et parce qu'un `MochiBot` a qui on donne `frozenAt` ne lance aucune boucle
 * d'animation ni aucun ecouteur : on le fait avancer nous-memes.
 *
 * Le meme composant sert donc a l'ecran et a l'export : une seule source de
 * dessin, aucune chance de derive.
 */
export async function sequenceOfBot<T>(
  settings: SettingsBot,
  size: number,
  number: number,
  step: number,
  read: (svg: SVGSVGElement, index: number) => T | Promise<T>,
  /**
   * Couleur des yeux. Ce sont des TROUS remplis de cette teinte, donc sur un
   * export a fond plein elle doit valoir exactement celle du fond — sinon
   * l'ancienne teinte du site reste visible dedans, en anneau plus sombre.
   */
  paper?: string
): Promise<T[]> {
  const host = document.createElement('div')
  // hors du flux et hors de l'ecran, mais RENDU : un `display:none` ne donnerait pas
  // de SVG a serialiser.
  host.style.cssText = 'position:fixed;left:-99999px;top:0;width:0;height:0;overflow:hidden'
  document.body.appendChild(host)

  const bot = createBot({ ...settings, size: size, frozenAt: 0, maxPixelRatio: 2, ...(paper ? { paper } : {}) })
  const ready = wait3d(bot)
  host.appendChild(bot)

  try {
    await ready
    const out: T[] = []
    for (let i = 0; i < number; i++) {
      bot.frozenAt = i * step
      await image()
      const svg = host.querySelector('svg')
      if (!svg) throw new Error('bot hors ecran non rendu')
      out.push(await read(svg, i))
    }
    return out
  } finally {
    bot.remove()
    host.remove()
  }
}

/** Un `<mochi-bot>` avec ses options posees en proprietes, pas encore dans la page. */
export function createBot(options: Record<string, unknown>): MochiBotElement {
  const bot = document.createElement('mochi-bot') as MochiBotElement
  Object.assign(bot, options)
  return bot
}

/**
 * Rend un CYCLE hors ecran, image par image, en appelant `read` pour chacune.
 *
 * Les images ne sont jamais accumulees : un cycle de trente secondes fait plus de
 * six cents images, soit 255 Mo de pixels bruts si on les gardait toutes. C'est
 * l'appelant qui decide quoi en faire au fil de l'eau — encoder, indexer, jeter.
 *
 * Le rendu passe par `renderAt` et non par `frozenAt` : seul `renderAt` parcourt les
 * blocs en datant chaque changement d'etat a son offset absolu, ce qui donne les
 * memes fondus aux jointures que la lecture temps reel. Voir sa doc dans
 * `components/mochi-bot.ts`.
 */
export interface PlayerOutScreen {
  /** Rend l'instant `t` du cycle et renvoie le SVG a lire. */
  render: (t: number) => Promise<SVGSVGElement>
  closed: () => void
}

export async function opensCycle(
  settings: SettingsBot,
  blocks: Block[],
  size: number,
  paper?: string
): Promise<PlayerOutScreen> {
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-99999px;top:0;width:0;height:0;overflow:hidden'
  document.body.appendChild(host)

  /*
   * `state` : le moteur se construit sur l'etat qu'on lui donne, et l'image 0 doit etre le PREMIER etat du
   * montage, sans morph depuis un repos jamais affiche.
   */
  const bot = createBot({
    ...settings,
    size: size,
    cycle: blocks,
    state: blocks[0]?.state ?? 'idle',
    frozenAt: 0,
    maxPixelRatio: 1,
    ...(paper ? { paper } : {})
  })
  const ready = wait3d(bot)
  host.appendChild(bot)
  const close = () => {
    bot.remove()
    host.remove()
  }
  try {
    await ready
  } catch (e) {
    close()
    throw e
  }

  const svg = host.querySelector('svg')
  if (!svg) {
    close()
    throw new Error('bot hors ecran non rendu')
  }

  return {
    render: async (t: number) => {
      bot.renderAt(t)
      await image()
      return svg
    },
    closed: close
  }
}

/**
 * Assemble l'animation du bot en GIF anime.
 *
 * Un vrai feuilletage : chaque image est rendue en 3D hors ecran puis rasterisee. Pour
 * les avatars animes (Discord, Slack) ; son bord est dur, sa transparence n'ayant qu'un bit.
 */
export async function toGifAnimate(
  settings: SettingsBot,
  size: number,
  number: number,
  step: number,
  background: string | null = null
): Promise<Blob> {
  // Un seul canvas pour toute la sequence : en creer un par image laisse des
  // dizaines de contextes au ramasse-miettes pendant l'export.
  const canvas = document.createElement('canvas')
  const images = await sequenceOfBot(
    settings,
    size,
    number,
    step,
    async (svg) => {
      const ctx = await draws(svgStandalone(svg, size), size, canvas, background)
      return ctx.getImageData(0, 0, size, size).data
    },
    // les yeux prennent la teinte du fond pour s'y fondre exactement
    background ?? undefined
  )
  return new Blob([gifAnimate(images, size, size, Math.round(step * 1000))], { type: 'image/gif' })
}
