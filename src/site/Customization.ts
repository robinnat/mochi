import { ref } from '@/ui/dom/reactive'
import { h, onUnmount, onMount, type Component } from '@/ui/dom/h'
import { reveal } from './motion'

/**
 * "Make it yours". The title is in the page at once (the #customize anchor always works); the customizer itself (its
 * code, its images) only loads as the section gets near.
 */
type Body = Component<Record<string, never>>

export const Customization: Component<Record<string, never>> = () => {
  let zone: HTMLElement | null = null
  const load = ref(typeof IntersectionObserver === 'undefined')
  const body = ref<Body | null>(null)
  let obs: IntersectionObserver | null = null

  const lancer = () => {
    load.value = true
    import('./BodyCustomizer').then((m) => (body.value = m.BodyCustomizer))
  }
  if (load.value) lancer()

  onMount(() => {
    if (load.value || !zone) return
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
  onUnmount(() => obs?.disconnect())
  const rv = [reveal(), reveal(1), reveal(2)]

  return () =>
    h(
      'section',
      { id: 'customize', ref: (el: Element | null) => (zone = el as HTMLElement | null), class: 'sec perso', 'aria-labelledby': 't-custom' },
      h(
        'div',
        { class: 'wrap sec-head' },
        h('p', { ref: rv[0], class: 'eyebrow' }, 'Customize'),
        h('h2', { id: 't-custom', ref: rv[1], class: 'title-sec' }, 'Make it yours.'),
        h(
          'p',
          { ref: rv[2], class: 'lede' },
          'Pick a style, a shape, any color, a mood and a few accessories. The preview is the real component, and the code below follows every choice.'
        )
      ),
      body.value ? h(body.value as Component<never>, { key: 'body' }) : h('div', { key: 'waiting', class: 'custom-waiting', 'aria-hidden': 'true' })
    )
}
