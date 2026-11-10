import { link, nextTick, ref, watch } from '@/ui/dom/reactive'
import { h, type Component } from '@/ui/dom/h'
import { t } from '@/i18n'
import { boxModal, BUTTON_PRIMARY, BUTTON_SECONDARY } from './dialog'

/** Naming dialog. */
export interface NameDialogProps {
  title: string
  label: string
  submitLabel: string
  open: boolean
  value: string
  onOpen: (v: boolean) => void
  onSubmit: (name: string) => void
}

export const NameDialog: Component<NameDialogProps> = (props) => {
  const open = link(() => props.open, (v) => props.onOpen(v))
  const box = boxModal(open)
  let field: HTMLInputElement | null = null
  const draft = ref('')

  // the suggested name comes with opening, and the field is already selected
  watch(open, async (on) => {
    if (!on) return
    draft.value = props.value
    await nextTick()
    field?.select()
  })

  function submit() {
    const clean = draft.value.trim()
    // an empty name means nothing: we keep control rather than validate
    if (!clean) {
      field?.focus()
      return
    }
    props.onSubmit(clean)
    open.value = false
  }

  return () =>
    box.draw(
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
          h('button', { type: 'button', class: BUTTON_SECONDARY, onClick: () => (open.value = false) }, t('dialog.cancel')),
          h('button', { type: 'submit', class: BUTTON_PRIMARY }, props.submitLabel)
        )
      )
    )
}
