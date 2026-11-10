import { computed, link } from '@/ui/dom/reactive'
import { h, type Component } from '@/ui/dom/h'
import { t } from '@/i18n'
import { BACKGROUNDS_GIF, FORMATS_CYCLE, cycleAccepteTransparence, videoPossible, type BackgroundGif, type FormatCycle } from '@/ui/export'
import { boxModal, BUTTON_PRIMARY, BUTTON_SECONDARY } from './dialog'

/**
 * Format choice before exporting the montage. The "background" group shows ONLY for GIF: video has no alpha channel
 * at all.
 */
export interface CycleDialogProps {
  progress: number | null
  /** true = the last try failed. The dialog says so and offers to retry. */
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
   * Video is only offered where the browser can encode. The guard comes from `export.ts` and ABOVE ALL not from
   * `video.ts`: importing it from here would pull mediabunny into the entry chunk.
   */
  const formats = FORMATS_CYCLE.filter((f) => f !== 'mp4' || videoPossible())
  // the model is fixed, not only the list: a hidden value must not win
  if (!formats.includes(props.format)) props.onFormat(formats[0]!)

  const busy = computed(() => props.progress !== null)
  const percent = computed(() => Math.round((props.progress ?? 0) * 100))

  function confirm() {
    // the dialog stays open while encoding: it carries the progress
    if (!busy.value) props.onConfirm()
  }
  /** Closing means GIVING UP while encoding runs. */
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
        // only GIF has an alpha to offer
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
        // the failure shows HERE: the export bar is not on screen in Animations
        props.error && !busy.value ? h('p', { key: 'err', class: 'text-xs text-[var(--danger)]', role: 'alert' }, t('export.failed')) : null,
        busy.value
          ? h(
              'div',
              { key: 'prog', class: 'flex flex-col gap-1.5' },
              // no `transition` on the width: it would go through the main thread, saturated by encoding
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
