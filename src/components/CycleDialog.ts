import { computed, link } from '@/ui/dom/reactive'
import { h, type Component } from '@/ui/dom/h'
import { t } from '@/i18n'
import { BACKGROUNDS_GIF, FORMATS_CYCLE, cycleAccepteTransparence, videoPossible, type BackgroundGif, type FormatCycle } from '@/ui/export'
import { boxModal, BUTTON_PRIMARY, BUTTON_SECONDARY } from './dialog'

/**
 * Choix du format avant d'exporter le montage. Le groupe « fond » n'apparait QUE pour le GIF : la video n'a pas de
 * canal alpha du tout.
 */
export interface CycleDialogProps {
  progress: number | null
  /** true = le dernier essai a echoue. La boite le dit et propose de reessayer. */
  error: boolean
  open: boolean
  format: FormatCycle
  background: BackgroundGif
  onOpen: (v: boolean) => void
  onFormat: (v: FormatCycle) => void
  onBackground: (v: BackgroundGif) => void
  onConfirm: () => void
  onCancel: () => void
}

export const CycleDialog: Component<CycleDialogProps> = (props) => {
  const open = link(() => props.open, (v) => props.onOpen(v))
  const box = boxModal(open)

  /**
   * La video n'est proposee que la ou le navigateur sait encoder. Le garde vient de `export.ts` et SURTOUT PAS de
   * `video.ts` : l'importer d'ici ramenerait mediabunny dans le morceau d'entree.
   */
  const formats = FORMATS_CYCLE.filter((f) => f !== 'mp4' || videoPossible())
  // le modele est corrige, pas seulement la liste : une valeur cachee ne doit pas gagner
  if (!formats.includes(props.format)) props.onFormat(formats[0]!)

  const busy = computed(() => props.progress !== null)
  const percent = computed(() => Math.round((props.progress ?? 0) * 100))

  function confirm() {
    // la boite reste ouverte pendant l'encodage : c'est elle qui porte la progression
    if (!busy.value) props.onConfirm()
  }
  /** Fermer, c'est ABANDONNER quand l'encodage tourne. */
  function closed() {
    if (busy.value) props.onCancel()
    open.value = false
  }

  const radio = (name: string, choice: string, check: boolean, choose: () => void, extra: Record<string, unknown> = {}) =>
    h('input', { type: 'radio', name: name, value: choice, checked: check, class: 'accent-[var(--ink)]', onChange: choose, ...extra })

  return () =>
    box.draw(
      { 'aria-label': t('timeline.export') },
      closed,
      h(
        'form',
        {
          class: 'flex flex-col gap-4',
          onSubmit: (e: Event) => {
            e.preventDefault()
            confirm()
          }
        },
        h('div', { class: 'flex flex-col gap-1' }, h('h2', { class: 'text-sm font-semibold' }, t('timeline.export')), h('p', { class: 'text-xs text-[var(--muted)]' }, t('export.cycleDetail'))),
        h(
          'fieldset',
          { class: 'flex flex-col gap-1', disabled: busy.value },
          h('legend', { class: 'sr-only' }, t('export.cycleFormat')),
          formats.map((choice, i) =>
            h(
              'label',
              { key: choice, class: 'flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition hover:bg-black/5' },
              radio('format', choice, props.format === choice, () => props.onFormat(choice), { autofocus: i === 0 }),
              h('span', { class: 'flex flex-col' }, t(`export.cycle_${choice}`), h('span', { class: 'text-xs text-[var(--muted)]' }, t(`export.cycle_${choice}_help`)))
            )
          )
        ),
        // seul le GIF a un alpha a offrir
        cycleAccepteTransparence(props.format)
          ? h(
              'fieldset',
              { key: 'background', class: 'flex flex-col gap-1', disabled: busy.value },
              h('legend', { class: 'sr-only' }, t('export.gifBackground')),
              BACKGROUNDS_GIF.map((choice) =>
                h(
                  'label',
                  { key: choice, class: 'flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition hover:bg-black/5' },
                  radio('backgroundCycle', choice, props.background === choice, () => props.onBackground(choice)),
                  t(`export.background_${choice}`)
                )
              )
            )
          : null,
        // l'echec s'affiche ICI : la barre d'export n'est pas a l'ecran dans les Animations
        props.error && !busy.value ? h('p', { key: 'err', class: 'text-xs text-[var(--danger)]', role: 'alert' }, t('export.failed')) : null,
        busy.value
          ? h(
              'div',
              { key: 'prog', class: 'flex flex-col gap-1.5' },
              // pas de `transition` sur la largeur : elle passerait par le thread principal, sature par l'encodage
              h('div', { class: 'h-1.5 overflow-hidden rounded-full bg-black/10' }, h('div', { class: 'h-full rounded-full bg-[var(--ink)]', style: { width: `${percent.value}%` } })),
              h(
                'div',
                { class: 'flex items-center justify-between gap-2' },
                h('p', { class: 'text-xs tabular-nums text-[var(--muted)]' }, `${t('export.cycleProgress')} ${percent.value} %`),
                h('button', { type: 'button', class: 'h-7 cursor-pointer rounded-lg px-2 text-xs text-[var(--muted)] transition hover:bg-black/5 hover:text-[var(--ink)]', onClick: closed }, t('dialog.cancel'))
              )
            )
          : h(
              'div',
              { key: 'buttons', class: 'flex justify-end gap-2' },
              h('button', { type: 'button', class: BUTTON_SECONDARY, onClick: closed }, t('dialog.cancel')),
              h('button', { type: 'submit', class: BUTTON_PRIMARY }, props.error ? t('export.cycleRetry') : t('export.gifConfirm'))
            )
      )
    )
}
