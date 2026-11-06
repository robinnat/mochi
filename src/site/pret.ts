import { ref } from 'vue'

/**
 * La page est « prete » quand son chargement est fini et que le navigateur a un moment de libre : seulement alors
 * les Mochi vivants (Three.js, rendu 3D) se montent. Jusque-la, la page montre leurs images pre-rendues.
 */
export const pagePrete = ref(false)
if (typeof window !== 'undefined') {
  const go = () => {
    const ric = (window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback
    if (ric) ric(() => (pagePrete.value = true), { timeout: 900 })
    else setTimeout(() => (pagePrete.value = true), 250)
  }
  if (document.readyState === 'complete') go()
  else window.addEventListener('load', go, { once: true })
}

/** Telephone (pointeur grossier) : moins de pixels et moins d'images par seconde pour les Mochi vivants. */
export const mobile = typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches
export const RATIO_MAX = mobile ? 1.5 : 2
export const FPS_VIVANT = mobile ? 30 : undefined
