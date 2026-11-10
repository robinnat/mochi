import { ref, type Ref } from '@/ui/dom/reactive'
import { onUnmount as onBeforeUnmount, onMount as onMounted } from '@/ui/dom/h'

/**
 * Site motion, with no library: everything goes through `transform` and `opacity` (composited, 60 fps), a single
 * shared IntersectionObserver for reveals, and a single `requestAnimationFrame` loop per effect, which only runs
 * during a scroll or a pointer move. With `prefers-reduced-motion`, nothing moves: elements are visible right away.
 */

export const motionReduced = (): boolean =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches

let obs: IntersectionObserver | null = null
function observer(): IntersectionObserver | null {
  if (typeof IntersectionObserver === 'undefined') return null
  obs ??= new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        e.target.classList.add('in')
        obs?.unobserve(e.target)
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
  )
  return obs
}

/**
 * `reveal(rank)`: set as the `ref` of an element. The element appears sliding up when it enters the screen, only
 * once. The rank (optional) is its place in a group: the cascade delay reads from `--i`.
 */
export function reveal(rang?: number): (el: Element | null) => void {
  return (el) => {
    // removal: nothing to do (the observer lets go of the element as soon as it appeared)
    if (!el) return
    const e = el as HTMLElement & { __rv?: boolean; __keep?: string[] }
    // already handled (a new drawing gives a new function for the same element)
    if (e.__rv) return
    e.__rv = true
    // these classes survive a `class` change by the drawing
    e.__keep = ['rv', 'in']
    e.classList.add('rv')
    if (rang !== undefined) e.style.setProperty('--i', String(rang))
    const o = observer()
    if (!o || motionReduced()) {
      e.classList.add('in')
      return
    }
    o.observe(e)
  }
}

/**
 * Scroll progress of an element: 0 when its top touches the top of the window, 1 when it has left by its full height.
 * Written to the element's CSS variable `--s` (and returned), updated in an animation frame only while the page
 * scrolls. Nothing under `prefers-reduced-motion`.
 */
export function useScroll(el: Ref<HTMLElement | null>, onChange?: (s: number) => void) {
  const s = ref(0)
  let raf = 0
  const update = () => {
    raf = 0
    const e = el.value
    if (!e) return
    const r = e.getBoundingClientRect()
    const v = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)))
    if (Math.abs(v - s.value) < 0.001) return
    s.value = v
    e.style.setProperty('--s', v.toFixed(4))
    onChange?.(v)
  }
  const onScroll = () => {
    if (!raf) raf = requestAnimationFrame(update)
  }
  onMounted(() => {
    if (motionReduced()) return
    window.addEventListener('scroll', onScroll, { passive: true })
    update()
  })
  onBeforeUnmount(() => {
    window.removeEventListener('scroll', onScroll)
    cancelAnimationFrame(raf)
  })
  return s
}

/**
 * Pointer position in the window, from -1 to 1 on each axis, smoothed (simple critical spring): written to the
 * element's `--mx` and `--my`. The loop stops once the value is reached. On a touch screen without hover, it stays at
 * 0.
 */
export function usePointer(el: Ref<HTMLElement | null>, onChange?: (x: number, y: number) => void) {
  let cx = 0
  let cy = 0
  let x = 0
  let y = 0
  let raf = 0
  const step = () => {
    raf = 0
    x += (cx - x) * 0.12
    y += (cy - y) * 0.12
    el.value?.style.setProperty('--mx', x.toFixed(4))
    el.value?.style.setProperty('--my', y.toFixed(4))
    onChange?.(x, y)
    if (Math.abs(cx - x) > 0.001 || Math.abs(cy - y) > 0.001) raf = requestAnimationFrame(step)
  }
  const onMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return
    cx = (e.clientX / window.innerWidth) * 2 - 1
    cy = (e.clientY / window.innerHeight) * 2 - 1
    if (!raf) raf = requestAnimationFrame(step)
  }
  const onLeave = () => {
    cx = 0
    cy = 0
    if (!raf) raf = requestAnimationFrame(step)
  }
  onMounted(() => {
    if (motionReduced()) return
    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerleave', onLeave)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerleave', onLeave)
    cancelAnimationFrame(raf)
  })
}

/** Window width, tracked (for the Mochi size, which is in pixels). */
export function useWidth() {
  const w = ref(typeof window === 'undefined' ? 1200 : window.innerWidth)
  const update = () => (w.value = window.innerWidth)
  onMounted(() => window.addEventListener('resize', update, { passive: true }))
  onBeforeUnmount(() => window.removeEventListener('resize', update))
  return w
}

/** Element visible on screen (to pause a loop out of view). */
export function useVisible(el: Ref<HTMLElement | null>, margin = '0px') {
  const v = ref(typeof IntersectionObserver === 'undefined')
  let o: IntersectionObserver | null = null
  onMounted(() => {
    if (typeof IntersectionObserver === 'undefined' || !el.value) return
    o = new IntersectionObserver((es) => (v.value = !!es[es.length - 1]?.isIntersecting), { rootMargin: margin })
    o.observe(el.value)
  })
  onBeforeUnmount(() => o?.disconnect())
  return v
}
