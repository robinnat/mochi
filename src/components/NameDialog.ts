import { lien, nextTick, ref, watch } from '@/ui/dom/reactif'
import { h, type Composant } from '@/ui/dom/h'
import { t } from '@/i18n'
import { boiteModale, BOUTON_PRINCIPAL, BOUTON_SECONDAIRE } from './dialogue'

/** Boite de dialogue de nommage. */
export interface NameDialogProps {
  title: string
  label: string
  submitLabel: string
  open: boolean
  value: string
  onOpen: (v: boolean) => void
  onSubmit: (name: string) => void
}

export const NameDialog: Composant<NameDialogProps> = (props) => {
  const open = lien(() => props.open, (v) => props.onOpen(v))
  const boite = boiteModale(open)
  let field: HTMLInputElement | null = null
  const draft = ref('')

  // le nom propose arrive avec l'ouverture, et le champ s'offre deja selectionne
  watch(open, async (on) => {
    if (!on) return
    draft.value = props.value
    await nextTick()
    field?.select()
  })

  function submit() {
    const clean = draft.value.trim()
    // un nom vide ne veut rien dire : on garde la main plutot que de valider
    if (!clean) {
      field?.focus()
      return
    }
    props.onSubmit(clean)
    open.value = false
  }

  return () =>
    boite.dessiner(
      { 'aria-label': props.title },
      () => (open.value = false),
      h(
        'form',
        {
          class: 'flex flex-col gap-4',
          onSubmit: (e: Event) => {
            e.preventDefault()
            submit()
          }
        },
        h('h2', { class: 'text-sm font-semibold' }, props.title),
        h(
          'label',
          { class: 'flex flex-col gap-1.5 text-xs text-[var(--muted)]' },
          props.label,
          h('input', {
            ref: (e: Element | null) => (field = e as HTMLInputElement | null),
            class: 'h-9 rounded-lg bg-black/5 px-2.5 text-sm text-[var(--ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)]',
            type: 'text',
            maxlength: '40',
            required: true,
            value: draft.value,
            onInput: (e: Event) => (draft.value = (e.target as HTMLInputElement).value)
          })
        ),
        h(
          'div',
          { class: 'flex justify-end gap-2' },
          h('button', { type: 'button', class: BOUTON_SECONDAIRE, onClick: () => (open.value = false) }, t('dialog.cancel')),
          h('button', { type: 'submit', class: BOUTON_PRINCIPAL }, props.submitLabel)
        )
      )
    )
}
