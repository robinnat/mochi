import { computed, ref, watch } from '@/ui/dom/reactive'
import { currentTheme } from 'mochis/catalogue'

/**
 * Clair, sombre ou celui de l'appareil. Le choix est range dans le navigateur (si possible) ; la page porte
 * `data-theme` et tous les Mochi du site passent en 3D sombre (yeux noirs) avec elle.
 */
export type ChoiceTheme = 'auto' | 'light' | 'dark'
export const CHOICE_THEMES: { id: ChoiceTheme; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' }
]

const KEY = 'mochi-site-theme'
const read = (): ChoiceTheme => {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

export const choiceTheme = ref<ChoiceTheme>('auto')
const deviceDark = ref(false)
export const effectiveTheme = computed<'light' | 'dark'>(() => (choiceTheme.value === 'auto' ? (deviceDark.value ? 'dark' : 'light') : choiceTheme.value))

let ready = false
/** A appeler une fois, au montage de la page. */
export function initTheme() {
  if (ready || typeof window === 'undefined') return
  ready = true
  choiceTheme.value = read()
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    deviceDark.value = mq.matches
    mq.addEventListener('change', () => (deviceDark.value = mq.matches))
  }
  watch(
    effectiveTheme,
    (t) => {
      document.documentElement.dataset.theme = t
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#15141b' : '#fbfaf7')
      currentTheme.value = t
    },
    { immediate: true }
  )
}

export function chooseTheme(c: ChoiceTheme) {
  choiceTheme.value = c
  try {
    if (c === 'auto') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, c)
  } catch {
    // stockage refuse : le choix vaut pour cette visite
  }
}
