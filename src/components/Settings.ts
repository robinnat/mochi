import { h, type Component } from '@/ui/dom/h'
import { language, LANGUAGES, t } from '@/i18n'

/**
 * Clavier du groupe de radios : les fleches deplacent le choix, et le groupe entier ne compte que pour UN arret
 * de tabulation (`tabindex` mobile), comme un groupe de radios natif.
 */
function atKeyboard(event: KeyboardEvent, index: number) {
  const step = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>)[event.key]
  if (!step) return
  event.preventDefault()
  // on tourne en rond, comme un groupe de radios natif
  const target = LANGUAGES[(index + step + LANGUAGES.length) % LANGUAGES.length]!
  language.value = target.id
  // le focus suit le choix, sinon les fleches suivantes repartent de l'ancien
  const buttons = (event.currentTarget as HTMLElement).parentElement?.children
  const next = buttons?.[LANGUAGES.indexOf(target)]
  if (next instanceof HTMLElement) next.focus()
}

/**
 * Un groupe de boutons radio et non un `<select>` : trois choix se montrent entierement. Chaque bouton porte son
 * `aria-label` en clair, et `lang` est sur le bouton : la synthese vocale prononce « 简体中文 » en chinois.
 */
export const Settings: Component<Record<string, never>> = () => () =>
  h(
    'div',
    null,
    h('h2', { class: 'text-sm font-semibold' }, t('settings.language')),
    h(
      'div',
      { class: 'mt-2 flex flex-col gap-1', role: 'radiogroup', 'aria-label': t('settings.language') },
      LANGUAGES.map((l, i) =>
        h(
          'button',
          {
            key: l.id,
            type: 'button',
            role: 'radio',
            'aria-checked': l.id === language.value,
            'aria-label': l.name,
            lang: l.tag,
            tabindex: l.id === language.value ? 0 : -1,
            onKeydown: (e: KeyboardEvent) => atKeyboard(e, i),
            class: [
              'flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm transition',
              l.id === language.value
                ? 'border-[var(--ink)] bg-white font-medium'
                : 'border-[var(--line)] text-[var(--muted)] hover:border-[var(--muted)] hover:text-[var(--ink)]'
            ],
            onClick: () => (language.value = l.id)
          },
          // le drapeau est decoratif : le nom de la langue dit deja tout
          h('span', { class: 'text-base leading-none', 'aria-hidden': 'true' }, l.emoji),
          h('span', { class: 'flex-1' }, l.name),
          l.id === language.value
            ? h(
                'svg',
                { width: '12', height: '12', viewBox: '0 0 12 12', 'aria-hidden': 'true', class: 'shrink-0' },
                h('path', { d: 'M2.5 6.4 4.8 8.7 9.5 3.6', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
              )
            : null
        )
      )
    )
  )
