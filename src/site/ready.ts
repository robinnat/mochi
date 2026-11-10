import { ref } from '@/ui/dom/reactive'
import { load3d } from 'mochi-world/catalogue'

/**
 * La page est « prete » quand son chargement est fini et que le navigateur a un moment de libre : seulement alors
 * les Mochi vivants (Three.js, rendu 3D) se montent. Jusque-la, la page montre leurs images pre-rendues.
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
 * Telephone (pointeur grossier) : moins de pixels pour les Mochi vivants. Les images par seconde ne sont plus plafonnees
 * (v12) : le plafond a 30 donnait des a-coups (une image sur deux sautee, irregulierement) et le cout par image a baisse.
 */
export const mobile = typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches
export const RATIO_MAX = mobile ? 1.5 : 2
export const FPS_ALIVE: number | undefined = undefined

/**
 * Apres la premiere image 3D de la page, pendant un moment libre : compile les shaders des trois styles, pour que
 * le premier changement de style (Soft, Pixel, Flat) reponde tout de suite. Une seule fois par page.
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
