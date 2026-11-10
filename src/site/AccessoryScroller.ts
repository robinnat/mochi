import { computed, ref, watch } from '@/ui/dom/reactive'
import { h, onUnmount, onMount, type Component } from '@/ui/dom/h'
import { SCROLL, SIZE_SCROLL, urlPoster } from './posters'
import type { AccessoryChoice, Slot } from 'mochi-world/catalogue'
import { SITE_ACCESSORIES } from './catalog'
import { useReduced } from './reduced'
import { effectiveTheme } from './theme'

/**
 * Carte « accessoires » : une liste fixe de Mochi (corps, couleurs, une piece par emplacement) defile en boucle
 * (environ 1,3 s chacun). Aucune 3D ici : chaque etape est une image pre-rendue de la vraie 3D
 * (`public/rendus/scroll-*.webp`), on ne fait que changer d'image. Le minuteur ne tourne que si la carte est a
 * l'ecran et l'onglet visible ; avec `prefers-reduced-motion`, un seul accessoire reste affiche, fixe.
 *
 * Le Mochi qui part s'ecrase puis s'etire vers le haut (`acc-leave-active`) ; le suivant arrive avec un petit
 * « pop » a ressort (`acc-enter-active`). Les deux images se superposent le temps de la transition.
 */
const PAUSE_MS = 1300

const steps = SCROLL.map((d) => ({
  name: d.name,
  label: (Object.entries(d.variant.acc) as [Slot, AccessoryChoice][])
    .map(([e, ch]) => SITE_ACCESSORIES(e).find((a) => a.id === (typeof ch === 'string' ? ch : ch.id))?.label)
    .filter(Boolean)
    .join(', ')
}))

export const AccessoryScroller: Component<Record<string, never>> = () => {
  const reduced = useReduced()
  let root: HTMLElement | null = null
  let scene: HTMLElement | null = null
  const rang = ref(0)
  let timer = 0
  let obs: IntersectionObserver | null = null
  let visible = false

  const current = computed(() => steps[reduced.value ? 0 : rang.value % steps.length]!)
  const src = computed(() => urlPoster(current.value.name, effectiveTheme.value))

  /** Charge les images de l'autre etape a l'avance, pour que le changement soit instantane. */
  const preloaded = new Set<string>()
  function preload() {
    for (const e of steps) {
      const u = urlPoster(e.name, effectiveTheme.value)
      if (preloaded.has(u)) continue
      preloaded.add(u)
      const im = new Image()
      im.decoding = 'async'
      im.src = u
    }
  }

  function stop() {
    if (timer) clearInterval(timer)
    timer = 0
  }
  function begin() {
    if (timer || reduced.value || !visible || document.hidden) return
    preload()
    timer = window.setInterval(() => (rang.value = (rang.value + 1) % steps.length), PAUSE_MS)
  }
  const onVisibility = () => (document.hidden ? stop() : begin())

  /* --------------------------------------------- transition d'image (entree et sortie) */

  function image(): HTMLImageElement {
    const im = document.createElement('img')
    im.className = 'poster acc-scroll-img'
    im.width = SIZE_SCROLL
    im.height = SIZE_SCROLL
    im.decoding = 'async'
    im.draggable = false
    updateImage(im)
    return im
  }
  function updateImage(im: HTMLImageElement) {
    im.src = src.value
    im.alt = `A Mochi wearing: ${current.value.label}`
  }
  let shown: HTMLImageElement | null = null
  /** Classe d'animation posee le temps de l'animation, puis retiree (ou l'element retire) a sa fin. */
  function play(el: HTMLElement, cls: string, end: () => void) {
    el.classList.add(cls)
    let done = false
    const finish = () => {
      if (done) return
      done = true
      el.classList.remove(cls)
      end()
    }
    el.addEventListener('animationend', finish, { once: true })
    // sans animation (mouvement reduit, image cachee) : pas d'`animationend`
    const duration = parseFloat(getComputedStyle(el).animationDuration || '0') + parseFloat(getComputedStyle(el).animationDelay || '0')
    window.setTimeout(finish, duration > 0 ? duration * 1000 + 60 : 0)
  }
  watch(
    () => current.value.name,
    () => {
      if (!scene) return
      const outgoing = shown
      const arrival = image()
      scene.appendChild(arrival)
      shown = arrival
      play(arrival, 'acc-enter-active', () => {})
      if (outgoing) play(outgoing, 'acc-leave-active', () => outgoing.remove())
    }
  )
  // changement de theme sans changement d'etape : meme image, autre fichier
  watch(src, () => {
    if (shown) updateImage(shown)
  })

  onMount(() => {
    if (scene && !shown) {
      shown = image()
      scene.appendChild(shown)
    }
    document.addEventListener('visibilitychange', onVisibility)
    if (typeof IntersectionObserver === 'undefined' || !root) return
    obs = new IntersectionObserver(
      (es) => {
        visible = !!es[es.length - 1]?.isIntersecting
        if (visible) begin()
        else stop()
      },
      { rootMargin: '80px' }
    )
    obs.observe(root)
  })
  onUnmount(() => {
    stop()
    obs?.disconnect()
    document.removeEventListener('visibilitychange', onVisibility)
  })

  // la scene est remplie a la main (deux images le temps d'une transition) : le dessin ne la touche pas
  return () =>
    h(
      'div',
      { ref: (el: Element | null) => (root = el as HTMLElement | null), class: 'acc-scroll' },
      h('div', { ref: (el: Element | null) => (scene = el as HTMLElement | null), class: 'acc-scroll-scene' })
    )
}
