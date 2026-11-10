import { lien } from '@/ui/dom/reactif'
import { h, type Composant } from '@/ui/dom/h'
import { t } from '@/i18n'
import { boiteModale, BOUTON_SECONDAIRE } from './dialogue'

/** Confirmation d'une action destructrice. Le focus s'ouvre sur « Annuler » : Entree ne doit pas detruire. */
export interface ConfirmDialogProps {
  title: string
  detail: string
  confirmLabel: string
  open: boolean
  onOpen: (v: boolean) => void
  onConfirm: () => void
}

export const ConfirmDialog: Composant<ConfirmDialogProps> = (props) => {
  const open = lien(() => props.open, (v) => props.onOpen(v))
  const boite = boiteModale(open)
  function confirm() {
    props.onConfirm()
    open.value = false
  }
  return () =>
    boite.dessiner(
      { 'aria-label': props.title },
      () => (open.value = false),
      h(
        'div',
        { class: 'flex flex-col gap-4' },
        h('div', { class: 'flex flex-col gap-1' }, h('h2', { class: 'text-sm font-semibold' }, props.title), h('p', { class: 'text-xs text-[var(--muted)]' }, props.detail)),
        h(
          'div',
          { class: 'flex justify-end gap-2' },
          h('button', { type: 'button', autofocus: true, class: BOUTON_SECONDAIRE, onClick: () => (open.value = false) }, t('dialog.cancel')),
          h(
            'button',
            { type: 'button', class: 'h-8 cursor-pointer rounded-lg bg-[var(--danger)] px-3 text-xs text-white transition hover:opacity-90 active:scale-95', onClick: confirm },
            props.confirmLabel
          )
        )
      )
    )
}
