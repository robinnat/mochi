import { link } from '@/ui/dom/reactive'
import { h, type Component } from '@/ui/dom/h'
import { t } from '@/i18n'
import { boxModal, BUTTON_SECONDARY } from './dialog'

/** Confirmation d'une action destructrice. Le focus s'ouvre sur « Annuler » : Entree ne doit pas detruire. */
export interface ConfirmDialogProps {
  title: string
  detail: string
  confirmLabel: string
  open: boolean
  onOpen: (v: boolean) => void
  onConfirm: () => void
}

export const ConfirmDialog: Component<ConfirmDialogProps> = (props) => {
  const open = link(() => props.open, (v) => props.onOpen(v))
  const box = boxModal(open)
  function confirm() {
    props.onConfirm()
    open.value = false
  }
  return () =>
    box.draw(
      { 'aria-label': props.title },
      () => (open.value = false),
      h(
        'div',
        { class: 'flex flex-col gap-4' },
        h('div', { class: 'flex flex-col gap-1' }, h('h2', { class: 'text-sm font-semibold' }, props.title), h('p', { class: 'text-xs text-[var(--muted)]' }, props.detail)),
        h(
          'div',
          { class: 'flex justify-end gap-2' },
          h('button', { type: 'button', autofocus: true, class: BUTTON_SECONDARY, onClick: () => (open.value = false) }, t('dialog.cancel')),
          h(
            'button',
            { type: 'button', class: 'h-8 cursor-pointer rounded-lg bg-[var(--danger)] px-3 text-xs text-white transition hover:opacity-90 active:scale-95', onClick: confirm },
            props.confirmLabel
          )
        )
      )
    )
}
