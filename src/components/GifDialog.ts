import { link } from '@/ui/dom/reactive'
import { h, type Component } from '@/ui/dom/h'
import { t } from '@/i18n'
import { BACKGROUNDS_GIF, type BackgroundGif } from '@/ui/export'
import { boxModal, BUTTON_PRIMARY, BUTTON_SECONDARY } from './dialog'

/**
 * Background choice before downloading the GIF: its transparency has a single bit, so its edge is hard. Real `<input
 * type="radio">`: the browser provides the group, the arrows and the "1 of 2" announcement.
 */
export interface GifDialogProps {
  open: boolean
  background: BackgroundGif
  onOpen: (v: boolean) => void
  onBackground: (v: BackgroundGif) => void
  onConfirm: () => void
}

export const GifDialog: Component<GifDialogProps> = (props) => {
  const open = link(() => props.open, (v) => props.onOpen(v))
  const box = boxModal(open)
  function confirm() {
    props.onConfirm()
    open.value = false
  }
  return () =>
    box.draw(
      { 'aria-label': t('export.gifTitle') },
      () => (open.value = false),
      h(
        'form',
        {
          class: 'flex flex-col gap-4',
          onSubmit: (e: Event) => {
            e.preventDefault()
            confirm()
          }
        },
        h('div', { class: 'flex flex-col gap-1' }, h('h2', { class: 'text-sm font-semibold' }, t('export.gifTitle')), h('p', { class: 'text-xs text-[var(--muted)]' }, t('export.gifDetail'))),
        h(
          'fieldset',
          { class: 'flex flex-col gap-1' },
          h('legend', { class: 'sr-only' }, t('export.gifBackground')),
          BACKGROUNDS_GIF.map((choice, i) =>
            h(
              'label',
              { key: choice, class: 'flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition hover:bg-black/5' },
              h('input', {
                type: 'radio',
                name: 'background',
                value: choice,
                checked: props.background === choice,
                autofocus: i === 0,
                class: 'accent-[var(--ink)]',
                onChange: () => props.onBackground(choice)
              }),
              h('span', { class: 'flex flex-col' }, t(`export.background_${choice}`), h('span', { class: 'text-xs text-[var(--muted)]' }, t(`export.background_${choice}_help`)))
            )
          )
        ),
        h(
          'div',
          { class: 'flex justify-end gap-2' },
          h('button', { type: 'button', class: BUTTON_SECONDARY, onClick: () => (open.value = false) }, t('dialog.cancel')),
          h('button', { type: 'submit', class: BUTTON_PRIMARY }, t('export.gifConfirm'))
        )
      )
    )
}
