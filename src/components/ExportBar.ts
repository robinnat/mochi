import { computed, ref, watch } from '@/ui/dom/reactif'
import { h, surDemontage, type Composant } from '@/ui/dom/h'
import { t } from '@/i18n'
import { copiePossible } from '@/ui/capture'
import { ACTIONS, ACTION_DEFAUT, type ActionId, type EtatExport } from '@/ui/export'

/**
 * Barre d'export de l'avatar : un bouton pour le format courant, et une fleche accolee pour les autres. Purement
 * presentationnelle : c'est `App` qui possede le SVG a capturer. Le menu s'ouvre vers le HAUT.
 */
export interface ExportBarProps {
  etat: EtatExport
  onExporter: (id: ActionId) => void
}

const TELECHARGE_A = 'M3 15C3 17.8284 3 19.2426 3.87868 20.1213C4.75736 21 6.17157 21 9 21H15C17.8284 21 19.2426 21 20.1213 20.1213C21 19.2426 21 17.8284 21 15'
const TELECHARGE_B = 'M12 3V16M8 11.625L12 16L16 11.625'
const COPIE_A =
  'M6 11C6 8.17157 6 6.75736 6.87868 5.87868C7.75736 5 9.17157 5 12 5H15C17.8284 5 19.2426 5 20.1213 5.87868C21 6.75736 21 8.17157 21 11V16C21 18.8284 21 20.2426 20.1213 21.1213C19.2426 22 17.8284 22 15 22H12C9.17157 22 7.75736 22 6.87868 21.1213C6 20.2426 6 18.8284 6 16V11Z'
const COPIE_B = 'M6 19C4.34315 19 3 17.6569 3 16V10C3 6.22876 3 4.34315 4.17157 3.17157C5.34315 2 7.22876 2 11 2H15C16.6569 2 18 3.34315 18 5'

/** solar:download-minimalistic-linear */
export const iconeTelecharge = (taille: string, classe?: string) =>
  h(
    'svg',
    { width: taille, height: taille, viewBox: '0 0 24 24', 'aria-hidden': 'true', class: classe },
    h('g', { fill: 'none', stroke: 'currentColor', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '1.5' }, h('path', { d: TELECHARGE_A }), h('path', { d: TELECHARGE_B }))
  )

export const ExportBar: Composant<ExportBarProps> = (props) => {
  const open = ref(false)
  let root: HTMLElement | null = null

  /** La copie d'IMAGE n'est pas proposee la ou le navigateur ne sait pas en ecrire. */
  const actions = ACTIONS.filter((a) => a.mode !== 'copieImage' || copiePossible())
  const occupe = computed(() => props.etat === 'occupe')
  /** Le bouton principal rend compte de ce qui vient de se passer. */
  const libelle = computed(() => {
    if (props.etat === 'exporte') return t('export.done')
    if (props.etat === 'copie') return t('export.copied')
    if (props.etat === 'erreur') return t('export.failed')
    return t('export.action')
  })
  const confirme = computed(() => props.etat === 'exporte' || props.etat === 'copie')

  function lance(id: ActionId) {
    open.value = false
    props.onExporter(id)
  }
  function onOutside(e: PointerEvent) {
    if (!root?.contains(e.target as Node)) open.value = false
  }
  watch(open, (on) => {
    if (on) window.addEventListener('pointerdown', onOutside)
    else window.removeEventListener('pointerdown', onOutside)
  })
  surDemontage(() => window.removeEventListener('pointerdown', onOutside))

  return () =>
    h(
      'div',
      {
        ref: (el: Element | null) => (root = el as HTMLElement | null),
        class: 'relative',
        onKeydown: (e: KeyboardEvent) => {
          if (e.key === 'Escape') open.value = false
        }
      },
      h(
        'div',
        { class: ['flex overflow-hidden rounded-xl bg-[var(--ink)] text-[var(--paper)] shadow-sm transition', occupe.value && 'opacity-60'] },
        h(
          'button',
          {
            type: 'button',
            class: 'flex cursor-pointer items-center gap-2 py-2.5 pr-3 pl-3.5 text-sm font-medium transition hover:bg-white/10 disabled:cursor-default',
            disabled: occupe.value,
            onClick: () => lance(ACTION_DEFAUT)
          },
          confirme.value
            ? // solar:check-circle-linear
              h(
                'svg',
                { width: '17', height: '17', viewBox: '0 0 24 24', 'aria-hidden': 'true' },
                h(
                  'g',
                  { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' },
                  h('circle', { cx: '12', cy: '12', r: '10' }),
                  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M8.5 12.5L10.5 14.5L15.5 9.5' })
                )
              )
            : iconeTelecharge('17'),
          libelle.value
        ),
        // pleine hauteur : le conteneur est en `flex`, l'etirement suffit
        h('div', { class: 'w-px self-stretch bg-current opacity-25' }),
        h(
          'button',
          {
            type: 'button',
            class: 'flex cursor-pointer items-center px-2.5 transition hover:bg-white/10 disabled:cursor-default',
            disabled: occupe.value,
            'aria-label': t('export.more'),
            'aria-haspopup': 'true',
            'aria-expanded': open.value,
            onClick: () => (open.value = !open.value)
          },
          // solar:alt-arrow-down-linear
          h(
            'svg',
            { width: '15', height: '15', viewBox: '0 0 24 24', 'aria-hidden': 'true', class: ['transition-transform', open.value && 'rotate-180'] },
            h('path', { fill: 'none', stroke: 'currentColor', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '1.5', d: 'M19 9L12 15L5 9' })
          )
        )
      ),
      open.value
        ? h(
            'div',
            { class: 'absolute right-0 bottom-full z-10 mb-2 w-60 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-1 shadow-lg' },
            actions.map((action) =>
              h(
                'button',
                {
                  key: action.id,
                  type: 'button',
                  class: [
                    'flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-black/5',
                    action.id === 'copie' && 'mt-1 border-t border-[var(--line)] pt-2.5'
                  ],
                  onClick: () => lance(action.id)
                },
                action.mode === 'copieImage' || action.mode === 'copieTexte'
                  ? // solar:copy-linear
                    h(
                      'svg',
                      { width: '16', height: '16', viewBox: '0 0 24 24', 'aria-hidden': 'true', class: 'shrink-0 text-[var(--muted)]' },
                      h('g', { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, h('path', { d: COPIE_A }), h('path', { d: COPIE_B }))
                    )
                  : iconeTelecharge('16', 'shrink-0 text-[var(--muted)]'),
                t(`export.${action.id}`)
              )
            )
          )
        : null
    )
}
