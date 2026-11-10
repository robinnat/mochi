import { computed, ref, watch } from '@/ui/dom/reactif'
import { themeCourant } from 'mochi-world/catalogue'

/**
 * Clair, sombre ou celui de l'appareil. Le choix est range dans le navigateur (si possible) ; la page porte
 * `data-theme` et tous les Mochi du site passent en 3D sombre (yeux noirs) avec elle.
 */
export type ChoixTheme = 'auto' | 'light' | 'dark'
export const CHOIX_THEMES: { id: ChoixTheme; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' }
]

const CLE = 'mochi-site-theme'
const lire = (): ChoixTheme => {
  try {
    const v = localStorage.getItem(CLE)
    return v === 'light' || v === 'dark' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

export const choixTheme = ref<ChoixTheme>('auto')
const appareilSombre = ref(false)
export const themeEffectif = computed<'light' | 'dark'>(() => (choixTheme.value === 'auto' ? (appareilSombre.value ? 'dark' : 'light') : choixTheme.value))

let pret = false
/** A appeler une fois, au montage de la page. */
export function initTheme() {
  if (pret || typeof window === 'undefined') return
  pret = true
  choixTheme.value = lire()
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    appareilSombre.value = mq.matches
    mq.addEventListener('change', () => (appareilSombre.value = mq.matches))
  }
  watch(
    themeEffectif,
    (t) => {
      document.documentElement.dataset.theme = t
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#15141b' : '#fbfaf7')
      themeCourant.value = t
    },
    { immediate: true }
  )
}

export function choisirTheme(c: ChoixTheme) {
  choixTheme.value = c
  try {
    if (c === 'auto') localStorage.removeItem(CLE)
    else localStorage.setItem(CLE, c)
  } catch {
    // stockage refuse : le choix vaut pour cette visite
  }
}
