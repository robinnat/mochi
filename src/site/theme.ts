import { computed, ref, watch } from '@/ui/dom/reactive'
import { currentTheme } from 'mochiz/catalog'

/**
 * Light, dark or the device's. The choice is kept in the browser (if possible); the page carries `data-theme` and
 * every Mochi of the site switches to dark 3D (black eyes) with it.
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
/** Call once, when the page mounts. */
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
    // storage refused: the choice holds for this visit
  }
}
