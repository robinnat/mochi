import { ref } from '@/ui/dom/reactive'
import { onUnmount } from '@/ui/dom/h'

/**
 * `prefers-reduced-motion`, tracked live. The site follows it more strictly than the tag: with this setting, no demo
 * loops, they show an image. Call it during a component's setup (listening stops with it).
 */
export function useReduced() {
  const reduced = ref(false)
  if (typeof window !== 'undefined' && window.matchMedia) {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    reduced.value = mq.matches
    const update = () => (reduced.value = mq.matches)
    mq.addEventListener('change', update)
    onUnmount(() => mq.removeEventListener('change', update))
  }
  return reduced
}
