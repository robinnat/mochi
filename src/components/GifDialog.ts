import { lien } from '@/ui/dom/reactif'
import { h, type Composant } from '@/ui/dom/h'
import { t } from '@/i18n'
import { FONDS_GIF, type FondGif } from '@/ui/export'
import { boiteModale, BOUTON_PRINCIPAL, BOUTON_SECONDAIRE } from './dialogue'

/**
 * Choix du fond avant de telecharger le GIF : sa transparence n'a qu'un bit, donc son bord est dur. De vrais
 * `<input type="radio">` : le navigateur donne le groupe, les fleches et l'annonce « 1 sur 2 ».
 */
export interface GifDialogProps {
  open: boolean
  fond: FondGif
  onOpen: (v: boolean) => void
  onFond: (v: FondGif) => void
  onConfirm: () => void
}

export const GifDialog: Composant<GifDialogProps> = (props) => {
  const open = lien(() => props.open, (v) => props.onOpen(v))
  const boite = boiteModale(open)
  function confirm() {
    props.onConfirm()
    open.value = false
  }
  return () =>
    boite.dessiner(
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
          FONDS_GIF.map((choix, i) =>
            h(
              'label',
              { key: choix, class: 'flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition hover:bg-black/5' },
              h('input', {
                type: 'radio',
                name: 'fond',
                value: choix,
                checked: props.fond === choix,
                autofocus: i === 0,
                class: 'accent-[var(--ink)]',
                onChange: () => props.onFond(choix)
              }),
              h('span', { class: 'flex flex-col' }, t(`export.fond_${choix}`), h('span', { class: 'text-xs text-[var(--muted)]' }, t(`export.fond_${choix}_aide`)))
            )
          )
        ),
        h(
          'div',
          { class: 'flex justify-end gap-2' },
          h('button', { type: 'button', class: BOUTON_SECONDAIRE, onClick: () => (open.value = false) }, t('dialog.cancel')),
          h('button', { type: 'submit', class: BOUTON_PRINCIPAL }, t('export.gifConfirm'))
        )
      )
    )
}
