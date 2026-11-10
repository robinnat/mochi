import { ref } from '@/ui/dom/reactif'
import { surDemontage } from '@/ui/dom/h'

/**
 * `prefers-reduced-motion`, suivi en direct. Le site s'y plie plus strictement que
 * l'application : avec ce reglage, aucune demo n'a de boucle, elles montrent une image.
 * A appeler pendant la mise en place d'un composant (l'ecoute s'arrete avec lui).
 */
export function useReduit() {
  const reduit = ref(false)
  if (typeof window !== 'undefined' && window.matchMedia) {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    reduit.value = mq.matches
    const maj = () => (reduit.value = mq.matches)
    mq.addEventListener('change', maj)
    surDemontage(() => mq.removeEventListener('change', maj))
  }
  return reduit
}
