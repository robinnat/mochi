import { ref } from '@/ui/dom/reactive'
import { load3d } from 'mochis/catalog'

/**
 * The page is "ready" when it has finished loading and the browser has a free moment: only then do live Mochis
 * (Three.js, 3D rendering) mount. Until then, the page shows their pre-rendered images.
 */
export const pageReady = ref(false)
if (typeof window !== 'undefined') {
  const go = () => {
    const ric = (window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback
    if (ric) ric(() => (pageReady.value = true), { timeout: 900 })
    else setTimeout(() => (pageReady.value = true), 250)
  }
  if (document.readyState === 'complete') go()
  else window.addEventListener('load', go, { once: true })
}

/**
 * Phone (coarse pointer): fewer pixels for live Mochis. Frames per second are no longer capped (v12): the cap at 30
 * gave jolts (one frame out of two skipped, irregularly) and the cost per frame went down.
 */
export const mobile = typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches
export const RATIO_MAX = mobile ? 1.5 : 2
export const FPS_ALIVE: number | undefined = undefined

/**
 * After the page's first 3D frame, during a free moment: compiles the shaders of the three styles, so the first style
 * change (Soft, Pixel, Flat) answers at once. Only once per page.
 */
let warm = false
export function warmUpStyles() {
  if (warm || typeof window === 'undefined') return
  warm = true
  const ric = (window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback
  const lancer = () =>
    load3d()
      .then((m) => m.warmUp())
      .catch(() => {})
  if (ric) ric(lancer, { timeout: 2000 })
  else setTimeout(lancer, 500)
}
