import { ref } from '@/ui/dom/reactive'
import { h, onUnmount, onMount, type Component } from '@/ui/dom/h'
import { chooseTheme, effectiveTheme } from './theme'
import { loadStars, stars, formatStars } from './stars'

/**
 * Top bar, shared by the site and the docs page. `home`: prefix of the anchors (empty on the home page, `/`
 * elsewhere).
 */
export interface NavProps {
  home?: string
  page?: 'site' | 'docs'
}

const LINKS = [
  { href: '#styles', label: 'Styles' },
  { href: '#shapes', label: 'Shapes' },
  { href: '#moods', label: 'Moods' },
  { href: '#customise', label: 'Customise' }
]
const GITHUB = 'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z'

/** Full star (GitHub star icon, drawn by hand). */
const STAR = 'M8 .9l2.1 4.4 4.8.6-3.5 3.3.9 4.8L8 11.7 3.7 14l.9-4.8L1.1 5.9l4.8-.6L8 .9Z'

/** The Mochis mark: a light and a dark version, the CSS shows the one of the current theme. */
export const brandMark = (size: number) => [
  h('img', { class: 'mark mark-light', src: '/mark-light-96.png', width: String(size), height: String(size), alt: '' }),
  h('img', { class: 'mark mark-dark', src: '/mark-dark-96.png', width: String(size), height: String(size), alt: '' })
]

export const Nav: Component<NavProps> = (props) => {
  const home = () => props.home ?? ''
  /** The bar gets a background once the page is scrolled (at the top, it blends into the hero). */
  const scroll = ref(false)
  const update = () => (scroll.value = window.scrollY > 8)
  onMount(() => {
    update()
    window.addEventListener('scroll', update, { passive: true })
    loadStars()
  })
  onUnmount(() => window.removeEventListener('scroll', update))

  return () => {
    const dark = effectiveTheme.value === 'dark'
    return h(
      'nav',
      { class: ['nav', { scroll: scroll.value }], 'aria-label': 'Main' },
      h(
        'div',
        { class: 'nav-in' },
        h(
          'a',
          { class: 'brand', href: home() || '#top', 'aria-label': 'Mochis, home' },
          brandMark(28),
          h('span', { class: 'wordmark' }, 'Mochis')
        ),
        h(
          'div',
          { class: 'nav-links' },
          LINKS.map((l) => h('a', { key: l.href, href: home() + l.href }, l.label)),
          h('a', { href: '/docs', 'aria-current': props.page === 'docs' ? 'page' : undefined }, 'Docs')
        ),
        h(
          'div',
          { class: 'nav-right' },
          h(
            'a',
            {
              class: ['nav-icon', { 'nav-stars': stars.value !== null }],
              href: 'https://github.com/robinnat/mochi',
              'aria-label': stars.value === null ? 'Mochis on GitHub' : `Mochis on GitHub, ${stars.value} stars`
            },
            h('svg', { viewBox: '0 0 16 16', width: '18', height: '18', 'aria-hidden': 'true' }, h('path', { fill: 'currentColor', d: GITHUB })),
            stars.value === null
              ? null
              : h(
                  'span',
                  { class: 'nav-n-stars', 'aria-hidden': 'true' },
                  h('svg', { viewBox: '0 0 16 16', width: '12', height: '12' }, h('path', { fill: 'currentColor', d: STAR })),
                  formatStars(stars.value)
                )
          ),
          h(
            'button',
            {
              type: 'button',
              class: 'nav-icon',
              'aria-label': dark ? 'Switch to light mode' : 'Switch to dark mode',
              onClick: () => chooseTheme(dark ? 'light' : 'dark')
            },
            dark
              ? h(
                  'svg',
                  { key: 'sunglasses', viewBox: '0 0 24 24', width: '18', height: '18', 'aria-hidden': 'true' },
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
                  { key: 'moon', viewBox: '0 0 24 24', width: '18', height: '18', 'aria-hidden': 'true' },
                  h('path', { d: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linejoin': 'round' })
                )
          ),
          h('a', { class: 'nav-cta', href: '/app' }, 'Open the app')
        )
      )
    )
  }
}
