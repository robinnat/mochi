import { ref, watch } from '@/ui/dom/reactive'
import { h, onUnmount, onMount, type Component } from '@/ui/dom/h'
import type { MochiBotElement, MochiBotProps } from 'mochiz'
import { urlPoster } from './posters'
import { effectiveTheme } from './theme'
import { pageReady, warmUpStyles, RATIO_MAX, FPS_ALIVE } from './ready'

/**
 * A live Mochi, with never any 2D on screen:
 * 1. the poster (a pre-rendered image of the real 3D, same framing, same pose) shows at once;
 * 2. when the element is on screen AND the page is ready, the component (and Three.js) loads, invisible;
 * 3. on its first 3D frame (`ready`), it fades in over the poster. Off screen, it is removed (no loop runs) and the
 *    poster takes its place back. Without a poster (`poster` null), the place stays empty until the fade.
 */
export interface AliveProps {
  size: number
  poster?: string | null
  alt?: string
  margin?: string
  eager?: boolean
  yaw?: number
  rotate?: boolean
  /** the options of the `<mochi-bot>` (shape, color, mood...) */
  bot?: Partial<MochiBotProps>
}

/** The `<mochi-bot>` component only loads with the first live Mochi to mount (dynamic import, shared). */
let loading: Promise<unknown> | null = null
const componentLoaded = ref(typeof customElements !== 'undefined' && !!customElements.get('mochi-bot'))
function loadComponent() {
  loading ??= import('mochiz').then(() => (componentLoaded.value = true))
}

export const Alive: Component<AliveProps> = (props) => {
  let root: HTMLElement | null = null
  const visible = ref(false)
  const monte = ref(false)
  const shows = ref(false)

  let obs: IntersectionObserver | null = null
  onMount(() => {
    if (typeof IntersectionObserver === 'undefined' || !root) {
      visible.value = true
      return
    }
    obs = new IntersectionObserver((es) => (visible.value = !!es[es.length - 1]?.isIntersecting), { rootMargin: props.margin ?? '200px' })
    obs.observe(root)
  })
  onUnmount(() => obs?.disconnect())

  /*
 * ------------------------------------------------------------------ turn with a finger (or the mouse), with inertia
 */
  /**
   * A mostly horizontal drag on the Mochi turns it (`yaw`); a mostly vertical drag lets the page scroll
   * (`touch-action: pan-y`). On release, it keeps going and slows down. Tap, double tap and long press stay the
   * component's.
   */
  const spin = ref(0)
  /** radians per dragged pixel: a drag the width of the Mochi makes about one turn */
  const K = () => (2 * Math.PI) / Math.max(120, props.size * 1.1)
  let drag: { id: number; x0: number; y0: number; x: number; t: number; active: boolean } | null = null
  let speed = 0
  let rafInertia = 0
  function stopInertia() {
    cancelAnimationFrame(rafInertia)
    rafInertia = 0
  }
  const rotate = () => props.rotate ?? true
  function onDown(e: PointerEvent) {
    if (!rotate() || !monte.value || (e.button !== undefined && e.button > 0)) return
    stopInertia()
    speed = 0
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, t: e.timeStamp, active: false }
  }
  function onMove(e: PointerEvent) {
    const g = drag
    if (!g || e.pointerId !== g.id) return
    const dx = e.clientX - g.x0
    const dy = e.clientY - g.y0
    if (!g.active) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        g.active = true
        g.x = e.clientX
        try {
          root?.setPointerCapture(e.pointerId)
        } catch {
          // pointer already released
        }
      } else if (Math.abs(dy) > 10) {
        drag = null
      }
      return
    }
    const d = (e.clientX - g.x) * K()
    const dt = Math.max(1, e.timeStamp - g.t)
    spin.value += d
    // smoothed speed (radians per ms), for a steady spin
    speed = speed * 0.6 + (d / dt) * 0.4
    g.x = e.clientX
    g.t = e.timeStamp
  }
  function onUp(e: PointerEvent) {
    const g = drag
    if (!g || e.pointerId !== g.id) return
    drag = null
    if (!g.active || e.timeStamp - g.t > 80) return
    let prev = 0
    const step = (t: number) => {
      const dt = prev ? Math.min(48, t - prev) : 16
      prev = t
      spin.value += speed * dt
      speed *= Math.exp(-dt / 420)
      rafInertia = Math.abs(speed) > 0.00004 ? requestAnimationFrame(step) : 0
    }
    rafInertia = requestAnimationFrame(step)
  }
  onUnmount(stopInertia)

  function whenReady() {
    shows.value = true
    warmUpStyles()
  }

  watch(
    [visible, pageReady],
    ([v, p]) => {
      if (v && p) {
        monte.value = true
        loadComponent()
      } else if (!v) {
        monte.value = false
        shows.value = false
      }
    },
    { immediate: true }
  )

  return () => {
    const t = props.size
    const eager = props.eager ?? false
    return h(
      'div',
      {
        ref: (el: Element | null) => (root = el as HTMLElement | null),
        class: ['alive', { turnable: rotate() && monte.value }],
        style: { width: t + 'px', height: t + 'px' },
        onPointerdown: onDown,
        onPointermove: onMove,
        onPointerup: onUp,
        onPointercancel: onUp
      },
      props.poster
        ? h('img', {
            key: 'poster',
            class: ['alive-poster', { cache: shows.value }],
            src: urlPoster(props.poster, effectiveTheme.value),
            width: t,
            height: t,
            alt: shows.value ? '' : (props.alt ?? ''),
            loading: eager ? 'eager' : 'lazy',
            fetchpriority: eager ? 'high' : undefined,
            decoding: 'async',
            draggable: 'false'
          })
        : null,
      monte.value && componentLoaded.value
        ? h(
            'div',
            { key: 'bot', class: ['alive-bot', { on: shows.value }] },
            h('mochi-bot', {
              ...props.bot,
              size: t,
              yaw: (props.yaw ?? 0) + spin.value,
              label: props.alt ?? '',
              maxPixelRatio: RATIO_MAX,
              fps: FPS_ALIVE,
              onReady: whenReady
            })
          )
        : null
    )
  }
}

export type { MochiBotElement }
