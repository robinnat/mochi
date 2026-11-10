import { ref } from '@/ui/dom/reactif'
import { h, surDemontage, surMontage, type Composant } from '@/ui/dom/h'
import { reveal } from './motion'

/**
 * « Make it yours ». Le titre est dans la page tout de suite (l'ancre #customise marche toujours) ; le
 * personnalisateur lui-meme (son code, ses images) n'est charge qu'a l'approche de la section.
 */
type Corps = Composant<Record<string, never>>

export const Personnalisation: Composant<Record<string, never>> = () => {
  let zone: HTMLElement | null = null
  const charger = ref(typeof IntersectionObserver === 'undefined')
  const corps = ref<Corps | null>(null)
  let obs: IntersectionObserver | null = null

  const lancer = () => {
    charger.value = true
    import('./PersoCorps').then((m) => (corps.value = m.PersoCorps))
  }
  if (charger.value) lancer()

  surMontage(() => {
    if (charger.value || !zone) return
    obs = new IntersectionObserver(
      (es) => {
        if (es[es.length - 1]?.isIntersecting) {
          obs?.disconnect()
          lancer()
        }
      },
      { rootMargin: '900px 0px' }
    )
    obs.observe(zone)
  })
  surDemontage(() => obs?.disconnect())
  const rv = [reveal(), reveal(1), reveal(2)]

  return () =>
    h(
      'section',
      { id: 'customise', ref: (el: Element | null) => (zone = el as HTMLElement | null), class: 'sec perso', 'aria-labelledby': 't-perso' },
      h(
        'div',
        { class: 'wrap sec-tete' },
        h('p', { ref: rv[0], class: 'surtitre' }, 'Customise'),
        h('h2', { id: 't-perso', ref: rv[1], class: 'titre-sec' }, 'Make it yours.'),
        h(
          'p',
          { ref: rv[2], class: 'chapo' },
          'Pick a style, a shape, any colour, a mood and a few accessories. The preview is the real component, and the code below follows every choice.'
        )
      ),
      corps.value ? h(corps.value as Composant<never>, { key: 'corps' }) : h('div', { key: 'attente', class: 'perso-attente', 'aria-hidden': 'true' })
    )
}
