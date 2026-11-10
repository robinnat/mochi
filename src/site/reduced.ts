import { ref } from '@/ui/dom/reactive'
import { onUnmount } from '@/ui/dom/h'

/**
 * `prefers-reduced-motion`, suivi en direct. Le site s'y plie plus strictement que
 * l'application : avec ce reglage, aucune demo n'a de boucle, elles montrent une image.
 * A appeler pendant la mise en place d'un composant (l'ecoute s'arrete avec lui).
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
