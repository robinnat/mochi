import { ref } from '@/ui/dom/reactif'
import { h, surDemontage, surMontage, type Composant } from '@/ui/dom/h'
import { choisirTheme, themeEffectif } from './theme'

/** Barre du haut, commune au site et a la page docs. `accueil` : prefixe des ancres (vide sur l'accueil, `/` ailleurs). */
export interface NavProps {
  accueil?: string
  page?: 'site' | 'docs'
}

const LIENS = [
  { href: '#styles', label: 'Styles' },
  { href: '#shapes', label: 'Shapes' },
  { href: '#moods', label: 'Moods' },
  { href: '#customise', label: 'Customise' }
]
const GITHUB = 'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z'

export const Nav: Composant<NavProps> = (props) => {
  const accueil = () => props.accueil ?? ''
  /** La barre prend un fond une fois la page defilee (en haut, elle se fond dans le hero). */
  const defile = ref(false)
  const maj = () => (defile.value = window.scrollY > 8)
  surMontage(() => {
    maj()
    window.addEventListener('scroll', maj, { passive: true })
  })
  surDemontage(() => window.removeEventListener('scroll', maj))

  return () => {
    const sombre = themeEffectif.value === 'dark'
    return h(
      'nav',
      { class: ['nav', { defile: defile.value }], 'aria-label': 'Main' },
      h(
        'div',
        { class: 'nav-in' },
        h(
          'a',
          { class: 'marque', href: accueil() || '#top', 'aria-label': 'Mochi World, home' },
          h('img', { src: '/favicon.svg', width: '24', height: '24', alt: '' }),
          h('span', null, 'Mochi World')
        ),
        h(
          'div',
          { class: 'nav-liens' },
          LIENS.map((l) => h('a', { key: l.href, href: accueil() + l.href }, l.label)),
          h('a', { href: '/docs', 'aria-current': props.page === 'docs' ? 'page' : undefined }, 'Docs')
        ),
        h(
          'div',
          { class: 'nav-droite' },
          h(
            'a',
            { class: 'nav-icone', href: 'https://github.com/robinnat/mochi', 'aria-label': 'Mochi World on GitHub' },
            h('svg', { viewBox: '0 0 16 16', width: '18', height: '18', 'aria-hidden': 'true' }, h('path', { fill: 'currentColor', d: GITHUB }))
          ),
          h(
            'button',
            {
              type: 'button',
              class: 'nav-icone',
              'aria-label': sombre ? 'Switch to light mode' : 'Switch to dark mode',
              onClick: () => choisirTheme(sombre ? 'light' : 'dark')
            },
            sombre
              ? h(
                  'svg',
                  { key: 'soleil', viewBox: '0 0 24 24', width: '18', height: '18', 'aria-hidden': 'true' },
                  h('circle', { cx: '12', cy: '12', r: '4.2', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8' }),
                  h('path', {
                    d: 'M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6',
                    stroke: 'currentColor',
                    'stroke-width': '1.8',
                    'stroke-linecap': 'round'
                  })
                )
              : h(
                  'svg',
                  { key: 'lune', viewBox: '0 0 24 24', width: '18', height: '18', 'aria-hidden': 'true' },
                  h('path', { d: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linejoin': 'round' })
                )
          ),
          h('a', { class: 'nav-cta', href: '/app' }, 'Open the app')
        )
      )
    )
  }
}
